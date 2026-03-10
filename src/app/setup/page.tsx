'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSetupCompleted } from '@/lib/storage'
import { SetupWizard } from '@/components/setup/setup-wizard'

function SetupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === '1'
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // ?new=1 の場合はセットアップ済みでもウィザードを表示（追加会社モード）
    if (isSetupCompleted() && !isNew) {
      router.replace('/')
    } else {
      setChecked(true)
    }
  }, [router, isNew])

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  return <SetupWizard isNew={isNew} />
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-muted-foreground">読み込み中...</div>
        </div>
      }
    >
      <SetupPageInner />
    </Suspense>
  )
}
