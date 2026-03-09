import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MiEL for Stores - GEO対策ツール',
  description: '実店舗向けGenerative Engine Optimization対策ツール',
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
