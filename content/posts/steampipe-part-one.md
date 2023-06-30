---

title: "Steampipe, Part One"
date: 2023-02-22T19:41:45-05:00
draft: false
summary: This article presents [Steampipe](https://steampipe.io), an aplication that presents disparate data (such as REST APIs) as SQL tables, allowing you to join data across API boundaries. It explains the inner workings of Steampipe plugins, that enable new data sources to be used with it. Finally, it presents a [template repository](https://github.com/jreyesr/steampipe-plugin-samplerest) that can be used as a starter by anyone wanting to create his own plugins.
tags: ['steampipe', 'open-source']
categories: ['go', 'sql']
toc: true
---

## About Steampipe

Straight from their docs: "Steampipe exposes APIs and services as a high-performance relational database, giving you the ability to write SQL-based queries to explore dynamic data"

In other words: Steampipe lets you do this:

```sql
select
  ip,
  aws_ec2_instance.Tags ->> 'Name' as 'name',
  abuseipdb_check_ip.abuse_confidence_score,
  aws_ec2_instance_metric_cpu_utilization_daily.average
from
  servers -- This is a CSV file containing a list of server IPs
  join aws_ec2_instance on servers.ip = aws_ec2_instance.public_ip_address -- This comes (live!) from the AWS API
  join aws_ec2_instance_metric_cpu_utilization_daily on aws_ec2_instance.public_ip_address.instance_id = aws_ec2_instance_metric_cpu_utilization_daily.instance_id
  join abuseipdb_check_ip on servers.ip = abuseipdb_check_ip.ip_address -- This comes (also live!) from the AbuseIPDB API
where 
  date_part('day', now() - aws_ec2_instance_metric_cpu_utilization_daily.timestamp) < 1 and
  abuseipdb_check_ip.abuse_confidence_score > 80;
```

This reads some IPs from a CSV file, then locates the AWS EC2 instances that match the IPs, checks them on AbuseIPDB and, for those that have an abuse score over 80, checks their CPU usage in the last day (again, on AWS). You can easily imagine using this to alert on potentially compromised machines. (Sure, it's not clear if the types of compromise detected by AbuseIPDB, such as spam, will show on CPU metrics, such as cryptominers, but whatever).

In general, Steampipe takes any REST API (or other data sources, such as CSV files, but REST APIs are the most prevalent) and presents it as one or many SQL tables. You can add many data sources (called Plugins), and join data across them. This, I believe, is the primary differentiator of Steampipe, and something that I have never seen anywhere else (see the [Prior Art](#prior-art) section for comparisons).

As of now, Steampipe seems mostly aimed at cloud infrastructure monitoring (AWS, Google Cloud, Azure, Alibaba Cloud, Digital Ocean, OVH), with a bunch of cybersecurity/threat feed integrations (IP information, Shodan, Splunk, VirusTotal) and some monitoring/alerting (PagerDuty, Prometheus, Jira), plus the mandatory OpenAI integration and many others. They seem to have about a hundred plugins, each of which handles one service/API. All plugins are published in the [Plugin Hub](https://hub.steampipe.io/plugins).

## TL;DR

There is a template at https://github.com/jreyesr/steampipe-plugin-samplerest.

To use it, visit the URL, then click the green button "Use this template" where Github usually shows the green "Code" button. That will prompt you to choose a repo name. Choose something that starts with `steampipe-plugin-`, then create your repo. Clone it on your computer, then follow the instructions in the `README`. They will guide you through removing all traces of me, and taking the sample repo from, well, sample code, into actually functional code.

Note that you are not forking the sample repository. The template and your code are not coupled.

The rest of this post was written while I wrote the sample plugin, part to explain it and part to remember it myself. This is especially important since some things that are explained are not in the documentation and were only found by peeking into Steampipe's source code.

## Prior Art

The only thing that comes close to Steampipe's functionality, that I know, is GraphQL federation, but that is an entirely different technology stack and I haven't seen any projects that generate GraphQL servers from external services (well, maybe [Hasura](https://hasura.io/), which is a *really cool technology* by itself, but it still requires you to [write and deploy a GraphQL server that proxies into REST](https://hasura.io/blog/create-a-remote-schema-to-wrap-a-rest-api-hasura/)). Federation seems mostly aimed at first-party APIs, where you have the authority -and bandwidth- to develop a GraphQL server that plays nicely with other GraphQL servers. Steampipe, on the other hand, takes APIs that were developed with no idea of mutual cooperation, and makes them... mutually cooperate.

The [KrakenD](https://www.krakend.io/) API gateway can also call multiple backend services in reaction to a request, then [merge all responses](https://www.krakend.io/docs/endpoints/response-manipulation/) before returning them. However, this stays in REST all the time: you make an API call via HTTP, KrakenD makes multiple API calls on your behalf, all services respond with JSON, and you receive JSON. Therefore, it's different from Steampipe, that interfaces with the user via SQL. Also, the configurations are declarative, in JSON, and therefore get unwieldy quickly. Furthermore, it is more or less limited to fixed numbers of API calls. I can't see a way in which you could run over multiple pages of results, and such a requirement is very easy to implement in Steampipe, as we'll see later.

## Creating a new plugin

Steampipe dedicates a full section in their docs to plugin development: https://steampipe.io/docs/develop/overview

If you haven't used the template at https://github.com/jreyesr/steampipe-plugin-samplerest, you may find some use in the complete instructions, that go from an empty directory to a complete(ish) plugin. Those are the same steps that I took to create the sample plugin.

These are the prerequisites:

1. Install [Go](https://golang.org/doc/install)
2. Install [Steampipe](https://steampipe.io/downloads)
3. Think of a name for your plugin (okay, it's more like a slug). Call it `SOMETHING`.
4. Create a new directory, call it `steampipe-plugin-SOMETHING`. Existing plugins are `steampipe-plugin-shodan`, `steampipe-plugin-aws`, `steampipe-plugin-zendesk`, `steampipe-plugin-csv`.
5. Run the following command in the directory: `go mod init github.com/YOUR_USERNAME/steampipe-plugin-SOMETHING`
6. Run `go get github.com/turbot/steampipe-plugin-sdk/v5`. 

⚠️ As of writing this, there is some weird bug with Go that causes a panic. To solve it, run go get `golang.org/x/sync@v0.1.0` before calling the above command, to force the version of `sync` to a particular value.

7. If the service that you are integrating with Steampipe has a Go SDK package, or something that wraps its API into nicer calls, install it with `go get package_url`. Examples of SDKs are https://github.com/nukosuke/go-zendesk, https://github.com/andygrunwald/go-jira or https://www.mongodb.com/docs/drivers/go/current/

### main.go

The `main.go` file will probably only register your plugin with Steampipe by calling `plugin.Serve`, passing it your plugin's main entrypoint.

Create a file called `main.go`, with the following content:

```go
package main

import (
    "github.com/YOUR_USERNAME/steampipe-plugin-SOMETHING/SOMETHING"
    "github.com/turbot/steampipe-plugin-sdk/v5/plugin"
)

func main() {
    plugin.Serve(&plugin.ServeOpts{
        PluginFunc: SOMETHING.Plugin})
}
```

Note that you will need to replace `YOUR_USERNAME` with your Github username and `SOMETHING` with the name of the plugin.

### Config file

Most first-party plugins (i.e., those developed by Turbot, the company behind Steampipe) separate the configuration management into a separate file. It seems like a good idea, for organization. Create a file called `SOMETHING/connection_config.go`, and fill it with the following content:

```go
package SOMETHING

import (
    "github.com/turbot/steampipe-plugin-sdk/v5/plugin"
    "github.com/turbot/steampipe-plugin-sdk/v5/plugin/schema"
)

type SOMETHINGConfig struct {
    Email *string `cty:"email"`
    Password *string `cty:"password"`
    OtherConfig *bool `cty:"other_config"`
}

var ConfigSchema = map[string]*schema.Attribute{
    "email": { Type: schema.TypeString, },
    "password": { Type: schema.TypeString, },
    "other_config": { Type: schema.TypeBool, },
}

func ConfigInstance() interface{} {
    return &SOMETHINGConfig{}
}

// GetConfig :: retrieve and cast connection config from query data
func GetConfig(connection *plugin.Connection) SOMETHINGConfig {
    if connection == nil || connection.Config == nil {
        return SOMETHINGConfig{}
    }
    config, _ := connection.Config.(SOMETHINGConfig)
    return config
}

func (c SOMETHINGConfig) String() string {
	return fmt.Sprintf(
		"SOMETHINGConfig{email=%s, password=*** (len=%d), other_config=%t}",
		*c.Email, len(*c.Password), *c.OtherConfig)
}
```

See [below](#accessing-credentials) for a more detailed explanation of credentials. For now, note that the actual configuration is declared as a struct with arbitrary members, each one with a tag `` `cty:"field_name_in_config"` ``. Steampipe uses [the go-cty package](https://github.com/zclconf/go-cty/) for this. This is similar to [the json package](https://gobyexample.com/json), which uses `` `json:"field_name"` `` tags to express the mapping between JSON fields and struct members. There is also a `ConfigSchema` variable that specifies the type of each configuration parameter. Further functions generate an empty configuration, and generate one from a `*plugin.Connection.Config` variable. Finally, a `String()` function implements the [`Stringer` interface](https://go.dev/tour/methods/17) and gives you control over what is printed when you print an instance of `SOMETHINGConfig`, like overriding Python's `__str__()` or Java's `toString()`.

By the way, the possible types used in the `ConfigSchema` variable are documented in https://pkg.go.dev/github.com/turbot/steampipe-plugin-sdk/plugin/schema#ValueType.

### plugin.go

The `plugin.go` file declares every table that your plugin will expose. Tables should roughly correspond with entities that are exposed by whatever service is declared by your plugin. For example:

* Github exposes Users, Repositories, Issues, Releases and Organizations
* AWS exposes many, *many* models: EC2 instances, networks, network interfaces, lambda functions, SQS Queues, S3 Buckets, IAM Groups, Roles and Policies, metrics, Accounts, Availability Zones, Regions, RDS Instances... Indeed, it exposes (as of now) 382 tables
* Auth0 exposes Users, Roles, Permissions, Clients, Logs
* Google Sheets exposes Sheets, Columns and Cells, plus dynamic data models for every sheet that it can see
* Grafana has Dashboards, Data Sources, Folders, Orgs, Teams and Users

You'll need to decide what data models you want to expose. If the remote service has an API, you'll probably look at it and (more or less) replicate their data models: everything that has an endpoint `GET /api/<some object>` that returns all objects of that type is a prime candidate for its own table.

Create a file called `SOMETHING/plugin.go`, with the following content:

```go
package SOMETHING

import (
    "context"

    "github.com/turbot/steampipe-plugin-sdk/v5/plugin"
    "github.com/turbot/steampipe-plugin-sdk/v5/plugin/transform"
)

func Plugin(ctx context.Context) *plugin.Plugin {
    p := &plugin.Plugin{
        Name: "steampipe-plugin-SOMETHING",
        DefaultTransform: transform.FromGo().NullIfZero(),
        ConnectionConfigSchema: &plugin.ConnectionConfigSchema{
            NewInstance: ConfigInstance,
            Schema: ConfigSchema,
        },
        TableMap: map[string]*plugin.Table{
            "something_one_model": tableSomethingOneModel(),
            "something_another_model": tableSomethingAnotherModel(),
            "something_user": tableSomethingUser(),
            // any other tables go here...
        },
    }
    return p
}
```

Again, note that you would need to replace `SOMETHING` with your actual package name.

### plugin.go

The `plugin.go` file declares every table that your plugin will expose. Tables should roughly correspond with entities that are exposed by whatever service is declared by your plugin.

Create a file called `SOMETHING/plugin.go`, with the following content:

```go
package SOMETHING

import (
    "context"

    "github.com/turbot/steampipe-plugin-sdk/v5/plugin"
    "github.com/turbot/steampipe-plugin-sdk/v5/plugin/transform"
)

func Plugin(ctx context.Context) *plugin.Plugin {
    p := &plugin.Plugin{
        Name: "steampipe-plugin-SOMETHING",
        DefaultTransform: transform.FromGo().NullIfZero(),
        ConnectionConfigSchema: &plugin.ConnectionConfigSchema{
            NewInstance: ConfigInstance,
            Schema: ConfigSchema,
        },
        TableMap: map[string]*plugin.Table{
            "something_one_model": tableSomethingOneModel(),
            "something_another_model": tableSomethingAnotherModel(),
            "something_user": tableSomethingUser(),
            // any other tables go here...
        },
    }
    return p
}
```

Again, note that you would need to replace `SOMETHING` with your actual package name.

### Accessing credentials

Most plugins require some form of configuration. For example, the Zendesk plugin's config looks like this:

```hcl
connection "zendesk" {
  plugin     = "zendesk"
  subdomain  = "dmi"
  email      = "pam@dmi.com"
  token      = "17ImlCYdfZ3WJIrGk96gCpJn1fi1pLwVdrb23kj4"
}
```

Your plugin will most likely need at least some of the following:

* (Required) A plugin key, set to `SOMETHING`
* Username/email
* Password
* Alternatively, an API key/access token/secret key/something similar
* If the service is self-hosted/on-premises, an IP and port
* If the service is multi-tenant, a subdomain
* A flag specifying if in the test/production networks, such as [PayPal's Sandbox mode](https://developer.paypal.com/tools/sandbox/) or [PyPI's test repository](https://packaging.python.org/en/latest/guides/using-testpypi/), or any cryptocurrency in existence, taking a page from Bitcoin's testnet. These services use entirely different domains to provide better isolation between the test and production environments.

Steampipe insists in respecting the "usual" resolution order for configuration. In practice, this applies to services that provide a CLI that installs in your shell, such as [AWS](https://aws.amazon.com/cli/), [Google Cloud](https://cloud.google.com/sdk/gcloud), [Azure](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) or [Kubernetes](https://kubernetes.io/docs/reference/kubectl/). Such tools usually save session information in a file in your home directory, which can be overridden with environment variables. Steampipe respects this information, which allows it to "just work" in your local device, assuming that you already have it set up for the service in question. Most SaaS or self-hosted tools, however, don't provide a CLI and therefore don't save session information on your filesystem. For these services, resolution order is not as important, and you can manage by simply declaring all required credentials in the credential file.

Credentials files are saved by default in the `~/.steampipe/config` directory, with the `.spc` extension (Steampipe Config?). As a user, while installing a plugin, a credentials file will also be created there, with default information. You'll then edit it with your credentials and, if required, add new connections.

Some trivia: credentials files are written in the [HCL language](https://github.com/hashicorp/hcl), used by everything Hashicorp (Terraform config files, Vault policies, Nomad job files, Consul service definitions, ...) and nowhere else that I have seen. It's unclear why Steampipe chose such a language instead of JSON, YAML, TOML or other similar languages. It could be because HCL, via Terraform, is used in the infrastructure-as-code space, which Steampipe seems to hail from, or maybe because HCL defines simple operations and passing values from the host application into the configuration file.

As a plugin developer, you'll need to:
* Determine which credentials are required
* Write an example config file, fill it with sample credentials and provide it alongside your code
* Use the credentials in your plugin code

To provide the example file, create a file `config/SOMETHING.spc`, and fill it with:

```hcl
connection "SOMETHING" {
  plugin = "hub.steampipe.io/plugins/YOURUSERNAME/SOMETHING"
  email = "me@example.com"
  password = "mypassword"
  other_config = true
}
```


Replace `YOURUSERNAME` and `SOMETHING` with their corresponding values, as above. When Steampipe installs your plugin, it should also copy this file to its actual config directory, giving you (and any other user) a base file that demonstrates the syntax.

This file is parsed with the help of the `SOMETHING/connection_config.go` file, into a `SOMETHINGConfig` object:

```go
package SOMETHING

// imports

type SOMETHINGConfig struct {
    Email *string `cty:"email"`
    Password *string `cty:"password"`
    OtherConfig: bool `cty:"other_config"`
}

// GetConfig :: retrieve and cast connection config from query data
func GetConfig(connection *plugin.Connection) SOMETHINGConfig {
    // some error handling code
    
    config, _ := connection.Config.(SOMETHINGConfig)
    return config
}
```

Then, in your plugin files `SOMETHING/table_one_model.go`, in the list and get functions (called *hydrate functions* in Steampipe parlance, by the way), you can read the credentials from the `*plugin.QueryData` variable that gets passed to them as a second argument:

```go
func getOneModel(ctx context.Context, d *plugin.QueryData, h *plugin.HydrateData) (interface{}, error) {
    config := GetConfig(d.Connection) // This calls the GetConfig function from the SOMETHING/connection_config.go file
    // config is of type SOMETHINGConfig
    
    email := config.Email
    password := config.Password
    other_config := config.OtherConfig
    
    // Instantiate an SDK object, if such a package exists ,using the variables above
    conn := myservicepkg.Service(email, password)
    _, err := conn.TestConnection()
    if err != nil {
        return nil, err
    }
    
    return conn.ListAllObjects() // This assumes that conn.ListAllObjects returns ([]myservicepkg.OneModel, error)
}
```

## Hydrate functions

On some tables, you may not have a "list all" method. For example, for an API that provides information about an arbitrary IPv4 address, listing all rows of the table would attempt to enumerate `2^32` rows, which will probably make any API rate limits very upset, and also take a few centuries. Even if an API call takes 10ms (which is really low for a cross-Internet call) and every API call can return 1000 rows (which is fairly high, most APIs will let you return maybe 100 results per page), you'll need 11 hours, 55 minutes, 49 seconds and 672960 microseconds to return all results. Enjoy the gratuitously high precision of that result for a bit.

In such cases, it makes no sense to provide a "list all" method, only a "get single" method. In SQL, that will be seen like this:

```sql
SELECT *
FROM ip_info_table; -- This will not work, 

SELECT *
FROM ip_info_table
WHERE ip_address LIKE '1.1.1.%'; -- This will not work, unless Steampipe supports it and the plugin has explicit handling for searching

SELECT *
FROM ip_info_table
WHERE ip_address = '1.1.1.1'; -- This will work, since it calls the "get single" method

SELECT *
FROM ip_info_table
WHERE asn = 'AS1'; -- This will not work either, since the asn column is not the "primary key" of the IP information table, and therefore it will get sent to the "list all" method
```

For other services, where the complete list of entities is probably of a small(ish) size, such as "Github repos for my account", a "list all" function does make sense.

### Other hydrate functions

Steampipe's docs mentions that other hydrate functions can exist, apart from List and Get. Such additional hydrate functions are used to fill columns that shoud appear in the same DB table, but may not be available in the same API call. For example, suppose that the you wanted to provide a count of messages that are currently enqueued in a SQS queue[^1]. The list of queues is obtained with the [ListQueues endpoint](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ListQueues.html), but that endpoint only returns the queue's URL, which serves as its primary ID. The (approximate) count of enqueued messages is obtained (by queue) by calling the [GetQueueAttributes endpoint](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueAttributes.html). However, from the point of view of Steampipe, both the queue's URL and the message count should appear in a table called, say, `aws_sqs_queue`. To achieve this, the `aws/table_aws_sqs_queue.go` file should specify that the `enqueued_count` column should be hydrated separately:

```go
func tableAwsSqsQueue(ctx context.Context) *plugin.Table {
    return &plugin.Table{
        Name: "aws_sqs_queue",
        // ...
        Columns: []*plugin.Column{
            // Any other columns
            {Name: "enqueued_count", Type: proto.ColumnType_INT, Hydrate: getMetadata, Transform: transform.FromField("EnqueuedCount")}
        },
    }
}

type SQSMetadata struct {
    EnqueuedCount int
}

func getMetadata(ctx context.Context, d *plugin.QueryData, h *plugin.HydrateData) (interface{}, error) {
    queue_url := h.Item.QueueUrl
    
    // Call the GetQueueAttributes endpoint, get credentials from d.Connection as described above
    // NOTE: This is all fake code, the awsSdk class does not exist, and I'm imagining the response type too
    response := awsSdk().GetQueueAttributes(["ApproximateNumberOfMessages"])
    
    return SQSMetadata{
        EnqueuedCount: response.Data["ApproximateNumberOfMessages"],
    }
}
```

If at all possible, it's better to use a single hydration function to hydrate multiple columns. Steampipe will only call the hydration function once for each row, and then "distribute" the results to all columns that reuse it and are included in the `SELECT` clause. Therefore, the function getMetadata in the last code snippet is not actually efficient. It only queries for the `ApproximateNumberOfMessages` and returns it in the `SQSMetadata` struct. It would be better to query for all the metadata available in the same endpoint, and then adding all those fields in the `SQSMetadata` struct. Thus, the plugin would make a single call to the AWS API, saving time, resources and quota. In that way, it doesn't matter if the client requires only one field or all of them.

If no metadata is required at all, the hydrate function `getMetadata` isn't even called.

## Predicate pushdown: the art of delegating filtering to remote servers

Sometimes, data sources implement some sort of remote filtering to optimize queries, by pushing the filtering criteria closer to the data to be filtered. PostgreSQL calls it [Remote Query Optimization](https://www.postgresql.org/docs/current/postgres-fdw.html#id-1.11.7.47.15) and uses it in Foreign Data Wrappers[^2]. Spark, Hive and friends call it [Predicate Pushdown](https://cwiki.apache.org/confluence/display/Hive/FilterPushdownDev). In both cases, the core idea is the same: instead of fetching all data and then applying filters, send the filters to the source data and let the source sort it itself, returning prefiltered data. It's the same wisdom embodied in "don't do filtering client-side".

Steampipe could use predicate pushdown on list functions. Get functions don't need it, because they already receive an ID/GUID/primary key/unique URL/whatever else identifies a single object.

### Failed attempt #1: Accessing unsafe fields on the List function

My first attempt involved accessing a field the name of which starts with `unsafe`, which is always exciting...

![A screenshot showing access to the UnsafeQuals attribute in the List method](/images/steampipe-part-one/unsafe_quals.png)

This is a simple list function. Normally, you would simply call the "list all" API, possibly run through all pages of the response, and then stream each result as a row. However, the `plugin.QueryData` parameter has enough information to push predicates to the remote API:

* L38-L41: We print `d.Quals` and `d.EqualsQuals`, which are empty, as expected, since we haven't done anything to make Steampipe pass them in the List method
* L42: We can also iterate over `d.QueryContext.UnsafeQuals`, which does contain all qualifiers/`WHERE` clauses!
* L43: `d.QueryContext.UnsafeQuals` comes in the form of a map of column names to qualifiers. In this case, there are two columns involved, `column_1` and `column_2`, and three qualifiers, `column_1 LIKE 'test%'`, `column_1 != "test"` and `column_2 > 0`, so the map has two elements.
* L44: We then iterate again over the qualifiers for the column.
* L45-L49: We can access:
   * The field name (L46), which should be the same as the column that we are iterating on the outer loop
   * The "operator", or the SQL operation (equals, different, greater than, LIKE, whatever else) (L47). Note that we need a [type assertion](https://go.dev/tour/methods/15) to get the actual value, since `qual.Operator` is typed to return an interface type. The other concrete type that implements that interface is a tuple type, and I don't see how it could be used as an operator (are any SQL operators represented as tuples?).
   * The actual value (L48). Note that, like the operator, `qual.Value.Value` also returns an interface type, and therefore you may need specific calls to extract the actual native value. For example, see the qualifiers that are involved in `column_1`, in the log at the right panel. Both of them are string values (since the column is a string too!), so the `qual.Value.GetStringValue()` call returns the actual value. `qual.Value.GetInt64Value()` returns 0, since the strings cannot be casted to ints. On the other hand, the `column_2` qualifier has an int value, so the `qual.Value.GetStringValue()` call returns an empty string, and `qual.Value.GetInt64Value()` returns the actual value (granted, it's 0 in this screenshot, so that is not different from above).

This means that, if you want it, you can get access to all `WHERE` clauses while composing your API call. In other words, if your API has some sort of "search" functionality, you can use it to prefilter the data that you return.

This, however, causes issues with caching. Steampipe caches query results quite aggressively, which is usually a good thing since you want to minimize API calls, both to save quota and for speed. However, this messes with the results, since Steampipe expects all calls to the List endpoint to return the same values (unless the actual backend data changes, which is handled through cache expiration). If your plugin filters data behind Steampipe's back, it may return wrong results:

![A sequence diagram showing the normal flow of two executions of the List method](/images/steampipe-part-one/seq_all_ok.png)

This is what Steampipe expects to happen. Steampipe expects to do all the filtering itself after the data is returned, therefore, it happily caches the results (6) as "this is what the List All function returns (5) for this table". Any changes in filtering criteria get handled by Steampipe, by recalling the data from cache (10, 11) and applying new filters (12). This works well as long as the plugin itself does a single "List All" call (3), with no further filtering. 

However...

![A sequence diagram showing abnormal flow of two executions of the List method. The second one erroneously hits the cache and returns invalid results](/images/steampipe-part-one/seq_unsafe_quals.png)

This is what happens when you push down predicates. The first call runs fine (3), but then its (prefiltered) results get cached (6). On a second call (9), Steampipe retrieves the results (10) and attempts to filter them (12). Depending on what the filters are, you may get no results. For example, above, the cache will save results (6) where `column1` is greater than 0. If the second query asks for rows where `column1` is 0, it will get no results. However, if the result of the second query is a subset of the first, the results will be OK, since the cache will hold all the values required to answer the second query (think `column1` > 0 and the `column1` > 1)

### Failed attempt #2: Using key columns and LIKE

Fine, so we can't mess with filtering behind Steampipe's back. We have to use the provided interface.

The `ListConfig` struct does expose a `KeyColumns` field, that is intended to be used for this purpose: keying the List All entry in the cache. Any List calls for the table that have the same combination of `KeyColumns` will be served from cache. If you specify no `KeyColumns`, there is a single cache entry. This is what happened in the example above.

The `KeyColumns` field is way more common in the `GetConfig` struct, where it specifies the actual primary key of the table, but some plugins also use it in `ListConfig`.

As far as I have seen from reading Steampipe's source code, the logic is as follows:

1. For every query, it checks to see if it contains all the KeyColumns specified in GetConfig (the function that retrieves a single element). For example, `SELECT * FROM table WHERE id = 1`. This is called "satisfying the qualifiers" or something to that effect.
2. If it does, it calls the Get function to get a single element, passing it the qualifiers in `d.EqualsQuals`.
3. Otherwise, it will have to call the List function, since the user didn't provide enough information to uniquely identify a row.
   1) If the query satisfies the List qualifiers, it passes it the qualifiers in `d.Quals` and `d.EqualsQuals`. `d.EqualsQuals` gets the clauses that have an equals operator (`column_2 = 1`), while `d.Quals` gets everything (equal, not-equal, greater than, less than, is null, is not null)
   2) Otherwise, `d.Quals` and `d.EqualsQuals` will be empty.

Note that all key columns can be marked as required or optional. This infuences whether or not a query satisfies the qualifiers: a Required column must be included in the query, while an Optional column can be missing. Every KeyColumn also specifies the operators that can satisfy the qualifiers.

For example, for the screenshot below:

* `column_1 like 'test%'` would satisfy the qualifiers, since it matches the name and operator. `column_2` is Optional, so its absence does not disqualify the query.
* `column_2 > 0 would` also satisfy. `column_1` is Optional, and `column_2`'s operator matches.
* `column_1 != '' and column_2 > 0` would NOT satisfy, since `column_1`'s operator is not in the list of approved operators.
* The empty clause would also satisfy the qualifiers, since both columns are optional. 

The operators that can be specified are `=`, `!=`, `>`, `<`, `>=`, `<=`, `is null`, `is not null`. As long as you only want to filter on numerical columns, everything is fine. However, many times you will want to filter on strings, such as "all SQS queues whose names start with something". That would be handled with a `LIKE` operator, but that cannot be specified, as seen in the image below:

![A screenshot showing the error code that appears when attempting to declare a KeyColumn with the LIKE operator](/images/steampipe-part-one/keycolumn_like.png)

So, `KeyColumns` cannot be used for fuzzy-searching with `LIKE`. That's a shame, since it would be nice to be able to write the following queries:

```sql
SELECT * FROM github_my_repos WHERE name ILIKE 'steampipe%';

SELECT * FROM linkedin_companies WHERE company_name ILIKE '%acme%';

SELECT * FROM gmail_mails WHERE subject LIKE '[URGENT]%';
```

However, if you only need to express numerical filters or string filters with equality, this will work. See, for example, the [LDAP plugin](https://github.com/turbot/steampipe-plugin-ldap), which provides a very elegant syntax to query for users:

```sql
select
  dn,
  sam_account_name,
  mail,
  department
from
  ldap_user
where
  department = 'Engineering'
  and when_created > current_timestamp - interval '30 days';
```

Internally (see [the source code](https://github.com/turbot/steampipe-plugin-ldap/blob/b0ecc5bd0d67760639ae41cfff4074d5de7c3e8a/ldap/table_ldap_user.go#L73-L87)), many columns are declared as `KeyColumns`, all of them optional. Then, in the List function, it [generates an LDAP filter string](https://github.com/turbot/steampipe-plugin-ldap/blob/b0ecc5bd0d67760639ae41cfff4074d5de7c3e8a/ldap/table_ldap_user.go#L306) by [combining all the `WHERE` clauses that have been set](https://github.com/turbot/steampipe-plugin-ldap/blob/b0ecc5bd0d67760639ae41cfff4074d5de7c3e8a/ldap/utils.go#L140) into a single string in the appropriate format.

### Attempt #3: A dedicated *_search table with a string/JSON query

This is the aproach that is used by most Steampipe plugins that offer search functionality: see [Algolia](https://hub.steampipe.io/plugins/turbot/algolia/tables/algolia_search), [Github](https://hub.steampipe.io/plugins/turbot/github/tables/github_search_repository), [Zendesk](https://hub.steampipe.io/plugins/turbot/zendesk/tables/zendesk_search), [LinkedIn](https://hub.steampipe.io/plugins/turbot/linkedin/tables/linkedin_search_company), [VirusTotal](https://hub.steampipe.io/plugins/turbot/virustotal/tables/virustotal_search) and others.

1. If you already have a table to list all rows (for example, Github's `github_repo`), declare a new table with the same name plus `_search` (`github_repo_search`)
2. Otherwise (for example, LinkedIn, which doesn't allow you to list all companies, just to search for them), the `linkedin_company_search` table will be the main Company table itself.
3. That table should contain all data about your model, plus a `query` column:
   1) For Github repos, an ID, name, author, description, whatever else a repo has, plus the `query` column
   2) For LinkedIn companies, an ID, name, description, location, industry, number of employees, whatever, plus the `query` column.
4. Then, the `ListConfig` for that column should declare the query column as a `KeyColumn`, with operator `=`.
5. The List hydrate function should access the `d.EqualsQuals` property, read the value of `query`, and translate it to the API format:
   1) Github has a [repo search syntax](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories) that look like `user:myuser forks:>100`, as a string. This is pased as an API param, so the plugin would simply need to move it from `EqualsQuals` to the API call.
   2) LinkedIn simply takes a string and does some magic with it, presumably fuzzy-searching over several fields (at least name for a company, and user name and employer for a user). The plugin should take the value from `EqualsQuals` and move it to the API call.
6. Any further `WHERE` clauses that are not part of the `KeyColumns` are not passed on `EqualsQuals` and therefore not applied on the API call. They are instead applied to the returned data, inside Postgres. For example, this query would delegate the `query = 'mycompany'` filter to the LinkedIn API, and apply the `headline ILIKE '% we make stuff!%'` filter internally, to the returned data:

```sql
SELECT * FROM linkedin_search_company WHERE query = 'mycompany' and headline ILIKE '%we make stuff%';
```

![A screenshot showing the use of a dedicated column, called query, to express any search conditions in SQL and delegate them to the backing service](/images/steampipe-part-one/query_as_column.png)

For example, in this query, since only the `query` column is declared as a `KeyColumn`, only it appears on `EqualsQuals`. The `column_1 != 'test'` clause is applied after the API call returns, after your plugin is done and before the user sees data.

This bypasses the problem of the `LIKE` operator not being supported, since all queries use the `=` operator. However, it depends on the remote API providing either fuzzy search (so that you can send it a single string and it takes care of searching on wherever it wants to) or a more-or-less developed internal search language, such as [Github](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories) (so that you can again send a single string, such as `user:myuser forks:>100`, and it takes care of parsing it and applying each criteria to its appropriate field). What if the remote API requires you to send an object of filters? Something like:

```json
{
  "field1": { "op": "contains", "val": "asd" },
  "field2": {
    "op": "and",
    "val": [
      { "op": "gte", "val": 0 }
      { "op": "neq", "val": 1 }
    ]
  }
}
```

In such a case, you could make the `query` column be of JSON type, and again use the `query = '{"field1": {"op": "contains", "val": "asd"}, ...}'::json` syntax to send the raw data expected by the service. It does push the burden of learning the filter syntax to the user, but it probably beats designing your own DSL to translate `query = 'contains(field1, asd) && (gte(field2, 0) && neq(field2, 1))'` into the JSON document that the API expects.

A further complication happens when your `query` column is not joined with `AND` to the rest of the query. For example:

![A screenshot showing what happens when a KeyColumn is ORed with another condition. In this case, the condition cannot be pushed to the backing service](/images/steampipe-part-one/ored_quals.png)

Here, since the `query` clause is joined with `OR`, Steampipe cannot pass that condition to the plugin. This is because the results should be the logical union of the elements that match the `query` and the elements that match the `column_1` condition. Indeed, the plugin sees an empty `EqualsQuals` parameter, just as if the user hadn't specified `query`. This forces the plugin to return all data, and makes Steampipe perform all the filtering itself.

## Conclusion

We have gone through most of the files that compose a Steampipe plugin. Together, they expose data (typically taken from a REST API) into SQL, where it can be combined with other data, either internal or from other APIs. We have reviewed the directory structure that Steampipe expects, and the concepts that are employed while developing the plugin.

We have also explored the possibilities for filtering data in the backing service, saving network resources, time and API quota. We have seen the limitations that the provided mechanisms have, plus (hopefully) ways of working around them.

Finally, there is a sample plugin at https://github.com/jreyesr/steampipe-plugin-samplerest. 

Astute readers might note that no actual code has been presented yet. The sample plugin returns no data, ever. The next post will (hopefully) describe the work required to implement an actual, working plugin. Currently, I'm thinking about integrating [Blockchain.com's Explorer API](https://www.blockchain.com/explorer/api/blockchain_api), which you can query for a Bitcoin wallet's transactions. I can envision that being useful to implement some sort of alerting if your shiny product sees transactions involving accounts that are known to be involved in ransomware or other unsavory activities.

[^1]: At this point, everyone with experience in distributed systems starts laughing hysterically, since the mere idea of obtaining an accurate count is ludicrous. If you get unlucky (and you will, as ensured by Mr. Murphy), it will be outdated by the time you receive it. This is why AWS is very careful in specifying that the returned count is approximate. They even put it in the metric name.
[^2]: Which, by the way, is the technology that powers Steampipe itself!
