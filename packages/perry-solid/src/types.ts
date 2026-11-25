import type { JSX } from "./jsx-runtime.ts";

/** Props of `VStack`, `HStack`, `ZStack` and `ScrollView`. Sizes are in points natively and CSS pixels on the web. */
export interface StackProps {
  children?: JSX.Element;
  padding?: number;
  cornerRadius?: number;
  /** Red, green, blue and alpha, each from 0 to 1. */
  backgroundColor?: [number, number, number, number];
  width?: number;
  height?: number;
  opacity?: number;
  hidden?: boolean;
}

export interface TableColumn<T> {
  title: string;
  /** In pixels; 100 if left out. */
  width?: number;
  /** The text of this column's cell in `row`. */
  cell: (row: T) => string;
}

/** Props of `Table`, which is 200 pixels high unless `height` says otherwise. */
export interface TableProps<T> {
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  width?: number;
  height?: number;
  hidden?: boolean;
  /** Fires when a row is clicked, with the row and its index. */
  onSelect?: (row: T, index: number) => void;
}
