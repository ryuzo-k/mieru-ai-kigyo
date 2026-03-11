'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { CompanyContext } from '@/context/company-context'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checked, setChecked] = useState(false)
  const [companyId, setCompanyId] = useState('company_default')

  useEffect(() => {
    // Supabaseベースのため、localStorage setupチェックをスキップして
    // ?company= パラメータがなければ企業一覧に誘導する
    const cid = searchParams.get('company')
    if (!cid) {
      router.replace('/companies')
      return
    }
    setCompanyId(cid)
    setChecked(true)
  }, [router, searchParams])

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  return (
    <CompanyContext.Provider value={{ companyId, setCompanyId }}>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-1 flex-col min-w-0">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </CompanyContext.Provider>
  )
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-muted-foreground">読み込み中...</div>
        </div>
      }
    >
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  )
}
