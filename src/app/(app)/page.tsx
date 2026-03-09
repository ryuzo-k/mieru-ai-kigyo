'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  MessageSquare,
  AlertTriangle,
  Globe,
  ArrowRight,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  getStoreInfo,
  getPrompts,
  getMeasurementSessions,
} from '@/lib/storage'
import { StoreInfo, Prompt, MeasurementSession } from '@/types'


export default function DashboardPage() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [sessions, setSessions] = useState<MeasurementSession[]>([])

  useEffect(() => {
    setStore(getStoreInfo())
    setPrompts(getPrompts())
    setSessions(getMeasurementSessions())
  }, [])

  // Compute stats
  const winningPrompts = prompts.filter((p) => p.isWinning)
  const allResults = sessions.flatMap((s) => s.results)
  const mentionedResults = allResults.filter((r) => r.mentioned)
  const averageMentionRate =
    allResults.length > 0 ? mentionedResults.length / allResults.length : 0
  const negativeAlerts = allResults.filter(
    (r) => r.sentiment === 'negative'
  ).length
  const citedUrlsSet = new Set(allResults.flatMap((r) => r.citedUrls))
  const citedUrlCount = citedUrlsSet.size

  // Chart data - last 7 measurements grouped by date
  const chartData = buildChartData(sessions, prompts.slice(0, 3))

  const summaryCards = [
    {
      title: '平均表示率',
      value: `${Math.round(averageMentionRate * 100)}%`,
      description: '全プロンプト・全プラットフォーム平均',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '勝ち筋プロンプト数',
      value: winningPrompts.length.toString(),
      description: `全${prompts.length}件中`,
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'ネガティブアラート',
      value: negativeAlerts.toString(),
      description: '要注意の回答数',
      icon: AlertTriangle,
      color: negativeAlerts > 0 ? 'text-red-600' : 'text-slate-400',
      bgColor: negativeAlerts > 0 ? 'bg-red-50' : 'bg-slate-50',
    },
    {
      title: '被引用サイト数',
      value: citedUrlCount.toString(),
      description: 'AIが参照したURL総数',
      icon: Globe,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
  ]

  const quickAccessItems = [
    {
      title: 'プロンプト管理',
      description: 'プロンプトの追加・編集・削除',
      href: '/prompts',
      icon: MessageSquare,
    },
    {
      title: '計測・分析',
      description: 'AIプラットフォームでの表示率を計測',
      href: '/analytics',
      icon: BarChart3,
    },
    {
      title: 'コンテンツ制作',
      description: 'GEO最適化コンテンツを自動生成',
      href: '/content',
      icon: Zap,
    },
    {
      title: 'ウェブサイト改善',
      description: 'サイトのGEO問題を診断・修正',
      href: '/website',
      icon: Globe,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {store ? `${store.name}` : 'ダッシュボード'}
        </h1>
        <p className="text-muted-foreground">
          {store ? 'GEO対策の現状を確認できます' : '店舗のGEO状況'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {card.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {card.description}
                  </p>
                </div>
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>プロンプト別表示率の推移</CardTitle>
          <CardDescription>直近の計測結果（勝ち筋プロンプト上位3件）</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
              計測データがありません。「計測・分析」から計測を開始してください。
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => `${Math.round((value as number) * 100)}%`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="prompt1"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                  name={prompts[0]?.text?.substring(0, 20) || 'プロンプト1'}
                />
                <Line
                  type="monotone"
                  dataKey="prompt2"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name={prompts[1]?.text?.substring(0, 20) || 'プロンプト2'}
                />
                <Line
                  type="monotone"
                  dataKey="prompt3"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name={prompts[2]?.text?.substring(0, 20) || 'プロンプト3'}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick Access */}
      <div>
        <h2 className="text-lg font-semibold mb-3">各機能へのクイックアクセス</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickAccessItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent prompts */}
      {prompts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>勝ち筋プロンプト</CardTitle>
              <CardDescription>★マークのプロンプト一覧</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/prompts">
                すべて見る
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {winningPrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                プロンプト管理で★を付けると勝ち筋プロンプトとして表示されます
              </p>
            ) : (
              <div className="space-y-2">
                {winningPrompts.slice(0, 5).map((prompt) => (
                  <div
                    key={prompt.id}
                    className="flex items-center gap-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2"
                  >
                    <span className="text-yellow-500 text-sm">★</span>
                    <p className="text-sm flex-1">{prompt.text}</p>
                    <Badge
                      variant="secondary"
                      className="text-xs shrink-0"
                    >
                      {prompt.category === 'sales'
                        ? '売上'
                        : prompt.category === 'awareness'
                        ? '認知'
                        : '毀損防止'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function buildChartData(
  sessions: MeasurementSession[],
  topPrompts: Prompt[]
): { date: string; prompt1: number; prompt2: number; prompt3: number }[] {
  if (sessions.length === 0 || topPrompts.length === 0) return []

  const grouped: Record<string, MeasurementSession[]> = {}
  sessions.forEach((session) => {
    const date = new Date(session.startedAt).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(session)
  })

  return Object.entries(grouped)
    .slice(-7)
    .map(([date, daySessions]) => {
      const allResults = daySessions.flatMap((s) => s.results)

      const getMentionRate = (promptId: string) => {
        const promptResults = allResults.filter((r) => r.promptId === promptId)
        if (promptResults.length === 0) return 0
        return promptResults.filter((r) => r.mentioned).length / promptResults.length
      }

      return {
        date,
        prompt1: getMentionRate(topPrompts[0]?.id || ''),
        prompt2: getMentionRate(topPrompts[1]?.id || ''),
        prompt3: getMentionRate(topPrompts[2]?.id || ''),
      }
    })
}
