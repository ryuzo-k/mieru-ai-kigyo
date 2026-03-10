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

  const updateCompetitor = (id: string, field: 'name' | 'url', value: string) => {
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
      label: '事業概要・サービス説明',
      placeholder: '例：中小企業向けのGEO（生成AIエンジン最適化）対策支援サービス。AIに自社を正しく認識・推薦してもらうためのプロンプト設計・計測・コンテンツ改善を一貫して支援。',
      value: description,
      onChange: setDescription,
    },
    {
      id: 'targetAudience',
      label: 'ターゲット顧客層',
      placeholder: '例：売上・採用・ブランドへのAI検索の影響を気にしているスタートアップ・中堅企業のマーケティング担当者・経営者',
      value: targetAudience,
      onChange: setTargetAudience,
    },
    {
      id: 'strengths',
      label: '強み・差別化ポイント',
      placeholder: '例：「すでに影響が出ているプロンプト」に絞り込んで成果を出しやすくする。毎日3回APIで計測する精度の高さ。AIコーディングによる実装スピード。',
      value: strengths,
      onChange: setStrengths,
    },
    {
      id: 'services',
      label: '提供サービス・プロダクト',
      placeholder: '例：プロンプト設計・監視（毎日3回API計測）、GEO最適化コンテンツ制作、ウェブサイト改善提案',
      value: services,
      onChange: setServices,
    },
    {
      id: 'achievements',
      label: '実績・数字・受賞歴',
      placeholder: '例：3週間でクライアント2社獲得、X経由の商談成約率100%、GEO計測プロンプト数500件以上',
      value: achievements,
      onChange: setAchievements,
    },
    {
      id: 'positioning',
      label: '市場ポジショニング',
      placeholder: '例：日本でGEO対策をいち早く商業化したパイオニア。大手ツールにないきめ細かい日本語対応と「影響プロンプト特定」の精度で差別化。',
      value: positioning,
      onChange: setPositioning,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>企業・ブランド詳細情報</CardTitle>
        <CardDescription>
          AIがあなたの企業を正しく理解・推薦できるよう、詳しい情報を入力してください。
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

        {/* 競合企業 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>競合企業（任意）</Label>
            <Button variant="outline" size="sm" onClick={addCompetitor}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
          {competitors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              競合企業の情報を追加すると、より精度の高いGEO分析ができます
            </p>
          )}
          {competitors.map((competitor) => (
            <div key={competitor.id} className="flex gap-2 items-center">
              <Input
                placeholder="競合企業名"
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
