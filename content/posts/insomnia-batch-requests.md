---
title: "Insomnia Plugin: Batch Requests"
date: 2023-02-17T20:39:32-05:00
draft: false
summary: In which we introduce and describe an Insomnia plugin that can repeatedly send a request, varying arbitrary parts of it with data taken from a CSV file, and also extract response data and save it to the aforementioned CSV file.
tags: ["rest", "insomnia", "open-source", "new-project", "announcements"]
categories: ["react", "nodejs", "http"]
toc: true
---

## TL;DR

This article introduces an [Insomnia](https://insomnia.rest) plugin that can run a request repeatedly, varying request data according to a CSV file, and also extract data from the responses and save it back to the CSV file, according to the request that generated it.

The plugin's source code is at <https://github.com/jreyesr/insomnia-plugin-batch-requests>.

The plugin is hosted at NPM in <https://www.npmjs.com/package/insomnia-plugin-batch-requests>

You can install it on your Insomnia installation by going to `Application>Preferences`, searching for `insomnia-plugin-batch-requests` and installing it. See the plugin's README at <https://github.com/jreyesr/insomnia-plugin-batch-requests> for usage instructions.

## Introduction

(Sportscaster voice) Hello, and welcome to the first real article in the blog! Today we face Insomnia and its fearsome plugin architecture.

Okay, enough of that. Today's objective is to create an Insomnia plugin, whereby you can:

1. Write a request as normal, but leaving one or more pieces of the request as variables (i.e., placeholders)
2. Providing a CSV file to Insomnia, which should have multiple combinations of values for the placeholders
3. Running the request once for each entry in the CSV file, replacing all placeholders with the values of each line
4. Grabbing values from each response (configurable!)
5. Saving the response in the CSV file, in new columns

Still not clear? Here's a drawing:

![A diagram displaying the flow of data in the plugin](/images/insomnia-batch-requests/flow.png)

Every row in the CSV file (minus the header, of course) should cause a request. Some of the columns in the CSV will be used to compose the request. Other columns, which will most likely be unfilled in the original CSV file, should get filled with data extracted from the response. In the end, you should have another CSV, with one or more columns filled with data extracted from the API calls made.

So what's it useful for? There are two main usecases:

* Batch enrichment of data. You have an API that you can query and it returns some data. Think querying your CRM for the email and phone number of multiple clients. I have found no clear way to do it, short of writing a Python script to read a CSV file, get some columns, call the actual request, then parse and extract data from the response, and write another CSV. That is *boring*!
* Executing batch operations. The drawing above doesn't show it, but you may want to execute a state-changing operation repeatedly. For example, if you have an API endpoint `/signup` that takes a JSON body `{username, email, password}`, plus a CSV file with a bunch of `(username, email, password)` triples that you want to create accounts for. Postman can automate this to a degree with the [Test Runner](https://blog.postman.com/using-csv-and-json-files-in-the-postman-collection-runner/), but it's not that well documented, and it can only run an entire collection at a time, and you cannot easily get data from the responses. For example, if the `/signup` endpoint returned the ID assigned to the newly created user, you can't easily collect that information alongside the original data. In other words, you can run the mutations for their side effects, but you can't collect the return values.

You may be interested in the plugin if some of the following sounds like something you need to do:

* Infrastructure management: Getting the status of a bunch of AWS servers. Powering off a list of servers. 
* Cybersecurity: Getting WHOIS information about IPs that have appeared in your firewall logs. Checking if file hashes are malicious in VirusTotal. Blocking multiple IPs in a firewall (if it has a REST API, *as many firewalls don't* 😠)
* AI: Classifying multiple texts at once.
* ... I'm out of ideas. General API wrangling in which you need to repeatedly call an API.

## Alternatives

Here's a list of alternatives that you can use today. None of them are quite the same, so there's a niche to fill with this plugin:

* Postman's [Test Runner](https://blog.postman.com/using-csv-and-json-files-in-the-postman-collection-runner/). It can take a CSV or JSON file, and repeat a collection of requests. Some cons:
  * It can only run a collection at a time. Most of the time you only want to run a single request (any dependencies can be taken care of via [request chaining](https://docs.insomnia.rest/insomnia/chaining-requests)). Creating a collection to put a single request inside of it seems... weird.
  * You cannot extract data from the responses (at least, not easily). You could probably rig something with the tests that run after a response is received, but that's not clean at all.
  * It's strictly serial (requests are sent one by one). Sometimes you want requests to be parallel for *speed*! *Future jreyesr speaks:* This plugin is also serial, but it may be possible to parallelize it in the future.
  * It seems geared towards API testing (providing multiple test cases and writing tests to ensure that some conditions are always true), which is not what this plugin is about.
  * It's Postman, which I don't really like since they attempt to cajole you into creating an online account. No, thanks.
* Burp Suite's [Intruder](https://portswigger.net/burp/documentation/desktop/tools/intruder). Some cons:
  * It's part of Burp, which is well-known in the cybersecurity circle and not much else. As a developer, you may not have it installed.
  * It's an entirely new tool, with an *extensive* UI.
  * It's not clear if you can provide multiple inputs to a request.
  * Burp is most comfortable when you work entirely inside of it. You would need to do all your API work in it, instead of Insomnia, which is much well suited for that kind of work.
  * Extracting data from the responses seems possible, but it's 
* Writing your own shell script with, say, [HTTPie](https://httpie.io/) for the requests and [jq](https://stedolan.github.io/jq/) for parsing data. It would probably work, but shell scripts are not the easiest to read, and there's no shiny UI.
* Writing a Python script (or whatever your preferred scripting language is) to do the whole work. Cons:
  * It's a lot of boilerplate code. When I have done it, almost all the code is generic code that doesn't do anything interesting: read and parse a CSV file, a for loop to compose and call the request, extracting data from the response, updating the CSV data, writing back to the file.
  * It takes you outside of Insomnia again. Sure, you can right click the request and use the Generate Code function in your script, but any changes that you make are not sent back to Insomnia, which is probably more or less your source of truth for the requests.

So, there's nothing that does exactly what I need. Let's build a plugin then! (Plus, I get to learn about Insomnia plugins while I'm at it, and the Internet gets another article about the subject, which may contain some useful information)

## Starting off

First things first. We need to create an Insomnia plugin.

There's a nice detail here! I expected to have to run a NPM command to bootstrap the directory structure. Instead, you can just open Insomnia, go to `Application>Preferences`, open the `Plugins` tab, click the `Generate New Plugin` button, provide a name and confirm.

⚠️ You need to ensure that the name of your plugin starts with `insomnia-plugin-`. ~~The documentation doesn't state what will hapen if you don't, but I would expect Bad Things™.~~ If you don't, Insomnia will add it.

![A screenshot showing the steps required to create a plugin](/images/insomnia-batch-requests/create_plugin.png)

In my Ubuntu machine, the plugin was created in the `~/.config/Insomnia/plugins` directory, which is the same directory in which plugins get installed from NPM.

Two files are created: `package.json` and `main.js`. Let's start with `package.json`.

The `insomnia` property is required, since it's used by the Plugin Hub and the Insomnia app. The only change that I made was to add a `displayName` property to it, and fill the `description`.

The `main.js` file contains the plugin code. Insomnia provides multiple ways of extending functionality (see https://docs.insomnia.rest/insomnia/hooks-and-actions for a list of extension points):

* Adding custom template tags that you can use when composing requests. From the documentation, “Tags can do things like transform strings, generate random numbers, handle UUIDs, and create timestamps”
* Running code before sending a request, and after receiving a response.
* Adding an item to the dropdown that appears when you click on a request.
* Adding an item to the dropdown that appears when you click on a folder.
* Adding an item to the dropdown that appears when you click on a workspace or collection.
* Adding an item to the context menu for a Collection card on the main dashboard.
* Generating configuration from an API spec.

This plugin will use the “request dropdown” option. The others don't make much sense. I wish there was a way of adding custom tabs to the Request editor, but I haven't found it. Something like this would be really cool:

![A screenshot with a mockup of a possible Repeater tab (whic doesn't exist)](/images/insomnia-batch-requests/repeater_tab_mockup.png)

## Displaying a custom dialog

Most of the material online about Insomnia plugins revolves around "headless" plugins (with no UI, that just run an action) or custom template tags that you can insert on requests by pressing `Ctrl+Space`. Headless plugins (obviously) have no UI, while template tags use a predefined UI that lets you specify configuration parameters, but wthout needing to compose the UI yourself (for example, for the template tag below, you just say “the Filter field is a textfield, the Trigger Behavior field is a dropdown”, and Insomnia renders the UI)

![The UI of an Insomnia template tag](/images/insomnia-batch-requests/templatetag_ui.png)

This won't work for this plugin, since we need a completely custom UI. Insomnia provides a `context.app.dialog(title: string, body: HTMLElement)` function in the [app context](https://docs.insomnia.rest/insomnia/context-object-reference#contextapp), which can display arbitrary DOM nodes. You could probably compose the UI manually, but that starts sounding like a task for a frontend framework. React seems to be the framework of choice for Insomnia, so that is what I used.

![A mockup of the main UI for the plugin, with a button to select a CSV file, a table to preview it, a form to set output data, and a button to run the request repeatedly](/images/insomnia-batch-requests/app_ui_mockup.png)

## Creating the template tag to mark the replacement locations

The plugin uses a custom template tag to mark the locations that should be replaced on every iteration. 

![The template tag that marks a variable location](/images/insomnia-batch-requests/marker_templatetag.png)

![The configuration UI for the marker template tag](/images/insomnia-batch-requests/marker_config.png)

When running manually (i.e., not in Batch mode), the tag will be replaced by its Sample value. When running in Batch mode, the plugin will set the current row's data using the `context.store` variable (see https://docs.insomnia.rest/insomnia/context-object-reference#contextstore), which provides persistent storage that is scoped to each plugin (more on that below).

Therefore, the template tags provide the input data to the request.

Writing a template tag is quite simple, since it's one of the primary use cases of plugins and therefore its developer experience is probably very optimized. In the plugin, the main functionality is implemented in the tags.js file, imported in the main.js file:

```js
// tags.js

export const templateTags = [{
    name: 'batchVariable',
    displayName: 'Batch',
    // 1
    liveDisplayName: ([colName, sample]) => (colName.value ? `CSV[${colName.value}]: ${sample.value}` : 'Batch'),
    description: 'Placeholder for the Batch Requests plugin',
    // 2
    args: [
        {
            displayName: 'Name',
            description: 'Ensure that this value matches the name of a column in your CSV file',
            type: 'string',
            // 3
            validate: (val) => (val ? '' : 'Enter a column name!'),
        },
        {
            displayName: 'Sample value',
            description: 'This value will be used when sending the request manually (outside of Batch Requests)',
            type: 'string'
        }
    ],
    // 4
    async run(context, name, sample) {
        // context.renderPurpose is set to 'send' when actually sending the request
        if(context.renderPurpose === 'send') {
            // 5
            const storeKey = `${context.meta.requestId}.batchExtraData`;
            if(await context.store.hasItem(storeKey)) {
                const extraData = JSON.parse(await context.store.getItem(storeKey));
                console.debug('[store.get]', extraData);
                return extraData[name];
            } else {
                console.error(`Cannot find column ${name} on request extra data! Falling back to sample value.`);
                return sample;
            }
        } else {
            // context.renderPurpose is undefined when previewing the template tag's value
            return sample;
        }
    },
}]
```

You need to somehow export an array of template tag objects. The structure of each object is described in [this link](https://docs.insomnia.rest/insomnia/template-tags#template-tag-schema). In this case, the plugin implements only one template tag, which is used to mark the locations that will be replaced with variable data.
 Some remarks about the code:

1. The `liveDisplayName` property controls the name that will be shown inside the blue(ish) rectangle that marks the tag. If you don't provide it, all instances of your tag will have the same name, provided in `displayName`. I implemented the live version to provide information about the configuration of the tag: in the screenshot above, every instance of the tag shows the CSV column that it will look for, and the sample value configured.
2. The `args` array is used to build the tag's configuration dialog, that appears when you double-click a tag instance. This tag requires two values, both strings: the CSV column name and the sample value. 
3. The CSV column name is validated to ensure that it is not empty: if it is, a red error message appears on Insomnia.
4. This is the render function. You need to declare it (and it must be async, apparently), and it will be called every time that Insomnia needs to know the value that your tag will take. The first parameter is always a `context` (sadly, its documentation is lacking), and any further parameters are the values that you declared in `args`, in the same order. 
5. This template tag works differently when previewing and when actually sending a request. When previewing (i.e., `context.renderPurpose` is not `sendRequest`), it simply returns the sample value. If a request is actually being sent, it attempts to find the data of the current CSV row in the plugin storage (again, see below. For now, just know that other parts of the plugin code must set this before invoking the request). If some data is found, it accesses a property according to the column name configured, and returns that, falling back again to the sample value.

The main.js file simply registers the template tag with the Insomnia machinery:

```js
// main.js

// ...
import { templateTags } from './tags';

// ...

module.exports.templateTags = templateTags;
```

## Creating a Request action

A Request action is one of the provided extension points in Insomnia. It is shown when you right-click a request, under the Plugins section:

![The context menu option registered by the plugin](/images/insomnia-batch-requests/plugin_contextmenu.png)

Request actions are registered in the `main.js` file:

```js
// main.js

import React from 'react';
import { createRoot } from 'react-dom/client';

import BatchDialog from './components/BatchDialog';
// ...

// 1
module.exports.requestActions = [{
  label: 'Batch Requests',
  icon: 'fa-repeat',
  // 2
  action: (context, {request}) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    // 3
    root.render(<BatchDialog context={context} request={request}/>)

    context.app.dialog('Batch Requests', container, {
      onHide: () => root.unmount(),
    });
  },
}];

// ...
```

1. You need to provide a requestActions export, which should contain an array of request action object. Note the similarity with the template tag, which are registered in exactly the same way.
2. Every request action should specify a name and icon, and a function which will be called when the user clicks on the action's button in the dropdown.
3. This request action does the React dance to mount a component into a DOM element, which is created just above. The DOM element is then passed to `context.app.dialog`, and Insomnia displays it in a popup/modal dialog. Everything that happens inside the dialog is therefore under the control of a tree of React components.

That's it! Other plugins that I have seen do some actions in the `action()` function, but those are headless plugins that don't have an UI. For this plugin, we only need to display the dialog and let it take over.

## The Batch Requests dialog

Once you click the action's button in the dropdown, you see the following modal dialog:

![The main UI for the plugin](/images/insomnia-batch-requests/plugin_ui.png)

1. You first need to select a valid CSV file from your local disk.
2. Once you select a file, this table displays the first five rows of the file, so that you can check the structure of the data. Your request should have one or more template tags configured to match one or more of the columns in this table.
3. You can specify outputs that get extracted from the response. For every one, you choose a CSV column that will be used as a destination for the data, and a JSONPath expression that specifies how to extract data from the response.
4. The progress bar gets filled as the requests are sent.
5. The Run button is enabled once you have chosen a CSV file and all the Outputs are filled.

All of that UI, plus the state handling and reactivity, is fairly standard React stuff. Components get declared, state gets used and passed to child components, events are used to send information upwards, conditional rendering happens, and so on. The `BatchDialog` element (in the `components/BatchDialog.js` file) is the parent element.

The real fun (when you click the Run button) happens in the `onRun` function in the `BatchDialog` component:

```jsx
// components/BatchDialog.js

// ...

export default function BatchDialog({context, request}) {
  // ...

  // This gets called by the onClick property of the Run button
  const onRun = async () => {
    setSent(0);
    for(const [i, row] of csvData.entries()) {
      const storeKey = `${request._id}.batchExtraData`;
      await context.store.setItem(storeKey, JSON.stringify(row)); // 1
      let response = await context.network.sendRequest(request); // 2
      await context.store.removeItem(storeKey); // 3
      setSent(s => s + 1); // 4

      console.log(response); // 5
      // ... See the next section for what goes here!
    }
  };

  // ...

  return (<React.Fragment>
    {/* ... */}
  </React.Fragment>);
}
```

1. The plugin store gets populated with the current row's data, as a serialized JSON object.
2. The request gets invoked. This will, as part of the rendering process, call the template tags (see above), which will attempt a read from the same plugin store location, find and extract the data, and access the configured columns.
3. Then, the plugin store is cleared for the next request
4. The `sent` state is increased by one, which makes the progress bar advance one step.
5. Any work required is performed on the response. In this case, the configured Outputs are used to extract some data via JSONPath, and the extracted data is written back into the CSV data and then into the original CSV file.

As you can see, the important bit is leaving the required data in the plugin store, so that the template tag can read it and replace itself with the varying data. Note that this introduces a dependency on serial execution, since this plugin store can only hold one value at a time, and we need to wait for the response to be sure that we can proceed to the next row. I tried several other ways of passing data to the templating engine, but none worked. The problem is that the only shared information (between your plugin code, that calls `context.network.sendRequest()`; and the template tags) is the request itself, but you can't set any data on it from the template tag. I tried to set a header with a very special name and then read and delete it on the template tag, but you don't seem to be able to edit the request from the template tag side, which would cause all your requests to contain an extra header. That may work, especially since no reasonable application should break on receiving a header that it doesn't expect, especially if it has a name that is unlikely to be used anywhere else, but I wasn't comfortable with silently altering requests anyway. I may revisit it if I implement parallel mode at some point (*cough...*)

Once we have a response, we can do whatever with it. This plugin applies one or more JSONPath expressions to it, parses data out, and then updates the CSV file with it.

## Using JSONPath to extract data

OK, so we have a Response object. What can we do with it?

![The Response object, as seen using console.log](/images/insomnia-batch-requests/response_debug.png)

We need to read the response body, assuming it's JSON. If it's not, there's no point in applying JSONPath expressions.
There's a complication there. The response does not contain its actual body, just a filepath to it. The plugin reads the file from disk, and then parses it as JSON. From there on, it's a simple matter of applying all JSONPath expressions to it, and saving the responses in their required CSV columns:

```jsx
// components/BatchDialog.js

// This goes inside the onRun() function explained in the previous section

// If we need to extract response data, check that the Content-Type header is sensible, otherwise error out
if(outputConfig.length > 0 && !response.contentType.startsWith("application/json")) {
  context.app.alert("Error!", `The response has invalid Content-Type "${response.contentType}", needs "application/json"! Alternatively, delete all Outputs and try again.`)
  continue; // There's no point in attempting to parse the response, just jump to the next request
}

// Read the response data, then apply JSONPath expressions on it and update the CSV data
const responseData = JSON.parse(readResponseFromFile(response.bodyPath));
console.debug(responseData)
for(const {name, jsonPath} of outputConfig) {
  const out = applyJsonPath(jsonPath, responseData) ?? null;
  console.debug(name, "+", jsonPath, "=>", out);

  let nextData = [...csvData]; // Copy the array so that it can trigger a state update
  nextData[i][name] = JSON.stringify(out); // Mutate the required field, save it as a string
  setCsvData(nextData);
}
```

The first part is a simple header check. If the response is not JSON, we don't even attempt to apply JSONPath expressions to it, we instead show an error alert and carry on. Otherwise, we:

1. Read the response body from disk (the function that does it is not shown, it's a simple `fs.readFileSync()` call)
2. Parse the response body as JSON (which should be OK, since the remote server is announcing that its response is JSON, as checked just above)
3. For each JSONPath expression provided: (as a reminder, every Output has a JSONPath expression and a target column, selected from the CSV columns)
   1. We apply the JSONPath expression to the response data, and fall back to `null`, for the cases in which the JSONPath expression is malformed or doesn't match anything
   2. We make a copy of the main state data, since React doesn't like it when you modify its state in place
   3. We overwrite the corresponding "cell" in the CSV file with the extracted data. As a reminder, the `i` variable is the index of the request/response cycle, which indexes the CSV rows, and the `name` variable is a column, which selects a column in the row.

There's a potential optimization here, since we could defer the `setState` call until the end, therefore causing less rerenders. I'm not sure that it really matters, and it may obscure the intention of the code (i.e., causing someone to become confused, since "This variable is being set here, but it's not preserved anywhere". If someone reports extreme sluggishness when operating over very large CSV files, this is probably the cause 🙂. It's an easy enough fix anyways.

The final bit of the code is writing the results back to the same original file. In that way, your same input file will be enriched with data. This is achieved with a button next to the Run button. There's no mysteries there, just a CSV library that takes an array of objects, plus an array of column names, and generates a string that can be written to a file, taking care of escaping, separators, quotes and all that fun.

## Publishing

1. Create an NPM account, if you don't have one (I didn't)
2. Create an access token, with the smallest scope possible, in https://www.npmjs.com/settings/YOUR_USERNAME/tokens. Don't close the page yet, since you won't see the token ever again.
3. Add a Github Actions workflow, from the template called “Publish Node.js Package”
4. (IMPORTANT) Add a step `npm run build` on the `publish-npm` job. This is required since the plugin uses React and React requires a build step. Otherwise, the actual plugin entrypoint will not exist and Insomnia will complain. Loudly.
5. Add the NPM access token on the repo's secrets: Go to Settings>Secrets and variables>Actions>New repository secret, call it npm_token, the value should be the value provided by NPM a couple of steps above.
6. Commit the action, then create a release on Github. That triggers the workflow, compiles the code and publishes it on NPM.
7. That should be it! From now on, any further releases will be uploaded to NPM, from where it will be distributed to the world.

## Bonus: Running React with Insomnia

There's no documentation that I could find on using React on an Insomnia plugin. I wanted something to render the dialog, with tables, dropdowns and buttons. React seems extremely heavy for such a task, but the authors of Insomnia have explicitly blessed it as a way to generate dialogs: see <https://github.com/Kong/insomnia/pull/2026#issue-593608595>.

 The following changes are required to run React inside a plugin:

1. `npm i react react-dom`

2. `npm i --save-dev parcel babel-preset-react-app`

3. Add this to the `package.json` file:
   
        ```json
        "scripts": {
            "dev": "parcel watch --no-source-maps main.js",
            "build": "parcel build --no-source-maps main.js"
        }
        ```

4. Edit the `main` property so that it is `dist/main.js`

5. From now on, keep a shell with `npm run dev` running to keep the compiled file updated. After every change, run `Tools>Reload Plugins` on Insomnia.

There's another change on the deploy process. You must ensure that you run `npm run build` before publishing the plugin. This will create the actual compiled file and place it in `dist/main.js`, which is declared in `package.json` as the main entrypoint and will be run by Insomnia. Otherwise, if you publish releases from Github Actions or any other CI/CD, the `dist` directory will not be included. You may not need any changes if you publish from your own computer, since it's likely that you will have the requisite directory there.

## Links

* <https://insomnia.rest/> The main Insomnia page. Go there to see what it's all about.
* <https://docs.insomnia.rest/insomnia/introduction-to-plugins> Insomnia docs for plugins. The starting oint for all aspiring plugin developers.
* <https://betterprogramming.pub/how-i-built-my-own-insomnia-plugin-56ebb9dba5f> A tutorial by Tyler Hawkins about creating a new plugin. It has no UI.
* <https://github.com/johnataa/insomnia-plugin-runner> A plugin that shows a custom dialog using React. 
