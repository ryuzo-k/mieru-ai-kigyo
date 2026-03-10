'use client'

import { useEffect, useState } from 'react'
import type { CompetitorBlogReport as CompetitorBlogReportType } from '@/app/api/analyze-competitor-blogs/route'
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Pencil,
  Save,
  X,
  Info,
  ChevronRight,
  Sparkles,

  Megaphone,
  BookOpen,
  BarChart2,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import { Badge } from '@/components/ui/badge'

import {


  TooltipProvider,

} from '@/components/ui/tooltip'
import {
  getStoreInfo,
  getPrompts,
  getGeneratedContents,
  saveGeneratedContents,
  getApiKeys,
  generateId,
} from '@/lib/storage'
import {
  StoreInfo,
  Prompt,
  ContentMedium,
  GeneratedContent,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ── Content medium config (企業向けのみ・LP削除) ───────────────────────────

interface MediumConfig {
  id: ContentMedium
  label: string
  icon: React.ElementType
  description: string
  destination: string // どこに使うコンテンツか
}

const MEDIUMS: MediumConfig[] = [
  {
    id: 'owned_media_article',
    label: 'オウンドメディア記事',
    icon: FileText,
    description: 'ブログ・技術記事。AIが引用しやすい根拠情報を中心に構成',
    destination: 'オウンドメディア',
  },
  {
    id: 'whitepaper',
    label: 'ホワイトペーパー',
    icon: BookOpen,
    description: '専門知識・調査データを体系化。ダウンロード資料として活用',
    destination: 'ダウンロード資料',
  },
  {
    id: 'press_release',
    label: 'プレスリリース',
    icon: Megaphone,
    description: 'PR TIMES等向け。外部メディア掲載・引用を狙う',
    destination: '外部メディア',
  },
  {
    id: 'case_study',
    label: '事例記事',
    icon: CheckSquare,
    description: '導入事例・成果事例。具体的な数値実績でAI引用率を上げる',
    destination: 'オウンドメディア・外部PR',
  },
  {
    id: 'column',
    label: 'コラム/専門記事',
    icon: Sparkles,
    description: '業界知見・専門コラム。ドメイン権威性を高める',
    destination: 'オウンドメディア',
  },
]

// ── Requirement extraction result type ────────────────────────────────────

interface PromptRequirement {
  promptId: string
  requirements: string[]
}

interface RequirementsResult {
  requirements: PromptRequirement[]
  sharedRequirements: string[]
  coverageMap: Record<string, string[]> // promptId → covered by which content
}

// ── Competitor Blog Analysis ───────────────────────────────────────────────

function CompetitorAnalysisTab() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [report, setReport] = useState<CompetitorBlogReportType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStore(getStoreInfo())
  }, [])

  const handleAnalyze = async () => {
    const apiKeys = getApiKeys()
    const anthropicKey = apiKeys.anthropic
    if (!store) return

    const competitors = store.competitors || []
    if (competitors.length === 0) {
      setError('競合企業が未登録です。設定ページで競合企業URLを登録してください。')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      const res = await fetch('/api/analyze-competitor-blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: store.name,
          competitors: competitors.map((c) => ({ name: c.name, url: c.url })),
          clientApiKey: anthropicKey,
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data: CompetitorBlogReportType = await res.json()
      setReport(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="py-3 px-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium mb-0.5">競合コンテンツ分析</p>
              <p className="text-xs leading-relaxed">
                設定ページで登録した競合企業のサイトを自動クロールし、AIが引用しやすいコンテンツ形式・GEOスコアを分析します。
                どのコンテンツ種別が効果的か、自社に欠けているものは何かを自動で提案します。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 items-center">
        <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
          {analyzing ? '競合コンテンツを分析中...' : '競合コンテンツを自動分析'}
        </Button>
        {store && store.competitors.length > 0 && (
          <span className="text-sm text-muted-foreground">{store.competitors.length}社を分析対象として登録済み</span>
        )}
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 px-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-4">
          {report.analyses.map((a, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{a.competitorName}</CardTitle>
                <CardDescription className="text-xs">{a.blogUrl}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1.5">
                  {a.contentTypes.map((ct, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <span className="text-xs w-36 shrink-0">{ct.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${ct.geoScore}%` }} />
                      </div>
                      <span className="text-xs font-mono w-8 text-right">{ct.geoScore}</span>
                      <Badge variant="outline" className={cn('text-xs', ct.frequency === 'high' ? 'text-green-700' : ct.frequency === 'medium' ? 'text-yellow-700' : 'text-slate-500')}>
                        {ct.frequency === 'high' ? '多' : ct.frequency === 'medium' ? '中' : '少'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  推奨: <strong>{a.recommendedStrategy.primaryType}</strong> — {a.recommendedStrategy.reasoning}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-700">総合推奨コンテンツ戦略</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>勝ちコンテンツ種別:</strong> {report.overallRecommendation.topContentType}</p>
              <p className="text-muted-foreground">{report.overallRecommendation.whyItWins}</p>
              {report.overallRecommendation.quickWins.length > 0 && (
                <div>
                  <p className="font-medium text-xs mb-1">Quick Wins</p>
                  <ul className="space-y-0.5">
                    {report.overallRecommendation.quickWins.map((w, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [apiKeys, setApiKeys] = useState<ReturnType<typeof getApiKeys> | null>(null)

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set())
  const [extracting, setExtracting] = useState(false)
  const [reqResult, setReqResult] = useState<RequirementsResult | null>(null)
  const [selectedMedium, setSelectedMedium] = useState<ContentMedium>('owned_media_article')
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<string>('')
  const [generatedTitle, setGeneratedTitle] = useState<string>('')
  const [editingContent, setEditingContent] = useState(false)
  const [editBuffer, setEditBuffer] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const s = getStoreInfo()
    const p = getPrompts()
    setStore(s)
    setPrompts(p)
    setContents(getGeneratedContents())
    setApiKeys(getApiKeys())
    // 勝ち筋プロンプトを初期選択
    const winningIds = new Set(p.filter((x) => x.isWinning).map((x) => x.id))
    setSelectedPromptIds(winningIds)
  }, [])

  const winningPrompts = prompts.filter((p) => p.isWinning)
  const allPrompts = prompts

  // ── Step 1: プロンプト選択 ────────────────────────────────────────────

  const togglePrompt = (id: string) => {
    setSelectedPromptIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedPromptIds(new Set(allPrompts.map((p) => p.id)))
  const selectWinning = () => setSelectedPromptIds(new Set(winningPrompts.map((p) => p.id)))
  const clearAll = () => setSelectedPromptIds(new Set())

  // ── Step 2: 重要要件の横断分析 ─────────────────────────────────────────

  const handleExtractRequirements = async () => {
    if (!store || selectedPromptIds.size === 0) return
    const apiKey = apiKeys?.anthropic || ''
    if (!apiKey && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // allow server-side key
    }

    setExtracting(true)
    try {
      const selectedPrompts = allPrompts.filter((p) => selectedPromptIds.has(p.id))
      const res = await fetch('/api/extract-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, prompts: selectedPrompts, clientApiKey: apiKey }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReqResult({ ...data, coverageMap: {} })
      setStep(2)
    } catch (e) {
      alert('要件抽出に失敗しました: ' + (e as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  // ── Step 3: コンテンツ生成 ────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!store || !reqResult) return
    const apiKey = apiKeys?.anthropic || ''
    const medium = MEDIUMS.find((m) => m.id === selectedMedium)!

    setGenerating(true)
    setGeneratedContent('')
    setGeneratedTitle('')

    try {
      const selectedPrompts = allPrompts.filter((p) => selectedPromptIds.has(p.id))
      const sharedReqs = reqResult.sharedRequirements || []
      const allReqs = reqResult.requirements?.flatMap((r) => r.requirements) || []

      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store,
          prompts: selectedPrompts,
          medium: selectedMedium,
          requirements: Array.from(new Set([...sharedReqs, ...allReqs])),
          clientApiKey: apiKey,
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      setGeneratedTitle(data.title || `${medium.label} — ${store.name}`)
      setGeneratedContent(data.content || '')
      setStep(3)

      // Save to history
      const newContent: GeneratedContent = {
        id: generateId(),
        medium: selectedMedium,
        title: data.title || `${medium.label} — ${store.name}`,
        content: data.content || '',
        promptIds: selectedPrompts.map((p) => p.id),
        generatedAt: new Date().toISOString(),
        editedAt: null,
      }
      const updated = [newContent, ...contents]
      saveGeneratedContents(updated)
      setContents(updated)
    } catch (e) {
      alert('コンテンツ生成に失敗しました: ' + (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (!store) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        企業情報が設定されていません。先に初期設定を完了してください。
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">コンテンツ設計・制作</h1>
          <p className="text-muted-foreground text-sm mt-1">
            勝ち筋プロンプトの重要要件を横断分析し、AIに引用されるコンテンツを設計・生成します
          </p>
        </div>

        <Tabs defaultValue="design">
          <TabsList>
            <TabsTrigger value="design" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              コンテンツ設計・生成
            </TabsTrigger>
            <TabsTrigger value="competitor" className="gap-1.5">
              <BarChart2 className="h-4 w-4" />
              競合コンテンツ分析
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <FileText className="h-4 w-4" />
              生成履歴
            </TabsTrigger>
          </TabsList>

          {/* ── Design Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="design" className="space-y-4 mt-4">

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              {[
                { n: 1, label: 'プロンプト選択' },
                { n: 2, label: '要件横断分析' },
                { n: 3, label: 'コンテンツ生成' },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <button
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                      step === s.n
                        ? 'bg-primary text-primary-foreground'
                        : step > s.n
                        ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                        : 'bg-muted text-muted-foreground'
                    )}
                    onClick={() => { if (step > s.n) setStep(s.n as 1 | 2 | 3) }}
                  >
                    <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px] leading-none">
                      {step > s.n ? '✓' : s.n}
                    </span>
                    {s.label}
                  </button>
                </div>
              ))}
            </div>

            {/* ── STEP 1: プロンプト選択 ── */}
            {step === 1 && (
              <div className="space-y-3">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-3 px-4 text-sm text-blue-800">
                    <p className="font-medium mb-0.5">対象プロンプトを選択</p>
                    <p className="text-xs leading-relaxed">
                      選択したプロンプト群の重要要件をAIが横断分析し、複数プロンプトを同時にカバーできる最適なコンテンツを設計します。
                      <strong>勝ち筋プロンプトの選択を推奨します。</strong>
                    </p>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectWinning} className="gap-1 text-xs">
                    ★ 勝ち筋のみ ({winningPrompts.length}件)
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                    全て選択 ({allPrompts.length}件)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
                    クリア
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {selectedPromptIds.size}件選択中
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {allPrompts.map((p) => {
                    const selected = selectedPromptIds.has(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePrompt(p.id)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/40'
                        )}
                      >
                        {selected
                          ? <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        }
                        <span className="flex-1">{p.text}</span>
                        {p.isWinning && (
                          <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 shrink-0">★</Badge>
                        )}
                        {p.displayRate !== undefined && (
                          <Badge variant="outline" className={cn(
                            'text-xs shrink-0',
                            p.displayRate >= 67 ? 'text-green-700' : p.displayRate >= 34 ? 'text-yellow-700' : 'text-slate-500'
                          )}>
                            {Math.round(p.displayRate)}%
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                  {allPrompts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      プロンプトが未登録です。プロンプト管理ページから追加してください。
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleExtractRequirements}
                  disabled={selectedPromptIds.size === 0 || extracting}
                  className="w-full gap-2"
                >
                  {extracting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />重要要件を横断分析中...</>
                    : <><Sparkles className="h-4 w-4" />{selectedPromptIds.size}件のプロンプトを横断分析</>
                  }
                </Button>
              </div>
            )}

            {/* ── STEP 2: 要件横断分析結果 ── */}
            {step === 2 && reqResult && (
              <div className="space-y-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="py-3 px-4 text-sm text-green-800">
                    <p className="font-medium mb-1">横断分析が完了しました</p>
                    <p className="text-xs">
                      {selectedPromptIds.size}件のプロンプトを分析しました。以下の共通要件を満たすコンテンツを作ることで、複数プロンプトへの引用を同時に狙えます。
                    </p>
                  </CardContent>
                </Card>

                {/* 共通要件 */}
                {reqResult.sharedRequirements?.length > 0 && (
                  <Card className="border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-amber-700">
                        複数プロンプトをカバーする共通要件
                      </CardTitle>
                      <CardDescription className="text-xs">
                        これらの要件を満たすコンテンツは複数のプロンプトで同時に引用される可能性が高い
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {reqResult.sharedRequirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* プロンプト別要件 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">プロンプト別の重要要件</p>
                  {reqResult.requirements?.map((r) => {
                    const p = allPrompts.find((x) => x.id === r.promptId)
                    if (!p) return null
                    return (
                      <Card key={r.promptId} className="bg-muted/30">
                        <CardContent className="py-2.5 px-3">
                          <p className="text-xs font-medium mb-1.5 text-muted-foreground line-clamp-1">{p.text}</p>
                          <ul className="space-y-0.5">
                            {r.requirements.slice(0, 3).map((req, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5">
                                <span className="text-muted-foreground shrink-0">·</span>
                                {req}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* コンテンツ種別選択 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">生成するコンテンツの種類を選択</p>
                  <p className="text-xs text-muted-foreground">用途に合わせて選択してください。どこに掲載するかによって最適化の方向が変わります。</p>
                  <div className="grid grid-cols-1 gap-2">
                    {MEDIUMS.map((m) => {
                      const Icon = m.icon
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMedium(m.id)}
                          className={cn(
                            'text-left flex items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors',
                            selectedMedium === m.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/40'
                          )}
                        >
                          <Icon className={cn(
                            'h-4 w-4 shrink-0 mt-0.5',
                            selectedMedium === m.id ? 'text-primary' : 'text-muted-foreground'
                          )} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{m.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 self-center">{m.destination}</Badge>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    戻る
                  </Button>
                  <Button onClick={handleGenerate} disabled={generating} className="flex-1 gap-2">
                    {generating
                      ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</>
                      : <><Sparkles className="h-4 w-4" />{MEDIUMS.find((m) => m.id === selectedMedium)?.label}を生成</>
                    }
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 3: 生成済みコンテンツ ── */}
            {/* ── STEP 3: 生成済みコンテンツ ── */}
            {step === 3 && generatedContent && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{generatedTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {MEDIUMS.find((m) => m.id === selectedMedium)?.label} · {selectedPromptIds.size}件のプロンプトをカバー
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
                      {copied ? <><Check className="h-3.5 w-3.5 text-green-600" />コピー済み</> : <><Copy className="h-3.5 w-3.5" />コピー</>}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setEditBuffer(generatedContent); setEditingContent(true) }} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" />編集
                    </Button>
                  </div>
                </div>

                {editingContent ? (
                  <div className="space-y-2">
                    <Textarea value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} className="min-h-[400px] font-mono text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setGeneratedContent(editBuffer); setEditingContent(false) }} className="gap-1">
                        <Save className="h-3.5 w-3.5" />保存
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingContent(false)} className="gap-1">
                        <X className="h-3.5 w-3.5" />キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-4 px-4">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{generatedContent}</pre>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-3 px-4 text-xs text-blue-800 space-y-1">
                    <p className="font-medium">次のアクション</p>
                    <ul className="space-y-0.5">
                      <li>· <strong>ウェブサイトへの掲載</strong> → 「ウェブサイト改善」ページでHTMLに組み込む</li>
                      <li>· <strong>外部メディアへの掲載打診</strong> → 「メディア・PRアウトリーチ」ページで営業先を探す</li>
                    </ul>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setStep(2); setGeneratedContent(''); setGeneratedTitle('') }} className="gap-1">
                    <RefreshCw className="h-3.5 w-3.5" />別の種類を生成
                  </Button>
                  <Button variant="outline" onClick={() => { setStep(1); setGeneratedContent(''); setReqResult(null) }}>
                    最初からやり直す
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Competitor Analysis Tab ── */}
          <TabsContent value="competitor" className="mt-4">
            <CompetitorAnalysisTab />
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="space-y-3 mt-4">
            {contents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                まだコンテンツが生成されていません。「コンテンツ設計・生成」タブから作成してください。
              </p>
            ) : (
              contents.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {MEDIUMS.find((m) => m.id === c.medium)?.label ?? c.medium} · 生成: {formatDate(c.generatedAt)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={async () => { await navigator.clipboard.writeText(c.content) }} className="gap-1 shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-muted-foreground line-clamp-4">{c.content}</pre>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
