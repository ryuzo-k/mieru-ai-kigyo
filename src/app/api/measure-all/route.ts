import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mieru-ai-kigyo.vercel.app'

// POST: 計測ジョブを開始
export async function POST(req: NextRequest) {
  try {
    const {
      companyId,
      promptIds,
      platforms,
      storeName,
      brandName,
      competitors,
      apiKeys,
    }: {
      companyId: string
      promptIds: string[]
      platforms: string[]
      storeName: string
      brandName?: string
      competitors: string[]
      apiKeys?: Record<string, string>
    } = await req.json()

    const supabase = getClient()
    const jobId = generateId()

    // プロンプト情報を取得
    const { data: promptsData } = await supabase
      .from('prompts')
      .select('id, text')
      .in('id', promptIds)

    const totalOps = (promptsData?.length || 0)

    // ジョブ作成
    await supabase.from('measurement_jobs').insert({
      id: jobId,
      company_id: companyId,
      status: 'running',
      total_prompts: totalOps,
      completed_prompts: 0,
      current_prompt_text: '',
    })

    // バックグラウンドで非同期処理
    Promise.resolve().then(async () => {
      let completed = 0
      for (const prompt of promptsData || []) {
        try {
          await supabase.from('measurement_jobs').update({
            current_prompt_text: prompt.text.substring(0, 100),
          }).eq('id', jobId)

          await fetch(`${SITE_URL}/api/measure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              promptId: prompt.id,
              promptText: prompt.text,
              storeName,
              brandName: brandName || '',
              companyId,
              competitors,
              platforms,
              apiKeys: apiKeys || {},
            }),
          })

          completed++
          await supabase.from('measurement_jobs').update({
            completed_prompts: completed,
          }).eq('id', jobId)
        } catch (e) {
          console.error('measure-all error for prompt:', prompt.id, e)
        }
      }

      await supabase.from('measurement_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_prompt_text: '',
      }).eq('id', jobId)
    })

    return NextResponse.json({ jobId, total: totalOps })
  } catch (e) {
    console.error('measure-all POST error:', e)
    return NextResponse.json({ error: 'ジョブの作成に失敗しました' }, { status: 500 })
  }
}

// GET: 進捗を取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'jobIdが必要です' }, { status: 400 })
    }

    const supabase = getClient()
    const { data, error } = await supabase
      .from('measurement_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !data) {
      return NextResponse.json({ status: 'not_found' })
    }

    return NextResponse.json({
      jobId: data.id,
      status: data.status,
      completedPrompts: data.completed_prompts,
      totalPrompts: data.total_prompts,
      currentPromptText: data.current_prompt_text,
      startedAt: data.started_at,
      completedAt: data.completed_at,
    })
  } catch (e) {
    console.error('measure-all GET error:', e)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
