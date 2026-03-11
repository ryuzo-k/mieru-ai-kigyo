import { NextRequest, NextResponse } from 'next/server'
import { WebsiteIssue } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const { url, scrapedContent, storeName }: { url: string; scrapedContent: string; storeName: string } =
      await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが設定されていません（環境変数 ANTHROPIC_API_KEY）' },
        { status: 500 }
      )
    }

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の専門家です。
ウェブサイトのコンテンツを分析し、AIチャットボット（Claude、ChatGPT、Gemini等）がより良く理解・引用できるよう改善すべき点を特定してください。

以下の5カテゴリで問題を特定し、具体的な修正コードを必ず提示してください：

1. **metadata** — title/description/OGタグのGEO観点での改善（修正後のHTMLコードを提示）
2. **structured_data** — schema.org/JSON-LDの追加・改善提案（実際に追加するコードを提示）
3. **content** — AIが引用しやすい情報密度・独自データ・FAQ・具体的数値の追加提案
4. **internal_links** — AIがサイト全体を把握しやすいナビゲーション・リンク構造の改善
5. **trust** — AboutページやAuthorページ・E-E-A-T要素・著者情報の改善提案

各問題について以下のJSON形式で返してください（JSONのみ）：
{
  "issues": [
    {
      "category": "metadata" | "structured_data" | "content" | "internal_links" | "trust",
      "priority": "critical" | "high" | "medium",
      "issue": "問題の簡潔な説明",
      "currentCode": "現在のコード（あれば、なければ省略）",
      "fixedCode": "修正後のコード（必須・実際に使えるコードを提示）",
      "explanation": "なぜこの修正がGEOに効果的か",
      "estimatedImpact": "AI引用率への期待効果（例: AI引用率+15%程度）"
    }
  ]
}
priority順（critical→high→medium）で返してください。最大10件まで。`

    const userPrompt = `以下のウェブサイトを分析してください：

URL: ${url}
企業名: ${storeName}

ウェブサイトコンテンツ（スクレイピング結果）:
${scrapedContent ? scrapedContent.substring(0, 4000) : 'コンテンツを取得できませんでした'}

GEO最適化の観点で問題点を特定し、すぐに使える修正コード付きの改善提案を提供してください。`

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

    let parsed: { issues: Omit<WebsiteIssue, 'id'>[] }
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {
          parsed = { issues: [] }
        }
      } else {
        parsed = { issues: [] }
      }
    }

    const issues: WebsiteIssue[] = (parsed.issues || []).map((issue) => ({
      id: generateId(),
      ...issue,
    }))

    return NextResponse.json({ issues })
  } catch (error) {
    console.error('Analyze website error:', error)
    return NextResponse.json(
      { error: 'ウェブサイト分析に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
