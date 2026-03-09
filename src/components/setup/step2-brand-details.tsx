'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StoreInfo, Competitor } from '@/types'
import { generateId } from '@/lib/storage'

interface Props {
  storeInfo: StoreInfo
  onComplete: (data: Partial<StoreInfo>) => void
  onBack: () => void
}

export function Step2BrandDetails({ storeInfo, onComplete, onBack }: Props) {
  const [description, setDescription] = useState(storeInfo.description)
  const [targetAudience, setTargetAudience] = useState(storeInfo.targetAudience)
  const [strengths, setStrengths] = useState(storeInfo.strengths)
  const [services, setServices] = useState(storeInfo.services)
  const [achievements, setAchievements] = useState(storeInfo.achievements)
  const [positioning, setPositioning] = useState(storeInfo.positioning)
  const [competitors, setCompetitors] = useState<Competitor[]>(
    storeInfo.competitors || []
  )

  const addCompetitor = () => {
    setCompetitors((prev) => [
      ...prev,
      { id: generateId(), name: '', url: '' },
    ])
  }

  const removeCompetitor = (id: string) => {
    setCompetitors((prev) => prev.filter((c) => c.id !== id))
  }

  const updateCompetitor = (
    id: string,
    field: 'name' | 'url',
    value: string
  ) => {
    setCompetitors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const handleSubmit = () => {
    onComplete({
      description,
      targetAudience,
      strengths,
      services,
      achievements,
      positioning,
      competitors,
    })
  }

  const fields = [
    {
      id: 'description',
      label: 'ブランドの概要・説明',
      placeholder: '例：新鮮な魚介を使った本格イタリアンレストラン。オープンキッチンで料理を楽しむスタイル。',
      value: description,
      onChange: setDescription,
    },
    {
      id: 'targetAudience',
      label: 'ターゲット層',
      placeholder: '例：20〜40代の女性、記念日デートやランチを楽しみたいカップル・友人グループ',
      value: targetAudience,
      onChange: setTargetAudience,
    },
    {
      id: 'strengths',
      label: '強み・差別化ポイント',
      placeholder: '例：地元農家直送の野菜、厳選ワイン100種類、個室完備、子連れ歓迎',
      value: strengths,
      onChange: setStrengths,
    },
    {
      id: 'services',
      label: '提供サービス・メニュー',
      placeholder: '例：ランチコース（1,500円〜）、ディナーコース（5,000円〜）、テイクアウトパスタ',
      value: services,
      onChange: setServices,
    },
    {
      id: 'achievements',
      label: '実績・数字',
      placeholder: '例：食べログ評点3.8、月間来店数1,000名、口コミ評価4.5/5.0、オープン5年',
      value: achievements,
      onChange: setAchievements,
    },
    {
      id: 'positioning',
      label: 'ブランドのポジショニング',
      placeholder: '例：○○エリアで最もコスパの良い本格イタリアン。気軽に本格的な料理が楽しめる店。',
      value: positioning,
      onChange: setPositioning,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>ブランド詳細情報</CardTitle>
        <CardDescription>
          AIがあなたの店舗を正しく理解・紹介できるよう、詳しい情報を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Textarea
              id={field.id}
              placeholder={field.placeholder}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              rows={3}
            />
          </div>
        ))}

        {/* 競合他社 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>競合他社（任意）</Label>
            <Button variant="outline" size="sm" onClick={addCompetitor}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
          {competitors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              競合店舗の情報を追加すると、より精度の高い分析ができます
            </p>
          )}
          {competitors.map((competitor) => (
            <div key={competitor.id} className="flex gap-2 items-center">
              <Input
                placeholder="競合店舗名"
                value={competitor.name}
                onChange={(e) =>
                  updateCompetitor(competitor.id, 'name', e.target.value)
                }
                className="flex-1"
              />
              <Input
                placeholder="URL（任意）"
                value={competitor.url}
                onChange={(e) =>
                  updateCompetitor(competitor.id, 'url', e.target.value)
                }
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCompetitor(competitor.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            戻る
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            次へ：プロンプト生成
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
