'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MeasurementResult } from '@/types'

interface Props {
  promptText: string
  result: MeasurementResult
  storeName: string
}

export function PromptDetailPanel({ promptText, result: r, storeName }: Props) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm line-clamp-2">{promptText}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {/* センチメント */}
        <div className="flex gap-3 flex-wrap">
          {r.positiveElements && (
            <div className="flex-1 min-w-[160px] rounded bg-green-50 border border-green-200 px-3 py-2">
              <p className="text-xs font-medium text-green-700 mb-1">ポジティブ要素</p>
              <p className="text-xs text-green-800">{r.positiveElements}</p>
            </div>
          )}
          {r.negativeElements && (
            <div className="flex-1 min-w-[160px] rounded bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-xs font-medium text-red-700 mb-1">ネガティブ要素</p>
              <p className="text-xs text-red-800">{r.negativeElements}</p>
            </div>
          )}
        </div>

        {/* AI言及文脈 */}
        {r.citedContext && (
          <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs font-medium text-amber-700 mb-1">AIの言及文脈</p>
            <p className="text-xs text-amber-800">{r.citedContext}</p>
          </div>
        )}

        {/* 競合順位 */}
        {(r.competitorRankings ?? []).length > 0 && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs font-medium text-red-700 mb-2">競合の出現順位</p>
            <div className="space-y-1.5">
              {[...(r.competitorRankings ?? [])].sort((a, b) => a.rank - b.rank).map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="rounded-full bg-red-200 text-red-800 text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0">
                    {c.rank === 99 ? '-' : c.rank}
                  </span>
                  <div>
                    <span className="text-xs font-medium text-red-800">{c.name}</span>
                    {c.snippet && (
                      <p className="text-[10px] text-red-600 mt-0.5">&ldquo;{c.snippet}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 被引用サイト */}
        {r.citedUrls.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">被引用サイト（AIが参照した情報源）</p>
            <div className="flex flex-wrap gap-1.5">
              {r.citedUrls.map((url, i) => {
                let display = url
                try { display = new URL(url).hostname } catch {}
                return (
                  <a
                    key={i}
                    href={url.startsWith('http') ? url : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />{display}
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* AIの実際の回答 3回分 */}
        {(r.rawResponses ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              AIの実際の回答（{(r.rawResponses ?? []).length}回分）
            </p>
            <div className="space-y-2">
              {(r.rawResponses ?? []).map((resp, i) => {
                const hit = resp.toLowerCase().includes(storeName.toLowerCase())
                return (
                  <details key={i}>
                    <summary
                      className={cn(
                        "cursor-pointer select-none text-xs px-3 py-2 rounded border",
                        hit
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-muted/40 border-border text-muted-foreground"
                      )}
                    >
                      試行 {i + 1} {hit ? "✓ 言及あり" : "— 言及なし"}
                    </summary>
                    <pre className="mt-1 text-xs leading-relaxed font-sans whitespace-pre-wrap px-3 py-2 bg-muted/20 rounded border">
                      {resp}
                    </pre>
                  </details>
                )
              })}
            </div>
          </div>
        )}

        {!r.citedContext &&
          (r.competitorRankings ?? []).length === 0 &&
          r.citedUrls.length === 0 &&
          (r.rawResponses ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              詳細データがありません。再計測すると表示されます。
            </p>
          )}
      </CardContent>
    </Card>
  )
}
