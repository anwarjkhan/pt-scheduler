import { requireTrainer } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function TrainerLayout({ children }: LayoutProps<"/trainer">) {
  const user = await requireTrainer();
  return (
    <AppShell
      userLabel={`${user.name ?? user.email} (trainer)`}
      nav={[
        { href: "/trainer", label: "Calendar" },
        { href: "/trainer/requests", label: "Requests" },
        { href: "/trainer/availability", label: "Availability" },
        { href: "/trainer/clients", label: "Clients" },
        { href: "/trainer/settings", label: "Settings" },
      ]}
    >
      {children}
    </AppShell>
  );
}
