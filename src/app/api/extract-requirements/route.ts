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
        system: `You are a GEO (Generative Engine Optimization) expert. Extract the key requirements that AI chatbots need when answering each prompt about the given company.

IMPORTANT: Return ONLY raw JSON. No markdown, no code blocks, no explanation text. The response must be parseable by JSON.parse() directly.

JSON format:
{"requirements":[{"promptId":"id","requirements":["req1","req2","req3"]}],"sharedRequirements":["shared req that covers multiple prompts"]}

Rules:
- requirements: max 3 per prompt, short strings only, no quotes or special chars inside strings
- sharedRequirements: max 5, focus on what covers the most prompts
- All strings must be valid JSON strings (escape special chars if needed)`,
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
      // Try direct parse first
      parsed = JSON.parse(content)
    } catch {
      // Strip markdown code blocks if present
      const stripped = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()
      try {
        parsed = JSON.parse(stripped)
      } catch {
        // Extract first {...} block
        const match = stripped.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            parsed = JSON.parse(match[0])
          } catch {
            parsed = { requirements: [], sharedRequirements: [] }
          }
        } else {
          parsed = { requirements: [], sharedRequirements: [] }
        }
      }
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
