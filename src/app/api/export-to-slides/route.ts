import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ProposalSlide } from '../generate-proposal/route'

// Google Slides page size: 9144000 x 5143500 EMU (10in x 5.63in widescreen)
const PAGE_WIDTH = 9144000
const MARGIN = 457200 // 0.5 inch

async function refreshGoogleToken(
  refreshToken: string,
  companyId: string
): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null

  const data = await res.json()
  const newExpiry = new Date(
    Date.now() + ((data.expires_in as number) || 3600) * 1000
  ).toISOString()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await supabase.from('api_keys').upsert({
    id: companyId,
    google_access_token: data.access_token,
    google_token_expiry: newExpiry,
    updated_at: new Date().toISOString(),
  })

  return data.access_token as string
}

async function exportToGoogleSlides(
  slides: ProposalSlide[],
  title: string,
  accessToken: string
): Promise<string> {
  const authHeader = `Bearer ${accessToken}`
  const ts = Date.now()

  // 1. Create presentation
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!createRes.ok) {
    throw new Error(`プレゼン作成失敗: ${createRes.status} ${await createRes.text()}`)
  }

  const presentation = await createRes.json()
  const presentationId: string = presentation.presentationId
  const firstSlideId: string = presentation.slides[0].objectId
  const firstSlideElements: { objectId: string }[] =
    presentation.slides[0]?.pageElements || []

  // 2. Build batchUpdate requests
  const requests: object[] = []

  // Delete default elements on first slide
  for (const el of firstSlideElements) {
    requests.push({ deleteObject: { objectId: el.objectId } })
  }

  // Insert additional slides (BLANK layout)
  const slideIds = [firstSlideId, ...slides.slice(1).map((_, i) => `sl_${i + 2}_${ts}`)]
  for (let i = 1; i < slides.length; i++) {
    requests.push({
      insertSlide: {
        insertionIndex: i,
        slideId: slideIds[i],
        slideLayoutReference: { predefinedLayout: 'BLANK' },
      },
    })
  }

  // Create shapes and insert text for each slide
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const slideId = slideIds[i]
    const titleBoxId = `tb_${i}_${ts}`
    const bodyBoxId = `bb_${i}_${ts}`
    const contentWidth = PAGE_WIDTH - MARGIN * 2

    // Title text box (top area)
    requests.push({
      createShape: {
        objectId: titleBoxId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: contentWidth, unit: 'EMU' },
            height: { magnitude: 1000000, unit: 'EMU' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: MARGIN,
            translateY: 300000,
            unit: 'EMU',
          },
        },
      },
    })

    // Body text box
    requests.push({
      createShape: {
        objectId: bodyBoxId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: contentWidth, unit: 'EMU' },
            height: { magnitude: 3600000, unit: 'EMU' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: MARGIN,
            translateY: 1400000,
            unit: 'EMU',
          },
        },
      },
    })

    // Insert title text
    requests.push({
      insertText: {
        objectId: titleBoxId,
        text: `${slide.slideNumber}. ${slide.title}`,
        insertionIndex: 0,
      },
    })

    // Insert body text
    const bodyLines = [
      slide.content.substring(0, 600),
      '',
      '【トークポイント】',
      ...slide.talkingPoints.map((p) => `• ${p}`),
    ]
    requests.push({
      insertText: {
        objectId: bodyBoxId,
        text: bodyLines.join('\n'),
        insertionIndex: 0,
      },
    })

    // Style title: bold, 20pt, dark navy
    requests.push({
      updateTextStyle: {
        objectId: titleBoxId,
        textRange: { type: 'ALL' },
        style: {
          bold: true,
          fontSize: { magnitude: 20, unit: 'PT' },
          foregroundColor: {
            opaqueColor: { rgbColor: { red: 0.1, green: 0.1, blue: 0.4 } },
          },
        },
        fields: 'bold,fontSize,foregroundColor',
      },
    })

    // Style body: 11pt
    requests.push({
      updateTextStyle: {
        objectId: bodyBoxId,
        textRange: { type: 'ALL' },
        style: {
          fontSize: { magnitude: 11, unit: 'PT' },
          foregroundColor: {
            opaqueColor: { rgbColor: { red: 0.15, green: 0.15, blue: 0.15 } },
          },
        },
        fields: 'fontSize,foregroundColor',
      },
    })

    // White background for slide
    requests.push({
      updatePageProperties: {
        objectId: slideId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: { rgbColor: { red: 1, green: 1, blue: 1 } },
            },
          },
        },
        fields: 'pageBackgroundFill',
      },
    })
  }

  // 3. Execute batchUpdate
  const batchRes = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  )

  if (!batchRes.ok) {
    const errText = await batchRes.text()
    throw new Error(`スライド更新失敗: ${errText}`)
  }

  return `https://docs.google.com/presentation/d/${presentationId}/edit`
}

export async function POST(request: NextRequest) {
  try {
    const {
      slides,
      title,
      companyId = 'company_default',
    }: {
      slides: ProposalSlide[]
      title: string
      companyId?: string
    } = await request.json()

    if (!slides || slides.length === 0) {
      return NextResponse.json({ error: 'スライドデータが必要です' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data } = await supabase
      .from('api_keys')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('id', companyId)
      .single()

    if (!data?.google_access_token) {
      return NextResponse.json(
        { error: 'Google未連携です。設定画面でGoogle連携を行ってください。' },
        { status: 401 }
      )
    }

    // Refresh token if expired (with 5-minute buffer)
    let accessToken: string = data.google_access_token
    if (data.google_token_expiry) {
      const expiry = new Date(data.google_token_expiry)
      const fiveMinutesBefore = new Date(expiry.getTime() - 5 * 60 * 1000)
      if (fiveMinutesBefore <= new Date() && data.google_refresh_token) {
        const refreshed = await refreshGoogleToken(data.google_refresh_token, companyId)
        if (refreshed) accessToken = refreshed
      }
    }

    const url = await exportToGoogleSlides(slides, title, accessToken)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Export to slides error:', error)
    return NextResponse.json(
      { error: 'Googleスライドへの書き出しに失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
