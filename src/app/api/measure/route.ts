import { NextRequest, NextResponse } from 'next/server'
import { Platform, MeasurementResult, Sentiment } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

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
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { response: '', error: `Claude APIエラー: ${res.status}` }
    const data = await res.json()
    return { response: data.content[0]?.text || '' }
  } catch {
    return { response: "", error: "APIリクエストに失敗しました" }
  }
}

async function measureWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<{ response: string; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { response: '', error: `OpenAI APIエラー: ${res.status}` }
    const data = await res.json()
    return { response: data.choices[0]?.message?.content || '' }
  } catch {
    return { response: "", error: "APIリクエストに失敗しました" }
  }
}

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
        }),
      }
    )
    if (!res.ok) return { response: '', error: `Gemini APIエラー: ${res.status}` }
    const data = await res.json()
    return {
      response: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    }
  } catch {
    return { response: "", error: "APIリクエストに失敗しました" }
  }
}

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
        model: 'llama-3.1-sonar-small-128k-online',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { response: '', error: `Perplexity APIエラー: ${res.status}` }
    const data = await res.json()
    return { response: data.choices[0]?.message?.content || '' }
  } catch {
    return { response: "", error: "APIリクエストに失敗しました" }
  }
}

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
  competitorRankings?: {name: string; rank: number; snippet: string}[]
}> {
  const lowerResponse = response.toLowerCase()
  const lowerName = storeName.toLowerCase()
  const mentionIndex = lowerResponse.indexOf(lowerName)
  const mentionPosition = mentionIndex >= 0 ? mentionIndex : null

  const urlRegex = /https?:\/\/[^\s\)\"\']+/g
  const citedUrls = response.match(urlRegex) || []

  // 競合言及を検出
  const citedCompetitors = competitors.filter(c =>
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
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Analyze this AI response for GEO (Generative Engine Optimization) insights.
Target company: "${storeName}"
Competitors to track: ${competitors.length > 0 ? competitors.join(', ') : 'none specified'}

AI response:
${response.substring(0, 2000)}

Return ONLY this JSON (no markdown, no extra text):
{
  "sentiment": "positive" or "neutral" or "negative" (how the target company is portrayed; neutral if not mentioned),
  "positiveElements": "positive aspects mentioned about the target company (empty string if none)",
  "negativeElements": "negative aspects mentioned about the target company (empty string if none)",
  "citedContext": "in what context/category was the target company mentioned (empty string if not mentioned)",
  "competitorRankings": [{"name": "competitor name", "rank": 1, "snippet": "brief quote"}],
  "citedSources": ["domain1.com", "domain2.com"]
}
For competitorRankings: list each competitor mentioned, rank them by order of appearance (1=first mentioned). If a competitor is not mentioned, omit it.
For citedSources: extract domain names or URLs that the AI response references or cites as sources.`,
          },
        ],
      }),
    })

    if (!res.ok) {
      return { sentiment: 'neutral', positiveElements: '', negativeElements: '', mentionPosition, citedUrls, citedContext: '', citedCompetitors }
    }

    const data = await res.json()
    const content = data.content[0]?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : {}
    }

    // Merge AI-extracted sources with regex-found URLs
    const aiSources: string[] = (parsed.citedSources || []).filter((s: string) => typeof s === 'string')
    const mergedUrls = Array.from(new Set([...citedUrls, ...aiSources]))

    // Competitor rankings from AI analysis
    const competitorRankings: {name: string; rank: number; snippet: string}[] = parsed.competitorRankings || []
    // Also add any competitors mentioned that AI missed
    const rankedNames = new Set(competitorRankings.map((c: {name: string}) => c.name.toLowerCase()))
    competitors.forEach(c => {
      if (lowerResponse.includes(c.toLowerCase()) && !rankedNames.has(c.toLowerCase())) {
        competitorRankings.push({ name: c, rank: 99, snippet: '' })
      }
    })

    return {
      sentiment: (parsed.sentiment as Sentiment) || 'neutral',
      positiveElements: parsed.positiveElements || '',
      negativeElements: parsed.negativeElements || '',
      mentionPosition,
      citedUrls: mergedUrls,
      citedContext: parsed.citedContext || '',
      citedCompetitors: competitorRankings.map((c: {name: string}) => c.name),
      competitorRankings,
    }
  } catch {
    return { sentiment: 'neutral', positiveElements: '', negativeElements: '', mentionPosition, citedUrls, citedContext: '', citedCompetitors }
  }
}

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
      // Check API key availability
      const platformKey = { claude: anthropicKey, chatgpt: openaiKey, gemini: geminiKey, perplexity: perplexityKey }[platform]
      if (!platformKey) {
        results.push({ id: generateId(), promptId, platform, response: 'APIキー未設定', mentioned: false, mentionPosition: null, sentiment: 'neutral', positiveElements: '', negativeElements: '', citedUrls: [], citedContext: '', citedCompetitors: [], competitorMentions: {}, rawResponses: [], measuredAt: now })
        continue
      }

      // Call the platform MEASURE_TIMES times
      const rawResponses: string[] = []
      let mentionCount = 0

      for (let trial = 0; trial < MEASURE_TIMES; trial++) {
        if (trial > 0) await new Promise(r => setTimeout(r, 300)) // 300ms delay

        let responseData: { response: string; error?: string }
        switch (platform) {
          case 'claude': responseData = await measureWithClaude(promptText, anthropicKey); break
          case 'chatgpt': responseData = await measureWithOpenAI(promptText, openaiKey); break
          case 'gemini': responseData = await measureWithGemini(promptText, geminiKey); break
          case 'perplexity': responseData = await measureWithPerplexity(promptText, perplexityKey); break
          default: continue
        }

        if (!responseData.error && responseData.response) {
          rawResponses.push(responseData.response)
          const lowerResp = responseData.response.toLowerCase()
          if (lowerResp.includes(storeName.toLowerCase())) mentionCount++
        }
      }

      if (rawResponses.length === 0) {
        results.push({ id: generateId(), promptId, platform, response: '', mentioned: false, mentionPosition: null, sentiment: 'neutral', positiveElements: '', negativeElements: '', citedUrls: [], citedContext: '', citedCompetitors: [], competitorMentions: {}, rawResponses: [], measuredAt: now })
        continue
      }

      // Use the response with mention (or last one) for detailed analysis
      const bestResponse = rawResponses.find(r => r.toLowerCase().includes(storeName.toLowerCase())) || rawResponses[rawResponses.length - 1]
      const displayRate = Math.round((mentionCount / rawResponses.length) * 100)

      const analysis = await analyzeSentiment(bestResponse, storeName, competitors, anthropicKey)

      const lowerBest = bestResponse.toLowerCase()
      const mentioned = mentionCount > 0

      const competitorMentions: Record<string, boolean> = {}
      for (const competitor of competitors) {
        competitorMentions[competitor] = lowerBest.includes(competitor.toLowerCase())
      }

      results.push({
        id: generateId(),
        promptId,
        platform,
        response: bestResponse,
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
        rawResponses,
        measuredAt: now,
        displayRate,
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
