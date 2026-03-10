/**
 * db.ts — Supabaseを使ったデータアクセス層
 * localStorageの代わりにSupabaseに保存・取得する
 */
import { createClient } from '@supabase/supabase-js'
import type { StoreInfo, Prompt, MeasurementResult, ApiKeys, MeasurementSchedule } from '@/types'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── StoreInfo ─────────────────────────────────────────────────────────────

export async function getStoreFromDB(): Promise<StoreInfo | null> {
  const { data, error } = await getClient()
    .from('store_info')
    .select('*')
    .eq('id', 'default')
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    businessType: data.business_type,
    name: data.name,
    websiteUrl: data.website_url,
    listingUrls: [],
    description: data.description,
    targetAudience: data.target_audience,
    strengths: data.strengths,
    services: data.services,
    achievements: data.achievements,
    positioning: data.positioning,
    competitors: data.competitors || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function saveStoreToDB(store: StoreInfo): Promise<void> {
  await getClient().from('store_info').upsert({
    id: 'default',
    business_type: store.businessType,
    name: store.name,
    website_url: store.websiteUrl,
    description: store.description,
    target_audience: store.targetAudience,
    strengths: store.strengths,
    services: store.services,
    achievements: store.achievements,
    positioning: store.positioning,
    competitors: store.competitors,
    updated_at: new Date().toISOString(),
  })
}

// ── Prompts ───────────────────────────────────────────────────────────────

export async function getPromptsFromDB(): Promise<Prompt[]> {
  const { data, error } = await getClient()
    .from('prompts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((d) => ({
    id: d.id,
    text: d.text,
    category: d.category,
    difficulty: d.difficulty,
    priority: d.priority,
    isWinning: d.is_winning,
    pseudoMemory: d.pseudo_memory,
    displayRate: d.display_rate ?? undefined,
    citedSources: d.cited_sources || [],
    citedCompetitors: d.cited_competitors || [],
    citedContext: d.cited_context || '',
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }))
}

export async function savePromptToDB(prompt: Prompt): Promise<void> {
  await getClient().from('prompts').upsert({
    id: prompt.id,
    text: prompt.text,
    category: prompt.category,
    difficulty: prompt.difficulty,
    priority: prompt.priority,
    is_winning: prompt.isWinning,
    pseudo_memory: prompt.pseudoMemory,
    display_rate: prompt.displayRate ?? null,
    cited_sources: prompt.citedSources || [],
    cited_competitors: prompt.citedCompetitors || [],
    cited_context: prompt.citedContext || '',
    updated_at: new Date().toISOString(),
  })
}

export async function savePromptsToDB(prompts: Prompt[]): Promise<void> {
  if (prompts.length === 0) return
  await getClient().from('prompts').upsert(
    prompts.map((p) => ({
      id: p.id,
      text: p.text,
      category: p.category,
      difficulty: p.difficulty,
      priority: p.priority,
      is_winning: p.isWinning,
      pseudo_memory: p.pseudoMemory,
      display_rate: p.displayRate ?? null,
      cited_sources: p.citedSources || [],
      cited_competitors: p.citedCompetitors || [],
      cited_context: p.citedContext || '',
      updated_at: new Date().toISOString(),
    }))
  )
}

export async function deletePromptFromDB(id: string): Promise<void> {
  await getClient().from('prompts').delete().eq('id', id)
}

// ── Measurement Results ────────────────────────────────────────────────────

export async function saveMeasurementResultToDB(result: MeasurementResult): Promise<void> {
  await getClient().from('measurement_results').upsert({
    id: result.id,
    prompt_id: result.promptId,
    platform: result.platform,
    response: result.response,
    mentioned: result.mentioned,
    mention_position: result.mentionPosition,
    sentiment: result.sentiment,
    positive_elements: result.positiveElements,
    negative_elements: result.negativeElements,
    cited_urls: result.citedUrls,
    cited_context: (result as MeasurementResult & { citedContext?: string }).citedContext || '',
    cited_competitors: (result as MeasurementResult & { citedCompetitors?: string[] }).citedCompetitors || [],
    competitor_mentions: result.competitorMentions,
    measured_at: result.measuredAt,
  })
}

export async function getMeasurementResultsFromDB(promptId?: string): Promise<MeasurementResult[]> {
  let query = getClient()
    .from('measurement_results')
    .select('*')
    .order('measured_at', { ascending: false })
    .limit(500)
  if (promptId) query = query.eq('prompt_id', promptId)
  const { data, error } = await query
  if (error || !data) return []
  return data.map((d) => ({
    id: d.id,
    promptId: d.prompt_id,
    platform: d.platform,
    response: d.response,
    mentioned: d.mentioned,
    mentionPosition: d.mention_position,
    sentiment: d.sentiment,
    positiveElements: d.positive_elements,
    negativeElements: d.negative_elements,
    citedUrls: d.cited_urls || [],
    citedContext: d.cited_context || '',
    citedCompetitors: d.cited_competitors || [],
    competitorMentions: d.competitor_mentions || {},
    measuredAt: d.measured_at,
  }))
}

// ── API Keys ──────────────────────────────────────────────────────────────

export async function getApiKeysFromDB(): Promise<ApiKeys> {
  const { data } = await getClient()
    .from('api_keys')
    .select('*')
    .eq('id', 'default')
    .single()
  return {
    anthropic: data?.anthropic || '',
    openai: data?.openai || '',
    gemini: data?.gemini || '',
    perplexity: data?.perplexity || '',
    firecrawl: data?.firecrawl || '',
  }
}

export async function saveApiKeysToDB(keys: ApiKeys): Promise<void> {
  await getClient().from('api_keys').upsert({
    id: 'default',
    anthropic: keys.anthropic,
    openai: keys.openai,
    gemini: keys.gemini,
    perplexity: keys.perplexity,
    firecrawl: keys.firecrawl,
    updated_at: new Date().toISOString(),
  })
}

// ── Measurement Schedule ───────────────────────────────────────────────────

export async function getMeasurementScheduleFromDB(): Promise<MeasurementSchedule & { enabled: boolean }> {
  const { data } = await getClient()
    .from('measurement_schedule')
    .select('*')
    .eq('id', 'default')
    .single()
  return {
    preset: 'three_times',
    customTimes: data?.times || ['09:00', '13:00', '18:00'],
    enabled: data?.enabled ?? false,
  }
}

export async function saveMeasurementScheduleToDB(schedule: { enabled: boolean; times: string[] }): Promise<void> {
  await getClient().from('measurement_schedule').upsert({
    id: 'default',
    enabled: schedule.enabled,
    times: schedule.times,
    updated_at: new Date().toISOString(),
  })
}

export async function updateLastRunAt(): Promise<void> {
  await getClient().from('measurement_schedule').upsert({
    id: 'default',
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}

// ── Prompt Trends ──────────────────────────────────────────────────────────

export interface PromptTrend {
  promptId: string
  promptText: string
  isWinning: boolean
  displayRate: number
  recentRate: number
  prevRate: number
  trendDelta: number // positive = rising
}

export async function getRisingPrompts(minDelta = 10): Promise<PromptTrend[]> {
  const { data, error } = await getClient()
    .from('prompt_trends')
    .select('*')
    .gte('trend_delta', minDelta)
    .eq('is_winning', false) // 勝ち筋じゃないものの中で上昇中
    .order('trend_delta', { ascending: false })
    .limit(5)
  if (error || !data) return []
  return data.map((d) => ({
    promptId: d.prompt_id,
    promptText: d.prompt_text,
    isWinning: d.is_winning,
    displayRate: d.display_rate ?? 0,
    recentRate: d.recent_rate ?? 0,
    prevRate: d.prev_rate ?? 0,
    trendDelta: d.trend_delta ?? 0,
  }))
}
