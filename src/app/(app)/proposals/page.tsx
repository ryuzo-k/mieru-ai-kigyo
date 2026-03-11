'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check, Download, ExternalLink, Loader2, Presentation, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCompany } from '@/context/company-context'
import { getStoreFromDB, getApiKeysFromDB, getProposalsFromDB, saveProposalToDB, deleteProposalFromDB, getGoogleTokenFromDB } from '@/lib/db'
import { generateId } from '@/lib/storage'
import type { ProposalSlide } from '@/app/api/generate-proposal/route'
import type { ProposalRecord } from '@/lib/db'

type LoadingStep = null | 'scraping' | 'analyzing' | 'generating'

const LOADING_MESSAGES: Record<NonNullable<LoadingStep>, string> = {
  scraping: 'スクレイピング中...',
  analyzing: '分析中...',
  generating: '資料生成中...',
}

export default function ProposalsPage() {
  const { companyId } = useCompany()

  const [targetCompanyUrl, setTargetCompanyUrl] = useState('')
  const [targetCompanyName, setTargetCompanyName] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null)
  const [error, setError] = useState('')

  const [proposals, setProposals] = useState<ProposalRecord[]>([])
  const [activeProposal, setActiveProposal] = useState<ProposalRecord | null>(null)
  const [expandedSlides, setExpandedSlides] = useState<Record<number, boolean>>({})
  const [copiedSlide, setCopiedSlide] = useState<number | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [exportingSlides, setExportingSlides] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    getProposalsFromDB(companyId).then(setProposals)
    getGoogleTokenFromDB(companyId).then(({ accessToken }) => {
      setGoogleConnected(!!accessToken)
    }).catch(() => {})
  }, [companyId])

  async function handleGenerate() {
    if (!targetCompanyName.trim()) {
      setError('ターゲット企業名を入力してください')
      return
    }

    setError('')
    setLoadingStep('scraping')

    try {
      const [store, apiKeys] = await Promise.all([
        getStoreFromDB(companyId),
        getApiKeysFromDB(companyId),
      ])

      if (!store) {
        setError('企業情報が設定されていません。設定画面から入力してください。')
        setLoadingStep(null)
        return
      }

      setTimeout(() => setLoadingStep('analyzing'), 3000)
      setTimeout(() => setLoadingStep('generating'), 7000)

      const res = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCompanyUrl: targetCompanyUrl.trim(),
          targetCompanyName: targetCompanyName.trim(),
          ourCompanyInfo: store,
          meetingNotes: meetingNotes.trim() || undefined,
          clientApiKey: apiKeys.anthropic || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || '生成に失敗しました')
        setLoadingStep(null)
        return
      }

      const newProposal: ProposalRecord = {
        id: generateId(),
        companyId,
        targetCompanyName: targetCompanyName.trim(),
        targetCompanyUrl: targetCompanyUrl.trim() || undefined,
        meetingNotes: meetingNotes.trim() || undefined,
        slides: data.proposal,
        createdAt: new Date().toISOString(),
      }

      await saveProposalToDB(newProposal)
      const updated = await getProposalsFromDB(companyId)
      setProposals(updated)
      setActiveProposal(newProposal)
      setExpandedSlides({})
      setTargetCompanyUrl('')
      setTargetCompanyName('')
      setMeetingNotes('')
    } catch (err) {
      setError('生成に失敗しました: ' + (err as Error).message)
    } finally {
      setLoadingStep(null)
    }
  }

  async function handleDelete(id: string) {
    await deleteProposalFromDB(id)
    const updated = await getProposalsFromDB(companyId)
    setProposals(updated)
    if (activeProposal?.id === id) setActiveProposal(null)
  }

  function toggleSlide(slideNumber: number) {
    setExpandedSlides((prev) => ({ ...prev, [slideNumber]: !prev[slideNumber] }))
  }

  function copySlide(slide: ProposalSlide) {
    const text = `# スライド${slide.slideNumber}: ${slide.title}\n\n${slide.content}\n\n## トークスクリプト\n${slide.talkingPoints.map((p) => `- ${p}`).join('\n')}\n\n## 詳細メモ\n${slide.speakerNotes}`
    navigator.clipboard.writeText(text)
    setCopiedSlide(slide.slideNumber)
    setTimeout(() => setCopiedSlide(null), 2000)
  }

  function downloadMarkdown(proposal: ProposalRecord) {
    const slides = proposal.slides as ProposalSlide[]
    const md = slides.map((s) =>
      `## スライド${s.slideNumber}: ${s.title}\n\n${s.content}\n\n### トークポイント\n${s.talkingPoints.map((p) => `- ${p}`).join('\n')}\n\n### スピーカーノート\n${s.speakerNotes}`
    ).join('\n\n---\n\n')
    const blob = new Blob([`# ${proposal.targetCompanyName} 様 提案書\n\n${md}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proposal_${proposal.targetCompanyName}_${proposal.createdAt.substring(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportToSlides() {
    if (!activeProposal) return
    setExportingSlides(true)
    setExportError('')
    try {
      const res = await fetch('/api/export-to-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: activeProposal.slides,
          title: `${activeProposal.targetCompanyName} 様 提案書`,
          companyId,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setExportError(data.error || 'エクスポートに失敗しました')
        downloadMarkdown(activeProposal)
        return
      }
      window.open(data.url, '_blank')
    } catch (err) {
      setExportError('エクスポートに失敗しました: ' + (err as Error).message)
      downloadMarkdown(activeProposal)
    } finally {
      setExportingSlides(false)
    }
  }

  const isLoading = loadingStep !== null

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Presentation className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">提案資料</h1>
          <p className="text-sm text-muted-foreground">ミーティング中10分で新規クライアント向け提案書を自動生成</p>
        </div>
      </div>

      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規提案書を作成</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-name">ターゲット企業名 *</Label>
              <Input
                id="company-name"
                placeholder="例: 株式会社〇〇"
                value={targetCompanyName}
                onChange={(e) => setTargetCompanyName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-url">ターゲット企業URL（任意）</Label>
              <Input
                id="company-url"
                placeholder="例: https://example.co.jp"
                value={targetCompanyUrl}
                onChange={(e) => setTargetCompanyUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-notes">ミーティングメモ（任意）</Label>
            <Textarea
              id="meeting-notes"
              placeholder="ヒアリング内容・課題感・要望などを貼り付けてください"
              rows={4}
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleGenerate} disabled={isLoading} className="self-start">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {LOADING_MESSAGES[loadingStep!]}
              </>
            ) : (
              '提案資料を生成'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Past Proposals List */}
      {proposals.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">過去の提案書</h2>
          <div className="flex flex-col gap-2">
            {proposals.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  activeProposal?.id === p.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => {
                  setActiveProposal(p)
                  setExpandedSlides({})
                }}
              >
                <div>
                  <span className="font-medium text-sm">{p.targetCompanyName}</span>
                  <span className="text-xs text-muted-foreground ml-3">
                    {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadMarkdown(p)
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(p.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Proposal Slides */}
      {activeProposal && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold">{activeProposal.targetCompanyName} 様 提案書</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {googleConnected ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleExportToSlides}
                  disabled={exportingSlides}
                >
                  {exportingSlides ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      書き出し中...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Googleスライドに書き出す
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ※ <a href="/settings" className="underline">設定画面</a>でGoogle連携するとスライドに書き出せます
                </p>
              )}
              <Button size="sm" variant="outline" onClick={() => downloadMarkdown(activeProposal)}>
                <Download className="h-4 w-4 mr-1.5" />
                ダウンロード（MD）
              </Button>
            </div>
          </div>
          {exportError && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
              {exportError}（マークダウンにフォールバックしました）
            </p>
          )}
          {(activeProposal.slides as ProposalSlide[]).map((slide) => (
            <Card key={slide.slideNumber} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {slide.slideNumber}
                    </span>
                    <CardTitle className="text-base">{slide.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copySlide(slide)}
                    >
                      {copiedSlide === slide.slideNumber ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleSlide(slide.slideNumber)}
                    >
                      {expandedSlides[slide.slideNumber] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">
                  {slide.content}
                </div>

                {expandedSlides[slide.slideNumber] && (
                  <div className="mt-4 border-t pt-4 flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">トークポイント</p>
                      <ul className="flex flex-col gap-1">
                        {slide.talkingPoints.map((point, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-primary font-bold text-xs mt-0.5">▶</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">スピーカーノート（話し方のヒント）</p>
                      <p className="text-sm text-muted-foreground bg-muted rounded-md p-3 leading-relaxed">
                        {slide.speakerNotes}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
