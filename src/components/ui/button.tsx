import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 max-w-full min-w-0 rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-center select-none touch-manipulation",
  {
    variants: {
      variant: {
        default:
          "bg-[#FF5A00] text-white shadow-[0_8px_20px_-10px_rgba(255,90,0,0.85)] hover:bg-[#e04e00] hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border-2 border-[#FF5A00] text-[#FF5A00] bg-transparent hover:bg-[#FF5A00] hover:text-white",
        secondary:
          "bg-[#FF5A00]/90 text-white shadow-sm hover:bg-[#FF5A00]",
        ghost: "hover:bg-[#FF5A00]/10 hover:text-[#FF5A00]",
        link: "text-[#FF5A00] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[40px] px-4 py-2",
        sm: "min-h-[34px] rounded-md px-3 text-xs py-1.5",
        lg: "min-h-[44px] rounded-xl px-8 py-2.5",
        icon: "h-10 w-10 shrink-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
