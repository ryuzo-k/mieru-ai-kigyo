import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, PromptCategory } from '@/types'

const industryTypeLabel: Record<string, string> = {
  food: '小売・EC',
  beauty: 'コンサルティング・専門サービス',
  medical: '医療・ヘルスケア',
  retail: '製造・メーカー',
  other: 'IT・SaaS',
}

interface UploadedFile {
  name: string
  type: 'pdf' | 'text'
  base64?: string
  text?: string
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

const MEASURE_TIMES = 3
const BATCH_SIZE = 5
const TIMEOUT_MS = 10000

async function measureOpenAIOnce(promptText: string, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        max_tokens: 8000,
        web_search_options: {},
        messages: [
          {
            role: 'system',
            content:
              '必ず日本語で回答してください。質問でおすすめの会社・サービスを聞かれている場合は、具体的な会社名・サービス名を必ず複数列挙してください。抽象的な説明だけで終わらないこと。',
          },
          { role: 'user', content: promptText },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      // Fallback to gpt-4o-mini without search
      const res2 = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 8000,
          messages: [{ role: 'user', content: promptText }],
        }),
      })
      if (!res2.ok) return ''
      const d2 = await res2.json()
      return d2.choices[0]?.message?.content || ''
    }
    const data = await res.json()
    return data.choices[0]?.message?.content || ''
  } catch {
    clearTimeout(timer)
    return ''
  }
}

async function analyzeSentiment(
  response: string,
  storeName: string,
  apiKey: string
): Promise<'positive' | 'neutral' | 'negative' | undefined> {
  try {
    const sentimentPrompt = `以下のAI回答を分析してください。
対象企業: "${storeName}"

AI回答:
${response}

以下のJSONのみで返してください：
{
  "sentiment": "positive" | "neutral" | "negative",
  "reason": "判定理由を1文で"
}`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [{ role: 'user', content: sentimentPrompt }],
      }),
    })
    if (!res.ok) return undefined
    const data = await res.json()
    const text: string = data.choices[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return undefined
    const parsed = JSON.parse(match[0]) as { sentiment?: string }
    const s = parsed.sentiment
    if (s === 'positive' || s === 'neutral' || s === 'negative') return s
    return undefined
  } catch {
    return undefined
  }
}

async function measurePromptWithOpenAI(
  prompt: Prompt,
  storeName: string,
  brandName: string,
  apiKey: string
): Promise<{ displayRate: number; isWinning: boolean; sentiment?: 'positive' | 'neutral' | 'negative' }> {
  let mentionCount = 0
  let bestResponse: string | undefined
  for (let i = 0; i < MEASURE_TIMES; i++) {
    try {
      const response = await measureOpenAIOnce(prompt.text, apiKey)
      if (response) {
        const lowerResponse = response.toLowerCase()
        const mentioned =
          lowerResponse.includes(storeName.toLowerCase()) ||
          (brandName !== storeName && lowerResponse.includes(brandName.toLowerCase()))
        if (mentioned) {
          mentionCount++
          if (!bestResponse) bestResponse = response
        }
      }
    } catch {
      // continue on error
    }
  }
  const displayRate = Math.round((mentionCount / MEASURE_TIMES) * 100)

  let sentiment: 'positive' | 'neutral' | 'negative' | undefined
  if (bestResponse) {
    sentiment = await analyzeSentiment(bestResponse, storeName, apiKey)
  }

  const isWinning = displayRate >= 33 && (sentiment === 'positive' || sentiment === 'neutral')
  return { displayRate, isWinning, sentiment }
}

export async function POST(request: NextRequest) {
  try {
    const {
      store,
      apiKey: clientApiKey,
      openaiApiKey: clientOpenaiKey,
      files,
    }: { store: StoreInfo; apiKey?: string; openaiApiKey?: string; files?: UploadedFile[] } =
      await request.json()

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
ユーザーが課題を抱えてAI検索をするとき、最終的に「どこの会社がいいか」を知りたい。
そのため、**1つのプロンプトで「課題解決の質問 ＋ おすすめ会社の推薦を要求」を組み合わせる**こと。

形式のルール：
- 前半：ユーザーが実際に抱える課題・やりたいこと・知りたいことを質問する
- 後半：「また、おすすめの会社・サービスも教えてください」「具体的な会社名も教えてください」などの推薦要求を必ず付ける
- 企業名・ブランド名は含めない（一般質問として）

例：
- 「AIに自社を認識・掲載してもらうにはどうすればいいですか？おすすめのサービスや会社も教えてください。」
- 「GEO対策を始めたいのですが、何から手をつければいいでしょうか？また、支援してくれる会社も紹介してください。」
- 「AIチャットボットで自社ブランドの認知を上げる方法を教えてください。実績のある会社も教えてください。」
- 「競合他社がAI検索で上位に出てきます。対策方法と、対策を依頼できる会社を教えてください。」

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

    // テキストファイルの内容を userPrompt に結合
    const textFileContents = (files || [])
      .filter((f) => f.type === 'text' && f.text)
      .map((f) => `【参考資料: ${f.name}】\n${f.text}`)
      .join('\n\n')

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
${(store as unknown as Record<string, unknown>).targetPersona ? `ターゲットペルソナ: ${(store as unknown as Record<string, unknown>).targetPersona}` : ''}
${(store as unknown as Record<string, unknown>).userJourneyStages ? `ユーザージャーニー: ${(store as unknown as Record<string, unknown>).userJourneyStages}` : ''}
${(store as unknown as Record<string, unknown>).brandDocuments ? `ブランド資料・追加情報:
${String((store as unknown as Record<string, unknown>).brandDocuments).substring(0, 2000)}` : ''}
${textFileContents ? `\n追加参考資料:\n${textFileContents.substring(0, 3000)}` : ''}

【重要】
- awareness カテゴリは上記のユーザージャーニー・ターゲットペルソナをベースに、実際に入力される質問を想定すること
- ユーザージャーニーの各ステージ（課題認識・手法理解・サービス比較・コスト検討・事例確認など）から均等にプロンプトを生成すること
- **awareness の各プロンプトは必ず「課題質問 ＋ おすすめ会社の推薦要求」を1文にまとめること**（例：「〜する方法を教えてください。また、おすすめの会社も教えてください。」）
- ${brandName}が推薦・言及されるポテンシャルがある質問を選ぶこと
- 企業名を直接含むプロンプトは reputation カテゴリのみにすること（awareness は企業名なしの一般質問）`

    // PDFファイルをClaude documentコンテンツブロックに変換
    const pdfFiles = (files || []).filter((f) => f.type === 'pdf' && f.base64)
    const messageContent: unknown[] = [
      ...pdfFiles.map((f) => ({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: f.base64,
        },
        title: f.name,
      })),
      { type: 'text', text: userPrompt },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }],
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

    // ── Auto-measure with OpenAI ──────────────────────────────────────────
    const openaiApiKey = clientOpenaiKey || process.env.OPENAI_API_KEY
    let autoMeasured = false

    if (openaiApiKey) {
      try {
        autoMeasured = true
        const storeName = store.name
        const brand = store.brandName || store.name

        for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
          const batch = prompts.slice(i, i + BATCH_SIZE)
          const results = await Promise.all(
            batch.map((p) => measurePromptWithOpenAI(p, storeName, brand, openaiApiKey))
          )
          results.forEach((result, j) => {
            prompts[i + j].displayRate = result.displayRate
            prompts[i + j].isWinning = result.isWinning
            prompts[i + j].sentiment = result.sentiment
          })
        }
      } catch {
        // 計測失敗してもプロンプト生成結果は返す
        autoMeasured = false
      }
    }

    const stats = {
      total: prompts.length,
      measured: prompts.filter((p) => p.displayRate !== undefined).length,
      winning: prompts.filter((p) => p.isWinning).length,
      positiveCount: prompts.filter((p) => p.sentiment === 'positive').length,
      neutralCount: prompts.filter((p) => p.sentiment === 'neutral').length,
      negativeCount: prompts.filter((p) => p.sentiment === 'negative').length,
    }

    return NextResponse.json({ prompts, autoMeasured, stats })
  } catch (error) {
    console.error('Generate prompts error:', error)
    return NextResponse.json(
      { error: 'プロンプト生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
