import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared furniture for the guide pages.
 *
 * These explain rules the app already enforces, so every number on them is
 * read from the live settings rather than written into the prose — a guide
 * that quietly disagrees with the app is worse than no guide.
 */

export function GuideHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="space-y-2">
      <Link href="/trainer/guide" className="text-sm text-muted-foreground hover:underline">
        ← Guide
      </Link>
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="max-w-2xl text-muted-foreground">{intro}</p>
    </div>
  );
}

/** One topic in the guide. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  );
}

/**
 * A worked example, built from real figures.
 *
 * Rules are much easier to trust when you can see them applied to a number you
 * recognise, so these are the trainer's own rates and clients rather than
 * invented ones.
 */
export function Worked({ title, rows, total }: { title: string; rows: { label: string; value: string }[]; total?: { label: string; value: string } }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="mb-2 font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="tabular-nums">{r.value}</dd>
          </div>
        ))}
        {total && (
          <div className="mt-1 flex justify-between gap-4 border-t pt-1 font-medium">
            <dt>{total.label}</dt>
            <dd className="tabular-nums">{total.value}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** A point worth not missing. */
export function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-md border-l-2 py-1 pl-3 text-muted-foreground",
        tone === "warn" ? "border-tjm-orange" : "border-border",
      )}
    >
      {children}
    </p>
  );
}

/** Where to change the thing being described. */
export function SettingLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-tjm-orange hover:underline">
      {children} →
    </Link>
  );
}
