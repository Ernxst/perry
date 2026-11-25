import { CanvasElement } from "perry-browser";

export function canvasElement(handle: number): CanvasElement {
  return new CanvasElement(handle);
}

export function setCanvasSize(canvas: CanvasElement, name: "width" | "height", points: number): void {
  if (name === "width") canvas.clientWidth = points;
  else canvas.clientHeight = points;
}
