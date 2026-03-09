'use client'

import { useEffect, useState } from 'react'
import {
  Globe,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Code,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getStoreInfo,
  getWebsiteAnalyses,
  addWebsiteAnalysis,
  generateId,
} from '@/lib/storage'
import { WebsiteAnalysis, WebsiteIssue } from '@/types'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Config maps
// ─────────────────────────────────────────────────────────────────────────────

const severityConfig: Record<
  WebsiteIssue['severity'],
  { label: string; badgeClass: string; icon: React.ElementType; order: number }
> = {
  high: {
    label: '重大',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    icon: AlertTriangle,
    order: 0,
  },
  medium: {
    label: '中程度',
    badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    icon: Info,
    order: 1,
  },
  low: {
    label: '軽微',
    badgeClass: 'bg-green-100 text-green-700 border border-green-200',
    icon: CheckCircle2,
    order: 2,
  },
}

const platformConfig: Record<
  WebsiteIssue['platform'],
  { label: string; badgeClass: string }
> = {
  wordpress: {
    label: 'WordPress',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  html: {
    label: 'HTML',
    badgeClass: 'bg-purple-100 text-purple-700 border border-purple-200',
  },
  studio: {
    label: 'Studio',
    badgeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  },
  all: {
    label: '全対応',
    badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently fail
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 gap-1 text-xs shrink-0 text-slate-300 hover:text-white hover:bg-slate-700"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          コピー済み
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          コピー
        </>
      )}
    </Button>
  )
}

function IssueCard({ issue }: { issue: WebsiteIssue }) {
  const [expanded, setExpanded] = useState(false)
  const severity = severityConfig[issue.severity]
  const platform = platformConfig[issue.platform]
  const SeverityIcon = severity.icon

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3 shadow-sm">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            severity.badgeClass
          )}
        >
          <SeverityIcon className="h-3 w-3" />
          {severity.label}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            platform.badgeClass
          )}
        >
          {platform.label}
        </span>
        <span className="text-sm font-semibold text-gray-800">{issue.type}</span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{issue.description}</p>

      {/* Fix code toggle */}
      {issue.fixCode && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Code className="h-3 w-3" />
            修正コードを{expanded ? '閉じる' : '表示する'}
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {expanded && (
            <div className="mt-2 relative rounded-md overflow-hidden">
              <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5">
                <span className="text-xs text-slate-400">修正コード</span>
                <CopyButton code={issue.fixCode} />
              </div>
              <pre className="bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto leading-relaxed">
                <code>{issue.fixCode}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnalysisSummary({ analysis }: { analysis: WebsiteAnalysis }) {
  const counts = {
    high: analysis.issues.filter((i) => i.severity === 'high').length,
    medium: analysis.issues.filter((i) => i.severity === 'medium').length,
    low: analysis.issues.filter((i) => i.severity === 'low').length,
  }

  const summaryItems: Array<{
    key: WebsiteIssue['severity']
    bg: string
    textValue: string
    textLabel: string
  }> = [
    {
      key: 'high',
      bg: 'bg-red-50 border-red-200',
      textValue: 'text-red-600',
      textLabel: 'text-red-700',
    },
    {
      key: 'medium',
      bg: 'bg-yellow-50 border-yellow-200',
      textValue: 'text-yellow-600',
      textLabel: 'text-yellow-700',
    },
    {
      key: 'low',
      bg: 'bg-green-50 border-green-200',
      textValue: 'text-green-600',
      textLabel: 'text-green-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {summaryItems.map(({ key, bg, textValue, textLabel }) => (
        <div
          key={key}
          className={cn('rounded-lg border p-4 text-center', bg)}
        >
          <div className={cn('text-3xl font-bold', textValue)}>
            {counts[key]}
          </div>
          <div className={cn('text-xs mt-1 font-medium', textLabel)}>
            {severityConfig[key].label}な問題
          </div>
        </div>
      ))}
      <div className="rounded-lg border bg-blue-50 border-blue-200 p-4 text-center">
        <div className="text-3xl font-bold text-blue-600">
          {analysis.issues.length}
        </div>
        <div className="text-xs mt-1 font-medium text-blue-700">合計</div>
      </div>
    </div>
  )
}

function AnalysisResults({ analysis }: { analysis: WebsiteAnalysis }) {
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')

  const sorted = [...analysis.issues].sort(
    (a, b) => severityConfig[a.severity].order - severityConfig[b.severity].order
  )

  const filtered = sorted.filter((issue) => {
    const matchSev = filterSeverity === 'all' || issue.severity === filterSeverity
    const matchPlat =
      filterPlatform === 'all' ||
      issue.platform === filterPlatform ||
      issue.platform === 'all'
    return matchSev && matchPlat
  })

  return (
    <div className="space-y-5">
      <AnalysisSummary analysis={analysis} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {analysis.url} — 解析日時:{' '}
            {new Date(analysis.analyzedAt).toLocaleString('ja-JP')}
          </span>
        </div>
        <div className="flex gap-2">
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="重要度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての重要度</SelectItem>
              <SelectItem value="high">重大</SelectItem>
              <SelectItem value="medium">中程度</SelectItem>
              <SelectItem value="low">軽微</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="プラットフォーム" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="wordpress">WordPress</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">
          条件に一致する問題はありません
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            ウェブサイトを解析しています...
          </span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-3/6" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function WebsitePage() {
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<WebsiteAnalysis[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [currentAnalysis, setCurrentAnalysis] = useState<WebsiteAnalysis | null>(null)

  useEffect(() => {
    const saved = getWebsiteAnalyses()
    setAnalyses(saved)
    if (saved.length > 0) {
      const latest = saved[saved.length - 1]
      setSelectedId(latest.id)
      setCurrentAnalysis(latest)
    }

    const info = getStoreInfo()
    if (info?.websiteUrl) setUrl(info.websiteUrl)
  }, [])

  const handleAnalyze = async () => {
    if (!url.trim()) return

    setAnalyzing(true)
    setError(null)
    setCurrentAnalysis(null)

    try {
      const storeInfo = getStoreInfo()
      const storeName = storeInfo?.name ?? ''

      // Step 1: Scrape the website
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!scrapeRes.ok) {
        throw new Error('ウェブサイトのスクレイピングに失敗しました')
      }
      const scrapeResult = await scrapeRes.json()

      // Step 2: Analyze
      const analyzeRes = await fetch('/api/analyze-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          scrapedContent: scrapeResult.content,
          storeName,
        }),
      })
      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => ({}))
        throw new Error(errData.error ?? 'ウェブサイトの解析に失敗しました')
      }
      const data = await analyzeRes.json()

      const analysis: WebsiteAnalysis = {
        id: generateId(),
        url,
        analyzedAt: new Date().toISOString(),
        issues: data.issues ?? [],
      }

      addWebsiteAnalysis(analysis)
      const updated = getWebsiteAnalyses()
      setAnalyses(updated)
      setCurrentAnalysis(analysis)
      setSelectedId(analysis.id)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '解析中に予期しないエラーが発生しました'
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSelectAnalysis = (id: string) => {
    setSelectedId(id)
    const found = analyses.find((a) => a.id === id) ?? null
    setCurrentAnalysis(found)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">ウェブサイト改善</h1>
        <p className="text-muted-foreground text-sm mt-1">
          オウンドメディアのGEO最適化上の問題を診断し、具体的な修正コードを提示します
        </p>
      </div>

      {/* Notice */}
      <Alert className="bg-amber-50 border-amber-200 text-amber-800">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          この機能は自社ウェブサイトの改善に特化しています。食べログ・ぐるなびなどの掲載サイトへの適用はできません。
        </AlertDescription>
      </Alert>

      {/* URL input */}
      <Card>
        <CardHeader>
          <CardTitle>ウェブサイトを解析する</CardTitle>
          <CardDescription>
            URLを入力してAIがGEO最適化の問題点を診断します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="url" className="sr-only">
                ウェブサイトURL
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !analyzing && url.trim()) {
                    handleAnalyze()
                  }
                }}
                disabled={analyzing}
              />
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="shrink-0"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  解析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {analyzing && <LoadingSkeleton />}

      {/* Error */}
      {error && !analyzing && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Past analyses selector */}
      {analyses.length > 0 && !analyzing && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium text-gray-700 shrink-0">
            過去の解析結果:
          </Label>
          <Select value={selectedId} onValueChange={handleSelectAnalysis}>
            <SelectTrigger className="max-w-sm h-8 text-xs">
              <SelectValue placeholder="解析を選択" />
            </SelectTrigger>
            <SelectContent>
              {[...analyses].reverse().map((a) => {
                let hostname = a.url
                try {
                  hostname = new URL(a.url).hostname
                } catch {
                  // keep original
                }
                return (
                  <SelectItem key={a.id} value={a.id}>
                    {hostname} —{' '}
                    {new Date(a.analyzedAt).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Results */}
      {currentAnalysis && !analyzing && (
        <Card>
          <CardHeader>
            <CardTitle>解析結果</CardTitle>
            <CardDescription>
              {currentAnalysis.issues.length} 件の改善項目が見つかりました
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnalysisResults analysis={currentAnalysis} />
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {analyses.length === 0 && !analyzing && !currentAnalysis && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <Globe className="h-12 w-12 text-gray-300" />
            <p className="font-medium text-gray-600">まだ解析結果がありません</p>
            <p className="text-sm text-gray-400">
              上のフォームにURLを入力して「解析」ボタンを押すと、
              <br />
              AIがウェブサイトのGEO最適化上の問題点を診断します
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
