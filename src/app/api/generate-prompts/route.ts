import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, PromptCategory, PromptDifficulty, PromptPriority } from '@/types'

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

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の専門家です。
企業が提供する情報をもとに、AIチャットボット（Claude、ChatGPT、Gemini等）での検索・回答で当該企業が上位表示・推薦されるための「勝ち筋プロンプト」を網羅的に生成してください。

以下のカテゴリで合計15〜20個のプロンプトを生成してください：

**売上に関するプロンプト（商談・問い合わせ・選定）**
- 推薦・比較系（例：「${industryLabel}業界のGEO対策でおすすめのサービスは？」）
- 課題解決系（例：「AIに自社を認識してもらうにはどうすればいい？」）
- 競合比較系（例：「GEO対策ツールを比較したい」）

**ブランド認知に関するプロンプト**
- 直接検索系（例：「${store.name}ってどんな会社？」）
- カテゴリ探索系（例：「${industryLabel}のGEO対策会社を探している」）
- 採用・信頼系（例：「${store.name}の評判は？」）

**ブランド毀損モニタリング用プロンプト**
- ネガティブ意図系（例：「${store.name} 悪評・問題」）
- リスク検索系（例：「${store.name} やばい・怪しい」）

各プロンプトについて以下の情報をJSONで返してください：
{
  "prompts": [
    {
      "text": "プロンプトテキスト",
      "category": "sales" | "awareness" | "reputation",
      "difficulty": "low" | "med" | "high",
      "priority": "high" | "medium" | "low",
      "pseudoMemory": "このプロンプトを入力するユーザーの状況・背景・意図の説明（BtoBの意思決定者・担当者目線で）"
    }
  ]
}

difficulty（難易度）の基準：
- low: 競合が少ない、特定性が高いプロンプト
- med: 中程度の競合、最適化が必要
- high: 競合が多い、汎用的なプロンプト

priority（優先度）の基準：
- high: 商談・問い合わせ直結、今すぐ取り組むべき
- medium: ブランド認知向上に重要だが緊急ではない
- low: 長期的なブランド毀損防止・モニタリング

JSONのみを返してください。マークダウンのコードブロックは不要です。`

    const userPrompt = `以下の企業情報をもとにGEO対策用プロンプトを生成してください：

企業名: ${store.name}
業種: ${industryLabel}
事業概要: ${store.description}
ターゲット顧客: ${store.targetAudience}
強み・差別化: ${store.strengths}
提供サービス・プロダクト: ${store.services}
実績・数字: ${store.achievements}
市場ポジショニング: ${store.positioning}
競合企業: ${store.competitors.map((c) => c.name).join('、')}
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
