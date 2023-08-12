---
title: "Testing the Steampipe-Terraform bridge with assorted Terraform providers"
date: 2023-08-12T17:33:48-0500
summary: "in this post, we start testing the Steampipe plugin that bridges to Terraform data sources with several random Terraform providers. We uncover a few bugs, and we find that the plugin (mostly) works as intended."
tags: ['open-source', 'steampipe']
categories: ['go', 'terraform', 'iac']
series: ['tfbridge']
toc: true
---

Hello again! In case you have missed the [previous articles](/series/tfbridge/), here's the summary. We're building a [Steampipe](https://steampipe.io/) plugin that can reuse (hopefully) any [Terraform provider's](https://developer.hashicorp.com/terraform/language/providers) [data sources](https://developer.hashicorp.com/terraform/language/data-sources) and present them as SQL tables, so you can query them. This should greatly extend the range of what can be queried by Steampipe, by complementing its [~130 plugins](https://hub.steampipe.io/plugins) with however many data sources are there in the >3K Terraform providers that exist in the [Terraform Registry](https://registry.terraform.io/). It should also let you unify code in case you need to both query for resources and manage them: you'd just write the Terraform provider, with its Resources and Data Sources, and then you'd plug it in to Steampipe, where you can reuse the Data Sources via SQL queries.

In the [first](/posts/steampipe-tfbridge-1/) [few](/posts/steampipe-tfbridge-2/) [articles](/posts/steampipe-tfbridge-3/), we explored the problem, and wrote [a Go program](https://github.com/jreyesr/steampipe-plugin-tfbridge/tree/poc) that could make a Terraform provider tick... without Terraform itself being present. It could ask the provider for its schema (such as which data sources it exposes), configure the provider (pass it some credentials, for example) and query the provider for a specific data source.

Then, we [converted that program into a Steampipe plugin](/posts/steampipe-tfbridge-4/), which dynamically declared which tables it exposed (since normal Steampipe plugins have a fixed set of tables, but we can't do that, since which tables we expose depends on which Terraform provider the user wants to use). It used the data source's schema (which fields a data source has; which are required, optional or read-only) to generate qualifiers for the table. Then, it translated `SELECT ...` statements into data source Read operations, and translated the result, usually intended for Terraform's consumption, into Steampipe-friendly columns (through liberal use of JSON columns in case of emergencies). Finally, in [the last article](/posts/steampipe-tfbridge-5/), we implemented a client for Terraform Registry's API, which will allow users of the plugin to just specify a provider name+version, as you'd do on Terraform itself.

In this article we'll test the plugin with some random Terraform providers, and discuss and fix any problems that may crop up.

## Previously: the DNS provider

[Two articles ago](/posts/steampipe-tfbridge-4/), we tested that the plugin worked by using the [DNS provider](https://registry.terraform.io/providers/hashicorp/dns/latest), since it's a fairly easy provider to use that requires no credentials. The `.spc` file looked like this:

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "hashicorp/dns"
  version = "3.3.2"

  provider_config = <<EOT
  EOT
}
```

which let us run SQL statements like the following:

```sql
select * from tfbridge.dns_a_record_set where host='one.one.one.one';

select * from tfbridge.dns_a_record_set where host='steampipe.io';

select * from tfbridge.dns_a_record_set where host='terraform.io';
```

![a85b6d3b1ba2cf6974d52da9b3f23a95.png](./_resources/a85b6d3b1ba2cf6974d52da9b3f23a95.png)

## Grafana

Now, let's use the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest), since it requires authentication.

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "grafana/grafana"
  version = "2.2.0"

  provider_config = <<EOT
    url  = "http://192.168.1.2:3000" # a Raspberry's address
    auth = "admin:mysecretpass" # nope, that's not the real pass
  EOT
}
```

![b4f826e47481dec8d1faaf96c9d3806f.png](./_resources/b4f826e47481dec8d1faaf96c9d3806f.png)

As you can see, from Steampipe's point of view the plugin hasn't changed: it's still `jreyesr/tfbridge`. The only change that we made was on the plugin's config. However, it has entirely different tables, with entirely different columns. Now we can run different queries using the same Steampipe plugin:

```sql
select * from grafana_users;

select * from grafana_user where login='admin';

select * from grafana_dashboards;

select * from grafana_dashboard where uid='myDashID';
```

![635e8d927afe0c979df538f60106afbd.png](./_resources/635e8d927afe0c979df538f60106afbd.png)

The Grafana plugin seems to be quite good at providing both singular and plural datasources: compare `grafana_users` and `grafana_user`. They're entirely different tables, fed from different datasources, as you can see by `.inspect`ing both of them:

![10b5b09d01acca314f81ac34e17f5352.png](./_resources/10b5b09d01acca314f81ac34e17f5352.png)

The `grafana_user` table _must_ receive some sort of identifier for the user (either the user's ID, email or username); otherwise it'll yell at you:

![9ce352ec74e037407e30060d4fc89a88.png](./_resources/9ce352ec74e037407e30060d4fc89a88.png)

However, that's not Steampipe's doing (i.e. that condition is _not_ enforced via quals at the Steampipe level). Instead, we can see that the error message [comes straight from the Terraform provider](https://github.com/grafana/terraform-provider-grafana/blob/7e8e0c4627ab208b4a86c66319c147a5cfd3e2b7/internal/resources/grafana/data_source_user.go#L68):

![a4fbb9d98b31592e7b52eab293e2e1b2.png](./_resources/a4fbb9d98b31592e7b52eab293e2e1b2.png)

This is confirmed in [the Terraform provider's docs](https://registry.terraform.io/providers/grafana/grafana/latest/docs/data-sources/user), where it clearly states that all three of those fields are optional:

![48e536203af9ac1b486e962b8e807773.png](./_resources/48e536203af9ac1b486e962b8e807773.png)

So, rather than the data source rejecting read operations where none of those three fields are set, the data source accepts those RPCs and then promptly fails. Presumably, this is done because Terraform schemas can't express the notion of a group of fields being required, but only one of the fields in the group being so. If the three fields were marked as Required, then you'd have to specify all three of them. So the best that Terraform can do is to have them all as Optional and fail from the provider's code.

Thus, our Steampipe provider (which, remember, [takes its quals from the data source's schema](https://jreyesr.github.io/posts/steampipe-tfbridge-4/#key-columns)) will also mark those columns as being optional. However, while Steampipe [does have a way of marking "any of these set of columns" as required](https://pkg.go.dev/github.com/turbot/steampipe-plugin-sdk/v5@v5.5.1/plugin#AnyColumn), without _every_ column in the group being required, we never ever generate such a constraint. That's because we can't reliably infer such constraints from the Terraform schema. We can just infer "this column is _always_ required" and "this column is optional", but not "of columns A, B and C, at least one of them must be provided".

In other words: that's not our fault&trade;.

Aside from that, the Grafana plugin seems to work well. I couldn't get it to work with Grafana Cloud, but I got tired. Besides, the plugin is working, as we saw above. Any problems must be due to misconfigurations in the provider's config.

Sidenote: the Grafana plugin made me realize that... I wasn't configuring the Terraform provider at all. [A few posts ago](/posts/steampipe-tfbridge-3/#configureprovider-or-passing-credentials-to-a-provider) we saw that, in order to call most data sources, you need to configure the provider (i.e. provide it with credentials and other configuration values). That is done through the `ConfigureProvider` RPC. We did explore that when we drove the provider via a Go program, but for some reason I completely neglected to configure the provider when I migrated to a Steampipe plugin. It didn't cause problems before because the DNS provider doesn't require authentication (at least, not for the data sources that it exposes). I spent quite some time trying to track down nil-dereference errors: Terraform providers assume that they'll be driven by Terraform, which will be nice enough to never call RPCs that require authentication without having provided the authentication details, so violating that assumption causes weird errors, not nice "please call `ConfigureProvider` before calling this RPC!" messages. You can see the commit that added that call [here](https://github.com/jreyesr/steampipe-plugin-tfbridge/commit/affb516e9b870815e629c06683ff8c2013303c06).

### Aside: choosing the correct file in a provider's ZIP file

In [the last article](/posts/steampipe-tfbridge-5), we implemented a downloader that complied with the Terraform Registry's API and used it to discover and download the provider's plugin. Previously we had been downloading them manually, which isn't good UX.

Very quickly, that process involves:

1. Parsing the provider's name (here provided in the `.spc` file, in the `provider` field) to extract a registry hostname (or, if unspecified, `registry.terraform.io`), a namespace (the vendor/developer of the provider) and a name (the actual provider). For example, `grafana/grafana` would have hostname `registry.terraform.io`, namespace `grafana` and name `grafana`
2. Contacting the hostname and running a Discovery Protocol on it to ensure that it's indeed a Terraform Registry and not a random webserver
3. Querying the Registry API for information about the provider's version, which (among other things) will return a download URL
4. Downloading the file at that URL, which will be a `.zip` file
5. Extracting that file, which will contain an executable binary
6. That binary is the actual provider, which we can run as outlined [in previous posts](/posts/steampipe-tfbridge-2/)

Near the end, after we extracted the `.zip` file, I wrote

> We ensure that we downloaded one file, and just one file. I’m unsure if the release packages (which I’ve seen as `.zip` files) could ever contain more files apart from the provider binary. If that happens, I’ll have to relax that check

Well, [Mr. Murphy](https://www.cs.cmu.edu/~fgandon/miscellaneous/murphy/) heard that. Of course release packages can have more files. Here's the Grafana provider (that's the first one where I found the problem):

![25b340e668563771f1ee93d9dd408d3c.png](./_resources/25b340e668563771f1ee93d9dd408d3c.png)

The first file (`terraform-provider-grafana_v2.2.0`) is the binary, but there are other files: the provider's license, a README and a changelog. However, we only need one of those files, whose file path we need to identify. How do we do that?

Okay, let's rephrase that. How does Terraform do that? Y'know, _for inspiration_. It should have the same problem, as it also needs to download those same `.zip` files, and execute only the binary.

I no longer remember how I arrived at the relevant code, but [here it is](https://github.com/hashicorp/terraform/blob/e26d07dda41a74a009b1b750471395bf8773601c/internal/providercache/cached_provider.go#L106C33-L154). The `ExecutableFile` method takes a directory (where a `.zip` file should have been extracted previously) and identifies which of the files inside it (non-recursively) is the actual binary (and not a README, license or whatnot). The logic is as follows:

1. List all the entries in that directory
2. Throw away subdirectories, leave only actual files
3. Find the first one such that:
	* Its filename starts with `terraform-provider-<providername>` (e.g. `terraform-provider-grafana`)
	* If there are any more characters in the filename after those, the first one must be either an underscore `_` or a period `.`
	* This is done to allow, for example, `terraform-provider-grafana_v2.2.0`  (as we see on the ZIP file above) or `terraform-provider-grafana.exe` (on Windows)
4. The first file that meets those requirements is the provider binary, and its absolute path is returned

We can do the same, [as you can see in the commit that added said logic](https://github.com/jreyesr/steampipe-plugin-tfbridge/commit/7d20552f30cf0131304f868d32721c158b8888de). I use different APIs, since [the `ioutil.ReadDir` call that is used on Terraform](https://pkg.go.dev/io/ioutil#ReadDir) is Deprecated, and I use a different way of checking for the "optional underscore or period" condition, but it should be equivalent. Anything else is a bug and [will be dealt with accordingly](https://github.com/jreyesr/steampipe-plugin-tfbridge/issues). That check replaces our simplistic "assume that the ZIP file contains one single file, return its path" original implementation, which proved (very quickly!) to be flawed.

Note that nowhere in the conditions is a check for the file being actually executable. AFAICT, this is because executable bits are mostly for UNIX, or at least the Windows permission model is different enough that Go doesn't offer a unified `file.IsExecutable()` flag, as it has a `file.IsDir()` flag. Thus, we can't be sure that the file that we found is executable. The risk of that is considered low, however, because if someone added (say) a Markdown file that started with the magic words, the plugin wouldn't work on Terraform either... which would get notified very quickly to the provider's developer. So it shouldn't happen, and we should be OK.

## Vercel

Now let's try [Vercel's provider](https://registry.terraform.io/providers/vercel/vercel/0.15.0), since I [do have an account there](/series/openchatflow/). Let's change the `.spc` file once again, so it points to Vercel:

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "vercel/vercel"
  version = "0.15.0"

  provider_config = <<EOT
    api_token = "myAPItoken"
  EOT
}
```

aaand...

![e1f306c6f4a9c6a4702534d13854d011.png](./_resources/e1f306c6f4a9c6a4702534d13854d011.png)

![9128eccbfbaa4c165eec4515198f3514.png](./_resources/9128eccbfbaa4c165eec4515198f3514.png)

Well, that didn't take too long. We're already finding plugins that use the Terraform plugin version 6. A [few articles ago](/posts/steampipe-tfbridge-2/#peeking-at-terraforms-code), back where we were driving Terraform providers with a plain Go program, I wrote that

> Then there’s a switch statement, for the two versions (5 and 6) that we reviewed above. Depending on that, the return value of Dispense() is cast to one of two interfaces, and that is returned. For now, we’ll start with V5, since I presume (with absolutely zero data to back this up) that many providers still use V5 and haven’t migrated to V6. At least the DNS provider hasn’t.

Apparently there _are_ providers that use V6. Go figure. So now we're out of excuses and we need to implement that. [Here's the commit that does so](https://github.com/jreyesr/steampipe-plugin-tfbridge/commit/0b06a6680ce1dd078ebbf7a59bc14320db2a3ed2).

Adding suport for V6 of the provider protocol was (once again) mostly a matter of [copy-pasting entire files from Terraform's `/internal` code](https://jreyesr.github.io/posts/steampipe-tfbridge-2/#recursive-creative-code-reuse) until all compile errors disappear. Thankfully, this time a lot fewer files were required, as some imports are shared between V5 and V6, so we had that work done already. Then, it's a simple matter of [detecting which version we're actually using, and casting accordingly](https://github.com/jreyesr/steampipe-plugin-tfbridge/commit/0b06a6680ce1dd078ebbf7a59bc14320db2a3ed2#diff-555f4a36f048f9dda1a49e06d85e2ebbe2dc79ff7f183308666572e2e3fae3d1L49-R62). We also had to [add the new plugin struct to the `VersionedPlugins` variable](https://github.com/jreyesr/steampipe-plugin-tfbridge/commit/0b06a6680ce1dd078ebbf7a59bc14320db2a3ed2#diff-f42d64c75c9ca7a08c149ea609687764f2abcd3a79ae4e77110c6ae44ba36e9fL17-R20).

And now Vercel works too, and so should any provider that is based on V6 of the provider:

![b75d77c333fb3ca08bc91862dfe89a05.png](./_resources/b75d77c333fb3ca08bc91862dfe89a05.png)

Some SQL queries that can be run on the Vercel provider are:

```sql
select * from vercel_project where name='myprojectname';
```

... and that's mostly everything that I can test. Vercel has very few data sources, so...

![4fdf8f195af55ea470707f8847f2536d.png](./_resources/4fdf8f195af55ea470707f8847f2536d.png)

Note that here we had to specify a project name, which is more like an ID. In other words, Vercel only provides us with _singular_ datasources, not _plural_ as Grafana did. If we try to "list all providers", it'll get angry:

```sql
select * from vercel_project
```

![e149df1452aa53f8ab91d2bd70742ef3.png](./_resources/e149df1452aa53f8ab91d2bd70742ef3.png)

Okay, _now_ it's a Steampipe error, telling us that `'List' call for table 'vercel_project' is missing 1 required qual: column:'name' operator: =`. In other words, we aren't specifying a `WHERE` condition that involves the `name` column and an Equals operation. This required qualifier was automatically generated by the plugin, based on the data source's schema, and we do see that the original datasource marks the `name` field as Required:

![6fa1d2180473dd25ad3d1ea5a7e82806.png](./_resources/6fa1d2180473dd25ad3d1ea5a7e82806.png)

So, no listing for you. The best you can do is to retrieve a single project at a time.

Note that this doesn't stop you from asking for multiple projects at once, _as long as_ you can exhaustively list them. My Vercel account hosts [one single project](https://jreyesr.github.io/series/openchatflow/), so I quickly added an empty one to test:

```sql
select * from vercel_project where name in('project1', 'project2', ...)
```

![a65b6cbcf666a29c14d3bb56ab3ad222.png](./_resources/a65b6cbcf666a29c14d3bb56ab3ad222.png)

And now we can list more than one project. However, the original point stands: you can't list all projects in your account. This is a limitation of the original datasource, not of the Steampipe plugin. Presumably they don't expect users to need to reference "all projects" in Terraform files.

## Github

Let's now try the [Github provider](https://registry.terraform.io/providers/integrations/github/5.33.0):

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "integrations/github"
  version = "5.33.0"

  provider_config = <<EOT
    token = "github PAT here"
  EOT
}
```

![7c2c41066b9b57fc556751deb5f57fea.png](./_resources/7c2c41066b9b57fc556751deb5f57fea.png)

Wow. Much tables. Note that the tables don't have descriptions (I [have hardcoded the Description so it also includes the table name](https://github.com/jreyesr/steampipe-plugin-tfbridge/blob/master/tfbridge/table_code_tfbridge.go#L21). The actual description, as provided by the Terraform schema, is empty). As far as I can tell, that's not the fault of the Steampipe plugin. Some plugins just appear to not have a description, and [a cursory look at the Github data sources](https://github.com/integrations/terraform-provider-github/blob/main/github/data_source_github_repositories.go#L12) seems to confirm it. Observe the `&schema.Resource` struct: while it [could have a `Description`](https://pkg.go.dev/github.com/hashicorp/terraform-plugin-sdk@v1.17.2/helper/schema#Resource), it doesn't. Thus, the lack of a description in the Github tables seems to be normal.

Apart from the missing descriptions, what can we do?

```sql
select * from github_user where username='someusername';

select * from github_repositories where query='org:turbot';

select * from github_repository where full_name='jreyesr/steampipe-plugin-tfbridge';
```

![d0a265293445b1d1d11a6e010811fc7e.png](./_resources/d0a265293445b1d1d11a6e010811fc7e.png)

Not bad, and there's more. Just look at all those tables!

Just for fun, let's copy [the queries that the native Steampipe plugin uses as examples](https://hub.steampipe.io/plugins/turbot/github/tables/github_search_repository#examples).

```sql
select * from github_repositories where query='repo:turbot/steampipe-plugin-github';
select * from github_repositories where query='stargazers in:readme repo:turbot/steampipe-plugin-github';
select * from github_repositories where query='followers:>=100000';
select * from github_repositories where query='tinyspotifyr in:name created:2021-01-01..2021-01-05 fork:only';
```

![c2266023d20a1c8b76e769ea4336efed.png](./_resources/c2266023d20a1c8b76e769ea4336efed.png)

Yep. They all work. 

### Exploding array fields into multiple records

This exposes another quirk of Terraform's data model: for these "plural" data sources (i.e. those that you'd expect to return multiple results) Terraform still wants them to return a single item. Observe, for example, the second-to-last query in the screenshot above. See how it has only one result row, even though there are clearly many repos that have over 100K followers? This is so you can still operate consistently; consider, for example:

```hcl
data "github_repositories" "example" {
  query = "org:hashicorp language:Go"
  include_repo_id = true
}

output "somerepos" {
  value = data.github_repositories.example
}
```

The way in which multiple results are shows is via "container" fields that can hold several values: for example, consider [the `names` and `repo_ids` fields in the `github_repositories` data source](https://registry.terraform.io/providers/integrations/github/latest/docs/data-sources/repositories#names). In other words, the information about the repositories gets squashed into an array, which you'll have to handle manually. Three arrays, actually, if you count the `full_names` too.

Thankfully, Steampipe is powered by Postgres. Such problems are but a minor nuisance. A little bit of set-returning functions magic, and we're done:

```sql
select 
	query, 
	jsonb_array_elements(full_names) as full_name, 
	jsonb_array_elements(names) as name, 
	jsonb_array_elements(repo_ids) as repo_id 
from github_repositories 
where query='org:turbot' and include_repo_id=true;
```

![b3db0369f3d729cf60e3f8ab65eddf5c.png](./_resources/b3db0369f3d729cf60e3f8ab65eddf5c.png)

Note the multiple [`jsonb_array_elements` calls](https://www.postgresql.org/docs/9.5/functions-json.html). This function "explodes" a JSONB column that holds an array into multiple rows of results, each holding one of the results. Furthermore, [ever since Postgres v10, we're able to just add multiple `jsonb_array_elements` calls in the `SELECT` clause](https://stackoverflow.com/a/39864815), and Postgres will "zip them up" together: the first row will contain the first item from each invocation, the second row will contain the second item, and so on. If the different columns contained different amounts of values, empty spaces would be padded with null values. [See the Postgres docs](https://www.postgresql.org/docs/10/xfunc-sql.html#XFUNC-SQL-FUNCTIONS-RETURNING-SET) (emphasis mine):

> If there is more than one set-returning function in the query's select list, the behavior is similar to what you get from putting the functions into a single `LATERAL ROWS FROM( ... )` FROM-clause item. For each row from the underlying query, **there is an output row using the first result from each function, then an output row using the second result, and so on**. If some of the set-returning functions produce fewer outputs than others, **null values are substituted** for the missing data, so that the total number of rows emitted for one underlying row is the same as for the set-returning function that produced the most outputs. Thus the set-returning functions **run “in lockstep”** until they are all exhausted, and then execution continues with the next underlying row.

In our case, all three columns should always contain the same numbe of elements, so we should be OK. That "lockstep" behavior is what ensures that `full_name` for the first row of results matches `name` and `repo_id`, and that the same happens for every row of results. That depends on the Terraform provider returning all three arrays in the same order, which it should very much do, as otherwise there's no way to pair them, even in Terraform itself.

This is not specific to the Github provider, either. Above we played with the Grafana provider, and it shows the same behavior (bundling multiple results in a single cell) for the `grafana_users` queries:

![635e8d927afe0c979df538f60106afbd.png](./_resources/635e8d927afe0c979df538f60106afbd.png)

See the first query? The `users` column is actually an array. It's just not that noticeable because my particular Grafana instance has a single user. The same `SELECT jsonb_array_elements(users) as user FROM grafana_users` trick would work there to split the `users` into rows. I can't be bothered to run that query, since I already changed the `.spc` file and I no longer have the Grafana token, so you get no screenshot, but it _should_ work.

### Unsupported quals

I did find an unsupported query on [the `github_users` data source](https://registry.terraform.io/providers/integrations/github/latest/docs/data-sources/users):

```sql
select * from github_users where usernames='["jreyesr"]'
```

![fec79619a5a913fc89e1549fb1df8df3.png](./_resources/fec79619a5a913fc89e1549fb1df8df3.png)

This is because, [on Terraform, `usernames` is a list](https://registry.terraform.io/providers/integrations/github/latest/docs/data-sources/users#usernames):

```hcl
data "github_users" "example" {
  usernames = ["example1", "example2", "example3"]
}
```

Our qual-generating code chokes on complex field types: it'll happily handle strings, booleans and numbers, but not lists of strings. I'll have to take a look at that later, but for now you're covered with `select * from github_user where username IN('user1', 'user2')`. Now, this is less efficient, since it'll fire off one API call per username (as opposed to the `github_users` data source, which is supposed to "retrieve information about multiple GitHub users at once"). I'm documenting this so I can come back to the query that fails and hopefully add support for complex quals at some point.

## Cloudflare

Now let's test [the Cloudflare provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest). I use Cloudflare to provide analytics for this blog.

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "cloudflare/cloudflare"
  version = "4.12.0"

  provider_config = <<EOT
    api_token = "someAPItoken"
  EOT
}
```

![2f002ad850f2390b3ccabaea0a0170ea.png](./_resources/2f002ad850f2390b3ccabaea0a0170ea.png)

```sql
select * from (
	select 
	  jsonb_array_elements(accounts) as account 
	from cloudflare_accounts
) as x 
where account->>'name'='jreyesr'
```

![864ba03aabd960a9676271ea613fc629.png](./_resources/864ba03aabd960a9676271ea613fc629.png)

I have access to two accounts, and one is not mine, hence the extra wrapped query so that account isn't even shown. Ever since [the Acropalypse](https://nakedsecurity.sophos.com/2023/03/21/google-pixel-phones-had-a-serious-data-leakage-bug-heres-what-to-do/), I've been a lot warier of blurring or cropping. Turns out sometimes cropping doesn't crop, and obscuring sometimes doesn't obscure.

That's mostly all I can do. I don't really manage many resources in Cloudflare, and those that I do (e.g. Web Analytics sites) aren't exposed in the Terraform data sources.

### Qual weirdness

This time, another query fails:

```sql
select * from cloudflare_zones where filter='[{"status": "active"}]'
```

![6a4fb233653f0d71bffb795f02002456.png](./_resources/6a4fb233653f0d71bffb795f02002456.png)

This is attempting to use [the `cloudflare_zones` datasource](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/data-sources/zones) to list all zones. However, that doesn't work: the provider _must_ receive a `filter` parameter:

```hcl
# Given you have the following zones in Cloudflare.
#
#  - example.com
#  - example.net
#  - not-example.com
#
# Look for a single zone that you know exists using an exact match.
# API request will be for zones?name=example.com. Will not match not-example.com
# or example.net.
data "cloudflare_zones" "example" {
  filter {
    name = "example.com"
  }
}

# Look for all zones which include "example".
# API request will be for zones?name=contains:example. Will return all three
# zones.
data "cloudflare_zones" "example" {
  filter {
    name        = "example"
    lookup_type = "contains"
  }
}

# Look for all zones which include "example" but start with "not-".
# API request will be for zones?name=contains:example. Will perform client side
# filtering using the provided regex and will only match the single zone,
# not-example.com.
data "cloudflare_zones" "example" {
  filter {
    name        = "example"
    lookup_type = "contains"
    match       = "^not-"
  }
}

# Look for all active zones in an account.
data "cloudflare_zones" "example" {
  filter {
    account_id = "f037e56e89293a057740de681ac9abbe"
    status     = "active"
  }
}
```

[The `filter` parameter](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/data-sources/zones#filter) is typed to be a Block List, with a minimum of 1 element and a maximum... of 1 element. In other words, it's a single item, and it's required too. However, it appears as a JSON array, more or less. And that is what is blowing up: apparently it can't unmarshal a JSON array (which is what we must provide) into a `map[string]any`. Clearly, our qual-handling is lacking here.

## Algolia

Let's try [an Algolia provider](https://registry.terraform.io/providers/k-yomo/algolia/latest), since I have an account with Algolia (it powers the search box in the blog. If you didn't know that it existed, try pressing Ctrl+K right now):

```
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "k-yomo/algolia"
  version = "0.5.7"

  provider_config = <<EOT
    app_id = "MYAPPID"
    api_key = "publicapikey"
  EOT
}
```

![f74d43df66728dd5add76b7775314f79.png](./_resources/f74d43df66728dd5add76b7775314f79.png)

```sql
select * from algolia_index where name='indexname';
```

![dd8b4651b0bfb889ac2a5076c5bbec63.png](./_resources/dd8b4651b0bfb889ac2a5076c5bbec63.png)

Nothing of interest here, especially since there are only a couple of datasources.

## ZeroTier

A long time ago I played a bit with [ZeroTier](https://www.zerotier.com/). It's a service that is similar in spirit to [Tailscale](https://tailscale.com/) and [Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/): it's somewhat like a VPN except that the emphasis is on point-to-point connections: you install the ZeroTier client on multiple devices (which could live on different networks), enroll them on the same network, and you get LAN addresses from which you can talk across devices. I may write a post on virtual overlay networks at some point, they're very cool stuff.

As an example, I met those services while at university; we were working on [robot teleoperation](https://driveu.auto/blog/the-complete-guide-to-av-teleoperation/) and robots could be on different networks from the operators. An overlay network solution would let us simply connect to an IP address that was "next to" the control workstation, with ZeroTier (or whatever else) handling the actual Internet traversal, which is wicked hard. You can also use them to securely access services that are hosted on a small device at your home, without having to open a router port (which sometimes is completely impossible, with CGNAT): you just enroll the server device on a network, do the same with the devices from which you wish to access the services, and then access them as if they were in the LAN).

Since I still have an account, let's test [the Terraform provider for ZeroTier](https://registry.terraform.io/providers/zerotier/zerotier/latest).

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "zerotier/zerotier"
  version = "1.4.2"

  provider_config = <<EOT
    zerotier_central_token = "mytoken"
  EOT
}
```

![47cad0d52f9c93f098c1c0395fb66eca.png](./_resources/47cad0d52f9c93f098c1c0395fb66eca.png)

```sql
select * from zerotier_network where id='NETWORKID'
```

![a9afa54cadf095a25ef4d5bdffeeff40.png](./_resources/a9afa54cadf095a25ef4d5bdffeeff40.png)

Again, this data source needs to receive the network ID, there's no way to list all the networks on your account.

## SQL

Now let's start some Inception-level shenanigans, by using [a SQL provider](https://registry.terraform.io/providers/paultyng/sql/0.5.0). Thus, we'll use Steampipe (a SQL DB) to use a Terraform provider to query a SQL DB. Extremely roundabout, but hey, that's where the fun is. Let's try to connect to [a publicly-available Postgres server](https://rnacentral.org/help/public-database), which hosts... some kind of RNA database? The actual data doesn't matter, I just want to not have to boot a Postgres server myself.

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "paultyng/sql"
  version = "0.5.0"

  provider_config = <<EOT
    url = "postgres://reader:NWDMCE5xdipIjRrp@hh-pgsql-public.ebi.ac.uk:5432/pfmegrnargs"
  EOT
}
```

![21171570f0eb29acbdb533b53c7c7cf0.png](./_resources/21171570f0eb29acbdb533b53c7c7cf0.png)

And now let's run SQL queries using a SQL server that delegates to a Terraform provider (yay):

```sql
select * from sql_driver;

select jsonb_array_elements(result) as result from sql_query where query='SELECT upi, taxid, ac FROM xref WHERE ac IN (''OTTHUMT00000106564.1'', ''OTTHUMT00000416802.1'')'
```

![bca53fdbbcd4c52b4e27053597b3f80f.png](./_resources/bca53fdbbcd4c52b4e27053597b3f80f.png)

Aaand it works. Nice. As you'll note, we made a SQL query through a Terraform provider; Steampipe isn't aware of it. With some more SQL magic, which I'm not qualified to perform, you could convert that to a proper table with columns, as opposed to a table with a single column called `result`. That'd probably involve [the `jsonb_to_recordset` function](https://www.postgresql.org/docs/12/functions-json.html).

## TOTP

Since we're working on weird providers, let's try [the TOTP provider](https://registry.terraform.io/providers/kffl/totp/latest/docs), which will generate TOTP codes on-demand.

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "kffl/totp"
  version = "0.1.3"

  provider_config = <<EOT
  EOT
}
```

![09a0dd275c86fdea525c2af1a3363bad.png](./_resources/09a0dd275c86fdea525c2af1a3363bad.png)

And then let's generate a TOTP:

```sql
select * from totp where secret='BASE32SECRET'
```

We can verify that the TOTP is correct by using [a web generator](https://totp.danhersam.com/), which incidentally also provides me with a random secret:

![9021146b82091d4a1bddada96e26a5f1.png](./_resources/9021146b82091d4a1bddada96e26a5f1.png)

Yep, all correct. Ironically, this is one of very few instances in which Steampipe's cache will bite you. See below, where I waited maybe a minute and then tried to regenerate the token:

![3534801352ca839380b34e499acac2c6.png](./_resources/3534801352ca839380b34e499acac2c6.png)

As you can see, it's no longer correct. This is because Steampipe will cache the result of the query for 5 minutes, and since I'm using the same quals (`secret='...'`), Steampipe assumes that the returned data will be the same. Usually a good assumption, _except_ when the results depend on the current time, which is the entire point of TOTPs.

Luckily, correcting that is easy: `.cache clear` will bust the cache. Furthermore, you could just configure the entire TOTP provider (or, actually, `tfbridge`) to not cache results.

## WhatsMyIP

Finally, let's try the [WhatsMyIP provider](https://registry.terraform.io/providers/dewhurstwill/whatsmyip/latest/docs), which lets you retrieve your public IP.

```hcl
connection "tfbridge" {
  plugin = "jreyesr/tfbridge"

  provider = "dewhurstwill/whatsmyip"
  version = "1.0.3"

  provider_config = <<EOT
  EOT
}
```

![c66d4a92a742d1d9b5d6c2f381ca58ac.png](./_resources/c66d4a92a742d1d9b5d6c2f381ca58ac.png)

```sql
select * from whatsmyip
```

![4922fa38e29ca043479e9a1b1f861d38.png](./_resources/4922fa38e29ca043479e9a1b1f861d38.png)

I'm running on IPv6, which has enough bytes for everyone on the planet many times over, and since I'm not certain of the privacy characteristics of IPv6 addresses, out comes the blur. Have fun with those two octets. The important part is that it works, and I can confirm that, indeed, that is my IP address, as seen by Gmail.

## Recap

We've now gone on a testing spree in which we've run several assorted Terraform providers inside the Steampipe plugin. The aim of this was to see which bugs popped up.

All in all, most plugins worked. We had to implement support for the Terraform Provider Protocol v6, and we did uncover a couple of bugs. Those [are tracked](https://github.com/jreyesr/steampipe-plugin-tfbridge/issues) and will be resolved when I have time.

As far as I can see, we're mostly done with the plugin. It works already, and I should probably start thinking about [publishing it](https://steampipe.io/docs/develop/plugin-release-checklist) so other people can (hopefully) start using it. That will probably be the subject of the next post, since that merits a post on itself.
