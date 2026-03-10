import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, PromptCategory } from '@/types'

const industryTypeLabel: Record<string, string> = {
  food: '小売・EC',
  beauty: 'コンサルティング・専門サービス',
  medical: '医療・ヘルスケア',
  retail: '製造・メーカー',
  other: 'IT・SaaS',
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const { store, apiKey: clientApiKey }: { store: StoreInfo; apiKey?: string } = await request.json()

    if (!store) {
      return NextResponse.json(
        { error: '企業情報が必要です' },
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

    const industryLabel = industryTypeLabel[store.businessType] || store.businessType
    const brandName = store.brandName || store.name

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）の専門家です。
企業情報をもとに、AIチャットボット（Claude・ChatGPT・Gemini・Perplexity等）で当該企業が推薦・言及されるための「GEO計測用プロンプト」を生成します。

## 生成方針

### ① 売上直結プロンプト（awareness カテゴリ）
ユーザーが購買・発注・問い合わせを検討しているときに入力するプロンプト。
このプロンプトで自社が推薦・言及されれば直接商談につながる。

ユーザーの購買フローを想定してプロンプトを設計すること：
- 「◯◯するにはどうすればいい？」→ 解決策・方法の調査
- 「◯◯でおすすめのサービス・会社は？」→ 比較・選定
- 「◯◯の費用・料金はいくら？」→ 予算感の確認
- 「◯◯のメリット・デメリットは？」→ 深掘り比較
- 「◯◯で実績のある会社を教えて」→ 信頼性の確認

### ② ブランド毀損モニタリング（reputation カテゴリ）
すでにブランド名を知っているユーザーが検索するプロンプト。
ネガティブな回答が出ていないか監視するために使う。

- 「${brandName}の評判・口コミは？」
- 「${brandName}は信頼できる？」
- 「${brandName}のデメリット・問題点は？」
- 「${brandName}は怪しい？やばい？」

## 品質基準
- 実際のユーザーが入力しそうな自然な日本語で書くこと
- 抽象的すぎず、具体的すぎない（検索意図が明確なもの）
- awareness: 15〜20個、reputation: 5〜8個、合計20〜25個

## 出力形式（JSONのみ・マークダウン不要）
{
  "prompts": [
    {
      "text": "プロンプトテキスト（自然な日本語）",
      "category": "awareness" | "reputation",
      "pseudoMemory": "このプロンプトを入力するユーザーの状況・購買フェーズ・意図の説明（1〜2文）"
    }
  ]
}`

    const userPrompt = `以下の企業のGEO計測用プロンプトを生成してください。

企業名: ${store.name}${brandName !== store.name ? `\nブランド名: ${brandName}` : ''}
業種・カテゴリ: ${industryLabel}
事業概要: ${store.description}
ターゲット顧客: ${store.targetAudience}
強み・差別化ポイント: ${store.strengths}
提供サービス・プロダクト: ${store.services}
実績・数字: ${store.achievements}
市場ポジショニング: ${store.positioning}
競合企業: ${store.competitors.map((c) => c.name).join('、') || '不明'}
${store.websiteUrl ? `公式サイト: ${store.websiteUrl}` : ''}

【重要】
- awareness カテゴリは「${store.targetAudience}」が課題解決・サービス選定する際に実際に入力する質問を想定すること
- ${brandName}が推薦・言及されるポテンシャルがある質問を選ぶこと
- 企業名を直接含むプロンプトは reputation カテゴリのみにすること（awareness は企業名なしの一般質問）`

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

    let parsed: { prompts: { text: string; category: string; pseudoMemory: string }[] }
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
      category: (p.category as PromptCategory) || 'awareness',
      difficulty: 'med',  // 廃止予定、デフォルト値のみ
      priority: 'medium', // 廃止予定、デフォルト値のみ
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
