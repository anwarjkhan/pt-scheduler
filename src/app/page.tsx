import { auth, signIn, isDevLoginEnabled } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell } from "lucide-react";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === "string" ? callbackUrl : undefined;
  if (session?.user) redirect(target ?? (session.user.role === "TRAINER" ? "/trainer" : "/app"));

  const hasGoogle = !!process.env.AUTH_GOOGLE_ID;

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Dumbbell className="h-6 w-6" />
          </div>
          <CardTitle>PT Scheduler</CardTitle>
          <CardDescription>Sign in to book and manage training sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: target ?? "/app" });
            }}
          >
            <Button type="submit" className="w-full" disabled={!hasGoogle}>
              Continue with Google
            </Button>
            {!hasGoogle && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET to enable Google sign-in.
              </p>
            )}
          </form>

          {isDevLoginEnabled && (
            <form
              className="space-y-3 rounded-md border border-dashed p-3"
              action={async (fd: FormData) => {
                "use server";
                await signIn("dev", {
                  email: String(fd.get("email")),
                  name: String(fd.get("name") ?? ""),
                  redirectTo: target ?? "/app",
                });
              }}
            >
              <p className="text-xs font-medium text-muted-foreground">Dev login (local only)</p>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Optional" />
              </div>
              <Button type="submit" variant="outline" className="w-full">
                Sign in (dev)
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Use the PT_EMAIL address to sign in as the trainer.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
