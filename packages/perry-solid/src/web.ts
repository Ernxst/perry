// The web build's perry-solid: Solid renders the HTML elements itself, so this only
// supplies the stack components, as divs, and a stylesheet that matches Perry's defaults.
import { createRenderEffect, For as SolidFor, type Accessor } from "solid-js";
import { insert, render as solidRender } from "solid-js/web";
import type { JSX } from "./jsx-runtime.ts";
import type { StackProps, TableProps } from "./types.ts";
export type { StackProps, TableColumn, TableProps } from "./types.ts";

export const For = SolidFor as <T>(props: {
  each: readonly T[] | false | null | undefined;
  fallback?: JSX.Element;
  children: (item: T, index: Accessor<number>) => JSX.Element;
}) => JSX.Element;

// Sizes match the native driver in index.ts.
const STYLES = `
body { margin: 0; font: 13px system-ui, sans-serif; }
[hidden] { display: none !important; }
.perry-vstack, .perry-hstack { display: flex; gap: 8px; box-sizing: border-box; }
.perry-vstack { flex-direction: column; }
.perry-hstack { align-items: center; }
.perry-zstack { display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); width: 100%; height: 100%; overflow: hidden; }
.perry-zstack > * { grid-area: 1 / 1; }
.perry-zstack > canvas { width: 100%; height: 100%; }
.perry-spacer { flex: 1; }
.perry-scrollview { display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; overflow-y: auto; }
h1, h2, h3, h4, h5, h6, p, pre { margin: 0; }
h1, h2, h3, h4, h5, h6 { font-weight: 600; }
h1 { font-size: 26px; } h2 { font-size: 20px; } h3 { font-size: 16px; }
h4 { font-size: 14px; } h5 { font-size: 13px; } h6 { font-size: 11px; }
small, sub, sup { font-size: 11px; }
code, kbd, samp, pre { font-family: ui-monospace, monospace; }
mark { align-self: flex-start; background: #ff0; color: #000; }
:where(.perry-vstack, .perry-hstack, .perry-zstack, .perry-scrollview)
  :is(main, header, footer, nav, section, article, aside, figure, search, menu, form, div:not([class*="perry-"])) {
  display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; box-sizing: border-box;
}
fieldset { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 12px; min-width: 0; border: 1px solid rgba(0, 0, 0, 0.2); border-radius: 6px; }
legend { float: left; padding: 0; font-weight: 600; }
details { align-self: stretch; }
details::details-content { display: flex; flex-direction: column; gap: 8px; }
details[open] > summary { margin-bottom: 8px; }
summary { cursor: default; }
ul, ol { display: flex; flex-direction: column; gap: 4px; margin: 0; padding-left: 20px; }
button { align-self: flex-start; font: inherit; padding: 3px 14px; border-radius: 6px; border: 0; background: #fff; color: #000; }
a { color: rgb(0, 104, 218); align-self: flex-start; }
img { align-self: flex-start; object-fit: fill; }
iframe { align-self: flex-start; border: 0; }
progress, meter { appearance: none; align-self: flex-start; width: 150px; height: 6px; border: 0; border-radius: 3px; background: rgba(0, 0, 0, 0.12); overflow: hidden; }
progress::-webkit-progress-bar, meter::-webkit-meter-bar { background: transparent; border: 0; height: 6px; }
progress::-webkit-progress-value, meter::-webkit-meter-optimum-value { background: rgb(0, 104, 218); }
progress::-moz-progress-bar, meter::-moz-meter-bar { background: rgb(0, 104, 218); }
hr { align-self: stretch; margin: 0; border: 0; border-top: 1px solid #0002; }
label { display: flex; align-items: center; gap: 8px; align-self: flex-start; }
.perry-table { align-self: flex-start; overflow: auto; background: #fff; border: 1px solid rgba(0, 0, 0, 0.2); box-sizing: border-box; }
.perry-table table { border-collapse: collapse; table-layout: fixed; }
.perry-table th { position: sticky; top: 0; background: #fff; font-weight: 400; text-align: left; padding: 3px 6px; border-bottom: 1px solid rgba(0, 0, 0, 0.2); }
.perry-table td { padding: 3px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.perry-table tr.perry-selected td { background: rgb(0, 104, 218); color: #fff; }
input, textarea, select { font: inherit; align-self: flex-start; }
input:is(:not([type]), [type=text], [type=password], [type=search], [type=email], [type=url], [type=tel], [type=number]), textarea {
  width: 200px; box-sizing: border-box;
}
textarea { height: 60px; }
input[type=range] { width: 150px; }
`;

const style = document.createElement("style");
style.textContent = STYLES;
document.head.append(style);

function px(value: number | undefined): string {
  return value == null ? "" : `${value}px`;
}

function stack(kind: string, props: StackProps): HTMLElement {
  const element = document.createElement("div");
  element.className = `perry-${kind}`;
  createRenderEffect(() => {
    const { style } = element;
    const color = props.backgroundColor;
    style.padding = px(props.padding);
    style.borderRadius = px(props.cornerRadius);
    style.width = px(props.width);
    style.height = px(props.height);
    style.opacity = props.opacity == null ? "" : String(props.opacity);
    style.background = color ? `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})` : "";
    element.hidden = !!props.hidden;
  });
  insert(element, () => props.children);
  return element;
}

export function VStack(props: StackProps): JSX.Element { return stack("vstack", props); }
export function HStack(props: StackProps): JSX.Element { return stack("hstack", props); }
export function ZStack(props: StackProps): JSX.Element { return stack("zstack", props); }
export function Spacer(): JSX.Element { return stack("spacer", {}); }
/** A column that scrolls vertically when its children overflow its `height`. */
export function ScrollView(props: StackProps): JSX.Element { return stack("scrollview", props); }

/** A scrolling table of rows, one cell of text per column; `<table>` itself isn't supported natively. */
export function Table<T>(props: TableProps<T>): JSX.Element {
  const wrapper = document.createElement("div");
  wrapper.className = "perry-table";
  const table = wrapper.appendChild(document.createElement("table"));
  const head = table.createTHead().insertRow();
  const body = table.createTBody();
  createRenderEffect(() => {
    head.replaceChildren(...props.columns.map(column => {
      const cell = document.createElement("th");
      cell.textContent = column.title;
      cell.style.width = px(column.width ?? 100);
      return cell;
    }));
    const width = props.columns.reduce((sum, column) => sum + (column.width ?? 100), 0);
    wrapper.style.width = px(props.width ?? width);
    wrapper.style.height = px(props.height ?? 200);
    wrapper.hidden = !!props.hidden;
  });
  createRenderEffect(() => {
    const columns = props.columns;
    body.replaceChildren(...props.rows.map((row, index) => {
      const line = document.createElement("tr");
      for (const column of columns) line.insertCell().textContent = column.cell(row);
      line.onclick = () => {
        body.querySelector(".perry-selected")?.classList.remove("perry-selected");
        line.classList.add("perry-selected");
        props.onSelect?.(row, index);
      };
      return line;
    }));
  });
  return wrapper;
}

/** Solid's DOM `render`, typed for elements written against perry-solid's JSX. */
export const render = solidRender as (code: () => JSX.Element, element: HTMLElement) => () => void;
