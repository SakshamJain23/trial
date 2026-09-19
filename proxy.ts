import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // CATALOG ROUTE ESCAPE HATCH
  if (url.pathname.startsWith('/catalog')) {
    return NextResponse.next();
  }

  const hostname = req.headers.get('host') || '';
  const currentHost = hostname.split('.')[0];

  if (currentHost === 'localhost:3000' || currentHost === 'localhost' || currentHost === 'www') {
    return NextResponse.next();
  }

  url.pathname = `/sites/${currentHost}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};