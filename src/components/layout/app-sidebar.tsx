'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  FileText,
  Globe,
  Mail,
  Settings,
  Zap,
  Building2,
  Presentation,
  FileSignature,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const navItems = [
  {
    title: 'ダッシュボード',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'プロンプト管理',
    href: '/prompts',
    icon: MessageSquare,
  },
  {
    title: '計測・分析',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    title: 'コンテンツ制作',
    href: '/content',
    icon: FileText,
  },
  {
    title: 'ウェブサイト改善',
    href: '/website',
    icon: Globe,
  },
  {
    title: 'メディア・PRアウトリーチ',
    href: '/outreach',
    icon: Mail,
  },
  {
    title: '提案資料',
    href: '/proposals',
    icon: Presentation,
  },
  {
    title: '契約書',
    href: '/contracts',
    icon: FileSignature,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company') ?? ''
  const companySuffix = companyId ? `?company=${companyId}` : ''

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">MiEL for Kigyo</p>
            <p className="text-xs text-muted-foreground">企業向けGEO対策ツール</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                  >
                    <Link href={`${item.href}${companySuffix}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/settings'}
            >
              <Link href={`/settings${companySuffix}`}>
                <Settings className="h-4 w-4" />
                <span>設定</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/companies">
                <Building2 className="h-4 w-4" />
                <span>← 企業一覧に戻る</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
