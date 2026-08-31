"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Numeric mirrors of --ease / --t / --t-slow (src/styles/tokens.css).
 * framer-motion transitions take numbers/eases, not CSS var strings, so the
 * tokens are duplicated here rather than read at runtime — same approach
 * `EASE_OUT` in components/ui/animate.tsx already takes.
 */
const EASE = [0.2, 0, 0, 1] as const
const T = 0.16
const T_SLOW = 0.24

/**
 * base-ui's own Accordion.Panel does its own CSS-measured height animation,
 * which would fight a framer-motion height tween layered on top of it. So
 * this primitive uses base-ui's Root/Item/Header/Trigger for state and a11y
 * (keyboard nav, aria-expanded are handled by base-ui regardless of whether
 * Panel is rendered) but renders its own plain panel driven by framer-motion,
 * wiring up id/aria-controls/role="region" by hand since base-ui never
 * registers a panel id without its own Panel mounted.
 */
type ItemContextValue = { open: boolean; panelId: string; triggerId: string }
const ItemContext = React.createContext<ItemContextValue | null>(null)

function useItemContext(component: string) {
  const ctx = React.useContext(ItemContext)
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <AccordionItem>`)
  }
  return ctx
}

function Accordion({
  className,
  ...props
}: AccordionPrimitive.Root.Props) {
  return (
    <MotionConfig reducedMotion="user">
      <AccordionPrimitive.Root
        data-slot="accordion"
        className={cn("flex flex-col", className)}
        {...props}
      />
    </MotionConfig>
  )
}

function AccordionItem({
  className,
  onOpenChange,
  ...props
}: AccordionPrimitive.Item.Props) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()

  return (
    <ItemContext.Provider
      value={{ open, panelId: `${id}-panel`, triggerId: `${id}-trigger` }}
    >
      <AccordionPrimitive.Item
        data-slot="accordion-item"
        onOpenChange={(nextOpen, eventDetails) => {
          setOpen(nextOpen)
          onOpenChange?.(nextOpen, eventDetails)
        }}
        className={cn("border-b border-line last:border-b-0", className)}
        {...props}
      />
    </ItemContext.Provider>
  )
}

const accordionTriggerVariants = cva(
  [
    "flex flex-1 items-center justify-between gap-4 text-left font-medium text-ink outline-none",
    "transition-colors duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)]",
    "hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:pointer-events-none disabled:opacity-45",
  ],
  {
    variants: {
      size: {
        default: "py-4 text-[13px]",
        sm: "py-3 text-xs",
      },
    },
    defaultVariants: { size: "default" },
  }
)

function AccordionTrigger({
  className,
  size,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props & VariantProps<typeof accordionTriggerVariants>) {
  const { open, panelId, triggerId } = useItemContext("AccordionTrigger")

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        id={triggerId}
        aria-controls={panelId}
        className={cn(accordionTriggerVariants({ size }), className)}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)]",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open, panelId, triggerId } = useItemContext("AccordionContent")
  /* MotionConfig's reducedMotion="user" only auto-suppresses transform
     values (x/y/scale/rotate) — height isn't one, so a reduced-motion user
     would still see the panel tween open over T_SLOW without this. */
  const reduceMotion = useReducedMotion()
  const duration = reduceMotion ? 0 : undefined

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="panel"
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          data-slot="accordion-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: duration ?? T_SLOW, ease: EASE },
            opacity: { duration: duration ?? T, ease: EASE },
          }}
          className="overflow-hidden"
        >
          <div className={cn("pb-4 text-sm leading-relaxed text-muted", className)}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
