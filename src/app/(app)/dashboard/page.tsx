'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  Zap,
  AlertTriangle,
  Globe,
  ArrowRight,
  BarChart3,
  MessageSquare,
  FileText,
  Mail,
  Star,
  Activity,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  getStoreInfo,
  getPrompts,
  getMeasurementSessions,
} from '@/lib/storage'
import { StoreInfo, Prompt, MeasurementSession, PromptCategory } from '@/types'
import { cn } from '@/lib/utils'

// ---- types ----
interface ChartPoint {
  date: string
  [key: string]: string | number
}

// ---- helpers ----
const categoryLabels: Record<PromptCategory, string> = {
  sales: '売上',
  awareness: 'ブランド認知',
  reputation: 'ブランド毀損',
}

const categoryColors: Record<PromptCategory, string> = {
  sales: 'bg-green-100 text-green-800 border-green-200',
  awareness: 'bg-blue-100 text-blue-800 border-blue-200',
  reputation: 'bg-red-100 text-red-800 border-red-200',
}

const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444']

function buildChartData(sessions: MeasurementSession[], prompts: Prompt[]): ChartPoint[] {
  if (sessions.length === 0 || prompts.length === 0) return []

  // Group sessions by date
  const grouped: Record<string, MeasurementSession[]> = {}
  sessions.forEach((session) => {
    const date = new Date(session.startedAt).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(session)
  })

  const topPrompts = prompts.slice(0, 5)

  return Object.entries(grouped)
    .slice(-10)
    .map(([date, daySessions]) => {
      const allResults = daySessions.flatMap((s) => s.results)
      const point: ChartPoint = { date }

      topPrompts.forEach((p, idx) => {
        const promptResults = allResults.filter((r) => r.promptId === p.id)
        const rate =
          promptResults.length > 0
            ? (promptResults.filter((r) => r.mentioned).length / promptResults.length) * 100
            : 0
        point[`p${idx}`] = Math.round(rate)
      })

      return point
    })
}

// ---- component ----
export default function DashboardPage() {
  const router = useRouter()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [sessions, setSessions] = useState<MeasurementSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storeInfo = getStoreInfo()
    if (!storeInfo) {
      router.replace('/setup')
      return
    }
    setStore(storeInfo)
    setPrompts(getPrompts())
    setSessions(getMeasurementSessions())
    setLoading(false)
  }, [router])

  // ---- computed stats ----
  const allResults = sessions.flatMap((s) => s.results)
  const mentionedResults = allResults.filter((r) => r.mentioned)
  const averageMentionRate =
    allResults.length > 0
      ? Math.round((mentionedResults.length / allResults.length) * 100)
      : 0
  const winningPrompts = prompts.filter((p) => p.isWinning)
  const negativeAlerts = allResults.filter((r) => r.sentiment === 'negative').length
  const citedUrls = new Set(allResults.flatMap((r) => r.citedUrls))

  const chartData = buildChartData(sessions, prompts)
  const topPrompts = prompts.slice(0, 5)

  // ---- summary cards ----
  const summaryCards = [
    {
      title: '平均表示率',
      value: `${averageMentionRate}%`,
      description: allResults.length > 0 ? `${allResults.length}件の計測結果より` : '計測データなし',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      trend:
        averageMentionRate >= 70
          ? 'good'
          : averageMentionRate >= 40
          ? 'warn'
          : 'bad',
    },
    {
      title: '勝ち筋プロンプト数',
      value: winningPrompts.length.toString(),
      description: `全${prompts.length}件中`,
      icon: Zap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      trend: 'neutral' as const,
    },
    {
      title: 'ネガティブアラート件数',
      value: negativeAlerts.toString(),
      description: negativeAlerts > 0 ? '要対応のリスクあり' : '問題なし',
      icon: AlertTriangle,
      color: negativeAlerts > 0 ? 'text-red-600' : 'text-slate-400',
      bgColor: negativeAlerts > 0 ? 'bg-red-50' : 'bg-slate-50',
      trend: negativeAlerts > 0 ? 'bad' : 'good',
    },
    {
      title: '被引用サイト数',
      value: citedUrls.size.toString(),
      description: 'AIが参照したURL総数',
      icon: Globe,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      trend: 'neutral' as const,
    },
  ]

  // ---- quick access ----
  const quickAccessItems = [
    {
      title: 'プロンプト管理',
      description: 'プロンプトの追加・編集・勝ち筋設定',
      href: '/prompts',
      icon: MessageSquare,
      color: 'bg-violet-50 text-violet-600',
    },
    {
      title: '計測・分析',
      description: 'AIプラットフォームでの表示率を計測',
      href: '/analytics',
      icon: BarChart3,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'コンテンツ制作',
      description: 'GEO最適化コンテンツを自動生成',
      href: '/content',
      icon: FileText,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'ウェブサイト改善',
      description: 'サイトのGEO問題を診断・修正',
      href: '/website',
      icon: Globe,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'アウトリーチ',
      description: 'メディア・ブログへの掲載依頼',
      href: '/outreach',
      icon: Mail,
      color: 'bg-pink-50 text-pink-600',
    },
  ]

  // ---- loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {store ? store.name : 'ダッシュボード'}
          </h1>
          <p className="text-muted-foreground mt-1">
            GEO対策の現状を一目で確認できます
          </p>
        </div>
        {store && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {store.businessType === 'food'
              ? '飲食'
              : store.businessType === 'beauty'
              ? '美容'
              : store.businessType === 'medical'
              ? '医療'
              : store.businessType === 'retail'
              ? '小売'
              : 'その他'}
          </Badge>
        )}
      </div>

      {/* ---- Summary Cards ---- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            className={cn(
              'relative overflow-hidden',
              card.trend === 'bad' && card.title.includes('ネガティブ') && negativeAlerts > 0
                ? 'border-red-200'
                : ''
            )}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-3xl font-bold tabular-nums',
                      card.trend === 'bad' && card.title.includes('ネガティブ') && negativeAlerts > 0
                        ? 'text-red-600'
                        : card.trend === 'good' && card.title.includes('表示率')
                        ? averageMentionRate >= 70
                          ? 'text-emerald-600'
                          : averageMentionRate >= 40
                          ? 'text-amber-600'
                          : 'text-red-600'
                        : 'text-foreground'
                    )}
                  >
                    {card.value}
                  </p>
                  <p className="text-sm font-medium mt-1 leading-snug">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                </div>
                <div
                  className={cn(
                    'rounded-lg p-2 shrink-0',
                    card.bgColor
                  )}
                >
                  <card.icon className={cn('h-5 w-5', card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---- Trend Chart ---- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">表示率の推移</CardTitle>
          </div>
          <CardDescription>
            プロンプト別の表示率（直近10計測日）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-muted-foreground">
              <BarChart3 className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">計測データがありません</p>
              <p className="text-xs">
                「計測・分析」から計測を開始すると、ここにグラフが表示されます
              </p>
              <Button size="sm" variant="outline" className="mt-2" asChild>
                <Link href="/analytics">計測を開始する</Link>
              </Button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip
                  formatter={(value, name) => {
                    const nameStr = String(name)
                    const idx = parseInt(nameStr.replace('p', ''))
                    const label = topPrompts[idx]?.text?.substring(0, 24) || nameStr
                    return [`${value ?? 0}%`, label]
                  }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const idx = parseInt(value.replace('p', ''))
                    const text = topPrompts[idx]?.text || value
                    return (
                      <span style={{ fontSize: 11 }}>
                        {text.length > 22 ? text.substring(0, 22) + '…' : text}
                      </span>
                    )
                  }}
                />
                {topPrompts.map((_, idx) => (
                  <Line
                    key={`p${idx}`}
                    type="monotone"
                    dataKey={`p${idx}`}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ---- Quick Access ---- */}
      <div>
        <h2 className="text-base font-semibold mb-3">各機能へのクイックアクセス</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickAccessItems.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          item.color
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ---- Winning Prompts Preview ---- */}
      {prompts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                勝ち筋プロンプト
              </CardTitle>
              <CardDescription className="mt-0.5">
                ★マークが付いた優先プロンプト一覧
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/prompts">
                すべて見る
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {winningPrompts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  プロンプト管理で★を付けると勝ち筋プロンプトとして表示されます
                </p>
                <Button variant="ghost" size="sm" className="mt-2" asChild>
                  <Link href="/prompts">プロンプトを管理する</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {winningPrompts.slice(0, 5).map((prompt) => (
                  <div
                    key={prompt.id}
                    className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
                  >
                    <Star className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" />
                    <p className="text-sm flex-1 leading-snug min-w-0 truncate">
                      {prompt.text}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs shrink-0',
                        categoryColors[prompt.category]
                      )}
                    >
                      {categoryLabels[prompt.category]}
                    </Badge>
                  </div>
                ))}
                {winningPrompts.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground pt-1">
                    他 {winningPrompts.length - 5} 件
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Setup Prompt (if no prompts yet) ---- */}
      {prompts.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="py-10 text-center space-y-3">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
            <div>
              <p className="font-medium text-sm">プロンプトがまだありません</p>
              <p className="text-xs text-muted-foreground mt-1">
                計測対象プロンプトを追加して、GEO最適化を開始しましょう
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/prompts">プロンプトを追加する</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
