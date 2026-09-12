import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "border-tjm-orange bg-tjm-orange/10 text-[#b45200] dark:text-tjm-orange" },
  ACCEPTED: { label: "Confirmed", className: "border-[#166b3a] bg-tjm-confirm text-white" },
  DECLINED: { label: "Declined", className: "border-destructive/60 text-destructive" },
  CANCELLED_BY_CLIENT: { label: "Cancelled", className: "border-destructive/50 bg-destructive/10 text-destructive" },
  CANCELLED_BY_TRAINER: { label: "Cancelled by trainer", className: "border-destructive/50 bg-destructive/10 text-destructive" },
  COMPLETED: { label: "Completed", className: "text-muted-foreground" },
  CANCELLED: { label: "Cancelled", className: "border-destructive/50 bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STYLES[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-heading font-semibold", s.className, className)}>
      {s.label}
    </Badge>
  );
}
