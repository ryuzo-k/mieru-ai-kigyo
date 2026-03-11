import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo } from '@/types'

export interface ProposalSlide {
  slideNumber: number
  title: string
  content: string
  talkingPoints: string[]
  speakerNotes: string
}

export async function POST(request: NextRequest) {
  try {
    const {
      targetCompanyUrl,
      targetCompanyName,
      ourCompanyInfo,
      meetingNotes,
      clientApiKey,
    }: {
      targetCompanyUrl: string
      targetCompanyName: string
      ourCompanyInfo: StoreInfo
      meetingNotes?: string
      clientApiKey?: string
    } = await request.json()

    if (!targetCompanyName || !ourCompanyInfo) {
      return NextResponse.json({ error: '企業名と自社情報が必要です' }, { status: 400 })
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが必要です（設定画面から入力してください）' },
        { status: 400 }
      )
    }

    // Step 1: Scrape target company website via Jina.ai
    let scrapedContent = ''
    if (targetCompanyUrl) {
      try {
        const res = await fetch(`https://r.jina.ai/${targetCompanyUrl}`, {
          headers: { Accept: 'text/markdown' },
          signal: AbortSignal.timeout(15000),
        })
        if (res.ok) {
          const text = await res.text()
          scrapedContent = text.substring(0, 4000)
        }
      } catch {
        // スクレイピング失敗は無視して続行
      }
    }

    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の営業提案書エキスパートです。
新規クライアントへの提案資料を作成してください。

提案書は10スライド構成で、各スライドを以下のJSON形式で返してください：
[
  {
    "slideNumber": 1,
    "title": "スライドタイトル",
    "content": "スライド本文（マークダウン形式）",
    "talkingPoints": ["トークポイント1", "トークポイント2", "トークポイント3"],
    "speakerNotes": "詳細な話し方・セリフ例"
  },
  ...
]

JSONのみを返してください。コードブロックなし。

スライド構成（固定）：
1. タイトル（会社名・日付・提案テーマ）
2. 現状のAI検索環境（生成AIがどう変わっているか）
3. {ターゲット企業名}のAI検索現状（スクレイピング結果から推定）
4. 課題の特定（表示されていないプロンプト・機会損失）
5. GEO対策の具体的アプローチ
6. 提供サービス詳細（Pack A/B/C）
7. 想定スケジュール
8. 期待される成果・KPI
9. 投資対効果（ROI）
10. 次のステップ・契約内容`

    const userPrompt = `以下の情報をもとに提案書を作成してください。

【提案先企業】
企業名: ${targetCompanyName}
URL: ${targetCompanyUrl || '未入力'}
${scrapedContent ? `\nウェブサイト情報:\n${scrapedContent}` : ''}
${meetingNotes ? `\nミーティングメモ・ヒアリング内容:\n${meetingNotes}` : ''}

【提案元企業（自社）情報】
企業名: ${ourCompanyInfo.name}
サービス: ${ourCompanyInfo.services}
強み: ${ourCompanyInfo.strengths}
実績: ${ourCompanyInfo.achievements}
説明: ${ourCompanyInfo.description}

【日付】${today}

上記情報をもとに10スライドの提案書を作成してください。
スライド6（提供サービス詳細）では以下のパック構成を参考にしてください：
- Pack A（スタータープラン）: 月次計測・現状分析・改善レポート
- Pack B（スタンダードプラン）: Pack A + コンテンツ制作月2本 + プロンプト最適化
- Pack C（プレミアムプラン）: Pack B + ウェブサイト改善 + 競合分析 + 専任担当者

各スライドのcontentはマークダウン形式で、箇条書き・太字・表などを使って視覚的にわかりやすく。
talkingPointsは3〜5個の短い箇条書き。
speakerNotesは実際にミーティングで話すセリフ例（200〜400文字）。`

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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Claude APIエラー: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.content[0]?.text || ''

    let slides: ProposalSlide[]
    try {
      slides = JSON.parse(content)
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        slides = JSON.parse(match[0])
      } else {
        return NextResponse.json({ error: '提案書のパースに失敗しました' }, { status: 500 })
      }
    }

    return NextResponse.json({ proposal: slides })
  } catch (error) {
    console.error('Generate proposal error:', error)
    return NextResponse.json(
      { error: '提案書生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
