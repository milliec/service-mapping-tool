import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const previewPassword = process.env.PREVIEW_PASSWORD;

  // If no password is configured, allow all traffic through.
  if (!previewPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Service Blueprint"' },
    });
  }

  // The Authorization header looks like: "Basic <base64-encoded username:password>"
  // We decode it to get the username and password the visitor entered.
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials); // decode from base64
  const [, password] = credentials.split(':'); // we only care about the password, not the username

  if (password !== previewPassword) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Service Blueprint"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
