import { NextRequest, NextResponse } from 'next/server'
import {
  saveMeasurementScheduleToDB,
  getMeasurementScheduleFromDB,
  saveApiKeysToDB,
  getApiKeysFromDB,
  saveStoreToDB,
  getStoreFromDB,
  savePromptsToDB,
  getPromptsFromDB,
} from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'getSchedule') {
    const schedule = await getMeasurementScheduleFromDB()
    return NextResponse.json(schedule)
  }
  if (action === 'getApiKeys') {
    const keys = await getApiKeysFromDB()
    return NextResponse.json(keys)
  }
  if (action === 'getStore') {
    const store = await getStoreFromDB()
    return NextResponse.json(store)
  }
  if (action === 'getPrompts') {
    const prompts = await getPromptsFromDB()
    return NextResponse.json(prompts)
  }

  return NextResponse.json({ message: 'ok' })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'saveSchedule') {
      await saveMeasurementScheduleToDB({ enabled: body.enabled, times: body.times || ['09:00', '13:00', '18:00'] })
      return NextResponse.json({ success: true })
    }

    if (action === 'saveApiKeys') {
      await saveApiKeysToDB(body.keys)
      return NextResponse.json({ success: true })
    }

    if (action === 'saveStore') {
      await saveStoreToDB(body.store)
      return NextResponse.json({ success: true })
    }

    if (action === 'savePrompts') {
      await savePromptsToDB(body.prompts)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
