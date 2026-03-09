'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupCompleted } from '@/lib/storage'
import { SetupWizard } from '@/components/setup/setup-wizard'

export default function SetupPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (isSetupCompleted()) {
      router.replace('/')
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  return <SetupWizard />
}
