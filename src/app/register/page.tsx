import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SignInPanel } from "../signin/signin-panel";

export default async function RegisterPage() {
  if ((await auth())?.user) redirect("/");
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <SignInPanel mode="register" />
      </main>
      <SiteFooter />
    </>
  );
}
