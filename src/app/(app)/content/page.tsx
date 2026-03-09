'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, RefreshCw, FileText, Pencil } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import {
  getStoreInfo,
  getPrompts,
  getGeneratedContents,
  saveGeneratedContents,
  getApiKeys,
} from '@/lib/storage'
import { StoreInfo, Prompt, ContentMedium, GeneratedContent } from '@/types'
import { formatDate } from '@/lib/utils'

const mediumConfig: {
  id: ContentMedium
  label: string
  description: string
  businessTypes?: string[]
}[] = [
  {
    id: 'google_business',
    label: 'Googleビジネスプロフィール',
    description: '店舗情報最適化テキスト',
  },
  {
    id: 'owned_media',
    label: 'オウンドメディア',
    description: 'GEO最適化記事',
  },
  {
    id: 'tabelog',
    label: '食べログ',
    description: 'ブランド基礎 + 特徴説明',
    businessTypes: ['food'],
  },
  {
    id: 'gurunavi',
    label: 'ぐるなび',
    description: 'ブランド基礎 + 特徴説明',
    businessTypes: ['food'],
  },
  {
    id: 'retty',
    label: 'Retty',
    description: 'ブランド基礎 + 特徴説明',
    businessTypes: ['food'],
  },
  {
    id: 'rakuten',
    label: '楽天',
    description: 'おすすめ情報リスト形式',
    businessTypes: ['food'],
  },
  {
    id: 'hotpepper',
    label: 'ホットペッパービューティー',
    description: 'サービス詳細 + 強み訴求',
    businessTypes: ['beauty'],
  },
]

export default function ContentPage() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [generating, setGenerating] = useState<ContentMedium | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [activeMedium, setActiveMedium] = useState<ContentMedium>('google_business')

  useEffect(() => {
    const s = getStoreInfo()
    setStore(s)
    setPrompts(getPrompts())
    setContents(getGeneratedContents())
  }, [])

  const apiKeys = getApiKeys()

  const availableMediums = mediumConfig.filter(
    (m) =>
      !m.businessTypes ||
      !store ||
      m.businessTypes.includes(store.businessType)
  )

  const handleGenerate = async (medium: ContentMedium) => {
    if (!store) return
    if (!apiKeys.anthropic) {
      alert('Anthropic APIキーが必要です（設定から入力してください）')
      return
    }

    setGenerating(medium)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store,
          prompts,
          medium,
          apiKey: apiKeys.anthropic,
        }),
      })
      const data = await res.json()
      if (data.error) {
        alert('生成に失敗しました: ' + data.error)
        return
      }
      const newContent = data.content as GeneratedContent
      const updated = [
        ...contents.filter((c) => c.medium !== medium),
        newContent,
      ]
      saveGeneratedContents(updated)
      setContents(updated)
    } catch {
      alert('コンテンツ生成に失敗しました')
    } finally {
      setGenerating(null)
    }
  }

  const handleCopy = async (contentId: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(contentId)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleEdit = (content: GeneratedContent) => {
    setEditing(content.id)
    setEditValue(content.content)
  }

  const handleSaveEdit = (contentId: string) => {
    const updated = contents.map((c) =>
      c.id === contentId
        ? { ...c, content: editValue, editedAt: new Date().toISOString() }
        : c
    )
    saveGeneratedContents(updated)
    setContents(updated)
    setEditing(null)
  }

  const getContent = (medium: ContentMedium) =>
    contents.find((c) => c.medium === medium)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">コンテンツ制作</h1>
        <p className="text-muted-foreground">
          GEO最適化されたコンテンツを各媒体向けに自動生成します
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">コンテンツ設計について</p>
              <p>
                勝ち筋プロンプトに対してAIが「AIがこのプロンプトで回答する際の重要要件」を抽出し、
                各媒体に最適化されたコンテンツを生成します。
                コンテンツはオウンドメディアへの掲載を想定しています。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeMedium}
        onValueChange={(v) => setActiveMedium(v as ContentMedium)}
      >
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {availableMediums.map((m) => (
            <TabsTrigger key={m.id} value={m.id} className="text-xs">
              {m.label}
              {getContent(m.id) && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableMediums.map((medium) => {
          const content = getContent(medium.id)
          const isGenerating = generating === medium.id

          return (
            <TabsContent key={medium.id} value={medium.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{medium.label}</CardTitle>
                      <CardDescription>{medium.description}</CardDescription>
                    </div>
                    <Button
                      onClick={() => handleGenerate(medium.id)}
                      disabled={!!generating}
                      variant={content ? 'outline' : 'default'}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : content ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          再生成
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          コンテンツ生成
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!content && !isGenerating && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>「コンテンツ生成」ボタンで生成を開始します</p>
                      <p className="text-xs mt-1">
                        勝ち筋プロンプトをもとに{medium.label}向けの
                        <br />
                        GEO最適化コンテンツを自動生成します
                      </p>
                    </div>
                  )}
                  {isGenerating && (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground">
                          {medium.label}向けコンテンツを生成中...
                        </p>
                      </div>
                    </div>
                  )}
                  {content && !isGenerating && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{content.title}</h3>
                          {content.editedAt && (
                            <Badge variant="secondary" className="text-xs">
                              編集済み
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(content)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            編集
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleCopy(content.id, content.content)
                            }
                          >
                            {copied === content.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                                コピー済み
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                コピー
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {editing === content.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={20}
                            className="font-mono text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(content.id)}
                            >
                              保存
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(null)}
                            >
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-muted p-4">
                          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                            {content.content}
                          </pre>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        生成日時: {formatDate(content.generatedAt)}
                        {content.editedAt &&
                          ` / 編集日時: ${formatDate(content.editedAt)}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
