import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';

  // Extract the subdomain (e.g., "ethnic" from "ethnic.localhost:3000")
  const currentHost = hostname.split('.')[0];

  // Skip rewrite for root domain or basic localhost
  if (currentHost === 'localhost' || currentHost === 'www') {
    return NextResponse.next();
  }

  // Route request to the subdomain folder
  url.pathname = `/sites/${currentHost}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};