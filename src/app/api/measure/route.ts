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
  apiKey: string
): Promise<{
  sentiment: Sentiment
  positiveElements: string
  negativeElements: string
  mentionPosition: number | null
  citedUrls: string[]
}> {
  const lowerResponse = response.toLowerCase()
  const lowerName = storeName.toLowerCase()
  const mentionIndex = lowerResponse.indexOf(lowerName)
  const mentionPosition = mentionIndex >= 0 ? mentionIndex : null

  const urlRegex = /https?:\/\/[^\s\)\"\']+/g
  const citedUrls = response.match(urlRegex) || []

  if (!apiKey) {
    return {
      sentiment: 'neutral',
      positiveElements: '',
      negativeElements: '',
      mentionPosition,
      citedUrls,
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
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `以下のAI回答を分析してください。店舗名「${storeName}」に関する記述を特定し、センチメントを判断してください。

回答:
${response.substring(0, 2000)}

以下のJSONのみを返してください：
{
  "sentiment": "positive" | "neutral" | "negative",
  "positiveElements": "ポジティブな要素の説明（ない場合は空文字）",
  "negativeElements": "ネガティブな要素の説明（ない場合は空文字）"
}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      return { sentiment: 'neutral', positiveElements: '', negativeElements: '', mentionPosition, citedUrls }
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

    return {
      sentiment: (parsed.sentiment as Sentiment) || 'neutral',
      positiveElements: parsed.positiveElements || '',
      negativeElements: parsed.negativeElements || '',
      mentionPosition,
      citedUrls,
    }
  } catch {
    return { sentiment: 'neutral', positiveElements: '', negativeElements: '', mentionPosition, citedUrls }
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

    const results: MeasurementResult[] = []
    const now = new Date().toISOString()

    for (const platform of platforms) {
      let responseData: { response: string; error?: string }

      switch (platform) {
        case 'claude':
          if (!anthropicKey) {
            results.push({ id: generateId(), promptId, platform, response: 'APIキー未設定', mentioned: false, mentionPosition: null, sentiment: 'neutral', positiveElements: '', negativeElements: '', citedUrls: [], competitorMentions: {}, measuredAt: now })
            continue
          }
          responseData = await measureWithClaude(promptText, anthropicKey)
          break
        case 'chatgpt':
          if (!openaiKey) {
            results.push({ id: generateId(), promptId, platform, response: 'APIキー未設定', mentioned: false, mentionPosition: null, sentiment: 'neutral', positiveElements: '', negativeElements: '', citedUrls: [], competitorMentions: {}, measuredAt: now })
            continue
          }
          responseData = await measureWithOpenAI(promptText, openaiKey)
          break
        case 'gemini':
          if (!geminiKey) {
            results.push({ id: generateId(), promptId, platform, response: 'APIキー未設定', mentioned: false, mentionPosition: null, sentiment: 'neutral', positiveElements: '', negativeElements: '', citedUrls: [], competitorMentions: {}, measuredAt: now })
            continue
          }
          responseData = await measureWithGemini(promptText, geminiKey)
          break
        case 'perplexity':
          if (!perplexityKey) {
            results.push({ id: generateId(), promptId, platform, response: 'APIキー未設定', mentioned: false, mentionPosition: null, sentiment: 'neutral', positiveElements: '', negativeElements: '', citedUrls: [], competitorMentions: {}, measuredAt: now })
            continue
          }
          responseData = await measureWithPerplexity(promptText, perplexityKey)
          break
        default:
          continue
      }

      if (responseData.error || !responseData.response) {
        results.push({
          id: generateId(),
          promptId,
          platform,
          response: responseData.error || '',
          mentioned: false,
          mentionPosition: null,
          sentiment: 'neutral',
          positiveElements: '',
          negativeElements: '',
          citedUrls: [],
          competitorMentions: {},
          measuredAt: now,
        })
        continue
      }

      const analysis = await analyzeSentiment(responseData.response, storeName, anthropicKey)

      const lowerResponse = responseData.response.toLowerCase()
      const lowerName = storeName.toLowerCase()
      const mentioned = lowerResponse.includes(lowerName)

      const competitorMentions: Record<string, boolean> = {}
      for (const competitor of competitors) {
        competitorMentions[competitor] = lowerResponse.includes(competitor.toLowerCase())
      }

      results.push({
        id: generateId(),
        promptId,
        platform,
        response: responseData.response,
        mentioned,
        mentionPosition: analysis.mentionPosition,
        sentiment: analysis.sentiment,
        positiveElements: analysis.positiveElements,
        negativeElements: analysis.negativeElements,
        citedUrls: analysis.citedUrls,
        competitorMentions,
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
