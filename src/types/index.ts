// 業態
export type BusinessType = 'food' | 'beauty' | 'medical' | 'retail' | 'other'

// プロンプトカテゴリ
export type PromptCategory = 'sales' | 'awareness' | 'reputation'

// プロンプト難易度
export type PromptDifficulty = 'low' | 'med' | 'high'

// プロンプト優先度
export type PromptPriority = 'high' | 'medium' | 'low'

// 競合情報
export interface Competitor {
  id: string
  name: string
  url: string
}

// 掲載URL
export interface ListingUrl {
  id: string
  platform: string
  url: string
}

// 店舗情報
export interface StoreInfo {
  id: string
  businessType: BusinessType
  name: string
  websiteUrl: string
  listingUrls: ListingUrl[]
  description: string
  targetAudience: string
  strengths: string
  services: string
  achievements: string
  positioning: string
  competitors: Competitor[]
  createdAt: string
  updatedAt: string
}

// プロンプト
export interface Prompt {
  id: string
  text: string
  category: PromptCategory
  difficulty: PromptDifficulty
  priority: PromptPriority
  isWinning: boolean
  pseudoMemory: string
  createdAt: string
  updatedAt: string
}

// 計測プラットフォーム
export type Platform = 'claude' | 'gemini' | 'chatgpt' | 'perplexity'

// センチメント
export type Sentiment = 'positive' | 'neutral' | 'negative'

// 計測結果（個別）
export interface MeasurementResult {
  id: string
  promptId: string
  platform: Platform
  response: string
  mentioned: boolean
  mentionPosition: number | null
  sentiment: Sentiment
  positiveElements: string
  negativeElements: string
  citedUrls: string[]
  competitorMentions: Record<string, boolean>
  measuredAt: string
}

// 計測セッション
export interface MeasurementSession {
  id: string
  startedAt: string
  completedAt: string | null
  platforms: Platform[]
  results: MeasurementResult[]
}

// コンテンツ媒体タイプ
export type ContentMedium =
  | 'tabelog'
  | 'gurunavi'
  | 'retty'
  | 'rakuten'
  | 'hotpepper'
  | 'google_business'
  | 'owned_media'

// 生成コンテンツ
export interface GeneratedContent {
  id: string
  medium: ContentMedium
  title: string
  content: string
  promptIds: string[]
  generatedAt: string
  editedAt: string | null
}

// ウェブサイト改善提案
export interface WebsiteIssue {
  id: string
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  fixCode: string
  platform: 'wordpress' | 'html' | 'studio' | 'all'
}

export interface WebsiteAnalysis {
  id: string
  url: string
  analyzedAt: string
  issues: WebsiteIssue[]
}

// アウトリーチステータス
export type OutreachStatus = 'pending' | 'drafted' | 'sent' | 'confirmed'

// アウトリーチターゲット
export interface OutreachTarget {
  id: string
  mediaName: string
  mediaUrl: string
  competitorInfo: string
  contactEmail: string
  status: OutreachStatus
  draftEmail: string
  sentAt: string | null
  confirmedAt: string | null
  createdAt: string
}

// APIキー設定
export interface ApiKeys {
  anthropic: string
  openai: string
  gemini: string
  perplexity: string
  firecrawl: string
}

// Gmail設定
export interface GmailConfig {
  connected: boolean
  email: string
  accessToken: string | null
  refreshToken: string | null
}

// 計測スケジュール
export interface MeasurementSchedule {
  preset: 'three_times' | 'custom'
  customTimes: string[]
}

// アプリ全体のストア
export interface AppStore {
  store: StoreInfo | null
  prompts: Prompt[]
  measurementSessions: MeasurementSession[]
  generatedContents: GeneratedContent[]
  websiteAnalyses: WebsiteAnalysis[]
  outreachTargets: OutreachTarget[]
  apiKeys: ApiKeys
  gmailConfig: GmailConfig
  measurementSchedule: MeasurementSchedule
  setupCompleted: boolean
}
