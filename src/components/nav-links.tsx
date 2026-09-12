"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./app-shell";

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto py-1 sm:py-0">
      {items.map((n) => {
        const active = n.href === pathname || (n.href !== "/app" && n.href !== "/trainer" && pathname.startsWith(n.href));
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 font-heading text-sm font-semibold transition-colors",
              active ? "border-role text-white" : "border-transparent text-white/75 hover:text-white",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
