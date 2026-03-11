import { NextRequest, NextResponse } from 'next/server'
import { saveContractToDB, ContractSummary } from '@/lib/db'

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const { pdfBase64, filename, companyId }: { pdfBase64: string; filename: string; companyId: string } =
      await request.json()

    if (!pdfBase64 || !filename) {
      return NextResponse.json({ error: 'PDFデータとファイル名が必要です' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが設定されていません（環境変数 ANTHROPIC_API_KEY）' },
        { status: 500 }
      )
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: `この契約書を分析して、以下のJSON形式で返してください。JSONのみを返してください：

{
  "tasks": [
    { "title": "業務タイトル", "description": "詳細説明", "deadline": "納期（あれば）" }
  ],
  "payments": [
    { "amount": "金額", "condition": "支払条件", "dueDate": "支払期限（あれば）" }
  ],
  "prohibitions": ["禁止事項1", "禁止事項2"],
  "specialNotes": ["特記事項1", "特記事項2"],
  "contractPeriod": "契約期間",
  "parties": {
    "client": "発注者・委託者名",
    "contractor": "受注者・受託者名"
  }
}

分析のポイント：
- tasks: やること・成果物・納期を詳細に抽出
- payments: 報酬額・支払い方法・支払いタイミング
- prohibitions: 競業避止・秘密保持・再委託禁止など
- specialNotes: 著作権帰属・契約解除条件・損害賠償など重要事項
- contractPeriod: 契約の開始日・終了日・更新条件
情報が見つからない場合は空配列または空文字列にしてください。`,
              },
            ],
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

    let summary: ContractSummary
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      summary = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    } catch {
      summary = {
        tasks: [],
        payments: [],
        prohibitions: [],
        specialNotes: [],
        contractPeriod: '不明',
        parties: { client: '不明', contractor: '不明' },
      }
    }

    const contract = {
      id: generateId(),
      companyId: companyId || 'company_default',
      filename,
      summary,
      createdAt: new Date().toISOString(),
    }

    await saveContractToDB(contract)

    return NextResponse.json({ summary, contractId: contract.id })
  } catch (error) {
    console.error('Analyze contract error:', error)
    return NextResponse.json(
      { error: '契約書分析に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
