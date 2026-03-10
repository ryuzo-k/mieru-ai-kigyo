/**
 * db.ts — Supabaseを使ったデータアクセス層
 * localStorageの代わりにSupabaseに保存・取得する
 */
import { createClient } from '@supabase/supabase-js'
import type { StoreInfo, Prompt, MeasurementResult, ApiKeys, MeasurementSchedule, GeneratedContent, WebsiteAnalysis } from '@/types'
import type { ContentSuggestion } from '@/app/api/suggest-contents/route'

const DEFAULT_COMPANY_ID = 'company_default'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── StoreInfo ─────────────────────────────────────────────────────────────

export async function getStoreFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<StoreInfo | null> {
  const { data, error } = await getClient()
    .from('store_info')
    .select('*')
    .eq('id', companyId)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    businessType: data.business_type,
    name: data.name,
    brandName: data.brand_name || '',
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

export async function saveStoreToDB(store: StoreInfo, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('store_info').upsert({
    id: companyId,
    business_type: store.businessType,
    name: store.name,
    brand_name: store.brandName || '',
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

export async function getAllCompaniesFromDB(): Promise<StoreInfo[]> {
  const { data, error } = await getClient()
    .from('store_info')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((d) => ({
    id: d.id,
    businessType: d.business_type,
    name: d.name,
    brandName: d.brand_name || '',
    websiteUrl: d.website_url,
    listingUrls: [],
    description: d.description,
    targetAudience: d.target_audience,
    strengths: d.strengths,
    services: d.services,
    achievements: d.achievements,
    positioning: d.positioning,
    competitors: d.competitors || [],
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }))
}

export async function createCompanyInDB(store: StoreInfo): Promise<void> {
  await getClient().from('store_info').upsert({
    id: store.id,
    business_type: store.businessType,
    name: store.name,
    brand_name: store.brandName || '',
    website_url: store.websiteUrl,
    description: store.description,
    target_audience: store.targetAudience,
    strengths: store.strengths,
    services: store.services,
    achievements: store.achievements,
    positioning: store.positioning,
    competitors: store.competitors,
    created_at: store.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}

export async function deleteCompanyFromDB(companyId: string): Promise<void> {
  await getClient().from('store_info').delete().eq('id', companyId)
}

// ── Prompts ───────────────────────────────────────────────────────────────

export async function getPromptsFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<Prompt[]> {
  const { data, error } = await getClient()
    .from('prompts')
    .select('*')
    .eq('company_id', companyId)
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

export async function savePromptToDB(prompt: Prompt, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('prompts').upsert({
    id: prompt.id,
    company_id: companyId,
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

export async function savePromptsToDB(prompts: Prompt[], companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  if (prompts.length === 0) return
  await getClient().from('prompts').upsert(
    prompts.map((p) => ({
      id: p.id,
      company_id: companyId,
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

export async function saveMeasurementResultToDB(result: MeasurementResult, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  const r = result as MeasurementResult & {
    citedContext?: string
    citedCompetitors?: string[]
    competitorRankings?: { name: string; rank: number; snippet: string }[]
    rawResponses?: string[]
  }
  await getClient().from('measurement_results').upsert({
    id: result.id,
    company_id: companyId,
    prompt_id: result.promptId,
    platform: result.platform,
    response: result.response,
    mentioned: result.mentioned,
    mention_position: result.mentionPosition,
    sentiment: result.sentiment,
    positive_elements: result.positiveElements,
    negative_elements: result.negativeElements,
    cited_urls: result.citedUrls,
    cited_context: r.citedContext || '',
    cited_competitors: r.citedCompetitors || [],
    competitor_mentions: result.competitorMentions,
    competitor_rankings: r.competitorRankings || [],
    raw_responses: r.rawResponses || [],
    measured_at: result.measuredAt,
  })
}

export async function getMeasurementResultsFromDB(promptId?: string, companyId?: string): Promise<MeasurementResult[]> {
  let query = getClient()
    .from('measurement_results')
    .select('*')
    .order('measured_at', { ascending: false })
    .limit(500)
  if (promptId) query = query.eq('prompt_id', promptId)
  if (companyId) query = query.eq('company_id', companyId)
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
    competitorRankings: d.competitor_rankings || [],
    rawResponses: d.raw_responses || [],
    measuredAt: d.measured_at,
  }))
}

// ── API Keys ──────────────────────────────────────────────────────────────

export async function getApiKeysFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<ApiKeys> {
  const { data } = await getClient()
    .from('api_keys')
    .select('*')
    .eq('id', companyId)
    .single()
  return {
    anthropic: data?.anthropic || '',
    openai: data?.openai || '',
    gemini: data?.gemini || '',
    perplexity: data?.perplexity || '',
    firecrawl: data?.firecrawl || '',
  }
}

export async function saveApiKeysToDB(keys: ApiKeys, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('api_keys').upsert({
    id: companyId,
    anthropic: keys.anthropic,
    openai: keys.openai,
    gemini: keys.gemini,
    perplexity: keys.perplexity,
    firecrawl: keys.firecrawl,
    updated_at: new Date().toISOString(),
  })
}

// ── Measurement Schedule ───────────────────────────────────────────────────

export async function getMeasurementScheduleFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<MeasurementSchedule & { enabled: boolean }> {
  const { data } = await getClient()
    .from('measurement_schedule')
    .select('*')
    .eq('id', companyId)
    .single()
  return {
    preset: 'three_times',
    customTimes: data?.times || ['09:00', '13:00', '18:00'],
    enabled: data?.enabled ?? false,
  }
}

export async function saveMeasurementScheduleToDB(schedule: { enabled: boolean; times: string[] }, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('measurement_schedule').upsert({
    id: companyId,
    enabled: schedule.enabled,
    times: schedule.times,
    updated_at: new Date().toISOString(),
  })
}

export async function updateLastRunAt(companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('measurement_schedule').upsert({
    id: companyId,
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

// ── Content Suggestions ────────────────────────────────────────────────────

export async function getContentSuggestionsFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<ContentSuggestion[]> {
  const { data, error } = await getClient()
    .from('content_suggestions')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((d) => ({
    id: d.id,
    type: d.type as ContentSuggestion['type'],
    typeLabel: d.type_label,
    title: d.title,
    angle: d.angle,
    coverageType: d.coverage_type as 'multi' | 'single',
    coveredPromptIds: d.covered_prompt_ids || [],
    coveredPromptTexts: d.covered_prompt_texts || [],
    whyNow: d.why_now,
    estimatedImpact: d.estimated_impact as 'high' | 'medium' | 'low',
    keyRequirements: d.key_requirements || [],
  }))
}

export async function saveContentSuggestionsToDB(suggestions: ContentSuggestion[], companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  if (suggestions.length === 0) return
  // Delete existing suggestions for this company before inserting new ones
  await getClient().from('content_suggestions').delete().eq('company_id', companyId)
  await getClient().from('content_suggestions').insert(
    suggestions.map((s) => ({
      id: s.id,
      company_id: companyId,
      type: s.type,
      type_label: s.typeLabel,
      title: s.title,
      angle: s.angle,
      coverage_type: s.coverageType,
      covered_prompt_ids: s.coveredPromptIds,
      covered_prompt_texts: s.coveredPromptTexts,
      why_now: s.whyNow,
      estimated_impact: s.estimatedImpact,
      key_requirements: s.keyRequirements,
    }))
  )
}

export async function deleteContentSuggestionsFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('content_suggestions').delete().eq('company_id', companyId)
}

// ── Generated Contents ─────────────────────────────────────────────────────

export async function getGeneratedContentsFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<GeneratedContent[]> {
  const { data, error } = await getClient()
    .from('generated_contents')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((d) => ({
    id: d.id,
    medium: d.type as GeneratedContent['medium'],
    title: d.title,
    content: d.content,
    promptIds: d.prompt_ids || [],
    generatedAt: d.created_at,
    editedAt: d.updated_at !== d.created_at ? d.updated_at : null,
  }))
}

export async function saveGeneratedContentToDB(content: GeneratedContent, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('generated_contents').upsert({
    id: content.id,
    company_id: companyId,
    type: content.medium,
    type_label: content.medium,
    title: content.title,
    content: content.content,
    prompt_ids: content.promptIds,
    created_at: content.generatedAt,
    updated_at: content.editedAt || content.generatedAt,
  })
}

export async function updateGeneratedContentInDB(id: string, updates: Partial<GeneratedContent>): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.title !== undefined) patch.title = updates.title
  if (updates.content !== undefined) patch.content = updates.content
  if (updates.medium !== undefined) patch.type = updates.medium
  if (updates.promptIds !== undefined) patch.prompt_ids = updates.promptIds
  await getClient().from('generated_contents').update(patch).eq('id', id)
}

// ── Website Analyses ────────────────────────────────────────────────────────

export async function getWebsiteAnalysesFromDB(companyId: string = DEFAULT_COMPANY_ID): Promise<WebsiteAnalysis[]> {
  const { data, error } = await getClient()
    .from('website_analyses')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((d) => ({
    id: d.id,
    url: d.url,
    analyzedAt: d.created_at,
    issues: (d.analysis as { issues?: WebsiteAnalysis['issues'] })?.issues || [],
  }))
}

export async function saveWebsiteAnalysisToDB(analysis: WebsiteAnalysis, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await getClient().from('website_analyses').upsert({
    id: analysis.id,
    company_id: companyId,
    url: analysis.url,
    analysis: { issues: analysis.issues, analyzedAt: analysis.analyzedAt },
    created_at: analysis.analyzedAt,
  })
}
