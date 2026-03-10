import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt } from '@/types'

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
}

const TYPE_LABELS: Record<ContentSuggestion['type'], string> = {
  owned_media_article: 'オウンドメディア記事',
  press_release: 'プレスリリース',
  case_study: '事例紹介',
  column: '専門コラム',
  misinformation_correction: '誤情報訂正記事',
}

export async function POST(request: NextRequest) {
  try {
    const {
      store,
      prompts,
      rawResponsesByPrompt = {},
      clientApiKey,
    }: { store: StoreInfo; prompts: Prompt[]; rawResponsesByPrompt?: Record<string, string[]>; clientApiKey?: string } = await request.json()

    if (!store || !prompts?.length) {
      return NextResponse.json({ error: '企業情報とプロンプトが必要です' }, { status: 400 })
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic APIキーが必要です' }, { status: 400 })
    }

    const winningPrompts = prompts.filter((p) => p.isWinning)
    const targetPrompts = winningPrompts.length > 0 ? winningPrompts : prompts

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
    "keyRequirements": ["必ず含める内容1", "必ず含める内容2", "必ず含める内容3"]
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

    // Enrich typeLabel
    suggestions = suggestions.map((s) => ({
      ...s,
      typeLabel: TYPE_LABELS[s.type] ?? s.typeLabel,
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
