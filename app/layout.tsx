import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Caritas Admin',
  description: 'Caritas Vitania Administrative Panel',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" data-theme="caritas">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
