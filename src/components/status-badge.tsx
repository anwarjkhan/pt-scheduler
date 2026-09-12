import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  ACCEPTED: { label: "Confirmed", className: "border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" },
  DECLINED: { label: "Declined", className: "border-red-400 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  CANCELLED_BY_CLIENT: { label: "Cancelled", className: "text-muted-foreground" },
  CANCELLED_BY_TRAINER: { label: "Cancelled by trainer", className: "text-muted-foreground" },
  COMPLETED: { label: "Completed", className: "text-muted-foreground" },
  CANCELLED: { label: "Cancelled", className: "text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STYLES[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}
