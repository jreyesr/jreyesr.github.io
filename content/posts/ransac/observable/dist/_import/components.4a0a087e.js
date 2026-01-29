import { html } from "../_npm/htl@0.3.1/72f4716c.js";

export const simpleSlider = (maxVal) =>
  html`<input
    type="range"
    min="0"
    max=${maxVal}
    step="1"
    value="0"
    style="width:200px"
  />`;
