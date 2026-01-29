import * as Plot from "../_npm/@observablehq/plot@0.6.17/d761ef9b.js";
import { FileAttachment } from "../_observablehq/stdlib.73a8ec5a.js";
import {
  BUFFER_DISTANCE,
  NUM_RANDOM_SAMPLINGS,
  X_CONVERSION_FACTOR,
  PEAK_DETECTION_LOOKAROUND,
  PEAK_DETECTION_MIN_DENSITY,
} from "./parameters.411d35f9.js";
import { shuffle } from "./functions.f0d29e4a.js";

export const data = await FileAttachment({"name":"../data/Mazar's reservoir-data.csv","mimeType":"text/csv","path":"../_file/data/Mazar's reservoir-data.80b11a57.csv","lastModified":1767580878623,"size":194408}, import.meta.url)
  .csv({
    typed: true,
  })
  .then((D) =>
    D.map((x) => ({
      ...x,
      Epoch:
        x.Time < new Date("2025-02-17")
          ? 0
          : x.Time < new Date("2025-12-01")
            ? 1
            : 2,
    })),
  );
const minTime = Math.min(...data.map((x) => x.Time));
const maxTime = Math.max(...data.map((x) => x.Time));
const minLevel = Math.min(...data.map((x) => x.water_level_masl));
const maxLevel = Math.max(...data.map((x) => x.water_level_masl));

const epochs = [
  {
    start: minTime,
    end: new Date("2025-02-17"),
    color: "red",
    label: "→ Recovering from drought",
  },
  {
    start: new Date("2025-02-17"),
    end: new Date("2025-12-01"),
    color: "green",
    label: "→ Everything normal, nothing to worry about...",
  },
  {
    start: new Date("2025-12-01"),
    end: maxTime,
    color: "orange",
    label: "...right?",
  },
];

export const plot = (width = 640) =>
  Plot.plot({
    width,
    x: { type: "time" },
    y: { label: "Reservoir level (masl)" },
    color: {
      domain: Object.keys(epochs).map((x) => parseInt(x)),
      range: epochs.map((x) => x.color),
    },
    marks: [
      Plot.line(data, {
        x: "Time",
        y: "water_level_masl",
        stroke: "Epoch",
      }),
      Plot.barX(epochs, {
        x1: "start",
        x2: "end",
        fill: "color",
        fillOpacity: 0.1,
      }),
      Plot.text(epochs, {
        x: "start",
        y: Math.min(...data.map((x) => x.water_level_masl)),
        text: "label",
        textAnchor: "start",
        lineAnchor: "bottom",
        dx: 10,
        dy: -6,
        stroke: "var(--theme-foreground-faintest)",
        fill: "var(--theme-foreground)",
      }),
      Plot.crosshairX(data, {
        x: "Time",
        y: "water_level_masl",
        textFill: "Epoch",
      }),
    ],
  });

export const plotWithLines = (lines, width = 640) =>
  Plot.plot({
    width,
    x: { type: "utc" },
    y: { label: "Reservoir level (masl)" },
    marks: [
      Plot.line(data, { x: "Time", y: "water_level_masl" }),
      Plot.link(lines, {
        x1: "0",
        y1: "1",
        x2: "2",
        y2: "3",
        stroke: "var(--theme-foreground-focus)",
        strokeWidth: 3,
      }),
    ],
  });

const byDay = Plot.binX(
  { y: "mean" },
  {
    x: "Time",
    y: "water_level_masl",
    interval: "day",
  },
);
export const plotNaiveLinReg = (width = 640) =>
  Plot.plot({
    width,
    x: { type: "utc" },
    marks: [
      Plot.dot(data, byDay, { x: "Time", y: "water_level_masl" }),
      Plot.linearRegressionY(data, {
        ...byDay,
        stroke: "var(--theme-foreground-focus)",
        ci: 0.999999,
      }),
    ],
  });

const nonRandomChoices = [
  1018, // ↧
  1020, // ↥ tiny section that is a very good fit but only for a very small portion of the data
  600, // ↧
  850, // ↥ covers the part where reservoir was filling up
  1700, // ↧
  5400, // ↥ covers the part where reservoir was full
  7850, // ↧
  8230, // ↥ covers the part where reservoir is draining
];
export const NUM_NONRANDOM_SAMPLINGS = Math.round(nonRandomChoices.length / 2);

// called "random", but not all of them are (the final 3 samples are manually chosen to reflect the three main stages of the reservoir's life)
const indices = Object.keys(data).map((x) => parseInt(x)); // => [0, 1, 2, ..., data.length - 1]
export const randomChoices = [
  ...Array(NUM_RANDOM_SAMPLINGS)
    .fill(0)
    .flatMap((_) => shuffle(indices.slice()).slice(0, 2)),
  ...nonRandomChoices,
];
export const NUM_SAMPLINGS = NUM_RANDOM_SAMPLINGS + NUM_NONRANDOM_SAMPLINGS;

function modelForSample(p1, p2) {
  // get the coeffs for a line that passes through points p1 and p2
  // m = (y2-y1)/(x2-x1) = Δy/Δx
  // expressed on different units because by default milliseconds vs. meters is way too extreme and
  // the graph is essentially flat horizontal (all lines are nearly 0º and the cosine always rounds to 1)
  const m =
    (p2.water_level_masl - p1.water_level_masl) /
    ((p2.Time - p1.Time) / X_CONVERSION_FACTOR);
  if (isNaN(m)) debugger;

  const angle = Math.atan(m);
  // b=y-mx because y=mx+b
  const b = p1.water_level_masl - m * (p1.Time / X_CONVERSION_FACTOR);
  const yStart = m * (minTime / X_CONVERSION_FACTOR) + b;
  const yEnd = m * (maxTime / X_CONVERSION_FACTOR) + b;

  // <BUFFER_DISTANCE> meters in Y distance (and whatever maps to that, in X distance)
  const bufferY = BUFFER_DISTANCE / Math.cos(angle);

  function pointIsInBand(x, y) {
    const yCenter = m * (x / X_CONVERSION_FACTOR) + b;
    return Math.abs(y - yCenter) <= bufferY;
  }

  return {
    m,
    b,
    x1: Math.min(p2.Time, p1.Time),
    x2: Math.max(p2.Time, p1.Time),
    yStart,
    yEnd,
    bufferY,
    pointIsInBand,
  };
}

export const numVotesForSample = (randomIdx) => {
  const randomSample = [
    data[randomChoices[randomIdx * 2]],
    data[randomChoices[randomIdx * 2 + 1]],
  ];
  const { pointIsInBand } = modelForSample(...randomSample);
  const subsetInBand = data.filter((x) =>
    pointIsInBand(x.Time, x.water_level_masl),
  );

  // get the oldest and most recent points that voted for this solution...
  const startTime = subsetInBand[0].Time,
    endTime = subsetInBand[subsetInBand.length - 1].Time;
  // ... and the time elapsed between them
  const timeSpan = (endTime - startTime) / X_CONVERSION_FACTOR;

  return {
    voteCount: subsetInBand.length,
    // these two rely on the `data` array being ordered, which it should be from the source CSV
    startTime,
    endTime,
    timeSpan,
    // expressed in votes/day or whatever, to encourage solutions that cover a compact timespan
    voterDensity: subsetInBand.length / timeSpan,
    // voterPower = voterDensity * numVotes, I call it power because it reminds me of P=V²/R
    voterPower: (subsetInBand.length * subsetInBand.length) / timeSpan,
  };
};

export const votesInfoPerSample = Array(NUM_SAMPLINGS)
  .fill()
  .map((_, i) => ({
    p1: data[randomChoices[i * 2]],
    p2: data[randomChoices[i * 2 + 1]],
    ...modelForSample(
      data[randomChoices[i * 2]],
      data[randomChoices[i * 2 + 1]],
    ),
    ...numVotesForSample(i),
  }));

export const plotWithAllRandomSamples = (width = 640) => {
  return Plot.plot({
    width,
    x: { type: "utc" },
    y: { domain: [minLevel, maxLevel] },
    marks: [
      Plot.link(votesInfoPerSample.slice(0, 10000), {
        x1: minTime,
        x2: maxTime,
        y1: "yStart",
        y2: "yEnd",
        strokeWidth: 0.2,
        strokeOpacity: 0.05,
        mixBlendMode: "multiply",
      }),
      Plot.dot(data, { x: "Time", y: "water_level_masl", r: 1 }),
    ],
  });
};

export const plotWithRandomPointsPicked = (
  randomIdx,
  { inArea: highlightInsideArea, timeSpan: highlightTimeSpan },
  width = 640,
  height = undefined,
) => {
  const { p1, p2, startTime, endTime, yStart, yEnd, bufferY, pointIsInBand } =
    votesInfoPerSample[randomIdx];

  const subsetInBand = data.filter((x) =>
    pointIsInBand(x.Time, x.water_level_masl),
  );

  return Plot.plot({
    width,
    height,
    x: { type: "utc" },
    y: { domain: [minLevel, maxLevel] },
    // squishes the graph as necessary so 1 meter (Y) takes the same number of pixels as 2 days (X)
    aspectRatio: 1 / X_CONVERSION_FACTOR,
    marks: [
      Plot.axisX({ ticks: "1 week" }),
      Plot.line(data, { x: "Time", y: "water_level_masl", strokeWidth: 1 }),
      highlightInsideArea
        ? Plot.dot(subsetInBand, {
            x: "Time",
            y: "water_level_masl",
            stroke: "orange",
            r: 1,
          })
        : undefined,
      highlightTimeSpan
        ? Plot.ruleY([votesInfoPerSample[randomIdx]], {
            y: minLevel,
            x1: startTime,
            x2: endTime,
            marker: "circle",
            strokeWidth: 1.5,
            stroke: "red",
          })
        : undefined,
      highlightTimeSpan
        ? Plot.text(["Time spanned by votes →"], {
            x: startTime,
            y: minLevel,
            fill: "red",
            textAnchor: "start",
            lineAnchor: "bottom",
            dx: 5,
            dy: -5,
          })
        : undefined,
      highlightTimeSpan
        ? Plot.ruleX([startTime, endTime], {
            stroke: "red",
            strokeOpacity: 0.5,
            strokeDasharray: "3,5",
          })
        : undefined,
      Plot.dot([p1, p2], {
        x: "Time",
        y: "water_level_masl",
        stroke: "var(--theme-foreground-focus)",
        strokeWidth: 3,
        r: 5,
      }),
      Plot.areaY(
        [
          { Time: minTime, yLow: yStart - bufferY, yHigh: yStart + bufferY },
          { Time: maxTime, yLow: yEnd - bufferY, yHigh: yEnd + bufferY },
        ],
        {
          x: "Time",
          y1: "yLow",
          y2: "yHigh",
          fill: "var(--theme-foreground-focus)",
          fillOpacity: 0.15,
        },
      ),
      Plot.line(
        [
          { Time: minTime, water_level_masl: yStart },
          { Time: maxTime, water_level_masl: yEnd },
        ],
        {
          x: "Time",
          y: "water_level_masl",
          stroke: "var(--theme-foreground-focus)",
          strokeWidth: 2,
        },
      ),
    ],
  });
};

const addClick =
  (setRandomIdx) => (index, scales, values, dimensions, context, next) => {
    const el = next(index, scales, values, dimensions, context);
    const circles = el.querySelectorAll("circle");
    for (let i = 0; i < circles.length; i++) {
      const d = {
        index: index[i],
        x: values.channels.x.value[i],
        y: values.channels.y.value[i],
      };
      circles[i].addEventListener("click", (event) => {
        if (!event.bubbles) return;
        setRandomIdx(index[i]);
      });
    }
    return el;
  };
export const plotVotesDensityForParams = (randomIdx, setRandomIdx) =>
  Plot.plot({
    x: { type: "symlog", constant: 0.2 },
    r: { type: "linear" },
    marks: [
      Plot.crosshair(votesInfoPerSample, { x: "m", y: "voterDensity" }),
      Plot.dot(votesInfoPerSample, {
        x: "m",
        y: "voterDensity",
        sort: { channel: "r" },
        r: (_, i) => (i == randomIdx ? 3 : 2),
        fill: (_, i) => (i == randomIdx ? "orange" : "var(--theme-foreground)"),
        render: addClick(setRandomIdx),
      }),
    ],
  });

export const plotVotesPowerForParams = (
  randomIdx,
  setRandomIdx,
  annotations = [],
) => {
  return Plot.plot({
    x: { type: "symlog", constant: 0.2 },
    y: { type: "sqrt", label: "Voter power" },
    // r: { type: "linear" },
    color: { legend: true, type: "linear", label: "Voter density" },
    marks: [
      Plot.crosshair(votesInfoPerSample, { x: "m", y: "voterPower" }),
      Plot.dot(votesInfoPerSample, {
        x: "m",
        y: "voterPower",
        // ensure the selected point, if any, is always on top
        sort: { channel: "r" },
        r: (_, i) => (i == randomIdx ? 3 : 1),
        // for the selected point, fake its density as 48 so it appears a distinct color
        fill: ({ voterDensity }, i) => (i == randomIdx ? 48 : voterDensity),
        render: addClick(setRandomIdx),
      }),
      Plot.tip(annotations, {
        x: "m",
        y: "power",
        title: "title",
        anchor: "bottom",
        dy: -5,
        lineWidth: 12,
      }),
    ],
  });
};

/**
 * Plot a dot chart with X=m and Y=power, with the points that are isolated peaks highlighted
 * @param {number} delta The ±m neighborhood where no higher values should exist
 * @param {number} minAllowedDensity Points below this density will never be considered even if they're the highest in their neighborhood.
 */
export const plotPointsOfPeakPower = (delta = 0.3, minAllowedDensity = 40) => {
  const votesInfoPerSampleAndPeaks = votesInfoPerSample
    .map((sample, i) => ({
      ...sample,
      isPeak:
        !votesInfoPerSample.some(
          (x, j) =>
            i != j &&
            Math.abs(sample.m - x.m) <= delta &&
            x.voterPower > sample.voterPower,
        ) && sample.voterDensity >= minAllowedDensity,
    }))
    .filter((x) => x.voterPower > 1000);

  return Plot.plot({
    opacity: { domain: [false, true], range: [0.8, 1] },
    r: { domain: [false, true], range: [1, 3] },
    color: { domain: [false, true], range: ["skyblue", "red"], legend: true },
    x: { type: "symlog", constant: 0.2 },
    y: { type: "log" },
    marks: [
      Plot.crosshair(
        votesInfoPerSampleAndPeaks.filter((x) => x.isPeak),
        {
          x: "m",
          y: "voterPower",
          textFill: "isPeak",
        },
      ),
      Plot.ruleY(votesInfoPerSampleAndPeaks, {
        x1: ({ m }) => m - delta,
        x2: ({ m }) => m + delta,
        stroke: "red",
        y: "voterPower",
        filter: "isPeak",
        marker: "tick",
      }),
      Plot.dot(votesInfoPerSampleAndPeaks, {
        x: "m",
        y: "voterPower",
        stroke: "isPeak",
        strokeOpacity: "isPeak",
        sort: "isPeak",
        r: "isPeak",
      }),
    ],
  });
};

export const peaksInfo = votesInfoPerSample
  .map((sample, i) => ({
    ...sample,
    isPeak:
      !votesInfoPerSample.some(
        (x, j) =>
          i != j &&
          Math.abs(sample.m - x.m) <= PEAK_DETECTION_LOOKAROUND &&
          x.voterPower > sample.voterPower,
      ) && sample.voterDensity >= PEAK_DETECTION_MIN_DENSITY,
  }))
  .filter((x) => x.voterPower > 1000)
  .filter(({ isPeak }) => isPeak);
export const overlaps = peaksInfo.flatMap((peak, i) =>
  peaksInfo
    .filter(
      (peak2, j) =>
        i != j &&
        peak.startTime <= peak2.startTime &&
        peak.endTime >= peak2.endTime &&
        peak.voterPower >= peak2.voterPower,
    )
    .map((peak2) => ({
      big: peak,
      small: peak2,
      x1: (peak.startTime + peak.endTime) / 2,
      x2: (peak2.startTime + peak2.endTime) / 2,
      y1: peak.voterPower,
      y2: peak2.voterPower,
    })),
);
export const peaksInfoNoOverlaps = peaksInfo.filter(
  (peak) =>
    !overlaps.some(
      ({ small }) =>
        (small.startTime == peak.startTime) & (small.endTime == peak.endTime),
    ),
);

export const plotEncompassedSpans = () => {
  return Plot.plot({
    x: { type: "utc" },
    y: { type: "sqrt" },
    marks: [
      Plot.ruleY(peaksInfo, {
        x1: "startTime",
        x2: "endTime",
        // stroke: "red",
        y: "voterPower",
        marker: "tick",
        sort: "voterPower",
      }),
      Plot.dot(peaksInfo, {
        x: ({ startTime, endTime }) => (startTime + endTime) / 2,
        y: "voterPower",
        // stroke: "red",
        tip: true,
        title: ({ startTime, endTime }) =>
          `${new Date(startTime).toISOString().substring(0, 10)} → ${new Date(endTime).toISOString().substring(0, 10)}`,
        // channels: { x1: "x1", x2: "x2" },
      }),
      Plot.ruleX(peaksInfo, {
        x: "startTime",
        y: "voterPower",
        stroke: "red",
        strokeOpacity: 0.5,
        strokeDasharray: "3,5",
      }),
      Plot.ruleX(peaksInfo, {
        x: "endTime",
        y: "voterPower",
        stroke: "red",
        strokeOpacity: 0.5,
        strokeDasharray: "3,5",
      }),
      Plot.arrow(overlaps, {
        x1: "x1",
        x2: "x2",
        y1: "y1",
        y2: "y2",
        stroke: "red",
        strokeWidth: 1,
        inset: 1,
      }),
    ],
  });
};

export const plotFinalSolutions = (width) =>
  Plot.plot({
    width,
    x: { type: "utc" },
    marks: [
      Plot.text(peaksInfoNoOverlaps, {
        x: "startTime",
        y: ({ m, b, startTime }) => (m * startTime) / X_CONVERSION_FACTOR + b,
        text: ({ m, b }) =>
          `y = ${m.toFixed(2)}x${b > 0 ? "+" : ""}${b.toFixed(1)}`,
        textAnchor: "start",
        dx: 7,
        dy: 7,
        fill: "darkred",
      }),
      Plot.dot(data, { x: "Time", y: "water_level_masl", r: 1 }),
      Plot.link(peaksInfoNoOverlaps, {
        x1: "startTime",
        x2: "endTime",
        y1: ({ m, b, startTime }) => (m * startTime) / X_CONVERSION_FACTOR + b,
        y2: ({ m, b, endTime }) => (m * endTime) / X_CONVERSION_FACTOR + b,
        stroke: "red",
        strokeWidth: 2,
        marker: "dot",
      }),
    ],
  });
