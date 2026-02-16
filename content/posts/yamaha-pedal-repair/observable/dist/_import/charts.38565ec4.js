import * as Plot from "../_npm/@observablehq/plot@0.6.17/7c43807f.js";
import { FileAttachment } from "../_observablehq/stdlib.73a8ec5a.js";

export const alps_old = await FileAttachment({"name":"../data/alps_old.csv","mimeType":"text/csv","path":"../_file/data/alps_old.95bdf028.csv","lastModified":1769917362398,"size":10578}, import.meta.url).csv({
  typed: true,
});
export const alps_new = await FileAttachment({"name":"../data/alps_new.csv","mimeType":"text/csv","path":"../_file/data/alps_new.a028c602.csv","lastModified":1769917878939,"size":10483}, import.meta.url).csv({
  typed: true,
});
export const alps_linear = await FileAttachment({"name":"../data/alps_linear.csv","mimeType":"text/csv","path":"../_file/data/alps_linear.d5e570fd.csv","lastModified":1769917539419,"size":10918}, import.meta.url).csv({
  typed: true,
});
export const tenk_linear = await FileAttachment({"name":"../data/10k_linear.csv","mimeType":"text/csv","path":"../_file/data/10k_linear.c830c0e8.csv","lastModified":1769917575686,"size":7170}, import.meta.url).csv({
  typed: true,
});
export const log_taper = await FileAttachment({"name":"../data/log_taper.csv","mimeType":"text/csv","path":"../_file/data/log_taper.171d7ba4.csv","lastModified":1769917579651,"size":7046}, import.meta.url).csv({
  typed: true,
});
// voltage divider with 5V -> pot -> meas point -> 1k -> GND, so R1=? and R2=1k
// vdiv equation is Vratio=R2/(R1+R2), here Vratio=adc/1023 because Arduino has 10-bit ADC
// => R1+R2 = R2/Vratio = R2*1023/adc
// => R1 = R2*1023/adc - R2
const R2 = 976;
export const alps_old_from_res_1k = (
  await FileAttachment({"name":"../data/alps_old_res_1k.csv","mimeType":"text/csv","path":"../_file/data/alps_old_res_1k.1ac322e6.csv","lastModified":1770478186391,"size":6889}, import.meta.url).csv({
    typed: true,
  })
).map((x) => ({ ...x, res: (R2 * 1023) / x.adc - R2 }));
export const alps_new_from_res_1k = (
  await FileAttachment({"name":"../data/alps_new_res_1k.csv","mimeType":"text/csv","path":"../_file/data/alps_new_res_1k.9c7861c3.csv","lastModified":1770478186376,"size":6931}, import.meta.url).csv({
    typed: true,
  })
).map((x) => ({ ...x, res: (R2 * 1023) / x.adc - R2 }));

export function plotRotationVsVoltage(data, ...extraLayers) {
  return Plot.plot({
    color: {
      domain: [-1, 1],
      range: ["red", "green"],
    },
    marks: [
      Plot.dot(data, {
        x: "angle",
        y: "adc",
        // stroke: "dir",
        // strokeOpacity: 0.2,
      }),
      Plot.crosshair(data, { x: "angle", y: "adc" }),
      ...extraLayers,
    ],
  });
}
function plotRotationVsComputedResistance(data) {
  return Plot.plot({
    y: { tickFormat: "~s" },
    marks: [
      Plot.dot(data, {
        x: "angle",
        y: "res",
      }),
      Plot.crosshair(data, { x: "angle", y: "res" }),
    ],
  });
}

const alpsArrows = [
  { x1: 93, y1: 425, x2: 106, y2: 644 },
  { x1: 76, y1: 644, x2: 63, y2: 425 },
];
const linearArrows = [
  { x1: 83, y1: 425, x2: 133, y2: 644 },
  { x1: 92, y1: 644, x2: 40, y2: 425 },
];

export const plotAlpsOld = () =>
  plotRotationVsVoltage(
    alps_old,
    Plot.arrow(alpsArrows, { x1: "x1", y1: "y1", x2: "x2", y2: "y2" }),
  );
export const plotAlpsNew = () =>
  plotRotationVsVoltage(
    alps_new,
    Plot.arrow(alpsArrows, { x1: "x1", y1: "y1", x2: "x2", y2: "y2" }),
  );
export const plotAlpsLinear = () =>
  plotRotationVsVoltage(
    alps_linear,
    Plot.arrow(linearArrows, { x1: "x1", y1: "y1", x2: "x2", y2: "y2" }),
  );
export const plot10kLinear = () =>
  plotRotationVsVoltage(
    tenk_linear,
    Plot.arrow(linearArrows, { x1: "x1", y1: "y1", x2: "x2", y2: "y2" }),
  );
export const plot10kLog = () =>
  plotRotationVsVoltage(
    log_taper,
    Plot.arrow(
      [
        { x1: 88, y1: 150, x2: 140, y2: 322 },
        { x1: 130, y1: 440, x2: 88, y2: 220 },
      ],
      { x1: "x1", y1: "y1", x2: "x2", y2: "y2", bend: 30, sweep: "+x" },
    ),
  );

export const plotAlpsOldAsRes = () =>
  plotRotationVsComputedResistance(alps_old_from_res_1k);

export const plotAlpsNewAsRes = () =>
  plotRotationVsComputedResistance(alps_new_from_res_1k);
