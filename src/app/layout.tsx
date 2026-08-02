import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yenpa ERP',
  description: 'Yenpa Ambalaj Üretim Yönetim Sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
