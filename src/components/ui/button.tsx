import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const libraryButtonStyles = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-bold transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap",
  {
    variants: {
      variant: {
        accent:
          "bg-accent text-on-accent hover:bg-[#b8d4ec] hover:-translate-y-0.5 rounded-xl",
        accentPill:
          "bg-accent text-on-accent hover:bg-[#b8d4ec] hover:-translate-y-0.5 rounded-full",
        accent2:
          "bg-accent2 text-on-accent hover:bg-[#5dd4a0] hover:-translate-y-0.5 rounded-xl",
        accent2Pill:
          "bg-accent2 text-on-accent hover:bg-[#5dd4a0] hover:-translate-y-0.5 rounded-full",
        outline:
          "bg-transparent text-white border border-white/25 hover:bg-white/8 hover:border-white/50 rounded-xl font-semibold",
        secondary:
          "bg-white/6 text-white/75 border border-white/12 hover:bg-white/10 hover:border-white/25 hover:text-white rounded-xl font-semibold",
        ghost:
          "bg-transparent text-white/40 hover:text-white/75 rounded-xl font-semibold",
        danger:
          "bg-danger/10 text-danger/85 border border-danger/20 hover:bg-danger/20 hover:text-danger rounded-xl font-semibold",
      },
      size: {
        sm: "px-3.5 py-1.5 text-xs",
        md: "px-5 py-2.5 text-sm",
        lg: "px-6 py-3 text-[0.92rem]",
        icon: "h-9 w-9 p-0 rounded-[9px]",
      },
    },
    defaultVariants: {
      variant: "accent",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof libraryButtonStyles> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...rest
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(libraryButtonStyles({ variant, size }), className)}
      {...rest}
    />
  );
}
