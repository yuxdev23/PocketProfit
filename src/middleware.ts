import { NextResponse, type NextRequest } from "next/server";

// Lightweight gate: bounce unauthenticated visitors to /login based on the
// presence of the `session` cookie. This is a UX shortcut only — real session
// validation (token lookup + expiry) happens server-side in getCurrentUser /
// requireUser, since the Edge middleware cannot reach Prisma/SQLite.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything EXCEPT the public auth pages, Next internals, the API,
  // and files with an extension (static assets like .svg, .ico, .png, ...).
  matcher: ["/((?!login|signup|_next|api|.*\\.[^/]+$).*)"],
};
