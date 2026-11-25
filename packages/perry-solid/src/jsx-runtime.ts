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
  /**
   * Natively one Text widget, or an AttributedText when it holds other text elements. Inside another text,
   * an element keeps its weight, italic, underline, size and colour, but not a monospaced font,
   * strikethrough or background, and an `a` throws.
   */
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
    em: TextProps;
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
    output: TextProps;
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
    /**
     * `onSubmit` fires when a button inside it is clicked, unless the button's `type` is "button".
     * Call `event.preventDefault()`, or the web page reloads. Natively Return in a text field doesn't submit.
     */
    /** A bordered box; its `legend` goes first, inside the border, and `disabled` isn't supported. */
    fieldset: BlockProps;
    legend: TextProps;
    form: BlockProps & { onSubmit?: (event: { preventDefault(): void }) => void };
    /** Holds only `li`. */
    ul: BlockProps;
    /** Holds only `li`, numbered from 1. */
    ol: BlockProps;
    /**
     * Natively its marker beside a column of its children, so text with other elements in it
     * goes in a `span`: `<li><span>a <strong>b</strong></span></li>`.
     */
    li: BlockProps;
    /**
     * A `summary`, which must come first, and the children shown while open. Clicking the summary
     * opens and closes it; natively that doesn't fire `onToggle`.
     */
    details: BlockProps & { open?: boolean };
    summary: TextProps;
    /**
     * A box shown in place while `open`, on both platforms; it doesn't float above the page or
     * window. `showModal()` is web-only.
     */
    dialog: BlockProps & { open?: boolean };
    /** Natively underlined text that opens `href` with the system when clicked; `target` has no effect there. */
    a: TextProps & { href?: string; target?: string };
    button: Common & { children?: Element; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void };
    hr: Common;
    /**
     * `src` is a URL, a `data:` URL, or a path into Vite's `public/` folder, which the native build
     * copies into the app bundle. Give both `width` and `height`: natively an image stretches to fill them.
     */
    img: Common & { src: string; alt?: string; width?: number; height?: number };
    /** Natively a bar drawn from stacks; without a `value` it's a spinner. */
    progress: Common & { value?: number; max?: number };
    /** Drawn as `progress` is; `low`, `high` and `optimum` aren't supported. */
    meter: Common & { value?: number; min?: number; max?: number };
    /** Natively a WebKit view with its own cookies and storage. 300 by 150 pixels unless sized. */
    iframe: Common & { src?: string; width?: number; height?: number };
    canvas: Common & {
      ref?: HTMLCanvasElement | ((element: HTMLCanvasElement) => void);
      width?: number;
      height?: number;
    };
    input: ControlProps & {
      type?: "text" | "password" | "search" | "email" | "url" | "tel" | "number" | "checkbox" | "range" | "date";
      value?: string | number;
      checked?: boolean;
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
      /** A `datalist`'s id. Natively the input is then a combobox, which shows no placeholder. */
      list?: string;
    };
    textarea: ControlProps & { value?: string; placeholder?: string };
    select: ControlProps & { value?: string; children?: Element };
    datalist: { id: string; children?: Element };
    option: { value?: string; children?: string };
    /** Natively a row; clicking its text flips a checkbox inside it. */
    label: Common & { children?: Element };
  }
}
