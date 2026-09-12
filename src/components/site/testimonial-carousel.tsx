"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Testimonial = { quote: string; name: string; detail: string; image?: string };

const INTERVAL_MS = 7000;

// Browser state read through useSyncExternalStore rather than an effect, so the
// server snapshot is explicit and there is no setState-in-effect.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const getHidden = () => document.hidden;

/**
 * Auto-advancing testimonials with manual controls.
 *
 * Pauses on hover, on keyboard focus, while the tab is hidden, and permanently
 * once someone navigates by hand — taking control should not mean fighting the
 * timer. Auto-advance never starts under prefers-reduced-motion.
 */
export function TestimonialCarousel({
  items,
  heading,
  fallbackImage,
}: {
  items: Testimonial[];
  /** Rendered above the quotes, inside the shared backdrop. */
  heading?: ReactNode;
  /** Used behind quotes that have no image of their own. */
  fallbackImage: string;
}) {
  const [index, setIndex] = useState(0);
  // Hover/focus and tab visibility pause independently — one must not clear the
  // other when they overlap.
  const [hovered, setHovered] = useState(false);
  const hidden = useSyncExternalStore(subscribeVisibility, getHidden, () => false);
  // Set once the visitor uses the controls; stops auto-advance for the session.
  const [manual, setManual] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

  const go = useCallback(
    (next: number) => setIndex(((next % items.length) + items.length) % items.length),
    [items.length],
  );

  const step = useCallback(
    (delta: number) => {
      setManual(true);
      go(index + delta);
    },
    [go, index],
  );

  useEffect(() => {
    // Don't advance in a background tab — visitors would return to a carousel
    // that had jumped several quotes ahead.
    if (hovered || hidden || manual || reduced || items.length < 2) return;
    const t = setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, hovered, hidden, manual, reduced, items.length, go]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Backdrops: every photo is mounted and cross-faded so switching does not
          wait on a network fetch. Only the first is priority-loaded. */}
      {items.map((t, i) => (
        <Image
          key={t.name}
          src={t.image ?? fallbackImage}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          className={`-z-20 object-cover transition-opacity duration-1000 motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 -z-10 bg-black/70" />

      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        {heading}
        <div
          className="relative mx-auto mt-10 max-w-3xl"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setHovered(true)}
          onBlurCapture={() => setHovered(false)}
          role="group"
          aria-roledescription="carousel"
          aria-label="What clients say"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
          }}
        >
          {/* Fixed-height stage: all quotes are stacked and cross-faded, so the
              section doesn't jump as the text length changes. */}
          <div className="relative min-h-56 sm:min-h-48">
            {items.map((t, i) => (
              <figure
                key={t.name}
                aria-hidden={i !== index}
                className={`absolute inset-0 flex flex-col justify-center transition-opacity duration-700 motion-reduce:transition-none ${
                  i === index ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <Quote {...t} />
              </figure>
            ))}
          </div>

          {/* Announce changes to screen readers without moving focus. */}
          <div aria-live="polite" className="sr-only">
            {`${items[index].name}, ${index + 1} of ${items.length}`}
          </div>

          {items.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous testimonial"
                className="rounded-full border border-white/30 p-2 text-white/80 transition hover:border-tjm-yellow hover:text-tjm-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tjm-yellow"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <ul className="flex items-center gap-2">
                {items.map((t, i) => (
                  <li key={t.name}>
                    <button
                      type="button"
                      onClick={() => {
                        setManual(true);
                        go(i);
                      }}
                      aria-label={`Show testimonial ${i + 1} of ${items.length}`}
                      aria-current={i === index}
                      className={`block h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tjm-yellow ${
                        i === index ? "w-6 bg-tjm-yellow" : "w-2 bg-white/40 hover:bg-white/70"
                      }`}
                    />
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next testimonial"
                className="rounded-full border border-white/30 p-2 text-white/80 transition hover:border-tjm-yellow hover:text-tjm-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tjm-yellow"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Quote({ quote, name, detail }: Testimonial) {
  return (
    <>
      <blockquote className="text-lg font-light leading-relaxed sm:text-xl">“{quote}”</blockquote>
      <figcaption className="mt-4 font-heading font-semibold text-tjm-yellow">
        {name} <span className="font-normal text-white/70">· {detail}</span>
      </figcaption>
    </>
  );
}
