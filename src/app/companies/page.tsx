'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, ExternalLink, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAllCompaniesFromDB } from '@/lib/db'
import type { StoreInfo } from '@/types'

const businessTypeLabels: Record<string, string> = {
  food: '小売・EC',
  beauty: 'コンサルティング・専門サービス',
  medical: '医療・ヘルスケア',
  retail: '製造・メーカー',
  other: 'その他',
}

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllCompaniesFromDB()
      .then((data) => {
        setCompanies(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">MiEL for Kigyo</p>
              <p className="text-xs text-muted-foreground">企業向けGEO対策ツール</p>
            </div>
          </div>
          <Button onClick={() => router.push('/setup?new=1')}>
            <Plus className="h-4 w-4 mr-2" />
            企業を追加
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">企業一覧</h1>
          <p className="text-muted-foreground mt-1">管理する企業を選択してください</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            読み込み中...
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-lg">企業がまだ登録されていません</p>
              <p className="text-muted-foreground text-sm mt-1">
                最初の企業を追加してGEO計測を始めましょう
              </p>
            </div>
            <Button onClick={() => router.push('/setup')}>
              <Plus className="h-4 w-4 mr-2" />
              最初の企業を追加
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <Card
                key={company.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/dashboard?company=${company.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                      {company.name || '(未設定)'}
                    </CardTitle>
                    {company.businessType && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {businessTypeLabels[company.businessType] ?? company.businessType}
                      </Badge>
                    )}
                  </div>
                  {company.websiteUrl && (
                    <CardDescription className="flex items-center gap-1 truncate text-xs">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{company.websiteUrl}</span>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      登録:{' '}
                      {company.createdAt
                        ? new Date(company.createdAt).toLocaleDateString('ja-JP')
                        : '-'}
                    </span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard?company=${company.id}`)
                      }}
                    >
                      開く
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
