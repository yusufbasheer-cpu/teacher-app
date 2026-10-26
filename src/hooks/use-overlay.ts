"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for a modal panel that isn't built on a dialog primitive:
 * moves focus in on open, keeps Tab inside, and hands focus back to whatever
 * opened it on close. (ConfirmDialog does the same inline; base-ui dialogs do
 * it natively.)
 */
export function useFocusTrap(open: boolean, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const opener = document.activeElement as HTMLElement | null;
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    items()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, panelRef]);
}

/**
 * Swipe-left-to-close for a side drawer, touch only. The panel follows the
 * finger, then either flies off (past 35% of its width, or a quick flick) or
 * snaps back. The gesture is only claimed once movement is clearly horizontal,
 * so vertical scrolling inside the drawer is never hijacked — pair with the
 * `touch-pan-y` class on the panel so the browser leaves horizontal moves to us.
 */
export function useSwipeToClose(
  active: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const el = panelRef.current;
    if (!active || !el) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dx = 0;
    let mode: "idle" | "pending" | "drag" = "idle";

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = e.timeStamp;
      dx = 0;
      mode = "pending";
    };
    const move = (e: PointerEvent) => {
      if (mode === "idle") return;
      const mx = e.clientX - x0;
      const my = e.clientY - y0;
      if (mode === "pending") {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (Math.abs(my) > Math.abs(mx) || mx > 0) {
          mode = "idle";
          return;
        }
        mode = "drag";
        el.setPointerCapture(e.pointerId);
        el.style.transition = "none";
      }
      dx = Math.min(0, mx);
      el.style.transform = `translateX(${dx}px)`;
    };
    const end = (e: PointerEvent) => {
      const dragged = mode === "drag";
      mode = "idle";
      if (!dragged) return;
      el.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
      const flick = -dx / Math.max(1, e.timeStamp - t0) > 0.5;
      if (e.type === "pointerup" && (-dx > el.offsetWidth * 0.35 || flick)) onClose();
      else el.style.transform = "";
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      el.style.transform = "";
      el.style.transition = "";
    };
  }, [active, panelRef, onClose]);
}

const subscribe = () => () => {};
/** "⌘" on Apple platforms, "Ctrl" elsewhere. Server render and first paint use "Ctrl"
 *  (React re-renders with the real value after hydration, so no mismatch warning). */
export function useModKey() {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
