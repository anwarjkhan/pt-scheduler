import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { NavLinks } from "./nav-links";

export type NavItem = { href: string; label: string };

/** Booking-app pages: the site header on top, a charcoal sub-nav for the section, the site footer below. */
export function AppShell({ nav, title, children }: { nav: NavItem[]; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="bg-tjm-charcoal text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
          <span className="hidden py-3 font-heading text-sm font-semibold uppercase tracking-widest text-tjm-yellow sm:inline">{title}</span>
          <NavLinks items={nav} />
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
