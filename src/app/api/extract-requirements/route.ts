import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { store, prompts }: { store: StoreInfo; prompts: Prompt[] } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが設定されていません（環境変数 ANTHROPIC_API_KEY）' },
        { status: 500 }
      )
    }

    const winningPrompts = prompts.filter((p) => p.isWinning)
    const targetPrompts = winningPrompts.length > 0 ? winningPrompts : prompts.slice(0, 10)

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
        system: `あなたはGEO（Generative Engine Optimization）対策の専門家です。
プロンプトと企業情報をもとに、AIチャットボットがこれらのプロンプトで回答する際の重要な要件を抽出してください。

以下のJSONで返してください：
{
  "requirements": [
    {
      "promptId": "プロンプトID",
      "requirements": ["要件1", "要件2", "要件3"]
    }
  ],
  "sharedRequirements": ["複数のプロンプトで共通する重要要件"]
}
JSONのみを返してください。`,
        messages: [
          {
            role: 'user',
            content: `企業情報：
企業名: ${store.name}
業態: ${store.businessType}
説明: ${store.description}
強み: ${store.strengths}

対象プロンプト：
${targetPrompts.map((p) => `ID: ${p.id}\nテキスト: ${p.text}\nカテゴリ: ${p.category}`).join('\n\n')}

各プロンプトに対してAIが回答する際に重要な要件を抽出してください。`,
          },
        ],
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

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { requirements: [], sharedRequirements: [] }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Extract requirements error:', error)
    return NextResponse.json(
      { error: '要件抽出に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
