import type { NativeNode } from "./renderer.ts";

/**
 * The HTML elements shared code may use. Natively each maps to a Perry widget; on the web
 * Solid renders the real element, so only attributes both builds honour are listed.
 */
export namespace JSX {
  /** A native node in Perry builds and a DOM node on the web, plus what Solid accepts as children. */
  export type Element = NativeNode | Node | string | number | boolean | null | undefined | Element[] | (() => Element);
  export type ElementType = keyof IntrinsicElements | ((props: any) => Element);
  export interface ElementChildrenAttribute { children: {}; }

  /**
   * What both builds pass to `onInput` and `onChange`. A text input's `onChange` fires when editing ends in both;
   * natively a textarea, slider or select fires both handlers on every change.
   */
  export type ControlEvent = { currentTarget: { value: string; checked: boolean } };
  type Handler = (event: ControlEvent) => void;

  interface Common {
    hidden?: boolean;
    title?: string;
  }
  interface TextProps extends Common {
    children?: Element;
  }
  interface ControlProps extends Common {
    disabled?: boolean;
    onInput?: Handler;
    onChange?: Handler;
  }

  export interface IntrinsicElements {
    span: TextProps;
    p: TextProps;
    h1: TextProps;
    h2: TextProps;
    h3: TextProps;
    small: TextProps;
    button: Common & { children?: Element; disabled?: boolean; onClick?: () => void };
    hr: Common;
    canvas: Common & {
      ref?: HTMLCanvasElement | ((element: HTMLCanvasElement) => void);
      width?: number;
      height?: number;
    };
    input: ControlProps & {
      type?: "text" | "checkbox" | "range";
      value?: string | number;
      checked?: boolean;
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
    };
    textarea: ControlProps & { value?: string; placeholder?: string };
    select: ControlProps & { value?: string; children?: Element };
    option: { value?: string; children?: string };
  }
}
