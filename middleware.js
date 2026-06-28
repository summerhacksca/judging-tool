import { NextResponse } from 'next/server';

export function middleware(request) {
  const verified = request.cookies.get('site_verified');

  if (verified?.value === 'true') {
    return NextResponse.next();
  }

  // Allow access to login page and the verify API route without verification
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/api/verify-password'
  ) {
    return NextResponse.next();
  }

  // Redirect to login, remembering where they were headed
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
