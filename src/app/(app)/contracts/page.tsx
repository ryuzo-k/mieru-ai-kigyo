'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileSignature,
  Upload,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getContractsFromDB,
  deleteContractFromDB,
  ContractRecord,
} from '@/lib/db'

export default function ContractsPage() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company') || 'company_default'

  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentResult, setCurrentResult] = useState<ContractRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getContractsFromDB(companyId)
      .then(setContracts)
      .catch(() => setContracts([]))
      .finally(() => setLoading(false))
  }, [companyId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('PDFファイルのみアップロードできます')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const pdfBase64 = btoa(binary)

      const res = await fetch('/api/analyze-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, filename: file.name, companyId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '分析に失敗しました')
      }

      const data = await res.json()
      const newContract: ContractRecord = {
        id: data.contractId,
        companyId,
        filename: file.name,
        summary: data.summary,
        createdAt: new Date().toISOString(),
      }
      setCurrentResult(newContract)
      setContracts((prev) => [newContract, ...prev])
      setExpandedId(newContract.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析に失敗しました')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    await deleteContractFromDB(id)
    setContracts((prev) => prev.filter((c) => c.id !== id))
    if (expandedId === id) setExpandedId(null)
    if (currentResult?.id === id) setCurrentResult(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSignature className="h-6 w-6" />
          契約書管理
        </h1>
        <p className="text-muted-foreground">PDFをアップロードして契約内容をAIが自動解析します</p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>契約書をアップロード</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">AIが契約書を解析中...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8 opacity-50" />
                <p className="text-sm font-medium">クリックしてPDFを選択</p>
                <p className="text-xs">PDF形式のみ対応</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Result */}
      {currentResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              分析完了: {currentResult.filename}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContractSummaryView summary={currentResult.summary} />
          </CardContent>
        </Card>
      )}

      {/* Past contracts */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          過去の契約書 ({contracts.length}件)
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">まだ契約書がありません</p>
        ) : (
          contracts.map((contract) => (
            <Card key={contract.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary text-left flex-1"
                    onClick={() => setExpandedId(expandedId === contract.id ? null : contract.id)}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{contract.filename}</span>
                    <span className="text-xs text-muted-foreground ml-1 shrink-0">
                      {new Date(contract.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                    {expandedId === contract.id ? (
                      <ChevronUp className="h-4 w-4 ml-auto shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-auto shrink-0" />
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 ml-2 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(contract.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              {expandedId === contract.id && (
                <CardContent>
                  <ContractSummaryView summary={contract.summary} />
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function ContractSummaryView({ summary }: { summary: ContractRecord['summary'] }) {
  return (
    <div className="space-y-4 text-sm">
      {/* Parties */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">発注者</p>
          <p className="font-medium">{summary.parties?.client || '—'}</p>
        </div>
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">受注者</p>
          <p className="font-medium">{summary.parties?.contractor || '—'}</p>
        </div>
      </div>

      {/* Contract period */}
      {summary.contractPeriod && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">契約期間</p>
          <p>{summary.contractPeriod}</p>
        </div>
      )}

      {/* Tasks */}
      {summary.tasks?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">業務内容</p>
          <div className="space-y-2">
            {summary.tasks.map((task, i) => (
              <div key={i} className="rounded-md border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  {task.deadline && (
                    <Badge variant="outline" className="text-xs shrink-0">{task.deadline}</Badge>
                  )}
                </div>
                {task.description && (
                  <p className="text-muted-foreground text-xs mt-1">{task.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments */}
      {summary.payments?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">報酬・支払条件</p>
          <div className="space-y-2">
            {summary.payments.map((payment, i) => (
              <div key={i} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{payment.amount}</p>
                  {payment.dueDate && (
                    <Badge variant="secondary" className="text-xs">{payment.dueDate}</Badge>
                  )}
                </div>
                {payment.condition && (
                  <p className="text-muted-foreground text-xs mt-1">{payment.condition}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prohibitions */}
      {summary.prohibitions?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">禁止事項</p>
          <ul className="space-y-1">
            {summary.prohibitions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-destructive mt-0.5 shrink-0">×</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Special notes */}
      {summary.specialNotes?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">特記事項・注意事項</p>
          <ul className="space-y-1">
            {summary.specialNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
