---
title: "Coopting Terraform into generic API management, Part 1"
date: 2023-06-02T20:06:15.000-05:00
summary: "This article explores the usage of Terraform as applied to the problem of configuring generic APIs (i.e., those not related to cloud infrastructure). The motivation is to declaratively control APIs that only expose an imperative interface (such as essentially any REST-ish API)"
tags: ['experiments', 'iac', 'rest']
categories: ['terraform']
---

TL;DR: How can we take a random REST API and make it declarative? In other words, instead of sending a POST request to create a third Widget called Great Widget, you *declare* that the application should now three Widgets, the third one being called Great Widget. _Something_ should then take your desired state (three Widgets), compare it with the current state (two Widgets), figure out that the first two Widgets are unchanged and there's a new one, and then issue a create command for the new Widget. Once said Widget is created, its hunger for order and equality will be satisfied, and it should go back to sleep since the desired state matches the current state... until such time as something changes (either you change the desired state, or someone or something changes the actual state), at which point it should wake up, drive the actual state to match the desired state (never the opposite! Things don't work that way!), and then go back to sleep, and so on. Forever.

This post is about the _something_ that encapsulates the required logic: check the world's state, compare with the desired state, find differences, and change the world so it matches the desired state.

This is somewhat of a different post. It contains my explorations into something that I don't know, and on which the Internet is silent (or, at least, I couldn't find anything. Perhaps I just didn't use the correct search terms). I present no definite solutions, just weird, hacky solutions. I offer them so that other people with the same problem, if any such people exist, may get some ideas.

So, take this as an example of [hacking, in the original sense](https://stallman.org/articles/on-hacking.html): "exploring the limits of what is possible, in a spirit of playful cleverness". I can't vouch for the cleverness, but this article certainly explores limits that, as far as I could find on The Googles&trade;&copy;&reg;, haven't been explored before. Besides, "hacking does not need to be useful", so that's my excuse if this is all completely useless.

## Problem statement

Every web developer is (hopefully) familiar with REST APIs. They're currently very common, though I have no numbers to back that up.

You can spot a REST(ish) API from a mile away because it looks like this:

|Method|/widgets|/widgets/1|
|---|---|---|
|GET|Retrieve all Widgets|Retrieve details of widget with ID 1|
|POST|Create a Widget|(maybe) Edit the information of Widget 1|
|PUT/PATCH|Nothing?|(maybe) Edit the information of Widget 1|
|DELETE|Delete all Widgets (not common)|Delete Widget 1|

This is often contrasted to RPC-style APIs, where there is either 
* one single URL and operations (e.g., `getWidgets`, `getWidget`, `createWidget` and so on) are passed as body parameters, typically using the POST method exclusively, or
* URLs that reflect the possible actions (`/api/getWidgets`, `/api/getWidget`, `/api/createWidget` and so on), with any extra data being passed as body params as above

RPC-style APIs are conceptually similar to function calls in programming languages: `getWidget(id=1)`. Curiously, I haven't been able to find modern examples of such APIs, apart from [some](https://ethereum.org/en/developers/docs/apis/json-rpc) [cryptocurrencies](https://docs.near.org/api/rpc/introduction), so...

Also, a note. Here I'll say REST to mean "more or less REST-like, even if not at [Level 3 of the Richardson Maturity Model](https://www.crummy.com/writing/speaking/2008-QCon/act3.html)". In other words, I'll call an API RESTful even if it doesn't embed hyperlinks for related resources. Sue me :)

So, to recap, you spot REST APIs because they expose URLs for "collection of resources" and "single resource", operations on those resources (Create, Read, Update, Delete) are encoded on HTTP verbs/methods, and any related data is passed as query strings or body parameters. They usually prefer JSON over XML (shudder). They may have [Swagger/OpenAPI documentation](https://editor.swagger.io/).

The problem is as follows: **you have a random REST API that does things. You want to control that API declaratively, by stating the desired end state instead of the commands to achieve that state. How do you do it?**

## A toy example

To ground that, let's look at an example: [Firefly III](https://www.firefly-iii.org/), "a free and open source personal finance manager". It provides facilities to register income, expenses, bank accounts and such. Then, the standard graphs where money goes up and down, double-entry bookkeeping (even though it's not that useful in the digital age, since Firefly auto-computes one side of the ledger, so no protection against mistyped entries), recurring transactions, integration with a few bank export formats, and so on. Play around with [a demo](https://demo.firefly-iii.org/) if you wish.

Notably, it features [a REST API](https://api-docs.firefly-iii.org/) through which you can drive probably all its functions, such as accounts, transactions, tags, piggy banks (dedicated budgets), application users and so on. Each of those resources has a bunch of API endpoints that let you read, create, update and delete them.

So, for instance, if you had a blank Firefly instance and you wanted to "seed" it with some standard accounts, you'd need to run something like this:

```bash
curl -X 'POST' \
  'https://demo.firefly-iii.org/api/v1/accounts' \
  -H 'accept: application/vnd.api+json' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "My checking account",
  "type": "asset",
  "opening_balance": "0",
  "opening_balance_date": "2023-06-02",
  "currency_id": "12",
  "currency_code": "EUR",
  "account_role": "defaultAsset",
  "monthly_payment_date": "2018-09-17",
}'
```

This creates a single Asset account, such as a bank account. What about expense accounts? Firefly recommends creating several expense accounts, such as "Food", "Clothing", "Education", "Taxes", "House", "Car" and more. Creating all of these can get tiring.

Sure, for your own Firefly instance you may as well do it by hand. There's no point in spending several weeks automating it. However, remember that Firefly is only an example; substitute your favorite REST API here, especially if you need to configure multiple copies of it (different "user accounts", "instances", "tenants", "organizations" or however the service in question namespaces information). Bonus points if you have to do it continuously, such as if you provide a service that requires you to provision new copies of a third-party service.

In the case of Firefly, suppose you run an accounting service where you do accounting for other people who can't/don't want to do so themselves: doctors, let's say, who (one would hope) far prefer to attend to patients than enter bills and expenses into a system and reconcile them with bank account transaction logs. Let's say that, as part of your accounting business, you provision a Firefly instance for every doctor that hires you, provision some user accounts (one for you, one for the doctor, the latter read-only) and some standard income/expense sources, subject to changes for each particular case. Now we have a better justification for an automated provisioning system.

### What could the solution look like?

You could implement that as a script that calls a bunch of REST endpoints to create the required resources, and that's a perfectly legitimate strategy, buuut:

* It only works for provisioning new instances, not for managing them once created (in other word, what is [sometimes](https://jjasghar.github.io/blog/2016/09/01/day-0/) [called](https://www.linkedin.com/pulse/day-zero-automation-ailoje-john-ojo) Day 0)
* Related to the above, it can't some configuration to already-existing instances (say a new tax gets passed, country-wide, which would warrant a new expense account. Or think of adding a new account for a new employee of your accounting firm into all your currently-managed instances). Any such changes require new, one-off scripts to make the required operations
* You can't repeatedly run the scripts, as doing so would either a) create duplicated data, or b) fail in the second and subsequent executions, since there would already be a resource with that identifier. You'd need to think about all possible cases where some resources were created and others weren't, which gets nasty once dependencies are in play (if creating resources of type B requires a resource of type A to exist)
* There wouldn't be an article if we stopped here, now would we?

What if, instead, you had some sort of file that encoded a "current state" of the instances?

```yml
# dr_quacks_instance.yml

version: 6.0.11

users:
  - email: me@accounting.com
    pass: my_general_password
  - email: drquack@gmail.com
    pass: sup3r_s3cr3t!

accounts:
  assets:
    - Bank account
    - Cash drawer in office
  income:
    - Visits
    - Surgeries
    - Bank interest
  expenses:
    - Salaries
    - Transportation
    - Office rent
    - Office maintenance
    - Taxes
    - ...
	
scheduled_transactions:
  - name: Yearly govt permit
    account_from: Bank account
    account_to: Taxes
    amount: "500.00"
    schedule: "0 0 1 1 *"  # crontab format, trigger on January 1st
  - name: Office rent, monthly
    account_from: Bank account
    account_to: Office rent
    amount: "2000.00"
    schedule: "0 0 * 1 *"  # crontab format, trigger on 1st day of every month
```

This YAML file could encode the configuration of Dr. Quack's personal Firefly installation, complete with:
* The version of Firefly that we want him to have (since some users may have grown used to a specific version's UI, or actively use some feature that was later deprecated)
* All the user accounts that should be active in the instance
* The accounts that should exist: asset accounts (stores of value), income accounts (that increase assets) and expense accounts (that decrease them)
* Some scheduled transactions, if they exist

Oh, by the way, here's Dr. Quack:

![](https://raw.githubusercontent.com/samcarter/tikzducks/main/duckpond/DuckMD.svg)

You're welcome. _Must Have Rubber Duuuucks_

Now, note that this file is static, as long as Dr. Quack requests no changes to the instance (such as new sources of income, other people that should have access to the instance, or recurring transactions such as a fixed-term deposit that brings in some money every 30 days for 2 years). This file should be reflected exactly in whatever sort of internal store Firefly has (I believe it's a MySQL database), and repeatedly trying to apply the YAML file above shouldn't do any work after the first execution. Instead, it should:

1. Query Firefly for its current configuration
2. Compare with the desired configuration, as expressed in the YAML file
3. See that everything is satisfied
4. Do nothing, report that all is OK, and exit

Also, this should also happen even though the YAML file doesn't hold _all_ that is in the MySQL database. For instance, we don't prescribe actual transactions in the YAML file (but we could...). Trying to enforce the YAML file should NOT go like "oh, I see transactions in the API that are not in the YAML file, let's delete them!"

At this point, anyone who has worked on cloud infrastructure management already has a good idea of where this is going...

## Exploring already-established solutions

This whole idea of expressing configurations as desired state, instead of the sequence of instructions needed to achieve that state, is common and popular enough to have a name: [declarative configuration management](https://blog.nelhage.com/post/declarative-configuration-management/). It's commonly contrasted to imperative approaches, which focus on commands (API calls, CLI commands, whatever)

Also, go read the article linked just above. It's a really good summary of tools that take a declarative approach to things. From there:

> Puppet - an early configuration management tool primarily focused on managing individual hosts
> 
> Chef - Another early tool, making use of a Ruby DSL, which also focuses on managing single hosts
> 
> Terraform - Hashicorp’s tool for managing entire cloud environments on almost any provider and of almost any sort
> 
> Kubernetes - The popular container orchestration tool. I class it in this category because the primary paradigm for configuring services on Kubernetes involves pure-data declarations of desired states, and one or more controllers responsible for updating reality to match.

I would also add Ansible to this list, near Puppet and Chef, because of its [emphasis on idempotency](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html#desired-state-and-idempotency) (AKA "doing the same action many times should have no additional effects compared to running it once"), even though you _can_ use Ansible in [an imperative manner](http://www.it-automation.com/2021/06/05/is-ansible-declarative-or-imperative.html).

As you may see, much of the effort in this area appears to have come from and gone into infrastructure management, particularly the [cloud-native](https://www.cncf.io/) ecosystem (though at this point it's probably [more like an entire biosphere than just a puny ecosystem](https://landscape.cncf.io/)...) Thus, the main usecases, and the ones that get all the love, are such actions as "provision a set of EC2 servers to run a new application", and so on.

In general, in such tools (especially Terraform and Kubernetes), you provision resources (servers, disks or VPCs for Terraform; pods, deployments or services for Kubernetes) by writing files that express what you want to exist, and then applying them (with `terraform apply` or `kubectl apply`, respectively)

For example, here's how you provision an EC2 server in AWS, using Terraform:

```hcl
resource "aws_instance" "app_server" {
  ami           = "ami-830c94e3"
  instance_type = "t2.micro"

  tags = {
    Name = "ExampleAppServerInstance"
  }
}
```

And here's how you provision a Deployment in Kubernetes, which in turn creates some Pods which _in turn_ spawn Docker containers, plus a Service which opens a port and load-balances connections to all the created pods:

```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
          name: http-web-svc
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - name: name-of-service-port
    protocol: TCP
    port: 80
    targetPort: http-web-svc
```

Now, this does fit with the general theme of this article: instead of creating EC2 servers by [calling the AWS API](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_RunInstances.html), you specify what you want to exist. If it doesn't exist, it gets created. If it already exists and everything is as specified, then nothing happens. If it exists, but some settings are different (say, the tags), they get edited to match. If it exists, but some _other_ settings are different (such as the AMI, which is the OS that runs on the machine), which cannot be updated on an instance, Terraform will delete the instance and replace it with a fresh one. 

The Kubernetes example is slightly different, since the "imperative way" does not use an API. Instead, you'd probably use plenty of `docker start ... nginx:1.14.2` commands. Any changes (such as changing the Nginx image version) would require that you `docker stop` the existing containers, and then `docker start` new ones (or in reverse, for availability purposes). Same for deploying extra containers.

Thus, you can see this article as exploring how far can such tools be stretched beyond their commonly accepted use of managing IaaS providers such as AWS, Google Cloud and Azure. Can you use them to manage arbitrary APIs? Why would you want to? How would you design the "declarative documents"? What _should_ you even try to manage in such a way?

## Introducing Terraform

Out of the declarative tools explored above, Puppet, Chef and Ansible are quite coupled to the management of servers (indeed, [Puppet](https://www.puppet.com/docs/puppet/6/install_agents.html) and [Chef](https://docs.chef.io/chef_client_overview/) want you to install _agents_ on the managed hosts, while Ansible uses regular old SSH connections to do the work). So we won't take them out of their natural habitat and use them to manage APIs.

Kubernetes, too, is tied to the management of containerized workloads and their associate supporting entities, such as Deployments, Services, ConfigMaps and Secrets. That doesn't map too cleanly to arbitrary REST APIs (though you could probably make it work, by [creating CRDs](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) to represent your custom resources, and [writing Operator controllers](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/#writing-operator) to watch changes to those resources and act upon the remote APIs)

That leaves Terraform. As stated above, it's especially focused on infrastructure provisioning and configuration, mostly on cloud providers because they have well-documented, web-accessible APIs. However, that's not all. Take a stroll through the [Terraform Registry](https://registry.terraform.io/browse/providers), an app-store-like place where you can upload, download and share Providers, which... well... provide integrations with different services. At a quick glance, I see (apart from the usual cloud computing suspects):

* DNS updates
* Generic HTTP GET requests
* [Salesforce users](https://registry.terraform.io/providers/hashicorp/salesforce/latest/docs)
* [Cisco ACI](https://registry.terraform.io/providers/CiscoDevNet/aci/latest/docs), which is... I have no idea what it is, but Cisco big name
* [Akamai](https://registry.terraform.io/providers/akamai/akamai/latest), which seems to be some sort of web firewall thingy
* [Artifactory](https://registry.terraform.io/providers/jfrog/artifactory/latest), which is Docker Hub mixed with NPM mixed with Maven mixed with PyPI mixed with NuGet mixed with every other package repository under the sun.
* [Auth0](https://registry.terraform.io/providers/auth0/auth0/latest), where you can manage users, applications, groups, permissions of groups to applications, and so on
* [Cloudflare](https://registry.terraform.io/providers/cloudflare/cloudflare/latest), which lets you manage DNS zones, tunnels, Workers, and more
* [CockroachDB](https://registry.terraform.io/providers/cockroachdb/cockroach/latest), which lets you provision databases and users on those databases
* [Github](https://registry.terraform.io/providers/integrations/github/latest), which manages repositories, branches, issues, releases, team members and more
* [Grafana](https://registry.terraform.io/providers/grafana/grafana/latest), where you can manage users, folders, dashboards, data sources, ...
* [MongoDB Atlas](https://registry.terraform.io/providers/mongodb/mongodbatlas/latest), where you can provision cloud-hosted MongoDB databases and their users

At this point I realized that I was on page 5 of 65 and decided to end it. The point is that Terraform does support things that aren't exactly servers and their associated infrastructure. There's even [Stripe](https://registry.terraform.io/providers/lukasaron/stripe/latest/docs), where you (with access to a Merchant account) can edit products, plans, coupons, and a few other entities. This is completely unrelated to cloud computing and more useful to "commercial"/SaaS companies. Again, in the Stripe provider there's no provision for creating Purchases, those will be created in response to buyers' actions.

A similar pattern can be observed in [a firewall provider](https://registry.terraform.io/providers/CheckPointSW/checkpoint/latest/docs/resources/checkpoint_management_access_rule), where you can manage firewall rules, but which data actually uses those firewall rules depends on what traffic flows through the firewall. That is reminiscent of the old distinction between [the control plane and the data plane](https://www.snaplogic.com/blog/data-plane-vs-control-plane-whats-the-difference). Briefly, in the control plane you apply settings, which then affect the behavior of data that flows through the data plane. Terraform is quite adept at configuring the control plane, since that data changes slowly (hopefully) and its "current configuration" is usually of paramount importance. So, if your application has that distinction, you may benefit from using Terraform to manage the slow-changing data that the fast-changing data needs to refer to while it is being processed.

Going back to our running example, in Firefly we have Users, Accounts and Recurring Transactions. That's the control plane for Firefly. The actual Transactions are not a good fit for Terraform, since they change all the time as new transactions are made (the data plane, so to speak), and every Transaction makes reference to some elements from the control plane: a user and some accounts. 

Coming at it from other angle, you may recognize what we're calling "control plane data" because, on a DB, it would be on isolated tables whose main purpose is to be `FOREIGN KEY`-ed from other tables (the "data plane" tables). Think enumerators (categories in an e-commerce site, genres in a library webapp, anything that would appear in an Edit form as a dropdown). In the case of networking devices (such as routers), the control plane is the routing tables, policies and rules, while the data plane is the actual packets that are being routed. In network security (firewalls), the control plane is the firewall policies and associated entities, and the data plane is the packets that are either accepted or dropped. In Kubernetes, the control plane is the actual definitions of the pods, containers, services and such, while the data plane comprises whatever data the applications hosted in the cluster send and receive.

## Terraforming the Firefly API

Throughout this part, we'll use [Terraform's tutorial](https://developer.hashicorp.com/terraform/tutorials/providers-plugin-framework/providers-plugin-framework-provider) as a reference.

### Scaffolding the provider

First, we need to create a new repository based on [their scaffolding repo](https://github.com/hashicorp/terraform-provider-scaffolding-framework). You can either clone it and then manually change the remote Git URLs, or (perhaps easier) [use Github's Template feature](https://github.com/hashicorp/terraform-provider-scaffolding-framework/generate) to create a new repository under your own account, and only then clone it. The tutorial uses the first approach, but the second one should work equally as well.

In our case, that produces [this repo](https://github.com/jreyesr/terraform-provider-firefly), where the Firefly provider will live.

Note that there are [two SDKs/support tools](https://developer.hashicorp.com/terraform/plugin/framework-benefits) for building Terraform providers:

* The Terraform Plugin Framework
* The SDKv2

Terraform recommends using the Plugin Framework "because it offers significant advantages as compared to the SDKv2". Okay, we'll take their word for it, they know more than us.

The first thing to do is to change the module name in `go.mod`. By default it is `github.com/hashicorp/terraform-provider-scaffolding-framework`, we'll change that to `github.com/jreyesr/terraform-provider-firefly`. Then, we install all dependencies with `go mod tidy`.

A word of caution: with the current state of the template, this will insert an extraneous dependency for `github.com/hashicorp/terraform-provider-scaffolding-framework` into your `go.mod`. This is because the `main.go` file imports `github.com/hashicorp/terraform-provider-scaffolding-framework/internal/provider` (which is where the provider's definition actually lived before we changed it). Thus, before running `go mod tidy`, change that import to your new module name, the same as used in the `go.mod` file, plus `/internal/provider`.

You can see those changes in [this commit](https://github.com/jreyesr/terraform-provider-firefly/commit/c85c73d502b98ebb6e9ff36890ca9989fb06325b).

### Configuring the provider

A Provider is the main entrypoint for Terraform extensions. A Provider roughly corresponds to a distinct service or set of services made by a company. For instance, Stripe has [a third-party Provider](https://registry.terraform.io/providers/lukasaron/stripe). So does [AWS](https://registry.terraform.io/providers/hashicorp/aws). So does every other third-party [site](https://registry.terraform.io/providers/integrations/github), [service](https://registry.terraform.io/providers/k-yomo/algolia/latest) or [SaaS platform](https://registry.terraform.io/providers/nukosuke/zendesk/latest). In our case, we need to create a Provider for Firefly, to enable consumers of our provider to point to their own Firefly installations.

The Provider is defined in the `internal/provider/provider.go` file. You need to create a `struct` that must have a `version string` property (as far as I can tell, that's all that is required as data), plus a set of methods that actually hold the provider's logic. This will be called by Terraform whenever it needs to. 

Aside: This clearly shows that Terraform is [a framework, not a library](https://www.freecodecamp.org/news/the-difference-between-a-framework-and-a-library-bd133054023f/). Briefly, "When you use a library, you are in charge of the flow of the application. You are choosing when and where to call the library. When you use a framework, the framework is in charge of the flow. It provides some places for you to plug in your code, but it calls the code you plugged in as needed."

Terraform, as a framework, is always in control. The struct's methods are hook points that it will call when it wants to. This is unlike a library, which you import and call. Think of who holds the `main()` function: is it you? Then you use libraries. Is it something else, that calls you? You're using a framework.

End of aside.

The first step is to rename the provider, which by default is called `ScaffoldingProvider`. Use your IDE's refactoring function for that, to save your sanity. Here we renamed it to `FireflyProvider`.

Then, we need to also rename the provider's config (from `ScaffoldingProviderModel` to `FireflyProviderModel`). This Provider Model is a container for whatever configuration the provider requires. In general, here you specify credentials (username and password, an API key, a certificate), URLs (in case of multi-tenant services that provide different URLs for each tenant, [such as Slack](https://slack.com/help/articles/201663443-Change-your-workspace-or-org-name-and-URL), or for self-hosted/on-premise services where you host them on some IP, such as [Github Enterprise Server](https://docs.github.com/en/enterprise-cloud@latest/admin/overview/about-github-for-enterprises#about-deployment-options)... or Firefly!), and perhaps other assorted configurations. For example, see the [RouterOS provider](https://registry.terraform.io/providers/terraform-routeros/routeros/latest/docs), used to manage MicroTik routers: it requires a host URL, username and password, a CA certificate and whether or not to ignore TLS validation errors.

For Firefly, we'd need:

* The URL where Firefly can be reached, and also the port (which will be part of the URL, there's no need to make it a separate parameter)
* Credentials: A Personal Access Token, which is static. Originally I intended to use a Client ID and Client Secret, since Firefly [can use OAuth2](https://docs.firefly-iii.org/firefly-iii/api/#authentication), but the flow requires an interactive authorization stage that doesn't play too well with a CLI-based tool like Terraform.
* That's it! We won't add TLS certificate validation yet, it's easy enough to add later and my local Firefly installation doesn't even use TLS

This is expressed in two places: the struct itself, which is just a container for the actual configuration values with tags, [in the spirit of the `json` package](https://gobyexample.com/json), and the `Schema` method of the provider, which defines some metadata, such as descriptions, whether or not the config values are required, and some validators. 

```go
// internal/provider/provider.go

// FireflyProviderModel describes the provider data model.
type FireflyProviderModel struct {
	Endpoint     types.String `tfsdk:"endpoint"`
	AccessToken types.String `tfsdk:"access_token"`
}

func (p *FireflyProvider) Schema(ctx context.Context, req provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Attributes: map[string]schema.Attribute{
			"endpoint": schema.StringAttribute{
				MarkdownDescription: "The URL of the Firefly instance, with an optional port, such as <http://firefly.local> or <http://firefly.local:8000>",
				Required:            true,
				Validators: []validator.String{
					stringvalidator.RegexMatches(
						regexp.MustCompile(`^https?://[^:/]+(:\d+)?$`),
						"must be a URL, like http://firefly.local or http://firefly.local:8000",
					),
				},
			},
			"access_token": schema.StringAttribute{
				MarkdownDescription: "A Personal Access Token generated on the Firefly web API. See [the docs](https://docs.firefly-iii.org/firefly-iii/api/#personal-access-token) for instructions.",
				Required:            true,
				Sensitive:           true,
			},
		},
	}
}
```

Here we use validators to ensure that the instance URL looks like a URL. Also note that the Access Token has `Sensitive: true`, which "indicates whether the value of this attribute should be considered sensitive data. Setting it to true will obscure the value in CLI output." Neat.

Those changes are [here](https://github.com/jreyesr/terraform-provider-firefly/commit/c2c537adbe545091840d2e508b608dbfdd01dd7a).

### A simple data source

From [the Terraform docs](https://developer.hashicorp.com/terraform/language/data-sources), "Data sources allow Terraform to use information defined outside of Terraform, defined by another separate Terraform configuration, or modified by functions."

So, if data is to be read-only, or an input, you'd use a data source. For example, in the AWS provider, the instance types that are currently available are exposed [as a data source](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ec2_instance_type). In the Postgres provider, the names of the tables that exist in certain database [are a data source](https://registry.terraform.io/providers/cyrilgdn/postgresql/latest/docs/data-sources/postgresql_tables). In the Zendesk provider, you can read information about [the fields that you can fill on a ticket](https://registry.terraform.io/providers/nukosuke/zendesk/latest/docs/data-sources/ticket_field). On Github, you can get [repositories that match a search query](https://registry.terraform.io/providers/integrations/github/latest/docs/data-sources/repositories).

A fun one is the AWS [data source for an EC2 instance](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/instance), not to be confused with the AWS [resource for an EC2 instance](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance). See the difference? If you want to only read information about an instance that already exists (perhaps it was provisioned outside of Terraform, or perhaps not), you use the data source. If you wish to create, change or delete said instance, you use the resource. Simple, right?

Also, I can't help but observe that the concept of data sources in Terraform seems quite similar to [Steampipe's tables](https://steampipe.io/), about which [I](https://jreyesr.github.io/posts/steampipe-part-one/) [have](https://jreyesr.github.io/posts/steampipe-part-dos-bitcoin/) [blogged](https://jreyesr.github.io/posts/steampipe-part-int-pi-mods/) [quite](https://jreyesr.github.io/posts/steampipe-part-four-integrations/) [extensively](https://jreyesr.github.io/posts/steampipe-part-five-caching/) [before](https://jreyesr.github.io/posts/steampipe-part-six-metrics/). Both concepts seem to aim to expose information as it exists, right now, on the remote service that exposes the API (AWS, Github, whatever). Steampipe, however, lacks any capability to modify resources, and this is by design. So the similarities end here.

So, bearing in mind that data sources are used for externally defined data, we could use them to present Transactions. Recall that we won't allow Transactions to be managed from inside Terraform, as this is the data plane that users will edit. However, that is a quite large API surface, so for now we'll start small.

Instead, we'll expose some general system information, since Firefly [has an API endpoint that presents some such data](https://api-docs.firefly-iii.org/#/about/getAbout), like versions (of Firefly itself, PHP and the API version), the OS in use, and the DB driver. This data will be requested as follows in the Terraform files:

```hcl
data "firefly_sysinfo" "sysinfo" {
  lifecycle {
    # The DB driver must be MySQL or Postgres
    postcondition {
      condition     = contains(["mysql", "pgsql"], self.db_driver) 
      error_message = "db_driver must be either \"mysql\" or \"pgsql\"."
    }
  }
}
```

By the way, the `lifecycle` block is not specific to the Firefly provider, it's [standard Terraform syntax](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle#custom-condition-checks). You can use that "to specify assumptions and guarantees about how resources and data sources operate." "Custom conditions can help capture assumptions, helping future maintainers understand the configuration design and intent. They also return useful information about errors earlier and in context, helping consumers more easily diagnose issues in their configurations." So they sound like assertions [in your average programming language](https://docs.oracle.com/javase/8/docs/technotes/guides/language/assert.html), in that they fail loudly and quickly, thus letting you capture bugs faster and not letting you ignore them. This, in turn, should result in more robust programs (or, here, more robust Terraform files).

So, the minimum data source declaration (without `lifecycle` shenanigans) could be just:

```hcl
data "firefly_sysinfo" "sysinfo" {
  
}
```

That's it. Normally, on data sources you specify some filtering criteria (again, flashbacks to Steampipe, where [you specify `WHERE` conditions as you `SELECT` objects](https://steampipe.io/docs#query)). However, here we have nothing to filter: the system information is just one for the instance. If we ever implement a data source for Transactions, we could make it so you can filter by account involved, transaction type (income, expense), amount (e.g. only over $100), date and more. That's for later, if ever.

By convention, data sources are defined in Go files that end in `_data_source.go`. For example, here we have the important parts of the `sysinfo_data_source.go` file:

```go
// internal/provider/sysinfo_data_source.go

// This is the data that will be exposed by the data source
type SysInfoDataSourceModel struct {
	Version    types.String `tfsdk:"version"`
	APIVersion types.String `tfsdk:"api_version"`
	PHPVersion types.String `tfsdk:"php_version"`
	OS         types.String `tfsdk:"os"`
	DBDriver   types.String `tfsdk:"driver"`
}

// This is the schema of said data
func (d *SysInfoDataSource) Schema(ctx context.Context, req datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		MarkdownDescription: "Exposes general system information and versions of the supporting software",

		Attributes: map[string]schema.Attribute{
			"version":     schema.StringAttribute{Computed: true},
			"api_version": schema.StringAttribute{Computed: true},
			"php_version": schema.StringAttribute{Computed: true},
			"os":          schema.StringAttribute{Computed: true},
			"driver":      schema.StringAttribute{Computed: true},
		},
	}
}

// This is the actual code that calls the remote API and populates a SysInfoDataSourceModel object
func (d *SysInfoDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var data SysInfoDataSourceModel

	// Read Terraform configuration data into the model
	resp.Diagnostics.Append(req.Config.Get(ctx, &data)...)

	if resp.Diagnostics.HasError() {
		return
	}

	httpReq, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/v1/about", "https://demo.firefly-iii.org"), nil)
	httpResp, err := d.client.Do(httpReq)
	if err != nil {
		resp.Diagnostics.AddError("Client Error", fmt.Sprintf("Unable to read example, got error: %s", err))
		return
	}
	defer httpResp.Body.Close()

	var respData struct {
		Data SysInfoDataSourceModel `json:"data"`
	}
	json.NewDecoder(httpResp.Body).Decode(&respData)

	data.Version = types.StringValue(respData.Data.Version.String())
	data.APIVersion = types.StringValue(respData.Data.APIVersion.String())
	data.PHPVersion = types.StringValue(respData.Data.PHPVersion.String())
	data.OS = types.StringValue(respData.Data.OS.String())
	data.DBDriver = types.StringValue(respData.Data.DBDriver.String())

	// Write logs using the tflog package
	tflog.Trace(ctx, "read a data source")

	// Save data into Terraform state
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}
```

There's a similar structure to the actual provider definition: a `struct` that holds the data, a `Schema` function that defines some constraints on said data, and a function whose only job is to somehow create and fill an instance of that struct.

Again, that is eerily similar to Steampipe's [handling of plugin config](https://github.com/jreyesr/steampipe-plugin-samplerest/blob/master/samplerest/config.go): a struct, a schema function, and a `GetConfig` function. In Steampipe, however, the data is filled by the framework, not by you, you just have to get it.

Note that all the fields are marked as `Computed: true` in the schema. According to its docstring, Computed "indicates whether the provider may return its own value for this Attribute or not. [If Computed is true], the attribute will be considered "read only" for the practitioner, with only the provider able to set its value." Here, "the practitioner" is the user of the Terraform provider, the person who writes Terraform code that uses the data source, not us as the provider's developers. That's what we need for output variables, and apparently every field in a data source must be marked as `Computed`.

That code was added [here](https://github.com/jreyesr/terraform-provider-firefly/commit/c51ad6683e3855d92931cae7f8a84cf3a3ef091f).

## Testing

Now is a good time to stop for a bit and test the current features (just the data source, really). This is slightly convoluted since the provider hasn't been published yet, and so you have to convince your Terraform installation to cooperate.

First, if you haven't done so yet, [install Terraform](https://developer.hashicorp.com/terraform/downloads). At least on Linux, the process is quite simple: add Hashicorp's APT repo, then install Terraform. To verify that you have it, run `terraform --version`.

Then, create a `.terraformrc` file in the home directory:

```
// /home/reyes/.terraformrc

provider_installation {
  dev_overrides {
      "jreyesr/firefly" = "/home/reyes/go/bin"
  }

  direct {}
}
```

If using another OS, see [this section of the docs](https://developer.hashicorp.com/terraform/tutorials/providers-plugin-framework/providers-plugin-framework-provider#prepare-terraform-for-local-provider-install).

Then, we can compile and install the plugin with `go install .` on the main folder of the provider. This will place it in the `~/go/bin` path, from where Terraform will be able to pick it up. To verify that it was installed, run `ls ~/go/bin`; it should list the provider:

```sh
❯ ls ~/go/bin
  go            gofmt        staticcheck                 
  go-outline    goimports    terraform-provider-firefly  
```

Then, on an isolated folder (maybe in your home directory?), create a new directory to hold Terraform files. In there, create a `main.tf` file:

```hcl
# main.go

terraform {
  required_providers {
    firefly = {
      source = "jreyesr/firefly"
    }
  }
}

provider "firefly" {
  endpoint      = "http://localhost:8080"
  access_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0MTEiLCJqdGkiOiJhM2RhZTAwZTFiNDVmZWUyZDRjOTJlY2E5M2U4ZmVjNzk5ZDMxODE1MmUwMGI4YTBkZmIzZTczYjY1NGE0NzQxMmIzNzdkMDRlMDU5NDhmMSIsImlhdCI6MTY4NjAxNjEzMy42NTkyMjEsIm5iZiI6MTY4NjAxNjEzMy42NTkyMjMsImV4cCI6MTcxNzYzODUzMy41MTM3MjUsInN1YiI6IjEiLCJzY29wZXMiOltdfQ..."
}

data "firefly_sysinfo" "sysinfo" {}

output "sysinfo" {
  value = data.firefly_sysinfo.sysinfo
}
```

Then, open a terminal on that folder, and run `terraform plan`. You may need to run `terraform init` first, in the home directory, if you have just installed Terraform.

The `plan` command should output something like this:

```
╷
│ Warning: Provider development overrides are in effect
│ 
│ The following provider development overrides are set in the CLI configuration:
│  - jreyesr/firefly in /home/reyes/go/bin
│ 
│ The behavior may therefore not match any released version of the provider and applying changes may cause the state to become incompatible with published releases.
╵
data.firefly_sysinfo.sysinfo: Reading...
data.firefly_sysinfo.sysinfo: Read complete after 0s

Changes to Outputs:
  + sysinfo = {
      + api_version = "2.0.1"
      + driver      = "mysql"
      + os          = "Linux"
      + php_version = "8.2.5"
      + version     = "6.0.10"
    }

You can apply this plan to save these new output values to the Terraform state, without changing any real infrastructure.

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

Note: You didn't use the -out option to save this plan, so Terraform can't guarantee to take exactly these actions if you run "terraform apply" now.
```

Since we are not declaring any resources (we have none yet!), the planning stage detects no changes and thus exists. Since we used the results of the sysinfo data source in an `output` block, Terraform prints it out. Outputs are used, for example, when provisioning cloud infrastructure to print the IDs that the cloud provider assigns to the recently-created servers, since that data is not known until the servers are actually created.

The output captures the response of the Firefly API, thus demonstrating that the data source is working correctly.

**Author's note:** I decided to split this article here. We still are missing what is arguably the most important part of a Provider, the Resources that can be configured, but this article is already running quite long. I'm already working on the Resources, so stay tuned!

## (Partial) Recap

What have we learned until now?

* Services with an API can be managed imperatively (i.e., sending commands to create, edit or delete resources) or declaratively (i.e., having some sort of "desired state" and leaving the task of making the actual service equal to the desired state to some tool)
* Both approaches are perfectly serviceable, and sometimes one or the other is a better fit
* There has been a huge push in recent(ish) times towards the declarative approach in the area of cloud computing, both from the lower layers of the stack (i.e. infrastructure management) in the form of Terraform and similar tools, and from the higher layers (i.e. applications) in the form of Kubernetes
* Terraform, while focused in the domain of cloud infrastructure provisioning and configuration, can also be pressed into service for configuring mostly arbitrary REST APIs
* The Terraform mental model consists of:
	* Providers, which are created for each remote service/website/SaaS that someone wants to control declaratively
	* Resources, which are the actual objects that people want to manage: repos, users, issues and branches in Github; servers, disks, networks in AWS, customers, tickets and comments in Zendesk; interfaces and policies in a firewall
	* Data sources, which are read-only views of live data in the remote service
* Terraform manages infrastructure (and other things!) in the following stages:
	1. Someone writes a Terraform file (or a set of them) _declaring_ how the resources should look like: for example, if managing AWS, the servers, disks and networks are listed
	2. The file is _applied_, which makes Terraform query the remote system (e.g. AWS) for its current state, compare it with the desired state (as expressed by the user in the Terraform file) and obtain a minimum diff
	3. The diff is applied to the remote system
	4. (Hopefully) The remote system is now in a configuration that matches what the user described in the Terraform file
* Each Provider can have some configuration, which commonly holds the credentials necessary to authenticate to the API
* Writing a Data Source only requires implementing one function, which should call the remote API and then fill a struct with the data returned (said struct type must have been declared previously, of course)
