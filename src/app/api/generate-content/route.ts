import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, ContentMedium, GeneratedContent } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

const mediumLabels: Record<ContentMedium, string> = {
  tabelog: '食べログ',
  gurunavi: 'ぐるなび',
  retty: 'Retty',
  rakuten: '楽天',
  hotpepper: 'ホットペッパービューティー',
  google_business: 'Googleビジネスプロフィール',
  owned_media: 'オウンドメディア',
}

const mediumInstructions: Record<ContentMedium, string> = {
  tabelog: '食べログの形式に沿ったブランド基礎情報と特徴説明。雰囲気、料理の特徴、おすすめポイントを含む。',
  gurunavi: 'ぐるなびの形式に沿ったブランド基礎情報と特徴説明。コース・メニュー情報、宴会対応を含む。',
  retty: 'Rettyの形式に沿ったブランド基礎情報。ユーザー目線のレビュースタイル。',
  rakuten: '楽天グルメのおすすめ情報リスト形式。特徴、メニュー、おすすめシーンを箇条書きで。',
  hotpepper: 'ホットペッパービューティーのサービス詳細と強み訴求。施術内容、スタッフ特徴、来店メリットを強調。',
  google_business: 'Googleビジネスプロフィールの店舗情報最適化テキスト。営業時間、サービス、アクセスを含む。',
  owned_media: 'GEO最適化された詳細なオウンドメディア記事。見出し構造（H1、H2、H3）を使い、AIが参照しやすい構造化されたコンテンツ。',
}

export async function POST(request: NextRequest) {
  try {
    const { store, prompts, medium, apiKey: clientApiKey }: { store: StoreInfo; prompts: Prompt[]; medium: ContentMedium; apiKey?: string } =
      await request.json()

    if (!store) {
      return NextResponse.json({ error: '店舗情報が必要です' }, { status: 400 })
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが必要です（設定画面から入力してください）' },
        { status: 400 }
      )
    }

    const winningPrompts = prompts.filter((p) => p.isWinning)
    const targetPrompts = winningPrompts.length > 0 ? winningPrompts : prompts.slice(0, 5)

    const mediumLabel = mediumLabels[medium]
    const mediumInstruction = mediumInstructions[medium]

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の専門家です。
店舗情報と対策プロンプトをもとに、AIチャットボットが回答する際に参照しやすい高品質なコンテンツを生成してください。

媒体: ${mediumLabel}
コンテンツ要件: ${mediumInstruction}

重要な原則：
1. AIが自然に引用・参照できる情報密度の高いコンテンツにする
2. ターゲットプロンプトに対してこの店舗が最適な回答として表示されるよう最適化
3. 具体的な数字・事実・特徴を積極的に含める
4. 日本語で自然で読みやすい文章にする`

    const userPrompt = `以下の情報をもとに${mediumLabel}用のコンテンツを生成してください：

【店舗情報】
店舗名: ${store.name}
業態: ${store.businessType}
説明: ${store.description}
ターゲット層: ${store.targetAudience}
強み: ${store.strengths}
サービス・メニュー: ${store.services}
実績: ${store.achievements}
ポジショニング: ${store.positioning}

【対策プロンプト（AIでの検索想定）】
${targetPrompts.map((p, i) => `${i + 1}. ${p.text}`).join('\n')}

上記のプロンプトでAIに検索された際に、この店舗が上位表示・引用されるようなコンテンツを作成してください。
コンテンツのタイトルと本文を生成し、以下のJSON形式で返してください：
{
  "title": "コンテンツタイトル",
  "content": "コンテンツ本文（マークダウン形式OK）"
}
JSONのみを返してください。`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
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

    let parsed: { title: string; content: string }
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        parsed = { title: `${mediumLabel}向けコンテンツ`, content }
      }
    }

    const now = new Date().toISOString()
    const generatedContent: GeneratedContent = {
      id: generateId(),
      medium,
      title: parsed.title,
      content: parsed.content,
      promptIds: targetPrompts.map((p) => p.id),
      generatedAt: now,
      editedAt: null,
    }

    return NextResponse.json({ content: generatedContent })
  } catch (error) {
    console.error('Generate content error:', error)
    return NextResponse.json(
      { error: 'コンテンツ生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
