import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Firecrawl APIキーが設定されていません（環境変数 FIRECRAWL_API_KEY）' },
        { status: 500 }
      )
    }

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `スクレイピングエラー: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      content: data.data?.markdown || '',
      metadata: data.data?.metadata || {},
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { error: 'スクレイピングに失敗しました' },
      { status: 500 }
    )
  }
}
