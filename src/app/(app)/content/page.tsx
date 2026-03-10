'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, Copy, Check, RefreshCw, FileText, Pencil, Save, X,
  ChevronRight, Sparkles, Megaphone, BookOpen, BarChart2,
  CheckSquare, Zap, ArrowRight, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import {
  getGeneratedContents, saveGeneratedContents,
  getApiKeys, generateId,
} from '@/lib/storage'
import { getStoreFromDB, getPromptsFromDB } from '@/lib/db'
import { useCompany } from '@/context/company-context'
import { StoreInfo, Prompt, GeneratedContent } from '@/types'
import type { ContentSuggestion } from '@/app/api/suggest-contents/route'
import type { CompetitorBlogReport as CompetitorBlogReportType } from '@/app/api/analyze-competitor-blogs/route'

// ── Icons per content type ─────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  owned_media_article: FileText,
  press_release: Megaphone,
  case_study: CheckSquare,
  column: BookOpen,
  misinformation_correction: AlertTriangle,
}

const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
}
const IMPACT_LABELS: Record<string, string> = {
  high: '効果大',
  medium: '効果中',
  low: '効果小',
}

// ── Competitor Analysis ────────────────────────────────────────────────────

function CompetitorAnalysisTab() {
  const { companyId } = useCompany()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [report, setReport] = useState<CompetitorBlogReportType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStoreFromDB(companyId).then(setStore).catch(() => {})
  }, [companyId])

  const handleAnalyze = async () => {
    const apiKeys = getApiKeys()
    if (!store) return
    const competitors = store.competitors || []
    if (competitors.length === 0) {
      setError('競合企業が未登録です。設定ページで競合企業URLを登録してください。')
      return
    }
    setAnalyzing(true); setError(null)
    try {
      const res = await fetch('/api/analyze-competitor-blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: store.name,
              brandName: store.brandName || '',
          competitors: competitors.map((c) => ({ name: c.name, url: c.url })),
          clientApiKey: apiKeys.anthropic,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setReport(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="py-3 px-4 text-sm text-orange-800">
          競合企業のサイトを自動クロールし、AIが引用しやすいコンテンツ形式・GEOスコアを分析します。
        </CardContent>
      </Card>
      <div className="flex gap-3 items-center">
        <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
          {analyzing ? '分析中...' : '競合コンテンツを自動分析'}
        </Button>
        {store && store.competitors.length > 0 && (
          <span className="text-sm text-muted-foreground">{store.competitors.length}社を分析対象</span>
        )}
      </div>
      {error && <Card className="border-red-200 bg-red-50"><CardContent className="py-3 px-4 text-sm text-red-700">{error}</CardContent></Card>}
      {report && (
        <div className="space-y-4">
          {report.analyses.map((a, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{a.competitorName}</CardTitle>
                <CardDescription className="text-xs">{a.blogUrl}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
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
              <p><strong>勝ちコンテンツ:</strong> {report.overallRecommendation.topContentType}</p>
              <p className="text-muted-foreground">{report.overallRecommendation.whyItWins}</p>
              {report.overallRecommendation.quickWins.length > 0 && (
                <ul className="space-y-0.5">
                  {report.overallRecommendation.quickWins.map((w, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />{w}
                    </li>
                  ))}
                </ul>
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
  const { companyId } = useCompany()
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [apiKey, setApiKey] = useState('')

  // Suggestion state
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([])
  const [suggestError, setSuggestError] = useState<string | null>(null)

  // Generation state
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [generatedMap, setGeneratedMap] = useState<Record<string, { title: string; content: string }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBuffer, setEditBuffer] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    getStoreFromDB(companyId).then(setStore).catch(() => {})
    getPromptsFromDB(companyId).then(setPrompts).catch(() => {})
    setContents(getGeneratedContents())
    setApiKey(getApiKeys().anthropic || '')
  }, [companyId])

  const winningPrompts = prompts.filter((p) => p.isWinning)
  const targetPrompts = winningPrompts.length > 0 ? winningPrompts : prompts

  // ── Suggest ──────────────────────────────────────────────────────────────

  const handleSuggest = async () => {
    if (!store) return
    setSuggesting(true)
    setSuggestError(null)
    setSuggestions([])
    try {
      const res = await fetch('/api/suggest-contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, prompts: targetPrompts, clientApiKey: apiKey }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch (e) {
      setSuggestError((e as Error).message)
    } finally {
      setSuggesting(false)
    }
  }

  // ── Generate one content ─────────────────────────────────────────────────

  const handleGenerate = async (s: ContentSuggestion) => {
    if (!store) return
    setGeneratingId(s.id)

    try {
      const coveredPrompts = targetPrompts.filter((p) => s.coveredPromptIds.includes(p.id))

      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store,
          prompts: coveredPrompts,
          medium: s.type,
          requirements: s.keyRequirements,
          suggestedTitle: s.title,
          angle: s.angle,
          clientApiKey: apiKey,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      setGeneratedMap((prev) => ({
        ...prev,
        [s.id]: { title: data.title || s.title, content: data.content || '' },
      }))

      // Save to history
      const newContent: GeneratedContent = {
        id: generateId(),
        medium: s.type as GeneratedContent['medium'],
        title: data.title || s.title,
        content: data.content || '',
        promptIds: coveredPrompts.map((p) => p.id),
        generatedAt: new Date().toISOString(),
        editedAt: null,
      }
      const updated = [newContent, ...contents]
      saveGeneratedContents(updated)
      setContents(updated)
    } catch (e) {
      alert('生成に失敗しました: ' + (e as Error).message)
    } finally {
      setGeneratingId(null)
    }
  }

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!store) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        企業情報が設定されていません。先に初期設定を完了してください。
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">コンテンツ設計・制作</h1>
        <p className="text-muted-foreground text-sm mt-1">
          勝ち筋プロンプト{targetPrompts.length}件をもとにAIが最適なコンテンツポートフォリオを提案します
        </p>
      </div>

      <Tabs defaultValue="suggest">
        <TabsList>
          <TabsTrigger value="suggest" className="gap-1.5">
            <Sparkles className="h-4 w-4" />コンテンツ提案・生成
          </TabsTrigger>
          <TabsTrigger value="competitor" className="gap-1.5">
            <BarChart2 className="h-4 w-4" />競合コンテンツ分析
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <FileText className="h-4 w-4" />生成履歴
          </TabsTrigger>
        </TabsList>

        {/* ── Suggest Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="suggest" className="space-y-4 mt-4">

          {/* Info + Trigger */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-3 px-4 text-sm text-blue-800">
              <p className="font-medium mb-1">Claude Opusがコンテンツポートフォリオを設計します</p>
              <p className="text-xs leading-relaxed">
                勝ち筋プロンプト全件を分析し「複数プロンプトを同時カバーする記事」と「高表示率プロンプトに特化した記事」を最適な比率で提案します。
                あとはワンクリックで生成するだけです。
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={handleSuggest} disabled={suggesting} className="gap-2">
              {suggesting
                ? <><Loader2 className="h-4 w-4 animate-spin" />Opusが分析中...</>
                : <><Sparkles className="h-4 w-4" />コンテンツポートフォリオを提案</>
              }
            </Button>
            {suggestions.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSuggest} disabled={suggesting} className="gap-1 text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />再提案
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              勝ち筋 {targetPrompts.length}件を対象
            </span>
          </div>

          {suggestError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-3 px-4 text-sm text-red-700">{suggestError}</CardContent>
            </Card>
          )}

          {/* Suggestion cards */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                {suggestions.length}件のコンテンツを提案しました。ワンクリックで生成できます。
              </p>

              {suggestions.map((s) => {
                const Icon = TYPE_ICONS[s.type] ?? FileText
                const generated = generatedMap[s.id]
                const isGenerating = generatingId === s.id

                return (
                  <Card key={s.id} className={cn(
                    'transition-colors',
                    generated ? 'border-green-300 bg-green-50/30' : ''
                  )}>
                    <CardContent className="py-4 px-4 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{s.typeLabel}</Badge>
                            <Badge className={cn('text-xs border', IMPACT_COLORS[s.estimatedImpact])}>
                              {IMPACT_LABELS[s.estimatedImpact]}
                            </Badge>
                            <Badge variant="outline" className={cn(
                              'text-xs',
                              s.coverageType === 'multi' ? 'text-blue-700 border-blue-200' : 'text-purple-700 border-purple-200'
                            )}>
                              {s.coverageType === 'multi'
                                ? `${s.coveredPromptIds.length}プロンプトを同時カバー`
                                : '単独プロンプト特化'}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm">{s.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.angle}</p>
                        </div>
                      </div>

                      {/* Why now */}
                      <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                        <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{s.whyNow}</p>
                      </div>

                      {/* Covered prompts */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">対象プロンプト（このコンテンツで表示率を上げる）</p>
                        <div className="flex flex-col gap-1">
                          {s.coveredPromptTexts.slice(0, 3).map((t, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-xs text-primary shrink-0 mt-0.5">▶</span>
                              <span className="text-xs text-foreground/80 leading-relaxed">{t}</span>
                            </div>
                          ))}
                          {s.coveredPromptTexts.length > 3 && (
                            <span className="text-xs text-muted-foreground pl-4">+{s.coveredPromptTexts.length - 3}件</span>
                          )}
                        </div>
                      </div>

                      {/* Key requirements */}
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-muted-foreground">必ず含める内容</p>
                        <ul className="space-y-0.5">
                          {s.keyRequirements.slice(0, 3).map((r, i) => (
                            <li key={i} className="text-xs flex items-start gap-1.5">
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />{r}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action */}
                      {generated ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">生成完了: {generated.title}</span>
                            <div className="ml-auto flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleCopy(s.id, generated.content)} className="gap-1">
                                {copiedId === s.id ? <><Check className="h-3.5 w-3.5 text-green-600" />コピー済み</> : <><Copy className="h-3.5 w-3.5" />コピー</>}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setEditBuffer(generated.content); setEditingId(s.id) }} className="gap-1">
                                <Pencil className="h-3.5 w-3.5" />編集
                              </Button>
                            </div>
                          </div>

                          {editingId === s.id ? (
                            <div className="space-y-2">
                              <Textarea value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} className="min-h-[300px] font-mono text-sm" />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => {
                                  setGeneratedMap((prev) => ({ ...prev, [s.id]: { ...prev[s.id], content: editBuffer } }))
                                  setEditingId(null)
                                }} className="gap-1"><Save className="h-3.5 w-3.5" />保存</Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="gap-1"><X className="h-3.5 w-3.5" />キャンセル</Button>
                              </div>
                            </div>
                          ) : (
                            <Card className="bg-muted/30">
                              <CardContent className="py-3 px-3">
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans line-clamp-6">{generated.content}</pre>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      ) : (
                        <Button onClick={() => handleGenerate(s)} disabled={isGenerating || !!generatingId} className="w-full gap-2">
                          {isGenerating
                            ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</>
                            : <><Sparkles className="h-4 w-4" />{s.typeLabel}を生成</>
                          }
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              {/* All generated navigation */}
              {Object.keys(generatedMap).length > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-3 px-4 text-xs text-blue-800 space-y-1">
                    <p className="font-medium">生成したコンテンツを使う</p>
                    <div className="flex gap-3 mt-1">
                      <Button variant="outline" size="sm" asChild className="text-xs gap-1">
                        <Link href="/website"><ArrowRight className="h-3.5 w-3.5" />ウェブサイト改善</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="text-xs gap-1">
                        <Link href="/outreach"><ArrowRight className="h-3.5 w-3.5" />外部メディア掲載打診</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
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
              まだコンテンツが生成されていません。「コンテンツ提案・生成」タブから作成してください。
            </p>
          ) : (
            contents.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-sm">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.medium} · 生成: {formatDate(c.generatedAt)}
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
  )
}
