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

以下の観点で問題を特定してください：
1. 構造化データ（Schema.org）の不足・誤り
2. メタデータの問題（title、description、OGタグ）
3. HTML構造の問題（見出し階層、セマンティックHTML）
4. サイトマップ・robots.txtの設定
5. コンテンツのGEO最適化不足（情報密度、具体性、引用しやすさ）

各問題について以下のJSONで返してください：
{
  "issues": [
    {
      "type": "問題タイプ",
      "severity": "high" | "medium" | "low",
      "description": "問題の説明",
      "fixCode": "修正コードまたは修正方法（WordPress / HTML / Studio 向け）",
      "platform": "wordpress" | "html" | "studio" | "all"
    }
  ]
}
JSONのみを返してください。優先度順（high→low）で返してください。`

    const userPrompt = `以下のウェブサイトを分析してください：

URL: ${url}
企業名: ${storeName}

ウェブサイトコンテンツ（スクレイピング結果）:
${scrapedContent ? scrapedContent.substring(0, 3000) : 'コンテンツを取得できませんでした'}

GEO最適化の観点で問題点を特定し、修正提案を提供してください。`

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
        parsed = JSON.parse(match[0])
      } else {
        parsed = { issues: [] }
      }
    }

    const issues: WebsiteIssue[] = parsed.issues.map((issue) => ({
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
