import { NextRequest, NextResponse } from 'next/server'
import { Platform, MeasurementResult, Sentiment } from '@/types'
import { saveMeasurementResultToDB } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

function generateId(): string {
  return crypto.randomUUID()
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Claude (with web search tool) ─────────────────────────────────────────

async function measureWithClaude(
  prompt: string,
  apiKey: string
): Promise<{ response: string; citations?: string[]; error?: string }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        system: '必ず日本語で回答してください。質問でおすすめの会社・サービスを聞かれている場合は、具体的な会社名・サービス名を必ず複数列挙してください。抽象的な説明だけで終わらないこと。',
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      // Fallback: retry without web search
      const res2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res2.ok) return { response: '', error: `Claude APIエラー: ${res2.status}` }
      const d2 = await res2.json()
      return { response: d2.content?.find((c: { type: string }) => c.type === 'text')?.text || '' }
    }
    const data = await res.json()
    // Extract text blocks
    const text = (data.content as { type: string; text?: string; content?: {type:string;url?:string}[] }[])
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n') || ''
    // Extract URLs from web_search tool results
    const citations: string[] = []
    for (const block of (data.content || [])) {
      if (block.type === 'tool_result') {
        for (const inner of (block.content || [])) {
          if (inner.url) citations.push(inner.url)
        }
      }
    }
    return { response: text, citations }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── ChatGPT (search preview model) ────────────────────────────────────────

async function measureWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<{ response: string; citations?: string[]; error?: string }> {
  try {
    // Try search-enabled model first
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        max_tokens: 8000,
        web_search_options: {},
        messages: [{ role: 'system', content: '必ず日本語で回答してください。質問でおすすめの会社・サービスを聞かれている場合は、具体的な会社名・サービス名を必ず複数列挙してください。抽象的な説明だけで終わらないこと。' }, { role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      // Fallback to gpt-4o-mini without search
      const res2 = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res2.ok) return { response: '', error: `OpenAI APIエラー: ${res2.status}` }
      const d2 = await res2.json()
      return { response: d2.choices[0]?.message?.content || '' }
    }
    const data = await res.json()
    return { response: data.choices[0]?.message?.content || '' }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── Gemini (with google search grounding) ─────────────────────────────────

async function measureWithGemini(
  prompt: string,
  apiKey: string
): Promise<{ response: string; citations?: string[]; error?: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt + '\n\n必ず日本語で回答してください。質問でおすすめの会社・サービスを聞かれている場合は、具体的な会社名・サービス名を必ず複数列挙してください。抽象的な説明だけで終わらないこと。' }] }],
          tools: [{ google_search: {} }],
        }),
      }
    )
    if (!res.ok) {
      // Fallback without grounding
      const res2 = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      )
      if (!res2.ok) return { response: '', error: `Gemini APIエラー: ${res2.status}` }
      const d2 = await res2.json()
      return { response: d2.candidates?.[0]?.content?.parts?.[0]?.text || '' }
    }
    const data = await res.json()
    const response = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    // Extract grounding URLs from Gemini search grounding metadata
    const chunks: {web?: {uri?: string}}[] =
      data.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    const citations: string[] = chunks
      .map((c) => c.web?.uri || '')
      .filter(Boolean)
    return { response, citations }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── Perplexity (online model — already has web search) ────────────────────

async function measureWithPerplexity(
  prompt: string,
  apiKey: string
): Promise<{ response: string; citations?: string[]; error?: string }> {
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { response: '', error: `Perplexity APIエラー: ${res.status}` }
    const data = await res.json()
    const response = data.choices[0]?.message?.content || ''
    // Perplexity returns citations separately
    const citations: string[] = data.citations || []
    return { response, citations }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── Google AI Overviews (via SerpApi) ─────────────────────────────────────

async function measureWithGoogleAIOverviews(
  prompt: string,
  serpApiKey: string
): Promise<{ response: string; citations?: string[]; triggered: boolean; error?: string }> {
  if (!serpApiKey) return { response: '', triggered: false, error: 'SerpApi APIキー未設定' }
  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google&q=${encodedPrompt}&api_key=${serpApiKey}&hl=ja&gl=jp`,
      { method: 'GET' }
    )
    if (!res.ok) return { response: '', triggered: false, error: `SerpApi エラー: ${res.status}` }
    const data = await res.json()

    const aiOverview = data.ai_overview
    if (!aiOverview) return { response: '', triggered: false }

    let textBlocks: { type: string; snippet?: string; list?: { title?: string; snippet?: string }[] }[] = []
    let refsRaw: { title?: string; link?: string; source?: string; snippet?: string }[] = []

    if (aiOverview.text_blocks) {
      textBlocks = aiOverview.text_blocks
      refsRaw = aiOverview.references || []
    } else if (aiOverview.page_token) {
      const res2 = await fetch(
        `https://serpapi.com/search.json?engine=google_ai_overview&page_token=${encodeURIComponent(aiOverview.page_token)}&api_key=${serpApiKey}`,
        { method: 'GET' }
      )
      if (res2.ok) {
        const data2 = await res2.json()
        textBlocks = data2.ai_overview?.text_blocks || []
        refsRaw = data2.ai_overview?.references || []
      }
    }

    const parts: string[] = []
    for (const block of textBlocks) {
      if (block.type === 'paragraph' && block.snippet) {
        parts.push(block.snippet)
      } else if (block.type === 'list' && block.list) {
        for (const item of block.list) {
          const line = [item.title, item.snippet].filter(Boolean).join(': ')
          if (line) parts.push(`• ${line}`)
        }
      }
    }
    const response = parts.join('\n\n')
    const citations = refsRaw.map((r) => r.link || r.source || '').filter(Boolean)

    return { response, citations, triggered: true }
  } catch {
    return { response: '', triggered: false, error: 'APIリクエストに失敗しました' }
  }
}

// ── Google AI Mode (via SerpApi) ──────────────────────────────────────────

async function measureWithGoogleAIMode(
  prompt: string,
  serpApiKey: string
): Promise<{ response: string; citations?: string[]; triggered: boolean; error?: string }> {
  if (!serpApiKey) return { response: '', triggered: false, error: 'SerpApi APIキー未設定' }
  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google_ai_mode&q=${encodedPrompt}&api_key=${serpApiKey}&hl=ja&gl=jp`,
      { method: 'GET' }
    )
    if (!res.ok) return { response: '', triggered: false, error: `SerpApi エラー: ${res.status}` }
    const data = await res.json()

    const aiModeResults: { response_text?: string; sources?: { title?: string; url?: string }[] }[] =
      data.ai_mode_results || []

    if (aiModeResults.length === 0) return { response: '', triggered: false }

    const parts = aiModeResults.map((r) => r.response_text || '').filter(Boolean)
    const response = parts.join('\n\n')
    const citations = aiModeResults
      .flatMap((r) => r.sources || [])
      .map((s) => s.url || '')
      .filter(Boolean)

    return { response, citations, triggered: true }
  } catch {
    return { response: '', triggered: false, error: 'APIリクエストに失敗しました' }
  }
}

// ── AI-powered direct competitor filtering ────────────────────────────────

async function filterDirectCompetitors(
  companies: string[],
  storeName: string,
  businessType: string,
  services: string,
  apiKey: string
): Promise<string[]> {
  if (companies.length === 0 || !apiKey) return companies
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `以下の企業リストの中から、「${storeName}（業界: ${businessType}、サービス: ${services}）」の直接競合企業のみを選んでください。
知名度が高いだけで業態が違う企業（例: 大手総合コンサル vs 専門SaaS企業）は除外してください。
直接競合の定義: 同じ業界で、同じターゲット顧客に、同じ課題解決を提供している企業。

企業リスト: ${companies.join(', ')}

JSON配列のみで返してください（説明不要）: ["企業A", "企業B"]`,
          },
        ],
      }),
    })
    if (!res.ok) return companies
    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    // Parse JSON array
    let parsed: string[] = []
    try {
      parsed = JSON.parse(text)
    } catch {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch { /* ignore */ }
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return companies
    return parsed.filter((c) => typeof c === 'string')
  } catch {
    return companies
  }
}

// ── Sentiment + competitive analysis ──────────────────────────────────────

async function analyzeSentiment(
  response: string,
  storeName: string,
  competitors: string[],
  apiKey: string,
  apiCitations: string[] = [],
  businessType: string = '',
  services: string = ''
): Promise<{
  sentiment: Sentiment
  positiveElements: string
  negativeElements: string
  mentionPosition: number | null
  citedUrls: string[]
  citedContext: string
  citedCompetitors: string[]
  competitorRankings?: { name: string; rank: number; snippet: string }[]
  mentionRank?: number | null
  fanoutQueries?: string[]
}> {
  const lowerResponse = response.toLowerCase()
  const lowerName = storeName.toLowerCase()
  const mentionIndex = lowerResponse.indexOf(lowerName)
  const mentionPosition = mentionIndex >= 0 ? mentionIndex : null

  const urlRegex = /https?:\/\/[^\s\)\"\'>\]]+/g
  const citedUrls = response.match(urlRegex) || []

  // Initial regex-based competitor detection
  const rawCitedCompetitors = competitors.filter((c) =>
    lowerResponse.includes(c.toLowerCase())
  )

  if (!apiKey) {
    return {
      sentiment: 'neutral',
      positiveElements: '',
      negativeElements: '',
      mentionPosition,
      citedUrls,
      citedContext: '',
      citedCompetitors: rawCitedCompetitors,
      mentionRank: null,
      fanoutQueries: [],
    }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: `Analyze this AI response for GEO (Generative Engine Optimization) insights.
Target company: "${storeName}"
Competitors to track: ${competitors.length > 0 ? competitors.join(', ') : 'none'}

AI response:
${response.substring(0, 3000)}

Return ONLY raw JSON (no markdown, no code blocks):
{
  "sentiment": "positive" or "neutral" or "negative",
  "positiveElements": "positive things said about target company (empty if none)",
  "negativeElements": "negative things said about target company (empty if none)",
  "citedContext": "context in which target company was mentioned (empty if not mentioned)",
  "mentionRank": null or integer (1-based position in a recommendation list like ①②③ or 1.2.3. or bullet points; null if not in a list or not mentioned),
  "fanoutQueries": ["follow-up query 1", "follow-up query 2"] (extract related/follow-up questions generated at the end of the response; empty array if none),
  "competitorRankings": [{"name": "CompanyName", "rank": 1, "snippet": "exact quote showing the mention"}],
  "citedSources": ["domain1.com", "domain2.com"]
}
Notes:
- mentionRank: if the target company appears in a numbered/bulleted recommendation list (①②③, 1. 2. 3., ・etc.), return its 1-based position. Return null if mentioned outside a list or not mentioned at all.
- fanoutQueries: look for sections like "関連する質問", "他にも聞けること", "詳しく調べる", "関連質問" at the end of the response and extract those queries as an array.
- competitorRankings: rank by order of appearance in the response (1=first). Only include competitors that appear in the response.
- citedSources: list domains/URLs that the AI response references or cites.`,
          },
        ],
      }),
    })

    if (!res.ok) {
      return {
        sentiment: 'neutral',
        positiveElements: '',
        negativeElements: '',
        mentionPosition,
        citedUrls,
        citedContext: '',
        citedCompetitors: rawCitedCompetitors,
        mentionRank: null,
        fanoutQueries: [],
      }
    }

    const data = await res.json()
    const rawText = data.content[0]?.text || '{}'

    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      try {
        parsed = JSON.parse(stripped)
      } catch {
        const match = stripped.match(/\{[\s\S]*\}/)
        if (match) {
          try { parsed = JSON.parse(match[0]) } catch { /* ignore */ }
        }
      }
    }

    const aiSources: string[] = ((parsed.citedSources as string[]) || []).filter(
      (s) => typeof s === 'string'
    )
    const mergedUrls = Array.from(new Set([...citedUrls, ...aiSources, ...apiCitations]))

    const competitorRankings: { name: string; rank: number; snippet: string }[] =
      ((parsed.competitorRankings as { name: string; rank: number; snippet: string }[]) || [])
        .filter((c) => c && typeof c.name === 'string')

    // Add competitors found by regex but missed by AI
    const rankedNames = new Set(competitorRankings.map((c) => c.name.toLowerCase()))
    competitors.forEach((c) => {
      if (lowerResponse.includes(c.toLowerCase()) && !rankedNames.has(c.toLowerCase())) {
        competitorRankings.push({ name: c, rank: 99, snippet: '' })
      }
    })

    // AI-filter to only direct competitors
    const allMentionedCompetitors = competitorRankings.map((c) => c.name)
    const directCompetitors = await filterDirectCompetitors(
      allMentionedCompetitors,
      storeName,
      businessType,
      services,
      apiKey
    )
    const directSet = new Set(directCompetitors.map((c) => c.toLowerCase()))
    const filteredRankings = competitorRankings.filter((c) =>
      directSet.has(c.name.toLowerCase())
    )

    const mentionRank = parsed.mentionRank !== undefined
      ? (typeof parsed.mentionRank === 'number' ? parsed.mentionRank : null)
      : null
    const fanoutQueries: string[] = Array.isArray(parsed.fanoutQueries)
      ? (parsed.fanoutQueries as unknown[]).filter((q): q is string => typeof q === 'string')
      : []

    return {
      sentiment: ((parsed.sentiment as Sentiment) || 'neutral'),
      positiveElements: (parsed.positiveElements as string) || '',
      negativeElements: (parsed.negativeElements as string) || '',
      mentionPosition,
      citedUrls: mergedUrls,
      citedContext: (parsed.citedContext as string) || '',
      citedCompetitors: filteredRankings.map((c) => c.name),
      competitorRankings: filteredRankings,
      mentionRank,
      fanoutQueries,
    }
  } catch {
    return {
      sentiment: 'neutral',
      positiveElements: '',
      negativeElements: '',
      mentionPosition,
      citedUrls,
      citedContext: '',
      citedCompetitors: rawCitedCompetitors,
      mentionRank: null,
      fanoutQueries: [],
    }
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const {
      promptId,
      promptText,
      storeName,
      brandName,
      competitors,
      platforms,
      apiKeys: clientApiKeys,
      companyId,
    }: {
      promptId: string
      promptText: string
      storeName: string
      brandName?: string
      competitors: string[]
      platforms: Platform[]
      apiKeys?: Record<string, string>
      companyId?: string
    } = await request.json()

    const anthropicKey = clientApiKeys?.claude || process.env.ANTHROPIC_API_KEY || ''
    const openaiKey = clientApiKeys?.chatgpt || process.env.OPENAI_API_KEY || ''
    const geminiKey = clientApiKeys?.gemini || process.env.GOOGLE_GEMINI_API_KEY || ''
    const perplexityKey = clientApiKeys?.perplexity || process.env.PERPLEXITY_API_KEY || ''
    const serpApiKey = clientApiKeys?.serpapi || process.env.SERPAPI_API_KEY || ''

    // Fetch store info for AI competitor filtering
    let businessType = ''
    let services = ''
    if (companyId && anthropicKey) {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase
          .from('store_info')
          .select('business_type, services')
          .eq('id', companyId)
          .single()
        if (data) {
          businessType = data.business_type || ''
          services = data.services || ''
        }
      } catch { /* ignore */ }
    }

    const MEASURE_TIMES = 3
    const results: MeasurementResult[] = []
    const now = new Date().toISOString()

    for (const platform of platforms) {
      const platformKey =
        platform === 'claude'
          ? anthropicKey
          : platform === 'chatgpt'
          ? openaiKey
          : platform === 'gemini'
          ? geminiKey
          : platform === 'perplexity'
          ? perplexityKey
          : platform === 'google_ai_overviews' || platform === 'google_ai_mode'
          ? serpApiKey
          : ''

      if (!platformKey && platform !== 'google_ai_overviews' && platform !== 'google_ai_mode') {
        results.push({
          id: generateId(),
          promptId,
          platform,
          response: 'APIキー未設定',
          mentioned: false,
          mentionPosition: null,
          sentiment: 'neutral',
          positiveElements: '',
          negativeElements: '',
          citedUrls: [],
          citedContext: '',
          citedCompetitors: [],
          competitorMentions: {},
          rawResponses: [],
          displayRate: 0,
          measuredAt: now,
        })
        continue
      }

      // Google AI系は1回のみ計測
      if (platform === 'google_ai_overviews' || platform === 'google_ai_mode') {
        const googleData = platform === 'google_ai_overviews'
          ? await measureWithGoogleAIOverviews(promptText, serpApiKey)
          : await measureWithGoogleAIMode(promptText, serpApiKey)

        if (!googleData.triggered) {
          results.push({
            id: generateId(),
            promptId,
            platform,
            response: googleData.error || '',
            mentioned: false,
            mentionPosition: null,
            sentiment: 'neutral',
            positiveElements: '',
            negativeElements: '',
            citedUrls: [],
            citedContext: '',
            citedCompetitors: [],
            competitorMentions: {},
            rawResponses: [],
            displayRate: 0,
            triggered: false,
            measuredAt: now,
          })
          continue
        }

        const mentionBrand = (brandName || '').toLowerCase()
        const mentioned =
          googleData.response.toLowerCase().includes(storeName.toLowerCase()) ||
          (!!mentionBrand && googleData.response.toLowerCase().includes(mentionBrand))

        const analysis = await analyzeSentiment(
          googleData.response, storeName, competitors, anthropicKey, googleData.citations || [], businessType, services
        )
        const competitorMentions: Record<string, boolean> = {}
        for (const competitor of competitors) {
          competitorMentions[competitor] = googleData.response.toLowerCase().includes(competitor.toLowerCase())
        }
        const citedSourcesWithFavicons = analysis.citedUrls.map(url => {
          try {
            const domain = new URL(url).hostname
            return { url, domain, title: undefined }
          } catch {
            return { url, domain: url, title: undefined }
          }
        })

        results.push({
          id: generateId(),
          promptId,
          platform,
          response: googleData.response,
          mentioned,
          mentionPosition: analysis.mentionPosition,
          sentiment: analysis.sentiment,
          positiveElements: analysis.positiveElements,
          negativeElements: analysis.negativeElements,
          citedUrls: analysis.citedUrls,
          citedContext: analysis.citedContext,
          citedCompetitors: analysis.citedCompetitors,
          competitorMentions,
          competitorRankings: analysis.competitorRankings,
          rawResponses: [googleData.response],
          displayRate: mentioned ? 100 : 0,
          mentionRank: analysis.mentionRank,
          fanoutQueries: analysis.fanoutQueries,
          citedSourcesWithFavicons,
          triggered: true,
          measuredAt: now,
        })
        continue
      }

      // 3回計測
      const rawResponses: string[] = []
      const apiCitations: string[] = []  // API-provided citation URLs
      let mentionCount = 0

      for (let trial = 0; trial < MEASURE_TIMES; trial++) {
        if (trial > 0) await new Promise((r) => setTimeout(r, 300))

        let responseData: { response: string; citations?: string[]; error?: string }
        switch (platform) {
          case 'claude':
            responseData = await measureWithClaude(promptText, anthropicKey)
            break
          case 'chatgpt':
            responseData = await measureWithOpenAI(promptText, openaiKey)
            break
          case 'gemini':
            responseData = await measureWithGemini(promptText, geminiKey)
            break
          case 'perplexity':
            responseData = await measureWithPerplexity(promptText, perplexityKey)
            break
          default:
            continue
        }

        if (!responseData.error && responseData.response) {
          rawResponses.push(responseData.response)
          // Collect API-provided citations
          for (const url of (responseData.citations || [])) {
            if (!apiCitations.includes(url)) apiCitations.push(url)
          }
          const mentionBrand = (brandName || '').toLowerCase()
          const mentionHit = responseData.response.toLowerCase().includes(storeName.toLowerCase()) || (mentionBrand && responseData.response.toLowerCase().includes(mentionBrand))
          if (mentionHit) {
            mentionCount++
          }
        }
      }

      if (rawResponses.length === 0) {
        results.push({
          id: generateId(),
          promptId,
          platform,
          response: '',
          mentioned: false,
          mentionPosition: null,
          sentiment: 'neutral',
          positiveElements: '',
          negativeElements: '',
          citedUrls: [],
          citedContext: '',
          citedCompetitors: [],
          competitorMentions: {},
          rawResponses: [],
          displayRate: 0,
          measuredAt: now,
        })
        continue
      }

      // Use the response with mention (or last) for detailed analysis
      const bestResponse =
        rawResponses.find((r) => r.toLowerCase().includes(storeName.toLowerCase())) ||
        rawResponses[rawResponses.length - 1]

      const displayRate = Math.round((mentionCount / rawResponses.length) * 100)
      // All platforms use Claude for unified analysis
      const analysis = await analyzeSentiment(
        bestResponse, storeName, competitors, anthropicKey, apiCitations, businessType, services
      )

      const competitorMentions: Record<string, boolean> = {}
      for (const competitor of competitors) {
        competitorMentions[competitor] = bestResponse
          .toLowerCase()
          .includes(competitor.toLowerCase())
      }

      const citedSourcesWithFavicons = analysis.citedUrls.map(url => {
        try {
          const domain = new URL(url).hostname
          return { url, domain, title: undefined }
        } catch {
          return { url, domain: url, title: undefined }
        }
      })

      results.push({
        id: generateId(),
        promptId,
        platform,
        response: bestResponse,
        mentioned: mentionCount > 0,
        mentionPosition: analysis.mentionPosition,
        sentiment: analysis.sentiment,
        positiveElements: analysis.positiveElements,
        negativeElements: analysis.negativeElements,
        citedUrls: analysis.citedUrls,
        citedContext: analysis.citedContext,
        citedCompetitors: analysis.citedCompetitors,
        competitorMentions,
        competitorRankings: analysis.competitorRankings,
        rawResponses,
        displayRate,
        mentionRank: analysis.mentionRank,
        fanoutQueries: analysis.fanoutQueries,
        citedSourcesWithFavicons,
        triggered: true,
        measuredAt: now,
      })
    }

    for (const result of results) {
      await saveMeasurementResultToDB(result, companyId || 'company_default').catch(() => {})
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Measure error:', error)
    return NextResponse.json(
      { error: '計測に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
