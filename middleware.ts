import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { getAuthSessionOverrideUser } from "@/lib/authSessionOverride";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);
const authOverrideUser = getAuthSessionOverrideUser();

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth || !!authOverrideUser;
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  if (isApiRoute && !nextUrl.pathname.startsWith('/api/auth') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const fetchSite = req.headers.get('sec-fetch-site');
    if ((origin && origin !== nextUrl.origin) || fetchSite === 'cross-site') return NextResponse.json({ error: { message: 'Invalid origin' } }, { status: 403 });
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    /^\/login$/, /^\/api\/auth(?:\/|$)/, /^\/api\/viewer$/,
    /^\/api\/guest\/(session|settings|claim)$/,
    /^\/api\/public\/templates(?:\/[^/]+\/start)?$/,
    /^\/api\/books(?:\/[^/]+(?:\/(?:name|draft|segments|summaries|chapters|memory)(?:\/(?:[^/]+))?)?)?$/,
    /^\/api\/templates(?:\/[^/]+(?:\/merged)?)?$/,
    /^\/api\/ai(?:\/tts(?:\/models\/(?:openai|together))?|\/models\/(?:openai|together))?$/,
  ];
  const publicPages = nextUrl.pathname === '/' || /^\/templates(?:\/[^/]+)?$/.test(nextUrl.pathname) || /^\/book\/[^/]+$/.test(nextUrl.pathname);
  const isPublicRoute = publicRoutes.some((route) => route.test(nextUrl.pathname));

  if (isPublicRoute || publicPages || nextUrl.pathname === "/api/internal/cleanup") {
    // If user is logged in and trying to access login page, redirect to home
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Handle unauthenticated requests
  if (!isLoggedIn) {
    // For API routes, return JSON 401 response
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For pages, redirect to login
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
