import * as Plot from "../_npm/@observablehq/plot@0.6.17/d761ef9b.js";
import * as Inputs from "../_observablehq/stdlib/inputs.4ef1d259.js";
import { html } from "../_npm/htl@0.3.1/72f4716c.js";
import { FileAttachment } from "../_observablehq/stdlib.73a8ec5a.js";

// https://observablehq.com/@mbostock/scrubber
/*
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
export function Scrubber(
  values,
  {
    format = (value) => value,
    initial = 0,
    direction = 1,
    delay = null,
    autoplay = true,
    loop = true,
    loopDelay = null,
    alternate = false,
  } = {},
) {
  values = Array.from(values);
  const form = html`<form
    style="font: 12px var(--sans-serif); font-variant-numeric: tabular-nums; display: flex; height: 33px; align-items: center;"
  >
    <button
      name="b"
      type="button"
      style="margin-right: 0.4em; width: 5em;"
    ></button>
    <label style="display: flex; align-items: center;">
      <input
        name="i"
        type="range"
        min="0"
        max=${values.length - 1}
        value=${initial}
        step="1"
        style="width: 180px;"
      />
      <output name="o" style="margin-left: 0.4em;"></output>
    </label>
  </form>`;
  let frame = null;
  let timer = null;
  let interval = null;
  function start() {
    form.b.textContent = "Pause";
    if (delay === null) frame = requestAnimationFrame(tick);
    else interval = setInterval(tick, delay);
  }
  function stop() {
    form.b.textContent = "Play";
    if (frame !== null) (cancelAnimationFrame(frame), (frame = null));
    if (timer !== null) (clearTimeout(timer), (timer = null));
    if (interval !== null) (clearInterval(interval), (interval = null));
  }
  function running() {
    return frame !== null || timer !== null || interval !== null;
  }
  function tick() {
    if (
      form.i.valueAsNumber ===
      (direction > 0 ? values.length - 1 : direction < 0 ? 0 : NaN)
    ) {
      if (!loop) return stop();
      if (alternate) direction = -direction;
      if (loopDelay !== null) {
        if (frame !== null) (cancelAnimationFrame(frame), (frame = null));
        if (interval !== null) (clearInterval(interval), (interval = null));
        timer = setTimeout(() => (step(), start()), loopDelay);
        return;
      }
    }
    if (delay === null) frame = requestAnimationFrame(tick);
    step();
  }
  function step() {
    form.i.valueAsNumber =
      (form.i.valueAsNumber + direction + values.length) % values.length;
    form.i.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }
  form.i.oninput = (event) => {
    if (event && event.isTrusted && running()) stop();
    form.value = values[form.i.valueAsNumber];
    form.o.value = format(form.value, form.i.valueAsNumber, values);
  };
  form.b.onclick = () => {
    if (running()) return stop();
    direction =
      alternate && form.i.valueAsNumber === values.length - 1 ? -1 : 1;
    form.i.valueAsNumber = (form.i.valueAsNumber + direction) % values.length;
    form.i.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    start();
  };
  form.i.oninput();
  if (autoplay) start();
  else stop();
  Inputs.disposal(form).then(stop);
  return form;
}

const gridSamples = await FileAttachment({"name":"../data/interest_grid.csv","mimeType":"text/csv","path":"../_file/data/interest_grid.1e86b442.csv","lastModified":1764534114229,"size":34857}, import.meta.url).csv({
  typed: true,
});
export const data_361d = await FileAttachment({"name":"../data/interest_361d.csv","mimeType":"text/csv","path":"../_file/data/interest_361d.5cb323a7.csv","lastModified":1764042931142,"size":328}, import.meta.url).csv({
  typed: true,
});
export const data_full = (
  await FileAttachment({"name":"../data/interest.csv","mimeType":"text/csv","path":"../_file/data/interest.3455a12c.csv","lastModified":1764122074830,"size":11014}, import.meta.url).csv({ typed: true })
).toSorted((a, b) => a.days - b.days);
export const sampling_361d = await FileAttachment({"name":"../data/sampling_361d.csv","mimeType":"text/csv","path":"../_file/data/sampling_361d.2edddfcf.csv","lastModified":1764287408790,"size":1991}, import.meta.url).csv(
  { typed: true },
);

const sampledDays = Array.from(
  new Set(data_full.map(({ days }) => parseInt(days))),
).toSorted((a, b) => a - b);

function maxDaysBefore(d) {
  return sampledDays.filter((x) => x <= d).pop();
}
export function interestFunctionAtTime(d) {
  return data_full.filter(({ days }) => days === maxDaysBefore(d));
}

const sampledCapitals = Array.from(
  new Set(data_full.map(({ capital }) => parseInt(capital))),
).toSorted((a, b) => a - b);
function maxCapitalBefore(c) {
  return sampledCapitals.filter((x) => x <= c).pop();
}
export function interestFunctionAtCapital(c) {
  return data_full.filter(({ capital }) => capital === maxCapitalBefore(c));
}

export const silentBasicPlot = () =>
  Plot.lineY(data_361d, {
    x: "capital",
    y: "yearly_interest_rate",
    tip: true,
  }).plot({
    x: { type: "log", label: "X" },
    y: { label: "Y" },
  });
export const basicPlot = () =>
  Plot.lineY(data_361d, {
    x: "capital",
    y: "yearly_interest_rate",
    tip: true,
  }).plot({
    x: { type: "log", label: "Capital (USD)" },
    y: { label: "Yearly interest (%)" },
  });

export const gridPlot = () =>
  Plot.plot({
    marks: [
      Plot.dot(gridSamples, {
        x: "days",
        y: "capital",
        fill: "interest_rate",
        tip: true,
      }),
    ],
    x: { label: "Duration (d)" },
    y: { label: "Capital (USD)" },
    color: { legend: true, label: "Yearly interest rate (%)" },
  });

export const fullPlot = (days, capital) =>
  Plot.plot({
    marks: [
      Plot.voronoi(data_full, {
        x: "capital",
        y: "days",
        fill: "interest_rate",
      }),
      // Plot.rect([[100, 0, 1e6, 30]], {x1: "0", y1: "1", x2: "2", y2: "3", fill:"red", fillOpacity: 0.4}),
      Plot.ruleY([days], { stroke: "red", strokeWidth: 2 }),
      Plot.ruleX([capital], { stroke: "blue", strokeWidth: 2 }),
      Plot.dot(data_full, { x: "capital", y: "days" }),
      Plot.tip(
        data_full,
        Plot.pointer({
          x: "capital",
          y: "days",
          fill: "interest_rate",
          channels: { "Yearly interest rate (%)": "interest_rate" },
          maxRadius: 200,
        }),
      ),
    ],
    x: { type: "log", label: "Capital (USD)" },
    y: {
      domain: [0, 720],
      label: "Duration (d)",
      ticks: Array(25)
        .fill(0)
        .map((_, i) => i * 30),
    },
    color: { label: "Yearly interest rate (%)", legend: true, domain: [3, 6] },
    pointer: { maxRadius: 200 },
  });

export function plotSampling1D(config = {}) {
  return Plot.plot({
    x: { type: "log", label: "Capital (USD)" },
    y: { label: "Yearly interest (%)", domain: [4.9, 5.8] },
    ...config,
    marks: [
      Plot.lineY(sampling_361d, {
        x: "capital",
        y: "yearly_interest_rate",
        stroke: "var(--theme-foreground-fainter)",
        strokeDasharray: "3, 5",
        sort: { channel: "x" },
      }),
      ...(config.marks ?? []),
    ],
  });
}

const samplingUpTo = (n) => sampling_361d.slice(0, n);
export function plotProgress(n, highlightPrev = 0) {
  const samplesToShow = samplingUpTo(n);
  const highlightedCapitals = samplesToShow
    .slice(highlightPrev * -1, samplesToShow.length)
    .map(({ capital }) => capital);
  const isHighlighted = ({ capital }) => highlightedCapitals.includes(capital);

  return plotSampling1D({
    color: {
      domain: [false, true],
      range: ["var(--theme-foreground)", "var(--theme-foreground-focus)"],
    },
    r: {
      domain: [false, true],
      range: [3, 5],
    },
    marks: [
      Plot.line(samplesToShow, {
        x: "capital",
        y: "yearly_interest_rate",
        sort: { channel: "x" },
      }),
      Plot.dot(samplesToShow, {
        x: "capital",
        y: "yearly_interest_rate",
        symbol: "times",
        stroke: isHighlighted,
        strokeWidth: (d) => (isHighlighted(d) ? 2 : 1),
        r: isHighlighted,
        tip: true,
        title: ({ capital, yearly_interest_rate }) =>
          `${yearly_interest_rate}% for $${capital}`,
      }),
    ],
  });
}
