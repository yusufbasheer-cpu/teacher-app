declare module "vanilla-tilt" {
  export interface VanillaTiltOptions {
    max?: number;
    speed?: number;
    glare?: boolean;
    "max-glare"?: number;
    scale?: number;
    perspective?: number;
    easing?: string;
    transition?: boolean;
    reset?: boolean;
  }

  export default class VanillaTilt {
    static init(elements: NodeListOf<Element> | Element | Element[], options?: VanillaTiltOptions): void;
  }
}

declare global {
  interface HTMLElement {
    vanillaTilt?: { destroy(): void };
  }
}

export {};
