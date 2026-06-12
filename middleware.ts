import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.APP_PASSWORD || 'TL-Blog-2026!'
const COOKIE = 'tl_auth'

const PROTECTED = ['/generate', '/draft']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  // Already authenticated
  const cookie = req.cookies.get(COOKIE)
  if (cookie?.value === PASSWORD) return NextResponse.next()

  // Redirect to login, preserving the intended destination
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/generate/:path*', '/draft/:path*'],
}
