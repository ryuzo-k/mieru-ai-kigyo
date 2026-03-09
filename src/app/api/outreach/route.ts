import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const { action, store, mediaName, mediaUrl }: {
      action: 'find-media' | 'generate-email'
      store: StoreInfo
      mediaName?: string
      mediaUrl?: string
    } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが設定されていません（環境変数 ANTHROPIC_API_KEY）' },
        { status: 500 }
      )
    }

    if (action === 'find-media') {
      const competitorNames = store.competitors.map((c) => c.name).join('、')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: `あなたはGEO対策の専門家です。店舗の業態・エリア・競合情報をもとに、掲載を依頼すべき第三者メディアを提案してください。`,
          messages: [
            {
              role: 'user',
              content: `以下の店舗情報をもとに、掲載依頼を行うべき第三者メディアを10件提案してください。

店舗名: ${store.name}
業態: ${store.businessType}
競合: ${competitorNames}
強み: ${store.strengths}

以下のJSONで返してください：
{
  "targets": [
    {
      "mediaName": "メディア名",
      "mediaUrl": "メディアのURL",
      "competitorInfo": "このメディアで言及されている競合情報や理由",
      "contactEmail": "推定連絡先（分かれば）"
    }
  ]
}
JSONのみを返してください。`,
            },
          ],
        }),
      })

      if (!response.ok) {
        return NextResponse.json({ error: 'メディア検索に失敗しました' }, { status: response.status })
      }

      const data = await response.json()
      const content = data.content[0]?.text || ''

      let parsed: { targets: { mediaName: string; mediaUrl: string; competitorInfo: string; contactEmail: string }[] }
      try {
        parsed = JSON.parse(content)
      } catch {
        const match = content.match(/\{[\s\S]*\}/)
        parsed = match ? JSON.parse(match[0]) : { targets: [] }
      }

      const now = new Date().toISOString()
      const targets = parsed.targets.map((t) => ({
        id: generateId(),
        ...t,
        status: 'pending' as const,
        draftEmail: '',
        sentAt: null,
        confirmedAt: null,
        createdAt: now,
      }))

      return NextResponse.json({ targets })
    }

    if (action === 'generate-email') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: `あなたは店舗のマーケティング担当者として、掲載依頼メールを作成します。
丁寧で具体的な掲載依頼メールを作成してください。`,
          messages: [
            {
              role: 'user',
              content: `以下の情報をもとに掲載依頼メールを作成してください：

【送信者情報（店舗）】
店舗名: ${store.name}
業態: ${store.businessType}
説明: ${store.description}
強み: ${store.strengths}

【送信先メディア】
メディア名: ${mediaName}
メディアURL: ${mediaUrl}

件名と本文を含む完全なメールを作成してください。フォーマット：
件名: [件名]

[本文]`,
            },
          ],
        }),
      })

      if (!response.ok) {
        return NextResponse.json({ error: 'メール生成に失敗しました' }, { status: response.status })
      }

      const data = await response.json()
      const emailContent = data.content[0]?.text || ''

      return NextResponse.json({ email: emailContent })
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 })
  } catch (error) {
    console.error('Outreach error:', error)
    return NextResponse.json(
      { error: 'アウトリーチ処理に失敗しました' },
      { status: 500 }
    )
  }
}
