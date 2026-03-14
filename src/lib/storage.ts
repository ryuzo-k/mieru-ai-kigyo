import {
  AppStore,
  StoreInfo,
  Prompt,
  MeasurementSession,
  GeneratedContent,
  WebsiteAnalysis,
  OutreachTarget,
  ApiKeys,
  GmailConfig,
  MeasurementSchedule,
  WordPressConfig,
  ContentPattern,
} from '@/types'

const STORAGE_KEY = 'miel_for_stores'

const defaultStore: AppStore = {
  store: null,
  prompts: [],
  measurementSessions: [],
  generatedContents: [],
  websiteAnalyses: [],
  outreachTargets: [],
  apiKeys: {
    anthropic: '',
    openai: '',
    gemini: '',
    perplexity: '',
    firecrawl: '',
    serpapi: '',
  },
  gmailConfig: {
    connected: false,
    email: '',
    accessToken: null,
    refreshToken: null,
  },
  measurementSchedule: {
    preset: 'three_times',
    customTimes: ['09:00', '13:00', '18:00'],
  },
  wordPressConfig: {
    siteUrl: '',
    username: '',
    applicationPassword: '',
    connected: false,
  },
  contentPatterns: [],
  setupCompleted: false,
}

export function getStore(): AppStore {
  if (typeof window === 'undefined') return defaultStore
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return defaultStore
    return { ...defaultStore, ...JSON.parse(data) }
  } catch {
    return defaultStore
  }
}

export function saveStore(data: Partial<AppStore>): AppStore {
  const current = getStore()
  const updated = { ...current, ...data }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function getStoreInfo(): StoreInfo | null {
  return getStore().store
}

export function saveStoreInfo(info: StoreInfo): void {
  saveStore({ store: info })
}

export function getPrompts(): Prompt[] {
  return getStore().prompts
}

export function savePrompts(prompts: Prompt[]): void {
  saveStore({ prompts })
}

export function addPrompt(prompt: Prompt): void {
  const prompts = getPrompts()
  saveStore({ prompts: [...prompts, prompt] })
}

export function updatePrompt(id: string, data: Partial<Prompt>): void {
  const prompts = getPrompts().map((p) => (p.id === id ? { ...p, ...data } : p))
  saveStore({ prompts })
}

export function deletePrompt(id: string): void {
  const prompts = getPrompts().filter((p) => p.id !== id)
  saveStore({ prompts })
}

export function getMeasurementSessions(): MeasurementSession[] {
  return getStore().measurementSessions
}

export function addMeasurementSession(session: MeasurementSession): void {
  const sessions = getMeasurementSessions()
  saveStore({ measurementSessions: [...sessions, session] })
}

export function updateMeasurementSession(
  id: string,
  data: Partial<MeasurementSession>
): void {
  const sessions = getMeasurementSessions().map((s) =>
    s.id === id ? { ...s, ...data } : s
  )
  saveStore({ measurementSessions: sessions })
}

export function getGeneratedContents(): GeneratedContent[] {
  return getStore().generatedContents
}

export function saveGeneratedContents(contents: GeneratedContent[]): void {
  saveStore({ generatedContents: contents })
}

export function getWebsiteAnalyses(): WebsiteAnalysis[] {
  return getStore().websiteAnalyses
}

export function addWebsiteAnalysis(analysis: WebsiteAnalysis): void {
  const analyses = getWebsiteAnalyses()
  saveStore({ websiteAnalyses: [...analyses, analysis] })
}

export function getOutreachTargets(): OutreachTarget[] {
  return getStore().outreachTargets
}

export function saveOutreachTargets(targets: OutreachTarget[]): void {
  saveStore({ outreachTargets: targets })
}

export function getApiKeys(): ApiKeys {
  return getStore().apiKeys
}

export function saveApiKeys(keys: Partial<ApiKeys>): void {
  const current = getStore().apiKeys
  saveStore({ apiKeys: { ...current, ...keys } })
}

export function getGmailConfig(): GmailConfig {
  return getStore().gmailConfig
}

export function saveGmailConfig(config: Partial<GmailConfig>): void {
  const current = getStore().gmailConfig
  saveStore({ gmailConfig: { ...current, ...config } })
}

export function getMeasurementSchedule(): MeasurementSchedule {
  return getStore().measurementSchedule
}

export function saveMeasurementSchedule(schedule: Partial<MeasurementSchedule>): void {
  const current = getStore().measurementSchedule
  saveStore({ measurementSchedule: { ...current, ...schedule } })
}

export function isSetupCompleted(): boolean {
  return getStore().setupCompleted
}

export function completeSetup(): void {
  saveStore({ setupCompleted: true })
}

export function getWordPressConfig(): WordPressConfig {
  return getStore().wordPressConfig
}

export function saveWordPressConfig(config: Partial<WordPressConfig>): void {
  const current = getStore().wordPressConfig
  saveStore({ wordPressConfig: { ...current, ...config } })
}

export function getContentPatterns(): ContentPattern[] {
  return getStore().contentPatterns ?? []
}

export function saveContentPatterns(patterns: ContentPattern[]): void {
  saveStore({ contentPatterns: patterns })
}

export function addContentPattern(pattern: ContentPattern): void {
  const patterns = getContentPatterns()
  saveStore({ contentPatterns: [...patterns, pattern] })
}

export function deleteContentPattern(id: string): void {
  const patterns = getContentPatterns().filter((p) => p.id !== id)
  saveStore({ contentPatterns: patterns })
}

export function resetStore(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
