import { NextRequest, NextResponse } from 'next/server'

export interface CompetitorBlogAnalysis {
  competitorName: string
  blogUrl: string
  contentTypes: {
    type: 'owned_media_article' | 'lp' | 'whitepaper' | 'note' | 'press_release'
    label: string
    frequency: 'high' | 'medium' | 'low'
    geoScore: number // 0-100 (GEO最適化度)
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

export interface CompetitorBlogReport {
  analyses: CompetitorBlogAnalysis[]
  overallRecommendation: {
    topContentType: string
    whyItWins: string
    quickWins: string[]
    contentCalendarSuggestion: string
  }
}

async function scrapeUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiEL-GEO-Bot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    // Strip tags roughly
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000)
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      competitors,
      companyName,
      industry,
      targetPrompts,
      apiKey: clientApiKey,
    }: {
      competitors: { name: string; url: string }[]
      companyName: string
      industry: string
      targetPrompts: string[]
      apiKey?: string
    } = await request.json()

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic APIキーが必要です' }, { status: 400 })
    }

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ error: '競合企業を少なくとも1社入力してください' }, { status: 400 })
    }

    // 各競合のサイトを取得
    const scrapedData: { name: string; url: string; content: string }[] = []
    for (const comp of competitors.slice(0, 5)) {
      if (!comp.url) continue
      const blogUrl = comp.url.replace(/\/$/, '') + '/blog'
      const mainContent = await scrapeUrl(comp.url)
      const blogContent = await scrapeUrl(blogUrl)
      scrapedData.push({
        name: comp.name,
        url: comp.url,
        content: mainContent + '\n\n[ブログページ]\n' + blogContent,
      })
    }

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の専門家です。
競合企業のウェブサイト・ブログコンテンツを分析し、クライアント企業が取るべき最適なコンテンツ戦略を提案してください。

分析の観点：
1. 競合がどのタイプのコンテンツ（記事/LP/ホワイトペーパー/note/プレスリリース）に注力しているか
2. 各コンテンツのGEO最適化度（AIが引用しやすい構造か、情報密度は高いか）
3. どのコンテンツタイプがAI検索で最も有利か
4. クライアントが「空白地帯」として狙えるコンテンツ戦略

必ず以下のJSON形式で返してください（マークダウン不要）：
{
  "analyses": [
    {
      "competitorName": "企業名",
      "blogUrl": "URL",
      "contentTypes": [
        {
          "type": "owned_media_article" | "lp" | "whitepaper" | "note" | "press_release",
          "label": "日本語ラベル",
          "frequency": "high" | "medium" | "low",
          "geoScore": 0-100,
          "avgWordCount": 数値,
          "topicPatterns": ["トピックパターン1", "トピックパターン2"]
        }
      ],
      "recommendedStrategy": {
        "primaryType": "最も効果的なコンテンツタイプ",
        "reasoning": "理由",
        "estimatedGeoImpact": "high" | "medium" | "low",
        "suggestedTopics": ["推奨トピック1", "推奨トピック2", "推奨トピック3"]
      }
    }
  ],
  "overallRecommendation": {
    "topContentType": "最も推奨するコンテンツタイプ",
    "whyItWins": "なぜこのコンテンツタイプが有効か（GEO観点で）",
    "quickWins": ["すぐに実施できる施策1", "施策2", "施策3"],
    "contentCalendarSuggestion": "コンテンツカレンダーの提案（月次）"
  }
}`

    const competitorSummary = scrapedData.map((d) =>
      `【${d.name}】URL: ${d.url}\nコンテンツ:\n${d.content.substring(0, 1500)}`
    ).join('\n\n---\n\n')

    const userPrompt = `クライアント企業: ${companyName}
業種: ${industry}
狙うプロンプト例: ${targetPrompts.slice(0, 5).join(' / ')}

競合企業情報:
${competitorSummary}

上記をもとに、GEO観点でのコンテンツ戦略分析と最適なコンテンツ形式の提案をしてください。`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `Claude APIエラー: ${error}` }, { status: response.status })
    }

    const data = await response.json()
    const content = data.content[0]?.text || ''

    let parsed: CompetitorBlogReport
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error('JSONの解析に失敗しました')
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Competitor blog analysis error:', error)
    return NextResponse.json(
      { error: '競合ブログ分析に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
