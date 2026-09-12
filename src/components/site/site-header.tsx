import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { SITE } from "@/content/site";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";

/**
 * Site-wide header: logo, marketing nav, and Sign in / Register or the signed-in user menu.
 * `calendar` (server-rendered booking wizard / trainer calendar) is passed by the home page so the
 * user menu can show it in a modal; other pages navigate home to open it.
 */
export async function SiteHeader({ calendar, calendarOpen }: { calendar?: React.ReactNode; calendarOpen?: boolean } = {}) {
  const session = await auth();
  const user = session?.user;

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
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
          {user ? (
            <UserMenu
              user={{ name: user.name, email: user.email, image: user.image, role: user.role }}
              calendar={calendar}
              calendarOpen={calendarOpen}
              signOutAction={doSignOut}
            />
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" nativeButton={false} render={<Link href="/signin" />}>
                Sign in
              </Button>
              <Button size="sm" className="font-heading font-semibold" nativeButton={false} render={<Link href="/register" />}>
                Register
              </Button>
            </>
          )}
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
