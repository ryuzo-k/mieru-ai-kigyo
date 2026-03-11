import { NextRequest, NextResponse } from 'next/server'
import { getApiKeysFromDB } from '@/lib/db'

export interface ProjectTask {
  id: string
  title: string
  description: string
  taskType: 'milestone' | 'meeting' | 'deliverable' | 'measurement' | 'content' | 'report'
  scheduledDate: string // YYYY-MM-DD
  scheduledTime?: string // HH:MM
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  assignee: 'us' | 'client' | 'both'
  notes?: string
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    const {
      companyId,
      startDate,
      contractDurationMonths,
      servicePackage,
      clientName,
    }: {
      companyId: string
      startDate: string
      contractDurationMonths: number
      servicePackage: 'A' | 'B' | 'C' | 'full'
      clientName: string
    } = await request.json()

    if (!companyId || !startDate || !clientName) {
      return NextResponse.json(
        { error: 'companyId, startDate, clientName が必要です' },
        { status: 400 }
      )
    }

    const apiKeys = await getApiKeysFromDB(companyId)
    const apiKey = apiKeys.anthropic || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが必要です（設定画面から入力してください）' },
        { status: 400 }
      )
    }

    const duration = contractDurationMonths || 6
    const pkg = servicePackage || 'full'

    const systemPrompt = `あなたはデジタルマーケティング支援会社のプロジェクトマネージャーです。
クライアントとの契約開始日から、GEO対策・コンテンツマーケティング支援プロジェクトの標準スケジュールをJSON形式で生成します。

## 標準スケジュールの構成

### Week 1（Day 1〜7）
- ヒアリング・情報収集MTG（meeting, both, 契約開始日）
- ツール設定・環境構築（milestone, us, Day 2-3）
- 初期調査・競合分析（deliverable, us, Day 5-7）

### Week 1-2（Day 7〜14）
- プロンプト設計・AIキーワード戦略策定（deliverable, us, Day 10）
- 初回計測実施（measurement, us, Day 12-14）

### Week 2（Day 14〜21）
- 計測結果共有MTG（meeting, both, Day 14-16）
- コンテンツ方針・編集カレンダー決定（milestone, both, Day 16-18）

### Month 1（Day 21〜30）
- コンテンツ制作開始（content, us, Day 21）
- 第1弾コンテンツ公開（deliverable, us, Day 28-30）

### Month 1以降（月次）
- 月次計測実施（measurement, us, 毎月初め）
- 月次レポート作成・共有（report, us, 毎月5日頃）
- 月次MTG（meeting, both, 毎月8日頃）
- コンテンツ制作・公開（content, us, 毎月中旬）
- ウェブサイト改善提案（deliverable, us, 随時）

## タスクタイプ
- milestone: プロジェクトの節目・意思決定ポイント
- meeting: ミーティング・打ち合わせ
- deliverable: 成果物の納品・共有
- measurement: 計測・データ収集
- content: コンテンツ制作・公開
- report: レポート・報告書

## アサイニー
- us: 支援会社側の作業
- client: クライアント側の作業
- both: 双方が参加・協力

## 出力形式（JSONのみ）
{
  "tasks": [
    {
      "id": "ユニークID（英数字）",
      "title": "タスクタイトル（簡潔に）",
      "description": "タスクの詳細説明（2〜3文）",
      "taskType": "milestone|meeting|deliverable|measurement|content|report",
      "scheduledDate": "YYYY-MM-DD",
      "scheduledTime": "HH:MM（任意）",
      "status": "pending",
      "assignee": "us|client|both",
      "notes": "補足メモ（任意）"
    }
  ]
}`

    const userPrompt = `以下の条件でプロジェクトスケジュールを生成してください。

クライアント名: ${clientName}
契約開始日: ${startDate}
契約期間: ${duration}ヶ月
サービスパッケージ: ${pkg}

開始日から${duration}ヶ月分のスケジュールを作成してください。
月次タスク（計測・レポート・MTG・コンテンツ）は各月繰り返してください。
日付は全て ${startDate} からの相対日数で計算した実際の YYYY-MM-DD 形式で出力してください。
タスクは日付順に並べてください。
合計20〜35個のタスクを生成してください。`

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      // Fallback to default schedule if AI fails
      console.error('Claude API error:', errText)
      const tasks = generateDefaultSchedule(startDate, duration)
      return NextResponse.json({ tasks })
    }

    const aiData = await aiResponse.json()
    const content = aiData.content[0]?.text || ''

    let parsed: { tasks: ProjectTask[] }
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        // Fallback
        const tasks = generateDefaultSchedule(startDate, duration)
        return NextResponse.json({ tasks })
      }
    }

    return NextResponse.json({ tasks: parsed.tasks })
  } catch (error) {
    console.error('Generate project schedule error:', error)
    return NextResponse.json(
      { error: 'スケジュール生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

function generateDefaultSchedule(startDate: string, durationMonths: number): ProjectTask[] {
  const tasks: ProjectTask[] = [
    {
      id: generateId(),
      title: 'キックオフミーティング',
      description: '契約開始のキックオフMTG。目標・体制・進め方を確認します。',
      taskType: 'meeting',
      scheduledDate: startDate,
      scheduledTime: '10:00',
      status: 'pending',
      assignee: 'both',
    },
    {
      id: generateId(),
      title: 'ツール設定・環境構築',
      description: 'GEO計測ツールの設定、GA4連携、必要なアカウントの準備を行います。',
      taskType: 'milestone',
      scheduledDate: addDays(startDate, 2),
      status: 'pending',
      assignee: 'us',
    },
    {
      id: generateId(),
      title: '初期調査・競合分析',
      description: '競合のAI露出状況、業界トレンドを調査し、戦略の基礎データを収集します。',
      taskType: 'deliverable',
      scheduledDate: addDays(startDate, 5),
      status: 'pending',
      assignee: 'us',
    },
    {
      id: generateId(),
      title: 'プロンプト設計・GEO戦略策定',
      description: 'GEO計測用プロンプトを設計し、AIに認知・推薦されるためのコンテンツ戦略を策定します。',
      taskType: 'deliverable',
      scheduledDate: addDays(startDate, 10),
      status: 'pending',
      assignee: 'us',
    },
    {
      id: generateId(),
      title: '初回計測実施',
      description: '設計したプロンプトを使い、各AIモデルでの露出状況を初回計測します。',
      taskType: 'measurement',
      scheduledDate: addDays(startDate, 12),
      status: 'pending',
      assignee: 'us',
    },
    {
      id: generateId(),
      title: '初回計測結果共有MTG',
      description: '初回計測の結果を共有し、現状分析と今後のコンテンツ方針を議論します。',
      taskType: 'meeting',
      scheduledDate: addDays(startDate, 14),
      scheduledTime: '10:00',
      status: 'pending',
      assignee: 'both',
    },
    {
      id: generateId(),
      title: 'コンテンツ方針・編集カレンダー決定',
      description: '計測結果をもとにコンテンツテーマ・形式・公開スケジュールを決定します。',
      taskType: 'milestone',
      scheduledDate: addDays(startDate, 17),
      status: 'pending',
      assignee: 'both',
    },
    {
      id: generateId(),
      title: 'コンテンツ制作開始',
      description: '承認された編集カレンダーに基づき、第1弾コンテンツの制作を開始します。',
      taskType: 'content',
      scheduledDate: addDays(startDate, 21),
      status: 'pending',
      assignee: 'us',
    },
    {
      id: generateId(),
      title: '第1弾コンテンツ公開',
      description: '制作したコンテンツをウェブサイト・各メディアに公開します。',
      taskType: 'deliverable',
      scheduledDate: addDays(startDate, 28),
      status: 'pending',
      assignee: 'us',
    },
  ]

  // Monthly recurring tasks
  for (let month = 1; month <= durationMonths; month++) {
    tasks.push({
      id: generateId(),
      title: `${month + 1}ヶ月目 月次計測`,
      description: '月次のGEO計測を実施し、AI露出状況の変化を数値化します。',
      taskType: 'measurement',
      scheduledDate: addMonths(startDate, month),
      status: 'pending',
      assignee: 'us',
    })
    tasks.push({
      id: generateId(),
      title: `${month + 1}ヶ月目 月次レポート`,
      description: '計測結果をまとめた月次レポートを作成・送付します。',
      taskType: 'report',
      scheduledDate: addDays(addMonths(startDate, month), 5),
      status: 'pending',
      assignee: 'us',
    })
    tasks.push({
      id: generateId(),
      title: `${month + 1}ヶ月目 月次MTG`,
      description: '月次レポートの内容を共有し、翌月の施策方針を確認します。',
      taskType: 'meeting',
      scheduledDate: addDays(addMonths(startDate, month), 8),
      scheduledTime: '10:00',
      status: 'pending',
      assignee: 'both',
    })
    tasks.push({
      id: generateId(),
      title: `${month + 1}ヶ月目 コンテンツ制作・公開`,
      description: '月次コンテンツを制作・公開し、GEO対策の継続強化を図ります。',
      taskType: 'content',
      scheduledDate: addDays(addMonths(startDate, month), 15),
      status: 'pending',
      assignee: 'us',
    })
  }

  return tasks.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
}
