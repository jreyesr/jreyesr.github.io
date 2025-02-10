---
title: "An analysis of presidential election results"
date: 2023-08-29T20:40:35-0500
summary: "In this article, we capture time-indexed partial results of Ecuador's recent presidential elections, we review ways of saving them, and we then explore the data. We observe the progression of results over time, we verify that results never stopped coming in, we characterize the time that an average station takes to count and report results, and we see just how few votes it took for the final results to be predictable."
tags: ['python', 'timescaledb']
categories: ['sql']
series: ['elections']
toc: true
---

Recently (2023-08-20), Ecuador had [early presidential elections](https://www.eluniverso.com/temas/elecciones-presidenciales-de-ecuador-de-2023/) (we had our ordinary ones on 2021-02, and we were supposed to wait until 2025-02 or so). Political events outside of the scope of this post (the name of which I don't know how to translate to English) caused both executive and legislative branches to cease and elections (for both of them) to be triggered. This provides us with an opportunity to capture data in the wild, and analyze it.

To be precise, I captured live election results, as votes were being counted, starting at about 18:00 (voting technically stops at 17:00, whereupon vote counting starts, but results may take an hour and a half to start trickling in, as we'll see later). Data capture went on until about 00:30 next day, at which point over 90% of votes had been counted. Then, I dumped that data into a form suited for time analysis, and then I... well, analyzed it. Stick around for some nice Grafana plots.

Constitutionally-mandated (not really) disclaimers: I'm writing this more or less as it happens. The webpage that I'll use technically displays preliminary results, yadda yadda. No official results are out yet.

Also, all times in this article are local times, GMT-5. That shouldn't mean anything, since we don't ever use timestamps on other timezones, but I did have to fight with the DB a bit, since it insisted on interpreting those timestamps as UTC. You may see the results of that on the SQL queries.

## Exploration

Our election authority has [a page where results can be checked live](https://elecciones.cne.gob.ec/) (here's a screenshot at 21:30, with ~63% votes counted):

![30a4f0f108275a9498949c38fe1986c2.png](./_resources/30a4f0f108275a9498949c38fe1986c2.png)

We're interested in the vote percentage for each candidate, and we want to capture the evolution of those percentages _over time_. That's one dataset that isn't officially provided, AFAIK, and it must be collected live: the only thing that you have when all votes have been counted is the final results, but no over-time progression. Once it's gone, it's gone forever. And we could probably plot some cool graphs with time-series data.

Now, historically there have usually been problems with data availability. Things like the results page being down, or at least intermittent. And, since this is the Internet we're talking about, those outages quickly snowball into fully-fledged fraud accusations, as one does. This time, however, I've detected precisely zero outages. We'll look at that, by the way. Incidentally, that was one of my objectives when doing this: I wanted to measure any potential outages. Do response times vary wildly? Does the page just give out? Or is it rock-solid, at least from my point of view?

That may be a reason why there is no official way of accessing the results for automatic consumption, only [that webpage](https://elecciones.cne.gob.ec/) and an [Android](https://play.google.com/store/apps/details?id=com.cne.servicioscne)/[iOS](https://apps.apple.com/ec/app/cne-app/id1512680607) app. None of those are really serviceable for data extraction, but the mobile apps will probably be even harder, so we'll focus on the web application.

## Extracting data from non-cooperative web applications

First things first, we have to explore [the web application](https://elecciones.cne.gob.ec/resultados/totales). It loads directly into the page that displays nation-wide results for presidential elections, which is good. If we had to fill a form or click buttons before data loaded, we'd be in trouble. That would call for [Selenium](https://www.selenium.dev/) or [one of its ilk](https://playwright.dev/).

However, as the page stands, you just visit it and results are handily provided to you:

![2c14389566e3095223b2fcd5a7216410.png](./_resources/2c14389566e3095223b2fcd5a7216410.png)

Let's peek at the requests that the page makes, via the browser's Developer Tools (F12 on both Chromiums and Firefox):

![dcb826e82931e27f8ba14caf0bbda3af.png](./_resources/dcb826e82931e27f8ba14caf0bbda3af.png)

We see the first page, and also several scripts, then some CSS, fonts, assorted assets (images, such as Ecuador's coat of arms, the election authority's logo and each candidate's picture), and also (near the end) three XHR requests. The first and third requests are boring requests that fill the dropdowns to the left of the page, which are used to further filter the results. The middle one, however, is extremely important:

```http
GET /certero-cne/api/v1/total-provincias?codDignidad=11&codProvincia=0 HTTP/2
Host: elecciones.cne.gob.ec
Pragma: no-cache
Cache-Control: no-cache
Sec-Ch-Ua: 
Accept: application/json, text/plain, */*
Sec-Ch-Ua-Mobile: ?0
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJhcHBsaWNhdGlvbjoiOiJjbmUiLCJpYXQiOjE2OTI1NzE5MDQsImV4cCI6MTY5MjU3MTk2NH0.wODXOYmWMf_OsXPuiTf6YKdgX1jiltRcQWTZcCDMaqI
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.97 Safari/537.36
Sec-Ch-Ua-Platform: ""
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
Referer: https://elecciones.cne.gob.ec/resultados/totales
Accept-Encoding: gzip, deflate
Accept-Language: en-US,en;q=0.9

HTTP/2 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 4354
Access-Control-Allow-Origin: *
X-Ratelimit-Limit: 10000000
X-Ratelimit-Remaining: 9999997
Date: Sun, 20 Aug 2023 22:51:44 GMT
X-Ratelimit-Reset: 1692572043
Content-Security-Policy: default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;font-src https://fonts.gstatic.com;base-uri 'self';block-all-mixed-content;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src-attr 'none';upgrade-insecure-requests
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
X-Dns-Prefetch-Control: off
Expect-Ct: max-age=0
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-Download-Options: noopen
X-Content-Type-Options: nosniff
Origin-Agent-Cluster: ?1
X-Permitted-Cross-Domain-Policies: none
Referrer-Policy: no-referrer
X-Xss-Protection: 0
Etag: W/"1102-623GvY+pUWHoxhsK0685sGOQ/+Q"
X-Kong-Upstream-Latency: 40
X-Kong-Proxy-Latency: 0
Via: kong/3.3.1

{
   "votos":[
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"CLARO QUE SE PUEDE",
         "nomCandidato":"YAKU PEREZ",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_1517.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"ACCIÓN DEMOCRÁTICA NACIONAL, ADN",
         "nomCandidato":"DANIEL NOBOA AZIN",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_1516.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"MOVIMIENTO POLÍTICO REVOLUCIÓN CIUDADANA",
         "nomCandidato":"LUISA GONZALEZ",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_207.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"ALIANZA POR UN PAÍS SIN MIEDO, LISTAS 6-3-1",
         "nomCandidato":"JAN TOPIC",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_1543.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"ACTUEMOS",
         "nomCandidato":"OTTO SONNENHOLZNER",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_1525.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"MOVIMIENTO AMIGO, ACCIÓN MOVILIZADORA INDEPENDIENTE GENERANDO OPORTUNIDADES",
         "nomCandidato":"BOLIVAR ARMIJOS",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_208.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"MOVIMIENTO CONSTRUYE",
         "nomCandidato":"FERNANDO VILLAVICENCIO",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_18.png"
      },
      {
         "codProvincia":-1,
         "codDignidad":11,
         "nomPartido":"MOVIMIENTO RENOVACIÓN TOTAL, RETO",
         "nomCandidato":"XAVIER HERVAS",
         "votos":0,
         "votosM":0,
         "votosF":0,
         "porcentajeF":0,
         "porcentajeM":0,
         "porcentaje":0,
         "iconCandidato":"F_226.png"
      }
   ],
   "actas":[
      {
         "codDignidad":11,
         "novedades":0,
         "totalActas":40776,
         "totalNovedades":0,
         "totalValidas":0,
         "validas":0,
         "codQrUuId":null,
         "huella":null
      }
   ],
   "sufragantes":[
      {
         "codDignidad":11,
         "sufragantes":0,
         "sufragantesM":0,
         "sufragantesF":0,
         "sufMPorc":0,
         "sufFPorc":0,
         "ausentismo":0,
         "ausentismoM":0,
         "ausentismoF":0,
         "ausMPorc":0,
         "ausFPorc":0,
         "sufPorc":0,
         "ausPorc":0
      }
   ],
   "blancos":[
      {
         "codDignidad":11,
         "blancos":0,
         "votosBlancosM":0,
         "votosBlancosF":0,
         "blancosMPorc":0,
         "blancosFPorc":0,
         "nulos":0,
         "votosNulosM":0,
         "votosNulosF":0,
         "nulosMPorc":0,
         "nulosFPorc":0,
         "blancosPorc":0,
         "nulosPorc":0
      }
   ],
   "corte":"2023-08-20T17:45:02.263Z",
   "electoresJunta":{
      "electores":[
         {
            "codDignidad":11,
            "codZona":0,
            "total":13450047,
            "totalHombres":6630590,
            "totalMujeres":6824213,
            "porcentajeHombres":141.26,
            "porcentajeMujeres":58.739999999999995,
            "totalJuntas":40776,
            "juntasHombres":20123,
            "juntasMujeres":20653,
            "porcentajeJuntasHombres":120.28999999999999,
            "porcentajeJuntasMujeres":79.71000000000001,
            "porcentaje":100,
            "porcentajeJuntas":100
         }
      ],
      "electoresPpl":[
         {
            "codDignidad":11,
            "codZona":0,
            "total":4756,
            "totalHombres":4375,
            "totalMujeres":381,
            "porcentajeHombres":91.99,
            "porcentajeMujeres":8.01,
            "totalJuntas":62,
            "juntasHombres":44,
            "juntasMujeres":18,
            "porcentajeJuntasHombres":70.97,
            "porcentajeJuntasMujeres":29.03,
            "porcentaje":0.04,
            "porcentajeJuntas":0.15
         }
      ],
      "totales":[
         {
            "codDignidad":11,
            "codZona":0,
            "total":13450047,
            "totalHombres":6630590,
            "totalMujeres":6824213,
            "porcentajeHombres":141.26,
            "porcentajeMujeres":58.739999999999995,
            "totalJuntas":40776,
            "juntasHombres":20123,
            "juntasMujeres":20653,
            "porcentajeJuntasHombres":120.28999999999999,
            "porcentajeJuntasMujeres":79.71000000000001,
            "porcentaje":100,
            "porcentajeJuntas":100
         }
      ]
   },
   "electoresJuntaComputada":{
      "electores":[
         {
            "codDignidad":11,
            "codZona":0,
            "porcentajeHombres":0,
            "porcentajeMujeres":0,
            "total":0,
            "totalHombres":0,
            "totalMujeres":0,
            "totalJuntas":0,
            "juntasHombres":0,
            "juntasMujeres":0,
            "porcentajeJuntasHombres":0,
            "porcentajeJuntasMujeres":0,
            "porcentaje":0,
            "porcentajeJuntas":0
         }
      ],
      "electoresPpl":[
         {
            "codDignidad":11,
            "codZona":0,
            "porcentajeHombres":0,
            "porcentajeMujeres":0,
            "total":0,
            "totalHombres":0,
            "totalMujeres":0,
            "totalJuntas":0,
            "juntasHombres":0,
            "juntasMujeres":0,
            "porcentajeJuntasHombres":0,
            "porcentajeJuntasMujeres":0,
            "porcentaje":0,
            "porcentajeJuntas":0
         }
      ],
      "totales":[
         {
            "codDignidad":11,
            "codZona":0,
            "porcentajeHombres":0,
            "porcentajeMujeres":0,
            "total":0,
            "totalHombres":0,
            "totalMujeres":0,
            "totalJuntas":0,
            "juntasHombres":0,
            "juntasMujeres":0,
            "porcentajeJuntasHombres":0,
            "porcentajeJuntasMujeres":0,
            "porcentaje":0,
            "porcentajeJuntas":0
         }
      ]
   }
}
```

In particular, the `$.votos` field (in [JSONPath syntax](https://jsonpath.com/)) contains the votes for each candidate (`@.nomCandidato`), along with its party [^1] (`@.nomPartido`), the absolute count and percentage of votes (`@.votos` and `@.porcentaje`, respectively), and even breakdowns by sex (`@.votosM` and `@.votosF` for male and female, respectively). The latter aren't surfaced in the web app.

There's also more information:

* About the voting stations[^2], each of which must produce a single report. Those are in `$.actas`, split by total, valid and "with issues" (which means that vote counts don't match, either between themselves or with the expected values)
* Total voter counts, in `$.sufragantes`. There's the total count of people who _have voted_ `$.sufragantes.sufragantes`, split by male/female (`$.sufragantes.sufragantesM` and `$.sufragantes.sufragantesF` resp.), people who have been confirmed to not have voted (because their stations have already reported so) in `$.sufragantes.ausentismo`, its corresponding split by male/female, and percentages of all of the above, against the total electoral roll
* Information about empty and annulled votes[^3] in `$.blancos`. The usual metrics: count, split by male and female, and percentages against total voter population
* The cutoff date for this data, in `$.corte`
* Information about voting stations, in `$.electoresJunta`. As usual, number of stations, split by male and female, and percentages thereof (which seem to me to total 200% for some reason)
* Information about which stations have already reported data[^4], in `$.electoresJuntaComputada`. Same data as above, but now they won't add up to 100% until the end

So now we have a nice JSON document with all the data that we'd ever want. However, it's not as easy as just `curl`ing to `https://elecciones.cne.gob.ec/certero-cne/api/v1/total-provincias?codDignidad=11&codProvincia=0`, as that causes an error:

![45c2c30cd23e39bef19684286ab5e2a6.png](./_resources/45c2c30cd23e39bef19684286ab5e2a6.png)

Authorization is required, huh? Indeed, we can see that the web application sets an  `Authorization` header on that request:

![dc4eb51a032e91afc12b674089894f10.png](./_resources/dc4eb51a032e91afc12b674089894f10.png)

That's [a JWT](https://jwt.io/), instantly recognizable because it starts with `eyJ`. Let's [decode it!](https://jwt.io/#debugger-io):

![2ea76d5f25971734b1d9b43504374d62.png](./_resources/2ea76d5f25971734b1d9b43504374d62.png)

That holds almost no data, actually. The `iat` and `exp` fields are the start and end dates, respectively, at which that JWT is valid. And they're only one minute apart.

The web application must generate them somehow, but I didn't feel like reverse engineering it to find out how. Besides, we have an easier way...

## The Snooper

Since the application doesn't want to cooperate, let's just keep using the web application itself, since it kindly generates authentication tokens for us already. We just need to capture the data as it travels over the network.

The Developer Tools are nice and all, but it's not easy to export just some requests. I tried, but images make up the bulk of the data, if you ever try to export it. I estimated that a few hours of data would produce a file well in the gigabyte range, and that becomes unwieldy later: you can't just read the file into memory and parse it as JSON, and you have to start thinking big. Which I didn't want to do. We can use a proxy instead, since it can intercept HTTPS-protected requests and (hopefully) export them.

In the past, I [used PolarProxy](/posts/spying-the-spy-part-three/#polarproxy) to snoop on another non-cooperative application. That time it was an installed Ubuntu application, which is far more difficult to intercept, since you can't usually reconfigure its networking parameters, and you instead need to change its network without the application noticing.

This time, however, it's a web application, and we have many more tools at our disposal. In particular, we have [Burp by PortSwigger](https://portswigger.net/burp), a set of tools for web security testing. One of those tools, [Burp Proxy](https://portswigger.net/burp/documentation/desktop/tools/proxy), lets you [launch a Chrome-based browser](https://portswigger.net/burp/documentation/desktop/getting-started/intercepting-http-traffic) that is already configure so _all_ its traffic (even, and especially, its HTTPS traffic) is relayed through Burp. Burp will generate a fake (self-signed) HTTPS certificate, which the Burp browser is already configured to trust, so no certificate warnings appear. Thus, Burp can decrypt and reencrypt traffic that is flowing between the browser and the remote server, and also save a copy in between:

![a66d4a5e2ceb8b474da05be8c67450e0.png](./_resources/a66d4a5e2ceb8b474da05be8c67450e0.png)

In other words, Burp just convinces your browser to accept a fake CA. This lets it decrypt requests (which can only be decrypted by the owner of the private key whose public key is in the certificate that the web page presents, i.e. normally only the owner of the domain). Burp decrypts the request, saves a copy, then establishes _its own_ TLS session with the actual server (this time using the correct cert, presented by the server), forwards the request, receives the response, saves a copy, and then forwards it to the client who was waiting this whole time. You get a nice GUI in which you can inspect requests and responses, filter them, and export them. You could also, if you were so inclined, [modify requests before they went to the server](https://portswigger.net/burp/documentation/desktop/getting-started/modifying-http-requests), but we don't have to do that here; we just need to look at the data.

To reduce the amount of data collected, I configured the scope so it only recorded that specific URL:

![b827b3ece9285b6e7c4ea821dc9c4fe6.png](./_resources/b827b3ece9285b6e7c4ea821dc9c4fe6.png)

Then, after lauching the Burp browser and navigating to the results page, we're greeted by this:

![69529537faf8cef01aa15ab697d84497.png](./_resources/69529537faf8cef01aa15ab697d84497.png)

That's just what we want: every single request to `https://elecciones.cne.gob.ec/certero-cne/api/v1/total-provincias?codDignidad=11&codProvincia=0`, and also every response. Nothing more.

Then, for maximum jank, let's cause that webpage to be refreshed periodically in the laziest way possible:

![e5e0c04d1e4e16e506d34dddac8e8166.png](./_resources/e5e0c04d1e4e16e506d34dddac8e8166.png)

Yes, an auto-refresh extension. It's literally the first result when you search for `refresh` in the Chrome Web Store. That's it. It's configured to fire off a refresh every two minutes. That's it. Then, a few hours of waiting.

Once enough data has been collected (or, to be more precise, once it was too late and I really had to go to sleep), we can just Select All, right-click and dump all that data to disk, which Burp supports natively:

![cac2ea2ec11f69a4eb9c6e2f363f04a5.png](./_resources/cac2ea2ec11f69a4eb9c6e2f363f04a5.png)

The data is saved as a single XML file.

## The XML file

Burp can [save the Proxy history](https://portswigger.net/burp/documentation/desktop/tools/proxy/http-history) as an XML file. Here's a snippet of the file:

```xml
<?xml version="1.0"?>
<!DOCTYPE items [
<!ELEMENT items (item*)>
<!ATTLIST items burpVersion CDATA "">
<!ATTLIST items exportTime CDATA "">
<!ELEMENT item (time, url, host, port, protocol, method, path, extension, request, status, responselength, mimetype, response, comment)>
<!ELEMENT time (#PCDATA)>
<!ELEMENT url (#PCDATA)>
<!ELEMENT host (#PCDATA)>
<!ATTLIST host ip CDATA "">
<!ELEMENT port (#PCDATA)>
<!ELEMENT protocol (#PCDATA)>
<!ELEMENT method (#PCDATA)>
<!ELEMENT path (#PCDATA)>
<!ELEMENT extension (#PCDATA)>
<!ELEMENT request (#PCDATA)>
<!ATTLIST request base64 (true|false) "false">
<!ELEMENT status (#PCDATA)>
<!ELEMENT responselength (#PCDATA)>
<!ELEMENT mimetype (#PCDATA)>
<!ELEMENT response (#PCDATA)>
<!ATTLIST response base64 (true|false) "false">
<!ELEMENT comment (#PCDATA)>
]>
<items burpVersion="2023.9.2" exportTime="Mon Aug 21 00:27:10 ECT 2023">
  <item>
    <time>Sun Aug 20 17:51:44 ECT 2023</time>
    <url><![CDATA[https://elecciones.cne.gob.ec/certero-cne/api/v1/total-provincias?codDignidad=11&codProvincia=0]]></url>
    <host ip="54.209.49.112">elecciones.cne.gob.ec</host>
    <port>443</port>
    <protocol>https</protocol>
    <method><![CDATA[GET]]></method>
    <path><![CDATA[/certero-cne/api/v1/total-provincias?codDignidad=11&codProvincia=0]]></path>
    <extension>null</extension>
    <request base64="true"><![CDATA[R0VUIC9jZXJ0ZXJvLWNuZS9hcGkv...]]></request>
    <status>200</status>
    <responselength>5527</responselength>
    <mimetype>JSON</mimetype>
    <response base64="true"><![CDATA[SFRUUC8yIDIwMCBPSw0K...]]></response>
    <comment></comment>
  </item>
  <item>
    ...
  </item>
  ...
</items>
```

It's XML, apparently. Not JSON. Hailing [from the early 2000's](https://konghq.com/blog/enterprise/evolution-apis-rpc-soap-xml-part-2), back when Enterprise Java was all the rage, people used SOAP+WSDL, applications were deployed on bare metal servers (or VMs) and Go didn't even exist.

For some unknown reason, XML and Java go hand in hand. I've also seen some interaction between XML and C#, but Java _loves_ XML. Seriously. Go look at the configuration files of many [Apache Software Foundation](https://www.apache.org/) projects (they're to Java what the CNCF is to Go, more or less). [Maven POMs](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html). [Hadoop](https://www.edureka.co/blog/explaining-hadoop-configuration/). [Camel](https://camel.apache.org/components/4.0.x/others/java-xml-io-dsl.html). [Solr](https://solr.apache.org/guide/7_0/solr-configuration-files.html). [Tomcat](https://ducmanhphan.github.io/2020-02-28-Understanding-configuration-file-in-Tomcat/). And don't even get me started on Spring Boot, where you sometimes [define entire classes in XML files](https://www.baeldung.com/spring-boot-xml-beans), because markup languages rule.

Contrast that with Python and JS, which are JSON incarnate (JS especially, that's what the JS in JSON means); and Go, which lives and breathes [Protocol Buffers](https://protobuf.dev/).

See [here](https://creativepro.com/xml-can-go-to-h-one-designer-s-experience-with-the-future-of-publishing/) for a really fun account of XML. Not necessarily representative, but still hilarious. And it honestly resonates with me, sometimes I've had to read XML-adjacent docs, and "Validates XML documents against DTD/XML Schema" is one of the clearest phrases that you'll find. Really. "The word “schema” is very important. If it isn’t included in the press release, the software is for wimps." _(snicker)_

## Exploratory Data Analysis (EDA)

Now that we have some data, let's start poking around it. We have no specific questions in mind, we just have to see what plots we can find. Plots are nice.

First, we'll have to parse that XML file into something more easily digested. Then, we'll need to start plotting charts, and see where that takes us. Normally, people would reach for [a Jupyter notebook](https://jupyter.org/) for that, but let's try something different, shall we?

I really want to use Grafana for those plots, since it generates some really cool graphs. It's not a commonly used tool for exploratory data analysis, but whatever. Initially I intended to use [Streamsync](https://www.streamsync.cloud/), but I got quite bogged down in the plots. I wanted to use [Vega Lite](https://vega.github.io/vega-lite/docs/), which is a very nice way of writing and customizing plots, but (probably since I'm new to it) generating a plot always felt like I was working far too hard for the result. So Grafana it is.

### A brief primer on time-series databases (TSDBs)

Grafana, however, needs a way to save the data. Let's use [TimescaleDB](https://www.timescale.com/), because it popped up in Google search results for "time series database". It's a Postgres-backed database, but optimized for time series data.

This is time series data:

![117d141595494311c8a3edbfb9b78b5d.png](./_resources/117d141595494311c8a3edbfb9b78b5d.png)

It's anything where the main indexing criteria is a timestamp. Essentially, anything that is generated by "sampling data every 5 minutes", "daily reports", "regular API calls" or whatever. Stuff that has a timestamp and a bunch of associated data, maybe numbers (measurements of something) or strings (system status?). You may see it on application/server monitoring, where the collected data may be server resource utilization (CPU, memory, network, disk) or on IoT (where you'd sample sensors such as temperature and humidity). Those cryptocurrency pages that provide you with a chart of Bitcoin prices are probably backed by time-series DBs (or, maybe, by normal DBs that are being used as TSDBs).

You can use a normal DB (say, PostgreSQL or MongoDB) as TSDBs. For Postgres, just declare a `timestamp` column, make it an index, and off you go. For Mongo, not even that: just ensure that you insert JSON documents with a `timestamp` field. Maybe [throw in an index](https://www.mongodb.com/docs/manual/indexes/) while you're at it, or even [create a time series collection](https://www.mongodb.com/docs/manual/core/timeseries-collections/) if you're feeling extra fancy. However, the access patterns for time series DBs and normal DBs are quite different:

* If you're thinking on SQL, TSDBs will see `INSERT`s but no `UPDATE`s, at least normally: they're _append only_
* Many, _many_ operations will involve ranges on the timestamp, such as `timestamp > X AND timestamp < Y`, or `timestamp > X` for "last day's data", for example
* There are entire classes of aggregations that aren't normally seen: time-bucketed agregations
	* For example: while on a normal DB you may do `SELECT sum(price) FROM purchases GROUP BY customer_id` (you group on a column), on a TSDB you may do `SELECT max(temp) FROM temps GROUP BY day(timestamp)`. See the difference? You aren't grouping on the timestamp itself (indeed, that would be next to useless, since there probably won't be more than one record per timestamp). Instead, you're applying the `max()` function to all data in one day
	* And that's not even taking other aggregates into account, such as [tumbling/rolling windows](https://docs.timescale.com/use-timescale/latest/hyperfunctions/stats-aggs/)
* What about data retention? Time-series data sometimes loses value as it gets older: do you _really_ need minute-level information about temperatures last year, on August 25? Maybe not. Maybe you can simplify old data (say, older than one year) so August 25 just keeps one datapoint per hour, defined to be the average of all the 60 datapoints that it originally had. That's a x60 reduction in storage for all data older than a year. How do you express that on Postgres? You can't (natively), so you'd need to handle that yourself, maybe through a cron job that runs every day and simplifies the data of 365 days ago. And then, what if you miss a day? What if for some reason the cron job runs twice in a day? It's much better to instruct your DB itself to do that
* Knowing that `UPDATE`s will almost never happen, TSDBs can probably optimize `INSERT`s to be faster. For example, transactions are almost a non-issue

As for disadvantages:

* It's Yet Another Service that must be deployed, managed, monitored, migrated and so
* Or, if you use a hosted service, it's Yet Another Bill
* Some TSDBs can't be your entire storage solution, unless your application _only_ stores time-based data. The Users table? Nope, no timestamp there, it's a normal transactional table that will see `UPDATE`s. A User Audit Logs table, on the other hand? Go for it
* In other words, by specializing on time-series data, TSDBs may no longer be general-purpose

As usual, the level of non-generality is dependent on the actual DB used. For example, from what I'm seeing on Timescale's docs, you [can freely mix normal relational tables and time-series tables, called "hypertables"](https://docs.timescale.com/getting-started/latest/tables-hypertables/). I'd expect the performance of normal tables to be precisely the same as that of regular Postgres, with Timescale "getting out of the way", and only kicking in when you `INSERT` or `SELECT` from time-indexed hypertables. Other TSDBs, such as InfluxDB, can't store general-purpose data since they don't follow the relational model. For example, [InfluxDB uses "tags" and "fields"](https://docs.influxdata.com/influxdb/v1.8/concepts/schema_and_data_layout/), which can't quite reach the same level of capability as a general purpose DB (for example, tags are always strings, IIRC)

With that out of the way, let's now start writing data into TimescaleDB. Once it's there, and thanks to time-series data being mostly append-only, we won't need to touch it again, and all the work will shift to plotting and interpreting the data.

### TimescaleDB bringup and data ingestion

I used [the Docker container](https://docs.timescale.com/self-hosted/latest/install/installation-docker/), so as to not pollute my computer (I don't expect to keep using TimescaleDB). It's a Postgres-compliant database, it just adds extensions to the SQL syntax that is accepted. Thus, you can use `psql` or any database management GUI to connect to it.

Once that's done, we can parse the XML file and just dump it all. Worst case, we just `DROP` the database table and try again.

Before the code: that's not a representative sample of my coding! It's just a quick and dirty (very quick and very dirty) script to do that. If this were to be used more than once, I'd clean it up a lot. As it stands, it makes no sense to do so.

```py
import base64
import json
import datetime
import math

import psycopg2
import pandas as pd

def parse_xml() -> pd.DataFrame:
    df = pd.read_xml("votes.xml", parser="etree")

    def process_response(resp):
        data = json.loads(base64.b64decode(resp).decode().split("\r\n" * 2)[1]).get("votos", [])
        return {"votes":{candidate["nomCandidato"]: str(candidate["votos"]) for candidate in data}}
    df["response"] = df["response"].apply(process_response)
    votes_data = pd.json_normalize(df["response"].to_list(), sep="/")

    def parse_burp_timestamp(t):
        dt = datetime.datetime.strptime(t, "%a %b %d %H:%M:%S ECT %Y") # ECT = Ecuador Time, so we're OK already
        return dt.replace(tzinfo=datetime.timezone(-datetime.timedelta(hours=5)))
    df["time"] = df["time"].map(parse_burp_timestamp)

    merged= df[["time"]].join(votes_data)
    merged["id"] = merged.index

    longform = pd.wide_to_long(merged, stubnames=["votes"], i="id", j="candidate", suffix=".*", sep="/")
    longform = longform.reset_index()
    return longform

def make_conn():
    CONNECTION = "postgres://postgres:password@localhost:5435/postgres"
    conn = psycopg2.connect(CONNECTION)

    return conn

def create_table(conn):
    with conn.cursor() as cursor:
        create_votes_table = """CREATE TABLE IF NOT EXISTS votes (
            time TIMESTAMPTZ NOT NULL,
            candidate TEXT NOT NULL,
            votes BIGINT
        );
        """
        create_votes_hypertable = "SELECT create_hypertable('votes', 'time', if_not_exists => TRUE);"
        cursor.execute(create_votes_table)
        cursor.execute(create_votes_hypertable)
        conn.commit()

data = parse_xml()
conn = make_conn()
create_table(conn)

with conn.cursor() as cursor:
    for d in data.index:
        d = data.iloc[d]
        if math.isnan(float(d["votes"])): continue
        
        cursor.execute(
            "INSERT INTO votes (time, candidate, votes) VALUES (%s, %s, %s);",
            (d["time"], d["candidate"], int(d["votes"]))
        )
        
    conn.commit()
```

Note the awesomely secure credentials that are hard-coded into the file. At least context managers are used. Right?

The usage of Pandas to parse the XML file is a relic from Ye Olde Times, in which I was trying to use Streamsync. That's where getting everything into a DataFrame as quickly as possible pays out, since that's the interchange format between Streamsync's BE and FE. And wrangling XML in Python is just enough of a nuisance that, when I removed Streamsync, I didn't want to rewrite that to remove the dependency on Pandas, so it stays. Using Pandas to parse an XML is like buying a car so you can take out a tire and put it on your old car, but whatever. 

Note that we don't import a Timescale-specific Python package. Instead, we just use [psycopg2](https://pypi.org/project/psycopg2/), more or less "the standard" Python package to interface with Postgres databases. That's what [the docs say](https://docs.timescale.com/quick-start/latest/python/), so that's what we do.

Once the script runs once, the data will be on the DB:

![807694a6d364f8fadaf25b50d3057040.png](./_resources/807694a6d364f8fadaf25b50d3057040.png)

Take care to not run the script multiple times, since that will double-insert data. Now that we have it all, time for pretty plots!

### Plotting on Grafana

Much like on Python, TimescaleDB does not have a dedicated plugin or data source type on Grafana. It's just Postgres, so that's what you register it as:

![fd7c6ecccd98b5f343b1a31f6d2b7585.png](./_resources/fd7c6ecccd98b5f343b1a31f6d2b7585.png)

Note that there's a switch that enables TimescaleDB mode. Neat. That makes Grafana provide Timescale-oriented help and autocompletion.

First plot is an easy one: vote progression over time, split by candidate:

```sql
SELECT * FROM votes ORDER BY time ASC
```

![0fe60f000ea235d879568abad98c732e.png](./_resources/0fe60f000ea235d879568abad98c732e.png)

Notice the `ORDER BY` clause. That seems to be required by Grafana: otherwise I had an error `failed to convert long to wide series when converting from dataframe: long series must be sorted ascending by time to be converted`.  What gives?

Turns out that Grafana represents data as "dataframes" (yes, the name is inspired by Pandas and R). They can be in two forms (at least for time series data): [wide format and long format](https://grafana.com/docs/grafana/latest/developers/plugins/introduction-to-plugin-development/data-frames/#data-frames-as-time-series).

This is wide format data:

|     time | Candidate A | Candidate B | Candidate C | ... |
|----------|-------------|-------------|-------------|-----|
| 20:00:00 |         100 |         150 |         200 | ... |
| 20:05:00 |         120 |         160 |         215 |     |
| 20:10:00 |         140 |         170 |         220 |     |
|      ... |             |             |             |     |

This, on the other hand, is long format data:

|     time | candidate | votes |
|----------|-----------|-------|
| 20:00:00 |         A |   100 |
| 20:00:00 |         B |   150 |
| 20:00:00 |         C |   200 |
| 20:00:00 |       ... |   ... |
| 20:05:00 |         A |   120 |
| 20:05:00 |         B |   160 |
|      ... |           |       |

Excel users may recognize [pivot tables](https://www.ablebits.com/office-addins-blog/excel-pivot-table-tutorial/): long form data is non-pivoted data, while pivot tables are wide-format.

\<rant subject="SQL"\>

If you're modeling a normal, relational-type DB, please _please_ don't use long-form to save data. In many cases, it's not a clever way of saving a variable set of attributes per entity, nor a way of saving disk space, nor a way of "future-proofing" the data model or of getting out of stopping and actually thinking about the DB design. It's called [Entity-Attribute-Value](https://www.slideshare.net/xzilla/database-anti-patterns#18) and [it tends to be a really bad antipattern](https://www.slideshare.net/billkarwin/sql-antipatterns-strike-back#16). [Queries become hopelessly convoluted](https://decipherinfosys.wordpress.com/2007/01/29/name-value-pair-design/). `JOIN`s sprout like mushrooms. You lose all type safety.

There are some cases in which use of the EAV pattern is warranted. [Here's an example](https://inviqa.com/blog/understanding-eav-data-model-and-when-use-it), from the Magento e-commerce suite. There, users may declare new products, each with its own attributes: a physical product may have a weight, while software may have a number of licensed users and a license term. In such a case, it's not reasonable to have a single `products` table with columns for each attribute: physical items won't have anything in the `licensed_users` and `term` columns, while software won't fill the `weight` column. Even worse, since users can declare their own custom attributes, you'd have to dynamically modify the DB's schema, at runtime. That's bad. In such a case, some sort of EAV model must be used. There's also talk of EAV [on DBs that store medical data](https://academic.oup.com/jamia/article/5/2/139/738147?login=false).  However, approach with care and never turn your back on it. And carry a sword.

\</rant\>

Back to our election result analysis: we had seen a global chart of the votes for each candidate against time:

![0fe60f000ea235d879568abad98c732e.png](./_resources/0fe60f000ea235d879568abad98c732e.png)

It's interesting that the shape of the curves is somewhat like an S: it starts slow (as the first, fastest voting stations start to deliver results), then accelerates (as the average station finishes counting) and then slows down again (the stragglers). Cool. Would that mean that the distribution of data received is normal? That S shape smells like a normal CDF. Doesn't it?

![](http://www.matematicasvisuales.com/images/probability/normal/normal58.jpg)

More on that later.

## General metrics

Up until now, we've only inspected the actual vote counts per candidate. That's the most important part, probably, but you'll remember that the JSON responses carry a _lot_ more data, such as percentage of population voted, blank/annulled votes, and more.

That would be better saved on a separate collection, so as to not mix them up with candidate votes. Thankfully, Pandas provides a clean way to convert a nested dictionary into wide-form data (that'd be the `json_normalize` function) and then a way of turning that to long-form (`wide_to_long`), so there's not much work required. The output is another hypertable, also indexed by time:

![c456695fc98e1dc754756d024bcc5659.png](./_resources/c456695fc98e1dc754756d024bcc5659.png)

That's only a part of the first request (made on election day at 17:51:44). Notice how the hierarchical nature of the source data is reflected in the `metric` having multiple sections separated by forward slashes `/`. Normally Pandas wants to use periods `.` as the separator, but I think that caused problems with Streamsync, which uses JS, which in turn treats periods as field accessors. Now we don't use Streamsync, but the code remains.

One downside of using long-form data is that the `value` must be a string. Nearly everything is a count or a percentage, thus a `FLOAT` column would be better, but there's a cutoff date when `metric='corte'`, which is a ISO-8601 timestamp:

![992fc0c17b9779b5cb98f2020cba249c.png](./_resources/992fc0c17b9779b5cb98f2020cba249c.png)

That alone means that we have to use a `TEXT` column. An alternative would have been to convert that text timestamp to epoch (i.e. seconds since 1970-01-01T00:00:00Z), and preserve that as a float.

That lets us plot more graphs.

## Report ingestion latency

As you'll recall, every response contains a cutoff date. That should mean that every voting station whose results were submitted before the cutoff date is included in the results, and those who submitted results after the cutoff date are not. Also, the cutoff date is a good indicator of progress: it should never stop. If it slows down, or starts diverging from the current time, that'd indicate a backlog in processing.

We can plot the metric `corte` against the timestamp of the response. We'd expect it to be a constant-ish amount of time behind.

```sql
SELECT
  time,
  EXTRACT(
    epoch
    FROM
      (
        time - value :: timestamp at time zone 'America/Guayaquil'
      )
  ) / 60 as cutoff_delay
FROM
  metrics
WHERE
  metric = 'corte'

SELECT
  time,
  EXTRACT(
    epoch
    FROM
      (
        value :: timestamp at time zone 'America/Guayaquil'
      )
  ) * 1000 as cutoff_date
FROM
  metrics
WHERE
  metric = 'corte'
```

![ebe884fd14bb40ebff999fa6b40a08c4.png](./_resources/ebe884fd14bb40ebff999fa6b40a08c4.png)

And it does look like, indeed, reports are a constant-ish amount of time behind. In particular, we never see the cutoff date being more than ~8 minutes behind now. That'd indicate that no backlog is building up. That's on the green trace.

The yellow trace, on the other hand, shows just the progression of the cutoff date over time. We'd expect that to grow more or less linearly, which it does. We can zoom in to see how frequently are new reports generated:

![e7f02dc91c5213cc5505f62e9144f35e.png](./_resources/e7f02dc91c5213cc5505f62e9144f35e.png)

Here we can see that the reports come in periodically, at which point the yellow trace jumps up by 5 minutes (you can't see that, but I can: every horizontal level on the yellow trace is 5 minutes above the previous one). So reports are updated every 5 minutes, and they are, on average, 4.77 minutes behind:

![407b20b6843010a0d12e96432d390a38.png](./_resources/407b20b6843010a0d12e96432d390a38.png)

For example, when we made a request at 20:31:59, the report had been updated at 20:25:01. When we made the next request, which was 2 minutes later, at about 20:34:00, a new report had come in, with a cutoff date of about 20:30:01.

![cebf30485e8c14e2ce5a606206a62823.png](./_resources/cebf30485e8c14e2ce5a606206a62823.png)

### An aside on the perils of signal aliasing

Also, that weird periodic increase and decrease in the report latency absolutely looks like aliasing. Normally, we'd expect the delay to look like this:

![e0aa428ac8df2d50bb73229df6094578.png](./_resources/e0aa428ac8df2d50bb73229df6094578.png)

Ignore the axis scales, that's because I'm generating other data to illustrate the point. We'd expect the delay to grow linearly, as time passes and no new report is published. Then, we'd expect the delay to drop abruptly to near zero, as the new report is published. Then it starts growing again, until a new report comes in. However, there's a problem: this new data looks nice only because there are many points (24 here) per stairstep. How would that look if we only sampled a couple of points per step, as we do on the actual data? There, the yellow trace steps every 5 minutes, but we sample the green trace every 2 minutes. Then, data looks _very_ different:

![cb448646d06eb12e647f52b44f150869.png](./_resources/cb448646d06eb12e647f52b44f150869.png)

Note that, now, for every step of the yellow stair, we have 2.5 green datapoints. Every red dot denotes a sample operation. Or, in other words, if the yellow trace increases every 5 minutes, we take a sample every 2 minutes. The green trace is the _difference_ between now (i.e. the time at which we sampled) and the real report cutoff date (in yellow).  It's no longer a clean stairstep, but a more chaotic line... that looks a lot more like the real data, doesn't it?

![cb448646d06eb12e647f52b44f150869.png](./_resources/cb448646d06eb12e647f52b44f150869.png)

![ccd3605a77ec32346d8f01a3fb5b20fe.png](./_resources/ccd3605a77ec32346d8f01a3fb5b20fe.png)

What sorcery is this? It's our old friend [aliasing](https://en.wikipedia.org/wiki/Aliasing) at work! We're sampling a sawtooth wave (the delay between the report's cutoff date and now), at a frequency that is uncomfortably close to the signal's frequency (the wave has a 5 minute period, and we're sampling every 2 minutes). That's way too close.

People who have worked on signal processing before may recognize something like [the Nyquist theorem](https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem) at work here. A sawtooth has many harmonics (infinitely many, in fact), so we'd need to sample at a much faster rate than 2.5 samples per signal period. Since we don't, we get a weird wave that doesn't really represent our original sawtooth.  That's why showing the actual datapoints (not only the line connecting them) is really important: if we didn't, you may assume that data is being sampled, say, once every second, and that weird sawtooth is an actual feature of the data. Seeing only a couple of points tells you that the lines connecting them are fake. Something similar happens [with oscilloscopes](https://emcesd.com/tt2003/tt080103.htm), and that may come back to bite you.

Still unclear? Maybe the next image will help. It's the same plot, but with more information overlaid: the yellow trace is the report cutoff date, which lags the current date and then jumps up as a new report comes in, then stays at its new date (a stair step) until another report comes in. The green trace, as before, is the observed report delay, sampled quite infrequently. Red dots at the bottom indicate the sample points. And the light purple trace is the actual report delay, if we were sampling it _a lot_ more frequently than we actually are.

![eb670356910dedabf969ed149e5d6920.png](./_resources/eb670356910dedabf969ed149e5d6920.png)

Notice how the green and purple traces actually match perfectly... at the points at which the green trace _actually has_ data. In other words, if you sample the purple trace (the ideal data) at the red dots, then plot that with connecting lines, you get the green trace. That trace has some lines that don't really mean anything and may lead you to conclude things that aren't true. Beware.

## Exploring normal assumptions

Remember how we said before that the vote progression over time looked like a normal CDF? Now it's time to test that.

We'll start with the total votes counted, which we now can plot since we have global metrics:

```sql
select 
  time, value::float 
from 
  metrics 
where 
  metric='electoresJuntaComputada/electores/total'
```

![e8f9eb23fc28804341093ebfbed62f56.png](./_resources/e8f9eb23fc28804341093ebfbed62f56.png)

That's the total amount of votes counted, as it progresses over time. Let's now see the _changes_ in value, over 5 minute intervals (since, as we've found out, data only comes in every 5 minutes, so there's no point in getting more frequent data; it'll only cause datapoints with change=0 to appear):

```sql
select
  time_bucket('5 minutes', time) AS bucket,
  max(value :: float)
from
  metrics
where
  metric = 'electoresJuntaComputada/electores/total'
GROUP BY
  bucket
ORDER BY
  bucket ASC
```

![e7b5ff61c4bd74edca70fb5d2c142857.png](./_resources/e7b5ff61c4bd74edca70fb5d2c142857.png)

That's the same data, but now grouped every 5 minutes. I chose the `max` function as an aggregate because votes are (expected to be) monotonically increasing (in plain words, big number only go up). So, if the 5-minute window includes data from report N and report N+1 (where report N+1 has a higher value), we want that 5-minute window to include value from report N+1, which must be bigger because number go up.

Now let's actually get the change between consecutive reports:

```sql
WITH data AS (
  SELECT
    time_bucket('5 minutes', time) AS bucket,
    max(value :: float) :: int
  FROM
    metrics
  where
    metric = 'electoresJuntaComputada/electores/total'
  GROUP BY
    bucket
  ORDER BY
    bucket ASC
)
SELECT
  bucket,
  max - lag(max, 1, 0) OVER () as new_votes
FROM
  data
```

![53c0aa5b65ceebe4484d797fc4ee48c1.png](./_resources/53c0aa5b65ceebe4484d797fc4ee48c1.png)

That's a nastier query, but it isn't _that_ bad. The first part (the CTE, inside the `WITH` clause) is just what we saw above: it's cleaner data, just one datapoint every 5 minutes. The fun part is the little `SELECT` at the end, and specifically the `lag() OVER ()`. What's with that `OVER`? Is that even valid SQL syntax?

As it turns out, it is! It's called [Window functions](https://www.postgresql.org/docs/current/tutorial-window.html), and it's somewhat similar to aggregations (`SELECT max() ... GROUP BY col`, for example). However, unlike aggregations, it doesn't reduce the number of records/rows: it just applies a function to each row, and each row sees a different "window" of related rows, hence the name.

An image may clear things up (hopefully). First we have a normal SQL function, then an aggregate, and finally a window function:

![86dca7fa918ac0e4171435b673ac3c89.png](./_resources/86dca7fa918ac0e4171435b673ac3c89.png)

First is a normal function: it just applies some operation to each record. The number of records is unchanged.

Second is a plain aggregation, which uses `GROUP BY`. Most of the time (unless every group has a single element), it'll reduce the number of records. The stock example is "compute the average salary per department". Here the two groups are marked in green and red.

The third and final section is a window function. Like a normal aggregate, it groups records by a key (say, the department). _Unlike_ an aggregate, it doesn't just reduce all the record in each group to a single record, but instead preserves them all. Unlike an aggregate, it doesn't use `GROUP BY`, but instead it uses `OVER ()`. Whatever is inside those parentheses is the "window condition", which defines what's the "related records" for each record. Here, since we said `PARTITION BY col2`, the first record sees as its related records rows 1 and 2 (itself and the next one). So far, it's like a `GROUP`. However, the `avg(col1) over (partition by col2)` is computed and then used on each record. For example, the average for the first two records is 15 (the average of that window), and for the last two records is 150. That is used to compute `col1 - 15` for the first two records, and `col1 - 150` for the last two. Hence the mix between a function and an aggregate.

Notice that, while we still marked green and red groups, that's not exactly true. The window is computed _per record_, i.e. four times. It just so happens that the first two rows will generate the exact same window, which is the green one. The final two records will, likewise, generate the same window: the red one. However, it doesn't have to be that way, it just happens to be what `OVER (PARTITION BY ...)` does. In theory, every record could generate a different window. For example, `OVER (ORDER BY col1)` will generate an ever-growing window: for each record, the window will contain all the records that come "before it" and itself, when ordering by `col1`. You could use that to implement the reverse of what we did: if you had a list of _new_ votes that came in on every 5-minute interval, and you wanted to see the progression over time, you could use `sum(votes) OVER (ORDER BY time)` and see the cumulative sum of votes.

Back to our query, we had this:

```sql
SELECT
  bucket,
  max - lag(max, 1, 0) OVER () as new_votes
FROM
  data
```

Since we specified `over ()` as the window criteria, every record has the same partition: all rows in the table. We then use [the `lag()` function](https://www.postgresql.org/docs/current/functions-window.html), which "Returns `max` evaluated at the row that is 1 row before the current row within the partition; if there is no such row, instead returns 0" (after replacing for the parameters as we provided them). In other words, "returns the `max` column of the previous row, or 0 if we're on the first row". That's precisely a delta operation, or the reverse of a cumulative sum. Which is what we wanted: 

![ee4aeb1c90b2c1798233ee02a159ec5a.png](./_resources/ee4aeb1c90b2c1798233ee02a159ec5a.png)

Now, is that a normal distribution? I can't really say. With some good will, it kinda looks normal-ish. 

At this point I intended to do some fancy normality tests on the data. After much flailing (I haven't used R in years, and even then it was quite superficial), I settled on the Shapiro-Wilk and Kolmogorov-Smirnov tests. However, there's an issue: those tests usually assume quite small amounts of data, in the order of 100 measurements. Many more than that, and you start getting into trouble: [the Shapiro-Wilk function in R](https://search.r-project.org/R/refmans/stats/html/shapiro.test.html) has a hard-coded limit of 5000 observations, tops. And here we're dealing with over 100K observations, one per voting station. So no dice. KS, on the other hand, requires that you know the parameters of the assumed distribution (here, mean and variance), which we don't know. So no tests for us, and thus no verification of the normality hypothesis.

We can, however, by using our trusted Mark I Calibrated Eyeballs&trade;, infer that, on average, results for a station are reported at 25:45. That's 4 hours and 45 minutes after voting stops. The fastest results come in after about 1.5 hours, maybe a bit less. And they keep coming in for seven or eight hours.

## When are results reliable?

And now for a fun question: When were (partial) results reliable?

In other words: we all instinctively know that, when only one or two stations have reported data, those results are not necessarily reliable. Any random variations in results will transfer directly to the percentages. Once more data starts coming in, random variations should start cancelling each other (that's why they're random, after all), and we should start getting better and better approximations to the final results.

So, assuming that the time at which a single station's results are registered is _not_ correlated with candidates, we can start exploring intervals of confidence and whatnot.

We need the independence assumption because otherwise all bets are off. Say that a certain candidate is much more popular in poor, isolated regions of the country. We'd expect those results to come in later, since they have to be transferred (indeed, some region's results only come in after a few days!). We can _not_ control for that, so we'll do the bravest thing and assume that it doesn't happen. See? Statistics are easy.

First let's plot the vote percentages over time. We'd expect them to swing wildly at first, and then start stabilizing once more data comes in, at which point random fluctuations have less effect.

```sql
SELECT * FROM votes order by time asc
```

![d9c28a8b9b36167cf4b58193990d2eca.png](./_resources/d9c28a8b9b36167cf4b58193990d2eca.png)

This query is the same that we saw before, but now I've changed the graphical configuration so it's Stacked (100%). This will let us see vote percentages with more ease. And, indeed, we see that votes vary a lot at the start, before settling on very consistent values. Using again the Mk.I Eyeball, we can see that, after about 18:45, percentages are essentially static:

![9430fe50ada0f33ff868c1af8aed5707.png](./_resources/9430fe50ada0f33ff868c1af8aed5707.png)

I've drawn horizontal lines to take the data, as it was at 18:45, all the way to the end. As we can see, percentages almost don't change. Now, it's time to see what percentage of votes had been counted at 18:45:

![3c551456498a07517d0c470e5f97f94a.png](./_resources/3c551456498a07517d0c470e5f97f94a.png)

Wow. I didn't see that coming. That's 1.7% of the votes. Even if you wait until 19:00, to be extra certain, that's just 4.3% of the votes. With just a tiny fraction of votes, you could have predicted the results. How cool is that?

Obligatory caveats: that's most definitely NOT a stats-approved way of predicting election results. Don't go around claiming fraud based on results of the first 1.5% of votes to come in. I'll hunt you down and make you solve [confidence interval](https://www.scribbr.com/statistics/confidence-interval/) equations. Manually.

With that out of the way, the results are still really cool. 1.7%? Really?

## Recap

* You can capture live data on systems that don't provide it, if you're lucky, by intercepting their HTTP requests and saving them
* This will give you a far more nuanced view of the system than that which a single snapshot of the end state can provide
* You can use Burp to do the whole request interception business, even without any help from the intercepted application
* On the special 2023 Ecuador presidential elections, the results reporting platform didn't go down at all, at least as far as my data collection was concerned
* TimescaleDB is an option for storing time series data, and then querying it via plain SQL (actually, it's extended with more functions, but those build _on top of_ SQL)
* Unlike other TSDBs (loking at you, Influx!), Timescale is a proper, fully-fledged relational DB. While we didn't test it, you can freely mix time-series tables (hypertables) and normal relational tables. The canonical example is saving only a sensor ID with your time-series data, and having a plain relational table with sensor information, such as its serial number, latitude, longitude, model, install date, and more
* That capability may come in handy if you're building a product where the most important, VIP, platinum-grade table is some sort of timestamped data, but you still need relational tables around it. Maybe a logging service? Status checks for websites? User behavior/analytics? Yet another crypto platform?
* Grafana plays really well with TimescaleDB
* We've verified that reports were being generated at regular times throughout the entirety of election night, with the delay between the report's cutoff date and now never surpassing eight minutes or so
* Vote count reports (per station) come in in a somewhat bell-shaped curve: first they come in slowly (starting at about 18:00), then the rate starts increasing until about 21:45, and then it starts dropping off again
* We've seen that, with only 1.7% of the total votes counted (1.75 hours into the counting), the percentages of votes per candidate were already remarkably close to the final percentages. We should really check that again to see if it's a repeatable result

Post-credits scene: And, since no one obtained either 50% of the valid votes, nor 40% of them plus 10% over the second candidate, we'll have a second election in a couple of months.

[^1]: Yes, we have eight candidates. And some of them represent several different parties, so there's easily a dozen political parties in there
[^2]: Each voting station handles up to 350 people, at least where there's enough people to fill more than one station. In smaller places, a couple of stations may handle everyone, and there's no guarantee about the number of people per station
[^3]: Empty and annulled votes (I'm calling then that, but there's no official translation: they are _votos blancos_ and _votos nulos_ respectively) are votes that were cast empty or with marks that indicated a wish to invalidate them (i.e. anything but a clear mark on a single candidate), respectively. They don't have an effect (if annulled votes are more than every candidate, elections are _not_ repeated. That has happened before, see [2023's CPCCS elections](https://app01.cne.gob.ec/Resultados2023/)), but they aren't included in percentage calculations. Those only take "valid votes" into account
[^4]: Each station counts its own votes, and then fills some triplicated official documents. AFAICT, those go into a scanning room where they are... well, scanned, and then transmitted to the central offices. From there, they go into the report that everyone sees, assuming that all counts match
