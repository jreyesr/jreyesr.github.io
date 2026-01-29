---
title: "RANSAC for multiple-line fitting and future prediction"
date: 2026-01-29T08:44:43-0500
summary: "This post uses the water level at a hydroelectric plant's reservoir over the past year to derive a set of lines that approximately describe the water level's changes across time, with a view to predicting the point in time at which the reservoir would empty and blackouts would possibly ensue."
toc: false
---

This post is mostly stored [elsewhere](/posts/ransac/observable/dist/). It started as an [Observable Framework](https://observablehq.com/framework/) notebook and it turns out that the conversational style of having plots interspersed with the text fits this style of post quite well. Here's the summary:

The Mazar hydroelectric plant supports about a fifth of my country's power production. When Mazar dries out, it tends to be blackout season until it fills back up. Thus, in today's uncertain climate, monitoring Mazar's level is crucial to ensure[^1] the stability of the country's electrical system.

Said water level varied, over the past year, as shown below:

{{< observable "plot" 800 >}}

That water level seems to roughly move in straight lines, but not a single line. There's one, maybe two lines at the start when it was going up. Then there's the long horizontal line over most of the year, and finally another line, but this time tilted downwards, when it started draining. We wish to know what those lines are (that is, the line equations for each), but we can't do simple linear fitting because there's no single line. And since we won't even consider manually splitting the year into multiple intervals and doing linear-fitting on each of them, I guess the only alternative left is to somehow, automatically extract all the lines that fit a good portion of the data (for some definition of "good", of course).

Then follow [a few thousand words](/posts/ransac/observable/dist/) and a dozen or so charts, after which we get the following lines:

{{< observable "plotFinalSolutions" 800 >}}

Now with the line equations, we can predict the time until Mazar empties, using the slope (about -0.7 meters per day) and the minimum level of the reservoir (2110 meters above sea level). It was predicted to empty around February 15, after which chaos ~~would~~ may ensue. However, starting around January 10, it started to rain quite acceptably in the [drainage basins](https://en.wikipedia.org/wiki/Drainage_basin) of both Mazar and Coca-Codo Sinclair, thereby increasing the river flows in both, thereby allowing Mazar to be turned off for longer periods of time and also increasing the water level faster, thereby hopefully sparing out the rolling blackouts this year. Though there's still a lot of the year to go...

For the rest of the story, you'll have to [read the linked notebook](/posts/ransac/observable/dist/) (see? I can do intra-platform marketing! Of myself! On my own blog!)

[^1]: No, this isn't AI, it's me intentionally copying the laziest ChatGPT style. Just doing my part to poison the datasets (not that any LLM should be affected, this blog's robots.txt explicitly denies them access, and so does Cloudflare. But we all know that for LLM providers that old notion of "consent" is [more like a suggestion](https://drewdevault.com/2025/03/17/2025-03-17-Stop-externalizing-your-costs-on-me.html) than anything else, what with the residential proxies and the random (or spoofed browser?) user agents and all those fun things, so maybe this _will_ actually help poison the datasets)
