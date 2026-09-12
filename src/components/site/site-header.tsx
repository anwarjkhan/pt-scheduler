import Image from "next/image";
import Link from "next/link";
import { auth, signIn, signOut, isDevLoginEnabled } from "@/auth";
import { db } from "@/lib/db";
import { SITE } from "@/content/site";
import { AccountMenu } from "./account-menu";
import { Button } from "@/components/ui/button";

/**
 * Site-wide header: logo, marketing nav, Register button and the account menu (which offers
 * sign-in when signed out). `calendar` is passed by the home page so the menu can show the
 * booking calendar in a modal; other pages navigate home to open it.
 */
export async function SiteHeader({ calendar, calendarOpen }: { calendar?: React.ReactNode; calendarOpen?: boolean } = {}) {
  const session = await auth();
  const user = session?.user;

  const badges = user
    ? user.role === "TRAINER"
      ? { pending: await db.booking.count({ where: { status: "PENDING", startAt: { gte: new Date() } } }) }
      : { upcoming: await db.booking.count({ where: { clientId: user.id, status: "ACCEPTED", startAt: { gte: new Date() } } }) }
    : {};

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  async function doSignIn(provider: "google" | "apple") {
    "use server";
    await signIn(provider, { redirectTo: "/" });
  }

  return (
    <header className="sticky top-0 z-40 bg-tjm-ink/95 text-white backdrop-blur supports-[backdrop-filter]:bg-tjm-ink/85">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="shrink-0" aria-label={SITE.name}>
          <Image src="/site/logo-white-linear.png" alt={SITE.name} width={1051} height={197} className="h-8 w-auto" priority />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {SITE.nav.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-2 font-heading text-sm font-semibold text-white/80 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!user && (
            <Button size="sm" className="font-heading font-semibold" nativeButton={false} render={<Link href="/register" />}>
              Register
            </Button>
          )}
          <AccountMenu
            user={user ? { name: user.name, email: user.email, image: user.image, role: user.role } : null}
            badges={badges}
            calendar={calendar}
            calendarOpen={calendarOpen}
            providers={{ google: !!process.env.AUTH_GOOGLE_ID, apple: !!process.env.AUTH_APPLE_ID, dev: isDevLoginEnabled }}
            signInAction={doSignIn}
            signOutAction={doSignOut}
          />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-1 md:hidden">
        {SITE.nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap px-3 py-1.5 font-heading text-sm font-semibold text-white/80">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
