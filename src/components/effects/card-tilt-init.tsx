"use client";

import { useEffect } from "react";

const CARD_SELECTOR = [
  ".layah-tilt-card",
  ".card-hover",
  "article.rounded-2xl",
  "article.rounded-3xl",
  "div.rounded-2xl.bg-white",
  "div.rounded-3xl.border",
].join(", ");

function isFinePointer(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function isTiltCandidate(el: HTMLElement): boolean {
  if (el.dataset.layahTilt === "off") return false;
  if (el.dataset.layahTiltInit === "1") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 140 || rect.height < 72) return false;
  if (el.closest("button, a, input, textarea, select, label")) return false;
  return true;
}

export function CardTiltInit() {
  useEffect(() => {
    if (!isFinePointer()) return;

    let VanillaTilt: typeof import("vanilla-tilt").default | null = null;
    const observed = new WeakSet<HTMLElement>();

    const destroyTilt = (el: HTMLElement) => {
      el.vanillaTilt?.destroy();
      delete el.dataset.layahTiltInit;
    };

    const initOne = async (el: HTMLElement) => {
      if (!isTiltCandidate(el) || observed.has(el)) return;
      if (!VanillaTilt) {
        const mod = await import("vanilla-tilt");
        VanillaTilt = mod.default;
      }
      observed.add(el);
      el.dataset.layahTiltInit = "1";
      VanillaTilt.init(el, {
        max: 10,
        speed: 400,
        glare: true,
        "max-glare": 0.12,
        scale: 1.02,
        perspective: 900,
        easing: "cubic-bezier(.03,.98,.52,.99)",
      });
    };

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((el) => {
        void initOne(el);
      });
    };

    scan();

    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            destroyTilt(node);
            node.querySelectorAll<HTMLElement>("[data-layah-tilt-init='1']").forEach(destroyTilt);
          }
        });
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches(CARD_SELECTOR)) void initOne(node);
            scan(node);
          }
        });
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onMq = () => {
      if (!mq.matches) {
        document.querySelectorAll<HTMLElement>("[data-layah-tilt-init='1']").forEach(destroyTilt);
      } else {
        scan();
      }
    };
    mq.addEventListener("change", onMq);

    return () => {
      mo.disconnect();
      mq.removeEventListener("change", onMq);
      document.querySelectorAll<HTMLElement>("[data-layah-tilt-init='1']").forEach(destroyTilt);
    };
  }, []);

  return null;
}
