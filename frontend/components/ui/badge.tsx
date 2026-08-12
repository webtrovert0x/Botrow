import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "cyan" | "emerald" | "purple" | "amber" | "rose" | "zinc" | "ai";
  size?: "sm" | "md";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "cyan", size = "md", children, ...props }, ref) => {
    const variants = {
      cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
      purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      rose: "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
      zinc: "bg-zinc-800 text-zinc-300 border-zinc-700",
      ai: "bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 text-cyan-300 border border-white/20 shadow-[0_0_15px_rgba(99,102,241,0.3)] backdrop-blur-md font-semibold flex items-center gap-1.5",
    };

    const sizes = {
      sm: "text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-bold",
      md: "text-xs px-2.5 py-1 rounded-full font-medium",
    };

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center justify-center border transition-colors w-fit whitespace-nowrap", variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Badge.displayName = "Badge";
