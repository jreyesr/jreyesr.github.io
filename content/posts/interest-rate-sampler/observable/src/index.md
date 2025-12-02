---
theme: [cotton, sun-faded, wide]
toc: false
dashboard: true
---

```js
import {
  data_361d, data_full, sampling_361d,
  interestFunctionAtTime, interestFunctionAtCapital,
  basicPlot, gridPlot, plotSampling1D, fullPlot, plotProgress,
  Scrubber,
} from './charts.js'
```

# Step function discovery through minimal adaptive sampling

This is the interest function when sampled in the simplest way possible, i.e. at fixed intervals (every \$3K and 90 days), on somewhat of a grid:

```js
gridPlot()
```

## 1D slice at fixed time

This is the interest currently paid for investments made on a 500-day term, as scanned from $100 (the minimum possible) to $1M (not the maximum possible, but still quite high for most people's financial state):

```js
basicPlot()
```

Notice how the interest jumps at "round" amounts of capital, such as the first jump being at $1K exactly, and the second one at $2.5K.

## Full sample space

The plot above is just a slice on the actual 2D function, fixing the interval to 500 days and varying the capital invested. The true function looks more like the one below, a 2D surface with colors denoting interest rates. We can take slices at different X and Y values to see the interest rates that would be paid for money locked for different amounts of capital or days, respectively.

```js
fullPlot(days, capital)
```

The plots below show the interest rates for ${Inputs.bind(html`<input type=range style="width: 120px; accent-color: red" min=31 max=720>`, daysInput)} ${days} days ↕ (left plot) or when investing $<span style="white-space-collapse: preserve; display: inline-block; min-width: 4em; text-align: end">${capital}</span> ${capitalInput} ↔ (right plot). Notice that the red and blue line on the main plot move around in sync with these sliders, showing where the slices are being taken:

```js
const numberInput = Inputs.input(0);
const number = Generators.input(numberInput);

const capitalInput = Inputs.range([100, 1e6], {step: 10, value: 45000, transform: Math.log, width: 60})
capitalInput.number.style.cssText += "display: none"
capitalInput.style.cssText += "display: inline"
capitalInput.range.style.cssText += "max-width: 120px"
capitalInput.range.style.cssText += "accent-color: blue"
capitalInput.range.parentNode.style.cssText += "display: inline"
const capital = Generators.input(capitalInput);

const daysInput = Inputs.input(500);
const days = Generators.input(daysInput);
```

```js
const fixedDaysData = interestFunctionAtTime(days)
const fixedDaysPlot = Plot.plot({
  marks: [
    Plot.lineY(fixedDaysData, {x: "capital", y: "interest_rate"}),
    Plot.crosshairX(fixedDaysData, {x: "capital", maxRadius: 2000}),
    Plot.tip(fixedDaysData, Plot.pointerX({x: "capital", y: "interest_rate", maxRadius: 2000})),
    Plot.axisX({color: "red"}),
    Plot.ruleY([3], {stroke: "red", strokeWidth: 2})
  ],
  x: {type: "log", label: "Capital (USD)"},
  y: {label: "Yearly interest (%)", domain: [3, 6]}
})

const fixedCapitalData = interestFunctionAtCapital(capital)
const fixedCapitalPlot = Plot.plot({
  marks: [
    Plot.lineX(fixedCapitalData, {x: "interest_rate", y: "days"}),
    Plot.crosshairY(fixedCapitalData, {y: "days", maxRadius: 2000}),
    Plot.tip(fixedCapitalData, Plot.pointerY({y: "days", x: "interest_rate", maxRadius: 2000})),
    Plot.axisY({color: "blue"}),
    Plot.ruleX([3], {stroke: "blue", strokeWidth: 2})
  ],
  x: {label: "Yearly interest (%)", domain: [3, 6]},
  y: {label: "Duration (d)", domain: [0, 720]},
})

display(html`<div class="grid grid-cols-2">
  <div class="card">${fullPlot(days, capital)}</div>
  <div class="card">${fixedDaysPlot}</div>
  <div class="card">${fixedCapitalPlot}</div>
  <div></div>
</div>`)
```

## Smart Sampling in 1D

First, let's look at the simple 1D case where the number of days is fixed. The real function is plotted below, but we don't know that yet:

```js
plotSampling1D()
```

```js
const samplePoint = 15000;
const sampleInterest = data_361d.find(({capital}) => capital >= samplePoint).yearly_interest_rate
```

The only valid operation is to "sample" at a particular point, such as here at $${samplePoint}, which will return that the interest at that point is ${sampleInterest}%:

```js
plotSampling1D({marks: [
  Plot.ruleX([samplePoint]),
  Plot.dot([[samplePoint, sampleInterest]], {x: "0", y: "1", symbol: "times", stroke: "var(--theme-foreground-focus)", r: 5}),
  Plot.tip(["Sample!"], {x: samplePoint, y: sampleInterest, fillOpacity: 1, anchor: "bottom-right"}),
]})
```

Initially, we sample at the two endpoints of the range, $100 and $1M. These will provide the initial information to start the search:

```js
plotProgress(2, 2)
```

They are not the same value, so there must be at least one step, somewhere between the two. For lack of a better alternative, sample right in the middle of the two options, rounded to the nearest thousand (note that since the X axis is logarithmic the middle number isn't visually in the middle):

```js
plotProgress(3, 1)
```

The upper range ($500K to $1M) now has the same value between start and end, therefore there are no steps in there. Any/all steps must be in the lower range ($100 to $500K). We continue sampling there by once again splitting near the middle:

```js
plotProgress(5, 1)
```

It's still the same value on the upper interval ($250K to $500K), so no steps there. Split the lower interval ($100 to $250K) again:

```js
plotProgress(8, 1)
```

and again:

```js
plotProgress(11, 1)
```

Now we finally have a different situation. There are steps to both sides of the point that was just sampled ($100-$70K and also $70K-$130K). We start on the upper side:

```js
plotProgress(14, 1)
```

The lower interval is constant and so can be left alone. Now for the interval $100K-$130K:

```js
plotProgress(17, 2)
```

On sampling again, we encounter our first guaranteed boundary, because the interest at $100K has one value, and at $100K + 1 has another value. Therefore, that's exactly where the step is (when confining ourselves to integers).

At this point, the entire range from $70K to $1M is already locked down and fully known. Continue with the lower part ($100-$70K) that is still unknown:

```js
plotProgress(20, 1)
```

Another step, so we repeat on both sides, starting with the upper side ($40K-$70K):

```js
plotProgress(23, 2)
```

There's still a small unknown region on $50K-$70K, so sample there again:

```js
plotProgress(26, 2)
```

Another boundary is found, this time at $50K and $50K + 1.

This cycle continues until the entire range has been explored. Here's a slider so you can see how the search progresses:

```js
const frameNumbers = Array.from({length: sampling_361d.length}, (_, i) => i).slice(2)

const maxStep = view(Scrubber(frameNumbers, {autoplay: false, initial: frameNumbers.length - 1, loopDelay: 2000, delay: 200, format: () => ""}))
```

${frameNumbers.length} steps
```js
plotProgress(maxStep, 1)
```

We've managed to scan a very large interval (from $100 to $1M, so almost a million possible values) in just ${sampling_361d.length} samples (and even some of those are redundant, but it simplifies the algorithm a lot). Everything else comes for free, since we can cover very large spaces with just a start and an end point, as long as both have the same interest. For example, the entire upper half of the range ($500K to $1M) is entirely defined by those two points, which have the same interest and thus imply that every other point between them also has the same interest.

## Not-Twice-As-Smart Sampling in 2D

It should be possible to apply another layer of the same sampling technique to a second dimension (here, the number of days), but doing so isn't trivial and it isn't possible to reuse the same exact algorithm. For this particular task I just found the endpoints of the different duration brackets, so the 2D sampling reduces to a sequence of 1D samplings.

As an optimization, it's possible to reuse the endpoints discovered in the first 1D sampling (for a certain fixed time) on the second sampling (for another time). Ideally, the endpoints for time and for capital are independent, so the second (and further) sampling should reuse the same ones. If this is followed exactly (as is indeed the case), then the second and further samplings will never have to "search around" for their breakpoints, because the endpoints that come from previous samplings will instantly fill the entire domain.

```js
const samplingAll = await FileAttachment('data/sampling_all.csv').csv({typed: true})
const samplingAllUpTo = (n) => samplingAll.slice(0, n)

```

```js
const allFrameNumbers = Array.from({length: samplingAll.length + 1}, (_, i) => i)

const maxStepAll = view(Scrubber(allFrameNumbers, {autoplay: false, loop: false, delay: 50, format: (step) => `Sample #${step + 1}`}))
```

```js
Plot.plot({
  marks: [
    maxStepAll === samplingAll.length ? undefined : Plot.dot([samplingAll[maxStepAll]], {x: "capital", y: "days", stroke: "var(--theme-foreground-focus)", symbol: "times", r: 5}),
    Plot.dot(samplingAllUpTo(maxStepAll), {x: "capital", y: "days", stroke: "yearly_interest_rate", tip: true}),
  ],
  x: {type: "log", domain: [100, 1e6], label: "Capital (USD)"},
  y: {domain: [0, 720], label: "Duration (d)"},
  color: {legend: true, domain: [3, 6], label: "Yearly interest rate (%)"}
})
```

Notice how the first 1D sampling, here done for 31 days at the bottom, has many more points than the others. This is because on this one it was necessary to do the search procedure in order to find the actual endpoints of each bracket. Every other Y value can then reuse those endpoints to speed up the sampling. In fact, it takes 102 samples to fill the 31-day line, whereas every other day value takes just 20 samples.
