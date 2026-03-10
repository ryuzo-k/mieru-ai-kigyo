import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MiEL for Kigyo - 企業向けGEO対策ツール',
  description: '企業向けGenerative Engine Optimization（GEO）対策ツール',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  )
}
