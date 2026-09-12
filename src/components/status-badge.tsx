import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "border-tjm-orange bg-tjm-orange/10 text-[#b45200] dark:text-tjm-orange" },
  ACCEPTED: { label: "Confirmed", className: "border-tjm-lime bg-tjm-lime/15 text-[#5f6600] dark:text-tjm-lime" },
  DECLINED: { label: "Declined", className: "border-destructive/60 text-destructive" },
  CANCELLED_BY_CLIENT: { label: "Cancelled", className: "text-muted-foreground" },
  CANCELLED_BY_TRAINER: { label: "Cancelled by trainer", className: "text-muted-foreground" },
  COMPLETED: { label: "Completed", className: "text-muted-foreground" },
  CANCELLED: { label: "Cancelled", className: "text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STYLES[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-heading font-semibold", s.className, className)}>
      {s.label}
    </Badge>
  );
}
