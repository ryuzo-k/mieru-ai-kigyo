import { NextRequest, NextResponse } from 'next/server'
import { StoreInfo, Prompt, ContentMedium } from '@/types'


const mediumLabels: Record<ContentMedium, string> = {
  owned_media_article: 'オウンドメディア記事',
  lp: 'LP/サービスページ',
  whitepaper: 'ホワイトペーパー',
  press_release: 'プレスリリース',
  case_study: '事例記事',
  column: 'コラム/専門記事',
}

const mediumInstructions: Record<ContentMedium, string> = {
  owned_media_article: 'GEO最適化されたブログ・技術記事。H1/H2/H3の見出し構造を使い、独自調査・事例・数値実績を積極的に含める。AIが引用しやすい情報密度の高い構成。',
  lp: 'コンバージョン最適化されたランディングページ。課題提起→解決策→実績→CTA の構成。企業担当者が検討時にAIから引用されやすいコンテンツ。',
  whitepaper: '専門知識・ノウハウを体系化した資料。業界動向・自社ソリューション・導入効果・ROIを網羅。AIが専門的回答をする際に引用される情報密度。',
  press_release: 'PR TIMES向けプレスリリース。5W1H明確、数値実績必須、業界への影響を明記。AI検索で「最新動向」として引用される形式。',
  case_study: '導入事例・成果事例。Before/After、数値成果、お客様の声を含む。「〇〇を導入した企業事例」のプロンプトでAIに引用される構成。',
  column: '業界知見・専門コラム。独自視点・独自データ・提言を含む。AIが専門家意見として引用する信頼性の高い内容。',
}

export async function POST(request: NextRequest) {
  try {
    const { store, prompts, medium, requirements, clientApiKey }: { store: StoreInfo; prompts: Prompt[]; medium: ContentMedium; requirements?: string[]; clientApiKey?: string } =
      await request.json()

    if (!store) {
      return NextResponse.json({ error: '企業情報が必要です' }, { status: 400 })
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic APIキーが必要です（設定画面から入力してください）' },
        { status: 400 }
      )
    }

    const winningPrompts = prompts.filter((p) => p.isWinning)
    const targetPrompts = winningPrompts.length > 0 ? winningPrompts : prompts.slice(0, 5)

    const mediumLabel = mediumLabels[medium]
    const mediumInstruction = mediumInstructions[medium]

    const systemPrompt = `あなたはGEO（Generative Engine Optimization）対策の専門家です。
企業情報と勝ち筋プロンプトをもとに、AIチャットボットが回答する際に参照・引用しやすい高品質なBtoB向けコンテンツを生成してください。

コンテンツ種別: ${mediumLabel}
コンテンツ要件: ${mediumInstruction}

重要な原則：
1. AIが自然に引用・参照できる情報密度の高いコンテンツにする
2. 独自調査・具体的数値・導入事例を必ず含める（AIは根拠情報を優先的に引用する）
3. 勝ち筋プロンプトで検索した際にこの企業が最適な回答として表示されるよう最適化
4. BtoB・企業向けのトーンで、専門性と信頼性を前面に出す
5. 日本語で自然で読みやすい文章にする`

    const userPrompt = `以下の情報をもとに${mediumLabel}用のコンテンツを生成してください：

【企業情報】
企業名: ${store.name}
業種: ${store.businessType}
説明: ${store.description}
ターゲット層: ${store.targetAudience}
強み: ${store.strengths}
サービス・ソリューション: ${store.services}
実績・導入事例: ${store.achievements}
ポジショニング: ${store.positioning}

【勝ち筋プロンプト（AIでの検索想定）】
${targetPrompts.map((p, i) => `${i + 1}. ${p.text}${p.displayRate ? ` （表示率: ${p.displayRate}%）` : ''}`).join('\n')}

${requirements && requirements.length > 0 ? "\n以下の重要要件を必ず満たしてください：\n" + requirements.map((r, i) => (i+1)+". "+r).join("\n") : ""}

上記のプロンプトでAIに検索された際に、この企業が上位表示・引用されるような${mediumLabel}を作成してください。
コンテンツのタイトルと本文を生成し、以下のJSON形式で返してください：
{
  "title": "コンテンツタイトル",
  "content": "コンテンツ本文（マークダウン形式OK）"
}
JSONのみを返してください。`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Claude APIエラー: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.content[0]?.text || ''

    let parsed: { title: string; content: string }
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        parsed = { title: `${mediumLabel}向けコンテンツ`, content }
      }
    }

    return NextResponse.json({ title: parsed.title, content: parsed.content })
  } catch (error) {
    console.error('Generate content error:', error)
    return NextResponse.json(
      { error: 'コンテンツ生成に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
