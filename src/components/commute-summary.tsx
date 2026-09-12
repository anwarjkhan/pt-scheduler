import type { Leg, SlotEvaluation } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import { AlertTriangle, Car, Home } from "lucide-react";

function LegLine({ leg, direction }: { leg: Leg; direction: "before" | "after" }) {
  const tight = leg.shortfallMin > 0;
  const who = leg.anchor === "home" ? "home" : "previous session";
  const label =
    direction === "before"
      ? leg.anchor === "home"
        ? "From home"
        : "From previous session"
      : leg.anchor === "home"
        ? "Back home"
        : "To next session";
  return (
    <div className={cn("flex items-start gap-2 text-sm", tight ? "text-destructive" : "text-muted-foreground")}>
      {leg.anchor === "home" ? <Home className="mt-0.5 h-4 w-4 shrink-0" /> : <Car className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        <span className="font-medium">{label}:</span> {leg.requiredMin === 0 ? "same location" : `${leg.travelMin} min drive`}
        {leg.estimated && leg.requiredMin > 0 && <span className="ml-1 text-xs">(estimated)</span>}
        {leg.gapMin !== undefined && leg.requiredMin > 0 && (
          <span>
            {" "}
            · {leg.gapMin} min gap, needs {leg.requiredMin}
            {tight && <strong> — {leg.shortfallMin} min short</strong>}
          </span>
        )}
        {direction === "before" && leg.anchor !== "home" && !tight && leg.requiredMin > 0 && <span className="sr-only">{who}</span>}
      </div>
    </div>
  );
}

/** Human-readable commute analysis for a slot or booking. */
export function CommuteSummary({ evaluation, compact = false }: { evaluation: SlotEvaluation; compact?: boolean }) {
  return (
    <div className={cn("space-y-1", compact && "text-xs")}>
      {evaluation.warning && (
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> Not enough travel time between sessions
        </div>
      )}
      {evaluation.before && <LegLine leg={evaluation.before} direction="before" />}
      {evaluation.after && <LegLine leg={evaluation.after} direction="after" />}
    </div>
  );
}
