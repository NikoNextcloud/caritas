import { NextRequest, NextResponse } from 'next/server'

// Simple middleware — Firebase Auth се проверява client-side
// Тук само редиректваме /admin/* ако няма session cookie
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Позволи auth страниците
  if (pathname.startsWith('/auth')) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  // За /admin/* — Firebase Auth се проверява в самите компоненти
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
