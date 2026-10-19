import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "link"
    | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none",
          {
            // Variants
            "bg-cyan-700 text-white hover:bg-cyan-800 shadow-sm active:scale-[0.98]":
              variant === "default",
            "bg-violet-700 text-white hover:bg-violet-800 shadow-sm active:scale-[0.98]":
              variant === "accent",
            "bg-surface text-foreground border border-border hover:bg-muted active:scale-[0.98]":
              variant === "secondary",
            "border border-border bg-transparent text-foreground hover:bg-muted hover:border-foreground/20 active:scale-[0.98]":
              variant === "outline",
            "text-foreground hover:bg-muted active:scale-[0.98]":
              variant === "ghost",
            "bg-status-error text-white hover:bg-status-error/90 shadow-sm active:scale-[0.98]":
              variant === "destructive",
            "text-accent-cyan underline-offset-4 hover:underline p-0 h-auto font-normal":
              variant === "link",
          },
          {
            // Sizes
            "h-8 px-3 text-xs rounded-md gap-1.5": size === "sm",
            "h-10 px-4 text-sm rounded-lg gap-2": size === "md",
            "h-12 px-6 text-base rounded-lg gap-2.5": size === "lg",
            "h-10 w-10 p-0 rounded-lg": size === "icon",
          },
          className
        )}
        {...props}
      >
        {isLoading && (
          <Loader2
            className="h-4 w-4 animate-spin text-current"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
