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
  widgetSetBackgroundColor, setCornerRadius, setPadding, widgetSetMaxWidth, widgetSetHugging, stackSetAlignment, stackSetDistribution,
  widgetSetBorderWidth, widgetSetBorderColor, stateCreate, stateSet, stateBindSlider,
  widgetSetDynamicBackgroundColor, widgetSetDynamicBorderColor, textSetDynamicColor,
  currentModifiers, type State, type Widget,
} from "perry/ui";
import { openURL } from "perry/system";
import { CanvasElement } from "perry-browser";
import { createNativeRenderer, type ControlState, type Emit, type NativeDriver, type Props, type TextRun } from "./renderer.ts";
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
// A plain Perry Text can't be italic, so these show through AttributedText even alone.
const ITALIC = new Set(["em", "i", "var", "cite", "dfn", "address"]);
// AppKit text fields and sliders collapse in a stack unless given a width.
const WIDTHS: Record<string, number> = {
  text: 200, password: 200, combobox: 200, search: 200, email: 200, url: 200, tel: 200, number: 200, range: 150, textarea: 200, date: 130,
};
// An input's `size` counts characters; these approximate the system font's average width and the
// field's border and inset.
const CHARACTER_WIDTH = 8;
const FIELD_INSET = 12;
const TEXTAREA_HEIGHT = 60;
const PROGRESS_WIDTH = 150;
const PROGRESS_HEIGHT = 6;
const SPINNER_SIZE = 16;
// The web's default iframe size.
const FRAME = { width: 300, height: 150 };
// A <dialog>'s box, matching the web stylesheet's.
const DIALOG = { padding: 16, radius: 10 };
// A modal dialog's widest box and its distance from the window's edges, and the dimming a
// browser's ::backdrop gives the page behind it.
const MODAL = { width: 480, margin: 20 };
const EQUAL_CENTERING = 4;
// A browser's default spacing between table cells and padding inside them, and the width a
// column takes when the first row gives none.
const TABLE = { spacing: 2, padding: 1, width: 100 };
// A list item's marker sits in this width, as the web's list padding holds its marker.
const MARKER_WIDTH = 14;
const LIST_GAP = 4;
// A <fieldset>'s box, matching the web stylesheet's.
const FIELDSET = { padding: 12, radius: 6 };
// stackSetAlignment takes NSLayoutAttribute values.
const TOP = 3;
const CENTER_X = 9;

type Rgba = [number, number, number, number];
/** The web stylesheet's colours, for light then dark appearance. */
const COLOURS = {
  accent: [[0, 0.41, 0.85, 1], [0.04, 0.52, 1, 1]],
  track: [[0, 0, 0, 0.12], [1, 1, 1, 0.15]],
  border: [[0, 0, 0, 0.2], [1, 1, 1, 0.2]],
  box: [[1, 1, 1, 1], [0.2, 0.2, 0.2, 1]],
  backdrop: [[0, 0, 0, 0.1], [0, 0, 0, 0.4]],
  mark: [[1, 1, 0, 1], [1, 1, 0, 1]],
} satisfies Record<string, [Rgba, Rgba]>;
type Colour = keyof typeof COLOURS;

// Perry's dynamic colours, which follow the window's appearance, exist only on macOS.
function setBackground(widget: Widget, colour: Colour): void {
  const [l, d] = COLOURS[colour];
  if (__platform__ === 0) widgetSetDynamicBackgroundColor(widget, l[0], l[1], l[2], l[3], d[0], d[1], d[2], d[3]);
  else widgetSetBackgroundColor(widget, l[0], l[1], l[2], l[3]);
}

function setBorder(widget: Widget, colour: Colour): void {
  const [l, d] = COLOURS[colour];
  if (__platform__ === 0) widgetSetDynamicBorderColor(widget, l[0], l[1], l[2], l[3], d[0], d[1], d[2], d[3]);
  else widgetSetBorderColor(widget, l[0], l[1], l[2], l[3]);
}

function setTextColour(widget: Widget, colour: Colour): void {
  const [l, d] = COLOURS[colour];
  if (__platform__ === 0) textSetDynamicColor(widget, l[0], l[1], l[2], l[3], d[0], d[1], d[2], d[3]);
  else textSetColor(widget, l[0], l[1], l[2], l[3]);
}

// A mark stays yellow in dark appearance, so its text stays black, as the web stylesheet's does.
function markText(text: Widget): void {
  setBackground(text, "mark");
  textSetColor(text, 0, 0, 0, 1);
}

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
  /** A range input's value, bound to its slider, since Perry's slider can only be moved through a state. */
  slider?: State;
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
/** The label each of a label's other children flips the checkbox of when clicked. */
const labelledBy = new Map<number, { control: number }>();
// A vertical NSStackView lets text run through its trailing padding. Perry's max-width
// slot holds a child inside both paddings, so text and rows in a column go into one.
const columns = new Set<number>();
// AppKit stretches a column's children to fill its height, where a flexbox column leaves the
// space empty. Gravity areas leave it empty too, but a Spacer only grows under fill, so a column
// fills while it holds one.
const GRAVITY_AREAS = -1;
const FILL = 0;
const spacers = new Set<number>();
const spacersIn = new Map<number, number>();

function makeColumn(spacing: number): Widget {
  const column = NativeVStack(spacing, []);
  stackSetDistribution(column, GRAVITY_AREAS);
  columns.add(column);
  return column;
}

function countSpacer(column: number, child: number, change: 1 | -1): void {
  if (!columns.has(column) || !spacers.has(child)) return;
  const count = (spacersIn.get(column) ?? 0) + change;
  spacersIn.set(column, count);
  stackSetDistribution(column as Widget, count > 0 ? FILL : GRAVITY_AREAS);
}

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
  Input: ["type", "placeholder", "min", "max", "step", "size", "value", "checked", "disabled", "title", "hidden", "list"],
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
    case "range": {
      const slider = Slider(numeric(props.min, 0), numeric(props.max, 100), value => {
        control.shown = String(value);
        report(control, { value: control.shown, checked: false });
      });
      control.slider = stateCreate(numeric(props.min, 0));
      stateBindSlider(control.slider, slider);
      return slider;
    }
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
  } else if (props.value != null && String(props.value) !== control.shown) {
    control.shown = String(props.value);
    if (type === "range") stateSet(control.slider!, Number(props.value));
    else if (type === "textarea") textareaSetString(inner, control.shown);
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
  const size = Number(props.size);
  if (WIDTHS[type]) widgetSetWidth(inner, size > 0 && type !== "range" && type !== "date" ? size * CHARACTER_WIDTH + FIELD_INSET : WIDTHS[type]);
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

interface Dialog {
  placeholder: Widget;
  box: Widget;
  open: boolean;
  modal: boolean;
  emit: (handler: string, state: ControlState) => void;
}
const dialogs = new Map<number, Dialog>();
let renderRoot = 0;
let modalBackdrop = 0 as Widget;
let modalLayer = 0 as Widget;
let modalCount = 0;
/** Texts in the body font, which a header cell makes bold. */
const plainTexts = new Set<number>();
const headerCells = new Set<number>();
const listening = new Set<number>();
const clicks = new Map<number, (() => void)[]>();

// Each widgetSetOnClick adds another gesture recognizer to the view, so a widget gets one,
// shared by its own behaviour, such as a link opening, and a handler.
function addClick(widget: Widget, callback: () => void): void {
  const callbacks = clicks.get(widget);
  if (callbacks) return void callbacks.push(callback);
  clicks.set(widget, [callback]);
  widgetSetOnClick(widget, () => clicks.get(widget)!.forEach(call => call()));
}

// A cell lays its children out in a line, as inline content flows; a header cell centres them.
function createCell(header: boolean): Widget {
  const line = NativeHStack(0, []);
  const cell = header ? NativeVStack(0, [line]) : line;
  setPadding(cell, TABLE.padding);
  widgetSetWidth(cell, TABLE.width + 2 * TABLE.padding);
  if (header) {
    stackSetAlignment(cell, CENTER_X);
    bodies.set(cell, line);
    headerCells.add(line);
  } else {
    widgetAddChild(cell, NativeSpacer());
  }
  return cell;
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
  setBackground(track, "track");
  setCornerRadius(track, PROGRESS_HEIGHT / 2);
  widgetSetHeight(fill, PROGRESS_HEIGHT);
  setBackground(fill, "accent");
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
  addClick(widget, () => {
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

// A <dialog> is a placeholder holding its box, shown in place while it's open. showModal()
// moves the box into a layer over the whole window, as a browser draws it over the page, since
// Perry's sheets can't be dismissed; the placeholder keeps the dialog's place among its siblings.
function createDialog(emit: Dialog["emit"]): Widget {
  const box = makeColumn(8);
  setPadding(box, DIALOG.padding);
  setCornerRadius(box, DIALOG.radius);
  setBackground(box, "box");
  widgetSetBorderWidth(box, 1);
  setBorder(box, "border");
  const placeholder = NativeVStack(0, [box]);
  widgetSetMaxWidth(box, 1e6);
  widgetSetHidden(placeholder, 1);
  slotted.add(placeholder);
  bodies.set(placeholder, box);
  dialogs.set(placeholder, { placeholder, box, open: false, modal: false, emit });
  return placeholder;
}

// The render root is a ZStack, so the backdrop and the layer that centres a modal box, added
// last, cover everything the app renders. AppKit passes a click that lands on a view without a
// mouse-down handler of its own, such as the layer, to a control beneath it, so the backdrop is
// an empty label, which takes the click itself. It stops the click only as the layer's sibling,
// not as its parent. A click recognizer would stop it too, but it takes the clicks of the
// buttons inside its view, the dialog's own among them.
function getModalLayer(): Widget {
  if (modalLayer) return modalLayer;
  if (!renderRoot) throw new Error("showModal() needs the app rendered with render()");
  modalBackdrop = Text("");
  setBackground(modalBackdrop, "backdrop");
  modalLayer = NativeVStack(0, [NativeVStack(0, []), NativeVStack(0, [])]);
  stackSetDistribution(modalLayer, EQUAL_CENTERING);
  setPadding(modalLayer, MODAL.margin);
  for (const view of [modalBackdrop, modalLayer]) {
    widgetSetHidden(view, 1);
    widgetAddChild(renderRoot as Widget, view);
  }
  return modalLayer;
}

function moveBox(dialog: Dialog, from: Widget, to: Widget, index: number): void {
  if (__platform__ !== 0) widgetRemoveChild(from, dialog.box);
  widgetAddChildAt(to, dialog.box, index);
}

function showDialog(dialog: Dialog, modal: boolean): void {
  if (dialog.open) {
    if (dialog.modal === modal) return;
    throw new Error(`A dialog already open ${dialog.modal ? "modally" : "in place"} can't be shown ${modal ? "modally" : "in place"}`);
  }
  dialog.open = true;
  dialog.modal = modal;
  if (!modal) return widgetSetHidden(dialog.placeholder, 0);
  const layer = getModalLayer();
  moveBox(dialog, dialog.placeholder, layer, 1);
  widgetSetMaxWidth(dialog.box, MODAL.width);
  modalCount++;
  widgetSetHidden(modalBackdrop, 0);
  widgetSetHidden(layer, 0);
}

function hideDialog(dialog: Dialog): boolean {
  if (!dialog.open) return false;
  if (dialog.modal) {
    moveBox(dialog, modalLayer, dialog.placeholder, 0);
    widgetSetMaxWidth(dialog.box, 1e6);
    if (--modalCount === 0) {
      widgetSetHidden(modalBackdrop, 1);
      widgetSetHidden(modalLayer, 1);
    }
  }
  widgetSetHidden(dialog.placeholder, 1);
  dialog.open = false;
  dialog.modal = false;
  return true;
}

/** What a dialog's `ref` gets natively: the HTMLDialogElement methods both builds support. */
class DialogElement {
  declare handle: number;
  returnValue = "";
  get open(): boolean { return dialogs.get(this.handle)!.open; }
  show(): void { showDialog(dialogs.get(this.handle)!, false); }
  showModal(): void { showDialog(dialogs.get(this.handle)!, true); }
  close(returnValue?: string): void {
    const dialog = dialogs.get(this.handle)!;
    if (returnValue !== undefined) this.returnValue = returnValue;
    if (hideDialog(dialog)) dialog.emit("onClose", { value: this.returnValue, checked: false });
  }
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

// The click goes to onClick first, and the link opens only if the handler didn't prevent it.
function makeLink(text: Widget, emit: Emit): void {
  links.set(text, "");
  setTextColour(text, "accent");
  addClick(text, () => {
    const href = links.get(text);
    if (emit("onClick", { value: "", checked: false }) && href) openURL(href);
  });
}

function createRichText(tag: string, emit: Emit): Widget {
  const text = AttributedText();
  richTexts.set(text, tag);
  if (tag === "mark") markText(text);
  else slotted.add(text);
  if (tag === "a") makeLink(text, emit);
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
  // A run's colour is fixed when it's appended, so a link's runs keep the light accent.
  const [accent] = COLOURS.accent;
  attributedTextAppend(text, run.text, bold, italic, underline, size, accent[0], accent[1], accent[2], color ? 1 : 0);
}

function setRuns(text: Widget, runs: TextRun[]): void {
  attributedTextClear(text);
  for (const run of runs) appendRun(text, run);
}

const driver: NativeDriver = {
  modifiers() {
    const bits = currentModifiers();
    return { metaKey: (bits & 1) !== 0, shiftKey: (bits & 2) !== 0, altKey: (bits & 4) !== 0, ctrlKey: (bits & 8) !== 0 };
  },
  create(kind, tag, emit): number {
    switch (kind) {
      case "VStack": {
        const list = tag === "ul" || tag === "ol";
        const column = makeColumn(list ? LIST_GAP : 8);
        if (list) lists.set(column, { ordered: tag === "ol", items: [] });
        if (tag === "fieldset") {
          setPadding(column, FIELDSET.padding);
          setCornerRadius(column, FIELDSET.radius);
          widgetSetBorderWidth(column, 1);
          setBorder(column, "border");
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
      case "Spacer": {
        const spacer = NativeSpacer();
        spacers.add(spacer);
        return spacer;
      }
      case "ScrollView": {
        const scroll = NativeScrollView();
        const content = makeColumn(8);
        scrollviewSetChild(scroll, content);
        bodies.set(scroll, content);
        return scroll;
      }
      case "RichText": return createRichText(tag, emit);
      case "Text": {
        if (ITALIC.has(tag)) return createRichText(tag, emit);
        const text = Text("");
        // In the slot, text is as wide as its column, which would stretch a mark's background.
        if (tag !== "mark") slotted.add(text);
        if (tag === "span") plainTexts.add(text);
        if (HEADINGS[tag]) textSetFontWeight(text, HEADINGS[tag], SEMIBOLD);
        else if (tag === "strong" || tag === "b") textSetFontWeight(text, BODY, BOLD);
        else if (tag === "legend") textSetFontWeight(text, BODY, SEMIBOLD);
        else if (SMALLER.has(tag)) textSetFontSize(text, SMALL);
        else if (MONOSPACED.has(tag)) textSetFontFamily(text, "monospaced");
        else if (tag === "mark") markText(text);
        if (DECORATIONS[tag]) decorations.set(text, DECORATIONS[tag]);
        if (tag === "a") makeLink(text, emit);
        if (tag === "summary") summaries.add(text);
        return text;
      }
      case "TableSection": {
        const section = NativeVStack(TABLE.spacing, []);
        if (tag === "table") setPadding(section, TABLE.spacing);
        return section;
      }
      case "TableRow": return NativeHStack(TABLE.spacing, []);
      case "TableCell": return createCell(tag === "th");
      case "Details": return createDetails();
      case "Dialog": return createDialog(emit);
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
    if (name === "role" || name === "tabIndex" || name === "class" || name.startsWith("aria-") || name.startsWith("data-")) return;
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
    if (kind === "TableCell" && name === "width") {
      return widgetSetWidth(handle as Widget, numeric(value, TABLE.width) + 2 * TABLE.padding);
    }
    const dialog = dialogs.get(handle);
    if (dialog && name === "open") return void (value ? showDialog(dialog, false) : hideDialog(dialog));
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
    if (previousParent !== null) {
      unlist(previousParent, child);
      countSpacer(previousParent, child, -1);
    }
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
      else {
        if (!labelledBy.has(child)) addClick(child as Widget, () => {
          const control = controls.get(labelledBy.get(child)?.control ?? 0);
          if (control && control.inner !== 0 && control.props.type === "checkbox") toggle(control);
        });
        labelledBy.set(child, label);
      }
    }
    if (headerCells.has(parent) && plainTexts.has(child)) textSetFontWeight(child as Widget, BODY, BOLD);
    // AppKit's indexed insertion detaches without destroying retained layout
    // metadata. Other backends need the old parent explicitly cleared first.
    if (previousParent !== null && __platform__ !== 0) {
      widgetRemoveChild(previousParent as Widget, child as Widget);
    }
    widgetAddChildAt(parent as Widget, child as Widget, index);
    if (columns.has(parent) && slotted.has(child)) widgetSetMaxWidth(child as Widget, 1e6);
    countSpacer(parent, child, 1);
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
    if (label) labelledBy.delete(child);
    unlist(parent, child);
    countSpacer(parent, child, -1);
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
  // An element takes clicks only once it has a handler, so one without a handler leaves them to
  // the element around it. A button and the controls report their own events.
  listen(handle, kind, handler, emit) {
    if (handler !== "onClick" || listening.has(handle) || links.has(handle) || kind === "Button" || controls.has(handle) || options.has(handle)) return;
    listening.add(handle);
    addClick(handle as Widget, () => emit("onClick", { value: "", checked: false }));
  },
  element(kind, handle) {
    if (kind === "Dialog") return new DialogElement();
    if (kind !== "Canvas") return undefined;
    const canvas = new CanvasElement(handle);
    canvases.set(handle, canvas);
    return canvas;
  },
};

const native = createNativeRenderer(driver);
export const h = native.h;
/** Mounts the app into a native ZStack, which a modal dialog's layer then covers. */
export function render(code: () => JSX.Element, root: Widget): () => void {
  renderRoot = root;
  return native.render(code as Parameters<typeof native.render>[0], root);
}
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
