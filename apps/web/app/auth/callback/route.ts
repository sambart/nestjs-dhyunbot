import { type NextRequest, NextResponse } from 'next/server';

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

  const returnTo = request.cookies.get('returnTo')?.value;
  const redirectPath = returnTo || '/select-guild';
  const response = NextResponse.redirect(new URL(redirectPath, origin));
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1h
    path: '/',
  });

  if (returnTo) {
    response.cookies.delete('returnTo');
  }

  return response;
}
