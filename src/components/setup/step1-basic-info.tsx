'use client'

import { useState } from 'react'
import { Globe, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { StoreInfo, BusinessType } from '@/types'

interface Props {
  initialData: StoreInfo
  onComplete: (data: Partial<StoreInfo>) => void
}

const industryTypes: { value: BusinessType; label: string }[] = [
  { value: 'other', label: 'IT・SaaS' },
  { value: 'retail', label: '製造・メーカー' },
  { value: 'medical', label: '医療・ヘルスケア' },
  { value: 'beauty', label: 'コンサルティング・専門サービス' },
  { value: 'food', label: '小売・EC' },
]

interface ScrapedData {
  title?: string
  description?: string
  content?: string
  metadata?: Record<string, string>
}

export function Step1BasicInfo({ initialData, onComplete }: Props) {
  const [businessType, setBusinessType] = useState<BusinessType>(
    initialData.businessType || 'other'
  )
  const [name, setName] = useState(initialData.name)
  const [websiteUrl, setWebsiteUrl] = useState(initialData.websiteUrl)
  const [scraping, setScraping] = useState(false)
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = '企業名を入力してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleScrapeWebsite = async () => {
    if (!websiteUrl) return
    setScraping(true)
    setScrapedData(null)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const data = await res.json()
      if (data.error) {
        alert('スクレイピングに失敗しました: ' + data.error)
      } else {
        setScrapedData(data)
        // タイトルから企業名を自動セット（未入力の場合）
        if (!name && data.title) {
          setName(data.title)
        }
      }
    } catch {
      alert('スクレイピングに失敗しました')
    } finally {
      setScraping(false)
    }
  }

  const handleSubmit = () => {
    if (!validate()) return
    onComplete({
      businessType,
      name: name.trim(),
      websiteUrl: websiteUrl.trim(),
      listingUrls: [],
      // スクレイピングした概要があれば description に入れる
      description: scrapedData?.description || '',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>企業基本情報の入力</CardTitle>
        <CardDescription>
          GEO対策を行う企業の基本情報を入力してください。ウェブサイトのURLを入力すると情報を自動取得できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 業種 */}
        <div className="space-y-2">
          <Label htmlFor="businessType">業種 *</Label>
          <Select
            value={businessType}
            onValueChange={(v) => setBusinessType(v as BusinessType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="業種を選択" />
            </SelectTrigger>
            <SelectContent>
              {industryTypes.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>
                  {bt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 公式ウェブサイト */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">公式ウェブサイトURL（任意）</Label>
          <div className="flex gap-2">
            <Input
              id="websiteUrl"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={handleScrapeWebsite}
              disabled={!websiteUrl || scraping}
              className="shrink-0"
            >
              {scraping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              <span className="ml-2">取得</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            URLを入力して「取得」をクリックすると、ウェブサイトの情報を自動取得します
          </p>
        </div>

        {/* スクレイピング結果の表示 */}
        {scrapedData && (
          <div className="rounded-lg border bg-green-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
              <CheckCircle2 className="h-4 w-4" />
              ウェブサイト情報を取得しました
            </div>
            {scrapedData.title && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">タイトル</p>
                <p className="text-sm font-medium">{scrapedData.title}</p>
              </div>
            )}
            {scrapedData.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">概要（meta description）</p>
                <p className="text-sm">{scrapedData.description}</p>
              </div>
            )}
            {scrapedData.content && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">取得したテキスト（一部）</p>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {scrapedData.content.substring(0, 400)}
                  {scrapedData.content.length > 400 ? '...' : ''}
                </p>
              </div>
            )}
            <Badge variant="secondary" className="text-xs">
              次のステップでAIが自動的にこの情報を分析します
            </Badge>
          </div>
        )}

        {/* 企業名 */}
        <div className="space-y-2">
          <Label htmlFor="name">企業名（ブランド名）*</Label>
          <Input
            id="name"
            placeholder="例：株式会社ミエルAI"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <Button onClick={handleSubmit} className="w-full">
          次へ：企業詳細情報
        </Button>
      </CardContent>
    </Card>
  )
}
