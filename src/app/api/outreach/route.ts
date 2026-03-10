import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, OutreachType } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const { action, store, mediaName, mediaUrl, outreachType, targetRanking, focusPageUrl, focusPageKeyword, competitorInfo }: {
      action: 'find-media' | 'generate-email'
      store: StoreInfo
      mediaName?: string
      mediaUrl?: string
      outreachType?: OutreachType
      targetRanking?: number | null
      focusPageUrl?: string
      focusPageKeyword?: string
      competitorInfo?: string
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
          max_tokens: 8000,
          system: `あなたはGEO対策・被リンク獲得戦略の専門家です。企業の業種・エリア・競合情報をもとに、メディア掲載・相互リンク・PRなどBtoB向けアウトリーチ先を提案してください。`,
          messages: [
            {
              role: 'user',
              content: `以下の企業情報をもとに、被リンク獲得のためのアウトリーチ先を10件提案してください。

企業名: ${store.name}
業態: ${store.businessType}
競合: ${competitorNames}
強み: ${store.strengths}

outreachTypeは以下の3種別から選んでください：
- listing: 記事への掲載依頼（競合が載っているランキング記事など）
- mutual_link: 相互リンク提案（関連性の高いサイトとの相互紹介）
- pr: PRプレスリリース掲載依頼（ニュースサイト・プレスリリースメディア）

以下のJSONで返してください：
{
  "targets": [
    {
      "mediaName": "メディア名",
      "mediaUrl": "メディアのURL",
      "competitorInfo": "このメディアで言及されている競合情報や理由",
      "contactEmail": "推定連絡先（分かれば）",
      "outreachType": "listing | mutual_link | pr",
      "targetRanking": 2または3（掲載目標順位。listingの場合のみ。それ以外はnull）,
      "currentRanking": null（現在の掲載順位。不明な場合はnull）
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

      let parsed: { targets: { mediaName: string; mediaUrl: string; competitorInfo: string; contactEmail: string; outreachType: OutreachType; targetRanking: number | null; currentRanking: number | null }[] }
      try {
        parsed = JSON.parse(content)
      } catch {
        const match = content.match(/\{[\s\S]*\}/)
        parsed = match ? JSON.parse(match[0]) : { targets: [] }
      }

      const now = new Date().toISOString()
      const targets = parsed.targets.map((t) => ({
        id: generateId(),
        mediaName: t.mediaName,
        mediaUrl: t.mediaUrl,
        competitorInfo: t.competitorInfo,
        contactEmail: t.contactEmail,
        status: 'pending' as const,
        draftEmail: '',
        sentAt: null,
        confirmedAt: null,
        createdAt: now,
        outreachType: (t.outreachType as OutreachType) || 'listing',
        targetRanking: t.targetRanking ?? null,
        currentRanking: t.currentRanking ?? null,
        focusPageUrl: '',
        focusPageKeyword: '',
        negotiationNote: '',
      }))

      return NextResponse.json({ targets })
    }

    if (action === 'generate-email') {
      const type = outreachType || 'listing'
      const ranking = targetRanking ?? null
      const fpUrl = focusPageUrl || ''
      const fpKeyword = focusPageKeyword || ''

      let emailTypeInstruction = ''
      if (type === 'listing') {
        const rankingText = ranking ? `${ranking}位` : '上位'
        emailTypeInstruction = `掲載依頼メールを作成してください。
「御社の記事に当店を掲載していただけませんか。掲載いただければ弊社サイトでも御社を上位でご紹介します」という趣旨で、目標順位（${rankingText}を狙っています）を明示してください。`
      } else if (type === 'mutual_link') {
        emailTypeInstruction = `相互リンク提案メールを作成してください。
「御社サイトへのリンクを弊社サイトに掲載します。御社からも弊社へリンクをいただけますか」という相互紹介の趣旨で書いてください。`
      } else if (type === 'pr') {
        emailTypeInstruction = `PRプレスリリース掲載依頼メールを作成してください。
「新しい取り組みをプレスリリースしました。引用・掲載をご検討いただけますか」という趣旨で書いてください。`
      }

      const focusPageInstruction = fpUrl
        ? `\n特に「${fpUrl}」（${fpKeyword ? `${fpKeyword}で上位表示を狙っているページ` : '重点ページ'}）へのリンクをいただけると大変ありがたいです、という一文を本文中に含めてください。`
        : ''

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: `あなたは企業のマーケティング担当者として、被リンク獲得のためのアウトリーチメールを作成します。
丁寧で具体的なメールを作成してください。`,
          messages: [
            {
              role: 'user',
              content: `以下の情報をもとに${emailTypeInstruction}${focusPageInstruction}

【送信者情報（企業）】
企業名: ${store.name}
業態: ${store.businessType}
説明: ${store.description}
強み: ${store.strengths}

【送信先メディア】
メディア名: ${mediaName}
メディアURL: ${mediaUrl}
${competitorInfo ? `競合掲載状況: ${competitorInfo}` : ''}

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
