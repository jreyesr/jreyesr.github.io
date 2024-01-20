---
title: "Insomnia Plugin insomnia-plugin-batch-requests v1.3.0 launched!"
date: 2024-01-20T16:39:20.000-05:00
tags: ['open-source', 'announcements']
categories: ['react', 'nodejs']
toc: false
---

Hello! This is a quick post to announce that a new version of my [Insomnia plugin that sends repeated requests](https://github.com/jreyesr/insomnia-plugin-batch-requests) has been released: `v1.3.0` is now [available for download](https://github.com/jreyesr/insomnia-plugin-batch-requests/releases/tag/v1.3.0). It adds a way to send requests in parallel, useful to speed up large batches of requests as long as the remote API can handle it.

<!--more-->

## What's Changed

- Add option to send (up to) a certain number of batch requests in parallel
  ![a screenshot of the plugin's UI, which shows a number field titled "Parallel requests"](./images/parallel.png)

See two videos for a comparison: [only one request at a time](./images/1way.mp4) and [two requests at once](./images/2way.mp4). Notice how, on the parallel request video, the progress bar advances in jumps of 2 and data is also filled two-at-a-time on the Name column. 
