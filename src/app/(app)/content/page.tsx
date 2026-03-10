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
  Plus,
  Trash2,
  BarChart2,
  BookOpen,
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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getStoreInfo,
  getPrompts,
  getGeneratedContents,
  saveGeneratedContents,
  getApiKeys,
  getContentPatterns,
  addContentPattern,
  deleteContentPattern,
  generateId,
} from '@/lib/storage'
import {
  StoreInfo,
  Prompt,
  ContentMedium,
  GeneratedContent,
  ContentPattern,
  ContentPatternType,
} from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ── Existing medium config ─────────────────────────────────────────────────

interface MediumConfig {
  id: ContentMedium
  label: string
  description: string
  businessTypes: string[] | null
}

const ALL_MEDIUMS: MediumConfig[] = [
  { id: 'owned_media_article', label: 'オウンドメディア記事', description: 'GEO最適化されたブログ・技術記事コンテンツ', businessTypes: null },
  { id: 'lp', label: 'LP/サービスページ', description: 'コンバージョン最適化されたランディングページ', businessTypes: null },
  { id: 'whitepaper', label: 'ホワイトペーパー', description: '専門知識・ノウハウを体系化した資料コンテンツ', businessTypes: null },
  { id: 'press_release', label: 'プレスリリース', description: 'PR TIMES等向けの発表文・ニュースリリース', businessTypes: null },
  { id: 'case_study', label: '事例記事', description: '導入事例・成果事例のGEO最適化コンテンツ', businessTypes: null },
  { id: 'column', label: 'コラム/専門記事', description: '業界知見・専門コラムのGEO最適化コンテンツ', businessTypes: null },
]

// ── Pattern type config ────────────────────────────────────────────────────

interface PatternTypeConfig {
  id: ContentPatternType
  label: string
  description: string
  placeholder: string
}

const PATTERN_TYPES: PatternTypeConfig[] = [
  {
    id: 'owned_media_article',
    label: 'オウンドメディア記事',
    description: 'SEO・GEO最適化されたブログ記事のパターン分析',
    placeholder: '競合のオウンドメディア記事URLを入力...',
  },
  {
    id: 'lp',
    label: 'LPページ改稿',
    description: 'コンバージョン最適化されたLPのパターン分析',
    placeholder: '競合LPのURLを入力...',
  },
  {
    id: 'whitepaper',
    label: 'ホワイトペーパー',
    description: 'B2B向けホワイトペーパーの構成パターン分析',
    placeholder: '競合ホワイトペーパーのURLを入力...',
  },
  {
    id: 'note',
    label: 'note',
    description: 'note記事の構成・GEO最適化パターン分析',
    placeholder: '競合note記事のURLを入力...',
  },
  {
    id: 'press_release',
    label: 'プレスリリース',
    description: 'メディア掲載されやすいプレスリリースのパターン分析',
    placeholder: '競合プレスリリースのURLを入力...',
  },
]

// ── Pattern Analysis Tab ───────────────────────────────────────────────────

function PatternAnalysisTab({ typeConfig }: { typeConfig: PatternTypeConfig }) {
  const [urls, setUrls] = useState<string[]>(['', '', ''])
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [patterns, setPatterns] = useState<ContentPattern[]>([])
  const [patternName, setPatternName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [copiedPattern, setCopiedPattern] = useState<string | null>(null)

  useEffect(() => {
    setPatterns(getContentPatterns().filter((p) => p.type === typeConfig.id))
  }, [typeConfig.id])

  const handleAddUrl = () => setUrls((prev) => [...prev, ''])
  const handleRemoveUrl = (idx: number) => setUrls((prev) => prev.filter((_, i) => i !== idx))
  const handleUrlChange = (idx: number, value: string) => {
    setUrls((prev) => prev.map((u, i) => (i === idx ? value : u)))
  }

  const handleAnalyze = async () => {
    const apiKeys = getApiKeys()
    if (!apiKeys.anthropic) {
      alert('Anthropic APIキーが必要です（設定から入力してください）')
      return
    }
    const validUrls = urls.filter((u) => u.trim())
    if (validUrls.length === 0) {
      setError('URLを1件以上入力してください')
      return
    }

    setAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      // Scrape each URL in sequence
      const scrapedContents: string[] = []
      for (const url of validUrls) {
        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
          if (res.ok) {
            const data = await res.json()
            scrapedContents.push(`URL: ${url}\n\n${data.content ?? data.html ?? ''}`)
          }
        } catch {
          // skip failed URLs
        }
      }

      if (scrapedContents.length === 0) {
        throw new Error('URLのスクレイピングに失敗しました')
      }

      // AI analysis
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `以下の${validUrls.length}件の競合コンテンツを分析して、「${typeConfig.label}」の推奨パターンを提示してください。

GEO（Generative Engine Optimization）観点での分析を行い、以下の形式で出力してください：

## 分析した競合コンテンツの特徴

### 共通パターン
（複数コンテンツに共通する構成・要素）

### GEO最適化の傾向
（AIが引用しやすい要素・構造）

## 推奨コンテンツパターン

### 構成テンプレート
（具体的な見出し構成を提示）

### 必須要素チェックリスト
（含めるべき要素をリストアップ）

### GEO最適化ポイント
（AIに引用されやすくするための具体的なTips）

---

競合コンテンツ:
${scrapedContents.join('\n\n---\n\n').substring(0, 15000)}`,
            },
          ],
          systemPrompt: 'あなたはGEO（Generative Engine Optimization）とコンテンツマーケティングの専門家です。競合分析を行い、実践的なコンテンツパターンを提示してください。',
          apiKey: apiKeys.anthropic,
        }),
      })

      if (!res.ok) throw new Error('AI分析に失敗しました')
      const data = await res.json()
      setAnalysisResult(data.content ?? data.message ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSavePattern = () => {
    if (!analysisResult || !patternName.trim()) return
    const newPattern: ContentPattern = {
      id: generateId(),
      type: typeConfig.id,
      name: patternName.trim(),
      pattern: analysisResult,
      savedAt: new Date().toISOString(),
    }
    addContentPattern(newPattern)
    setPatterns((prev) => [...prev, newPattern])
    setPatternName('')
    setShowSaveForm(false)
  }

  const handleDeletePattern = (id: string) => {
    deleteContentPattern(id)
    setPatterns((prev) => prev.filter((p) => p.id !== id))
  }

  const handleCopyPattern = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPattern(id)
      setTimeout(() => setCopiedPattern(null), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Competitor URL inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{typeConfig.label} — 競合分析</CardTitle>
          <CardDescription>{typeConfig.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-sm font-medium">競合URL（複数入力可）</Label>
          {urls.map((url, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                type="url"
                placeholder={typeConfig.placeholder}
                value={url}
                onChange={(e) => handleUrlChange(idx, e.target.value)}
                className="text-sm"
              />
              {urls.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveUrl(idx)}
                  className="shrink-0 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleAddUrl} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            URLを追加
          </Button>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
            {analyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />分析中...</>
            ) : (
              <><BarChart2 className="h-4 w-4 mr-2" />競合分析 → 推奨パターン生成</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis result */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">推奨パターン</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyPattern('result', analysisResult)}
                >
                  {copiedPattern === 'result' ? (
                    <><Check className="h-3.5 w-3.5 mr-1 text-green-600" />コピー済み</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" />コピー</>
                  )}
                </Button>
                <Button size="sm" onClick={() => setShowSaveForm(true)}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  テンプレート保存
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showSaveForm && (
              <div className="flex gap-2">
                <Input
                  placeholder="テンプレート名"
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSavePattern} disabled={!patternName.trim()}>
                  保存
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSaveForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="rounded-lg border bg-muted/30 p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {analysisResult}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved patterns */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              保存済みテンプレート
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {patterns.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(p.savedAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleCopyPattern(p.id, p.pattern)}
                    >
                      {copiedPattern === p.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleDeletePattern(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <pre className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {p.pattern.substring(0, 200)}...
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('text-sm font-medium', className)}>{children}</label>
}

export default function ContentPage() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [generating, setGenerating] = useState<ContentMedium | null>(null)
  const [activeMedium, setActiveMedium] = useState<ContentMedium>('owned_media_article')
  const [activeMainTab, setActiveMainTab] = useState<'generate' | 'pattern' | 'competitor'>('generate')

  // Competitor analysis state
  const [competitorAnalyzing, setCompetitorAnalyzing] = useState(false)
  const [competitorReport, setCompetitorReport] = useState<CompetitorBlogReportType | null>(null)
  const [competitorError, setCompetitorError] = useState<string | null>(null)

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    setStore(getStoreInfo())
    setPrompts(getPrompts())
    setContents(getGeneratedContents())
  }, [])

  const apiKeys = getApiKeys()

  function isMediumRelevant(medium: MediumConfig): boolean {
    if (!medium.businessTypes) return true
    if (!store) return false
    return medium.businessTypes.includes(store.businessType)
  }

  function getContent(medium: ContentMedium): GeneratedContent | undefined {
    return contents.find((c) => c.medium === medium)
  }

  const handleGenerate = async (medium: ContentMedium) => {
    if (!store) {
      alert('企業情報が設定されていません。先に初期設定を完了してください。')
      return
    }
    if (!apiKeys.anthropic) {
      alert('Anthropic APIキーが必要です（設定から入力してください）')
      return
    }

    setGenerating(medium)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, prompts, medium, apiKey: apiKeys.anthropic }),
      })
      const data = await res.json()
      if (data.error) {
        alert('生成に失敗しました: ' + data.error)
        return
      }
      const newContent = data.content as GeneratedContent
      const updated = [...contents.filter((c) => c.medium !== medium), newContent]
      saveGeneratedContents(updated)
      setContents(updated)
    } catch {
      alert('コンテンツ生成中にエラーが発生しました。もう一度お試しください。')
    } finally {
      setGenerating(null)
    }
  }

  const handleStartEdit = (content: GeneratedContent) => {
    setEditingId(content.id)
    setEditTitle(content.title)
    setEditContent(content.content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  const handleSaveEdit = (contentId: string) => {
    const updated = contents.map((c) =>
      c.id === contentId
        ? { ...c, title: editTitle.trim() || c.title, content: editContent, editedAt: new Date().toISOString() }
        : c
    )
    saveGeneratedContents(updated)
    setContents(updated)
    setEditingId(null)
  }

  const handleCopy = async (contentId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(contentId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert('クリップボードへのコピーに失敗しました')
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">コンテンツ制作</h1>
          <p className="text-muted-foreground text-sm mt-1">
            GEO最適化されたコンテンツを各媒体向けに自動生成・パターン分析します
          </p>
        </div>

        {/* Main tabs */}
        <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'generate' | 'pattern' | 'competitor')}>
          <TabsList>
            <TabsTrigger value="generate" className="gap-1.5">
              <FileText className="h-4 w-4" />
              コンテンツ生成
            </TabsTrigger>
            <TabsTrigger value="pattern" className="gap-1.5">
              <BarChart2 className="h-4 w-4" />
              コンテンツパターン化
            </TabsTrigger>
            <TabsTrigger value="competitor" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              競合ブログ分析
            </TabsTrigger>
          </TabsList>

          {/* ── Generate tab ── */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3 px-4">
                <div className="flex gap-3">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-0.5">コンテンツ設計について</p>
                    <p className="text-xs leading-relaxed">
                      勝ち筋プロンプトに対してAIが「AIがこのプロンプトで回答する際の重要要件」を抽出し、
                      各媒体に最適化されたGEOコンテンツを生成します。業態に合った媒体タブを選んで生成してください。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeMedium} onValueChange={(v) => setActiveMedium(v as ContentMedium)}>
              <TabsList className="flex-wrap h-auto gap-1 p-1">
                {ALL_MEDIUMS.map((m) => {
                  const relevant = isMediumRelevant(m)
                  const hasContent = !!getContent(m.id)
                  return (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <TabsTrigger value={m.id} className={cn('text-xs gap-1.5', !relevant && 'opacity-50')}>
                          {m.label}
                          {hasContent && <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />}
                          {!relevant && <span className="h-1.5 w-1.5 rounded-full bg-gray-300 inline-block" />}
                        </TabsTrigger>
                      </TooltipTrigger>
                      {!relevant && (
                        <TooltipContent side="bottom" className="text-xs">
                          この媒体はご利用の業態では非推奨です
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </TabsList>

              {ALL_MEDIUMS.map((medium) => {
                const content = getContent(medium.id)
                const isGenerating = generating === medium.id
                const relevant = isMediumRelevant(medium)
                const isEditing = editingId === content?.id

                return (
                  <TabsContent key={medium.id} value={medium.id} className="space-y-4 mt-4">
                    {!relevant && (
                      <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="py-3 px-4">
                          <div className="flex gap-2 text-sm text-amber-800">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>
                              <span className="font-medium">{medium.label}</span>
                              は現在の業態（{store?.businessType ?? '未設定'}）では推奨されていませんが、生成は可能です。
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="flex items-center gap-2">
                              {medium.label}
                              {!relevant && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-700 border-amber-300 bg-amber-50">
                                  非推奨媒体
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="mt-1">{medium.description}</CardDescription>
                          </div>
                          <Button
                            onClick={() => handleGenerate(medium.id)}
                            disabled={!!generating}
                            variant={content ? 'outline' : 'default'}
                            className="shrink-0"
                          >
                            {isGenerating ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />生成中...</>
                            ) : content ? (
                              <><RefreshCw className="h-4 w-4 mr-2" />再生成</>
                            ) : (
                              <><FileText className="h-4 w-4 mr-2" />コンテンツ生成</>
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent>
                        {!content && !isGenerating && (
                          <div className="text-center py-14 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-25" />
                            <p className="text-sm font-medium">コンテンツが未生成です</p>
                            <p className="text-xs mt-1 opacity-75">
                              「コンテンツ生成」ボタンで{medium.label}向けの
                              <br />GEO最適化コンテンツを自動生成します
                            </p>
                          </div>
                        )}

                        {isGenerating && (
                          <div className="flex items-center justify-center py-14">
                            <div className="text-center space-y-3">
                              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                              <p className="text-sm text-muted-foreground">{medium.label}向けコンテンツを生成中...</p>
                              <p className="text-xs text-muted-foreground opacity-75">
                                勝ち筋プロンプトを分析してコンテンツを最適化しています
                              </p>
                            </div>
                          </div>
                        )}

                        {content && !isGenerating && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              {isEditing ? (
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder="タイトルを入力"
                                  className="font-semibold text-base h-9"
                                />
                              ) : (
                                <div className="flex items-center gap-2 min-w-0">
                                  <h3 className="font-semibold truncate">{content.title}</h3>
                                  {content.editedAt && (
                                    <Badge variant="secondary" className="text-xs shrink-0">編集済み</Badge>
                                  )}
                                </div>
                              )}

                              {isEditing ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button size="sm" onClick={() => handleSaveEdit(content.id)}>
                                    <Save className="h-3.5 w-3.5 mr-1" />保存
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                    <X className="h-3.5 w-3.5 mr-1" />キャンセル
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button variant="ghost" size="sm" onClick={() => handleStartEdit(content)}>
                                    <Pencil className="h-3.5 w-3.5 mr-1" />編集
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleCopy(content.id, content.content)}>
                                    {copiedId === content.id ? (
                                      <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /><span className="text-green-600">コピー済み</span></>
                                    ) : (
                                      <><Copy className="h-3.5 w-3.5 mr-1" />コピー</>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>

                            <Separator />

                            {isEditing ? (
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={22}
                                className="font-mono text-sm resize-y"
                                placeholder="コンテンツを入力してください..."
                              />
                            ) : (
                              <div className="rounded-lg border bg-muted/30 p-4">
                                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{content.content}</pre>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                              <span>
                                生成日時: {formatDate(content.generatedAt)}
                                {content.editedAt && ` / 編集日時: ${formatDate(content.editedAt)}`}
                              </span>
                              {content.promptIds.length > 0 && (
                                <span>{content.promptIds.length}件のプロンプトを使用</span>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                )
              })}
            </Tabs>
          </TabsContent>

          {/* ── Competitor Blog Analysis tab ── */}
          <TabsContent value="competitor" className="space-y-4 mt-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3 px-4">
                <div className="flex gap-3">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-0.5">競合ブログ分析とは</p>
                    <p className="text-xs leading-relaxed">
                      競合企業のサイトをエージェンティックに分析し、どのコンテンツ形式（記事/LP/ホワイトペーパー等）がGEO観点で最も有効かを自動提案します。
                      空白地帯を特定して「勝てるコンテンツ戦略」を即座に把握できます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {store && store.competitors && store.competitors.length > 0 ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">競合企業（登録済み）</CardTitle>
                    <CardDescription className="text-xs">
                      設定済みの競合企業 {store.competitors.length} 社を分析します
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {store.competitors.map((c) => (
                        <Badge key={c.id} variant="secondary" className="text-xs">
                          {c.name} {c.url ? `(${c.url})` : ''}
                        </Badge>
                      ))}
                    </div>

                    {competitorError && (
                      <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                        {competitorError}
                      </div>
                    )}

                    <Button
                      onClick={async () => {
                        if (!apiKeys.anthropic) {
                          setCompetitorError('Anthropic APIキーが必要です（設定から入力してください）')
                          return
                        }
                        setCompetitorAnalyzing(true)
                        setCompetitorError(null)
                        setCompetitorReport(null)
                        try {
                          const res = await fetch('/api/analyze-competitor-blogs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              competitors: store.competitors,
                              companyName: store.name,
                              industry: store.businessType,
                              targetPrompts: prompts.filter((p) => p.isWinning).map((p) => p.text),
                              apiKey: apiKeys.anthropic,
                            }),
                          })
                          const data = await res.json()
                          if (data.error) {
                            setCompetitorError(data.error)
                            return
                          }
                          setCompetitorReport(data)
                        } catch {
                          setCompetitorError('分析中にエラーが発生しました')
                        } finally {
                          setCompetitorAnalyzing(false)
                        }
                      }}
                      disabled={competitorAnalyzing}
                      className="w-full"
                    >
                      {competitorAnalyzing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />競合ブログを分析中...</>
                      ) : (
                        <><BarChart2 className="h-4 w-4 mr-2" />競合ブログを分析して最適コンテンツ形式を提案</>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {competitorReport && (
                  <div className="space-y-4">
                    {/* Overall recommendation */}
                    <Card className="border-green-300 bg-green-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-green-800">総合推奨コンテンツ戦略</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-green-700">最推奨コンテンツタイプ</p>
                          <p className="text-lg font-bold text-green-900">{competitorReport.overallRecommendation.topContentType}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-700">なぜ有効か</p>
                          <p className="text-sm text-green-800">{competitorReport.overallRecommendation.whyItWins}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-700">すぐできるQuick Wins</p>
                          <ul className="list-disc list-inside space-y-1">
                            {competitorReport.overallRecommendation.quickWins.map((w, i) => (
                              <li key={i} className="text-sm text-green-800">{w}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-700">コンテンツカレンダー提案</p>
                          <p className="text-sm text-green-800">{competitorReport.overallRecommendation.contentCalendarSuggestion}</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Per-competitor analysis */}
                    {competitorReport.analyses.map((analysis, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{analysis.competitorName}</CardTitle>
                          <CardDescription className="text-xs">{analysis.blogUrl}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-1 gap-2">
                            {analysis.contentTypes.map((ct, i) => (
                              <div key={i} className="rounded-md border px-3 py-2 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{ct.label}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-xs ${ct.frequency === 'high' ? 'border-red-300 text-red-700' : ct.frequency === 'medium' ? 'border-yellow-300 text-yellow-700' : 'border-slate-300 text-slate-500'}`}>
                                      頻度: {ct.frequency === 'high' ? '高' : ct.frequency === 'medium' ? '中' : '低'}
                                    </Badge>
                                    <Badge variant="outline" className={`text-xs ${ct.geoScore >= 70 ? 'border-green-300 text-green-700' : ct.geoScore >= 40 ? 'border-yellow-300 text-yellow-700' : 'border-slate-300 text-slate-500'}`}>
                                      GEO: {ct.geoScore}点
                                    </Badge>
                                  </div>
                                </div>
                                {ct.topicPatterns.length > 0 && (
                                  <p className="text-muted-foreground">トピック: {ct.topicPatterns.join(' / ')}</p>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 space-y-1">
                            <p className="text-xs font-semibold text-blue-700">推奨戦略: {analysis.recommendedStrategy.primaryType}</p>
                            <p className="text-xs text-blue-600">{analysis.recommendedStrategy.reasoning}</p>
                            {analysis.recommendedStrategy.suggestedTopics.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {analysis.recommendedStrategy.suggestedTopics.map((t, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p>競合企業が登録されていません</p>
                  <p className="text-xs mt-1">設定画面から競合企業のURLを登録してください</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Pattern tab ── */}
          <TabsContent value="pattern" className="space-y-4 mt-4">
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="py-3 px-4">
                <div className="flex gap-3">
                  <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-purple-800">
                    <p className="font-medium mb-0.5">コンテンツパターン化とは</p>
                    <p className="text-xs leading-relaxed">
                      競合コンテンツのURLを複数入力すると、Firecrawlでスクレイプしてページ内容を取得し、
                      AIが共通パターン・GEO最適化ポイントを分析して「推奨テンプレート」を提示します。
                      保存したテンプレートはいつでも呼び出せます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue={PATTERN_TYPES[0].id}>
              <TabsList className="flex-wrap h-auto gap-1 p-1">
                {PATTERN_TYPES.map((pt) => (
                  <TabsTrigger key={pt.id} value={pt.id} className="text-xs">
                    {pt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {PATTERN_TYPES.map((pt) => (
                <TabsContent key={pt.id} value={pt.id}>
                  <PatternAnalysisTab typeConfig={pt} />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
