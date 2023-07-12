---
title: "Steampipe, Part Five: Caching"
date: 2023-04-19T20:36:23-05:00
tags: ['steampipe', 'open-source']
categories: ['go', 'sql']
toc: true
---

In this short article, we'll explore the caching facilities available to a [Steampipe](https://steampipe.io/) plugin.

<!--more-->

This is another article in the [Steampipe series](/tags/steampipe/). See the previous articles for an introduction to Steampipe, why you'd want to use it, and more!

## Introduction, motivation

Steampipe contains a query cache. This cache is crucial to the efficiency of Steampipe: without it, every SQL query would involve one API call[^1], thus slowing down the queries and (potentially) burning more of your limited API quota.

Said cache does not seem to be mentioned in the docs, at least in the part that you'd read as a Steampipe user. It Just Works (TM), most of the time. It can, however, be tweaked slightly. The purpose of this article is to explore the Steampipe caching mechanisms, to document them (as implemented at the time the article comes out) and to serve as a reference for Steampipe users and developers (i.e., people who develop Steampipe plugins, not the developers _behind_ Steampipe. They certainly know all that is described here and much more). Hopefully, this article serves as a useful reference for the parts that the Steampipe docs don't cover (or, at least, that I couldn't find).

## Cache the First: The query cache

For reference, here's the [blog post](https://steampipe.io/blog/release-0-2-0#blazing-fast-query-response-with-new-query-caching) that introduced query caching.

The main cache that you'll find when you look for caching in Steampipe is the query cache. This cache can be enable and disabled from the Steampipe query client (`steampipe query`), by running `.cache on` and `.cache off`, respectively. Note that you can't run these commands from a DB client such as pgAdmin or DBeaver; you _must_ use the Steampipe CLI.

The cache can be cleared by running the command `.cache clear` too.

These commands are documented [here](https://steampipe.io/docs/reference/dot-commands/cache#cache).

Now, how does the cache work?

### Peeking into the cache

First, start tailing the log files:

```bash
$ tail -f ~/.steampipe/logs/
(leave this open)
```

Once the log files are being monitored, we can start Steampipe and run some queries.
Before that, we'll need to raise the verbosity of Steampipe's logs. By a lot.

I'll assume that the Steampipe instance has the `steampipe` plugin installed. Otherwise, run `steampipe plugin install steampipe` beforehand. This plugin exposes the information that is on the Steampipe Hub: published plugins and their versions, along with some dates. It's not much, but it requires no setup and is used by Steampipe in their Getting Started guide too.

```bash
$ export STEAMPIPE_LOG_LEVEL=TRACE
$ steampipe query
Welcome to Steampipe v0.18.6
For more information, type .help
> .timing on
> select * from steampipe_registry_plugin limit 5
+----------------------------+---------------------------+---------------------------+---------------------------------+
| name                       | create_time               | update_time               | _ctx                            |
+----------------------------+---------------------------+---------------------------+---------------------------------+
| francois2metz/freshping    | 2023-01-25T15:26:48-05:00 | 2023-01-25T15:28:15-05:00 | {"connection_name":"steampipe"} |
| ellisvalentiner/confluence | 2022-01-11T22:41:02-05:00 | 2022-10-14T11:20:59-05:00 | {"connection_name":"steampipe"} |
| francois2metz/airtable     | 2021-10-24T19:41:45-05:00 | 2023-01-06T08:48:06-05:00 | {"connection_name":"steampipe"} |
| francois2metz/baleen       | 2022-06-15T04:59:37-05:00 | 2022-09-01T10:38:47-05:00 | {"connection_name":"steampipe"} |
| ellisvalentiner/weatherkit | 2022-08-29T16:47:24-05:00 | 2022-10-14T11:18:33-05:00 | {"connection_name":"steampipe"} |
+----------------------------+---------------------------+---------------------------+---------------------------------+

Time: 1.1s. Rows fetched: 5. Hydrate calls: 0.

> select * from steampipe_registry_plugin limit 5
+----------------------------+---------------------------+---------------------------+---------------------------------+
| name                       | create_time               | update_time               | _ctx                            |
+----------------------------+---------------------------+---------------------------+---------------------------------+
| francois2metz/freshping    | 2023-01-25T15:26:48-05:00 | 2023-01-25T15:28:15-05:00 | {"connection_name":"steampipe"} |
| ellisvalentiner/confluence | 2022-01-11T22:41:02-05:00 | 2022-10-14T11:20:59-05:00 | {"connection_name":"steampipe"} |
| francois2metz/airtable     | 2021-10-24T19:41:45-05:00 | 2023-01-06T08:48:06-05:00 | {"connection_name":"steampipe"} |
| francois2metz/baleen       | 2022-06-15T04:59:37-05:00 | 2022-09-01T10:38:47-05:00 | {"connection_name":"steampipe"} |
| ellisvalentiner/weatherkit | 2022-08-29T16:47:24-05:00 | 2022-10-14T11:18:33-05:00 | {"connection_name":"steampipe"} |
+----------------------------+---------------------------+---------------------------+---------------------------------+

Time: 3ms. Rows fetched: 5 (cached). Hydrate calls: 0.
> 
```

Then, we can look at the log files:

```
(this was emitted on the first query)
...
2023-04-20 01:56:02.262 UTC [INFO]  steampipe-plugin-steampipe.plugin: [INFO]  1681955762236: cacheEnabled, trying cache get (steampipe-1681955762236)
2023-04-20 01:56:02.262 UTC [INFO]  steampipe-plugin-steampipe.plugin: [INFO]  1681955762236: CACHE MISS
2023-04-20 01:56:02.262 UTC [INFO]  steampipe-plugin-steampipe.plugin: [INFO]  1681955762236: queryCacheGet returned CACHE MISS (steampipe-1681955762236)
...
(this was emitted on the second query)
...
2023-04-20 01:58:39.626 UTC [INFO]  steampipe-plugin-steampipe.plugin: [INFO]  16819559194: cacheEnabled, trying cache get (steampipe-16819559194)
2023-04-20 01:58:39.626 UTC [INFO]  steampipe-plugin-steampipe.plugin: [INFO]  16819559194: CACHE HIT
2023-04-20 01:58:39.626 UTC [INFO]  steampipe-plugin-steampipe.plugin: [INFO]  16819559194: queryCacheGet returned CACHE HIT (steampipe-16819559194)...
...
```

I've only displayed the lines that look important. There's a cache miss in the first part, which is not surprising since that was the first query. Then, the second query did have a cache hit.

Also, you can see the effect of the cache in the timing information. The first call took 1.1 seconds, a perfectly normal time for a remote API. The second call, on the other hand, took 3 *milli*seconds, i.e., essentially instantaneous. That's the cache detecting that it has enough information to fulfill the request, and entirely bypassing the remote API.

### Cache reuse

What if we now want 10 elements instead of 5?

```sql
> select * from steampipe_registry_plugin limit 10
(data...)

Time: 1.2s. Rows fetched: 10. Hydrate calls: 0.
```

Nope. No caching for you. (We can see that because the request again took over a second). That's to be expected, as the cache doesn't have enough information (remember, it has 5 elements) and thus has to query the API again. Let's try 7 elements now:

```sql
> select * from steampipe_registry_plugin limit 7
(data...)

Time: 28ms. Rows fetched: 10 (cached). Hydrate calls: 0.
```

It's cached! It served the results from the 10 results that it had cached above. This already tells us something useful about the cache: it's not a simple cache keyed by the literal SQL statement. It "understands" that `SELECT * LIMIT 10` has enough data to satisfy `SELECT * LIMIT 7`. Nice!

What about selecting less columns?

```sql
> select name from steampipe_registry_plugin limit 7
(data...)


Time: 21ms. Rows fetched: 10 (cached). Hydrate calls: 0.
```

No surprises here. Again, `SELECT *` has enough data to also satisfy `SELECT one_column`, so if you do them in that order the second query will be served from cache.

### Discoveries

So, to summarize: Steampipe caches query results and attempts to serve them before calling the remote API. The cache is aware of both row and column subsets:

* If you request a subset of columns (such as calling `SELECT *` and later `SELECT one_column`), while keeping the `WHERE` conditions constant, the cache will look for the original results (which have more columns) and then return only the required columns.

* If you request a subset of rows/records (such as calling `SELECT *` and later `SELECT * WHERE some_condition`), the results will be served from the cache too.

* A combination of the above also works.

## Configuring the cache: global, per connection

By default, Steampipe caches all results for 5 minutes (300 seconds). You may wish to change this parameter, either to increase it or to lower it:

* Lower it: rapidly changing data, fast APIs, no/generous API quotas, need for fresh data.

* Raise it: fairly static data, slow/resource-limited APIs, strict API quotas and rate limits, if you can tolerate stale data.

Don't ask what happens when you need fresh data from a rapidly changing source that has strict API quotas and a slow server...

This cache duration (also called TTL, for Time To Live) can be configured both globally and for a single connection. 

The former is achieved by editing the Steampipe config file, which (on a native installation for Linux) should be on `~/.steampipe/config/default.spc`:

```hcl
options "connection" {
  cache     = true # true, false
  cache_ttl = 300  # expiration (TTL) in seconds
}
```

Previously, it was possible to configure the cache through environment variables, but those are deprecated now.

What is somewhat more exotic is the configuration of TTL for a single connection. As a reminder, a connection is an instantiation of a plugin. For instance, you can have the AWS plugin, and multiple connections, each with their own credentials. This is especially interesting, since you may have different data sources in your Steampipe server, and a single knob for adjusting the server-wide TTL may be too coarse for your needs.

To configure the TTL for a single connection, you need to provide those options in the connection's config file, which should be called something like `~/.steampipe/config/pluginname.spc`. Here we demonstrate it with the VirusTotal plugin, which has somewhat stingy API quotas:

```hcl
connection "virustotal" {
  plugin = "virustotal"

  # Sign up at VirusTotal for your free API key
  # https://support.virustotal.com/hc/en-us/articles/115002100149-API
  # api_key = "beec40da46647b5e31d5377af470c0c525fd4185fb14ed2d0b38a038718ae3bf"

  options {
    cache_ttl = 3600  # Cache these results for an hour
  }
}
```

Both of these configuration options are described in the [Steampipe docs](https://steampipe.io/docs/reference/config-files/options#example-top-level-connection-options), albeit in the boring Reference section that very few people will read :)

By making judicious use of this per-connection configuration, you can tweak data sources to make better tradeoffs between your API usage and data freshness.

## Cache the Second: Plugin cache

Hidden deep in the bowels of Steampipe, lurks a second cache. It's only spoken of in whispers, and it's called... _the plugin cache_.

Okay, it's not called that. It's not called anything. It's not in the docs (that I could find). You only find it by looking through some plugins or in code autocompletion.

This is a cache that you can use from plugin code. For whatever you want. The [Shodan plugin](https://github.com/turbot/steampipe-plugin-shodan/blob/5ea0be4f3b49483bb8f61f008a2129f1d1fd3e42/shodan/utils.go#L19) uses it to cache an API client struct, so as not to recreate it every time. This is because [the Shodan library](https://github.com/shadowscatcher/shodan) that the plugin uses has some internal rate limiting (one request per second), as can be seen at the end of the README. This is to comply with Shodan's terms of service. If a new client were created every time, no such throttling could be applied, since every client would know nothing about previous requests. Thus, the Shodan plugin reuses a single client.

What else could a plugin cache be used for?

* Keeping short-lived authentication tokens, (such as JWTs), so that there is no need to repeatedly call the [token endpoint](https://auth0.com/docs/authenticate/protocols/oauth#token-endpoint) and create multiple login events (in a OAuth2-like system)

* Some sort of memory across executions of the same plugin.

* Advanced caching, beyond what Steampipe provides. I imagine something like detecting more "important" rows and always fetching those from the API, while deferring some "less important" rows to the cache. Of course, then the question becomes how to know whether a row is "important".

### Usage

Side note: The Steampipe plugin cache is powered by [eko/gocache](https://github.com/eko/gocache), so refer to that package for more detailed docs.

```go
func myHydrateFunc(ctx context.Context, d *plugin.QueryData, h *plugin.HydrateData) (interface{}, error) {
    d.ConnectionCache.Set(
        ctx, 
        "mykey", 
        map[string]string{"foo": "bar"}, 
    )
    d.ConnectionCache.SetWithTTL(
        ctx, 
        "mykey", 
        map[string]string{"foo": "bar"}, 
        3*time.Hour
    )

    data d.ConnectionCache.Get(ctx, "mykey")
}
```

Inside a hydration function, you can use the `plugin.QueryData.ConnectionCache` object to save and retrieve data. This object has the following methods:

* `Get(context.Context, string)`, which retrieves a key from the cache. Like Go's `map`, it returns a tuple of the object and a `bool`, which you can use to test whether the key was found in the cache or not.

* `Set(context.Context, string, interface{})`, which inserts an element in the cache. **IMPORTANT:** While not documented, this element is inserted with a TTL ot one (1) hour.

* `SetWithTTL(context.Context, string, interface{}, time.Duration)`, which inserts an element in the cache with a specific TTL.

* `Delete(context.Context, string)`, which removes an element from the cache.

* `Clear(context.Context)`, which empties the cache.

These methods are somewhat similar to (part of) [the library's `StoreInterface`](https://github.com/eko/gocache#write-your-own-custom-store).

The `Set` methods take an `interface{}`, i.e. any object. The `Get` method also returns an `interface{}`, which you must typecast before using.

Sadly, there is no way to read the entire cache's state. Why you'd want to do that, I can't fathom, but you can't. Maybe that's good. The original package doesn't expose such a function, either.

### Accessing the actual cache, or: Extremely not-recommended. Warranty void if executed.

The `d.ConnectionCache` field, which you can access, is a thin wrapper around `cache.Cache`, provided by the [github.com/eko/gocache](https://github.com/eko/gocache) package. However, you can't directly access the raw cache object. As a fun aside, here's a way to access the internal cache object, should you ever need it.

Note that this method is completely not approved for any use, personal or commercial. The author takes no responsibility for any exploded computers, missing cables or reversed time flow that happens after running the code below (or before, since reversed time flow would mean that effects may happen _before_ you actually run the code)

```go
func myHydrateFunc(ctx context.Context, d *plugin.QueryData, h *plugin.HydrateData) (interface{}, error) {
    // WARNING: Don't execute! This will eat your lunch and then run away!
    rs := reflect.ValueOf(d.ConnectionCache).Elem()
    rf := rs.Field(1)
    val := reflect.NewAt(rf.Type(), unsafe.Pointer(rf.UnsafeAddr())).Elem().Interface().(*cache.Cache[any])
    plugin.Logger(ctx).Warn("messing about", "cache", reflect.TypeOf(val))
}
```

```
/home/reyes/.steampipe/logs/plugin-2023-04-20.log

2023-04-21 02:21:52.085 UTC [WARN]  steampipe-plugin-blockchain.plugin: [WARN]  1682043712731: messing about: cache="*cache.Cache[interface {}]"
```

Wait, what?

Turns out that Go has [its own conventions for (sort of) public and private fields](https://www.ardanlabs.com/blog/2014/03/exportedunexported-identifiers-in-go.html). Basically, only things that start with an UppercaseLetter can be accessed from outside the package. This is valid for type declarations (`type MyPublicType int`), functions (`func privateFunc()`), and struct fields (`struct { PublicField int; privateField int;}`). The actual cache object is an unexported field of `cache.Cache`, so it is not normally accesible.

However, such a separation is not completely enforced. It's made awkward enough that you shouldn't normally do it, but you can (with enough motivation) access private struct fields. Here's how to do it, courtesy of (as always) [StackOverflow](https://stackoverflow.com/a/60598827):

```go
import (
    "reflect"
    "unsafe"
)

var myStruct *connection.ConnectionCache
// Assume that myStruct holds a pointer to a ConnectionCache (the wrapper object)
rs := reflect.ValueOf(d.ConnectionCache).Elem()
rf := rs.Field(1)  // Access the second field (indexes are zero-based)
val := reflect.NewAt(rf.Type(), unsafe.Pointer(rf.UnsafeAddr())).Elem().Interface().(*cache.Cache[any])
// val is a *cache.Cache object
```

This uses the packages `reflect` and `unsafe`, both of which are Advanced Go material. After three magical lines, you get a pointer to a `cache.Cache` object from the [github.com/eko/gocache](https://github.com/eko/gocache) package.

Again: do _not_ run that code. It's bad. If you are sure you need it, think again. Repeat until you discover that you don't really need it. Because you don't.

_So why did you include it?_ Because why not. That's why.

Also, to show that private fields are not completely private. They are not to be used for hiding data inside a process. The same happens [in Java](https://www.geeksforgeeks.org/how-to-access-private-field-and-method-using-reflection-in-java/), [in Python](https://betterprogramming.pub/public-private-and-protected-access-modifiers-in-python-9024f4c1dd4), [in C#](https://stackoverflow.com/a/10862842) and [even (hackily) on C++](https://stackoverflow.com/a/8282638). I remember that I read somewhere (can't find the source, though) that encapsulation is not a security/defensive mechanism, it's just to help you (the programmer) write better code. You don't defend against your own binary.

Anyway, that was a fun detour. Now, back to Steampipe's caches.

### Back to caches

A few more things about the plugin cache, before we wrap up:

* It's per-connection. Different connections of the same plugin do NOT share caches.

* It's in-memory. That should mean that:
  
  * It's fast.
  
  * It's single-process only (which shouldn't matter, as Steampipe itself is single-process)
  
  * It shouldn't survive restarts of the Steampipe service (good for preventing people from implementing a durable storage solution there)

* It lets you save arbitrary Go objects, not only strings [as Redis does](https://redis.io/commands/set/), for example. This is because it's a memory cache only, and therefore there is no need to serialize and deserialize objects.

* When retrieving an object from the cache, it's your responsibility to typecast it back to its original type before using it (it comes ot of the cache as an `interface{}` object)

* You can set an expiration date on objects, but that will only be respected as long as the Steampipe server is not restarted.

## Recap

* Steampipe has a query cache that can be used to speed up responses and save some API quota by recording all data returned to the user and attemping to fulfill subsequent queries from that data, if possible.

* The cache query works automatically.

* The cache query can handle both column subsets (i.e., first running `SELECT *` and then `SELECT column1`) and row subsets (i.e., first running `SELECT *` and then `SELECT * WHERE condition`), and combinations of both.

* You can get some insights on whether the query cache is working or not by running `.timing on` in the Steampipe CLI. Short response times are an indicator of caching, and the timing output straight up tells you if the response was served from cache.

* Should you need it, the query cache can be cleared with `.cache clear` in the Steampipe CLI.

* The cache expiration time can be controlled both globally (for the entire server) and per-connection.

* There is a second hidden cache, available to plugin developers, accessible on the `plugin.QueryData` argument passed to hydration functions as `d.ConnectionCache`.

* This second cache is an in-memory cache, scoped to the specific connection (not the whole plugin!), from which you can set and retrieve arbitrary Go objects.

* The cache also supports automatic expiration of entries, configured at insertion time.

* While not documented, inserting an entry without specifying a TTL uses a TTL of one hour.

* As an example in which this plugin cache could be used, consider an [OAuth2 client credentials grant](https://www.oauth.com/oauth2-servers/access-tokens/client-credentials/). In this flow, the application exchanges some credentials (somewhat like an username and password) for an access token with a certain expiration time. This token is then used to access the actual resources. For some efficiency, it may be possible to cache the access token, as otherwise every request would necessitate another entire authentication request, which may be slow, raise security alerts and pollute login logs.

* You can (but shouldn't) access unexported struct fields in Go. Doing so requires some magic.

[^1]: Or multiple, in the case of queries that involve multiple [hydration functions](https://steampipe.io/docs/develop/writing-plugins#hydrate-functions) to fetch data.
