import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import pages from "@/content/pages.json";
import { SITE } from "@/content/site";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";

type Block = { type: "h1" | "h2" | "h3" | "p"; text: string } | { type: "ul"; items: string[] };
type Page = { slug: string; title: string; group: string; blocks: Block[] };
const PAGES = pages as Record<string, Page>;

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return page ? { title: `${page.title} | ${SITE.name}` } : {};
}

/** Area, injury-rehab and privacy pages, rendered from the copy scraped off tjmtraining.com. */
export default async function ContentPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  const [first, ...rest] = page.blocks;
  const heading = first.type === "h1" ? first.text : page.title;
  const body = first.type === "h1" ? rest : page.blocks;
  const isLegal = page.group === "Legal";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative isolate overflow-hidden bg-tjm-charcoal text-white">
          {!isLegal && <Image src="/site/toby-coaching.jpg" alt="" fill className="-z-10 object-cover opacity-30" sizes="100vw" />}
          <div className="mx-auto max-w-4xl px-6 py-16">
            <p className="font-heading text-xs font-semibold uppercase tracking-widest text-tjm-yellow">{page.group}</p>
            <h1 className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-5xl">{heading}</h1>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-6 py-12">
          <div className="space-y-4 text-[17px] font-light leading-relaxed">
            {body.map((b, i) => {
              switch (b.type) {
                case "h2":
                  return (
                    <h2 key={i} className="pt-6 font-heading text-2xl font-semibold">
                      {b.text}
                    </h2>
                  );
                case "h3":
                  return (
                    <h3 key={i} className="pt-4 font-heading text-xl font-semibold">
                      {b.text}
                    </h3>
                  );
                case "ul":
                  return (
                    <ul key={i} className="list-disc space-y-1 pl-6">
                      {b.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  );
                default:
                  return <p key={i}>{b.text}</p>;
              }
            })}
          </div>

          {!isLegal && (
            <div className="mt-12 rounded-md border-[6px] border-tjm-yellow bg-tjm-charcoal p-6 text-white">
              <h2 className="font-heading text-2xl font-semibold">Ready to get started?</h2>
              <p className="mt-2 font-light text-white/80">Register and book a session straight into Toby’s diary, or get in touch for a free consultation.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button className="font-heading font-semibold" nativeButton={false} render={<Link href="/register" />}>
                  Book a session
                </Button>
                <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" nativeButton={false} render={<a href={`mailto:${SITE.email}`} />}>
                  Email Toby
                </Button>
              </div>
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
