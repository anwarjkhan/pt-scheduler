import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function ClientLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  return (
    <AppShell
      title="My training"
      nav={[
        { href: "/#book", label: "Book" },
        { href: "/app", label: "My sessions" },
        { href: "/app/locations", label: "Locations" },
        ...(user.role === "TRAINER" ? [{ href: "/trainer", label: "Trainer view" }] : []),
      ]}
    >
      {children}
    </AppShell>
  );
}
