"use client";

import { useState, type ReactNode } from "react";
import type { Pillar } from "@/lib/pillars";

/**
 * The hero chips and, below the CTA buttons, the text for whichever chip is
 * hovered or focused. The buttons are passed in rather than rendered by the
 * caller so the text can sit underneath them and reserve its own space.
 */
export function PillarChips({ pillars, actions }: { pillars: Pillar[]; actions: ReactNode }) {
  const [active, setActive] = useState<Pillar | null>(null);

  return (
    <>
      <ul className="mt-8 flex flex-wrap gap-2">
        {pillars.map((p, i) => {
          const style = { "--rise-delay": `${240 + i * 60}ms` } as React.CSSProperties;
          const hasBody = !!p.body;
          return (
            <li key={p.id} className="animate-rise" style={style}>
              <span
                // Focusable only when there is something to reveal, so keyboard
                // users aren't given stops that do nothing.
                tabIndex={hasBody ? 0 : undefined}
                onMouseEnter={hasBody ? () => setActive(p) : undefined}
                onMouseLeave={hasBody ? () => setActive(null) : undefined}
                onFocus={hasBody ? () => setActive(p) : undefined}
                onBlur={hasBody ? () => setActive(null) : undefined}
                className={`block rounded-md bg-black/45 px-3 py-1 font-heading text-sm font-semibold text-tjm-yellow backdrop-blur-sm transition ${
                  hasBody
                    ? "cursor-default hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tjm-yellow"
                    : ""
                }`}
              >
                {p.label}
              </span>
            </li>
          );
        })}
      </ul>

      {actions}

      {/* Reserved space so the hero doesn't reflow as text appears and goes.
          Height fits the longest pillar body at the narrowest supported width. */}
      <div className="mt-6 min-h-24 max-w-2xl sm:min-h-20" aria-live="polite">
        <p
          className={`text-sm font-light leading-relaxed text-white drop-shadow transition-opacity duration-200 motion-reduce:transition-none ${
            active ? "opacity-100" : "opacity-0"
          }`}
        >
          {active?.body}
        </p>
      </div>
    </>
  );
}
