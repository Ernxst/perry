import * as ui from "perry/ui";

// perry-vite's browser perry/ui adds widgetElement, which Perry's own declarations lack.
const { widgetElement } = ui as typeof ui & { widgetElement(handle: number): HTMLElement };

/** The `<canvas>` behind the widget. */
export function canvasElement(handle: number): HTMLElement {
  return widgetElement(handle);
}

/** The browser lays the canvas out, so its client size needs no tracking. */
export function setCanvasSize(_canvas: unknown, _name: "width" | "height", _points: number): void {}
