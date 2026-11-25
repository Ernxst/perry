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
  /** Natively a single Text widget, so its children must be text, not other elements. */
  interface TextProps extends Common {
    children?: Element;
  }
  /** Natively a VStack; on the web a flex column with the stacks' gap. */
  interface BlockProps extends Common {
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
    h4: TextProps;
    h5: TextProps;
    h6: TextProps;
    small: TextProps;
    sub: TextProps;
    sup: TextProps;
    strong: TextProps;
    b: TextProps;
    /** Natively upright: a Perry Text can't be italic. */
    em: TextProps;
    /** Natively upright: a Perry Text can't be italic. */
    i: TextProps;
    u: TextProps;
    ins: TextProps;
    s: TextProps;
    del: TextProps;
    code: TextProps;
    kbd: TextProps;
    samp: TextProps;
    pre: TextProps;
    mark: TextProps;
    abbr: TextProps;
    cite: TextProps;
    dfn: TextProps;
    var: TextProps;
    time: TextProps;
    address: TextProps;
    figcaption: TextProps;
    div: BlockProps;
    main: BlockProps;
    header: BlockProps;
    footer: BlockProps;
    nav: BlockProps;
    section: BlockProps;
    article: BlockProps;
    aside: BlockProps;
    figure: BlockProps;
    search: BlockProps;
    menu: BlockProps;
    /** Natively underlined text that opens `href` with the system when clicked; `target` has no effect there. */
    a: TextProps & { href?: string; target?: string };
    button: Common & { children?: Element; disabled?: boolean; onClick?: () => void };
    hr: Common;
    /**
     * `src` is a URL, a `data:` URL, or a path into Vite's `public/` folder, which the native build
     * copies into the app bundle. Give both `width` and `height`: natively an image stretches to fill them.
     */
    img: Common & { src: string; alt?: string; width?: number; height?: number };
    /** Natively a bar drawn from stacks; without a `value` it's a spinner. */
    progress: Common & { value?: number; max?: number };
    canvas: Common & {
      ref?: HTMLCanvasElement | ((element: HTMLCanvasElement) => void);
      width?: number;
      height?: number;
    };
    input: ControlProps & {
      type?: "text" | "password" | "checkbox" | "range" | "date";
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
    /** Natively a row; clicking its text flips a checkbox inside it. */
    label: Common & { children?: Element };
  }
}
