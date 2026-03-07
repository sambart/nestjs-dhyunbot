import { NextRequest, NextResponse } from 'next/server';

function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}` : request.url;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const origin = getOrigin(request);

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=no_token', origin));
  }

  const response = NextResponse.redirect(new URL('/select-guild', origin));
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1h
    path: '/',
  });

  return response;
}
