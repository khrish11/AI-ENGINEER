import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "muted";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors select-none",
        {
          "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20":
            variant === "default",
          "bg-accent-violet/15 text-accent-violet border border-accent-violet/20":
            variant === "secondary",
          "border border-border text-foreground bg-transparent":
            variant === "outline",
          "bg-status-success/15 text-status-success border border-status-success/20":
            variant === "success",
          "bg-status-warning/15 text-status-warning border border-status-warning/20":
            variant === "warning",
          "bg-status-error/15 text-status-error border border-status-error/20":
            variant === "error",
          "bg-status-info/15 text-status-info border border-status-info/20":
            variant === "info",
          "bg-muted text-muted-foreground border border-border/50":
            variant === "muted",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
