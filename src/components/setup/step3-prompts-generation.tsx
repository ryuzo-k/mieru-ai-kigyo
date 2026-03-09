'use client'

import { useState, useEffect } from 'react'
import { Loader2, Star, StarOff, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StoreInfo, Prompt, PromptCategory } from '@/types'
import { cn } from '@/lib/utils'

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

export function Step3PromptsGeneration({ storeInfo, onComplete, onBack }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [generating, setGenerating] = useState(false)
  const [measuring, setMeasuring] = useState<string | null>(null)
  const [measureResults, setMeasureResults] = useState<Record<string, string>>({})
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    handleGenerate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
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
      setPrompts(data.prompts || [])
      setGenerated(true)
    } catch {
      setError('プロンプト生成に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setGenerating(false)
    }
  }

  const handleMeasure = async (promptId: string) => {
    const prompt = prompts.find((p) => p.id === promptId)
    if (!prompt) return

    setMeasuring(promptId)
    try {
      const res = await fetch('/api/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId,
          promptText: prompt.text,
          storeName: storeInfo.name,
          competitors: storeInfo.competitors.map((c) => c.name),
          platforms: ['claude'],
        }),
      })
      const data = await res.json()
      if (data.results?.[0]) {
        const result = data.results[0]
        const mentioned = result.mentioned
        setMeasureResults((prev) => ({
          ...prev,
          [promptId]: mentioned
            ? `✅ ${storeInfo.name}が回答に含まれました`
            : `❌ ${storeInfo.name}は回答に含まれませんでした`,
        }))
        if (mentioned && result.sentiment !== 'negative') {
          setPrompts((prev) =>
            prev.map((p) => (p.id === promptId ? { ...p, isWinning: true } : p))
          )
        }
      }
    } catch {
      setMeasureResults((prev) => ({
        ...prev,
        [promptId]: '計測に失敗しました',
      }))
    } finally {
      setMeasuring(null)
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

  if (generating && !generated) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-medium">プロンプトを生成中...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Claude AIが{storeInfo.name}のGEO対策プロンプトを分析しています
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
          入力した情報をもとにAIが勝ち筋プロンプトを自動生成します。★で勝ち筋プロンプトを選択し、即時計測で効果を確認できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!generated && !generating ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">生成内容：</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 売上に関するプロンプト（来店・予約・選択）</li>
                <li>• ブランド認知に関するプロンプト</li>
                <li>• ブランド毀損モニタリング用プロンプト</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1">
                戻る
              </Button>
              <Button onClick={handleGenerate} className="flex-1">
                プロンプト生成
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {prompts.length}件のプロンプトが生成されました。
                ★で勝ち筋プロンプトを選択してください。
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
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
                  {prompts.map((prompt) => (
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMeasure(prompt.id)}
                                disabled={measuring === prompt.id}
                                className="h-7 px-2"
                              >
                                {measuring === prompt.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Zap className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>即時計測</TooltipContent>
                          </Tooltip>
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
                          優先度: {prompt.priority === 'high' ? '高' : prompt.priority === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>

                      {measureResults[prompt.id] && (
                        <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                          {measureResults[prompt.id]}
                        </p>
                      )}

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
                  ))}
                </TooltipProvider>
              </div>
            </ScrollArea>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="flex-1">
                戻る
              </Button>
              <Button onClick={handleComplete} disabled={prompts.length === 0} className="flex-1">
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
