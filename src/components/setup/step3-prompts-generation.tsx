'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  Star,
  StarOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { StoreInfo, Prompt, PromptCategory } from '@/types'
import { cn } from '@/lib/utils'
import { getStore } from '@/lib/storage'

interface Props {
  storeInfo: StoreInfo
  onComplete: (prompts: Prompt[]) => void
  onBack: () => void
}

const categoryLabels: Record<PromptCategory, string> = {
  sales: '売上',
  awareness: 'ブランド認知',
  reputation: 'ブランド毀損',
}

const categoryColors: Record<PromptCategory, string> = {
  sales: 'bg-green-100 text-green-800',
  awareness: 'bg-blue-100 text-blue-800',
  reputation: 'bg-red-100 text-red-800',
}

const difficultyColors: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  med: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
}

const difficultyLabels: Record<string, string> = {
  low: 'Low',
  med: 'Med',
  high: 'High',
}

const WINNING_TOP_N = 20

export function Step3PromptsGeneration({ storeInfo, onComplete, onBack }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState('')

  // バッチ計測状態
  const [measuring, setMeasuring] = useState(false)
  const [measureDone, setMeasureDone] = useState(false)
  const [measureProgress, setMeasureProgress] = useState(0) // 0〜100
  const [measureTotal, setMeasureTotal] = useState(0)
  const [measureCurrent, setMeasureCurrent] = useState(0)
  const [displayRates, setDisplayRates] = useState<Record<string, number>>({}) // promptId -> %

  useEffect(() => {
    handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setGenerated(false)
    setMeasureDone(false)
    setDisplayRates({})
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: storeInfo }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      const generated: Prompt[] = data.prompts || []
      setPrompts(generated)
      setGenerated(true)
      // 生成完了後に自動でバッチ計測を開始
      await handleBatchMeasure(generated)
    } catch {
      setError('プロンプト生成に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setGenerating(false)
    }
  }

  const handleBatchMeasure = async (targetPrompts: Prompt[]) => {
    setMeasuring(true)
    setMeasureDone(false)
    setMeasureProgress(0)
    setMeasureCurrent(0)
    setMeasureTotal(targetPrompts.length)

    const appStore = getStore()
    const apiKey = appStore.apiKeys?.anthropic || undefined

    // プロンプトを順番に計測（進捗をリアルタイム更新）
    const ratesMap: Record<string, number> = {}

    try {
      for (let i = 0; i < targetPrompts.length; i++) {
        const p = targetPrompts[i]
        setMeasureCurrent(i + 1)
        setMeasureProgress(Math.round(((i) / targetPrompts.length) * 100))

        const res = await fetch('/api/batch-measure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompts: [{ id: p.id, text: p.text }],
            entityName: storeInfo.name,
            times: 3,
            ...(apiKey ? { apiKey } : {}),
          }),
        })
        const data = await res.json()
        if (data.results?.[0]) {
          ratesMap[p.id] = data.results[0].displayRate
        } else {
          ratesMap[p.id] = 0
        }
        setDisplayRates({ ...ratesMap })
      }

      setMeasureProgress(100)

      // 上位WINNING_TOP_N件を自動★勝ち筋に設定
      const sortedIds = Object.entries(ratesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, WINNING_TOP_N)
        .map(([id]) => id)

      const winningSet = new Set(sortedIds)
      setPrompts((prev) =>
        prev.map((p) => ({ ...p, isWinning: winningSet.has(p.id) }))
      )

      setMeasureDone(true)
    } catch {
      setError('バッチ計測に失敗しました。')
    } finally {
      setMeasuring(false)
    }
  }

  const toggleWinning = (id: string) => {
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isWinning: !p.isWinning } : p))
    )
  }

  const handleComplete = () => {
    onComplete(prompts)
  }

  // プロンプト生成中
  if (generating && !generated) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-medium">プロンプトを生成中...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Claude AIが{storeInfo.name}の企業GEO対策プロンプトを分析しています
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロンプト生成・計測</CardTitle>
        <CardDescription>
          入力した企業情報をもとにAIがGEO対策プロンプトを自動生成し、全件の表示率を計測します。上位{WINNING_TOP_N}件が自動的に勝ち筋プロンプトに設定されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* バッチ計測中プログレス */}
        {measuring && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium">
                全プロンプトを計測中... ({measureCurrent}/{measureTotal})
              </p>
            </div>
            <Progress value={measureProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              各プロンプトをClaudeに3回問い合わせて表示率を算出しています
            </p>
          </div>
        )}

        {/* 計測完了バナー */}
        {measureDone && !measuring && (
          <Alert className="border-green-300 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              全プロンプトの表示率計測が完了しました。上位{WINNING_TOP_N}件を勝ち筋プロンプトに設定しました。★を編集して調整できます。
            </AlertDescription>
          </Alert>
        )}

        {generated && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {prompts.length}件のプロンプト
                {measureDone && (
                  <span className="ml-2 text-amber-600 font-medium">
                    · 勝ち筋: {prompts.filter((p) => p.isWinning).length}件
                  </span>
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating || measuring}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1">再生成</span>
              </Button>
            </div>

            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-3">
                <TooltipProvider>
                  {[...prompts]
                    .sort((a, b) => {
                      // 勝ち筋を先頭、次に表示率降順
                      if (a.isWinning !== b.isWinning) return a.isWinning ? -1 : 1
                      return (displayRates[b.id] ?? 0) - (displayRates[a.id] ?? 0)
                    })
                    .map((prompt) => {
                      const rate = displayRates[prompt.id]
                      return (
                        <div
                          key={prompt.id}
                          className={cn(
                            'rounded-lg border p-3 space-y-2 transition-colors',
                            prompt.isWinning
                              ? 'border-yellow-400 bg-yellow-50'
                              : 'border-border bg-card'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug flex-1">
                              {prompt.text}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* 表示率バッジ */}
                              {rate !== undefined ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                                        rate >= 67
                                          ? 'bg-green-100 text-green-700'
                                          : rate >= 34
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-slate-100 text-slate-500'
                                      )}
                                    >
                                      <BarChart2 className="h-3 w-3" />
                                      {rate}%
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>表示率 (3回計測の平均)</TooltipContent>
                                </Tooltip>
                              ) : measuring ? (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                </span>
                              ) : null}

                              {/* 勝ち筋トグル */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleWinning(prompt.id)}
                                className={cn(
                                  'h-7 px-2',
                                  prompt.isWinning
                                    ? 'text-yellow-500'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {prompt.isWinning ? (
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                ) : (
                                  <StarOff className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge
                              variant="secondary"
                              className={cn('text-xs', categoryColors[prompt.category])}
                            >
                              {categoryLabels[prompt.category]}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={cn('text-xs', difficultyColors[prompt.difficulty])}
                            >
                              {difficultyLabels[prompt.difficulty]}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              優先度:{' '}
                              {prompt.priority === 'high'
                                ? '高'
                                : prompt.priority === 'medium'
                                ? '中'
                                : '低'}
                            </Badge>
                          </div>

                          {prompt.pseudoMemory && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs text-muted-foreground cursor-help underline decoration-dotted">
                                  擬似ユーザーメモリーを確認
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{prompt.pseudoMemory}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )
                    })}
                </TooltipProvider>
              </div>
            </ScrollArea>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1" disabled={measuring}>
                戻る
              </Button>
              <Button
                onClick={handleComplete}
                disabled={prompts.length === 0 || measuring}
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                設定完了・ダッシュボードへ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
