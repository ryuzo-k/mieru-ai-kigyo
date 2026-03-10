/**
 * /api/cron/measure
 * Vercel Cronが1日3回（09:00/13:00/18:00 JST）呼び出す
 * 全勝ち筋プロンプトをClaude APIで計測し、結果をSupabaseに保存する
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  getStoreFromDB,
  getPromptsFromDB,
  getApiKeysFromDB,
  getMeasurementScheduleFromDB,
  saveMeasurementResultToDB,
  savePromptToDB,
  updateLastRunAt,
} from '@/lib/db'
import type { MeasurementResult, Sentiment } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

async function measureWithClaude(prompt: string, apiKey: string): Promise<string> {
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
    if (!res.ok) return ''
    const data = await res.json()
    return data.content[0]?.text || ''
  } catch {
    return ''
  }
}

async function analyzeResponse(
  response: string,
  companyName: string,
  competitors: string[],
  apiKey: string
): Promise<{
  sentiment: Sentiment
  positiveElements: string
  negativeElements: string
  citedContext: string
  citedCompetitors: string[]
  citedUrls: string[]
  mentionPosition: number | null
}> {
  const lower = response.toLowerCase()
  const lowerName = companyName.toLowerCase()
  const idx = lower.indexOf(lowerName)
  const mentionPosition = idx >= 0 ? idx : null
  const urlRegex = /https?:\/\/[^\s\)\"\']+/g
  const citedUrls = response.match(urlRegex) || []
  const citedCompetitors = competitors.filter((c) => lower.includes(c.toLowerCase()))

  if (!apiKey) {
    return { sentiment: 'neutral', positiveElements: '', negativeElements: '', citedContext: '', citedCompetitors, citedUrls, mentionPosition }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `企業名「${companyName}」についてのAI回答を分析してください。\n\n回答:\n${response.substring(0, 1500)}\n\n以下のJSONのみ返してください：\n{"sentiment":"positive"|"neutral"|"negative","positiveElements":"","negativeElements":"","citedContext":"どういう文脈で言及されたか（なければ空）"}`
        }],
      }),
    })
    if (!res.ok) return { sentiment: 'neutral', positiveElements: '', negativeElements: '', citedContext: '', citedCompetitors, citedUrls, mentionPosition }
    const data = await res.json()
    const text = data.content[0]?.text || '{}'
    let parsed
    try { parsed = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} }
    return {
      sentiment: parsed.sentiment || 'neutral',
      positiveElements: parsed.positiveElements || '',
      negativeElements: parsed.negativeElements || '',
      citedContext: parsed.citedContext || '',
      citedCompetitors,
      citedUrls,
      mentionPosition,
    }
  } catch {
    return { sentiment: 'neutral', positiveElements: '', negativeElements: '', citedContext: '', citedCompetitors, citedUrls, mentionPosition }
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cronの認証チェック
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // スケジュール確認
    const schedule = await getMeasurementScheduleFromDB()
    if (!schedule.enabled) {
      return NextResponse.json({ message: 'Schedule disabled, skipping' })
    }

    // データ取得
    const store = await getStoreFromDB()
    if (!store) return NextResponse.json({ error: 'No store info' }, { status: 400 })

    const allPrompts = await getPromptsFromDB()
    const targetPrompts = allPrompts.filter((p) => p.isWinning)
    if (targetPrompts.length === 0) {
      return NextResponse.json({ message: 'No winning prompts to measure' })
    }

    const dbKeys = await getApiKeysFromDB()
    const apiKey = dbKeys.anthropic || process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) return NextResponse.json({ error: 'No Anthropic API key' }, { status: 400 })

    const competitors = store.competitors.map((c) => c.name)
    const now = new Date().toISOString()
    let measuredCount = 0

    for (const prompt of targetPrompts) {
      // 3回計測して表示率を算出
      const responses: string[] = []
      for (let i = 0; i < 3; i++) {
        const resp = await measureWithClaude(prompt.text, apiKey)
        if (resp) responses.push(resp)
        await new Promise((r) => setTimeout(r, 500))
      }

      if (responses.length === 0) continue

      // 表示率計算
      const lowerName = store.name.toLowerCase()
      const mentionCount = responses.filter((r) => r.toLowerCase().includes(lowerName)).length
      const displayRate = Math.round((mentionCount / responses.length) * 100)

      // 最後のレスポンスを詳細分析
      const lastResponse = responses[responses.length - 1]
      const analysis = await analyzeResponse(lastResponse, store.name, competitors, apiKey)

      const result: MeasurementResult & { citedContext: string; citedCompetitors: string[] } = {
        id: generateId(),
        promptId: prompt.id,
        platform: 'claude',
        response: lastResponse,
        mentioned: analysis.mentionPosition !== null,
        mentionPosition: analysis.mentionPosition,
        sentiment: analysis.sentiment,
        positiveElements: analysis.positiveElements,
        negativeElements: analysis.negativeElements,
        citedUrls: analysis.citedUrls,
        citedContext: analysis.citedContext,
        citedCompetitors: analysis.citedCompetitors,
        competitorMentions: Object.fromEntries(competitors.map((c) => [c, lastResponse.toLowerCase().includes(c.toLowerCase())])),
        measuredAt: now,
      }

      await saveMeasurementResultToDB(result)

      // プロンプトの表示率を更新
      await savePromptToDB({
        ...prompt,
        displayRate,
        citedContext: analysis.citedContext,
        citedCompetitors: analysis.citedCompetitors,
      })

      measuredCount++
    }

    await updateLastRunAt()

    return NextResponse.json({
      success: true,
      measuredCount,
      totalPrompts: targetPrompts.length,
      measuredAt: now,
    })
  } catch (error) {
    console.error('Cron measure error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
