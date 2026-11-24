import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { AppProviders } from '@/components/app-providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'MediCloud | Nền tảng y tế số',
  description:
    'Nền tảng chăm sóc sức khỏe số kết nối người bệnh, bác sĩ và điều dưỡng trong một trải nghiệm an toàn, liền mạch.',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F7FA' },
    { media: '(prefers-color-scheme: dark)', color: '#172033' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
