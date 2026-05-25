import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-zinc-800 text-zinc-100",
      success: "bg-emerald-500/20 text-emerald-300",
      danger: "bg-rose-500/20 text-rose-300",
      warning: "bg-amber-500/20 text-amber-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "danger" | "warning" }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
