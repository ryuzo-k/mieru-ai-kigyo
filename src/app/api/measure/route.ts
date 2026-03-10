import { NextRequest, NextResponse } from 'next/server'
import { Platform, MeasurementResult, Sentiment } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// ── Claude (with web search tool) ─────────────────────────────────────────

async function measureWithClaude(
  prompt: string,
  apiKey: string
): Promise<{ response: string; error?: string }> {
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
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
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
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res2.ok) return { response: '', error: `Claude APIエラー: ${res2.status}` }
      const d2 = await res2.json()
      return { response: d2.content?.find((c: { type: string }) => c.type === 'text')?.text || '' }
    }
    const data = await res.json()
    // Extract text blocks only (skip tool_use/tool_result blocks)
    const text = (data.content as { type: string; text?: string }[])
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n') || ''
    return { response: text }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── ChatGPT (search preview model) ────────────────────────────────────────

async function measureWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<{ response: string; error?: string }> {
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
        max_tokens: 1500,
        web_search_options: {},
        messages: [{ role: 'user', content: prompt }],
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
          max_tokens: 1500,
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
): Promise<{ response: string; error?: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
    return { response: data.candidates?.[0]?.content?.parts?.[0]?.text || '' }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── Perplexity (online model — already has web search) ────────────────────

async function measureWithPerplexity(
  prompt: string,
  apiKey: string
): Promise<{ response: string; error?: string }> {
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { response: '', error: `Perplexity APIエラー: ${res.status}` }
    const data = await res.json()
    return { response: data.choices[0]?.message?.content || '' }
  } catch {
    return { response: '', error: 'APIリクエストに失敗しました' }
  }
}

// ── Sentiment + competitive analysis ──────────────────────────────────────

async function analyzeSentiment(
  response: string,
  storeName: string,
  competitors: string[],
  apiKey: string
): Promise<{
  sentiment: Sentiment
  positiveElements: string
  negativeElements: string
  mentionPosition: number | null
  citedUrls: string[]
  citedContext: string
  citedCompetitors: string[]
  competitorRankings?: { name: string; rank: number; snippet: string }[]
}> {
  const lowerResponse = response.toLowerCase()
  const lowerName = storeName.toLowerCase()
  const mentionIndex = lowerResponse.indexOf(lowerName)
  const mentionPosition = mentionIndex >= 0 ? mentionIndex : null

  const urlRegex = /https?:\/\/[^\s\)\"\'>\]]+/g
  const citedUrls = response.match(urlRegex) || []

  const citedCompetitors = competitors.filter((c) =>
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
      citedCompetitors,
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
        max_tokens: 1000,
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
  "competitorRankings": [{"name": "CompanyName", "rank": 1, "snippet": "exact quote showing the mention"}],
  "citedSources": ["domain1.com", "domain2.com"]
}
Notes:
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
        citedCompetitors,
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
    const mergedUrls = Array.from(new Set([...citedUrls, ...aiSources]))

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

    return {
      sentiment: ((parsed.sentiment as Sentiment) || 'neutral'),
      positiveElements: (parsed.positiveElements as string) || '',
      negativeElements: (parsed.negativeElements as string) || '',
      mentionPosition,
      citedUrls: mergedUrls,
      citedContext: (parsed.citedContext as string) || '',
      citedCompetitors: competitorRankings.map((c) => c.name),
      competitorRankings,
    }
  } catch {
    return {
      sentiment: 'neutral',
      positiveElements: '',
      negativeElements: '',
      mentionPosition,
      citedUrls,
      citedContext: '',
      citedCompetitors,
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
      competitors,
      platforms,
      apiKeys: clientApiKeys,
    }: {
      promptId: string
      promptText: string
      storeName: string
      competitors: string[]
      platforms: Platform[]
      apiKeys?: Record<string, string>
    } = await request.json()

    const anthropicKey = clientApiKeys?.claude || process.env.ANTHROPIC_API_KEY || ''
    const openaiKey = clientApiKeys?.chatgpt || process.env.OPENAI_API_KEY || ''
    const geminiKey = clientApiKeys?.gemini || process.env.GOOGLE_GEMINI_API_KEY || ''
    const perplexityKey = clientApiKeys?.perplexity || process.env.PERPLEXITY_API_KEY || ''

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
          : ''

      if (!platformKey) {
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

      // 3回計測
      const rawResponses: string[] = []
      let mentionCount = 0

      for (let trial = 0; trial < MEASURE_TIMES; trial++) {
        if (trial > 0) await new Promise((r) => setTimeout(r, 300))

        let responseData: { response: string; error?: string }
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
          if (responseData.response.toLowerCase().includes(storeName.toLowerCase())) {
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
      const analysis = await analyzeSentiment(bestResponse, storeName, competitors, anthropicKey)

      const competitorMentions: Record<string, boolean> = {}
      for (const competitor of competitors) {
        competitorMentions[competitor] = bestResponse
          .toLowerCase()
          .includes(competitor.toLowerCase())
      }

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
        measuredAt: now,
      })
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
