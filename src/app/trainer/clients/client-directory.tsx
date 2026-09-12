"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";
import { MapLink } from "@/components/map-link";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ClientCard = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  emergencyContact: string | null;
  notes: string | null;
  locations: { label: string | null; formatted: string; placeId: string | null; lat: number; lng: number; areaId: string | null; area: string | null }[];
  upcoming: { startAt: string; status: string; durationMin: number; place: string }[];
  pendingCount: number;
  completedCount: number;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  joinedAt: string;
};

type Status = "all" | "upcoming" | "pending" | "inactive" | "new";
type Sort = "name" | "next" | "last" | "sessions";

const STATUS: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Booked in" },
  { value: "pending", label: "Awaiting approval" },
  { value: "inactive", label: "Nothing booked" },
  { value: "new", label: "No sessions yet" },
];

/**
 * Area filter. Multi-select, because clients are often spread across several
 * neighbouring areas and Toby wants to see them together.
 */
function AreaFilter({
  areas,
  selected,
  onChange,
}: {
  areas: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const label =
    selected.length === 0
      ? "All areas"
      : selected.length === 1
        ? (areas.find((a) => a.id === selected[0])?.label ?? "1 area")
        : `${selected.length} areas`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-md border bg-transparent px-3 text-sm hover:bg-accent"
            aria-label="Filter by area"
          >
            {label}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        {areas.length === 0 ? (
          <DropdownMenuLabel className="font-normal text-muted-foreground">No areas set up yet</DropdownMenuLabel>
        ) : (
          <>
            {areas.map((a) => (
              <DropdownMenuCheckboxItem
                key={a.id}
                checked={selected.includes(a.id)}
                // Keep the menu open so several areas can be ticked in one go.
                closeOnClick={false}
                onCheckedChange={() => toggle(a.id)}
              >
                {a.label}
              </DropdownMenuCheckboxItem>
            ))}
            {selected.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onChange([])}>Clear areas</DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Searchable, filterable client list. All filtering is client-side — the list is small. */
export function ClientDirectory({ clients, areas, tz }: { clients: ClientCard[]; areas: { id: string; label: string }[]; tz: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  // Empty = no area filter. Otherwise a client matches if any of their
  // locations falls in any selected area.
  const [area, setArea] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("name");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (needle) {
        const hay = [c.name, c.email, c.phone ?? "", c.notes ?? "", ...c.locations.map((l) => `${l.label ?? ""} ${l.formatted} ${l.area ?? ""}`)].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (area.length > 0 && !c.locations.some((l) => l.areaId && area.includes(l.areaId))) return false;
      switch (status) {
        case "upcoming":
          return c.upcoming.length > 0;
        case "pending":
          return c.pendingCount > 0;
        case "inactive":
          return c.upcoming.length === 0;
        case "new":
          return c.completedCount === 0;
        default:
          return true;
      }
    });
    const by: Record<Sort, (a: ClientCard, b: ClientCard) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      next: (a, b) => (a.nextSessionAt ?? "9").localeCompare(b.nextSessionAt ?? "9"),
      last: (a, b) => (b.lastSessionAt ?? "").localeCompare(a.lastSessionAt ?? ""),
      sessions: (a, b) => b.completedCount - a.completedCount,
    };
    return [...list].sort(by[sort]);
  }, [clients, q, status, area, sort]);

  const active = q || status !== "all" || area.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, address, notes…" className="pl-8" aria-label="Search clients" />
        </div>
        <AreaFilter areas={areas} selected={area} onChange={setArea} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-md border bg-transparent px-2 text-sm" aria-label="Sort clients">
          <option value="name">Sort: name</option>
          <option value="next">Sort: next session</option>
          <option value="last">Sort: last seen</option>
          <option value="sessions">Sort: most sessions</option>
        </select>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setStatus("all");
              setArea([]);
            }}
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={cn(
              "rounded-md border px-3 py-1 font-heading text-xs font-semibold transition-colors",
              status === s.value ? "border-tjm-charcoal bg-tjm-charcoal text-white" : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {shown.length} of {clients.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {clients.length === 0 ? "No clients have signed up yet." : "No clients match."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{c.name}</span>
                  <span className="flex items-center gap-2">
                    {c.pendingCount > 0 && (
                      <span className="rounded-full bg-tjm-orange px-2 py-0.5 font-heading text-[11px] font-bold text-white">{c.pendingCount} pending</span>
                    )}
                    <Link href={`/trainer/clients/${c.id}`} className="font-heading text-xs font-semibold text-tjm-orange hover:underline">
                      History →
                    </Link>
                  </span>
                </CardTitle>
                <CardDescription>
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""} · {c.completedCount} completed
                  {c.lastSessionAt ? ` · last seen ${formatInTimeZone(c.lastSessionAt, tz, "d MMM")}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(c.emergencyContact || c.notes) && (
                  <div className="rounded-md border border-tjm-yellow/60 bg-accent/40 p-3">
                    {c.emergencyContact && (
                      <div>
                        <span className="font-medium">Emergency contact:</span> {c.emergencyContact}
                      </div>
                    )}
                    {c.notes && (
                      <div className={c.emergencyContact ? "mt-1" : ""}>
                        <span className="font-medium">Notes:</span> {c.notes}
                      </div>
                    )}
                  </div>
                )}
                {c.locations.length > 0 && (
                  <ul className="text-muted-foreground">
                    {c.locations.map((l, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <MapLink target={l} className="h-3.5 w-3.5" label={l.label ?? l.formatted} />
                        <span className="truncate">
                          {l.label ? `${l.label} · ` : ""}
                          {l.formatted}
                        </span>
                        {l.area && <span className="ml-1 shrink-0 rounded-sm bg-muted px-1 text-[10px] font-semibold uppercase">{l.area}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <div className="mb-1 font-medium">Upcoming</div>
                  {c.upcoming.length === 0 ? (
                    <p className="text-muted-foreground">None</p>
                  ) : (
                    <ul className="space-y-1">
                      {c.upcoming.slice(0, 4).map((b) => (
                        <li key={b.startAt} className="flex items-center gap-2">
                          <span>{formatInTimeZone(b.startAt, tz, "EEE d MMM, HH:mm")}</span>
                          <span className="truncate text-muted-foreground">· {b.durationMin} min · {b.place}</span>
                          <StatusBadge status={b.status} className="ml-auto" />
                        </li>
                      ))}
                      {c.upcoming.length > 4 && <li className="text-muted-foreground">+{c.upcoming.length - 4} more</li>}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
