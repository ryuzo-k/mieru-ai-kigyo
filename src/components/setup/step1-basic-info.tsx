'use client'

import { useState } from 'react'
import { Plus, Trash2, Globe, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StoreInfo, BusinessType, ListingUrl } from '@/types'
import { generateId } from '@/lib/storage'

interface Props {
  initialData: StoreInfo
  onComplete: (data: Partial<StoreInfo>) => void
}

const businessTypes: { value: BusinessType; label: string }[] = [
  { value: 'food', label: '飲食' },
  { value: 'beauty', label: '美容' },
  { value: 'medical', label: '医療' },
  { value: 'retail', label: '小売' },
  { value: 'other', label: 'その他' },
]

const listingPlatforms = [
  '食べログ', 'ホットペッパー', 'ぐるなび', 'Retty', '楽天', 'じゃらん', 'その他'
]

export function Step1BasicInfo({ initialData, onComplete }: Props) {
  const [businessType, setBusinessType] = useState<BusinessType>(
    initialData.businessType || 'food'
  )
  const [name, setName] = useState(initialData.name)
  const [websiteUrl, setWebsiteUrl] = useState(initialData.websiteUrl)
  const [listingUrls, setListingUrls] = useState<ListingUrl[]>(
    initialData.listingUrls || []
  )
  const [scraping, setScraping] = useState(false)
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = '店舗名を入力してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleScrapeWebsite = async () => {
    if (!websiteUrl) return
    setScraping(true)
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
        alert('ウェブサイト情報を取得しました。次のステップで詳細を確認・編集できます。')
      }
    } catch {
      alert('スクレイピングに失敗しました')
    } finally {
      setScraping(false)
    }
  }

  const addListingUrl = () => {
    setListingUrls((prev) => [
      ...prev,
      { id: generateId(), platform: '食べログ', url: '' },
    ])
  }

  const removeListingUrl = (id: string) => {
    setListingUrls((prev) => prev.filter((l) => l.id !== id))
  }

  const updateListingUrl = (id: string, field: 'platform' | 'url', value: string) => {
    setListingUrls((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )
  }

  const handleSubmit = () => {
    if (!validate()) return
    onComplete({
      businessType,
      name: name.trim(),
      websiteUrl: websiteUrl.trim(),
      listingUrls,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>基本情報の入力</CardTitle>
        <CardDescription>
          あなたの店舗の基本情報を入力してください。ウェブサイトのURLを入力すると情報を自動取得できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 業態 */}
        <div className="space-y-2">
          <Label htmlFor="businessType">業態 *</Label>
          <Select
            value={businessType}
            onValueChange={(v) => setBusinessType(v as BusinessType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="業態を選択" />
            </SelectTrigger>
            <SelectContent>
              {businessTypes.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>
                  {bt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 店舗名 */}
        <div className="space-y-2">
          <Label htmlFor="name">店舗名（ブランド名）*</Label>
          <Input
            id="name"
            placeholder="例：イタリアンレストラン ラ・ベラ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
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
            URLを入力して「取得」をクリックすると、ウェブサイトの情報を自動取得します（Firecrawl APIキーが必要）
          </p>
        </div>

        {/* 掲載URL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>掲載サイトURL（任意）</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addListingUrl}
            >
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
          {listingUrls.length === 0 && (
            <p className="text-sm text-muted-foreground">
              食べログ・ホットペッパー等の掲載URLを追加できます
            </p>
          )}
          {listingUrls.map((listing) => (
            <div key={listing.id} className="flex gap-2 items-start">
              <Select
                value={listing.platform}
                onValueChange={(v) => updateListingUrl(listing.id, 'platform', v)}
              >
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listingPlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="https://..."
                value={listing.url}
                onChange={(e) =>
                  updateListingUrl(listing.id, 'url', e.target.value)
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeListingUrl(listing.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSubmit} className="w-full">
          次へ：ブランド詳細
        </Button>
      </CardContent>
    </Card>
  )
}
