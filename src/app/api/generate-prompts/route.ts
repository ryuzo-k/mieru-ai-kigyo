import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, PromptCategory, PromptDifficulty, PromptPriority } from '@/types'

const businessTypeLabel: Record<string, string> = {
  food: '飲食',
  beauty: '美容',
  medical: '医療',
  retail: '小売',
  other: 'その他',
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const { store, apiKey: clientApiKey }: { store: StoreInfo; apiKey?: string } = await request.json()

    if (!store) {
      return NextResponse.json(
        { error: '店舗情報が必要です' },
        { status: 400 }
      )
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが必要です（設定画面から入力してください）' },
        { status: 400 }
      )
    }

    const businessLabel = businessTypeLabel[store.businessType] || store.businessType

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の専門家です。
店舗オーナーが提供する情報をもとに、AIチャットボット（Claude、ChatGPT、Gemini等）での検索・回答で店舗が上位表示されるための「勝ち筋プロンプト」を網羅的に生成してください。

以下のカテゴリで合計15〜20個のプロンプトを生成してください：

**売上に関するプロンプト（来店・予約・選択）**
- おすすめ・推薦系（例：「○○エリアで${businessLabel}おすすめ」）
- 比較検討系（例：「○○の${businessLabel}でコスパがいいのは」）

**ブランド認知に関するプロンプト**
- ブランド直接検索系（例：「${store.name}ってどんなお店？」）
- カテゴリ探索系（例：「${businessLabel}を探してる」）

**ブランド毀損に関するプロンプト（ネガティブ検索のモニタリング）**
- ネガティブ意図系（例：「${store.name}の悪い口コミ」）
- リスク検索系（例：「${store.name} やばい」）

各プロンプトについて以下の情報をJSONで返してください：
{
  "prompts": [
    {
      "text": "プロンプトテキスト",
      "category": "sales" | "awareness" | "reputation",
      "difficulty": "low" | "med" | "high",
      "priority": "high" | "medium" | "low",
      "pseudoMemory": "このプロンプトを入力するユーザーの状況・背景・意図の説明"
    }
  ]
}

difficulty（難易度）の基準：
- low: 一般的な検索、競合が少ない
- med: 中程度の競合、最適化が必要
- high: 競合が多い、難しいキーワード

priority（優先度）の基準：
- high: 売上直結、今すぐ取り組むべき
- medium: 重要だが緊急ではない
- low: 長期的に対処すべき

JSONのみを返してください。マークダウンのコードブロックは不要です。`

    const userPrompt = `以下の店舗情報をもとにプロンプトを生成してください：

店舗名: ${store.name}
業態: ${businessLabel}
説明: ${store.description}
ターゲット層: ${store.targetAudience}
強み・差別化: ${store.strengths}
提供サービス・メニュー: ${store.services}
実績・数字: ${store.achievements}
ポジショニング: ${store.positioning}
競合他社: ${store.competitors.map((c) => c.name).join('、')}
${store.websiteUrl ? `公式サイト: ${store.websiteUrl}` : ''}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
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

    let parsed: { prompts: Omit<Prompt, 'id' | 'isWinning' | 'createdAt' | 'updatedAt'>[] }
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error('JSONの解析に失敗しました')
      }
    }

    const now = new Date().toISOString()
    const prompts: Prompt[] = parsed.prompts.map((p) => ({
      id: generateId(),
      text: p.text,
      category: p.category as PromptCategory,
      difficulty: p.difficulty as PromptDifficulty,
      priority: p.priority as PromptPriority,
      isWinning: false,
      pseudoMemory: p.pseudoMemory,
      createdAt: now,
      updatedAt: now,
    }))

    return NextResponse.json({ prompts })
  } catch (error) {
    console.error('Generate prompts error:', error)
    return NextResponse.json(
      { error: 'プロンプト生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
