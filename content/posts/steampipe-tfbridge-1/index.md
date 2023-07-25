---
title: "Giving Steampipe access to every* Terraform data source in existence"
date: 2023-07-24T19:26:08.000-05:00
summary: "In this article, we start a new project: giving Steampipe access to any* Terraform datasource. This would allow a project to both effect changes in cloud infrastructure (by using Terraform) and verify or monitor those changes (by querying Steampipe), reusing code between both activities"
tags: ['open-source', 'new-project', 'steampipe']
categories: ['go', 'terraform', 'iac', 'sql']
series: ['tfbridge']
toc: true
---

Please note: everything that I talk about here hasn't been developed yet. I'm jumping into a very deep part of the pool, and I have no idea if this will work. This post is just the announcement, and I may find myself unable to make this work. You've been warned. Don't make any important decisions that depend on this working.

## TL;DR

in this article we present a new project: a way of plugging [Terraform Data Sources](https://developer.hashicorp.com/terraform/language/data-sources) into [Steampipe's SQL interface to cloud APIs](https://steampipe.io/). This would expand the reach of Steampipe to considerably more services: while the main cloud providers are perfectly covered, along with many other large infrastructure-adjacent services, many smaller services aren't covered yet. So, if we could provide a way to plug in any of Terraform's data sources, that would drastically expand the amount of _things_ that Steampipe could query.

To restate: we want to reuse the Data Sources that Terraform providers expose so they can be queried via Steampipe, instead of via [`data` blocks on Terraform files](https://developer.hashicorp.com/terraform/language/data-sources#using-data-sources). This would have the effect of increasing the choices that users of Steampipe have available, at nearly zero effort for everyone involved: as long as there's a Terraform data source that does what you want, you should be able to configure Steampipe so it presents to you all the data that the data source exposes.

Sounds cool? Read on for a (much) longer introduction.

## Longer introduction and problem statement

Nearly two months ago, I wrote [two articles on Terraform](/categories/terraform/). The [first one](/posts/terraform-declarative-api-management-1/#introducing-terraform) has a short section on what Terraform is. [Other](https://www.baeldung.com/ops/terraform-intro) [people](https://www.youtube.com/watch?v=l5k1ai_GBDE) [have](https://myrestraining.com/blog/devops/getting-started-with-terraform-basics-a-comprehensive-guide/) [done](https://pisquare.fr/terraform-101-an-introduction-to-terraform-concepts/) [it](https://towardsdatascience.com/terraform-101-d51437a3170) far better than I could.

Roughly, Terraform lets you configure _resources_ on remote services. One main usecase is provisioning servers on cloud computing platforms (e.g. EC2 instances on AWS). You specify that you want a server to exist, with X CPUs and Y memory, using a certain OS image, having these tags and belonging to that VPC. Terraforms takes that (the _desired state_ or specification), compares it with what it knows about (nothing, the first time), decides that it needs to create a new EC2 instance and creates it. Further runs of Terraform do nothing, since every resource request is satisfied. Any desired changes are effected by changing the desired state, at which point Terraform will compare it with the actual state, see some differences and execute the minimum amount of changes that bring the actual state back in line with the desired state.

More important for our present purposes are [Terraform Data Sources](https://developer.hashicorp.com/terraform/language/data-sources). Terraform has both Resources and Data Sources, sometimes the same entity has both. For example, you use the EC2 instance Resource when you want to create or manage EC2 instances. If, instead, you just want some data about existing EC2 instances, you use the EC2 instance data source. This one can't create or alter instances, it just reports data as it exists.

Several months ago, I also wrote [several articles exploring different areas of Steampipe](/series/steampipe/). I'll refer you to [the first article](/posts/steampipe-part-one/#about-steampipe) for a small recap of what Steampipe is. In short, Steampipe exposes REST APIs, mostly those of cloud computing providers, as SQL tables, _without actually saving all the data in a SQL DB_. Instead, if you `SELECT * FROM aws_ec2_instance`, Steampipe will make GET requests to AWS's API until it retrieves all the EC2 instances that its credentials can see, then present them to you in tabular form.

A limitation of Steampipe is that it is a fairly young project: it's on version 0.20 as of writing this. It has about 130 plugins overing all the major cloud providers and an assortment of services. If your service is less popular or even (shudder) internal to your organization, there may not be a plugin that interfaces with it. You [can write your own plugins](/posts/steampipe-part-dos-bitcoin/) (it isn't even that hard), but we're lazy, right? Things that already exist are more betterer.

Why would we want to combine Terraform and Steampipe? Well, they mostly target different workflows: TF can apply changes (creating, updating and deleting resources) on many different providers, and it can also read back data about the resources that it manages (or _doesn't_ manage, since it's possible to e.g. use a data source to [fetch AWS AMIs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ami), even if you haven't created them). Steampipe is a read-only, always-up-to-date[^1] view of the external world, which you can use for monitoring or compliance purposes. Its SQL interface is a really intuitive and powerful way of querying for infrastructure data as it exists right now.

So, both tools are different and, as of now, don't play too well together. Terraform can query for data, but the obtained information is mostly limited to being used _inside_ of Terraform. The classical example is AWS AMIs: you can query for the most recent AMI ID for Ubuntu 22.04, so you can then use said AMI ID to request the creation of an EC2 instance. However, it's not so easy to use that data for anything else apart from creating new TF resources: if you want to see all the AMIs that are used by all the EC2 instances that your organization has created, so you can find VMs with old OS versions, then things get weird. Sure, you can use [outputs](https://developer.hashicorp.com/terraform/tutorials/configuration-language/outputs) from a TF file, but now you're mixing two responsibilities: the file now declares and controls the infrastructure, and also provides you with data. Also, it's not SQL: querying and filtering in Terraform's HCL it is considerably more awkward than writing a SQL query, which is Steampipe's main superpower.

Steampipe, on the other hand, is superb at querying the live state of data. The same example ("what OS versions are all our EC2 instances running? Filter for those that were released more than a year ago") is very easy on Steampipe; and (perhaps as important) it is very understandable: you just imagine that AWS's API is a giant SQL database where every EC2 instance lives on a table, with a FK to a table where AMIs live, each with a column that contains its release date. However, Steampipe can't make changes to the world, and that is (AFAICT) by design. So you can't provision EC2 instances with it, only watch as EC2 instances get created and destroyed.

So, if you need to do both things (alter the world *and* monitor it), you may very well find yourself using both Terraform and Steampipe. For example, if you use AWS, you'd use [hashicorp/aws](https://registry.terraform.io/providers/hashicorp/aws/latest) for TF and [turbot/aws](https://hub.steampipe.io/plugins/turbot/aws) for Steampipe.

Nothing wrong with that, except that now you need to use two completely different code bases. Sure, Steampipe [tries really hard](https://steampipe.io/docs/develop/plugin-release-checklist) to be as similar as possible to Terraform, e.g. in the authentication methods that are supported by a remote service and by ensuring that the column names exposed by Steampipe match the properties of the corresponding Terraform resource. However, the fact stands: you're using repeated code. With AWS and friends it wouldn't be so bad, since both the Terraform provider and the Steampipe plugin are very well cared for: they're probably the stars of both projects, after all. However, what about smaller providers? You may find yourself in a situation where you have a Terraform provider, so you can create and update resources, but no Steampipe plugin so you can't watch that data in your nice SQL interface. Or maybe the reverse: you can monitor data via Steampipe, yet you can't take control of it via Terraform, and you're limited to whatever web console the provider has... provided.

For example (for no particular reason other than, since its name starts with the number 1, it appears first when searching for [Terraform community providers](https://registry.terraform.io/browse/providers?tier=community)): [1Password's third-party Terraform provider](https://registry.terraform.io/providers/milosbackonja/1password/latest/docs). As you can see in the docs linked just now, it lets you create and manage passwords, users (read-only), groups, secure notes and more. However, [Steampipe has no such plugin](https://hub.steampipe.io/search?q=password&type=plugins). What if we could reuse the [data sources](https://registry.terraform.io/providers/milosbackonja/1password/latest/docs/data-sources/group) that [Milos Backonja](https://github.com/milosbackonja) so kindly has provided as part of the Terraform provider? And what if we could use the read capabilities of Terraform and expose them in Steampipe? We'd get the best of both worlds then: Terraform and its [very large list of providers](https://registry.terraform.io/browse/providers) (over 3K as of writing this article, with an unspecified total number of Data Sources, potentially in the order of 10^4) to manage resources and provide the code that retrieves the current state of resources, and Steampipe to [query using SQL](https://steampipe.io/docs/sql/steampipe-sql), which is really easy to write, understand, and integrate with other systems: SQL is a very common lowest-denominator for data retrieval.

### Similar-yet-different solutions

Here we summarize similar tools and we explain why they're different to this project.

Steampipe has a [Terraform plugin](https://hub.steampipe.io/plugins/turbot/terraform), which could at first glance seem to be what this project is about. However, it's not. It's more like a way of parsing Terraform files and asking questions about the resources defined therein. For example, consider this simple Terraform file:

```hcl
provider "aws" {
  region  = "us-west-2"
}

resource "aws_instance" "app_server" {
  ami           = "ami-830c94e3"
  instance_type = "t2.micro"

  tags = {
    Name = "ExampleAppServerInstance"
  }
}
```

If you pointed Steampipe's Terraform plugin to this file, you'd get:

* An entry in the [`terraform_provider` table](https://hub.steampipe.io/plugins/turbot/terraform/tables/terraform_provider), representing the `provider "aws" {...}` block, which would hold the region in the `arguments` column
* An entry in the [`terraform_resource` table](https://hub.steampipe.io/plugins/turbot/terraform/tables/terraform_resource), corresponding to the `resource "aws_instance" "app_server" {...}` block

So here you aren't really reusing Terraform's AWS provider to query the AWS API. You're asking questions about _the Terraform file itself_.

Same goes for the other direction: [Terraform's Steampipe Cloud provider](https://registry.terraform.io/providers/turbot/steampipecloud/latest/docs). This is used to manage [Steampipe Cloud's](https://cloud.steampipe.io/) SaaS offering: organizations, workspaces, users, dashboards, snapshots. It doesn't let you reuse Terraform plugins to extract data with them in Steampipe; you still need to have a Steampipe plugin that does the job.

Google searches return no further results on the query "steampipe terraform". There doesn't appear to be anything that lets you reuse Terraform providers on Steampipe.

### What can _you_ do?

* For now, not much. If this sounds interesting, maybe keep an eye on the project, and once there's something:
* Test the new Steampipe plugin! Find bugs and weird interactions triggered by specific Terraform providers. The nature of this project means that I won't be able to test all providers (I don't even have accounts on nearly any of them!)
* Suggest improvements. Are there cleaner ways of reusing Terraform providers? Clearer ways of translating the Terraform data model to SQL tables? Easier ways of specifying the providers that we want to pull from Terraform? 
* Contribute code, once it exists :)
* Anything else! Raise issues, suggest enhancements, just use the project. It all helps

## General idea

I want Steampipe to be able to consume the Data Sources that are exposed by [this Terraform provider](https://registry.terraform.io/providers/milosbackonja/1password/latest/docs) or [this one](https://registry.terraform.io/providers/k-yomo/algolia/latest/docs)... or really any Terraform provider, if possible.

For example, let's take the first provider: a third-party provider for 1Password. Normally you'd use it like this (from Terraform): 

```hcl
# main.tf

data "onepassword_item_password" "supersecret" {
    name = "some-login-from-vault"
}

output "mypass" {
	value = data.onepassword_item_password.supersecret.password
}
```

Instead, I want Steampipe to have a table like this:

|onepassword_item_password|||||
|---|---|---|---|---|
|name|password|url|notes|tags|
|some-login-from-vault|sup3rs3creT!||This password is old|["2fa", "banking"]|
|...|...|...|...|...|

so that we can do this from any SQL-capable application:

```sql
SELECT *
FROM onepassword_item_password
WHERE name='some-login-from-vault';
```

That's all. And I want the process to be applicable to any Data Source that comes from any Terraform provider, or as close to that as feasible. I don't want to have to create an entirely new [Steampipe plugin](https://steampipe.io/docs/develop/writing-plugins) for each Terraform provider whose Data Sources I need to use.

So, in effect, we'd need to reimplement a part of Terraform's core: the part that calls Data Sources, feeds them with the data that they need and does things with what they return. We don't need to reimplement the reconciliation logic or anything to do with Resources.

How would that look like from the point of view of a user of Steampipe? We'd need a plugin, of course, something like `steampipe-plugin-tfbridge`. You'd have to [install the plugin](https://steampipe.io/docs/managing/plugins) and then [configure it](https://steampipe.io/docs/managing/connections) with the Terraform provider(s) that it must expose.

Furthermore, you'll need to provide Steampipe with whatever credentials the Terraform provider needs. For the 1Password provider above, you need [an email, password and/or secret key](https://registry.terraform.io/providers/milosbackonja/1password/latest/docs). Normally you set those in the Terraform file or via envvars, but now we have no Terraform file. We can definitely reuse the envvars, I'd expect Terraform's provider code to take care of it automatically. We do need to pass explicit credentials.

All in all, you may need to write this [Steampipe connection file](https://steampipe.io/docs/managing/connections):

```hcl
# tfbridge_1password.spc

connection "1password" {
  plugin = "tfbridge"
  
  terraformProvider = "milosbackonja/1password"
  terraformVersion = "1.1.0"
  
  providerConfig {
    email      = "john.smith@example.com"
    password   = "super secret master password"
    secret_key = "A3-XXXXXX-XXXXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
    subdomain  = "company"
  }
}
```

The first line is required by Steampipe. Then, the Steampipe plugin would see that it must use Terraform's `milosbackonja/1password` provider, version 1.1.0. When instantiating the provider, it'd pass it the configuration on `providerConfig`.

The Steampipe plugin will most likely have to make use of [Steampipe dynamic tables](https://steampipe.io/blog/release-0-9-0#tables-from-csv-files) ([more dev docs here](https://steampipe.io/docs/develop/writing-plugins#dynamic-tables)), since there's no way to predefine the structure of the tables. To put it another way, the `tfbridge` plugin as configured above would have to generate a `onepassword_item_password` table with columns for the item's name, password, URL, notes, tags, vault and section. However, that's only because we set `terraformProvider` to `milosbackonja/1password`. What if we set it to `k-yomo/algolia` instead? Then it'd have to generate a `algolia_index` table with columns for the name, ID, pagination config, rules, and more information that pertains to Algolia indices.

So, we need the Terraform provider to report the data sources that _it_ exposes. It should be possible, the Terraform core needs to do it too. So there must be a way to ask a Terraform provider "What data sources do you implement? How are they called? Which fields of data do they present? What are the types of those fields? Of those fields, which are required to be set by the user? Which _can't_ be set by the user, instead coming from the backing service?"

## Work to do

* Interface with [Terraform's Registry API](https://developer.hashicorp.com/terraform/registry/api-docs). The user of the Steampipe plugin will just want to provide a provider name (`milosbackonja/1password` in the example above), and a version number. From that, we need to somehow arrive at the [Terraform provider's binary file](https://developer.hashicorp.com/terraform/plugin/how-terraform-works#terraform-plugins), which is what holds the code that can read remote APIs and return results. We'd also need to support providing local copies of a provider, in much the same way that [Steampipe lets you just drop a binary file on a special directory](https://steampipe.io/docs/develop/writing-plugins#installing-and-testing-your-plugin), which is processed and loaded as a Steampipe plugin
* We need to make Terraform providers run from outside its normal operating environment. Terraform providers are used to running in the cozy atmosphere of a Terraform deployment, but we won't have that. We'll just have a plugin process which we'll trick into doing our bidding, by sending it messages over an RPC-style interface. 
* That is covered [in this link](https://developer.hashicorp.com/terraform/plugin/best-practices/interacting-with-providers#using-the-rpc-protocol). This is the entirety of the article that gives you guidance on running Terraform providers as standalone entities:
	> For projects that actually want to drive the provider, the supported option is to use the gRPC protocol and the RPC calls the protocol supplies. 
	
	Okay, thanks? We'll have to discover how to run Terraform providers without Terraform. Sadly, just importing a Terraform provider as a Go module is [explicitly unsupported, discouraged and forbidden](https://developer.hashicorp.com/terraform/plugin/best-practices/interacting-with-providers#do-not-import-providers-as-go-modules)
* We'll need to implement the Steampipe plugin, which will need to have dynamic tables. These tables will need to get their schemas from whatever the backing Terraform provider announces
* Then, we'll also need a way to pass configuration values (such as passwords) to the Terraform provider. This will be the responsiblity of the Steampipe plugin, but the user will have to provide the Steampipe plugin with the values
* And let's not forget the important part: the Steampipe plugin will have to call the Terraform provider's Data Sources when it is asked for data
	* A further complication here: Steampipe's mandatory qualifiers. Consider the 1Password provider above: you can't just list all the password items. You need to provide a `name` (see the Terraform file above, or [the data source's docs](https://registry.terraform.io/providers/milosbackonja/1password/latest/docs/data-sources/item_password)). In Steampipe, that would be expressed as [quals](/posts/steampipe-part-dos-bitcoin/#transactions-table), which are `WHERE` clauses. We'd want the plugin to realize that the Terraform data source specifies that the `name` argument is required, and thus make the `name` column in the user-facing table a required qualifier. In this way, if the user enters a SQL query that doesn't specify a `WHERE name='...'` clause[^2], Steampipe itself will reject the query.


[^1]: Modulo caching, which is usually set to a reasonably low interval (5 minutes IIRC)
[^2]: Or something that can be decomposed to a set of `WHERE name='...'` queries, such as `WHERE name IN('...', '...')`
