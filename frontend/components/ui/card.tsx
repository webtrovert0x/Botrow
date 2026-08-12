import * as React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradientBorder" | "interactive";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass", children, ...props }, ref) => {
    const variants = {
      default: "bg-zinc-900 border border-zinc-800 rounded-2xl p-6",
      glass: "bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]",
      gradientBorder: "relative bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-6 border border-transparent before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-r before:from-cyan-500/40 before:via-purple-500/40 before:to-pink-500/40 before:-z-10 before:mask-[linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]",
      interactive: "bg-zinc-900/50 backdrop-blur-xl border border-white/10 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 group cursor-pointer",
    };

    return (
      <div ref={ref} className={cn(variants[variant], className)} {...props}>
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl font-semibold text-white tracking-tight leading-none", className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-zinc-400 leading-relaxed", className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("py-2", className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center justify-between pt-4 border-t border-white/10 mt-auto", className)} {...props}>
    {children}
  </div>
);
