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
import { formatMoney } from "@/lib/pricing";
import type { HealthStatus } from "@/lib/client-health";
import { StatusPill } from "./client-health-panel";
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
  /** Positive = pre-paid credit held, negative = owed. */
  balancePence: number;
  billingMode: string;
  /** Trainer-only. Never rendered on a client-facing page. */
  health: { status: HealthStatus; headline: string; score: number | null; confident: boolean } | null;
};

type Status = "all" | "upcoming" | "pending" | "inactive" | "new" | "credit" | "owing" | "attention" | "star";
type Sort = "name" | "next" | "last" | "sessions" | "balance" | "score";

const STATUS: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Booked in" },
  { value: "pending", label: "Awaiting approval" },
  { value: "inactive", label: "Nothing booked" },
  { value: "new", label: "No sessions yet" },
  { value: "credit", label: "In credit" },
  { value: "owing", label: "Owes money" },
  { value: "attention", label: "Needs attention" },
  { value: "star", label: "Star clients" },
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

/**
 * Sort key for the score column. Provisional scores are pushed below every
 * settled one so a two-session client cannot top the list on thin evidence.
 */
function rankScore(c: ClientCard): number {
  if (c.health?.score == null) return -1;
  return c.health.confident ? c.health.score : c.health.score / 1000;
}

/** Searchable, filterable client list. All filtering is client-side — the list is small. */
export function ClientDirectory({
  clients,
  areas,
  tz,
  currency,
}: {
  clients: ClientCard[];
  areas: { id: string; label: string }[];
  tz: string;
  currency: string;
}) {
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
        case "credit":
          return c.balancePence > 0;
        case "owing":
          return c.balancePence < 0;
        case "attention":
          // Drifting belongs here too: both are clients to contact, even
          // though one is a money problem and the other a retention one.
          return c.health?.status === "ATTENTION" || c.health?.status === "DRIFTING";
        case "star":
          return c.health?.status === "STAR";
        default:
          return true;
      }
    });
    const by: Record<Sort, (a: ClientCard, b: ClientCard) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      next: (a, b) => (a.nextSessionAt ?? "9").localeCompare(b.nextSessionAt ?? "9"),
      last: (a, b) => (b.lastSessionAt ?? "").localeCompare(a.lastSessionAt ?? ""),
      sessions: (a, b) => b.completedCount - a.completedCount,
      // Most owed first, then most in credit — the ones needing chasing surface.
      balance: (a, b) => a.balancePence - b.balancePence,
      // Best first. A provisional score ranks below every settled one, and a
      // client with no score at all sorts last — neither has earned a place
      // in the ranking yet.
      score: (a, b) => rankScore(b) - rankScore(a),
    };
    return [...list].sort(by[sort]);
  }, [clients, q, status, area, sort]);

  const active = q || status !== "all" || area.length > 0;

  // Across every client, not just the filtered view — this is the "where do I
  // stand overall" number, and it should not move when a filter is applied.
  const totals = useMemo(() => {
    const credit = clients.filter((c) => c.balancePence > 0);
    const owing = clients.filter((c) => c.balancePence < 0);
    return {
      prepaidPence: credit.reduce((n, c) => n + c.balancePence, 0),
      prepaidCount: credit.length,
      owedPence: owing.reduce((n, c) => n + Math.abs(c.balancePence), 0),
      owedCount: owing.length,
    };
  }, [clients]);

  return (
    <div className="space-y-4">
      {(totals.prepaidCount > 0 || totals.owedCount > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStatus(status === "credit" ? "all" : "credit")}
            className={cn(
              "rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent",
              status === "credit" && "border-tjm-charcoal ring-1 ring-tjm-charcoal",
            )}
          >
            <div className="font-heading text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(totals.prepaidPence, currency)}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Prepaid credit held · {totals.prepaidCount} client{totals.prepaidCount === 1 ? "" : "s"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStatus(status === "owing" ? "all" : "owing")}
            className={cn(
              "rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent",
              status === "owing" && "border-tjm-charcoal ring-1 ring-tjm-charcoal",
            )}
          >
            <div className={cn("font-heading text-2xl font-semibold tabular-nums", totals.owedPence > 0 && "text-destructive")}>
              {formatMoney(totals.owedPence, currency)}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Owed to you · {totals.owedCount} client{totals.owedCount === 1 ? "" : "s"}
            </div>
          </button>
        </div>
      )}
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
          <option value="balance">Sort: balance</option>
          <option value="score">Sort: score</option>
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
                    {c.balancePence !== 0 && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-heading text-[11px] font-bold tabular-nums",
                          c.balancePence > 0
                            ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-destructive/15 text-destructive",
                        )}
                        title={c.balancePence > 0 ? "Prepaid credit remaining" : "Owed to you"}
                      >
                        {formatMoney(Math.abs(c.balancePence), currency)} {c.balancePence > 0 ? "credit" : "owed"}
                      </span>
                    )}
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
                {c.health && (c.health.score != null || c.health.status === "EXEMPT") && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {c.health.score != null && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-heading text-xs font-bold tabular-nums",
                          !c.health.confident
                            ? "bg-muted text-muted-foreground"
                            : c.health.score >= 85
                              ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                              : c.health.score >= 50
                                ? "bg-muted text-foreground"
                                : "bg-destructive/15 text-destructive",
                        )}
                        title={c.health.confident ? "Overall score" : "Provisional — not enough history yet"}
                      >
                        {c.health.confident ? "" : "~"}
                        {c.health.score}
                      </span>
                    )}
                    {c.health.status !== "STEADY" && c.health.status !== "TOO_EARLY" && (
                      <StatusPill status={c.health.status} />
                    )}
                    {c.health.status !== "STEADY" && (
                      <span className="text-xs text-muted-foreground">{c.health.headline}</span>
                    )}
                  </div>
                )}
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
