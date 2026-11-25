import {
  VStack as NativeVStack, HStack as NativeHStack, ZStack as NativeZStack, Spacer as NativeSpacer,
  Text, Button, Divider, BloomView, TextField, TextArea, Toggle, Slider, Picker,
  textSetString, buttonSetTitle, textSetFontSize, textSetFontWeight, textfieldSetString, textareaSetString,
  toggleSetState, pickerAddItem, pickerSetSelected, textfieldSetOnSubmit,
  widgetAddChild, widgetAddChildAt, widgetRemoveChild, widgetReorderChild,
  widgetSetWidth, widgetSetHeight, widgetSetOpacity,
  widgetSetHidden, widgetSetEnabled, widgetSetTooltip, widgetSetOnClick,
  widgetSetBackgroundColor, setCornerRadius, setPadding, widgetSetMaxWidth,
  type Widget,
} from "perry/ui";
import { CanvasElement } from "perry-browser";
import { createNativeRenderer, type ControlState, type NativeDriver, type Props } from "./renderer.ts";
import type { JSX } from "./jsx-runtime.ts";
import type { StackProps } from "./types.ts";
export type { NativeNode, Child, Component, Props, ElementName } from "./renderer.ts";
export type { StackProps } from "./types.ts";
export { For } from "./renderer.ts";

// Perry injects this target constant (0 = macOS, 1 = iOS, 2 = Android, 3 = Windows, 4 = Linux).
declare const __platform__: number;

// Matches the web build's stylesheet in web.ts.
const HEADINGS: Record<string, number> = { h1: 26, h2: 20, h3: 16 };
const SMALL = 11;
const SEMIBOLD = 0.3;
// AppKit text fields and sliders collapse in a stack unless given a width.
const WIDTHS: Record<string, number> = { text: 200, range: 150, textarea: 200 };
const TEXTAREA_HEIGHT = 60;

function numeric(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expected a finite native widget value");
  return value;
}

// <input>, <textarea> and <select> are a native stack holding the real control. Solid
// sets an element's props only after inserting it, and some props pick the control (an
// input's type) or are fixed when it's made (placeholder, min, max, a select's options),
// so the control is built, and rebuilt, a microtask after those props change.
interface Control {
  kind: "Input" | "TextArea" | "Picker";
  wrapper: Widget;
  inner: Widget | 0;
  props: Record<string, unknown>;
  options: number[];
  /** The text the control last showed, so a controlled value echoing back isn't set again. */
  shown: string;
  scheduled: boolean;
  emit: (handler: string, state: ControlState) => void;
}

interface Option {
  label: string;
  value: string | undefined;
  picker: number;
}

const controls = new Map<number, Control>();
// <option> has no widget; its handles are negative so they never clash with widget handles.
const options = new Map<number, Option>();
let nextOption = -1;
const canvases = new Map<number, CanvasElement>();
// A <label> natively is a stack; clicking its text flips the checkbox inside it, as on the web.
const labels = new Map<number, { control: number }>();
// A vertical NSStackView lets text run through its trailing padding. Perry's max-width
// slot holds a child inside both paddings, so text in a column goes into one.
const columns = new Set<number>();
const texts = new Set<number>();

const REBUILDS: Record<Control["kind"], string[]> = {
  Input: ["type", "placeholder", "min", "max"],
  TextArea: ["placeholder"],
  Picker: [],
};
const CONTROL_PROPS: Record<Control["kind"], string[]> = {
  Input: ["type", "placeholder", "min", "max", "step", "value", "checked", "disabled", "title", "hidden"],
  TextArea: ["placeholder", "value", "disabled", "title", "hidden"],
  Picker: ["value", "disabled", "title", "hidden"],
};

function report(control: Control, state: ControlState): void {
  control.emit("onInput", state);
  control.emit("onChange", state);
}

function toggle(control: Control): void {
  const on = !control.props.checked;
  control.props.checked = on;
  toggleSetState(control.inner as Widget, on ? 1 : 0);
  report(control, { value: "on", checked: on });
}

function optionValue(option: Option): string {
  return option.value ?? option.label;
}

function createControl(control: Control): Widget {
  const props = control.props;
  if (control.kind === "Picker") {
    const picker = Picker(index => {
      const option = options.get(control.options[index]);
      control.shown = option ? optionValue(option) : "";
      report(control, { value: control.shown, checked: false });
    });
    for (const handle of control.options) pickerAddItem(picker, options.get(handle)!.label);
    return picker;
  }
  if (control.kind === "TextArea") {
    return TextArea(String(props.placeholder ?? ""), value => {
      control.shown = value;
      report(control, { value, checked: false });
    });
  }
  switch (props.type ?? "text") {
    case "checkbox":
      return Toggle("", on => {
        props.checked = on;
        report(control, { value: "on", checked: on });
      });
    case "range":
      return Slider(numeric(props.min, 0), numeric(props.max, 100), value => {
        report(control, { value: String(value), checked: false });
      });
    case "text": {
      // As on the web, onChange fires when editing ends: on Return or when the field loses focus.
      const field = TextField(String(props.placeholder ?? ""), value => {
        control.shown = value;
        control.emit("onInput", { value, checked: false });
      });
      textfieldSetOnSubmit(field, () => control.emit("onChange", { value: control.shown, checked: false }));
      return field;
    }
    default:
      throw new Error(`Unsupported <input type="${String(props.type)}">`);
  }
}

function applyControl(control: Control): void {
  const inner = control.inner as Widget;
  const props = control.props;
  const type = control.kind === "Input" ? String(props.type ?? "text") : control.kind.toLowerCase();
  if (type === "checkbox") {
    toggleSetState(inner, props.checked ? 1 : 0);
  } else if (type === "picker") {
    const index = control.options.findIndex(handle => optionValue(options.get(handle)!) === String(props.value));
    if (index >= 0) pickerSetSelected(inner, index);
  } else if (type !== "range" && props.value != null && String(props.value) !== control.shown) {
    // Perry's slider has no value setter, so a range input starts at min and only reports.
    control.shown = String(props.value);
    if (type === "textarea") textareaSetString(inner, control.shown);
    else textfieldSetString(inner, control.shown);
  }
  if (props.disabled != null) {
    // perry/ui panics when enabling or disabling a Toggle.
    if (type === "checkbox") throw new Error("disabled is unsupported on <input type=\"checkbox\">");
    widgetSetEnabled(inner, props.disabled ? 0 : 1);
  }
  widgetSetHidden(control.wrapper, props.hidden ? 1 : 0);
  if (props.title != null) widgetSetTooltip(inner, String(props.title));
  if (WIDTHS[type]) widgetSetWidth(inner, WIDTHS[type]);
  if (type === "textarea") widgetSetHeight(inner, TEXTAREA_HEIGHT);
}

function build(control: Control): void {
  control.scheduled = false;
  const previous = control.inner;
  control.inner = createControl(control);
  if (previous !== 0) widgetRemoveChild(control.wrapper, previous);
  widgetAddChild(control.wrapper, control.inner);
  applyControl(control);
}

function schedule(control: Control): void {
  if (control.scheduled) return;
  control.scheduled = true;
  void Promise.resolve().then(() => build(control));
}

function setControlProperty(control: Control, name: string, value: unknown): void {
  if (!CONTROL_PROPS[control.kind].includes(name)) throw new Error(`${name} is unsupported on ${control.kind}`);
  control.props[name] = value;
  if (REBUILDS[control.kind].includes(name)) schedule(control);
  else if (control.inner !== 0 && !control.scheduled) applyControl(control);
}

function setOptionProperty(option: Option, name: string, value: unknown): void {
  if (name === "text") option.label = value == null ? "" : String(value);
  else if (name === "value") option.value = value == null ? undefined : String(value);
  else throw new Error(`${name} is unsupported on <option>`);
  if (option.picker !== 0) schedule(controls.get(option.picker)!);
}

const driver: NativeDriver = {
  create(kind, tag, emit): number {
    switch (kind) {
      case "VStack": {
        const column = NativeVStack(8, []);
        columns.add(column);
        return column;
      }
      case "HStack": return NativeHStack(8, []);
      case "ZStack": return NativeZStack();
      case "Spacer": return NativeSpacer();
      case "Text": {
        const text = Text("");
        texts.add(text);
        if (HEADINGS[tag]) textSetFontWeight(text, HEADINGS[tag], SEMIBOLD);
        else if (tag === "small") textSetFontSize(text, SMALL);
        return text;
      }
      case "Button": return Button("", () => emit("onClick", { value: "", checked: false }));
      case "Divider": return Divider();
      case "Canvas": return BloomView(0, 0);
      case "Label": {
        const label = NativeHStack(8, []);
        labels.set(label, { control: 0 });
        return label;
      }
      case "Option": {
        const handle = nextOption--;
        options.set(handle, { label: "", value: undefined, picker: 0 });
        return handle;
      }
      case "Input":
      case "TextArea":
      case "Picker": {
        const wrapper = NativeHStack(0, []);
        controls.set(wrapper, { kind, wrapper, inner: 0, props: {}, options: [], shown: "", scheduled: false, emit });
        schedule(controls.get(wrapper)!);
        return wrapper;
      }
    }
  },
  setProperty(handle, kind, name, value) {
    const control = controls.get(handle);
    if (control) return setControlProperty(control, name, value);
    const option = options.get(handle);
    if (option) return setOptionProperty(option, name, value);
    const widget = handle as Widget;
    switch (name) {
      case "text":
        if (kind === "Text") textSetString(widget, value == null ? "" : String(value));
        else if (kind === "Button") buttonSetTitle(widget, value == null ? "" : String(value));
        else throw new Error(`text is unsupported on ${kind}`);
        return;
      case "width":
        widgetSetWidth(widget, numeric(value, 0));
        if (kind === "Canvas") canvases.get(handle)!.clientWidth = numeric(value, 0);
        return;
      case "height":
        widgetSetHeight(widget, numeric(value, 0));
        if (kind === "Canvas") canvases.get(handle)!.clientHeight = numeric(value, 0);
        return;
      case "opacity": widgetSetOpacity(widget, numeric(value, 1)); return;
      case "hidden": widgetSetHidden(widget, value ? 1 : 0); return;
      case "disabled": widgetSetEnabled(widget, value ? 0 : 1); return;
      case "title": widgetSetTooltip(widget, value == null ? "" : String(value)); return;
      case "cornerRadius": setCornerRadius(widget, numeric(value, 0)); return;
      case "padding": setPadding(widget, numeric(value, 0)); return;
      case "backgroundColor": {
        const color = value == null ? [0, 0, 0, 0] : value;
        if (!Array.isArray(color) || color.length !== 4) throw new Error("backgroundColor expects [r, g, b, a]");
        widgetSetBackgroundColor(widget, numeric(color[0], 0), numeric(color[1], 0), numeric(color[2], 0), numeric(color[3], 0));
        return;
      }
      default: throw new Error(`${name} is unsupported on ${kind}`);
    }
  },
  insert(parent, child, index, previousParent) {
    const picker = controls.get(parent);
    if (picker) {
      if (previousParent !== null) driver.remove(previousParent, child);
      picker.options.splice(index, 0, child);
      options.get(child)!.picker = parent;
      schedule(picker);
      return;
    }
    const label = labels.get(parent);
    if (label) {
      if (controls.has(child)) label.control = child;
      else widgetSetOnClick(child as Widget, () => {
        const control = controls.get(label.control);
        if (control && control.inner !== 0 && control.props.type === "checkbox") toggle(control);
      });
    }
    // AppKit's indexed insertion detaches without destroying retained layout
    // metadata. Other backends need the old parent explicitly cleared first.
    if (previousParent !== null && __platform__ !== 0) {
      widgetRemoveChild(previousParent as Widget, child as Widget);
    }
    widgetAddChildAt(parent as Widget, child as Widget, index);
    if (columns.has(parent) && texts.has(child)) widgetSetMaxWidth(child as Widget, 1e6);
  },
  move(parent, from, to) {
    const picker = controls.get(parent);
    if (!picker) return widgetReorderChild(parent as Widget, from, to);
    const [moved] = picker.options.splice(from, 1);
    picker.options.splice(to, 0, moved);
    schedule(picker);
  },
  remove(parent, child) {
    const label = labels.get(parent);
    if (label && label.control === child) label.control = 0;
    const picker = controls.get(parent);
    if (!picker) return widgetRemoveChild(parent as Widget, child as Widget);
    picker.options.splice(picker.options.indexOf(child), 1);
    options.get(child)!.picker = 0;
    schedule(picker);
  },
  element(kind, handle) {
    if (kind !== "Canvas") return undefined;
    const canvas = new CanvasElement(handle);
    canvases.set(handle, canvas);
    return canvas;
  },
};

const native = createNativeRenderer(driver);
export const h = native.h;
export const render = native.render;
export const createElement = native.createElement;
export const createTextNode = native.createTextNode;
export const insert = native.insert;
export const insertNode = native.insertNode;
export const spread = native.spread;
export const setProp = native.setProp;
export const createComponent = native.createComponent;
export const effect = native.effect;
export const memo = native.memo;
export const mergeProps = native.mergeProps;
export const use = native.use;

export function VStack(props: StackProps): JSX.Element { return native.h("vstack", props as Props); }
export function HStack(props: StackProps): JSX.Element { return native.h("hstack", props as Props); }
export function ZStack(props: StackProps): JSX.Element { return native.h("zstack", props as Props); }
export function Spacer(): JSX.Element { return native.h("spacer", null); }
