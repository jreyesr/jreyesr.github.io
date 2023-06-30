---
title: "Reviewing ways of running \"that script\""
date: 2023-06-29T20:17:29.000-05:00
summary: "In this article, we will review a series of ways of hosting and running assorted scripts, using Python as a case study. We will start from a humble script hosted in a random user device, and progress up to a fully-featured platform to develop, run, test, monitor and authorize script runs."
tags: ['toolbox', 'low-code']
categories: ['python']
toc: true
---

In this article, we'll review a series of ways of hosting and running assorted scripts. We'll progress from the most basic to more advanced (and hopefully robust) ways of doing so, ending in a fairly robust platform, which is still reasonably flexible.

As part of the [Toolbox series](/tags/toolbox/), this article just recaps already existing tools that I have found over the ages. The idea is to provide a way of finding these tools if you know _what you need_ (as in, a robust way of running scripts), but not _what you need_ (as in, the exact name of the tool). See the difference?

## Introduction

Let's say that you have some scripts that do... stuff. Whatever. Maybe clean a database that sometimes gets in a weird state, and (of course) _there's no time_ to debug the application that causes the problem and fix it, because the one guy that developed it left three years ago. Maybe it's a daily report. Maybe it's the daily restart of that server that after a couple of days of continuous operation gets unbearably slow. Maybe it asks you for a client's phone and then prints out all of their contact information, to be used by your customer service team when needing to call a customer. Maybe it receives a (former) employee's email and then ensures that he has no account on any of several SaaS platforms that your company uses (because of course you do, and they aren't all tied together to [Okta](https://www.okta.com/)). Maybe it receives an Excel file that has former employees' emails and, for each one, does the things listed in the script just before. And so on. You'll know when you have _scripts_ to take care of.

Furthermore, assume that you are in the IT team (or, more likely, you _are_ the IT team) and thus are tasked with developing, maintaining and enhancing said scripts. Notably, the scripts may not come from you in the first place, nor may you be the one who runs them normally. The script that closes a former employee's accounts may have come from Joe in HR who took a Python course six months ago. The script that restarts a server daily may have been hacked together by a developer who got tired of being paged every two days because "the app is slow". The daily report may have been written by a manager who knew some SQL, then wrapped in some Python code by a desperate intern who was tasked by running it every three hours. And then, in some way or another[^1], all those scripts have migrated to you. And you want a stable, powerful way of:

* Hosting the scripts, in some official "production" environment (in other words, "anywhere but my laptop!")
* Making changes, hopefully with Git integration so code is never lost once committed
* Letting end users (who, remember, are most likely _not_ developers) run said scripts...
	* ...but only some scripts! HR has no business restarting servers, and if you give them the option, you know they will
* Have a better user experience than "here's a command prompt with a blinking cursor. To get a customer's contact info, run `./script.py me@example.com true 12 today"`". What does the 12 even mean?
* Playing with a script without altering the one that other people use
* Hide sensitive data, because while you may want to let people access a SQL DB, having them enter the DB password as part of the command line arguments just won't fly
* Scheduling some scripts, so they run without user input at certain intervals
* And more!

Now, notice that nothing in the requirements above is specific to your scripts' logic. It has no business logic. A platform that provides a graphical UI instead of a command prompt is agnostic to what you run inside of it: is it customer support code? Internal personnel management? AI thingies? Cybersecurity incident responses? Generic KPI reports from ticketing software? Cloud infrastructure management? All of the above?

Software engineers may recognize the hallmarks of [cross-cutting concerns](https://en.wikipedia.org/wiki/Cross-cutting_concern) here, if we treated every script as a module[^2]. Or, in the classification of [Windmill](https://www.windmill.dev/), it's "boilerplate", as opposed to "code that matters":

> * **Code that matters:** high-value code containing your business logic, data transformation, internal API calls, and all the logic of your internal long-running services and workflows. This is the crux of the value-added of your engineering. Usually that code is prototyped and started under the form of scripts and SQL files, until it is turned at great expense into micro-services and hard to maintain custom internal tools.
> * **Boilerplate:** all the rest is boilerplate. Be it UI and frontends that allow you to call the code above, API calls to external services, error handling, retries, logic to make your code scalable, dependency management, CI/CD, managing secrets, schedule, permissions, authentification, etc. That code is boilerplate because it feels like you shouldn't have to reinvent the wheel, over and over again.

Now, all the bullet points in our wishlist above fit neatly into "boilerplate". They don't really change the functionality of the code: the server will still get rebooted daily, whether from a script running from some poor soul's laptop at 2AM or from a fancy platform where the script is scheduled, complete with secure SSH key management to access the server, exit status monitoring, automated retries with backoff and Slack alerting after five failed attempts. It's just that, as developers, our pride is wounded by the first alternative. And that is not acceptable.

Hopefully, by this point, you have already determined if you have scripts to take care of, as we have defined them here.

If you do, then great! Carry on, and hopefully you'll find a solution to your woes, or at least some ideas.

Otherwise, maybe carry on too :). It may still be an interesting read.

## The stone ages: the script

The most basic incarnation of _the script_ is... well, a script:

(**WARNING:** Don't replicate anything you see in this script! It's evil! And ugly too. More on that below, but I really wanted to have an alert _before_ the code)

```py
import postgres

flag = True
phone = input("Enter the customer's phone: ")
while flag:
  if (phone!=""):
	  flag = False
  else:
    print("Please enter a phone number!")
    phone = input("Enter the customer's phone: ")
# Now we have a phone number

db = postgres.connect("psql://username:the_real_password@192.168.1.100:5432/customers")

cursor = db.cursor()
cursor.execute("SELECT * FROM table_customers WHERE phone='" + phone + "' LIMIT 1")

user = cursor[0] # There should only be one, because of the LIMIT 1

print()
print("=======================")
print("Phone: " + phone)
print("Email: " + user[1])
print("Company: " + user[3])
if (user[2] == true):
  print("User is ACTIVE")
else:
  print("User is INACTIVE")
print("Last purchase: " + user[4])
print("=======================")
print()
print()
```

Also, by the way, and as explained above, that code is intentionally _horrible_. It would get torn to pieces in [CodeReview.SE](https://codereview.stackexchange.com/). I know it, it's intentional. We're on the stone age after all!

To dissipate doubts, here's a (non-exclusive) list of that's wrong with it:

* `input` calls more or less force you to run it interactively
* [Flaaags](https://methodpoet.com/boolean-parameters/)
* Parentheses around `if` conditions
* The `input` call is duplicated
* Anemic input format checking
* Prints to stdout, thus complicating log exports
* DB credentials are hard-coded
* The DB cursor is never cleaned up
* [SQL injection](https://xkcd.com/327/) via the phone number
* Manually messing with cursors (what does `user[2]` contain?)
* Even more `print` calls
* [f-strings](https://realpython.com/python-f-strings/) are not used, strings are concatenated manually instead
* No functions, it's just a bunch of sequential code, thus no clear way to extract often-used bits of functionality
* Utter lack of error checking (or what the folks at Prefect call [negative engineering](https://www.prefect.io/guide/blog/positive-and-negative-engineering/))
* No [`if __name__ == "__main__"` construct](https://www.freecodecamp.org/news/if-name-main-python-example/), thus hindering reuse of parts of the code

_Phew_. That's enough ugly code for now. Onwards!

This script lives in someone's computer. For extra fun, it actually lives on seven people's computers (the whole customer service team), and two of them have an older version. These seven people use the script when a customer calls, so that they have some information about the customer, such as whether he has an active account (you need to treat them nicer) and the amount of his last purchase (the larger it was, the more careful you have to be).

Sound familiar?

Now, as a recap of what's... _non-ideal_ with this code, only from a infrastructure/logistical point of view (with no reference to code quality, since that can be fixed):

* It's repeated everywhere. Changes are _nasty_, as you have to distribute the Python file to several people
* Credentials are hard-coded in the file
* It runs from _someone's_ device, thus requiring the DB port to be wide open
* Said devices may change location over time, thus requiring the DB port to be _wider_ open
* No clear log of executions, nor a way of capturing output logs
* No error handling
* Only works when executed manually, no clean way of automating it

## The iron age: a better script

An incremental enhancement over the script discussed above could be:

```py
import os
from collections import namedtuple

import postgres
import click

UserData = namedtuple("UserData", "email company is_active last_purchase")

def print_user_data(user: UserData):
  print("\n" + "=" * 20)
  print("Phone: " + phone)
  print("Email: " + user.email)
  print("Company: " + user.company)
  if user.is_active:
    print("User is ACTIVE")
  else:
    print("User is INACTIVE")
  print("Last purchase: " + user.last_purchase)
  print("=" * 20 + "\n")

@click.command()
@click.argument('phone', 
                help='The phone of the user to search for.')
def find_user_data(phone):
  db = postgres.connect(os.environ["PSQL_CONN_URL"]))

  with db.cursor() as cursor:
    cursor.execute("SELECT email, company, is_active, last_purchase FROM table_customers WHERE phone = %s", (phone,))
    user = cursor.fetchone()

  if user:
    print_user_data(UserData(*user))
  else:
    print("No data found for phone", phone)
```

Furthermore, to continue the story, assume that this script no longer lives on seven people's computers, but on a single computer that fulfills a server-like role (mostly-always-on, probably runs Linux with no GUI, access via SSH, probably serves web applications or hosts batch processsing tasks, and so on).

With regards to the stone-age script, several changes have been made:

* The file is no longer spread across devices, but rather centralized
* Credentials are no longer hard-coded in the source code (people who can run the script still probably have access to them, but that's another story)
* The DB port can now be locked down so it only accepts connections from a single IP address
* It may now be possible to automate the script's execution (here it doesn't make much sense as its only side effect is printing to stdout, but you can imagine scripts that actually affect the real world, such as sending email reports or making changes on a DB), via good old [crond](https://man7.org/linux/man-pages/man5/crontab.5.html), since now the script takes arguments via CLI

Other problems, however, persist:

* It's still a raw Python script, and it requires end users to run it on a CLI
* You have now added an additional step (the SSH connection), plus the complexity of providing users with accounts on that server and ensuring that it doesn't represent an additional attack surface
* Credentials aren't really protected yet
* There's still not a clear log of executions
* There's still no automatic way of versioning the file. You may have a Git repo that holds the file and run Git commands to pull new versions, but that's on you
* If the script is automated, there's no good way of checking if it fails, maybe retrying, and alerting someone otherwise. No, "all executions are logged, so you can check if they succeeded" is not a complete monitoring strategy

## The steam age: Script Server and friends

At this point, let's assume that you are thinking: "well, that's a bunch of work that isn't really associated with my financial/shipping/manufacturing/legal/SaaS/education/whatever business! Surely someone has built a solution that gives me all the scaffolding to run scripts, so I just have to provide whatever business-specific logic I require"

So, being a ~~lazy~~ efficient engineer, you take to the Search Engine of choice, which in turn links you to the Coding Q&A Site of choice, where you find [this answer](https://stackoverflow.com/a/48057849) (which [isn't ChatGPT generated, just yet](https://www.vice.com/en/article/4a33dj/stack-overflow-moderators-are-striking-to-stop-garbage-ai-content-from-flooding-the-site)) to the question "How do I create a web interface to a simple python script?".

Now, armed with the tools mentioned in that answer (and the one above), you set out to try some tools.

### Wooey

[Wooey](https://github.com/wooey/wooey) is "A Django app that creates automatic web UIs for Python scripts". 

Okay. Straight to the point, I see. And it's [still active](https://github.com/wooey/Wooey/graphs/commit-activity), so... cool. There's [a demo here](https://wooey.fly.dev/), which I'll use along with [the docs](https://wooey.readthedocs.io/) to evaluate it.

Scripts need to use [the `argparse` stdlib-provided module](https://docs.python.org/3/library/argparse.html), which lets you define command-line arguments for the script (`--flag`, `-c 1`, variadic arguments, long/short-form configs, and so on). The scripts can be added via the [Django admin](https://docs.djangoproject.com/en/4.2/ref/contrib/admin/). 

Then, the main UI displays the scripts:

![88366a747b2e2db862de1fc2e8f5fa14.png](./_resources/88366a747b2e2db862de1fc2e8f5fa14.png)

Once you choose an iteration of a version of a script, you are prompted to choose any arguments that the script requires:

![2bda9c18492492b38b156fc5af31e194.png](./_resources/2bda9c18492492b38b156fc5af31e194.png)

From here, we can deduce that the script requires a Size argument, which probably was declared as `--size` if running on the CLI.

Then, you get this:

![449a570630b4519496a3838e13f6b66d.png](./_resources/449a570630b4519496a3838e13f6b66d.png)

Nice UI, by the way. The Console output is colorized and updates in real time. There's a list of files below (they aren't shown in the screenshot): two PNG files (which match the images displayed in the screenshot), and both ZIP and TAR files which contain said PNGs. Presumably so you download the file format that you need.

There are buttons to rerun the job (with the same arguments) and Clone it (which gives you a chance to change the script parameters, in case you want to just change one or a few params)

There's also [an API](https://wooey.readthedocs.io/en/latest/api.html#job-api) so jobs can be submitted from external systems. Very good to see. The API can also monitor job status. There's also [the possibility to create custom widgets](https://wooey.readthedocs.io/en/latest/customizations.html): for example, if you require a date, which would appear in the CLI as `--date-from=023/06/24`, it'll appear by default as a sad, plain text field. You can arrange things so it appears [as a date picker](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date) instead. Also amazing for sorta-custom UIs. Furthermore, there's a level of [authorization](https://wooey.readthedocs.io/en/latest/scripts.html#script-permissions), implemented by adding users to groups and limiting a script to certain groups only (so only HR can run the script that removes user accounts, for example).

Overall, seems quite neat. Graphical customization is almost entirely missing, but hey, it's for (very) internal tools only, so hopefully users won't complain (too much).

### Bugy's Script Server

[Script-server](https://github.com/bugy/script-server) is "a Web UI for scripts". See [the demo here](https://script-server.net/) (seems broken?), and [screenshots of the admin interface here](https://github.com/bugy/script-server/wiki/Admin-interface).

Much like Wooey, Script-server lets you register scripts that then users run, after selecting any script parameters. Unlike Wooey, Script-server is not tied to Python: it runs anything in the shell instead, so Python files require the [Python shebang](https://linuxize.com/post/bash-shebang/), and the same goes for Perl scripts, for example. This, on the one hand, means more possibilities; and on the other hand, it also means more manual configuration is required, since the server cannot automagically detect the script's arguments. Instead, you [configure the script's arguments in the web UI](https://github.com/bugy/script-server/wiki/Admin-interface#script-configuration-1).

It sports a [built-in editor](https://github.com/bugy/script-server/wiki/Admin-interface#script-code-editor), complete with colorization. It also logs all executions of a script, and provides you with the script's output, captured from stdout/stderr. If the script generates files, you can [configure that in the script's settings](https://github.com/bugy/script-server/wiki/Script-config#output_files), which makes said files available to the user who triggered the execution (great for file-transformation scripts that receive a file and somehow generate another file in response).

It also has the capability to [schedule scripts](https://github.com/bugy/script-server/wiki/Script-scheduling). It can manage users from [several identity providers](https://github.com/bugy/script-server/wiki/Authentication), and a script [can be locked down so only certain users can run it](https://github.com/bugy/script-server/wiki/Authorization#scripts-access). I couldn't see a way to lock down a script to a certain group, only to named users.

It seems to be quite similar in functionality to Wooey, albeit less coupled to Python scripts. There are small things which exist in Script-server which don't exist in Wooey (such as non-Python scripts, schedules and [alerts](https://github.com/bugy/script-server/wiki/Server-configuration#alerts)) and viceversa (such as API access, group-level authorization, automatic parameter detection and job queue monitoring).

### The Commercial One: Rundeck

[Rundeck](https://www.rundeck.com/), developed by PagerDuty, is "the leading OSS runbook automation platform".

The fact that it is built by [PagerDuty](https://www.pagerduty.com/), plus their tagline, already tells a story. PagerDuty is a platform aimed at "Operations teams", AKA the Ops half of [DevOps](https://www.atlassian.com/devops), AKA the people that manage servers and applications, ensure that they're up and working smoothly, scale servers up and down, deploy applications, and get paged in the middle of the night when any of the above doesn't happen. And they get paged, of course, in PagerDuty.

So, the PagerDuty page is filled with talk of "incidents", "responders", "on-call", "response automation" and so on. [Amongst those incidents are such diverse events as](https://www.youtube.com/watch?v=Cj8n4MfhjUc&t=89s) servers not responding, slow DB query times, high API call times, a queue getting too long, an external service's rate of 5xx requests going above a threshold, a server's CPU or RAM getting too high, and ~~nice red uniforms~~ so on. Whenever such a thing happens, you jump on PagerDuty, create a channel (which automatically creates a Slack channel, a phone bridge/Zoom meeting/whatever, a Google Docs file where important stages will be noted down, and so on) and then start calling people to Do Stuff.

Rundeck is the automated arm of PagerDuty. It's especially aimed at server management, since [Nodes](https://docs.rundeck.com/docs/learning/tutorial/creatingnodes.html) are a first-class concept (nodes are servers, more or less). Since "incident response" usually involves SSHing into servers to run commands, Rundeck's value proposition is that you hopefully have said commands already registered in the platform (and the target servers too!), so you can just point-and-click to several nodes (e.g. "all the frontend-serving nodes for the Acme application", if the Acme application is down) and run commands on them, in parallel (such as restarting the frontend server). No more [MobaXterm multi-execution mode](https://mobaxterm.mobatek.net/documentation.html#1_3).

Furthermore, you can also prepare [Jobs](https://docs.rundeck.com/docs/learning/getting-started/jobs/pieces-of-a-job.html#job-identification-information), which are sequences of Steps. Jobs can have [options](https://docs.rundeck.com/docs/learning/getting-started/jobs/pieces-of-a-job.html#options), which are roughly similar to script flags in the previous two tools explored. Unlike those tools, it implements its own data model for the code that will run when the job is triggered: instead of uploading a script file, you [define steps](https://docs.rundeck.com/docs/manual/job-workflows.html#workflow-steps) in the UI. Those steps can be scripts, but they don't have to.

Something that is really powerful in Rundeck is [the notification system](https://docs.rundeck.com/docs/learning/getting-started/jobs/pieces-of-a-job.html#notifications). You can choose to receive notifications when a Job starts, succeeds, fails, and even if it exceeds its average length, even if it hasn't failed yet.

My overall impression is that it's quite focused on Ops work. So, if you (and maybe your team) have an on-call rotation where incidents involve SSHing into servers, maybe give Rundeck a try. However, for our initial story of HR wanting to remove a user from SaaS tools, it's not that clear-cut anymore. There's talk of [using Node Sources](https://docs.rundeck.com/docs/learning/getting-started/jobs/node-sources.html#nodes-and-node-sources-overview) to (ab)use nodes to represent things that aren't either servers or network equipment, such as "something logical like a dataset", presumably so you can run reports choosing the dataset on which you want to run the report. However, then you start bumping into mental model mismatches. And you're on your own when it comes to representing said pseudo-nodes in Rundeck.

Otherwise, it's a really good bet. It's somewhat like [Ansible](https://www.ansible.com/), but with a pretty UI. Indeed, it has [first-class support for Ansible playbooks](https://docs.rundeck.com/docs/manual/workflow-steps/builtin.html#ansible-module) as Job steps and [Ansible inventory](https://docs.rundeck.com/docs/learning/getting-started/jobs/node-sources.html#adding-a-dynamic-source) as a Node provider.

## A detour: workflow automation tools

Before reaching our final tool (and the one that inspired this blog post to begin with), let's take a short(ish) detour to the world of workflow automation tools.

### Zapier, Make, Pipedream

[Zapier](https://zapier.com) and [Make](https://www.make.com/en) are cloud-based tools that mostly focus on reacting to changes on supported "apps" (here, mostly cloud services) and do "actions" in response, such as sending API calls to other apps.

The poster child is "whenever an email is received on account X, add a new row to a Google Sheets document with the subject and sender of the email, and also send a message to Slack so someone can review the email". Things like that.

Zapier is more linear (you can [add paths](https://help.zapier.com/hc/en-us/articles/8496288555917#2-set-your-path-rule-s--0-1) on some paid plans), while Make expresses branching semantics more clearly ([but not join](https://www.make.com/en/help/modules/converger)!). They are both fairly dependent on their built-in integrations for the best experience: Google Workspace is perfectly covered, and so is Slack, but your homegrown ticket management software won't be. There's usually an escape route in the form of a generic HTTP request node, though. However, keep in mind that then you're on the hook for actually implementing the API, and since they're cloud tools, you most definitely won't be able to install your own plugins/nodes/providers/whatever they're called.

Both of these tools mostly cater to workflows that react to an event somewhere, read some data from said event, and then perform some actions on other systems in response. Data ferrying, if you will. They aren't quite fit for our initial problem, which was running scripts on demand.

Sure, [both](https://www.make.com/en/help/apps/communication/slack) [of them](https://zapier.com/apps/slack/integrations#triggers-and-actions) support reacting to Slack messages, for example, so you could as well build the script around receiving messages from users via Slack. Zapier even has [custom UIs](https://zapier.com/interfaces). Still, it's not really their expected usecase. However, they are still quite useful in their own right.

[Pipedream](https://pipedream.com/) is quite similar to Zapier, in that it's a mostly linear tool that focuses on reacting to events and running actions in response.

### N8N

I place [N8N](https://n8n.io/) in its own section because the workflow-building model is quite different: you build an arbitrary [digraph](https://en.wikipedia.org/wiki/Directed_graph) of nodes instead of a mostly linear path (in the case of Zapier and Pipedream) or at most a tree (Make).

It's also self-hostable (indeed, I have an instance running right now. It reacts to a blog post being made and reposts it on my LinkedIn account). Being self-hosted, adding new integrations is easier ([I built one a few weeks ago](https://github.com/jreyesr/n8n-nodes-carbonejs)), and also well documented.

While you can manually trigger workflows or declare webhooks that initiate a workflow execution in response to a HTTP request from an external system, there's no UI to trigger a workflow while providing parameters. There's [a third-party node](https://www.npmjs.com/package/n8n-nodes-form-trigger) (actually, it's built by one of the developers of N8N, so it's more of a first-party node, really) that adds HTML forms that users can visit, but it's a really clever hack: it's a Webhook trigger, but it reacts differently to GET and POST requests. Upon receiving a GET requests, it responds with HTML. Said HTML contains a standard form with `action` set to itself and `method` set to POST. Then, when you submit the form, the same webhook is activated, except that it now takes a different code path and actually triggers the rest of the workflow. Clever, but still not a first-class citizen on N8N.

So, to recap, N8N is very good at defining the actual actions that happen during the execution, not so much at providing you with a way of actually triggering said execution.

And now, after our detour into workflow automation tools, we go back to ways of running scripts. If you'll recall, we left at the point of using tools such as [Script-server](https://github.com/bugy/script-server) or [Wooey](https://github.com/wooey/wooey), which provide a comfortable, safe environment to upload scripts and let users trigger them, while varying the input parameters. These tools also provided us with additional tooling such as versioning, authentication and authorization, customizable UI elements for input parameters, downloading generated files, an execution log, alerts when executions fail, and more.

## The space age: Windmill

Finally, after nearly 4K words, we reach the tool that prompted this post in the first place: [Windmill](https://windmill.dev). Its `<title>` element contains the text "Open source platform to build internal tools with scripts". Its homepage lists the following goodies:

* Make your scripts production grade and build all of your internal tools with Python, Typescript, Go, Bash, Sql. 
* Compose your scripts as workflows using low-code.
* Share an autogenerated UI or build one using low-code. 
* Run it reliably at scale on your infra or ours, with permissioning and monitoring included. 
* Fully open-source and easy to deploy on small and large infra. 
* Any dependency with zero-config.

Well, that's a lot of stuff. Scrolling down further reveals even more things:

* Secret management, to let users consume certain secrets (such as DB credentials of SaaS API keys) without viewing them
* Executions can be triggered manually from the UI, on a schedule, via webhooks (HTTP requests to Windmill) or via Slack
* A [Hub](https://hub.windmill.dev/scripts) where people share scripts
* Approval steps, to pause a workflow at a certain point and ask people for approval
* A GUI builder that uses drag-and-drop, in the spirit of Retool, Streamsync and Superblocks (I have written more about such tools in [a previous post](https://jreyesr.github.io/posts/streamsync-review/#comparison-with-other-low-code-app-designers), so go read that section if these tools sound interesting)

Furthermore, one of their job listings provides some more information on their motivations: 

> On the other hand, writing code is only 10% of the work. You then have to deal with credentials, separatig sensitive values, deploy your script through CI/CD, handle permissions, build a UI, handle errors and so on.

So, yes. It fits our original problem: you have a script that does work, and now you have to... well, _productionize_ it. I'd [[citation needed]](https://xkcd.com/285/) that 10% number, but the idea seems correct. It takes a lot of work to go from a script that _works_ to something that works, and is also usable by non-technical people, scales well, is secure, can be easily upgraded (and downgraded, because stuff happens), is monitored, "and so on".

Okay. Let's get started!

### Installation

Because we like to self-host all the things, we'll use [Windmill's installation docs](https://www.windmill.dev/docs/getting_started/how_to_use_windmill) to spin up a local instance.

The UI looks like this:

![2d6060811cabd00f6ed759ae8b7c5e6a.png](./_resources/2d6060811cabd00f6ed759ae8b7c5e6a.png)

The main namespacing tool in Windmill are [workspaces](https://www.windmill.dev/docs/reference#workspace). Users, scripts, variables and everything else are contained in workspaces. Presumably, that's what the [Windmill Cloud](https://app.windmill.dev/) uses to provide multi-tenancy. The default workspace is called `admins` and it contains scripts for maintenance of the actual Windmill installation. After that, let's create a Script.

### Scripts

Scripts are the main building block at Windmill. They are small-ish units of work, which can be run by themselves or be chained together in Flows (we'll look at those later). Scripts can be written, as of now, in Typescript, Python, Go and Bash. There's also Postgres and Docker, but those don't fit in the "script" category quite well, so we'll ignore them.

Since that's what this post is about, let's choose Python:

![d18d00f3aa1c0638054773b788530d1f.png](./_resources/d18d00f3aa1c0638054773b788530d1f.png)

Some points of note:

1. Scripts are saved either under a user or under a folder. Those are different ways of assigning permissions: if you save a script on a folder, you can provide some users with access to a folder and they'll automatically get access to any scripts saved there
2. Here are the available languages
3. There are "worker group tags". Windmill runs scripts in separate worker processes, which are usually sitting in a loop waiting for tasks to run (it's [a job queue](https://en.wikipedia.org/wiki/Job_queue)!) This lets you constrain the workers that will run this script. The tooltip mentions, as examples, `highmem` and `gpu` tags, which could correspond to grunty machines to run heavy data-crunching jobs and machines with graphics cards to run AI inference tasks, respectively. Another use would be to constrain scripts that contact a service to a single machine, so said remote service can be locked down to only one source IP, or to place a worker node in a regulated environment, in the spirit of a [SSH jump host](https://goteleport.com/blog/ssh-jump-server/), except without the SSHing
4. This is the actual editor. I spy a "Multiplayer" switch at the top. Does that mean that if multiple people edit the script at once, you'll get multiple cursors and a presence UI? Cool if so. Sadly, it's an Enterprise feature

Now, this is the example script (for Python. Other languages get their own examples):

```py
import os
import wmill

# You can import any PyPi package. 
# See here for more info: https://www.windmill.dev/docs/advanced/imports#python

# you can use typed resources by doing a type alias to dict
#postgresql = dict

def main(
    no_default: str,
    #db: postgresql,
    name="Nicolas Bourbaki",
    age=42,
    obj: dict = {"even": "dicts"},
    l: list = ["or", "lists!"],
    file_: bytes = bytes(0),
):

    print(f"Hello World and a warm welcome especially to {name}")
    print("and its acolytes..", age, obj, l, len(file_))

    # retrieve variables, resources, states using the wmill client
    try:
        secret = wmill.get_variable("f/examples/secret")
    except:
        secret = "No secret yet at f/examples/secret !"
    print(f"The variable at `f/examples/secret`: {secret}")

    # Get last state of this script execution by the same trigger/user
    last_state = wmill.get_state()
    new_state = {"foo": 42} if last_state is None else last_state
    new_state["foo"] += 1
    wmill.set_state(new_state)

    # fetch context variables
    user = os.environ.get("WM_USERNAME")

    # return value is converted to JSON
    return {"splitted": name.split(), "user": user, "state": new_state}
```

So, the expected interface is a `main()` function. Its parameters are treated as input fields in the autogenerated UI (we'll see that soon). It can require strings, numbers, and more complex fields such as dictionaries, lists or binary strings.

Inside the `main()` function, you can do standard script stuff (loops, conditionals, and other pure operations) as well as interacting with the external world:

* As the comment at the top helpfully indicates, you can declare a dependency on any Python package[^3]. The importance of this cannot be overstated, as you get access to a huge amount of prewritten code. Ditto for NPM and Go packages
* Thus, you can (for example) access DBs by using the appropriate package (such as [psycopg2](https://pypi.org/project/psycopg2/) for Postgres), HTTP APIs via [requests](https://requests.readthedocs.io/en/latest/) or gRPC APIs via [grpc](https://grpc.io/docs/languages/python/basics/)... or, if you're lucky, the remote service that you need to interface with has a [Python package](https://stripe.com/docs/api?lang=python) that eases your life.
* Secrets are consumed by requesting them from the runtime via `wmill.get_variable`. They must, of course, already exist and have been configured so the script can access them
* The script can introspect its own state, set state that persists across executions (so scripts have memory, such as remembering the last ID that has already been handled, or the time of the last execution)
* Scripts return data normally, as dicts

A nice feature of Windmill, and one that we'll keep seeing, is the automatically generated UIs for scripts. See the right-hand pane below:

![6d7605d813fa0a753546e6ea55eef7a2.png](./_resources/6d7605d813fa0a753546e6ea55eef7a2.png)

As you can see, it's a form-like UI, filled with input fields, which matches the input parameters for the script's main function. 

* A basic string-typed parameter will generate a plain text field
* Integer-typed parameters will generate number fields, which only accept numbers and have the up/down arrows
* Plain dict/objects are rendered in a nice JSON editor, courtesy of [the Monaco editor](https://microsoft.github.io/monaco-editor/) (the same editor that powers the main script visualization, and VS Code, incidentally)
* Binary strings by default become file input fields, since that's the most common usecase for binary strings
* Arrays of strings (lists in Python) are rendered in a more complex UI that lets you add new items, edit them and delete them. See below:

![946bcd321573e639de7565d5dded30f7.png](./_resources/946bcd321573e639de7565d5dded30f7.png)

Then, there are deeper customizations that can be configured on the fields:

* String fields can be configured as enums (a choice of a limited set). Some languages, such as Typescript, can automatically infer enums from [literal union types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types). This switches the UI element from a plain text input into a `<select>`/dropdown.
* String fields can be configured to have a format, such as emails, URLs, IPs or SQL 
* String fields can be provided a regex string that will only accept strings that match said regex
* Arrays can be similarly configured to accept strings, strings from a list of choices, files or numbers

Once the script has been tested, saved and deployed (Windmill distinguishes these two steps, so you can keep working on a script without disturbing other users who may already be using a previous version), you can then access a "Run UI" from which you can formally trigger the script:

![e10074b529000a86ed56bb89f4ba1f5a.png](./_resources/e10074b529000a86ed56bb89f4ba1f5a.png)

This UI looks much like that on the editor, but it's "just" the run UI without a code editor. It's intended for end users. This is what you provide non/less-technical users with access to. From here, they can run the script, constrained by whatever limits you (as the script's developer) have provided: for instance, requiring them to enter certain data, or limiting them to choosing one option from a set, instead of entering data at will. Of course, you can also do additional checks on the data when your script is running: say you want them to only enter a phone number that belongs to a customer. The most you can do with field constraints is to force them to enter a phone-like number, but checkin g if it actually belongs to a customer must be done inside your script. That is possible too.

Once the user clicks the Run button, the script... runs (gasp!)

![3cb7766f986cb6cdf9ddfd6099d3fe6e.png](./_resources/3cb7766f986cb6cdf9ddfd6099d3fe6e.png)

This new page shows you information about the run (such as the time and memory taken), the data with which the script ran, and (below) the results, which are the data returned by the script's main function. Another tab displays the logs, which are anything passed to the language's `printf()` function, or however it's called.

As a sidenote, it's very nice to see that every run has its own ID. Good for "I ran the script and it failed!": you can ask for the run ID and jump in directly to the run in question, so you can check the input parameters, the error messages and such. No more scrolling through the list of runs to find a failed run by the correct user in a certain time range.

### Timeout: recapping the nice-to-have list

Way, way back, in the [Introduction](#introduction), we set down a list of features that we wanted a script-hosting platform to have. I'll copy them here, with notes:

* Hosting the scripts, in some official "production" environment (in other words, "anywhere but my laptop!"): Check. Scripts will now run in a centralized environment (or rather, they'll run on worker nodes, in much the same way as [Github Actions has runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners). In any rate, the scripts will run in controlled and configurable environments)
* Making changes, hopefully with Git integration so code is never lost once committed: Half-check. We can make changes and versions of scripts are preserved, Git integration isn't built-in. However, you [can use a Git repo as a source of truth](https://www.windmill.dev/docs/deploy_gh_gl), and instrument it so that any pushes to `master` are pushed to Windmill. This could theoretically be used in the other direction too, to query Windmill's API periodically and save it all to Git.
* Letting end users (who, remember, are most likely _not_ developers) run said scripts...: Check. You can provide users with accounts, and add them to groups that can only run scripts, not edit them
	* ...but only some scripts!: Check. Users from different departments could be added to different groups, which would grant them access to different sets of scripts
* Have a better user experience than a command prompt where users have to enter commands: Check. The auto-generated UIs should let users provide parameters more easily. You can even add descriptions!
* Being able to play with a script without altering the one that other people use: Check. There's separate buttons for "Save" and "Deploy"
* Hide sensitive data, such as credentials: Check. We haven't explored that (yet), but Windmill has [Resources](https://www.windmill.dev/docs/core_concepts/resources_and_types), which encapsulate pieces of data such as passwords. For example, there's the PostgreSQL "resource type", from which you can register different Postgres instances as "resources". Said resources (e.g. "the connection to the database of the Acme application in prod") can then be selected when running scripts, as a dropdown that doesn't expose the credentials
* Scheduling some scripts, so they run without user input at certain intervals: Check. Every script can have a primary schedule and many additional schedules, which take a cron-style string. Flows do too, as we'll see

So, up until now, we've already covered everything, more or less. But there's more: scripts are only one of the three main selling points of Windmill. Now, we'll cover flows: which are sequences of scripts that can execute entire workflows.

### Flows

> To sum up roughly, workflows are state machines represented as DAG to compose scripts together.

Okay. A bit of graph theory first. A DAG is a Directed Acyclic Graph, AKA:

* Directed: it has arrows that mark a direction. You can't traverse the arrows in reverse
* Acyclic: there are no cycles. There's no way to follow a path of arrows and visit the same node twice
* Graph: A set of nodes connected by edges

Here's a DAG for you:

```mermaid
flowchart LR
	A --> B & C --> D
	C --> E
```

Now, DAGs are really popular in the workflow-building space. Tools such as [Apache Airflow](https://airflow.apache.org/) and [Temporal](https://temporal.io/) essentially provide you with tools to define a DAG, and Airflow even displays that name in the code.

The reason why DAGs are common when defining workflows is that... well, they're the same. A workflow is a set of tasks (nodes) connected together by dependencies (edges), which are directed (the fact that B depends on A does _not_ mean that A depends on B. In fact, it better not, since otherwise you can't start either of them. Therefore, dependencies are not symmetric, hence directed). And workflows better not have cycles because, if they do, they'll never finish.

So that's why Windmill also models workflows as DAGs.

This means that flows will have a beginning and one or more ends (duh). In the middle, you can do pretty much any combination of Scripts that you want, as long as you don't introduce dependency cycles. In practice, Windmill tends to steer you towards a mostly-linear path: though you can branch out for parallel processing or `switch`-type statements, Windmill then adds a join node that drives the execution back together. Forget about arbitrary topologies such as those allowed by N8N.

Flows build upon Scripts: every node in a flow _is_ a script. The only new part is how you pass data across nodes.

Basically, much like other similar workflow design tools, every node outputs its own data. Any nodes that come later in the execution chain can use the data output by previous nodes as input data. For instance, here's a simple flow:

![6882b1554f535ccc44615967706b63e8.png](./_resources/6882b1554f535ccc44615967706b63e8.png)

The first node, tagged `b`, reads a RSS feed (here, it's connected to this blog) and outputs any posts that haven't been seen before. The second node, tagged `c`, is a very simple Python node that receives a list and returns its length:

![b51103c8abdf494887f3093fe0755868.png](./_resources/b51103c8abdf494887f3093fe0755868.png)

However, as you'll notice in the screenshot above, the step's input (creatively named `x`) is configured to the value `results.b`. This is Windmill's syntax for "the results of the node with ID `b`", which here is the RSS node (I had a node `a` before, but I deleted it, so that's why the first node has ID `b`).

This is the way in which you pass data across nodes. Any nodes that require some data access it by referencing the ID of the node in which said data was generated. Of course, you need to refer to nodes that come earlier, since there's no sense in referencing data that hasn't been generated yet.

![d9aa551dc75846791a24b1919453200d.png](./_resources/d9aa551dc75846791a24b1919453200d.png)

Flows are saved and deployed using the same two-phase process as scripts. They also have the same auto-generated UI for input parameters, which here can be used by any node in the flow. They can also be scheduled.

So, to recap: if your logic fits neatly in a single script, make it a Script. If you need to, say, hit multiple external systems, consider splitting that into separate Scripts and joining them together via a Flow. External users can invoke both.

### The app builder

The third and final main tool in Windmill's arsenal is the App Builder. It lets you design graphical interfaces, much in the style of Retool and similar internal app builders. Again, I went into those tools in more detail in [the previous post](https://jreyesr.github.io/posts/streamsync-review/#comparison-with-other-low-code-app-designers), though it's by no means comprehensive.

This category of tools (sometimes "internal app builders" or "low code app builders") provides you with a canvas where you drag-and-drop "widgets" (names may vary). These widgets range from very simple (a Text element) to very complex (an [entire Form](https://retool.com/components/json-schema-form); a [data table](https://docs.tooljet.com/docs/widgets/table) with sorting, pagination, fuzzy search and inline editing; or a [map](https://docs.budibase.com/docs/map), to name just a few).

Visual layout is usually accomplished by dragging widgets to the canvas and then resizing them as desired. Static properties (such as the helper text on an input field) are configured too. Then, dynamic properties (those that either change depending on user input or come from data fetched as the app loads) are configured too.

Furthermore, actions are usually configured on widgets. For example, if you have dragged a Button field, you'll find somewhere a "On Click" setting where you configure what happens when the button is clicked. This is what you use to perform actions. Other events could be "a table row was clicked", "a text field's content changed" or "a certain query finished".

Windmill is special in this regard because it merges the frontend side (the UI) and the backend side (in the form of Scripts and Flows). Other tools tend to show a divide: other low-code app builders let you build UIs and call to pre-built APIs (think Stripe or Google Workspace) but can get cumbersome if you need to perform custom processing, while workflow automation tools may lack the UI. Special mentions here to [Retool, which has Workflows](https://retool.com/products/workflows/), and [Zapier, which has Interfaces](https://zapier.com/interfaces). Here you can see examples of tools from both sides reaching over to the other side: Retool was originally a UI builder that added scripts for automation, while Zapier was originally a workflow designer that added UI capabilities.

Windmill, on the other hand, was designed with both sides in mind, AFAICS.

Let's write a simple UI. It will list all the posts [in this blog](/), and let us cross-post them to LinkedIn. I already have a workflow in N8N that does that, but it's fully automatic and has no UI, since that's awkward in N8N. Let's see how easy that is in Windmill.

First, we need to read [the RSS feed of the blog](/index.xml), which is automatically generated, courtesy of [Hugo](https://gohugo.io/templates/rss/). We'll use that data to populate a table.

![5ee0c14a80b4f4a3f18dad168cdefea2.png](./_resources/5ee0c14a80b4f4a3f18dad168cdefea2.png)

1. We first have to create a "Background Runnable", which is a detached script (i.e., one that lives by itself, as opposed to a script that is attached to an event handler. More on those later)
2. That script gets filled with code to read and parse an RSS document
3. Since the `main()` function declared a parameter of type `Rss`, that is exposed as a script input. I have already declared a Resource of type RSS, which is configured to point to the blog's RSS feed URL
4. The Background Runnable, by virtue of being Background, won't run by itself. Since here we configure it so it runs on app start, its output data (which is a list of posts) will be available to the rest of the application

Then, on the Canvas (which is the UI at the top center), we can add a Table and configure it:

![82a664c0e8b1e852a35184880c499b6c.png](./_resources/82a664c0e8b1e852a35184880c499b6c.png)

1. We add widgets (here, a table) by searching for them in the Add menu here
2. The Table was dragged to the Canvas
3. By default, the table is filled with some static, example data. Here we connect it to the runnable's output (as displayed by the pills that say `bg_0` and `result`), which makes the table display the post's information
4. Tables can also have Actions, such as the blue "Post!" button. More on that later

The magic part that connects the Runnable that parses the RSS feed to the table is called a "Connection". When configuring the table, you can make its source data be static (such as when a table is just added) or "Connect" it to an output, either from other widget or from a background runnable. Here we use a runnable that is executed on app load, so it'll always be available.

See below for the process: we start with some static data in the table, and then change it to a Connection. We are then prompted to choose the source data, which here is the runnable's output, which appears on the left panel:

![connect.gif](./_resources/connect.gif)

Once the table has post data, we need to make the button do something. Once the action button is selected, the right-hand panel switches to its configuration:

![b9c0f2c66f410dbb60005e6fa2fc6cf2.png](./_resources/b9c0f2c66f410dbb60005e6fa2fc6cf2.png)

1. Note that we have the actual action button selected
2. We have added an event handler for the click event
3. This is the code of the event handler. It's another script, which here wants to be provided with LinkedIn credentials, a "text content" and a URL
4. Again, these are the script's inputs. Two of them are static, the other two are connected to properties of the table: we use the selected row, since clicking on a row button automatically selects the row. The `content` input, which becomes the LI post's text, is taken from the post's `description` in RSS. The `postUrl` input, which becomes a URL in the LI post, is taken from the post's permalink in RSS

The script (3) implements calls to the LinkedIn old API, and it creates a post. It returns the post's URN, but we don't use it.

That's all that is required! We can read data from remote datasources (here it's RSS, but it could as well be SQL DBs or SaaS APIs), we display them (here in a table, but it could also be charts, repeated items or something else) and we take actions on user interaction (here we call the LinkedIn API on button click).

It's also worth noting that I didn't have to implement any of the two scripts from scratch. The RSS script was based on [this script](https://hub.windmill.dev/scripts/RSS/1529/rss-feed-fetcher-RSS), minus the logic to deduplicate posts (so you only see them once). The LinkedIn script was based on [this other script](https://hub.windmill.dev/scripts/linkedin/983/create-a-simple-post-(user)-linkedin), plus some extra parameters to share an external URL (the sample creates a text-only post). That may point to many common usecases having a script that you can use as a base, which is a _huge_ plus, especially when you don't really know the platform, since it's usually far easier to take something and modify it.

[Here](https://hub.windmill.dev/apps) are some community-designed Apps to give you some ideas. I see an app that implements an S3 explorer (like a file manager, but for S3), a tiny CRM from which you can see all your customers and send them impromptu email messages, and a simple issue tracker.

### App import

Something that I haven't seen on any other low-code UI designer is the biggest escape hatch of them all: [being able to import React, Vue or Svelte apps](https://www.windmill.dev/docs/react_vue_svelte_apps/react).

The importance of this functionality is difficult to overstate. I haven't tested it, but in theory it should allow you to take complete control over the look, feel and interactivity of apps. This should take Windmill to the level of [Airplane](https://www.airplane.dev/), except open source and only when you need to. The rest of the time, you can keep working with prebuilt components.

If your usecase requires further graphical customization, or maybe exotic components ([a flow editor](https://reactflow.dev/), or maybe [a Pong game](https://ohall.github.io/react-pong/)), try this functionality.

A limitation is that, as far as I can see, you can only import entire apps, not widgets. I have no idea of the complexity that would go into embedding React-based widgets on normal Windmill apps. So keep that in mind: if you want React, you get React for everything.

## Recap

* The task of running scripts (typically implemented in languages such as Bash or Python) can easily escalate into a lot of requirements that don't have much to do with the content of the scripts in question:
	* Hosting the scripts in a stable location
	* Authentication, authorization and permissions
	* Scheduling the scripts
	* Running the scheduled scripts out-of-schedule
	* Monitoring run time
	* Alerting if a scheduled execution is missed
	* Alerting if an execution fails
	* Getting data or files _out of_ the script's execution
	* Giving users the ability to use secret credentials without seeing them
	* Letting non-technical users trigger the scripts
	* Handling versioning, updates while the script is being used and backups
* The simple solution (scripts hosted in user's devices) does _not_ scale well
* Hosting the scripts in a shared server accessed via SSH is slightly better, but still quite technically involved and not user-friendly
* Tools such as the [Script-server](https://github.com/bugy/script-server/) or [Rundeck](https://www.rundeck.com/) provide a more featured platform to develop, run and evolve scripts
* [Windmill](https://www.windmill.dev/) goes even further, merging simple/atomic scripts, a flow editor for running complex workflows, and an app editor for GUI design. It neatly solves most, if not all, of our requirements above: from authorization to versioning, schedules and running out-of-schedule, alerts, data export and more. It also has a [hub](https://hub.windmill.dev/) where users share scripts, which can be used to kick-start development
* Windmill seems to be especially useful for internal applications, where you can provide users with an account, give them the appropriate permissions and limit their actions by judicious use of input validations. Assuming the correct guardrails are in place, you have yourself a fairly robust system for users to do _things_
* Said _things_ have very few limitations in Windmill, since you have three very robust programming languages (TS, Python and Go), each with a very extensive library of packages


[^1]: [Osmosis](https://en.wikipedia.org/wiki/Osmosis). It's always osmosis.
[^2]: Granted, the scripts aren't really modules in a unified system, but whatever.
[^3]: I'd take the "any PyPI package" line with a grain of salt: there are packages that require additional OS-level dependencies, and that can get nasty in a hurry. However, as long as the package does not depend on [exotic FORTRAN libraries](https://numpy.org/doc/stable/user/c-info.python-as-glue.html) or somesuch, you should be OK.
