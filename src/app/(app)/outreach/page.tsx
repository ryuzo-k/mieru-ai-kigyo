'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Mail,
  ExternalLink,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  getOutreachTargets,
  saveOutreachTargets,
  getGmailConfig,
} from '@/lib/storage'
import { OutreachTarget, OutreachStatus, GmailConfig } from '@/types'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<
  OutreachStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  pending: {
    label: '未対応',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Clock,
  },
  drafted: {
    label: 'メール下書き済み',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Mail,
  },
  sent: {
    label: '送信済み',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: Send,
  },
  confirmed: {
    label: '掲載確認済み',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function GmailStatusBar({ config }: { config: GmailConfig }) {
  if (config.connected && config.email) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
        <Wifi className="h-4 w-4 shrink-0" />
        <span>
          Gmail 接続済み:{' '}
          <span className="font-medium">{config.email}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0 text-gray-400" />
        <span>Gmail 未接続 — メール送信するには連携が必要です</span>
      </div>
      <Link
        href="/settings"
        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 shrink-0"
      >
        設定で連携する
      </Link>
    </div>
  )
}

function StatusBadge({ status }: { status: OutreachStatus }) {
  const cfg = statusConfig[status]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cfg.badgeClass
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [targets, setTargets] = useState<OutreachTarget[]>([])
  const [gmailConfig, setGmailConfig] = useState<GmailConfig>({
    connected: false,
    email: '',
    accessToken: null,
    refreshToken: null,
  })
  const [searching, setSearching] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  // Preview dialog state
  const [previewTarget, setPreviewTarget] = useState<OutreachTarget | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)

  useEffect(() => {
    setTargets(getOutreachTargets())
    setGmailConfig(getGmailConfig())
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateTargets = (updated: OutreachTarget[]) => {
    saveOutreachTargets(updated)
    setTargets(updated)
  }

  const patchTarget = (id: string, patch: Partial<OutreachTarget>) => {
    const updated = targets.map((t) => (t.id === id ? { ...t, ...patch } : t))
    updateTargets(updated)
  }

  // ── Find media ────────────────────────────────────────────────────────────

  const handleFindMedia = async () => {
    const store = getStoreInfo()
    if (!store) {
      setError(
        '店舗情報が設定されていません。設定ページから店舗情報を入力してください。'
      )
      return
    }

    setSearching(true)
    setError(null)
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find-media', store }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'メディア検索に失敗しました')
      }
      const newTargets: OutreachTarget[] = data.targets ?? []
      updateTargets([...targets, ...newTargets])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メディア検索に失敗しました')
    } finally {
      setSearching(false)
    }
  }

  // ── Generate email ────────────────────────────────────────────────────────

  const handleGenerateEmail = async (target: OutreachTarget) => {
    const store = getStoreInfo()
    if (!store) return

    setGenerating(target.id)
    setError(null)
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-email',
          store,
          mediaName: target.mediaName,
          mediaUrl: target.mediaUrl,
          competitorInfo: target.competitorInfo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'メール生成に失敗しました')
      }

      const updatedTargets = targets.map((t) =>
        t.id === target.id
          ? {
              ...t,
              draftEmail: data.email as string,
              status: 'drafted' as OutreachStatus,
            }
          : t
      )
      updateTargets(updatedTargets)

      const updated = updatedTargets.find((t) => t.id === target.id)
      if (updated) {
        setPreviewTarget(updated)
        setEmailDraft(updated.draftEmail)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メール生成に失敗しました')
    } finally {
      setGenerating(null)
    }
  }

  // ── Send via Gmail API ────────────────────────────────────────────────────

  const handleSendViaGmailApi = async (
    target: OutreachTarget,
    emailBody: string
  ) => {
    if (!gmailConfig.connected) {
      setError(
        'Gmailが接続されていません。設定ページからGmailを連携してください。'
      )
      return
    }
    setSending(target.id)
    setError(null)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: target.contactEmail,
          body: emailBody,
          accessToken: gmailConfig.accessToken,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'メール送信に失敗しました')
      }
      const now = new Date().toISOString()
      patchTarget(target.id, { status: 'sent', sentAt: now })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メール送信に失敗しました')
    } finally {
      setSending(null)
    }
  }

  // ── Status update ─────────────────────────────────────────────────────────

  const handleUpdateStatus = (id: string, status: OutreachStatus) => {
    const now = new Date().toISOString()
    const existing = targets.find((t) => t.id === id)
    patchTarget(id, {
      status,
      sentAt: status === 'sent' ? now : (existing?.sentAt ?? null),
      confirmedAt:
        status === 'confirmed' ? now : (existing?.confirmedAt ?? null),
    })
  }

  // ── Save draft from dialog ────────────────────────────────────────────────

  const handleSaveDraft = () => {
    if (!previewTarget) return
    setSavingDraft(true)
    patchTarget(previewTarget.id, {
      draftEmail: emailDraft,
      status: 'drafted',
    })
    setPreviewTarget({ ...previewTarget, draftEmail: emailDraft, status: 'drafted' })
    setSavingDraft(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────────────────

  const filteredTargets = targets.filter(
    (t) => filterStatus === 'all' || t.status === filterStatus
  )

  const statusCounts = targets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  const sentTargets = targets.filter((t) => t.sentAt)

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">掲載・営業支援</h1>
        <p className="text-muted-foreground text-sm mt-1">
          競合が引用されているメディアを発掘し、掲載依頼メールを自動生成・送信します
        </p>
      </div>

      {/* Gmail status */}
      <GmailStatusBar config={gmailConfig} />

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'drafted', 'sent', 'confirmed'] as OutreachStatus[]).map(
          (status) => {
            const cfg = statusConfig[status]
            const Icon = cfg.icon
            return (
              <Card key={status}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {statusCounts[status] ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {cfg.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }
        )}
      </div>

      {/* Find media */}
      <Card>
        <CardHeader>
          <CardTitle>メディア候補を探す</CardTitle>
          <CardDescription>
            AIが競合他社が掲載・引用されているメディアを自動リストアップします
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleFindMedia} disabled={searching}>
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                検索中...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                メディアを探す
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Target list */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-base">
            アウトリーチリスト{' '}
            <span className="text-muted-foreground text-sm font-normal">
              ({targets.length}件)
            </span>
          </h2>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 text-xs h-8">
              <SelectValue placeholder="ステータスで絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのステータス</SelectItem>
              <SelectItem value="pending">未対応</SelectItem>
              <SelectItem value="drafted">メール下書き済み</SelectItem>
              <SelectItem value="sent">送信済み</SelectItem>
              <SelectItem value="confirmed">掲載確認済み</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredTargets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 flex flex-col items-center text-center gap-3">
              <Search className="h-10 w-10 text-gray-300" />
              <p className="font-medium text-gray-600">
                {targets.length === 0
                  ? 'アウトリーチ候補がありません'
                  : '条件に一致するターゲットがありません'}
              </p>
              <p className="text-sm text-gray-400">
                {targets.length === 0
                  ? '「メディアを探す」ボタンを押してリストを作成してください'
                  : 'フィルターを変更してみてください'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">メディア名</TableHead>
                    <TableHead className="min-w-[180px]">引用競合情報</TableHead>
                    <TableHead className="min-w-[160px]">連絡先メール</TableHead>
                    <TableHead className="min-w-[160px]">ステータス</TableHead>
                    <TableHead className="min-w-[220px] text-right">
                      アクション
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargets.map((target) => (
                    <TableRow key={target.id}>
                      {/* Media name */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">
                            {target.mediaName}
                          </span>
                          {target.mediaUrl && (
                            <a
                              href={target.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>

                      {/* Competitor info */}
                      <TableCell>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {target.competitorInfo || '—'}
                        </p>
                      </TableCell>

                      {/* Contact email */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {target.contactEmail || '—'}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <StatusBadge status={target.status} />
                          <Select
                            value={target.status}
                            onValueChange={(v) =>
                              handleUpdateStatus(target.id, v as OutreachStatus)
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">未対応</SelectItem>
                              <SelectItem value="drafted">
                                メール下書き済み
                              </SelectItem>
                              <SelectItem value="sent">送信済み</SelectItem>
                              <SelectItem value="confirmed">
                                掲載確認済み
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {target.sentAt && (
                            <p className="text-xs text-muted-foreground">
                              送信:{' '}
                              {new Date(target.sentAt).toLocaleDateString('ja-JP')}
                            </p>
                          )}
                          {target.confirmedAt && (
                            <p className="text-xs text-green-600 font-medium">
                              確認:{' '}
                              {new Date(target.confirmedAt).toLocaleDateString(
                                'ja-JP'
                              )}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {/* Generate email */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleGenerateEmail(target)}
                              disabled={generating === target.id}
                              title="メール下書きを生成"
                            >
                              {generating === target.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  生成中
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3" />
                                  メール生成
                                </>
                              )}
                            </Button>

                            {/* Preview */}
                            {target.draftEmail && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  setPreviewTarget(target)
                                  setEmailDraft(target.draftEmail)
                                }}
                              >
                                <Eye className="h-3 w-3" />
                                プレビュー
                              </Button>
                            )}

                            {/* Send via Gmail */}
                            {target.draftEmail && (
                              <Button
                                variant={
                                  gmailConfig.connected ? 'default' : 'outline'
                                }
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={
                                  sending === target.id || !gmailConfig.connected
                                }
                                onClick={() =>
                                  handleSendViaGmailApi(target, target.draftEmail)
                                }
                                title={
                                  !gmailConfig.connected
                                    ? '設定でGmailを接続してください'
                                    : 'Gmailで送信'
                                }
                              >
                                {sending === target.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    送信中
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3" />
                                    Gmailで送信
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Connect Gmail hint */}
                          {target.draftEmail && !gmailConfig.connected && (
                            <p className="text-xs text-muted-foreground">
                              送信するには{' '}
                              <Link
                                href="/settings"
                                className="text-blue-600 hover:underline"
                              >
                                設定でGmailを接続
                              </Link>
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Send history */}
      {sentTargets.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <h2 className="font-semibold text-base">送信履歴</h2>
          <div className="space-y-2">
            {sentTargets.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="font-medium">{t.mediaName}</span>
                  <span className="text-muted-foreground text-xs">
                    {t.contactEmail}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {t.sentAt && (
                    <span className="text-xs text-muted-foreground">
                      送信:{' '}
                      {new Date(t.sentAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Preview / Edit Dialog */}
      <Dialog
        open={!!previewTarget}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {previewTarget?.mediaName} へのアウトリーチメール
            </DialogTitle>
            <DialogDescription>
              送信前にメール内容を確認・編集してください
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            rows={16}
            className="font-mono text-sm resize-none"
          />

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewTarget(null)}
              className="sm:mr-auto"
            >
              閉じる
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft}
            >
              {savingDraft ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              下書きを保存
            </Button>
            {previewTarget && gmailConfig.connected && (
              <Button
                onClick={() => {
                  if (!previewTarget) return
                  handleSaveDraft()
                  handleSendViaGmailApi(
                    { ...previewTarget, draftEmail: emailDraft },
                    emailDraft
                  )
                  setPreviewTarget(null)
                }}
                disabled={sending === previewTarget.id}
              >
                {sending === previewTarget.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Gmailで送信
              </Button>
            )}
            {previewTarget && !gmailConfig.connected && (
              <p className="text-xs text-muted-foreground sm:self-center">
                送信するには{' '}
                <Link
                  href="/settings"
                  className="text-blue-600 hover:underline"
                  onClick={() => setPreviewTarget(null)}
                >
                  設定でGmailを接続
                </Link>
                してください
              </p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
