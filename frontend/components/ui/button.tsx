import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass" | "gradient" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer select-none";
    
    const variants = {
      primary: "bg-cyan-500 text-black hover:bg-cyan-400 font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]",
      secondary: "bg-zinc-800 text-white hover:bg-zinc-700 border border-white/10",
      glass: "bg-white/5 backdrop-blur-md text-white hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-lg",
      gradient: "bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 text-white font-semibold shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] border border-white/20",
      outline: "bg-transparent text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/10 hover:border-cyan-400",
      danger: "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 h-8 gap-1.5",
      md: "text-sm px-5 py-2.5 h-10 gap-2",
      lg: "text-base px-7 py-3.5 h-12 gap-2.5",
      icon: "w-10 h-10 justify-center p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
