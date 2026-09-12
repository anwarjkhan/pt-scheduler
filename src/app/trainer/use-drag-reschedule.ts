"use client";

import { useCallback, useRef, useState } from "react";

export const SNAP_MIN = 15;

export type DragState = {
  id: string;
  /** Snapped start, in minutes from midnight. */
  startMin: number;
  durationMin: number;
  /**
   * Column the drag started in. Pointer capture keeps the gesture bound to this
   * block, so horizontal movement is ignored and the move stays same-day.
   */
  date: string;
};

export function minutesToHHMM(m: number) {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Pointer delta → snapped start minute, clamped so the block stays inside the
 * visible range. Pure so the arithmetic can be tested without a DOM.
 */
export function snapStart({
  startMin,
  deltaPx,
  pxPerMin,
  durationMin,
  minM,
  maxM,
}: {
  startMin: number;
  deltaPx: number;
  pxPerMin: number;
  durationMin: number;
  minM: number;
  maxM: number;
}) {
  const snapped = Math.round((startMin + deltaPx / pxPerMin) / SNAP_MIN) * SNAP_MIN;
  return Math.max(minM, Math.min(snapped, maxM - durationMin));
}

/**
 * Vertical, same-day drag for calendar blocks. Pointer events (not HTML5 drag)
 * so touch works and we keep control of the ghost position.
 *
 * The caller supplies the pixels-per-minute scale and the visible range so the
 * drop can be converted back to a time and clamped to the grid.
 */
export function useDragReschedule({
  pxPerMin,
  minM,
  maxM,
  onDrop,
}: {
  pxPerMin: number;
  minM: number;
  maxM: number;
  onDrop: (id: string, startTime: string) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Where in the block the pointer grabbed, and the original start — kept out of
  // state so pointermove doesn't re-render on every pixel.
  const origin = useRef<{ pointerY: number; startMin: number; moved: boolean } | null>(null);

  const begin = useCallback(
    (e: React.PointerEvent, booking: { id: string; startMin: number; durationMin: number; date: string }) => {
      // Left button / touch only; ignore secondary clicks.
      if (e.button !== 0) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      origin.current = { pointerY: e.clientY, startMin: booking.startMin, moved: false };
      setDrag({ id: booking.id, startMin: booking.startMin, durationMin: booking.durationMin, date: booking.date });
    },
    [],
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      const o = origin.current;
      if (!o) return;
      const deltaPx = e.clientY - o.pointerY;
      // A few pixels of slop so a click isn't read as a drag.
      if (!o.moved && Math.abs(deltaPx) < 4) return;
      o.moved = true;
      setDrag((d) => {
        if (!d) return d;
        const clamped = snapStart({ startMin: o.startMin, deltaPx, pxPerMin, durationMin: d.durationMin, minM, maxM });
        return clamped === d.startMin ? d : { ...d, startMin: clamped };
      });
    },
    [pxPerMin, minM, maxM],
  );

  const end = useCallback(() => {
    const o = origin.current;
    origin.current = null;
    setDrag((d) => {
      // Treat a no-movement press as a click; the block's onClick opens the dialog.
      if (d && o?.moved && d.startMin !== o.startMin) onDrop(d.id, minutesToHHMM(d.startMin));
      return null;
    });
  }, [onDrop]);

  /** True when this drag actually moved — lets the caller suppress the click. */
  const didMove = () => origin.current?.moved ?? false;

  return { drag, begin, move, end, didMove };
}
