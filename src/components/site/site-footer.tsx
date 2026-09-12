import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="bg-tjm-charcoal text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
        <div>
          <Image src="/site/logo-white-stacked.png" alt={SITE.name} width={182} height={122} className="h-20 w-auto" />
          <p className="mt-3 text-sm font-light text-white/60">{SITE.strapline}</p>
        </div>
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-tjm-yellow">Menu</h3>
          <ul className="mt-3 space-y-1 text-sm font-light">
            {SITE.nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-tjm-yellow">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/signin" className="hover:text-tjm-yellow">
                Book a session
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-tjm-yellow">Contact Me</h3>
          <ul className="mt-3 space-y-1 text-sm font-light">
            <li>Toby</li>
            <li>
              <a href={`mailto:${SITE.email}`} className="hover:text-tjm-yellow">
                {SITE.email}
              </a>
            </li>
            <li>
              <a href={SITE.phoneHref} className="hover:text-tjm-yellow">
                {SITE.phone}
              </a>
            </li>
            <li className="pt-2">
              <Link href="/privacy-policy" className="text-white/60 hover:text-tjm-yellow">
                Privacy Policy
              </Link>
            </li>
          </ul>
          <div className="mt-4 flex gap-3">
            <a href={SITE.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
              <Image src="/site/icon-instagram.png" alt="" width={201} height={201} className="h-6 w-6 opacity-70 hover:opacity-100" />
            </a>
            <a href={SITE.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
              <Image src="/site/icon-facebook.png" alt="" width={200} height={200} className="h-6 w-6 opacity-70 hover:opacity-100" />
            </a>
          </div>
        </div>
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-tjm-yellow">Opening Hours</h3>
          <ul className="mt-3 space-y-1 text-sm font-light">
            {SITE.hours.map(([d, h]) => (
              <li key={d}>
                <span className="inline-block w-20 text-white/60">{d}</span> {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs font-light text-white/50">
        © {new Date().getFullYear()} {SITE.name} Ltd
      </div>
    </footer>
  );
}
