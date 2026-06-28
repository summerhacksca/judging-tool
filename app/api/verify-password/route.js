import { NextResponse } from 'next/server';

export async function POST(request) {
  const { password } = await request.json();
  const sitePassword = process.env.SITE_ACCESS_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json(
      { error: 'Server misconfiguration: no password set.' },
      { status: 500 },
    );
  }

  if (password !== sitePassword) {
    return NextResponse.json(
      { error: 'Incorrect password.' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('site_verified', 'true', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Expire after 24 hours
    maxAge: 60 * 60 * 24,
  });

  return response;
}
