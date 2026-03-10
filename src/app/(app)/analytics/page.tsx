'use client'

import React, { useEffect, useState, useRef } from 'react'
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
  ChevronRight,
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
  getApiKeys,
} from '@/lib/storage'
import { getStoreFromDB, getPromptsFromDB, getMeasurementResultsFromDB } from '@/lib/db'
import { useCompany } from '@/context/company-context'
import {
  StoreInfo,
  Prompt,
  Platform,
  MeasurementResult,
  Sentiment,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'
import { PromptDetailPanel } from '@/components/analytics/PromptDetailPanel'

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
  const { companyId } = useCompany()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [allResults, setAllResults] = useState<MeasurementResult[]>([])
  const [measuring, setMeasuring] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
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

  // Load from DB on mount / company change
  useEffect(() => {
    getStoreFromDB(companyId).then(setStore).catch(() => {})
    getPromptsFromDB(companyId).then(setPrompts).catch(() => {})
    getMeasurementResultsFromDB(undefined, companyId).then(setAllResults).catch(() => {})
  }, [companyId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Derived data ───────────────────────────────────────────────────────────

  const apiKeys = getApiKeys()

  // APIキーがない場合はサーバー環境変数で動くためtrueにする
  const platformAvailability: Record<Platform, boolean> = {
    claude: true,  // サーバー側で ANTHROPIC_API_KEY を使用
    gemini: true,  // サーバー側で GOOGLE_GEMINI_API_KEY を使用
    chatgpt: true, // サーバー側で OPENAI_API_KEY を使用
    perplexity: true, // サーバー側で PERPLEXITY_API_KEY を使用
  }

  // All prompts (sorted: winning first, then by display rate desc)
  const measurablePrompts = [...prompts].sort((a, b) => {
    if (a.isWinning !== b.isWinning) return a.isWinning ? -1 : 1
    return (b.displayRate ?? 0) - (a.displayRate ?? 0)
  })

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
    setMeasuring(true)
    setMeasureProgress(0)
    setMeasureProgressText('計測ジョブを開始中...')

    try {
      // サーバー側でバックグラウンド計測を開始（ページ離脱しても継続）
      const res = await fetch('/api/measure-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          promptIds: measurablePrompts.map((p) => p.id),
          platforms: ['claude', 'chatgpt', 'gemini', 'perplexity'],
          storeName: store.name,
          brandName: store.brandName || '',
          competitors: store.competitors.map((c) => c.name),
          apiKeys: {},
        }),
      })
      const { jobId, total } = await res.json()

      if (!jobId) {
        setMeasuring(false)
        setMeasureProgressText('')
        return
      }

      setMeasureProgressText(`計測中（0/${total}件完了）`)

      // 5秒ごとに進捗をポーリング
      const interval = setInterval(async () => {
        try {
          const prog = await fetch(`/api/measure-all?jobId=${jobId}&companyId=${companyId}`)
          const job = await prog.json()

          const pct = job.totalPrompts > 0
            ? Math.round((job.completedPrompts / job.totalPrompts) * 100)
            : 0
          setMeasureProgress(pct)

          if (job.currentPromptText) {
            const short = job.currentPromptText.length > 30
              ? job.currentPromptText.substring(0, 30) + '…'
              : job.currentPromptText
            setMeasureProgressText(`「${short}」を計測中（${job.completedPrompts}/${job.totalPrompts}件）`)
          }

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval)
            setMeasuring(false)
            setMeasureProgressText('')
            setMeasureProgress(100)
            // DBから最新結果を取得
            getMeasurementResultsFromDB(undefined, companyId).then(setAllResults).catch(() => {})
          }
        } catch {
          // ポーリングエラーは無視して継続
        }
      }, 5000)
    } catch (e) {
      console.error('計測開始エラー:', e)
      setMeasuring(false)
      setMeasureProgressText('')
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !apiKeys.anthropic) return

    const userMessage = { role: 'user' as const, content: chatInput.trim() }
    const updatedMessages = [...chatMessages, userMessage]
    setChatMessages(updatedMessages)
    setChatInput('')
    setChatLoading(true)

    const systemContext = `あなたはGEO（生成エンジン最適化）対策の専門アナリストです。
企業「${store?.name ?? ""}」の計測データを分析してアドバイスを提供してください。

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
            全プロンプトを利用可能なプラットフォームで一括計測します（勝ち筋プロンプト優先）
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
                                <React.Fragment key={prompt.id}>
                                <TableRow
                                  className={cn("align-middle cursor-pointer hover:bg-muted/30 transition-colors", expandedKey === `${platform}-${prompt.id}` && "bg-primary/5")}
                                  onClick={() => setExpandedKey(expandedKey === `${platform}-${prompt.id}` ? null : `${platform}-${prompt.id}`)}
                                >
                                  <TableCell className="pl-4 py-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", expandedKey === `${platform}-${prompt.id}` && "rotate-90 text-primary")} />
                                        <p className="text-sm leading-snug line-clamp-2">{prompt.text}</p>
                                      </div>
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
                                {expandedKey === `${platform}-${prompt.id}` && (
                                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                                    <TableCell colSpan={6} className="px-4 pb-4 pt-0">
                                      {results.length > 0 ? (
                                        <PromptDetailPanel
                                          promptText={prompt.text}
                                          result={results[results.length - 1]}
                                          storeName={store?.name ?? ''}
                                        />
                                      ) : (
                                        <p className="text-xs text-muted-foreground py-2">
                                          まだ計測されていません。「今すぐ計測」から計測を開始してください。
                                        </p>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )}
                                </React.Fragment>
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

                          {/* Cited Context — AIがどういう文脈で言及したか */}
                          {(latestResult as MeasurementResult & { citedContext?: string; citedCompetitors?: string[] }).citedContext && (
                            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                              <p className="text-xs font-medium text-amber-700 mb-1">AIの言及文脈</p>
                              <p className="text-xs text-amber-800">{(latestResult as MeasurementResult & { citedContext?: string }).citedContext}</p>
                            </div>
                          )}

                          {/* Competitor Rankings */}
                          {((latestResult as MeasurementResult).competitorRankings ?? []).length > 0 && (
                            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                              <p className="text-xs font-medium text-red-700 mb-2">競合の出現順位</p>
                              <div className="space-y-1.5">
                                {((latestResult as MeasurementResult).competitorRankings ?? [])
                                  .sort((a, b) => a.rank - b.rank)
                                  .map((c, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <span className="rounded-full bg-red-200 text-red-800 text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0">{c.rank === 99 ? '-' : c.rank}</span>
                                      <div>
                                        <span className="text-xs font-medium text-red-800">{c.name}</span>
                                        {c.snippet && <p className="text-[10px] text-red-600 mt-0.5">{c.snippet}</p>}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          {/* Cited Competitors (fallback if no rankings) */}
                          {((latestResult as MeasurementResult).competitorRankings ?? []).length === 0 &&
                            ((latestResult as MeasurementResult & { citedCompetitors?: string[] }).citedCompetitors ?? []).length > 0 && (
                            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                              <p className="text-xs font-medium text-red-700 mb-1">同時に言及された競合</p>
                              <div className="flex flex-wrap gap-1">
                                {((latestResult as MeasurementResult & { citedCompetitors?: string[] }).citedCompetitors ?? []).map((c, i) => (
                                  <span key={i} className="rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-xs text-red-700">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}

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
                          {/* Raw AI responses — 3回分の実際の回答 */}
                          {((latestResult as MeasurementResult).rawResponses ?? []).length > 0 && (
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-medium text-muted-foreground flex items-center gap-1 select-none hover:text-foreground transition-colors">
                                <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                                AIの実際の回答を見る（{((latestResult as MeasurementResult).rawResponses ?? []).length}回分）
                              </summary>
                              <div className="mt-2 space-y-2">
                                {((latestResult as MeasurementResult).rawResponses ?? []).map((resp, i) => {
                                  const isMentioned = resp.toLowerCase().includes((store?.name ?? "").toLowerCase())
                                  return (
                                    <div key={i} className={cn("rounded-md border px-3 py-2 text-xs", isMentioned ? "border-green-300 bg-green-50" : "border-border bg-muted/30")}>
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <span className="font-medium text-muted-foreground">試行 {i+1}</span>
                                        {isMentioned
                                          ? <span className="text-green-700 font-medium">✓ 言及あり</span>
                                          : <span className="text-slate-500">— 言及なし</span>
                                        }
                                      </div>
                                      <pre className="whitespace-pre-wrap leading-relaxed font-sans text-foreground/80">{resp}</pre>
                                    </div>
                                  )
                                })}
                              </div>
                            </details>
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
