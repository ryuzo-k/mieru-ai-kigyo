import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, MeasurementResult } from '@/types'

export interface ContentSuggestion {
  id: string
  type: 'owned_media_article' | 'press_release' | 'case_study' | 'column' | 'misinformation_correction'
  typeLabel: string
  title: string
  angle: string // 記事の切り口・アングル
  coverageType: 'multi' | 'single' // 複数プロンプトカバーか単独特化か
  coveredPromptIds: string[]
  coveredPromptTexts: string[]
  whyNow: string // なぜ今この記事か
  estimatedImpact: 'high' | 'medium' | 'low'
  keyRequirements: string[] // 必ず含めるべき内容
  referencedSites: string[] // 参照した競合・引用サイト
}

const TYPE_LABELS: Record<ContentSuggestion['type'], string> = {
  owned_media_article: 'オウンドメディア記事',
  press_release: 'プレスリリース',
  case_study: '事例紹介',
  column: '専門コラム',
  misinformation_correction: '誤情報訂正記事',
}

async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return ''
    const text = await res.text()
    return text.substring(0, 3000)
  } catch {
    clearTimeout(timer)
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      store,
      prompts,
      measurementResults = [],
      rawResponsesByPrompt = {},
      clientApiKey,
    }: {
      store: StoreInfo
      prompts: Prompt[]
      measurementResults?: MeasurementResult[]
      rawResponsesByPrompt?: Record<string, string[]>
      clientApiKey?: string
    } = await request.json()

    if (!store || !prompts?.length) {
      return NextResponse.json({ error: '企業情報とプロンプトが必要です' }, { status: 400 })
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic APIキーが必要です' }, { status: 400 })
    }

    const winningPrompts = prompts.filter((p) => p.isWinning)
    const targetPrompts = winningPrompts.length > 0 ? winningPrompts : prompts

    // ── Step 1: Collect & deduplicate cited URLs from measurement results ──
    const allCitedUrls = Array.from(
      new Set(measurementResults.flatMap((r) => r.citedUrls || []).filter(Boolean))
    ).slice(0, 10)

    // ── Step 2: Scrape top 10 URLs in parallel ──
    let scrapedContent = ''
    if (allCitedUrls.length > 0) {
      const results = await Promise.allSettled(allCitedUrls.map(scrapeUrl))
      const scraped = results
        .map((r, i) => ({
          url: allCitedUrls[i],
          content: r.status === 'fulfilled' ? r.value : '',
        }))
        .filter((s) => s.content.length > 100)

      if (scraped.length > 0) {
        // ── Step 3: Extract key requirements from scraped content via Claude ──
        const extractPrompt = `You are a GEO analyst. Below are scraped contents from websites that AI engines cited when answering questions about the industry.
Extract the key requirements and information patterns that make these pages get cited by AI.
Focus on: what facts, data, structures, and claims appear most. Be concise.

${scraped.map((s, i) => `--- Site ${i + 1}: ${s.url} ---\n${s.content}`).join('\n\n')}

Return a JSON object with:
{
  "keyFindings": ["finding 1", "finding 2", ...],
  "citationPatterns": ["what makes these pages get cited", ...],
  "requiredElements": ["element that must be in content to compete", ...]
}
Return ONLY raw JSON.`

        const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [{ role: 'user', content: extractPrompt }],
          }),
        })

        if (extractRes.ok) {
          const extractData = await extractRes.json()
          const extractText = extractData.content[0]?.text || ''
          try {
            const stripped = extractText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
            const extracted = JSON.parse(stripped)
            scrapedContent = `
Competitor/cited site analysis (from ${scraped.length} scraped URLs):
Key findings: ${(extracted.keyFindings || []).join('; ')}
Citation patterns: ${(extracted.citationPatterns || []).join('; ')}
Required elements: ${(extracted.requiredElements || []).join('; ')}
`
          } catch {
            scrapedContent = `Scraped ${scraped.length} cited sites. URLs: ${scraped.map((s) => s.url).join(', ')}`
          }
        }
      }
    }

    // Build raw AI responses summary for misinformation analysis
    const rawResponsesSummary = targetPrompts.slice(0, 5).map((p) => {
      const responses = (rawResponsesByPrompt as Record<string, string[]>)[p.id] || []
      if (responses.length === 0) return ''
      return 'Prompt: ' + p.text.substring(0, 80) + '\nAI Response sample: ' + (responses[0]?.substring(0, 300) || '')
    }).filter(Boolean).join('\n\n')

    const promptList = targetPrompts.map((p) =>
      `ID:${p.id} | [${Math.round(p.displayRate ?? 0)}%] ${p.text}`
    ).join('\n')

    const systemPrompt = `You are a world-class GEO (Generative Engine Optimization) strategist.
Your job: given a company's winning prompts, design a content portfolio that maximizes AI citation coverage.

You must return ONLY raw JSON — no markdown, no code blocks, no explanation.`

    const userPrompt = `Company: ${store.name}
Industry: ${store.businessType}
Description: ${store.description}
Target: ${store.targetAudience}
Strengths: ${store.strengths}
Services: ${store.services}
Achievements: ${store.achievements}

Winning prompts (ID | display_rate% | text):
${promptList}

${rawResponsesSummary ? `Sample AI responses (for misinformation analysis):
${rawResponsesSummary}` : ''}

${scrapedContent ? `=== Competitor & Cited Site Intelligence ===
${scrapedContent}
Referenced URLs: ${allCitedUrls.join(', ')}
===` : ''}

Additionally, you have access to raw AI responses for each prompt. Analyze them for:
1. Factual errors or outdated information about this industry/company
2. Missing information that should be addressed
3. Competitor-biased responses where this company should appear
If you find misinformation opportunities, add 1-2 "misinformation_correction" type articles.

Design 6-8 content pieces total. Mix these types:
- owned_media_article (broad GEO coverage, info-dense)
- case_study (specific outcomes, numbers)
- press_release (newsworthy, widely cited as "latest news")
- column (expert opinion, niche authority)
- misinformation_correction (correct false/outdated info → become the authoritative source)

For each piece, decide:
1. Is it MULTI-prompt coverage (one article covers many prompts via shared requirements)?
2. Or SINGLE-prompt focus (one article goes deep on a high-impact single prompt)?
Use MULTI for prompts with overlapping requirements. Use SINGLE for high-rate prompts that need depth.

For keyRequirements: incorporate insights from the competitor/cited site analysis above when available.
For referencedSites: list the specific URLs from the cited site analysis that informed this content piece (empty array if none).

Return this JSON array (no other text):
[
  {
    "id": "c1",
    "type": "owned_media_article",
    "typeLabel": "オウンドメディア記事",
    "title": "具体的な記事タイトル（日本語）",
    "angle": "記事の切り口や独自アングル（1〜2文）",
    "coverageType": "multi",
    "coveredPromptIds": ["id1", "id2"],
    "coveredPromptTexts": ["プロンプト1テキスト", "プロンプト2テキスト"],
    "whyNow": "なぜ今この記事を作るべきか（1文）",
    "estimatedImpact": "high",
    "keyRequirements": ["必ず含める内容1", "必ず含める内容2", "必ず含める内容3"],
    "referencedSites": ["https://example.com/page"]
  }
]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `Claude APIエラー: ${err}` }, { status: response.status })
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''

    let suggestions: ContentSuggestion[]
    try {
      suggestions = JSON.parse(text)
    } catch {
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      try {
        suggestions = JSON.parse(stripped)
      } catch {
        const match = stripped.match(/\[[\s\S]*\]/)
        suggestions = match ? JSON.parse(match[0]) : []
      }
    }

    // Enrich typeLabel and ensure referencedSites exists
    suggestions = suggestions.map((s) => ({
      ...s,
      typeLabel: TYPE_LABELS[s.type] ?? s.typeLabel,
      referencedSites: s.referencedSites || [],
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('suggest-contents error:', error)
    return NextResponse.json(
      { error: 'コンテンツ提案に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
