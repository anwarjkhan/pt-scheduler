import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SITE } from "@/content/site";
import { Button } from "@/components/ui/button";
import { ContactForm } from "./contact-form";
import { Reveal } from "./reveal";

/** Where "Book a session" CTAs go: the calendar modal when signed in, otherwise registration. */
const bookHref = (signedIn: boolean) => (signedIn ? "/?cal=1" : "/register");

/** Full-bleed running-legs photo with the headline, as on tjmtraining.com. */
export function Hero({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="relative isolate min-h-[70vh] overflow-hidden text-white">
      <Image src="/site/hero-run.jpg" alt="" fill priority className="animate-kenburns -z-20 object-cover" sizes="100vw" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55),rgba(0,0,0,0.15)_40%,rgba(0,0,0,0.6))]" />
      <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-6 py-20">
        <h1 className="animate-rise max-w-3xl font-heading text-5xl font-bold leading-[1.05] drop-shadow-lg sm:text-6xl lg:text-7xl">{SITE.hero.heading}</h1>
        <p className="animate-rise mt-6 max-w-2xl text-lg font-light leading-relaxed drop-shadow sm:text-xl" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
          {SITE.hero.body}
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {SITE.hero.pillars.map((p, i) => (
            <li
              key={p}
              className="animate-rise rounded-md bg-black/45 px-3 py-1 font-heading text-sm font-semibold text-tjm-yellow backdrop-blur-sm"
              style={{ "--rise-delay": `${240 + i * 60}ms` } as React.CSSProperties}
            >
              {p}
            </li>
          ))}
        </ul>
        <div className="animate-rise mt-10 flex flex-wrap gap-3" style={{ "--rise-delay": `${240 + SITE.hero.pillars.length * 60 + 80}ms` } as React.CSSProperties}>
          <Button size="lg" className="font-heading font-semibold" nativeButton={false} render={<Link href={bookHref(signedIn)} />}>
            Book a session
          </Button>
          <Button size="lg" variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-white/10 hover:text-white" nativeButton={false} render={<Link href="/#meet-toby" />}>
            Meet Toby
          </Button>
        </div>
      </div>
      {/* Scroll cue — the one looping animation on the page. */}
      <a
        href="#meet-toby"
        aria-label="Scroll to Meet Toby"
        className="absolute inset-x-0 bottom-6 mx-auto flex w-10 justify-center text-white/70 transition-colors hover:text-tjm-yellow"
      >
        <ChevronDown className="animate-bob h-7 w-7" />
      </a>
    </section>
  );
}

export function Intro() {
  return (
    <section className="bg-white">
      <Reveal className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-heading text-3xl font-bold sm:text-4xl">{SITE.intro.heading}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-tjm-charcoal">{SITE.intro.body}</p>
        <p className="mx-auto mt-6 max-w-2xl font-heading text-lg font-semibold">{SITE.intro.offer}</p>
        <Button className="mt-6 font-heading font-semibold" size="lg" nativeButton={false} render={<a href={SITE.intro.ctaHref} />}>
          {SITE.intro.cta}
        </Button>
      </Reveal>
    </section>
  );
}

export function MeetToby() {
  return (
    <section id="meet-toby" className="scroll-mt-20 bg-tjm-lime">
      <div className="mx-auto grid max-w-6xl items-stretch gap-0 md:grid-cols-2">
        <Reveal className="relative min-h-80 border-[10px] border-tjm-yellow">
          <Image src="/site/toby-class.jpg" alt="Toby coaching a class" fill className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" />
        </Reveal>
        <Reveal delay={140} className="bg-tjm-charcoal p-8 text-white md:p-12">
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">{SITE.meet.heading}</h2>
          <p className="mt-4 text-lg font-light leading-relaxed text-white/90">{SITE.meet.body}</p>
          <h3 className="mt-8 font-heading text-sm font-semibold uppercase tracking-widest text-tjm-yellow">Qualifications</h3>
          <ul className="mt-3 space-y-2 font-light">
            {SITE.meet.qualifications.map((q) => (
              <li key={q} className="flex gap-2">
                <span className="text-tjm-yellow">▸</span> {q}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function KindWords() {
  return (
    <section id="kind-words" className="relative isolate scroll-mt-20 overflow-hidden text-white">
      <Image src="/site/class-bands.jpg" alt="" fill className="-z-20 object-cover" sizes="100vw" />
      <div className="absolute inset-0 -z-10 bg-black/70" />
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-5xl">
          “{SITE.kindWords.heading}”
        </Reveal>
        <div className="mt-10 space-y-8">
          {SITE.kindWords.testimonials.map((t, i) => (
            <Reveal key={t.name} as="blockquote" delay={i * 120} className="mx-auto max-w-2xl">
              <p className="text-xl font-light leading-relaxed">“{t.quote}”</p>
              <footer className="mt-4 font-heading font-semibold text-tjm-yellow">
                {t.name} <span className="font-normal text-white/70">· {t.detail}</span>
              </footer>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TrainingOptions({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="training-options" className="scroll-mt-20 bg-tjm-charcoal text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Reveal as="h2" className="text-center font-heading text-3xl font-semibold sm:text-4xl">
          Training Options
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SITE.options.map((o, i) => (
            <Reveal key={o.title} as="article" delay={i * 120} className="hover-lift group overflow-hidden rounded-md bg-black/40">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={o.image}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transform-none"
                  sizes="(min-width: 768px) 33vw, 100vw"
                />
              </div>
              <div className="p-6">
                <h3 className="font-heading text-xl font-bold uppercase tracking-wide">{o.title}</h3>
                <p className="mt-3 font-light leading-relaxed text-white/85">{o.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button size="lg" className="font-heading font-semibold" nativeButton={false} render={<Link href={bookHref(signedIn)} />}>
            Book a session online
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Partners() {
  return (
    <section className="bg-tjm-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Reveal as="h2" className="text-center font-heading text-3xl font-semibold">
          Partners
        </Reveal>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {SITE.partners.map((p, i) => (
            <Reveal key={p.name} delay={i * 120} className="group text-center">
              <Image
                src={p.image}
                alt={p.name}
                width={200}
                height={162}
                className="mx-auto h-20 w-auto opacity-80 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
              />
              <p className="mt-4 text-sm font-light leading-relaxed text-white/75">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Areas({ covered = [] }: { covered?: { label: string; radiusMiles: number }[] }) {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-[1fr_auto]">
        <Reveal>
          <p className="text-lg font-light leading-relaxed">{SITE.areasBlurb}</p>
          <p className="mt-3 font-heading text-xl font-semibold">{SITE.areasList}</p>
          {covered.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Areas currently accepting bookings">
              {covered.map((a) => (
                <li key={a.label} className="rounded-md bg-tjm-charcoal px-3 py-1 font-heading text-sm font-semibold text-tjm-yellow">
                  {a.label} <span className="font-normal text-white/70">· {a.radiusMiles} mi</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-heading text-sm font-semibold uppercase tracking-widest text-tjm-orange">Areas We Cover</h3>
              <ul className="mt-2 space-y-1 font-light">
                {SITE.areas.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/${a.slug}`} className="hover:text-tjm-orange hover:underline">
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold uppercase tracking-widest text-tjm-orange">Injury Rehab</h3>
              <ul className="mt-2 space-y-1 font-light">
                {SITE.rehab.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/${a.slug}`} className="hover:text-tjm-orange hover:underline">
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
        <Reveal delay={140} className="hidden md:block">
          <Image src="/site/dumbbells-park.jpg" alt="Dumbbells in a park" width={710} height={1002} className="w-56 rounded-md" />
        </Reveal>
      </div>
    </section>
  );
}

export function Contact() {
  return (
    <section id="contact" className="scroll-mt-20 bg-tjm-charcoal text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2">
        <Reveal>
          <h2 className="font-heading text-3xl font-semibold">Contact Me</h2>
          <p className="mt-3 font-light text-white/80">Get in touch for a free consultation, or sign in to book a session straight into Toby’s diary.</p>
          <ul className="mt-6 space-y-2 font-light">
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
          </ul>
          <h3 className="mt-8 font-heading text-sm font-semibold uppercase tracking-widest text-tjm-yellow">Keeping it social</h3>
          <div className="mt-3 flex gap-3">
            <a href={SITE.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="transition-transform hover:-translate-y-0.5 hover:scale-110 motion-reduce:transform-none">
              <Image src="/site/icon-instagram.png" alt="" width={201} height={201} className="h-8 w-8 opacity-80 transition-opacity hover:opacity-100" />
            </a>
            <a href={SITE.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="transition-transform hover:-translate-y-0.5 hover:scale-110 motion-reduce:transform-none">
              <Image src="/site/icon-facebook.png" alt="" width={200} height={200} className="h-8 w-8 opacity-80 transition-opacity hover:opacity-100" />
            </a>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
}
