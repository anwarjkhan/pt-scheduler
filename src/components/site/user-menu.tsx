"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, LogOut, UserRound } from "lucide-react";
import { USER_MENU } from "@/content/site";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Avatar + dropdown for signed-in users. Owns the calendar modal: `calendar` is the
 * server-rendered booking wizard (client) or week calendar (trainer), shown when the
 * first menu item is chosen or when the page was opened with `?cal=1`.
 */
export function UserMenu({
  user,
  calendar,
  calendarOpen = false,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: "CLIENT" | "TRAINER" };
  calendar?: React.ReactNode;
  calendarOpen?: boolean;
  signOutAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(calendarOpen);
  // Re-open when the URL gains ?cal=1 while this menu stays mounted (client-side nav from a CTA).
  const [prevCalendarOpen, setPrevCalendarOpen] = useState(calendarOpen);
  if (calendarOpen !== prevCalendarOpen) {
    setPrevCalendarOpen(calendarOpen);
    if (calendarOpen) setOpen(true);
  }
  const links = USER_MENU[user.role];
  const isTrainer = user.role === "TRAINER";
  const initials = (user.name ?? user.email ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const openCalendar = () => {
    if (calendar) setOpen(true);
    else router.push("/?cal=1"); // on pages that don't render the calendar, go home and open it there
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    // Drop the ?cal=1 (and any calendar nav params) from the URL when the modal is dismissed.
    if (!o && typeof window !== "undefined" && window.location.search.includes("cal=1")) router.replace("/");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-white/20 py-1 pl-1 pr-2 text-white hover:bg-white/10">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.image ?? undefined} alt="" />
            <AvatarFallback className="bg-tjm-yellow text-xs font-bold text-tjm-charcoal">{initials || <UserRound className="h-4 w-4" />}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate font-heading text-sm font-semibold sm:inline">{user.name ?? user.email}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="font-heading font-semibold">{user.name ?? user.email}</div>
              <div className="text-xs font-normal text-muted-foreground">{isTrainer ? "Trainer" : "Client"}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openCalendar} className="font-semibold">
              <CalendarDays className="mr-2 h-4 w-4 text-tjm-orange" />
              {isTrainer ? "Calendar" : "Book a session"}
            </DropdownMenuItem>
            {links.map((l) => (
              <DropdownMenuItem key={l.href} render={<Link href={l.href} />}>
                {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOutAction()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {calendar && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">{isTrainer ? "Your calendar" : "Book a session with Toby"}</DialogTitle>
              <DialogDescription>
                {isTrainer ? "Confirmed and pending sessions with drive time between them." : "Pick a location and duration, then choose a start time."}
              </DialogDescription>
            </DialogHeader>
            {calendar}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
