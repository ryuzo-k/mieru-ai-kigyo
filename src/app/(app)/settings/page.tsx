'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Save, Trash2, CheckCircle, Link, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getApiKeys,
  saveApiKeys,
  getMeasurementSchedule,
  saveMeasurementSchedule,
  resetStore,
  getWordPressConfig,
  saveWordPressConfig,
} from '@/lib/storage'
import { getStoreFromDB, saveStoreToDB, getGoogleTokenFromDB } from '@/lib/db'
import { useCompany } from '@/context/company-context'
import { ApiKeys, StoreInfo, BusinessType, WordPressConfig } from '@/types'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface ApiKeyField {
  key: keyof ApiKeys
  label: string
  placeholder: string
  description: string
}

const apiKeyFields: ApiKeyField[] = [
  {
    key: 'anthropic',
    label: 'Anthropic API Key（Claude）',
    placeholder: 'sk-ant-...',
    description: 'プロンプト生成・計測・分析チャットに使用します',
  },
  {
    key: 'openai',
    label: 'OpenAI API Key（ChatGPT）',
    placeholder: 'sk-...',
    description: 'ChatGPTでの計測に使用します',
  },
  {
    key: 'gemini',
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    description: 'Geminiでの計測に使用します',
  },
  {
    key: 'perplexity',
    label: 'Perplexity API Key',
    placeholder: 'pplx-...',
    description: 'Perplexityでの計測に使用します',
  },
  {
    key: 'firecrawl',
    label: 'Firecrawl API Key',
    placeholder: 'fc-...',
    description: 'ウェブサイトのスクレイピングに使用します',
  },
]

const businessTypeLabels: Record<BusinessType, string> = {
  food: '小売・EC',
  beauty: 'コンサルティング・専門サービス',
  medical: '医療・ヘルスケア',
  retail: '製造・メーカー',
  other: 'その他',
}

export default function SettingsPage() {
  const router = useRouter()
  const { companyId } = useCompany()
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    anthropic: '',
    openai: '',
    gemini: '',
    perplexity: '',
    firecrawl: '',
  })
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({})
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [editStore, setEditStore] = useState<Partial<StoreInfo>>({})
  const [schedule, setSchedule] = useState<{ preset: 'three_times' | 'custom'; customTimes: string[] }>({ preset: 'three_times', customTimes: ['09:00', '13:00', '18:00'] })
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [storeSaved, setStoreSaved] = useState(false)
  const [wpConfig, setWpConfig] = useState<WordPressConfig>({ siteUrl: '', username: '', applicationPassword: '', connected: false })
  const [showWpPassword, setShowWpPassword] = useState(false)
  const [wpSaved, setWpSaved] = useState(false)
  const [wpTesting, setWpTesting] = useState(false)
  const [wpTestResult, setWpTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [ga4MeasurementId, setGa4MeasurementId] = useState('')
  const [ga4Saved, setGa4Saved] = useState(false)
  const [ga4TestResult, setGa4TestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleMsg, setGoogleMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setApiKeys(getApiKeys())
    setSchedule(getMeasurementSchedule())
    setWpConfig(getWordPressConfig())
    getStoreFromDB(companyId).then((s) => {
      setStore(s)
      setEditStore(s || {})
      setGa4MeasurementId(s?.ga4MeasurementId || '')
    }).catch(() => {})
    // Check Google token from DB
    getGoogleTokenFromDB(companyId).then(({ accessToken, email }) => {
      if (accessToken) {
        setGoogleConnected(true)
        setGoogleEmail(email || '')
      }
    }).catch(() => {})
    // Handle OAuth redirect params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('google_connected') === 'true') {
        const email = params.get('email') || ''
        setGoogleConnected(true)
        setGoogleEmail(email)
        setGoogleMsg({ ok: true, text: `Google連携が完了しました${email ? `（${email}）` : ''}` })
        window.history.replaceState({}, '', window.location.pathname)
      } else if (params.get('google_error')) {
        setGoogleMsg({ ok: false, text: `Google連携エラー: ${params.get('google_error')}` })
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [companyId])

  const handleSaveApiKey = (key: keyof ApiKeys) => {
    saveApiKeys({ [key]: apiKeys[key] })
    setSavedKeys((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => setSavedKeys((prev) => ({ ...prev, [key]: false })), 2000)
  }

  const handleSaveAllKeys = () => {
    saveApiKeys(apiKeys)
    const allSaved: Record<string, boolean> = {}
    apiKeyFields.forEach((f) => (allSaved[f.key] = true))
    setSavedKeys(allSaved)
    setTimeout(() => setSavedKeys({}), 2000)
  }

  const handleSaveStore = async () => {
    if (!store) return
    const updated = { ...store, ...editStore, updatedAt: new Date().toISOString() } as StoreInfo
    await saveStoreToDB(updated, companyId)
    setStore(updated)
    setStoreSaved(true)
    setTimeout(() => setStoreSaved(false), 2000)
  }

  const handleSaveWordPress = () => {
    saveWordPressConfig(wpConfig)
    setWpSaved(true)
    setTimeout(() => setWpSaved(false), 2000)
  }

  const handleTestWordPress = async () => {
    if (!wpConfig.siteUrl || !wpConfig.username || !wpConfig.applicationPassword) {
      setWpTestResult({ ok: false, message: 'URLとユーザー名とアプリケーションパスワードを入力してください' })
      return
    }
    setWpTesting(true)
    setWpTestResult(null)
    try {
      const base64 = btoa(`${wpConfig.username}:${wpConfig.applicationPassword}`)
      const siteUrl = wpConfig.siteUrl.replace(/\/$/, '')
      const res = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${base64}` },
      })
      if (res.ok) {
        const user = await res.json()
        saveWordPressConfig({ ...wpConfig, connected: true })
        setWpConfig((prev) => ({ ...prev, connected: true }))
        setWpTestResult({ ok: true, message: `接続成功: ${user.name ?? wpConfig.username} としてログイン中` })
      } else {
        saveWordPressConfig({ ...wpConfig, connected: false })
        setWpConfig((prev) => ({ ...prev, connected: false }))
        setWpTestResult({ ok: false, message: `接続失敗 (HTTP ${res.status}): 認証情報を確認してください` })
      }
    } catch {
      setWpTestResult({ ok: false, message: 'ネットワークエラーが発生しました。URLを確認してください' })
    } finally {
      setWpTesting(false)
    }
  }

  const handleSaveGa4 = async () => {
    if (!store) return
    const updated = { ...store, ga4MeasurementId, updatedAt: new Date().toISOString() } as StoreInfo
    await saveStoreToDB(updated, companyId)
    setStore(updated)
    setGa4Saved(true)
    setTimeout(() => setGa4Saved(false), 2000)
  }

  const handleTestGa4 = () => {
    const pattern = /^G-[A-Z0-9]{6,}$/
    if (!ga4MeasurementId.trim()) {
      setGa4TestResult({ ok: false, message: 'Measurement IDを入力してください' })
      return
    }
    if (pattern.test(ga4MeasurementId.trim())) {
      setGa4TestResult({ ok: true, message: '形式が正しいです（G-XXXXXXXXXX形式）' })
    } else {
      setGa4TestResult({ ok: false, message: '形式が正しくありません。G-XXXXXXXXXX形式で入力してください' })
    }
  }

  const handleReset = () => {
    resetStore()
    router.push('/setup')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-muted-foreground">APIキーや計測スケジュールを管理します</p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>APIキー設定</CardTitle>
          <CardDescription>
            各サービスのAPIキーを入力してください。キーはブラウザのlocalStorageに保存されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {apiKeyFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={field.key}
                    type={showKeys[field.key] ? 'text' : 'password'}
                    placeholder={field.placeholder}
                    value={apiKeys[field.key]}
                    onChange={(e) =>
                      setApiKeys((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() =>
                      setShowKeys((prev) => ({
                        ...prev,
                        [field.key]: !prev[field.key],
                      }))
                    }
                  >
                    {showKeys[field.key] ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveApiKey(field.key)}
                  className="shrink-0"
                >
                  {savedKeys[field.key] ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{field.description}</p>
            </div>
          ))}
          <Button onClick={handleSaveAllKeys} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            すべてのAPIキーを保存
          </Button>
        </CardContent>
      </Card>

      {/* Gmail Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Gmail OAuth 2.0 連携</CardTitle>
          <CardDescription>
            掲載依頼メールをGmailから直接送信できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Gmail接続</p>
              <p className="text-xs text-muted-foreground">
                接続するとアウトリーチメールをワンクリックで送信できます
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // Gmail OAuth would be implemented here
                // For now, simulate with a link to Gmail compose
                window.open('https://mail.google.com/mail/?view=cm', '_blank')
              }}
            >
              <Link className="h-4 w-4 mr-2" />
              Gmail で開く
            </Button>
          </div>
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            ※ 完全なOAuth連携には追加の実装が必要です。現在はGmail Compose URLを使って送信できます。
          </p>
        </CardContent>
      </Card>

      {/* Google Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Google 連携</CardTitle>
          <CardDescription>
            提案資料をGoogleスライドに直接書き出せます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleConnected ? (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              連携済み{googleEmail ? `（${googleEmail}）` : ''}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Googleアカウント連携</p>
                <p className="text-xs text-muted-foreground">
                  提案資料をGoogleスライドに書き出せるようになります
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = `/api/auth/google?companyId=${encodeURIComponent(companyId)}`
                }}
              >
                <Link className="h-4 w-4 mr-2" />
                Googleアカウントで連携
              </Button>
            </div>
          )}
          {googleConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = `/api/auth/google?companyId=${encodeURIComponent(companyId)}`
              }}
            >
              <Link className="h-4 w-4 mr-2" />
              別のアカウントで再連携
            </Button>
          )}
          {googleMsg && (
            <p className={`text-xs px-2 py-1.5 rounded ${googleMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {googleMsg.text}
            </p>
          )}
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            スコープ: Google Slides（プレゼン作成のみ）。環境変数 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が必要です。
          </p>
        </CardContent>
      </Card>

      {/* WordPress Integration */}
      <Card>
        <CardHeader>
          <CardTitle>WordPress 連携</CardTitle>
          <CardDescription>
            Application Password を使ってWordPressサイトのコンテンツを直接更新できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wpConfig.connected && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              接続済み
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="wp-site-url">WordPress サイトURL</Label>
            <Input
              id="wp-site-url"
              type="url"
              placeholder="https://example.com"
              value={wpConfig.siteUrl}
              onChange={(e) => setWpConfig((prev) => ({ ...prev, siteUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-username">ユーザー名</Label>
            <Input
              id="wp-username"
              placeholder="admin"
              value={wpConfig.username}
              onChange={(e) => setWpConfig((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-app-password">Application Password</Label>
            <div className="relative">
              <Input
                id="wp-app-password"
                type={showWpPassword ? 'text' : 'password'}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={wpConfig.applicationPassword}
                onChange={(e) => setWpConfig((prev) => ({ ...prev, applicationPassword: e.target.value }))}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setShowWpPassword((p) => !p)}
              >
                {showWpPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              WordPress管理画面 → ユーザー → プロフィール → Application Passwords から生成できます
            </p>
          </div>
          {wpTestResult && (
            <div className={`rounded-md border px-3 py-2 text-sm ${wpTestResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {wpTestResult.message}
            </div>
          )}
          <Separator />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestWordPress} disabled={wpTesting} className="flex-1">
              {wpTesting ? (
                <><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />接続テスト中...</>
              ) : (
                <><Link className="h-4 w-4 mr-2" />接続テスト</>
              )}
            </Button>
            <Button onClick={handleSaveWordPress} className="flex-1">
              {wpSaved ? (
                <><CheckCircle className="h-4 w-4 mr-2 text-green-300" />保存しました</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />設定を保存</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* GA4 Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            GA4設定
          </CardTitle>
          <CardDescription>
            Google Analytics 4でAI経由の流入を計測できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-measurement-id">Measurement ID</Label>
            <Input
              id="ga4-measurement-id"
              placeholder="G-XXXXXXXXXX"
              value={ga4MeasurementId}
              onChange={(e) => {
                setGa4MeasurementId(e.target.value)
                setGa4TestResult(null)
              }}
            />
            <p className="text-xs text-muted-foreground">
              GA4管理画面 → データストリーム → ウェブストリーム詳細 から確認できます
            </p>
          </div>
          {ga4TestResult && (
            <div className={`rounded-md border px-3 py-2 text-sm ${ga4TestResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {ga4TestResult.message}
            </div>
          )}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 space-y-1">
            <p className="font-medium">AI経由流入の確認方法</p>
            <p>GA4でsource/mediumに <code className="bg-blue-100 px-1 rounded">perplexity.ai</code>、<code className="bg-blue-100 px-1 rounded">claude.ai</code>、<code className="bg-blue-100 px-1 rounded">chatgpt.com</code> 等が含まれるセッションがAI流入です。</p>
            <p>GA4 → レポート → 集客 → トラフィック獲得 → セッションのデフォルトチャンネルグループ で確認できます。</p>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestGa4} className="flex-1">
              <Link className="h-4 w-4 mr-2" />
              GA4接続テスト
            </Button>
            <Button onClick={handleSaveGa4} disabled={!store} className="flex-1">
              {ga4Saved ? (
                <><CheckCircle className="h-4 w-4 mr-2 text-green-300" />保存しました</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />設定を保存</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Measurement Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>自動計測スケジュール</CardTitle>
          <CardDescription>Vercel Cronで1日3回（09:00 / 13:00 / 18:00 JST）全勝ち筋プロンプトを自動計測します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">自動計測を有効にする</p>
              <p className="text-xs text-muted-foreground mt-0.5">ONにすると毎日3回、全勝ち筋プロンプトをClaudeで計測して結果をSupabaseに保存します</p>
            </div>
            <Switch
              id="auto-measure"
              checked={schedule.preset === 'three_times'}
              onCheckedChange={async (checked) => {
                const newSchedule = { ...schedule, preset: (checked ? 'three_times' : 'custom') as 'three_times' | 'custom' }
                setSchedule(newSchedule)
                saveMeasurementSchedule(newSchedule)
                // Supabaseにも保存
                try {
                  await fetch('/api/store', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'saveSchedule', enabled: checked, times: ['09:00', '13:00', '18:00'] }),
                  })
                } catch {}
              }}
            />
          </div>
          {schedule.preset === 'three_times' && (
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              ✓ 自動計測が有効です（09:00 / 13:00 / 18:00 JST）
            </div>
          )}
          <div className="flex gap-2">
            <button
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={async () => {
                try {
                  const res = await fetch('/api/cron/measure')
                  const data = await res.json()
                  alert(`手動計測完了: ${data.measuredCount ?? 0}件計測しました`)
                } catch {
                  alert('計測に失敗しました。APIキーとSupabase設定を確認してください。')
                }
              }}
            >
              今すぐ手動計測を実行
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Store Info Edit */}
      {store && (
        <Card>
          <CardHeader>
            <CardTitle>企業情報の編集</CardTitle>
            <CardDescription>初期設定で入力した情報を修正できます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>業種</Label>
              <Select
                value={(editStore as StoreInfo).businessType || store.businessType}
                onValueChange={(v) =>
                  setEditStore((prev) => ({ ...prev, businessType: v as BusinessType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(businessTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>企業名</Label>
              <Input
                value={(editStore as StoreInfo).name || store.name}
                onChange={(e) =>
                  setEditStore((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>ブランド名 <span className="text-xs text-muted-foreground ml-1">（企業名と異なる場合。例: 法人名が「株式会社◯◯」でもAIには「◯◯」で知られている場合）</span></Label>
              <Input
                placeholder="AIが認識しているブランド名（空白の場合は企業名を使用）"
                value={(editStore as StoreInfo).brandName || ''}
                onChange={(e) =>
                  setEditStore((prev) => ({ ...prev, brandName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>ブランドの概要・説明</Label>
              <Textarea
                value={(editStore as StoreInfo).description || store.description}
                onChange={(e) =>
                  setEditStore((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>強み・差別化ポイント</Label>
              <Textarea
                value={(editStore as StoreInfo).strengths || store.strengths}
                onChange={(e) =>
                  setEditStore((prev) => ({
                    ...prev,
                    strengths: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <Button
              onClick={handleSaveStore}
              className="w-full"
              variant={storeSaved ? 'outline' : 'default'}
            >
              {storeSaved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  保存しました
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  企業情報を保存
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">データのリセット</CardTitle>
          <CardDescription>
            すべてのデータを削除して初期設定からやり直します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setResetDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            すべてのデータをリセット
          </Button>
        </CardContent>
      </Card>

      {/* Reset Confirm */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>データをリセットしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              すべての企業情報・プロンプト・計測結果・APIキーが削除されます。
              この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              リセット実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
