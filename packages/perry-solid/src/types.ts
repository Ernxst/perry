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
