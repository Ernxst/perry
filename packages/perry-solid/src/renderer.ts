import { createRenderer } from "solid-js/universal";
import type { JSX } from "./jsx-runtime.ts";
import { createRoot, getOwner, onCleanup, mergeProps, For as SolidFor, type Accessor } from "solid-js";

export type ElementName =
  | "VStack" | "HStack" | "ZStack" | "Spacer" | "ScrollView"
  | "Image" | "Progress" | "Text" | "RichText" | "ListItem" | "Button" | "Divider" | "Canvas" | "Input" | "TextArea" | "Picker" | "Option" | "Label";

/** What a native control reports to the `onInput` and `onChange` handlers, as `event.currentTarget`. */
export interface ControlState {
  value: string;
  checked: boolean;
}

/** A stretch of a text element's content, with the tags of the elements it sits in, outermost first. */
export interface TextRun {
  text: string;
  tags: string[];
}
export type Props = Record<string, unknown>;
export type Child = JSX.Element;
export type Component<P = Props> = (props: P) => Child;

/** Solid For with native children instead of DOM-specific JSX declarations. */
export const For = SolidFor as <T>(props: {
  each: readonly T[] | false | null | undefined;
  fallback?: Child;
  children: (item: T, index: Accessor<number>) => Child;
}) => Child;

/** Backend operations. Handles belong to the native widget registry. */
export interface NativeDriver {
  /**
   * `tag` is the JSX name; `emit` calls the element's handler for an event, such as `onClick`.
   * A text element is created as `RichText` while it holds other text elements; its content then
   * arrives as a `runs` property, a `TextRun[]`, instead of `text`.
   */
  create(kind: ElementName, tag: string, emit: (handler: string, state: ControlState) => void): number;
  setProperty(handle: number, kind: ElementName, name: string, value: unknown, previous: unknown): void;
  insert(parent: number, child: number, index: number, previousParent: number | null): void;
  move(parent: number, from: number, to: number): void;
  remove(parent: number, child: number): void;
  /**
   * The object `ref` receives for an element of this kind, if it isn't the plain node.
   * The node's fields are copied onto it, which is why the child list is `nodes`:
   * a DOM element's `children` is read-only.
   */
  element?(kind: ElementName, handle: number): object | undefined;
}

/** Retained ordering metadata; native handles themselves have no sibling API. */
export interface NativeNode {
  kind: ElementName | "#text" | "#root";
  tag: string;
  handle: number;
  materialized: boolean;
  parent: NativeNode | null;
  nodes: NativeNode[];
  props: Props;
  text: string;
}

function isText(node: NativeNode): boolean {
  return node.kind === "Text" || node.kind === "RichText";
}

function isLabel(node: NativeNode): boolean {
  return isText(node) || node.kind === "Button" || node.kind === "Option";
}

// JSX names, the shared code's web elements plus the stack components' own tags, to native kinds.
const kinds: Record<string, ElementName> = {
  vstack: "VStack", hstack: "HStack", zstack: "ZStack", spacer: "Spacer", scrollview: "ScrollView",
  span: "Text", p: "Text", h1: "Text", h2: "Text", h3: "Text", h4: "Text", h5: "Text", h6: "Text", small: "Text", a: "Text",
  strong: "Text", b: "Text", em: "Text", i: "Text", u: "Text", ins: "Text", s: "Text", del: "Text",
  code: "Text", kbd: "Text", samp: "Text", var: "Text", pre: "Text", mark: "Text", sub: "Text", sup: "Text",
  abbr: "Text", cite: "Text", dfn: "Text", time: "Text", address: "Text", figcaption: "Text",
  div: "VStack", main: "VStack", header: "VStack", footer: "VStack", nav: "VStack", section: "VStack",
  article: "VStack", aside: "VStack", figure: "VStack", search: "VStack", menu: "VStack",
  ul: "VStack", ol: "VStack", li: "ListItem",
  button: "Button", hr: "Divider", canvas: "Canvas", img: "Image", progress: "Progress", meter: "Progress", output: "Text",
  input: "Input", textarea: "TextArea", select: "Picker", option: "Option", label: "Label",
};

function isContainer(node: NativeNode): boolean {
  return node.kind === "VStack" || node.kind === "HStack" || node.kind === "ZStack" || node.kind === "ScrollView" || node.kind === "Picker" || node.kind === "Label" || node.kind === "ListItem" || node.kind === "#root";
}

export function createNativeRenderer(driver: NativeDriver) {
  function makeNode(kind: NativeNode["kind"], text = "", tag = ""): NativeNode {
    return { kind, tag, handle: 0, materialized: false, parent: null, nodes: [], props: {}, text };
  }

  function emitter(node: NativeNode) {
    return (handler: string, state: ControlState) => {
      const callback = node.props[handler];
      if (typeof callback === "function") callback({ currentTarget: state, target: state });
    };
  }

  function createElement(tag: string): NativeNode {
    const kind = kinds[tag];
    if (!kind) throw new Error(`Unsupported element <${tag}>`);
    // A text element nested in another has no widget of its own, and whether one holds
    // other elements picks its widget, so its widget waits until it joins a stack.
    if (kind === "Text") return makeNode(kind, "", tag);
    let node: NativeNode;
    const handle = driver.create(kind, tag, (handler, state) => emitter(node)(handler, state));
    const element = driver.element?.(kind, handle);
    node = element ? Object.assign(element, makeNode(kind, "", tag)) : makeNode(kind, "", tag);
    // A native button's dispatcher outlives a removed Solid owner. Release
    // user callbacks when that owner is disposed, even before native detach.
    if (getOwner()) onCleanup(() => { node.props = {}; });
    node.handle = handle;
    node.materialized = true;
    return node;
  }

  function materialize(node: NativeNode): number {
    // Text under a Text/Button contributes to its label. Allocate an independent
    // native Text only when the text node is actually inserted into a container.
    if (node.kind === "#text" && !node.materialized) {
      node.handle = driver.create("Text", "span", () => {});
      node.materialized = true;
      driver.setProperty(node.handle, "Text", "text", node.text, undefined);
    }
    if (isText(node) && !node.materialized) {
      node.kind = isRich(node) ? "RichText" : "Text";
      node.handle = driver.create(node.kind, node.tag, emitter(node));
      node.materialized = true;
      for (const name of Object.keys(node.props)) {
        if (!name.startsWith("on")) driver.setProperty(node.handle, node.kind as ElementName, name, node.props[name], undefined);
      }
      refreshText(node);
    }
    return node.handle;
  }

  function isRich(node: NativeNode): boolean {
    return node.nodes.some(child => child.kind !== "#text");
  }

  function collectRuns(node: NativeNode, tags: string[], runs: TextRun[]): TextRun[] {
    for (const child of node.nodes) {
      if (child.kind === "#text") runs.push({ text: child.text, tags });
      else if (!child.props.hidden) collectRuns(child, tags.concat(child.tag), runs);
    }
    return runs;
  }

  function refreshText(node: NativeNode): void {
    if (!node.materialized) return;
    const rich = isRich(node);
    if ((node.kind === "RichText") !== rich) return rebuild(node);
    if (rich) driver.setProperty(node.handle, "RichText", "runs", collectRuns(node, [node.tag], []), undefined);
    else driver.setProperty(node.handle, "Text", "text", labelText(node), undefined);
  }

  // Swaps a text element's widget for the other kind, in the same place in its stack.
  function rebuild(node: NativeNode): void {
    const parent = node.parent;
    if (parent) driver.remove(parent.handle, node.handle);
    node.materialized = false;
    materialize(node);
    if (parent) driver.insert(parent.handle, node.handle, parent.nodes.indexOf(node), null);
  }

  function labelText(node: NativeNode): string {
    let text = "";
    for (const child of node.nodes) text += child.text;
    return text;
  }

  // A nested text element shows through the outermost text element holding it.
  function refreshLabel(node: NativeNode): void {
    let root = node;
    while (isText(root) && root.parent && isText(root.parent)) root = root.parent;
    if (isText(root)) refreshText(root);
    else driver.setProperty(root.handle, root.kind as ElementName, "text", labelText(root), undefined);
  }

  function removeNode(parent: NativeNode, node: NativeNode): void {
    if (node.parent !== parent) return;
    const index = parent.nodes.indexOf(node);
    parent.nodes.splice(index, 1);
    node.parent = null;
    if (isLabel(parent)) refreshLabel(parent);
    else driver.remove(parent.handle, materialize(node));
  }

  function insertNode(parent: NativeNode, node: NativeNode, anchor?: NativeNode): void {
    if (anchor === node) return;
    if (anchor && anchor.parent !== parent) throw new Error("Insertion anchor belongs to another parent");
    if (isLabel(parent)) {
      if (node.kind !== "#text" && !(isText(parent) && isText(node))) {
        throw new Error(`${parent.kind} children must be text${isText(parent) ? " or text elements" : ""}`);
      }
    } else if (!isContainer(parent)) {
      throw new Error(`${parent.kind} cannot contain children`);
    } else if ((parent.kind === "Picker") !== (node.kind === "Option")) {
      throw new Error("<option> goes in <select>, and <select> holds only <option>");
    } else if ((parent.tag === "ul" || parent.tag === "ol") && node.kind !== "ListItem") {
      throw new Error(`<${parent.tag}> holds only <li>`);
    }
    for (let ancestor: NativeNode | null = parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor === node) throw new Error("Cannot insert a node into its own subtree");
    }
    const previousParent = node.parent;
    const previousIndex = previousParent ? previousParent.nodes.indexOf(node) : -1;
    if (previousParent) previousParent.nodes.splice(previousIndex, 1);
    const index = anchor ? parent.nodes.indexOf(anchor) : parent.nodes.length;
    parent.nodes.splice(index, 0, node);
    node.parent = parent;

    if (previousParent && previousParent !== parent && isLabel(previousParent)) refreshLabel(previousParent);
    if (isLabel(parent)) {
      if (previousParent && !isLabel(previousParent)) {
        driver.remove(previousParent.handle, materialize(node));
        if (isText(node)) node.materialized = false;
      }
      refreshLabel(parent);
    } else if (previousParent === parent) {
      if (previousIndex !== index) driver.move(parent.handle, previousIndex, index);
    } else {
      const oldHandle = previousParent && !isLabel(previousParent) ? previousParent.handle : null;
      driver.insert(parent.handle, materialize(node), index, oldHandle);
    }
  }

  const renderer = createRenderer<NativeNode>({
    createElement,
    createTextNode(value) { return makeNode("#text", String(value)); },
    isTextNode(node) { return node.kind === "#text"; },
    replaceText(node, value) {
      node.text = String(value);
      if (node.materialized) driver.setProperty(node.handle, "Text", "text", node.text, undefined);
      if (node.parent && isLabel(node.parent)) refreshLabel(node.parent);
    },
    setProperty(node, name, value, previous) {
      if (name.startsWith("on")) {
        if (value != null && typeof value !== "function") throw new Error(`${name} must be a function`);
      } else if (node.materialized) {
        driver.setProperty(node.handle, node.kind as ElementName, name, value, previous);
      }
      node.props[name] = value;
      if (!node.materialized && name === "hidden" && node.parent && isText(node.parent)) refreshLabel(node.parent);
    },
    insertNode,
    removeNode,
    getParentNode(node) { return node.parent || undefined; },
    getFirstChild(node) { return node.nodes[0]; },
    getNextSibling(node) {
      const parent = node.parent;
      return parent ? parent.nodes[parent.nodes.indexOf(node) + 1] : undefined;
    },
  });

  // Solid's implementation accepts arrays, primitives and accessors too;
  // its universal declaration narrows component results to NodeType.
  const createComponent = renderer.createComponent as <P>(component: (props: P) => Child, props: P) => Child;

  /** Native hyperscript. Reactive properties use getters; children may be accessors. */
  function h(type: string, props?: Props | null, ...children: Child[]): NativeNode;
  function h<P>(type: Component<P>, props: P, ...children: Child[]): Child;
  function h(type: string | Component<any>, props: Props | null = null, ...children: Child[]): Child {
    const properties = children.length
      ? mergeProps(props || {}, { children: children.length === 1 ? children[0] : children })
      : (props || {});
    if (typeof type === "function") return createComponent(type, properties);
    const node = createElement(type);
    renderer.spread(node, properties);
    return node;
  }

  function releaseSubtree(node: NativeNode): void {
    for (const child of node.nodes) releaseSubtree(child);
    node.nodes = [];
    node.parent = null;
    node.props = {};
  }

  /** Mount into an existing native stack; dispose effects and detach its nodes. */
  function render(code: () => Child, handle: number): () => void {
    const root = makeNode("#root");
    root.handle = handle;
    root.materialized = true;
    const dispose = createRoot(dispose => {
      renderer.insert(root, code());
      return dispose;
    });
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      dispose();
      while (root.nodes.length) {
        const child = root.nodes[root.nodes.length - 1];
        removeNode(root, child);
        releaseSubtree(child);
      }
    };
  }

  return { ...renderer, createComponent, render, h, removeNode };
}
