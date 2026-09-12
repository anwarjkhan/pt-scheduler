import Link from "next/link";
import { signOut } from "@/auth";
import { BRAND } from "@/lib/brand";
import { NavLinks } from "./nav-links";
import { LogOut } from "lucide-react";

export type NavItem = { href: string; label: string };

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`text-wordmark ${className}`}>
      <strong>{BRAND.mark}</strong>
      <span>{BRAND.rest}</span>
    </span>
  );
}

export function AppShell({
  nav,
  userLabel,
  children,
}: {
  nav: NavItem[];
  userLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-tjm-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href={nav[0].href} className="shrink-0">
            <Wordmark />
          </Link>
          <div className="hidden sm:block">
            <NavLinks items={nav} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm font-light text-white/70 sm:inline">{userLabel}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-white/10 px-2 sm:hidden">
          <NavLinks items={nav} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t bg-tjm-charcoal py-4 text-center text-xs font-light text-white/60">
        {BRAND.name}
      </footer>
    </div>
  );
}
