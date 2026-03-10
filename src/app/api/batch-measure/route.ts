import { NextRequest, NextResponse } from 'next/server'

async function measureOnce(
  promptText: string,
  apiKey: string
): Promise<string> {
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
        messages: [{ role: 'user', content: promptText }],
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.content?.[0]?.text || ''
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      prompts,
      entityName,
      times = 3,
      apiKey: clientApiKey,
    }: {
      prompts: { id: string; text: string }[]
      entityName: string
      times?: number
      apiKey?: string
    } = await request.json()

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが必要です' },
        { status: 400 }
      )
    }

    const lowerName = entityName.toLowerCase()
    const results: { id: string; mentionCount: number; displayRate: number }[] = []

    for (const prompt of prompts) {
      let mentionCount = 0
      for (let i = 0; i < times; i++) {
        const response = await measureOnce(prompt.text, apiKey)
        if (typeof response === 'string' && response.toLowerCase().includes(lowerName)) {
          mentionCount++
        }
        // API rate limit対策: 連続呼び出しに少し間隔を入れる
        if (i < times - 1) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }
      const displayRate = Math.round((mentionCount / times) * 100)
      results.push({ id: prompt.id, mentionCount, displayRate })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Batch measure error:', error)
    return NextResponse.json(
      { error: 'バッチ計測に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
