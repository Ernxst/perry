import {
  VStack as NativeVStack, HStack as NativeHStack, ZStack as NativeZStack, Spacer as NativeSpacer,
  ScrollView as NativeScrollView, scrollviewSetChild,
  Text, Button, Divider, BloomView, TextField, SecureField, TextArea, Toggle, Slider, Picker, DatePicker,
  Image, ImageFile, ProgressView, AttributedText, attributedTextAppend, attributedTextClear,
  textSetString, buttonSetTitle, textSetFontSize, textSetFontWeight, textSetFontFamily, textSetColor, textSetDecoration,
  textfieldSetString, textareaSetString, toggleSetState, pickerAddItem, pickerSetSelected, datePickerSetDate,
  textfieldSetOnSubmit, WebView, webviewLoadUrl, Combobox, comboboxAddItem, comboboxSetValue,
  widgetAddChild, widgetAddChildAt, widgetRemoveChild, widgetReorderChild,
  widgetSetWidth, widgetSetHeight, widgetSetOpacity,
  widgetSetHidden, widgetSetEnabled, widgetSetTooltip, widgetSetOnClick,
  widgetSetBackgroundColor, setCornerRadius, setPadding, widgetSetMaxWidth, widgetSetHugging, stackSetAlignment,
  widgetSetBorderWidth, widgetSetBorderColor,
  type Widget,
} from "perry/ui";
import { openURL } from "perry/system";
import { CanvasElement } from "perry-browser";
import { createNativeRenderer, type ControlState, type NativeDriver, type Props, type TextRun } from "./renderer.ts";
import type { JSX } from "./jsx-runtime.ts";
import type { StackProps } from "./types.ts";
export type { NativeNode, Child, Component, Props, ElementName } from "./renderer.ts";
export type { StackProps } from "./types.ts";
export { For } from "./renderer.ts";

// Perry injects this target constant (0 = macOS, 1 = iOS, 2 = Android, 3 = Windows, 4 = Linux).
declare const __platform__: number;

// Matches the web build's stylesheet in web.ts.
const HEADINGS: Record<string, number> = { h1: 26, h2: 20, h3: 16, h4: 14, h5: 13, h6: 11 };
const BODY = 13;
const SMALL = 11;
const SMALLER = new Set(["small", "sub", "sup"]);
const SEMIBOLD = 0.3;
const BOLD = 0.4;
const MONOSPACED = new Set(["code", "kbd", "samp", "pre"]);
// textSetDecoration's values: 1 underlines, 2 strikes through.
const DECORATIONS: Record<string, number> = { a: 1, u: 1, ins: 1, s: 2, del: 2 };
const MARK = { r: 1, g: 1, b: 0 };
// A plain Perry Text can't be italic, so these show through AttributedText even alone.
const ITALIC = new Set(["em", "i", "var", "cite", "dfn", "address"]);
// AppKit text fields and sliders collapse in a stack unless given a width.
const WIDTHS: Record<string, number> = {
  text: 200, password: 200, combobox: 200, search: 200, email: 200, url: 200, tel: 200, number: 200, range: 150, textarea: 200, date: 130,
};
const TEXTAREA_HEIGHT = 60;
const PROGRESS_WIDTH = 150;
const PROGRESS_HEIGHT = 6;
const SPINNER_SIZE = 16;
// The web's default iframe size.
const FRAME = { width: 300, height: 150 };
// A list item's marker sits in this width, as the web's list padding holds its marker.
const MARKER_WIDTH = 14;
const LIST_GAP = 4;
// A <fieldset>'s box, matching the web stylesheet's.
const FIELDSET = { padding: 12, radius: 6, alpha: 0.2 };
// stackSetAlignment takes NSLayoutAttribute values.
const TOP = 3;
// The web build's link and progress colour, rgb(0, 104, 218), and its progress track.
const ACCENT = { r: 0, g: 0.41, b: 0.85 };
const TRACK_ALPHA = 0.12;

function numeric(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expected a finite native widget value");
  return value;
}

// <input>, <textarea> and <select> are a native stack holding the real control. Solid
// sets an element's props only after inserting it, and some props pick the control (an
// input's type) or are fixed when it's made (placeholder, min, max, a select's options),
// so the control is built, and rebuilt, a microtask after those props change. A <datalist>
// has no control of its own: building it rebuilds the inputs whose list names its id.
interface Control {
  kind: "Input" | "TextArea" | "Picker" | "Datalist";
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
// slot holds a child inside both paddings, so text and rows in a column go into one.
const columns = new Set<number>();
const slotted = new Set<number>();
// An <a> is text that opens its href when clicked.
const links = new Map<number, string>();
const decorations = new Map<number, number>();
// AttributedText widgets, by the tag of the text element they show.
const richTexts = new Map<number, string>();
// A ScrollView's children go into a column inside it, since Perry's scroll view holds one child.
// An <li> is a row of its marker and a column holding its children.
const bodies = new Map<number, Widget>();
// An <ol> numbers its items' markers.
const lists = new Map<number, { ordered: boolean; items: number[] }>();
const markers = new Map<number, Widget>();
// A <details> is a column of a header row, its marker and summary, and a body column that
// shows only while open. Without a <summary> the header reads "Details", as on the web.
interface Disclosure {
  marker: Widget;
  header: Widget;
  fallback: Widget;
  body: Widget;
  summary: number;
  open: boolean;
}
const disclosures = new Map<number, Disclosure>();
const summaries = new Set<number>();

// An <img> is a stack holding the image, which is made again when src changes.
interface Picture {
  wrapper: Widget;
  inner: Widget | 0;
  src: string;
  alt: string;
  width: number | undefined;
  height: number | undefined;
}
const images = new Map<number, Picture>();

// A <progress> or <meter> with a value is a track and fill drawn from stacks, to look like the
// web's bar. A <progress> without one is a spinner, Perry's only indeterminate progress view.
interface Bar {
  meter: boolean;
  track: Widget;
  fill: Widget;
  spinner: Widget;
  value: number | undefined;
  min: number;
  max: number;
}
const bars = new Map<number, Bar>();

const REBUILDS: Record<Control["kind"], string[]> = {
  Input: ["type", "placeholder", "min", "max", "list"],
  TextArea: ["placeholder"],
  Picker: [],
  Datalist: ["id"],
};
const CONTROL_PROPS: Record<Control["kind"], string[]> = {
  Input: ["type", "placeholder", "min", "max", "step", "value", "checked", "disabled", "title", "hidden", "list"],
  TextArea: ["placeholder", "value", "disabled", "title", "hidden"],
  Picker: ["value", "disabled", "title", "hidden"],
  Datalist: ["id"],
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

function findDatalist(id: unknown): Control | undefined {
  for (const control of controls.values()) {
    if (control.kind === "Datalist" && control.props.id === id) return control;
  }
  return undefined;
}

// Perry's combobox takes no placeholder, so an input with a list shows none natively.
function createCombobox(control: Control): Widget {
  const combobox = Combobox("", value => {
    control.shown = value;
    report(control, { value, checked: false });
  });
  const datalist = findDatalist(control.props.list);
  for (const handle of datalist?.options ?? []) comboboxAddItem(combobox, optionValue(options.get(handle)!));
  return combobox;
}

function createControl(control: Control): Widget {
  const props = control.props;
  if (control.kind === "Input" && props.list != null && (props.type ?? "text") !== "password") return createCombobox(control);
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
    case "date":
      return DatePicker(0, 0, value => {
        control.shown = value;
        report(control, { value, checked: false });
      });
    case "text":
    case "password":
    case "search":
    case "email":
    case "url":
    case "tel":
    case "number": {
      // As on the web, onChange fires when editing ends: on Return or when the field loses focus.
      const onInput = (value: string) => {
        control.shown = value;
        control.emit("onInput", { value, checked: false });
      };
      const placeholder = String(props.placeholder ?? "");
      const field = props.type === "password" ? SecureField(placeholder, onInput) : TextField(placeholder, onInput);
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
  const type = control.kind !== "Input" ? control.kind.toLowerCase()
    : props.list != null && props.type !== "password" ? "combobox" : String(props.type ?? "text");
  if (type === "checkbox") {
    toggleSetState(inner, props.checked ? 1 : 0);
  } else if (type === "picker") {
    const index = control.options.findIndex(handle => optionValue(options.get(handle)!) === String(props.value));
    if (index >= 0) pickerSetSelected(inner, index);
  } else if (type === "date") {
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(props.value ?? ""));
    if (date && date[0] !== control.shown) {
      control.shown = date[0];
      datePickerSetDate(inner, Number(date[1]), Number(date[2]), Number(date[3]));
    }
  } else if (type !== "range" && props.value != null && String(props.value) !== control.shown) {
    // Perry's slider has no value setter, so a range input starts at min and only reports.
    control.shown = String(props.value);
    if (type === "textarea") textareaSetString(inner, control.shown);
    else if (type === "combobox") comboboxSetValue(inner, control.shown);
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
  if (control.kind === "Datalist") {
    for (const input of controls.values()) {
      if (input.kind === "Input" && input.props.list != null && input.props.list === control.props.id) schedule(input);
    }
    return;
  }
  const previous = control.inner;
  control.inner = createControl(control);
  // The new control starts empty, so applyControl must set the value again.
  control.shown = "";
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

function loadImage(image: Picture): void {
  if (image.inner !== 0) widgetRemoveChild(image.wrapper, image.inner);
  image.inner = 0;
  if (!image.src) return;
  // Other sources are files in the app bundle's Resources, where Vite's public/ folder is copied.
  image.inner = /^(https?|data):/.test(image.src) ? Image(image.src, image.alt) : ImageFile(image.src.replace(/^\//, ""));
  widgetAddChild(image.wrapper, image.inner);
  sizeImage(image);
}

function sizeImage(image: Picture): void {
  if (image.inner === 0) return;
  if (image.width != null) widgetSetWidth(image.inner, image.width);
  if (image.height != null) widgetSetHeight(image.inner, image.height);
}

function setImageProperty(image: Picture, name: string, value: unknown): boolean {
  switch (name) {
    case "src": image.src = value == null ? "" : String(value); loadImage(image); return true;
    case "alt": image.alt = value == null ? "" : String(value); return true;
    case "width": image.width = value == null ? undefined : numeric(value, 0); sizeImage(image); return true;
    case "height": image.height = value == null ? undefined : numeric(value, 0); sizeImage(image); return true;
    default: return false;
  }
}

// An <iframe> is a stack holding a WebView, which is made when src is first set, since
// Perry's WebView takes its first URL when created.
interface Frame {
  wrapper: Widget;
  view: Widget | 0;
  width: number;
  height: number;
}
const frames = new Map<number, Frame>();

function sizeFrame(frame: Frame): void {
  widgetSetWidth(frame.wrapper, frame.width);
  widgetSetHeight(frame.wrapper, frame.height);
  if (frame.view === 0) return;
  widgetSetWidth(frame.view, frame.width);
  widgetSetHeight(frame.view, frame.height);
}

function setFrameProperty(frame: Frame, name: string, value: unknown): boolean {
  switch (name) {
    case "src": {
      const url = value == null ? "about:blank" : String(value);
      if (frame.view !== 0) webviewLoadUrl(frame.view, url);
      else {
        frame.view = WebView({ url, width: frame.width, height: frame.height });
        widgetAddChild(frame.wrapper, frame.view);
        sizeFrame(frame);
      }
      return true;
    }
    case "width": frame.width = numeric(value, FRAME.width); sizeFrame(frame); return true;
    case "height": frame.height = numeric(value, FRAME.height); sizeFrame(frame); return true;
    default: return false;
  }
}

function showBar(bar: Bar): void {
  const indeterminate = bar.value == null && !bar.meter;
  widgetSetHidden(bar.track, indeterminate ? 1 : 0);
  widgetSetHidden(bar.spinner, indeterminate ? 0 : 1);
  const fraction = ((bar.value ?? bar.min) - bar.min) / (bar.max - bar.min);
  widgetSetWidth(bar.fill, PROGRESS_WIDTH * Math.min(Math.max(fraction, 0), 1));
}

function setBarProperty(bar: Bar, name: string, value: unknown): boolean {
  if (name === "value") bar.value = value == null ? undefined : numeric(value, 0);
  else if (name === "max") bar.max = numeric(value, 1);
  else if (name === "min" && bar.meter) bar.min = numeric(value, 0);
  else return false;
  showBar(bar);
  return true;
}

function createBar(meter: boolean): Widget {
  const wrapper = NativeHStack(0, []);
  const track = NativeHStack(0, []);
  const fill = NativeHStack(0, []);
  widgetSetWidth(track, PROGRESS_WIDTH);
  widgetSetHeight(track, PROGRESS_HEIGHT);
  widgetSetBackgroundColor(track, 0, 0, 0, TRACK_ALPHA);
  setCornerRadius(track, PROGRESS_HEIGHT / 2);
  widgetSetHeight(fill, PROGRESS_HEIGHT);
  widgetSetBackgroundColor(fill, ACCENT.r, ACCENT.g, ACCENT.b, 1);
  setCornerRadius(fill, PROGRESS_HEIGHT / 2);
  widgetAddChild(track, fill);
  widgetAddChild(track, NativeSpacer());
  const spinner = ProgressView();
  widgetSetWidth(spinner, SPINNER_SIZE);
  widgetSetHeight(spinner, SPINNER_SIZE);
  widgetAddChild(wrapper, track);
  widgetAddChild(wrapper, spinner);
  const bar: Bar = { meter, track, fill, spinner, value: undefined, min: 0, max: 1 };
  bars.set(wrapper, bar);
  showBar(bar);
  return wrapper;
}

function createListItem(): Widget {
  const item = NativeHStack(6, []);
  const marker = Text("•");
  widgetSetWidth(marker, MARKER_WIDTH);
  const body = NativeVStack(LIST_GAP, []);
  // Low hugging lets the column take the rest of the row's width.
  widgetSetHugging(body, 1);
  columns.add(body);
  widgetAddChild(item, marker);
  widgetAddChild(item, body);
  stackSetAlignment(item, TOP);
  markers.set(item, marker);
  bodies.set(item, body);
  slotted.add(item);
  return item;
}

function showDisclosure(disclosure: Disclosure): void {
  textSetString(disclosure.marker, disclosure.open ? "▾" : "▸");
  widgetSetHidden(disclosure.body, disclosure.open ? 0 : 1);
}

function toggleOnClick(widget: Widget, disclosure: Disclosure): void {
  widgetSetOnClick(widget, () => {
    disclosure.open = !disclosure.open;
    showDisclosure(disclosure);
  });
}

function createDetails(): Widget {
  const details = NativeVStack(8, []);
  const header = NativeHStack(6, []);
  const marker = Text("");
  const fallback = Text("Details");
  const body = NativeVStack(8, []);
  widgetAddChild(header, marker);
  widgetAddChild(header, fallback);
  widgetAddChild(details, header);
  widgetAddChild(details, body);
  widgetSetMaxWidth(body, 1e6);
  columns.add(details);
  columns.add(body);
  slotted.add(details);
  const disclosure: Disclosure = { marker, header, fallback, body, summary: 0, open: false };
  toggleOnClick(marker, disclosure);
  toggleOnClick(fallback, disclosure);
  disclosures.set(details, disclosure);
  showDisclosure(disclosure);
  return details;
}

function unlist(parent: number, child: number): void {
  const list = lists.get(parent);
  if (!list || !list.items.includes(child)) return;
  list.items.splice(list.items.indexOf(child), 1);
  numberItems(list);
}

function numberItems(list: { ordered: boolean; items: number[] }): void {
  if (!list.ordered) return;
  list.items.forEach((item, index) => textSetString(markers.get(item)!, `${index + 1}.`));
}

function setOptionProperty(option: Option, name: string, value: unknown): void {
  if (name === "text") option.label = value == null ? "" : String(value);
  else if (name === "value") option.value = value == null ? undefined : String(value);
  else throw new Error(`${name} is unsupported on <option>`);
  if (option.picker !== 0) schedule(controls.get(option.picker)!);
}

function makeLink(text: Widget): void {
  links.set(text, "");
  textSetColor(text, ACCENT.r, ACCENT.g, ACCENT.b, 1);
  widgetSetOnClick(text, () => {
    const href = links.get(text);
    if (href) openURL(href);
  });
}

function createRichText(tag: string): Widget {
  const text = AttributedText();
  richTexts.set(text, tag);
  if (tag === "mark") widgetSetBackgroundColor(text, MARK.r, MARK.g, MARK.b, 1);
  else slotted.add(text);
  if (tag === "a") makeLink(text);
  if (tag === "summary") summaries.add(text);
  return text;
}

// A run gets the styles an AttributedText run can carry: weight, italic, underline, size
// and colour. Monospaced fonts, strikethrough and backgrounds apply only to a whole text.
function appendRun(text: Widget, run: TextRun): void {
  let bold = 0, italic = 0, underline = 0, size = 0, color = false;
  run.tags.forEach((tag, depth) => {
    if (tag === "a" && depth > 0) throw new Error("<a> inside text is unsupported natively; put it beside the text in an HStack");
    if (HEADINGS[tag]) { size = HEADINGS[tag]; bold = 1; }
    if (tag === "strong" || tag === "b" || tag === "legend") bold = 1;
    if (ITALIC.has(tag)) italic = 1;
    if (SMALLER.has(tag)) size = SMALL;
    if (DECORATIONS[tag] === 1) underline = 1;
    if (tag === "a") color = true;
  });
  attributedTextAppend(text, run.text, bold, italic, underline, size, ACCENT.r, ACCENT.g, ACCENT.b, color ? 1 : 0);
}

function setRuns(text: Widget, runs: TextRun[]): void {
  attributedTextClear(text);
  for (const run of runs) appendRun(text, run);
}

const driver: NativeDriver = {
  create(kind, tag, emit): number {
    switch (kind) {
      case "VStack": {
        const list = tag === "ul" || tag === "ol";
        const column = NativeVStack(list ? LIST_GAP : 8, []);
        columns.add(column);
        if (list) lists.set(column, { ordered: tag === "ol", items: [] });
        if (tag === "fieldset") {
          setPadding(column, FIELDSET.padding);
          setCornerRadius(column, FIELDSET.radius);
          widgetSetBorderWidth(column, 1);
          widgetSetBorderColor(column, 0, 0, 0, FIELDSET.alpha);
          slotted.add(column);
        }
        return column;
      }
      case "ListItem": return createListItem();
      case "HStack": {
        // In the slot a row is as wide as its column, so a spacer after its children keeps them at the start.
        const row = NativeHStack(8, []);
        widgetAddChild(row, NativeSpacer());
        slotted.add(row);
        return row;
      }
      case "ZStack": return NativeZStack();
      case "Spacer": return NativeSpacer();
      case "ScrollView": {
        const scroll = NativeScrollView();
        const content = NativeVStack(8, []);
        columns.add(content);
        scrollviewSetChild(scroll, content);
        bodies.set(scroll, content);
        return scroll;
      }
      case "RichText": return createRichText(tag);
      case "Text": {
        if (ITALIC.has(tag)) return createRichText(tag);
        const text = Text("");
        // In the slot, text is as wide as its column, which would stretch a mark's background.
        if (tag !== "mark") slotted.add(text);
        if (HEADINGS[tag]) textSetFontWeight(text, HEADINGS[tag], SEMIBOLD);
        else if (tag === "strong" || tag === "b") textSetFontWeight(text, BODY, BOLD);
        else if (tag === "legend") textSetFontWeight(text, BODY, SEMIBOLD);
        else if (SMALLER.has(tag)) textSetFontSize(text, SMALL);
        else if (MONOSPACED.has(tag)) textSetFontFamily(text, "monospaced");
        else if (tag === "mark") widgetSetBackgroundColor(text, MARK.r, MARK.g, MARK.b, 1);
        if (DECORATIONS[tag]) decorations.set(text, DECORATIONS[tag]);
        if (tag === "a") makeLink(text);
        if (tag === "summary") summaries.add(text);
        return text;
      }
      case "Details": return createDetails();
      case "Image": {
        const wrapper = NativeHStack(0, []);
        images.set(wrapper, { wrapper, inner: 0, src: "", alt: "", width: undefined, height: undefined });
        return wrapper;
      }
      case "Progress": return createBar(tag === "meter");
      case "Frame": {
        const wrapper = NativeHStack(0, []);
        const frame: Frame = { wrapper, view: 0, ...FRAME };
        frames.set(wrapper, frame);
        sizeFrame(frame);
        return wrapper;
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
      case "Picker":
      case "Datalist": {
        const wrapper = NativeHStack(0, []);
        if (kind === "Datalist") widgetSetHidden(wrapper, 1);
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
    const image = images.get(handle);
    if (image && setImageProperty(image, name, value)) return;
    const bar = bars.get(handle);
    if (bar && setBarProperty(bar, name, value)) return;
    const frame = frames.get(handle);
    if (frame && setFrameProperty(frame, name, value)) return;
    const disclosure = disclosures.get(handle);
    if (disclosure && name === "open") {
      disclosure.open = !!value;
      return showDisclosure(disclosure);
    }
    const widget = handle as Widget;
    switch (name) {
      case "runs":
        if (!richTexts.has(handle)) throw new Error(`runs is unsupported on ${kind}`);
        setRuns(widget, value as TextRun[]);
        return;
      case "text":
        if (richTexts.has(handle)) {
          setRuns(widget, [{ text: value == null ? "" : String(value), tags: [richTexts.get(handle)!] }]);
        }
        else if (kind === "Text") {
          textSetString(widget, value == null ? "" : String(value));
          // Setting the string drops the decoration.
          const decoration = decorations.get(handle);
          if (decoration) textSetDecoration(widget, decoration);
        }
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
      case "padding": setPadding(bodies.get(handle) ?? widget, numeric(value, 0)); return;
      case "href":
        if (!links.has(handle)) throw new Error(`href is unsupported on ${kind}`);
        links.set(handle, value == null ? "" : String(value));
        return;
      case "type":
        if (kind !== "Button" || (value != null && value !== "submit" && value !== "button")) {
          throw new Error(`type="${value}" is unsupported on ${kind}`);
        }
        return;
      case "target":
        // The system opens every link in the default browser.
        if (!links.has(handle)) throw new Error(`target is unsupported on ${kind}`);
        return;
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
    parent = bodies.get(parent) ?? parent;
    if (previousParent !== null) previousParent = bodies.get(previousParent) ?? previousParent;
    const picker = controls.get(parent);
    if (picker) {
      if (previousParent !== null) driver.remove(previousParent, child);
      picker.options.splice(index, 0, child);
      options.get(child)!.picker = parent;
      schedule(picker);
      return;
    }
    if (previousParent !== null) unlist(previousParent, child);
    const disclosure = disclosures.get(parent);
    if (disclosure) {
      if (previousParent !== null && __platform__ !== 0) widgetRemoveChild(previousParent as Widget, child as Widget);
      if (summaries.has(child)) {
        disclosure.summary = child;
        widgetSetHidden(disclosure.fallback, 1);
        toggleOnClick(child as Widget, disclosure);
        return widgetAddChildAt(disclosure.header, child as Widget, 1);
      }
      widgetAddChildAt(disclosure.body, child as Widget, disclosure.summary ? index - 1 : index);
      if (slotted.has(child)) widgetSetMaxWidth(child as Widget, 1e6);
      return;
    }
    const list = lists.get(parent);
    if (list) {
      list.items.splice(index, 0, child);
      numberItems(list);
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
    if (columns.has(parent) && slotted.has(child)) widgetSetMaxWidth(child as Widget, 1e6);
  },
  move(parent, from, to) {
    parent = bodies.get(parent) ?? parent;
    const list = lists.get(parent);
    if (list) {
      const [item] = list.items.splice(from, 1);
      list.items.splice(to, 0, item);
      numberItems(list);
    }
    const disclosure = disclosures.get(parent);
    if (disclosure) {
      const offset = disclosure.summary ? 1 : 0;
      return widgetReorderChild(disclosure.body, from - offset, to - offset);
    }
    const picker = controls.get(parent);
    if (!picker) return widgetReorderChild(parent as Widget, from, to);
    const [moved] = picker.options.splice(from, 1);
    picker.options.splice(to, 0, moved);
    schedule(picker);
  },
  remove(parent, child) {
    parent = bodies.get(parent) ?? parent;
    const label = labels.get(parent);
    if (label && label.control === child) label.control = 0;
    unlist(parent, child);
    const disclosure = disclosures.get(parent);
    if (disclosure) {
      if (child !== disclosure.summary) return widgetRemoveChild(disclosure.body, child as Widget);
      disclosure.summary = 0;
      widgetSetHidden(disclosure.fallback, 0);
      return widgetRemoveChild(disclosure.header, child as Widget);
    }
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
export function ScrollView(props: StackProps): JSX.Element { return native.h("scrollview", props as Props); }
