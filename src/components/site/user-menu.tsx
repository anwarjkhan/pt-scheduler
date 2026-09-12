"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, LogOut, UserRound } from "lucide-react";
import { USER_MENU } from "@/content/site";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  user,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: "CLIENT" | "TRAINER" };
  signOutAction: () => Promise<void>;
}) {
  const links = USER_MENU[user.role];
  const initials = (user.name ?? user.email ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
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
            <div className="text-xs font-normal text-muted-foreground">{user.role === "TRAINER" ? "Trainer" : "Client"}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {links.map((l) => (
            <DropdownMenuItem key={l.href} render={<Link href={l.href} />}>
              {l.href === "/#book" && <CalendarDays className="mr-2 h-4 w-4" />}
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
  );
}
