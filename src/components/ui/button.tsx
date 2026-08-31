import { isValidElement, type ReactElement } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The one button in the product.
 *
 * Previously this existed but was used in six files while 119 raw `<button>`
 * elements were hand-styled elsewhere, so "what a button looks like" had no
 * answer. Every new surface uses this.
 *
 * Variants encode *rank*, not colour. There is one primary action per view and
 * it is the only thing wearing a filled brand background — that is the whole
 * reason the rest of the chrome is achromatic. `danger` is reserved for
 * actions that destroy data; a merely-cautionary action is `outline`.
 *
 * Kept on base-ui's Button so `render={<Button />}` composition in
 * dialog.tsx / sheet.tsx keeps working.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 select-none items-center justify-center gap-1.5",
    "whitespace-nowrap rounded-md border border-transparent font-medium",
    "transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-[110ms] ease-[cubic-bezier(0.2,0,0,1)]",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /* The single filled action. */
        default: "bg-brand text-brand-on hover:bg-brand-hover active:bg-brand-active",
        /* Default for anything secondary that still needs an edge. */
        outline:
          "border-line bg-surface text-ink hover:bg-hover hover:border-line-strong aria-expanded:bg-hover",
        /* Tinted, for a secondary action that belongs to the primary one. */
        subtle:
          "bg-brand-subtle text-brand-text hover:bg-brand-subtle-hover border-transparent",
        /* Lowest rank — toolbars, row actions, dismissals. */
        ghost: "text-muted hover:bg-hover hover:text-ink aria-expanded:bg-hover",
        secondary: "bg-sunken text-ink hover:bg-hover",
        /* Destroys data. Filled only when it is the confirming action. */
        danger: "bg-danger text-danger-on hover:opacity-90",
        "danger-quiet":
          "text-danger-text hover:bg-danger-subtle border-transparent",
        link: "text-brand-text underline-offset-4 hover:underline h-auto p-0",
      },
      size: {
        xs: "h-6 px-1.5 text-[11px] rounded-sm [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-2 text-[12px] [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-8 px-2.5 text-[13px]",
        lg: "h-9 px-3.5 text-[13px]",
        /* Page-level primary actions. The old scale topped out at 36px, which
           is why the product's most important button never looked important. */
        xl: "h-11 px-5 text-[14px] rounded-lg",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
      },
      /** Fills the container. Use for stacked mobile actions and menu items. */
      block: { true: "w-full", false: "" },
      /** A subtle hover-lift + press-scale, layered on top of any variant
       * above — variants encode rank, this encodes emphasis. Reserved for a
       * page's single most important CTA (e.g. a hero "Start Generating"),
       * not a default to reach for. */
      interactive: {
        true: "hover:-translate-y-px hover:shadow-pop active:translate-y-0 active:scale-[0.97]",
        false: "",
      },
    },
    defaultVariants: { variant: "default", size: "default", block: false, interactive: false },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  block,
  interactive,
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  /* base-ui warns (and loses button semantics) if it renders a non-<button>
     while still claiming to be one. `render={<Link />}` is the common case
     here — a navigation styled as a button — so infer it rather than making
     every call site remember to pass `nativeButton={false}`. */
  const renderedElement =
    isValidElement(render) ? (render as ReactElement).type : undefined
  const inferredNative =
    renderedElement === undefined ? undefined : renderedElement === "button"

  return (
    <ButtonPrimitive
      data-slot="button"
      render={render}
      nativeButton={nativeButton ?? inferredNative}
      className={cn(buttonVariants({ variant, size, block, interactive, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
