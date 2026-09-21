import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Caritas Admin',
  description: 'Caritas Administrative Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  )
}
