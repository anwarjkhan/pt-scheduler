"use client";

import { useState } from "react";
import type { Pillar } from "@/lib/pillars";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The hero chips. A pillar with body text is a button that opens an explainer;
 * one without (the site.ts fallback, or an entry Toby has not written yet) stays
 * a plain chip, so nothing opens an empty modal.
 */
export function PillarChips({ pillars }: { pillars: Pillar[] }) {
  const [open, setOpen] = useState<Pillar | null>(null);

  return (
    <>
      <ul className="mt-8 flex flex-wrap gap-2">
        {pillars.map((p, i) => {
          const chip = "rounded-md bg-black/45 px-3 py-1 font-heading text-sm font-semibold text-tjm-yellow backdrop-blur-sm";
          const style = { "--rise-delay": `${240 + i * 60}ms` } as React.CSSProperties;
          return (
            <li key={p.id} className="animate-rise" style={style}>
              {p.body ? (
                <button
                  type="button"
                  onClick={() => setOpen(p)}
                  className={`${chip} cursor-pointer transition hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tjm-yellow motion-reduce:transition-none`}
                >
                  {p.label}
                </button>
              ) : (
                <span className={chip}>{p.label}</span>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{open?.label}</DialogTitle>
          </DialogHeader>
          {/* Toby's copy: blank lines start a new paragraph. */}
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {(open?.body ?? "")
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((para, i) => (
                <p key={i}>{para}</p>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
