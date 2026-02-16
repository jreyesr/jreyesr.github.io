---
theme: [cotton, sun-faded, wide]
toc: false
dashboard: true
---

```js
import { plotRotationVsVoltage,
  plotAlpsOld, plotAlpsNew, plotAlpsLinear, tenk_linear, log_taper,
  plotAlpsOldAsRes, plotAlpsNewAsRes,
} from './charts.js'
```

Old (non-functioning) pedal potentiometer:

```js
plotAlpsOld()
```

New pedal potentiometer, fresh from Mouser:

```js
plotAlpsNew()
```

Another Alps potentiometer, linear, nothing special:

```js
plotAlpsLinear()
```

A generic 10K linear potentiometer, no brand:

```js
plotRotationVsVoltage(tenk_linear)
```

A generic 10K log-taper ("audio") potentiometer, no brand:

```js
plotRotationVsVoltage(log_taper)
```

Computed resistance by putting a leg of the potentiometer as a voltage divider with a fixed 1k (nominal) resistor.

Old pedal pot:

```js
plotAlpsOldAsRes()
```

New pedal pot:

```js
plotAlpsNewAsRes()
```
