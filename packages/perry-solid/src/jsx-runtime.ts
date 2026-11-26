import type { JSX as WebJSX } from "@solidjs/web";
import type { NativeNode } from "./renderer.ts";

/**
 * The HTML elements shared code may use. Natively each maps to a Perry widget; on the web
 * Solid renders the real element, so only attributes both builds honour are listed.
 */
export namespace JSX {
  /**
   * A native node in Perry builds and a DOM node on the web, plus what Solid accepts as children.
   * It is Solid's own web element type, so components written for the web, like a headless
   * library's, are valid in shared code and accept shared children.
   */
  export type Element = NativeNode | WebJSX.Element;
  export type ElementType = keyof IntrinsicElements | ((props: any) => Element);
  export interface ElementChildrenAttribute { children: {}; }

  /**
   * What both builds pass to `onInput` and `onChange`. A text input's `onChange` fires when editing ends in both;
   * natively a textarea, slider or select fires both handlers on every change.
   */
  export type ControlEvent = { currentTarget: { value: string; checked: boolean } };
  type Handler = (event: ControlEvent) => void;
  export type KeyEvent = { key: string; preventDefault(): void };

  /**
   * `role`, `tabIndex` and the `aria-*` attributes reach assistive technology on the web; natively
   * they're accepted and have no effect, except `role="switch"`, which draws a checkbox as a switch.
   */
  interface Common {
    hidden?: boolean;
    title?: string;
    role?: string;
    tabIndex?: number;
    [aria: `aria-${string}`]: string | number | boolean | undefined;
  }
  /**
   * Natively the event is a left click: `button` is 0, `clientX`, `pageX` and `offsetX` and their
   * `Y` partners are where the mouse last went down, in points, the modifier keys are those held, except on a link, where they're false, and `currentTarget` and `target` are
   * both the element, whose `getAttribute` reads its props. `preventDefault()` stops a link from
   * opening its `href`. A text element inside another text gets no clicks of its own. Only the
   * innermost element with a handler gets a click, and while any element around a button or other
   * control has a handler, clicking the control fires that handler instead.
   *
   * `onKeyDown`, with `tabIndex` and `role`, lets a keyboard reach the element on the web. Natively
   * the element can't take focus, so it never fires.
   */
  interface Clickable {
    onClick?: (event: unknown) => void;
    onKeyDown?: (event: KeyEvent) => void;
  }
  /**
   * Natively one Text widget, or an AttributedText when it holds other text elements. Inside another text,
   * an element keeps its weight, italic, underline, size and colour, but not a monospaced font,
   * strikethrough or background, and an `a` throws.
   */
  interface TextProps extends Common, Clickable {
    children?: Element;
    /**
     * Natively only `color`, as hex, `rgb()` or `rgba()`, and `max-width` in pixels. The colour
     * is fixed, so it doesn't follow dark mode as the system's text colour does.
     */
    style?: { color?: string; "max-width"?: `${number}px` };
  }
  /** Natively a VStack; on the web a flex column with the stacks' gap. */
  interface BlockProps extends Common, Clickable {
    children?: Element;
  }
  interface TablePartProps extends Common, Clickable {
    children?: Element;
  }
  /**
   * Natively a cell lays its children out in a line. Each column is as wide as the `width` of its cell
   * in the table's first row, or 100 pixels; on the web the table uses fixed layout to match, so
   * `width` on any other row's cells has no effect.
   */
  interface CellProps extends TablePartProps {
    width?: number;
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
     * A box shown in place while `open`. Through its `ref`, `show()`, `showModal()`, `close()`,
     * `open` and `returnValue` work in both builds; `showModal()` centres the box, at most 480
     * pixels wide, over the window, which it dims. `onClose` fires when `close()` closes it. Natively
     * Escape doesn't close it, `form method="dialog"` doesn't either, and the root that `render`
     * mounts into must be a `ZStack`.
     */
    dialog: BlockProps & {
      open?: boolean;
      onClose?: () => void;
      ref?: HTMLDialogElement | ((element: HTMLDialogElement) => void);
    };
    /** Holds `thead`, `tbody`, `tfoot` and `tr`; natively a `thead` or `tfoot` stays where it's written. */
    table: TablePartProps;
    /** Holds only `tr`. */
    thead: TablePartProps;
    /** Holds only `tr`. */
    tbody: TablePartProps;
    /** Holds only `tr`. */
    tfoot: TablePartProps;
    /** Holds only `th` and `td`. */
    tr: TablePartProps;
    /** A header cell: its text is bold and centred. */
    th: CellProps;
    td: CellProps;
    /** Natively underlined text that opens `href` with the system when clicked; `target` has no effect there. */
    a: TextProps & { href?: string; target?: string };
    button: Common & { children?: Element; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void };
    hr: Common;
    /**
     * `src` is a URL, a `data:` URL, or a path into Vite's `public/` folder, which the native build
     * copies into the app bundle. Give both `width` and `height`: natively an image stretches to fill them.
     */
    img: Common & Clickable & { src: string; alt?: string; width?: number; height?: number };
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
      type?: "text" | "password" | "search" | "email" | "url" | "tel" | "number" | "checkbox" | "radio" | "range" | "date";
      value?: string | number;
      checked?: boolean;
      /** Groups radios: checking one unchecks the others with its name. */
      name?: string;
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
      /** The field's width in characters. */
      size?: number;
      /** A `datalist`'s id. Natively the input is then a combobox, which shows no placeholder. */
      list?: string;
    };
    textarea: ControlProps & { value?: string; placeholder?: string };
    select: ControlProps & { value?: string; children?: Element };
    datalist: { id: string; children?: Element };
    option: { value?: string; children?: string };
    /** Natively a row; clicking its text flips a checkbox inside it. */
    label: Common & Clickable & { children?: Element };
  }
}
