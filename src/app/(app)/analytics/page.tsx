'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Play,
  Loader2,
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  MinusCircle,
  ExternalLink,
  BarChart2,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getStoreInfo,
  getPrompts,
  getMeasurementSessions,
  addMeasurementSession,
  updateMeasurementSession,
  getApiKeys,
  generateId,
} from '@/lib/storage'
import {
  StoreInfo,
  Prompt,
  Platform,
  MeasurementSession,
  MeasurementResult,
  Sentiment,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const PLATFORM_LIST: Platform[] = ['claude', 'gemini', 'chatgpt', 'perplexity']

const platformLabels: Record<Platform, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
}

const platformColors: Record<Platform, string> = {
  claude: 'bg-orange-50 border-orange-200 text-orange-700',
  gemini: 'bg-blue-50 border-blue-200 text-blue-700',
  chatgpt: 'bg-green-50 border-green-200 text-green-700',
  perplexity: 'bg-purple-50 border-purple-200 text-purple-700',
}

const sentimentLabels: Record<Sentiment, string> = {
  positive: 'ポジティブ',
  neutral: '中立',
  negative: 'ネガティブ',
}

const sentimentBadgeClass: Record<Sentiment, string> = {
  positive: 'bg-green-100 text-green-800 border-green-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  negative: 'bg-red-100 text-red-800 border-red-200',
}

const sentimentIcons: Record<Sentiment, React.ElementType> = {
  positive: CheckCircle,
  neutral: MinusCircle,
  negative: AlertTriangle,
}

const categoryLabels: Record<string, string> = {
  sales: '売上',
  awareness: '認知',
  reputation: 'ブランド',
}

const categoryBadgeClass: Record<string, string> = {
  sales: 'bg-blue-100 text-blue-800 border-blue-200',
  awareness: 'bg-violet-100 text-violet-800 border-violet-200',
  reputation: 'bg-amber-100 text-amber-800 border-amber-200',
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function mentionRateBarColor(rate: number) {
  if (rate >= 0.6) return 'bg-green-500'
  if (rate >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function mentionRateTextColor(rate: number) {
  if (rate >= 0.6) return 'text-green-600'
  if (rate >= 0.3) return 'text-yellow-600'
  return 'text-red-600'
}

function dominantSentiment(results: MeasurementResult[]): Sentiment {
  if (results.length === 0) return 'neutral'
  const pos = results.filter((r) => r.sentiment === 'positive').length
  const neg = results.filter((r) => r.sentiment === 'negative').length
  if (neg > pos) return 'negative'
  if (pos > 0) return 'positive'
  return 'neutral'
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

interface PromptStat {
  prompt: Prompt
  results: MeasurementResult[]
  mentionRate: number
  avgSentiment: Sentiment
  citedUrlCount: number
  lastMeasuredAt: string | null
}

function MentionRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', mentionRateBarColor(rate))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-semibold tabular-nums w-8 text-right',
          mentionRateTextColor(rate)
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const Icon = sentimentIcons[sentiment]
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 text-xs font-medium', sentimentBadgeClass[sentiment])}
    >
      <Icon className="h-3 w-3" />
      {sentimentLabels[sentiment]}
    </Badge>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [sessions, setSessions] = useState<MeasurementSession[]>([])
  const [measuring, setMeasuring] = useState(false)
  const [measureProgress, setMeasureProgress] = useState(0)
  const [measureProgressText, setMeasureProgressText] = useState('')
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<Platform>('claude')

  // Chat state
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    setStore(getStoreInfo())
    setPrompts(getPrompts())
    setSessions(getMeasurementSessions())
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Derived data ───────────────────────────────────────────────────────────

  const apiKeys = getApiKeys()

  const platformAvailability: Record<Platform, boolean> = {
    claude: !!apiKeys.anthropic,
    gemini: !!apiKeys.gemini,
    chatgpt: !!apiKeys.openai,
    perplexity: !!apiKeys.perplexity,
  }

  const allResults = sessions.flatMap((s) => s.results)

  // Sales + awareness prompts (up to 5 for measurement)
  const measurablePrompts = prompts
    .filter((p) => p.category === 'sales' || p.category === 'awareness')
    .slice(0, 5)

  // Build stats per prompt, filtered by a given platform (or null = all)
  function buildStats(filterPlatform: Platform | null): PromptStat[] {
    return prompts.map((prompt) => {
      const results = allResults.filter(
        (r) =>
          r.promptId === prompt.id &&
          (filterPlatform === null || r.platform === filterPlatform)
      )
      const mentionedCount = results.filter((r) => r.mentioned).length
      const mentionRate = results.length > 0 ? mentionedCount / results.length : 0
      const allCited = new Set(results.flatMap((r) => r.citedUrls))
      const dates = results.map((r) => r.measuredAt).sort()
      return {
        prompt,
        results,
        mentionRate,
        avgSentiment: dominantSentiment(results),
        citedUrlCount: allCited.size,
        lastMeasuredAt: dates.length > 0 ? dates[dates.length - 1] : null,
      }
    })
  }

  const allStats = buildStats(null)
  const platformStats = buildStats(selectedPlatformTab)

  const salesAwarenessStats = platformStats.filter(
    (s) => s.prompt.category !== 'reputation'
  )
  const reputationStats = platformStats.filter(
    (s) => s.prompt.category === 'reputation'
  )

  // Overall KPIs (across all platforms)
  const totalMeasured = allResults.length
  const overallMentionRate =
    totalMeasured > 0
      ? allResults.filter((r) => r.mentioned).length / totalMeasured
      : 0
  const negativeAlertCount = allResults.filter((r) => r.sentiment === 'negative').length
  const winningCount = prompts.filter((p) => p.isWinning).length
  const hasData = totalMeasured > 0

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleMeasure = async () => {
    if (!store || measurablePrompts.length === 0) return
    if (!apiKeys.anthropic) {
      alert('Anthropic APIキーが必要です（設定から入力してください）')
      return
    }

    setMeasuring(true)
    setMeasureProgress(0)

    const platformsToUse: Platform[] = ['claude']
    if (apiKeys.openai) platformsToUse.push('chatgpt')
    if (apiKeys.gemini) platformsToUse.push('gemini')
    if (apiKeys.perplexity) platformsToUse.push('perplexity')

    const session: MeasurementSession = {
      id: generateId(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      platforms: platformsToUse,
      results: [],
    }
    addMeasurementSession(session)

    const allNewResults: MeasurementResult[] = []
    const total = measurablePrompts.length

    for (let i = 0; i < measurablePrompts.length; i++) {
      const prompt = measurablePrompts[i]
      const displayText =
        prompt.text.length > 30 ? prompt.text.substring(0, 30) + '…' : prompt.text
      setMeasureProgressText(`「${displayText}」を計測中`)

      try {
        const res = await fetch('/api/measure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptId: prompt.id,
            promptText: prompt.text,
            storeName: store.name,
            competitors: store.competitors.map((c) => c.name),
            platforms: platformsToUse,
            apiKeys: {
              claude: apiKeys.anthropic,
              chatgpt: apiKeys.openai,
              gemini: apiKeys.gemini,
              perplexity: apiKeys.perplexity,
            },
          }),
        })
        const data = await res.json()
        if (data.results) {
          allNewResults.push(...data.results)
        }
      } catch (e) {
        console.error('計測エラー:', e)
      }

      setMeasureProgress(Math.round(((i + 1) / total) * 100))
    }

    updateMeasurementSession(session.id, {
      completedAt: new Date().toISOString(),
      results: allNewResults,
    })
    setSessions(getMeasurementSessions())
    setMeasuring(false)
    setMeasureProgressText('')
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !apiKeys.anthropic) return

    const userMessage = { role: 'user' as const, content: chatInput.trim() }
    const updatedMessages = [...chatMessages, userMessage]
    setChatMessages(updatedMessages)
    setChatInput('')
    setChatLoading(true)

    const systemContext = `あなたはGEO（生成エンジン最適化）対策の専門アナリストです。
店舗「${store?.name ?? ''}」の計測データを分析してアドバイスを提供してください。

【計測データサマリー】
総計測件数: ${totalMeasured}
全体表示率: ${Math.round(overallMentionRate * 100)}%
ネガティブアラート: ${negativeAlertCount}件
総プロンプト数: ${prompts.length}件
勝ち筋プロンプト数: ${winningCount}件

【プロンプト別表示率（全プラットフォーム合計）】
${allStats
  .map(
    (s) =>
      `- 「${s.prompt.text.substring(0, 50)}」: ${Math.round(s.mentionRate * 100)}% (${
        categoryLabels[s.prompt.category]
      })`
  )
  .join('\n')}

日本語で回答してください。具体的な改善提案を含めてください。`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          systemContext,
          apiKey: apiKeys.anthropic,
        }),
      })
      const data = await res.json()
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content || 'エラーが発生しました。もう一度お試しください。',
        },
      ])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">計測・分析</h1>
        <p className="text-muted-foreground text-sm mt-1">
          各AIプラットフォームでのブランド表示率を計測・分析します
        </p>
      </div>

      {/* ── Measure Control Card ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            今すぐ計測
          </CardTitle>
          <CardDescription>
            売上・認知カテゴリのプロンプト（最大5件）を利用可能なプラットフォームで一括計測します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform availability indicators */}
          <div className="flex flex-wrap gap-2">
            {PLATFORM_LIST.map((platform) => {
              const available = platformAvailability[platform]
              return (
                <div
                  key={platform}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                    available
                      ? platformColors[platform]
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      available ? 'bg-current' : 'bg-gray-300'
                    )}
                  />
                  {platformLabels[platform]}
                  {!available && <span className="opacity-60 ml-0.5">（APIキー未設定）</span>}
                </div>
              )
            })}
          </div>

          {/* Progress during measurement */}
          {measuring && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{measureProgressText}</span>
                <span className="font-medium">{measureProgress}%</span>
              </div>
              <Progress value={measureProgress} className="h-2" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleMeasure}
              disabled={measuring || measurablePrompts.length === 0 || !store}
              size="lg"
            >
              {measuring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  計測中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  計測開始
                </>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              {measurablePrompts.length > 0
                ? `${measurablePrompts.length}件のプロンプトを計測`
                : '売上・認知カテゴリのプロンプトがありません'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">全体表示率</p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  mentionRateTextColor(overallMentionRate)
                )}
              >
                {Math.round(overallMentionRate * 100)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">総計測件数</p>
              <p className="text-2xl font-bold">{totalMeasured}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">ネガティブアラート</p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  negativeAlertCount > 0 ? 'text-red-600' : 'text-green-600'
                )}
              >
                {negativeAlertCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-xs text-muted-foreground mb-1">勝ち筋プロンプト</p>
              <p className="text-2xl font-bold text-primary">{winningCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Main Tabs ────────────────────────────────────────────────────── */}
      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">
            <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
            計測結果
          </TabsTrigger>
          <TabsTrigger value="reputation">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            ブランド毀損分析
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            詳細分析チャット
          </TabsTrigger>
        </TabsList>

        {/* ── Results Tab ──────────────────────────────────────────────── */}
        <TabsContent value="results" className="space-y-4 mt-4">
          {/* Platform sub-tabs */}
          <Tabs
            value={selectedPlatformTab}
            onValueChange={(v) => setSelectedPlatformTab(v as Platform)}
          >
            <TabsList className="h-8">
              {PLATFORM_LIST.map((p) => {
                const available = platformAvailability[p]
                return (
                  <TabsTrigger key={p} value={p} className="text-xs px-3 h-7">
                    {platformLabels[p]}
                    {!available && (
                      <span className="ml-1 text-[10px] opacity-50">要設定</span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {PLATFORM_LIST.map((platform) => (
              <TabsContent key={platform} value={platform} className="mt-4">
                {!platformAvailability[platform] && (
                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>APIキーが未設定です</AlertTitle>
                    <AlertDescription>
                      {platformLabels[platform]}
                      で計測するには、設定ページでAPIキーを入力してください。
                    </AlertDescription>
                  </Alert>
                )}

                {!hasData ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground text-sm font-medium">
                        計測データがありません
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        「今すぐ計測」から計測を開始してください
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="pl-4 w-[38%]">プロンプト</TableHead>
                            <TableHead className="w-[10%]">カテゴリ</TableHead>
                            <TableHead className="w-[22%]">表示率</TableHead>
                            <TableHead className="w-[13%]">センチメント</TableHead>
                            <TableHead className="w-[8%] text-center">被引用サイト数</TableHead>
                            <TableHead className="w-[9%] text-right pr-4">最終計測日時</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesAwarenessStats.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="py-12 text-center text-muted-foreground text-sm"
                              >
                                売上・認知カテゴリのプロンプトがありません
                              </TableCell>
                            </TableRow>
                          ) : (
                            salesAwarenessStats.map(
                              ({
                                prompt,
                                mentionRate,
                                avgSentiment,
                                citedUrlCount,
                                lastMeasuredAt,
                                results,
                              }) => (
                                <TableRow key={prompt.id} className="align-middle">
                                  <TableCell className="pl-4 py-3">
                                    <div className="space-y-1">
                                      <p className="text-sm leading-snug line-clamp-2">
                                        {prompt.text}
                                      </p>
                                      {prompt.isWinning && (
                                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 border-amber-200 font-medium">
                                          勝ち筋
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs',
                                        categoryBadgeClass[prompt.category]
                                      )}
                                    >
                                      {categoryLabels[prompt.category]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {results.length > 0 ? (
                                      <MentionRateBar rate={mentionRate} />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        未計測
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {results.length > 0 ? (
                                      <SentimentBadge sentiment={avgSentiment} />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {citedUrlCount > 0 ? (
                                      <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                        <ExternalLink className="h-3 w-3" />
                                        {citedUrlCount}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right pr-4">
                                    {lastMeasuredAt ? (
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(lastMeasuredAt)}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ── Reputation / Brand Analysis Tab ─────────────────────────── */}
        <TabsContent value="reputation" className="space-y-4 mt-4">
          {/* Global negative alert banner */}
          {reputationStats.some(
            (s) => s.avgSentiment === 'negative' && s.results.length > 0
          ) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>ネガティブセンチメントが検出されました</AlertTitle>
              <AlertDescription>
                ブランドに関してネガティブな評価が検出されています。早急な対応をご検討ください。
              </AlertDescription>
            </Alert>
          )}

          {reputationStats.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm font-medium">
                  ブランド毀損モニタリング用プロンプトがありません
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  「プロンプト管理」でブランドカテゴリのプロンプトを追加してください
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reputationStats.map(({ prompt, results, avgSentiment }) => {
                const latestResult =
                  results.length > 0 ? results[results.length - 1] : null
                const SentimentIcon = sentimentIcons[avgSentiment]
                const isNegative = avgSentiment === 'negative' && results.length > 0

                return (
                  <Card
                    key={prompt.id}
                    className={cn(
                      isNegative && 'border-red-300'
                    )}
                  >
                    <CardContent className="py-4 space-y-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {prompt.text}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {results.length > 0 ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'gap-1 text-xs',
                                  sentimentBadgeClass[avgSentiment]
                                )}
                              >
                                <SentimentIcon className="h-3 w-3" />
                                {sentimentLabels[avgSentiment]}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                未計測
                              </span>
                            )}
                            {results.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {results.length}回計測 / 最終:{' '}
                                {formatDate(results[results.length - 1].measuredAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        {isNegative && (
                          <Badge variant="destructive" className="shrink-0 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            要対応
                          </Badge>
                        )}
                      </div>

                      {/* Sentiment breakdown panels */}
                      {latestResult && (
                        <>
                          <Separator />
                          <div className="grid sm:grid-cols-2 gap-3">
                            {latestResult.positiveElements && (
                              <div className="rounded-lg border border-green-100 bg-green-50 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                  <p className="text-xs font-semibold text-green-800">
                                    ポジティブ要素
                                  </p>
                                </div>
                                <p className="text-xs text-green-700 leading-relaxed">
                                  {latestResult.positiveElements}
                                </p>
                              </div>
                            )}
                            {latestResult.negativeElements && (
                              <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                  <p className="text-xs font-semibold text-red-800">
                                    ネガティブ要素
                                  </p>
                                </div>
                                <p className="text-xs text-red-700 leading-relaxed">
                                  {latestResult.negativeElements}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Cited URLs */}
                          {latestResult.citedUrls.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                被引用サイト
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {latestResult.citedUrls.map((url, i) => {
                                  let hostname = url
                                  try {
                                    hostname = new URL(url).hostname
                                  } catch {}
                                  return (
                                    <a
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                      <ExternalLink className="h-2.5 w-2.5" />
                                      {hostname}
                                    </a>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {results.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          まだ計測されていません。「今すぐ計測」から計測を開始してください。
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Chat Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="chat" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-primary" />
                詳細分析チャット
              </CardTitle>
              <CardDescription>
                計測データについてAIに質問して深掘り分析・改善提案を得られます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!apiKeys.anthropic && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>APIキーが必要です</AlertTitle>
                  <AlertDescription>
                    チャット機能にはAnthropic APIキーが必要です。設定ページから入力してください。
                  </AlertDescription>
                </Alert>
              )}

              {/* Message area */}
              <ScrollArea className="h-[380px] rounded-lg border bg-muted/20 p-4">
                <div className="space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <MessageSquare className="h-10 w-10 text-muted-foreground opacity-25 mb-3" />
                      <p className="text-sm text-muted-foreground font-medium">
                        計測データについて質問してみましょう
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 opacity-75">
                        例：「表示率を上げるために何をすべきですか？」
                      </p>
                      <p className="text-xs text-muted-foreground opacity-75">
                        例：「ネガティブ評価への対処法を教えてください」
                      </p>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-white border shadow-sm rounded-tl-sm'
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Input row */}
              <div className="flex gap-2">
                <Input
                  placeholder={
                    apiKeys.anthropic
                      ? 'メッセージを入力… (Enterで送信)'
                      : 'APIキーを設定してください'
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !chatLoading) {
                      e.preventDefault()
                      handleChat()
                    }
                  }}
                  disabled={chatLoading || !apiKeys.anthropic}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleChat}
                  disabled={chatLoading || !chatInput.trim() || !apiKeys.anthropic}
                >
                  {chatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
