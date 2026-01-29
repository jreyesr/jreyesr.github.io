import { html } from "npm:htl";

export const simpleSlider = (maxVal) =>
  html`<input
    type="range"
    min="0"
    max=${maxVal}
    step="1"
    value="0"
    style="width:200px"
  />`;
