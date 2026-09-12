import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SignInPanel } from "./signin-panel";

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === "string" ? callbackUrl : undefined;
  if ((await auth())?.user) redirect(target ?? "/");
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <SignInPanel mode="signin" target={target} />
      </main>
      <SiteFooter />
    </>
  );
}
