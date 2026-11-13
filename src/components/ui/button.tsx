import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 max-w-full min-w-0 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-center select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#C94400] text-white shadow-sm hover:bg-[#B33D00] active:translate-y-0.5 transition-all",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border-2 border-[#FF5A00] text-[#FF5A00] bg-transparent hover:bg-[#C94400] hover:text-white transition-colors",
        secondary:
          "bg-[#C94400]/95 text-white shadow-sm hover:bg-[#C94400]",
        ghost: "hover:bg-[#B33D00]/10 hover:text-[#FF5A00]",
        link: "text-[#FF5A00] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[36px] px-4 py-2",
        sm: "min-h-[32px] rounded-md px-3 text-xs py-1.5",
        lg: "min-h-[40px] rounded-md px-8 py-2.5",
        icon: "h-9 w-9 shrink-0",
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
