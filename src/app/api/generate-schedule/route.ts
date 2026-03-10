import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ContentSuggestion } from '@/app/api/suggest-contents/route'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface ContentScheduleItem {
  id: string
  companyId: string
  scheduledDate: string
  suggestionId: string | null
  generatedContentId: string | null
  publishTime: string
  status: 'scheduled' | 'published' | 'cancelled'
  suggestionTitle: string
  suggestionType: string
  coveredPromptTexts: string[]
  createdAt: string
}

// Recommended publish times (rotate through these)
const PUBLISH_TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']

export async function POST(request: NextRequest) {
  try {
    const {
      companyId,
      contentSuggestions,
      startDate,
    }: {
      companyId: string
      contentSuggestions: ContentSuggestion[]
      startDate: string
    } = await request.json()

    if (!companyId || !contentSuggestions || contentSuggestions.length === 0) {
      return NextResponse.json(
        { error: 'companyId と contentSuggestions が必要です' },
        { status: 400 }
      )
    }

    const supabase = getClient()

    // Parse startDate and build schedule (1 item per day)
    const start = new Date(startDate || new Date().toISOString())
    const scheduleItems: ContentScheduleItem[] = contentSuggestions.map((suggestion, index) => {
      const scheduledDate = new Date(start)
      scheduledDate.setDate(start.getDate() + index)
      const publishTime = PUBLISH_TIMES[index % PUBLISH_TIMES.length]

      return {
        id: crypto.randomUUID(),
        companyId,
        scheduledDate: scheduledDate.toISOString().split('T')[0],
        suggestionId: suggestion.id,
        generatedContentId: null,
        publishTime,
        status: 'scheduled',
        suggestionTitle: suggestion.title,
        suggestionType: suggestion.type,
        coveredPromptTexts: suggestion.coveredPromptTexts,
        createdAt: new Date().toISOString(),
      }
    })

    // Save to Supabase
    const rows = scheduleItems.map((item) => ({
      id: item.id,
      company_id: item.companyId,
      scheduled_date: item.scheduledDate,
      suggestion_id: item.suggestionId,
      generated_content_id: item.generatedContentId,
      publish_time: item.publishTime,
      status: item.status,
      suggestion_title: item.suggestionTitle,
      suggestion_type: item.suggestionType,
      covered_prompt_texts: item.coveredPromptTexts,
    }))

    const { error } = await supabase.from('content_schedule').upsert(rows)
    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json(
        { error: 'スケジュールの保存に失敗しました: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ schedule: scheduleItems })
  } catch (error) {
    console.error('Generate schedule error:', error)
    return NextResponse.json(
      { error: 'スケジュール生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId が必要です' }, { status: 400 })
    }

    const supabase = getClient()
    const { data, error } = await supabase
      .from('content_schedule')
      .select('*')
      .eq('company_id', companyId)
      .order('scheduled_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const schedule: ContentScheduleItem[] = (data || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      scheduledDate: row.scheduled_date,
      suggestionId: row.suggestion_id,
      generatedContentId: row.generated_content_id,
      publishTime: row.publish_time,
      status: row.status,
      suggestionTitle: row.suggestion_title,
      suggestionType: row.suggestion_type,
      coveredPromptTexts: row.covered_prompt_texts || [],
      createdAt: row.created_at,
    }))

    return NextResponse.json({ schedule })
  } catch (error) {
    return NextResponse.json(
      { error: 'スケジュールの取得に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
