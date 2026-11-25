# perry-solid

This branch changes perry-solid so shared code writes HTML elements (`<span>`, `<button>`, `<input>`, `<select>` and the rest) inside the `VStack`, `HStack`, `ZStack` and `Spacer` components this package exports.

- **Perry builds** resolve the package's `perry` condition to `src/index.ts`. Solid's universal renderer, in `src/renderer.ts`, turns each element into a Perry widget.
- **Web builds** resolve to `src/web.ts`. Solid's DOM renderer makes the real elements, and the stacks are `<div>`s. `perry-solid/web` exports Solid's DOM `render`.

`src/jsx-runtime.ts` lists the supported elements and attributes. The examples and tests under `examples/` and `test/` still use the lowercase-tag API this branch replaced.
