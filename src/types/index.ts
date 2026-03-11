// 業態（企業向け）
export type BusinessType = 'food' | 'beauty' | 'medical' | 'retail' | 'other'

// ビジネスタイプのラベルマッピング（企業向け）
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  other: 'IT・SaaS',
  retail: '製造・メーカー',
  medical: '医療・ヘルスケア',
  beauty: 'コンサルティング・専門サービス',
  food: '小売・EC',
}

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

// 企業情報（StoreInfoを企業向けに流用）
export interface StoreInfo {
  id: string
  businessType: BusinessType
  name: string
  brandName?: string  // ブランド名（企業名と異なる場合）
  websiteUrl: string
  listingUrls: never[]  // 企業向けでは使用しない
  description: string
  targetAudience: string
  strengths: string
  services: string
  achievements: string
  positioning: string
  competitors: Competitor[]
  // ユーザージャーニー（プロンプト生成の核）
  userJourneyStages?: string  // 課題認識〜サービス選定の各ステージの詳細
  targetPersona?: string     // ターゲットの職種・役職・課題感
  brandDocuments?: string    // ブランド資料・会社紹介文など自由記述
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
  displayRate?: number  // 表示率（0-100%）
  citedSources?: string[]  // AIが引用したURL/情報源
  citedCompetitors?: string[]  // 引用された競合名
  citedContext?: string  // AIがどういう文脈で言及したか
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
  citedContext: string  // どういう文脈で言及されたか
  citedCompetitors: string[]  // 同時に言及された競合
  competitorMentions: Record<string, boolean>
  competitorRankings?: {name: string; rank: number; snippet: string}[]  // 競合の出現順位
  rawResponses?: string[]  // 3回分の実際のAI回答
  displayRate?: number  // 3回計測の表示率%
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

// コンテンツ媒体タイプ（企業向け）
export type ContentMedium =
  | 'owned_media_article'  // オウンドメディア記事
  | 'lp'                   // LP/サービスページ
  | 'whitepaper'           // ホワイトペーパー
  | 'press_release'        // プレスリリース
  | 'case_study'           // 事例記事
  | 'column'               // コラム/専門記事

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

// アウトリーチ種別（企業向け）
export type OutreachType = 'media_coverage' | 'mutual_link' | 'pr' | 'sponsored_content'

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
  outreachType: OutreachType
  targetRanking: number | null
  currentRanking: number | null
  focusPageUrl: string
  focusPageKeyword: string
  negotiationNote: string
}

// APIキー設定
export interface ApiKeys {
  anthropic: string
  openai: string
  gemini: string
  perplexity: string
  firecrawl: string
}

// WordPress連携設定
export interface WordPressConfig {
  siteUrl: string
  username: string
  applicationPassword: string
  connected: boolean
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

// コンテンツパターンテンプレート
export type ContentPatternType = 'owned_media_article' | 'lp' | 'whitepaper' | 'note' | 'press_release'

export interface ContentPattern {
  id: string
  type: ContentPatternType
  name: string
  pattern: string
  savedAt: string
}

// 競合ブログ分析結果
export interface CompetitorBlogAnalysis {
  competitorName: string
  blogUrl: string
  contentTypes: {
    type: ContentPatternType
    label: string
    frequency: 'high' | 'medium' | 'low'
    geoScore: number
    avgWordCount: number
    topicPatterns: string[]
  }[]
  recommendedStrategy: {
    primaryType: string
    reasoning: string
    estimatedGeoImpact: 'high' | 'medium' | 'low'
    suggestedTopics: string[]
  }
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
  wordPressConfig: WordPressConfig
  contentPatterns: ContentPattern[]
  setupCompleted: boolean
}
