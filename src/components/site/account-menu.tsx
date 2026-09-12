"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock,
  Inbox,
  ListChecks,
  LogOut,
  MapPin,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { USER_MENU, type MenuIcon } from "@/content/site";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ICONS: Record<MenuIcon, React.ComponentType<{ className?: string }>> = {
  calendar: CalendarDays,
  list: ListChecks,
  pin: MapPin,
  inbox: Inbox,
  clock: Clock,
  users: Users,
  settings: Settings,
  user: UserRound,
  bell: Bell,
  help: CircleHelp,
  shield: ShieldCheck,
};

export type MenuUser = { name?: string | null; email?: string | null; image?: string | null; role: "CLIENT" | "TRAINER" };

type Props = {
  /** Null when signed out — the menu then offers sign-in options. */
  user: MenuUser | null;
  badges?: { upcoming?: number; pending?: number };
  /** Server-rendered calendar for the modal (home page only). */
  calendar?: React.ReactNode;
  calendarOpen?: boolean;
  providers: { google: boolean; apple: boolean; dev: boolean };
  signInAction: (provider: "google" | "apple") => Promise<void>;
  signOutAction: () => Promise<void>;
};

/**
 * Top-right account menu. A plain popover (no portal, no positioning library) so it behaves
 * identically in every browser: opens on click, closes on outside click, Escape, or navigation.
 */
export function AccountMenu({ user, badges = {}, calendar, calendarOpen = false, providers, signInAction, signOutAction }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(calendarOpen);

  // Re-open the modal when the URL gains ?cal=1 while this component stays mounted.
  const [prevCalendarOpen, setPrevCalendarOpen] = useState(calendarOpen);
  if (calendarOpen !== prevCalendarOpen) {
    setPrevCalendarOpen(calendarOpen);
    if (calendarOpen) setModal(true);
  }

  // Close on navigation.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openCalendar = () => {
    setOpen(false);
    if (calendar) setModal(true);
    else router.push("/?cal=1");
  };
  const onModalChange = (o: boolean) => {
    setModal(o);
    if (!o && window.location.search.includes("cal=1")) router.replace("/");
  };

  const initials = user
    ? (user.name ?? user.email ?? "?")
        .split(/[\s@]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "";

  const itemClass =
    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent focus:bg-accent focus:outline-none";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? "Account menu" : "Sign in"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-md border border-white/20 text-white transition-colors hover:bg-white/10",
          user ? "py-1 pl-1 pr-2" : "p-1.5",
          open && "bg-white/10",
        )}
      >
        {user ? (
          <>
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.image ?? undefined} alt="" />
              <AvatarFallback className="bg-tjm-yellow text-xs font-bold text-tjm-charcoal">{initials || <UserRound className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate font-heading text-sm font-semibold sm:inline">{user.name ?? user.email}</span>
          </>
        ) : (
          <UserRound className="h-5 w-5" />
        )}
        <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl"
        >
          {user ? (
            <>
              <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.image ?? undefined} alt="" />
                  <AvatarFallback className="bg-tjm-yellow font-bold text-tjm-charcoal">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-heading font-semibold">{user.name ?? user.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
                <span className="ml-auto shrink-0 rounded-sm bg-tjm-charcoal px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wide text-tjm-yellow">
                  {user.role === "TRAINER" ? "Trainer" : "Client"}
                </span>
              </div>

              {USER_MENU[user.role].map((g) => (
                <div key={g.group} className="border-b p-1.5">
                  <div className="px-3 pb-1 pt-1.5 font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{g.group}</div>
                  {g.items.map((it) => {
                    const Icon = ICONS[it.icon];
                    const count = it.badge ? badges[it.badge] : undefined;
                    const badge =
                      count && count > 0 ? (
                        <span
                          className={cn(
                            "ml-auto rounded-full px-2 py-0.5 font-heading text-[11px] font-bold",
                            it.badge === "pending" ? "bg-tjm-orange text-white" : "bg-tjm-lime/30 text-[#3e4300]",
                          )}
                        >
                          {count}
                        </span>
                      ) : null;
                    return it.href === "calendar" ? (
                      <button key={it.label} type="button" role="menuitem" onClick={openCalendar} className={cn(itemClass, "font-semibold")}>
                        <Icon className="h-4 w-4 text-tjm-orange" /> {it.label}
                      </button>
                    ) : (
                      <Link key={it.label} href={it.href} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                        <Icon className="h-4 w-4 text-muted-foreground" /> {it.label}
                        {badge}
                      </Link>
                    );
                  })}
                </div>
              ))}

              <div className="p-1.5">
                <form action={signOutAction}>
                  <button type="submit" role="menuitem" className={itemClass}>
                    <LogOut className="h-4 w-4 text-muted-foreground" /> Sign out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="p-4">
              <div className="font-heading text-base font-semibold">Sign in to book with Toby</div>
              <p className="mt-1 text-xs text-muted-foreground">Book, reschedule and manage your sessions online.</p>
              <div className="mt-4 space-y-2">
                <form action={() => signInAction("google")}>
                  <ProviderButton disabled={!providers.google} label="Continue with Google" icon={<GoogleMark />} />
                </form>
                <form action={() => signInAction("apple")}>
                  <ProviderButton disabled={!providers.apple} label="Continue with Apple" icon={<AppleMark />} />
                </form>
                {!providers.google && !providers.apple && (
                  <p className="text-[11px] text-muted-foreground">Google / Apple sign-in isn&apos;t configured yet (see .env.example).</p>
                )}
                {providers.dev && (
                  <Link href="/signin" onClick={() => setOpen(false)} className="block text-center text-xs text-muted-foreground underline">
                    Dev login (local only)
                  </Link>
                )}
              </div>
              <p className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">
                New here?{" "}
                <Link href="/register" onClick={() => setOpen(false)} className="font-semibold text-foreground underline">
                  Register
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {calendar && user && (
        <Dialog open={modal} onOpenChange={onModalChange}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">{user.role === "TRAINER" ? "Your calendar" : "Book a session with Toby"}</DialogTitle>
              <DialogDescription>
                {user.role === "TRAINER" ? "Confirmed and pending sessions with drive time between them." : "Pick a location and duration, then choose a start time."}
              </DialogDescription>
            </DialogHeader>
            {calendar}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ProviderButton({ label, icon, disabled }: { label: string; icon: React.ReactNode; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      title={disabled ? "Not configured" : undefined}
      className="flex w-full items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon} {label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8a4.6 4.6 0 0 0-3.6-1.9c-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.9A4.8 4.8 0 0 0 4 9.4c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4a10 10 0 0 0 1.3-2.8 4.3 4.3 0 0 1-2.5-3.7ZM14 5.4A4.3 4.3 0 0 0 15 2a4.4 4.4 0 0 0-2.9 1.5 4.1 4.1 0 0 0-1 3.1c1.1.1 2.2-.5 2.9-1.2Z" />
    </svg>
  );
}
