import Image from "next/image";
import Link from "next/link";
import { signIn, isDevLoginEnabled, isDemoPasscodeRequired } from "@/auth";
import { SITE } from "@/content/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shared by /signin and /register — same Google flow, different copy. */
export function SignInPanel({ mode, target }: { mode: "signin" | "register"; target?: string }) {
  const hasGoogle = !!process.env.AUTH_GOOGLE_ID;
  const redirectTo = target ?? "/";
  const register = mode === "register";

  return (
    <section className="relative isolate flex min-h-[80vh] items-center overflow-hidden text-white">
      <Image src="/site/hero-run.jpg" alt="" fill priority className="-z-20 object-cover" sizes="100vw" />
      <div className="absolute inset-0 -z-10 bg-black/60" />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
        <div>
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
            {register ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-4 max-w-md text-lg font-light text-white/85">
            {register
              ? "Register to book one-to-one sessions straight into Toby’s diary, manage recurring slots and keep your training locations in one place."
              : "Sign in to book, reschedule or cancel your sessions with Toby."}
          </p>
        </div>

        <div className="w-full max-w-md justify-self-center rounded-md border-[6px] border-tjm-yellow bg-tjm-charcoal p-6 shadow-2xl lg:justify-self-end">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" size="lg" className="w-full font-heading font-semibold" disabled={!hasGoogle}>
              {register ? "Register with Google" : "Sign in with Google"}
            </Button>
            {!hasGoogle && (
              <p className="mt-2 text-center text-xs text-white/50">
                {isDevLoginEnabled ? "Google sign-in isn’t set up — use the form below." : "Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET to enable Google sign-in."}
              </p>
            )}
          </form>
          <p className="mt-3 text-center text-xs text-white/60">
            {register ? "Already registered? " : "New to TJM Training? "}
            <Link href={register ? "/signin" : "/register"} className="text-tjm-yellow underline">
              {register ? "Sign in" : "Register"}
            </Link>
          </p>

          {isDevLoginEnabled && (
            <form
              className="mt-6 space-y-3 rounded-md border border-dashed border-white/25 p-4"
              action={async (fd: FormData) => {
                "use server";
                await signIn("dev", {
                  email: String(fd.get("email")),
                  name: String(fd.get("name") ?? ""),
                  passcode: String(fd.get("passcode") ?? ""),
                  redirectTo,
                });
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-tjm-lime">
                {isDemoPasscodeRequired ? "Demo login" : "Dev login (local only)"}
              </p>
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
              {isDemoPasscodeRequired && (
                <div className="space-y-1">
                  <Label htmlFor="passcode" className="text-white/80">
                    Demo passcode
                  </Label>
                  <Input id="passcode" name="passcode" type="password" required className="border-white/20 bg-black/30 text-white placeholder:text-white/40" />
                </div>
              )}
              <Button type="submit" variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                {isDemoPasscodeRequired ? "Sign in" : "Sign in (dev)"}
              </Button>
              <p className="text-[11px] text-white/50">Use the PT_EMAIL address to sign in as the trainer.</p>
            </form>
          )}
          <p className="mt-4 text-center text-[11px] text-white/40">
            Questions? <a href={`mailto:${SITE.email}`} className="underline">{SITE.email}</a>
          </p>
        </div>
      </div>
    </section>
  );
}
