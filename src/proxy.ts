import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Route guard: /app/* requires sign-in, /trainer/* requires TRAINER role.
export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === "https:",
  });
  const { pathname } = req.nextUrl;

  if (!token) {
    const url = new URL("/", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/trainer") && token.role !== "TRAINER") {
    return NextResponse.redirect(new URL("/app", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/trainer/:path*"],
};
