import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-zinc-200",
        secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        ghost: "text-zinc-100 hover:bg-zinc-800",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost"; size?: "default" | "sm" }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
