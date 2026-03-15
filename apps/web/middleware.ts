import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth/', '/api/', '/_next/', '/favicon.ico', '/privacy', '/terms'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic || pathname === '/') {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/auth/discord', request.url);
  loginUrl.searchParams.set('returnTo', pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
