"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children when they scroll into view.
 *
 * Children are rendered by the server and passed through untouched, so wrapping
 * a section in this does not make the section itself a client component.
 *
 * The hidden state lives in CSS on [data-reveal] and is only armed once this
 * runs (it sets data-reveal-ready on <html>), so with JS disabled the content
 * stays visible rather than being permanently hidden.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in ms, for items revealed as a group. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-reveal-ready", "");

    const el = ref.current;
    if (!el) return;

    // Reduced motion: show immediately and skip the observer entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.setAttribute("data-visible", "");
      return;
    }

    // Already on screen at mount (above the fold) — reveal without waiting.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-visible", "");
          observer.unobserve(entry.target); // one-way: no re-hiding on scroll up
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal="" style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties} className={className}>
      {children}
    </Tag>
  );
}
