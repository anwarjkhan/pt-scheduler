import { auth, signIn, isDevLoginEnabled } from "@/auth";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PILLARS = ["Health", "Movement", "Prehab", "Rehab", "Fitness", "Biomechanics", "Injury Prevention"];

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === "string" ? callbackUrl : undefined;
  if (session?.user) redirect(target ?? (session.user.role === "TRAINER" ? "/trainer" : "/app"));

  const hasGoogle = !!process.env.AUTH_GOOGLE_ID;

  return (
    <main className="relative flex flex-1 flex-col">
      {/* Hero: the site's sunset gradient under a dark vignette */}
      <div className="absolute inset-0 -z-10 bg-tjm-sunset" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(0,0,0,0.7),rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.45))]" />

      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-5 text-white">
        <Wordmark className="text-2xl" />
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-16 pt-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="text-white">
          <h1 className="font-heading text-5xl font-bold leading-[1.05] drop-shadow-md sm:text-6xl lg:text-7xl">{BRAND.tagline}</h1>
          <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-white/90">{BRAND.subtitle}</p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {PILLARS.map((p) => (
              <li key={p} className="rounded-md bg-black/40 px-3 py-1 font-heading text-sm font-semibold text-tjm-yellow backdrop-blur-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Sign-in panel: charcoal card with a yellow edge, like the site's photo frames */}
        <div className="w-full max-w-md justify-self-center rounded-md border-[6px] border-tjm-yellow bg-tjm-charcoal p-6 text-white shadow-2xl lg:justify-self-end">
          <h2 className="font-heading text-2xl font-semibold">Book your session</h2>
          <p className="mt-1 text-sm font-light text-white/70">Sign in to request, manage and cancel training sessions.</p>

          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: target ?? "/app" });
            }}
          >
            <Button type="submit" size="lg" className="w-full font-heading font-semibold" disabled={!hasGoogle}>
              Continue with Google
            </Button>
            {!hasGoogle && (
              <p className="mt-2 text-center text-xs text-white/50">Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET to enable Google sign-in.</p>
            )}
          </form>

          {isDevLoginEnabled && (
            <form
              className="mt-6 space-y-3 rounded-md border border-dashed border-white/25 p-4"
              action={async (fd: FormData) => {
                "use server";
                await signIn("dev", {
                  email: String(fd.get("email")),
                  name: String(fd.get("name") ?? ""),
                  redirectTo: target ?? "/app",
                });
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-tjm-lime">Dev login (local only)</p>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-white/80">
                  Email
                </Label>
                <Input id="email" name="email" type="email" required placeholder="you@example.com" className="border-white/20 bg-black/30 text-white placeholder:text-white/40" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name" className="text-white/80">
                  Name
                </Label>
                <Input id="name" name="name" placeholder="Optional" className="border-white/20 bg-black/30 text-white placeholder:text-white/40" />
              </div>
              <Button type="submit" variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Sign in (dev)
              </Button>
              <p className="text-[11px] text-white/50">Use the PT_EMAIL address to sign in as the trainer.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
