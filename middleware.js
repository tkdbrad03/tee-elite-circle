import { NextResponse } from 'next/server';

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // protect these exact pages (edit list as needed)
  const protectedPaths = new Set([
    '/home.html',
    '/influence-on-the-course.html',
    '/between-the-tees.html',
    '/members.html',
    '/profile.html',
    '/playbook.html',
    '/tee-elite-invitational.html',
  ]);

  if (!protectedPaths.has(pathname)) return NextResponse.next();

  // Verify session by calling your existing auth endpoint WITH cookies
  try {
    const cookie = req.headers.get('cookie') || '';
    const meUrl = new URL('/api/members/me', req.url);

    const res = await fetch(meUrl, {
      headers: { cookie },
    });

    if (!res.ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/member-login.html';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch (e) {
    const url = req.nextUrl.clone();
    url.pathname = '/member-login.html';
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    '/home.html',
    '/influence-on-the-course.html',
    '/between-the-tees.html',
    '/members.html',
    '/profile.html',
    '/playbook.html',
    '/tee-elite-invitational.html',
  ],
};