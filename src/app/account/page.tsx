import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { AccountForms } from "./account-forms";

export default async function AccountPage() {
  const session = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, emergencyContact: true, notes: true, notifyEmail: true, notifyReminders: true, role: true },
  });
  return (
    <AppShell
      title="My account"
      nav={[
        { href: "/account", label: "Profile" },
        { href: "/account#notifications", label: "Notifications" },
        { href: user.role === "TRAINER" ? "/trainer" : "/app", label: user.role === "TRAINER" ? "Calendar" : "My sessions" },
      ]}
    >
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold">My account</h1>
        <AccountForms user={user} />
      </div>
    </AppShell>
  );
}
