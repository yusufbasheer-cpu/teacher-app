"use client";

import { useEffect } from "react";

const MAX_OFFSET = 8;
const PULL_STRENGTH = 0.38;

function isFinePointer(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function shouldBeMagnetic(el: HTMLElement): boolean {
  if (el.dataset.layahMagnetic === "off") return false;
  if (el.dataset.layahMagneticInit === "1") return false;
  if (el.getAttribute("aria-label") === "Toggle navigation menu") return false;
  if (el.getAttribute("aria-label") === "Toggle sounds") return false;
  if (el.closest("[data-layah-magnetic-skip]")) return false;

  if (el.tagName === "BUTTON") return true;

  if (el.tagName === "A") {
    const cls = el.className;
    if (typeof cls !== "string") return false;
    const isCta =
      /rounded-(lg|xl|2xl|full)/.test(cls) &&
      (/font-semibold|font-bold/.test(cls) || el.classList.contains("layah-magnetic-btn"));
    return isCta;
  }

  return el.classList.contains("layah-magnetic-btn");
}

type MagneticBinding = {
  onMove: (e: MouseEvent) => void;
  onLeave: () => void;
};

export function MagneticButtonsInit() {
  useEffect(() => {
    if (!isFinePointer()) return;

    const bindings = new Map<HTMLElement, MagneticBinding>();

    const attach = (el: HTMLElement) => {
      if (!shouldBeMagnetic(el)) return;
      el.dataset.layahMagneticInit = "1";
      el.style.transition = "transform 0.22s cubic-bezier(0.25, 0.8, 0.25, 1)";

      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const threshold = Math.max(rect.width, rect.height) * 1.15;
        if (dist > threshold) {
          el.style.transform = "";
          return;
        }
        const pull = (1 - dist / threshold) * PULL_STRENGTH;
        const tx = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * pull));
        const ty = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * pull));
        el.style.transform = `translate(${tx}px, ${ty}px)`;
      };

      const onLeave = () => {
        el.style.transform = "";
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      bindings.set(el, { onMove, onLeave });
    };

    const detach = (el: HTMLElement) => {
      const b = bindings.get(el);
      if (!b) return;
      el.removeEventListener("mousemove", b.onMove);
      el.removeEventListener("mouseleave", b.onLeave);
      el.style.transform = "";
      delete el.dataset.layahMagneticInit;
      bindings.delete(el);
    };

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>("button, a.layah-magnetic-btn, a.rounded-lg, a.rounded-xl, a.rounded-2xl, a.rounded-full").forEach(attach);
    };

    scan();

    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            detach(node);
            node.querySelectorAll<HTMLElement>("[data-layah-magnetic-init='1']").forEach(detach);
          }
        });
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches("button, a")) attach(node);
            scan(node);
          }
        });
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onMq = () => {
      if (!mq.matches) {
        [...bindings.keys()].forEach(detach);
      } else {
        scan();
      }
    };
    mq.addEventListener("change", onMq);

    return () => {
      mo.disconnect();
      mq.removeEventListener("change", onMq);
      [...bindings.keys()].forEach(detach);
    };
  }, []);

  return null;
}
