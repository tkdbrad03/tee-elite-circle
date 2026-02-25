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

export default async function middleware(request) {
  const url = new URL(request.url);

  try {
    const cookie = request.headers.get('cookie') || '';

    const meUrl = new URL('/api/members/me', url.origin);

    const res = await fetch(meUrl.toString(), {
      headers: { cookie },
    });

    if (!res.ok) {
      url.pathname = '/member-login.html';
      return Response.redirect(url.toString(), 302);
    }

    return new Response(null, { status: 200 });
  } catch (e) {
    url.pathname = '/member-login.html';
    return Response.redirect(url.toString(), 302);
  }
}
