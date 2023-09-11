---
title: "A Steampipe plugin to forward queries to ordinary PostgreSQL databases"
date: 2023-09-10T20:51:03
summary: "In this article, we present a new Steampipe plugin that can provide access to a plain PostgreSQL database. This has been requested several times and current solutions are cumbersome. This plugin extends the reach of Steampipe's queries to static (or not) data that is hosted on ordinary tables."
tags: ['steampipe', 'open-source', 'new-project']
categories: ['go', 'sql']
toc: true
---

TL;DR: We've built [a new Steampipe plugin](https://github.com/jreyesr/steampipe-plugin-postgres), which lets you access normal PostgreSQL tables from Steampipe. That was previously somewhat hard: you could manually configure the `postgres_fdw` FDW on Steampipe, export the data as a CSV and then read it on Steampipe, or wrap a REST server on top of the database and then write a Steampipe plugin. Each of those alternatives comes with some downsides. With this plugin, you just provide a connection string. Then, the plugin will connect to the DB, inspect the tables, and make matching tables appear on Steampipe (think of the CSV plugin, which presents one table per CSV file). Queries made against those tables will be forwarded to the backing Postgres server, and you'll then be able to `JOIN` that data against ordinary Steampipe plugins, such as AWS or Kubernetes.

Still TL;DR: The code for this plugin is on Github: <https://github.com/jreyesr/steampipe-plugin-postgres>. Or simply run `steampipe plugin install jreyesr/postgres` if you want to use it yourself on your Steampipe instance.

## Introduction

From time to time, I visit the [Steampipe Slack](https://steampipe.slack.com/). In one week, there have been [at least](https://turbot-community.slack.com/archives/C01UECB59A7/p1693898694944759) [two cases](https://turbot-community.slack.com/archives/C01UECB59A7/p1693514434682339) of someone asking if it is possible to connect Steampipe with plain, normal Postgres instances. And [there are more](https://turbot-community.slack.com/archives/C044P668806/p1692621900714219). For example, this is Tim Eggert:

> Hi there! It's a pleasure to see steampipe growing. I followed it for quite a while and I really really like it. However now I am having a use-case where I want to join data from 2 sources:
> 
> * Kubernetes
> * Tables from our own postgres instance (not the one from steampipe, but another instance)
>
> Now I see a plugin to connect to kubernetes. But I do not find a plugin to connect to custom postgres database. Can you give me a hint on how to get connected to another plain postgres DB? Which plugin would I need to use.

And this is Kevin Lyda:

> Has anyone considered doing a postgresql plugin?  Give it a psql connection string and then expose all those tables?
> 
> I don't know the backend of postgres well, but generally being able to join against an existing postgres db would be useful.  Being able to join logs to an existing db would solve certain debugging scenarios for some of my coworkers.

This is a perfectly legitimate wish: say you have some sort of internal DB where everyone registers their pods, or maybe the namespaces, and you know who is responsible for each one. Steampipe can list all the K8S namespaces alright, but it can't then `JOIN` with normal, static data. That's such a shame. Let's do something about that, shall we?

A _looong_ time ago, I [explored the reverse approach](/posts/steampipe-part-four-integrations/#adding-steampipe-to-another-database): putting a normal Postgres DB in front of Steampipe. Users would connect to that DB, which could store normal data, and then forward any requests that were meant for Steampipe. This used the same [FDW interfaces](https://www.postgresql.org/docs/current/postgres-fdw.html) that Steampipe itself uses to power its magic plugins, this time to access the whole Steampipe server. This worked, somewhat, but it has several downsides:

* You have to provision a new "proxy"/"frontend" Postgres server, install the FDW on it, and then forward some things to Steampipe
* `JOIN`s between normal data and Steampipe data sometimes don't properly forward quals to Steampipe, so instead of sending a `SELECT * WHERE id IN (1, 2, 3)` it just sent `SELECT *` (which triggers a full table scan, AKA a listing of all data in Steampipe, which is usually slower, less efficient and sometimes downright impossible, such as listing all DNS records in the world)
* What if you need to access more than one "normal" Postgres server? This method relies on having the normal Postgres server in front, so it breaks down if you have several of them. If, instead, Steamipe is in front and calls the Postgres servers like it does, say, the AWS API, there's no problem: just add another connection!
* It seems unfair. Like, Steampipe can connect to anything in the world, except _what Steampipe itself is_? (i.e. Postgres servers). That's unacceptable. Besides,
* It _sounds_ like it should be possible. Steampipe can connect to AWS, DNS, even CSV files! And it massages the data models of each of these sources (even JSON, which is very much not SQL-friendly) into Postgres tables. If we're instead accessing Postgres tables already, that should be the easiest&trade; translation ever. Right?

Another alternative is just storing data in Steampipe itself. While not really publicized in the docs, Steampipe is a proper Postgres DB, or at least the `public` schema is. You can `CREATE TABLE`s, `INSERT` and `UPDATE` as normal there. However, that's not necessarily a solution: what if your data already lives somewhere else? What if you need more access control than what Steampipe's single username+password combo can provide? What if you need that data to be replicated, for DR purposes? And so on.

The final alternative, and the one which we'll explore here, is to build yet another Steampipe plugin, which should just forward all queries to the Postgres DB.

## Postgres introspection

First, we'll need to implement some sort of introspection. This is an umbrella term that, in the context of databases, involves [inspecting a DB for metadata](https://docs.oracle.com/cd/E57185_01/ESTUG/ch05s13s01.html), such as tables, their columns and data types.

Introspection is used to build all sorts of fun tools. [Postgraphile](https://www.graphile.org/postgraphile/introduction/), for example, automatically builds a [GraphQL](https://graphql.org/learn/) server from just table definitions. So does [Hasura](https://hasura.io/). For example, this table definition:

```sql
create table forums (
  id serial primary key,
  slug text not null check(length(slug) < 30 and slug ~ '^([a-z0-9]-?)+$') unique,
  name text not null check(length(name) > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

can then be accessed as

```graphql
{
  forums {
    nodes {
      nodeId
      id
      slug
      name
      description
    }
  }
}
```

This is done, as you'd expect, by introspecting the Postgres table. This detects that it's called `forums`, so that's the name of the root query field. Also, introspection can tell that the `forums` table has fields `id`, `slug`, `name` and `description`, so they appear as GraphQL fields too. Furthermore, since GraphQL is typed, those types come from the column types in Postgres. All of this is done automatically, without the user having to write some sort of GraphQL resolver mapping Postgres fields to GraphQL fields.

Administration apps (such as [pgAdmin](https://www.pgadmin.org/)) also introspect their backing DBs heavily. For example, introspection is used [to generate ERD diagrams](https://www.pgadmin.org/docs/pgadmin4/latest/erd_tool.html):

![](https://www.pgadmin.org/static/docs/pgadmin4-7.6-docs/_images/erd_tool.png)

### Atlas Inspect

Another tool that introspects Postgres databases, which we'll use here, is [Atlas](https://atlasgo.io/). This is normally used as a schema migration tool, much like [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate/get-started) or [Django's migrations](https://docs.djangoproject.com/en/4.2/topics/migrations/#migration-files). It can connect to a live DB, then compare its current structure with a "desired state" file, which is normally in Atlas's own [special domain-specific language](https://atlasgo.io/atlas-schema/hcl) (which is [HCL](https://github.com/hashicorp/hcl) under the hood), and spit out a set of operations that must be taken to make the current structure of the DB match the desired state. This is the same pattern that [Terraform](https://www.terraform.io/) uses, more or less, and also Prisma, [Alembic](https://alembic.sqlalchemy.org/en/latest/) and Django migrations, not to mention several other ORMs/migration tools.

A nice property of Atlas, unlike all the other tools mentioned, is that it has several loosely-coupled parts that can be used by themselves: one that [just analyzes the schema of a DB](https://atlasgo.io/declarative/inspect), another that [generates and applies migration plans](https://atlasgo.io/declarative/apply), another that [just compares two schemas](https://atlasgo.io/declarative/diff). We're particularly interested in the first part, [schema inspection](https://atlasgo.io/declarative/inspect). Normally Atlas is used as a CLI tool (you install it and then run `atlas schema inspect -u "postgres://localhost:5432/database"`, for example), but all of that functionality is also published as [a Go package](https://pkg.go.dev/ariga.io/atlas@v0.14.0/sql/schema) that you can import and use yourself, from _your own_ Go program. Indeed, that is not only supported, but [explicitly documented](https://ariga.io/programmatic-inspection-of-databases-in-go-using-atlas/) in a blog post:

> As an infrastructure engineer, I have wished many times to have a simple way to programmatically inspect a database. Database schema inspection can be useful for many purposes. For instance, you might use it to create visualizations of data topologies, or use it to find table columns that are no longer in use and can be deprecated. Perhaps you would like to automatically generate resources from this schema (such as documentation or GraphQL schemas), or to use to locate fields that might carry personally-identifiable information for compliance purposes. Whatever your use case may be, having a robust way to get the schema of your database is the foundation for many kinds of infrastructure applications.

The code that is presented near the end of that post, albeit quite basic, is enough to demonstrate the magic function calls that make everything work. Once you've executed them, you are left with a pointer to a [`schema.Schema`](https://pkg.go.dev/ariga.io/atlas@v0.14.0/sql/schema#Schema), which (as you can see on the docs) can then be used to programmatically navigate to tables, and from there to columns, and so on:

```go
type Schema struct {
	Name    string
	Realm   *Realm
	Tables  []*Table
	Views   []*View
	Attrs   []Attr   // Attrs and options.
	Objects []Object // Driver specific objects.
}

type Table struct {
	Name        string
	Schema      *Schema
	Columns     []*Column
	Indexes     []*Index
	PrimaryKey  *Index
	ForeignKeys []*ForeignKey
	Attrs       []Attr // Attrs, constraints and options.
}

type Column struct {
	Name    string
	Type    *ColumnType
	Default Expr
	Attrs   []Attr
	Indexes []*Index
	// Foreign keys that this column is
	// part of their child columns.
	ForeignKeys []*ForeignKey
}
```

Those three structs hold all that we'd need to analyze a DB (technically just a schema, not a complete DB) and extract some useful information from its structure. Let's try it:

```go
import (
	"database/sql"

	"ariga.io/atlas/sql/postgres"
	"ariga.io/atlas/sql/schema"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/turbot/steampipe-plugin-sdk/grpc/proto"
)

const CONN_STRING = "postgres://testUserIntrospection:HurricaneStartingSample1934@postgresql.introspection.stepzen.net/introspection"

const SCHEMA = "public"

func main() {
	ctx := context.Background()

	// 1
	conn, err := sql.Open("pgx", CONN_STRING)
	if err != nil {
		log.Fatal(err)
	}

	// 2
	driver, err := postgres.Open(conn)
	if err != nil {
		log.Fatal(err)
	}
	
	// 3
	sch, err := driver.InspectSchema(ctx, SCHEMA, nil)
	if err != nil {
		log.Fatalf("failed inspecting schema: %s", err)
	}

	// 4
	for _, table := range sch.Tables {
		var comment string
		for _, attr := range table.Attrs {
			if _attr, ok := attr.(*schema.Comment); ok {
				comment = _attr.Text
			}
		}

		log.Println("===", table.Name, "//", comment)

		// 5
		for _, col := range table.Columns {
			log.Println("    -", col.Name, "->", col.Type.Raw)
		}
	}
}
```

Some interesting sections of that source code are:

1. Here we open a connection to the live DB. This uses the standard [`database/sql` package](https://pkg.go.dev/database/sql), which is the official way of accessing SQL-ish databases. Since that package is engine-agnostic, we use [the `pgx` driver](https://github.com/jackc/pgx) as the actual DB interface
2. Here we create an Atlas analyzer that is specialized to Postgres, passing it the connection
3. Then, we inspect the database schema, which involves actually reading it from the Postgres server. Notice that we also have to provide the schema name, which is usually `public`. This returns a [`schema.Schema`](https://pkg.go.dev/ariga.io/atlas@v0.14.0/sql/schema#Schema) object
4. We can then iterate over all tables, and access some information such as the table name. Here, in order to demonstrate something more complex, we also iterate over [the table's attributes](https://pkg.go.dev/ariga.io/atlas@v0.14.0/sql/schema#Attr), one of which _may_ be a comment. If so, we save that and print it besides the table name
5. Finally, the code loops over the columns of each table, and prints the name and datatype of each

Now, let's try that code and see what happens. This is a random Postgres table that I had lying around:

![8799f000e1306c31b8571ca1008f83ff.png](./_resources/8799f000e1306c31b8571ca1008f83ff.png)

Observe that the table has a comment, and also notice the types of each column. This is what is printed when running the code above:

![e98fb729ddf4c9c7885bd72a5921124e.png](./_resources/e98fb729ddf4c9c7885bd72a5921124e.png)

Let's try again, this time with [a freely-available online Postgres DB, which an entirely unrelated project uses for its tutorials](https://stepzen.com/blog/join-data-postgresql-declarative-graphql-without-sql). It has more tables and hopefully a bit more variety in the data types used:

![b200a9e0ff162db2a32f506efc1fb0c0.png](./_resources/b200a9e0ff162db2a32f506efc1fb0c0.png)

![2fcdacc17976483c113137270ee5c0b0.png](./_resources/2fcdacc17976483c113137270ee5c0b0.png)

And this is what our code sees:

![1ca51d9f24a4d7e19fc478093b05e924.png](./_resources/1ca51d9f24a4d7e19fc478093b05e924.png)

As those screenshots demonstrate, we can programmatically:

* Iterate over tables
* Find the name of each
* Find attributes of the table, such as the comment that is attached to it
* Find the columns of each table
* Find the name of a column
* Extract the type of a column
* Do things with that type, such as using a [type switch](https://go.dev/tour/methods/16) (because the types that Atlas uses are interfaces)

Those are all the basic building blocks that we need to implement a Steampipe plugin, which uses dynamic tables. And I happen to have played with dynamic tables recently, when [building a plugin that exposes the data sources of a Terraform provider](/series/tfbridge/). There we had the same basic problem: we need to discover which data sources are presented by the provider, along with the fields of each, and then report to Steampipe which tables we offer, which are derived from the Terraform data sources (one table per data source, and the columns and their data types can't be hardcoded). This is also the same pattern that the [CSV plugin](https://hub.steampipe.io/plugins/turbot/csv) uses: inspect CSV files, detect the columns of each, then present one table per CSV file, with the columns driven by the actual contents of the file. They all have in common that you can't hardcode the tables and columns, and that different installations of the same plugins (i.e. different connections) may present entirely different schemas. Compare with, say, the Github plugin, where the _data_ of the tables may be different, but at least you'll always have [the same 54 tables](https://hub.steampipe.io/plugins/turbot/github/tables) (as of writing this).

By the way, if you'd like some Go code that connects to a DB, introspects the tables and prints out some information (as we reviewed above), you can find it [on an old commit](https://github.com/jreyesr/steampipe-plugin-postgres/blob/7ca65b63c8a0299ff17838e5e41f5fc1446ed0c2/main.go).

## The plugin

I've explored the internals of dynamic Steampipe plugins (i.e. plugins whose tables aren't fixed, but depend on external factors, such as the CSV and Airtable plugins) in much detail in [the series about building the TFBridge plugin](/series/tfbridge/), especially [in the fourth post](/posts/steampipe-tfbridge-4/#plugins-with-dynamic-tables). You may check that out if you're interested.

The gist of it is that, instead of explicitly listing the tables (see the `TableMap` field), as you'd do on a normal plugin:

```go
// normalplugin/plugin.go

p := &plugin.Plugin{
	Name:             "steampipe-plugin-blockchain",
	DefaultTransform: transform.FromGo().NullIfZero(),
	TableMap: map[string]*plugin.Table{
		"blockchain_wallet":      tableBlockchainWallet(),
		"blockchain_transaction": tableBlockchainTransaction(),
	},
}
```

you provide a `TableMapFunc`, which is _a function_ that runs on plugin boot (normally as Steampipe itself starts) and must return a map of tables:

```go
// postgres/plugin.go

p := &plugin.Plugin{
	Name:             "steampipe-plugin-postgres",
	DefaultTransform: transform.FromGo().NullIfZero(),
	ConnectionConfigSchema: &plugin.ConnectionConfigSchema{
		NewInstance: ConfigInstance,
		Schema:      ConfigSchema,
	},
	SchemaMode:   plugin.SchemaModeDynamic,
	TableMapFunc: PluginTables,
}
```

Since now the tables that will be presented are under the control of live code, you can execute some logic to decide which tables you'll present. [The CSV plugin](https://hub.steampipe.io/plugins/turbot/csv) scans one or several directories on disk and presents one table per CSV file there. [The Airtable plugin](https://hub.steampipe.io/plugins/francois2metz/airtable/tables/%7Bairtable_record%7D) hits the Airtable API and creates one table per table in each Airtable base that it can see. [The Kubernetes plugin](https://hub.steampipe.io/plugins/turbot/kubernetes/tables/kubernetes_%7Bcustom_resource_singular_name%7D) lists [the CRDs](https://thenewstack.io/kubernetes-crds-what-they-are-and-why-they-are-useful/) in the cluster and exposes each of them as a table. [The Google Sheets plugin](https://hub.steampipe.io/plugins/turbot/googlesheets/tables/%7Bsheet_name%7D) exposes one table per Sheet in a specific (single) Sheets document. And so on.

For this plugin, we'll connect to the DB, introspect it (as we've seen above) and build up one (Steampipe) table per (Postgres) table.

### Dynamic tables

```go
func PluginTables(ctx context.Context, d *plugin.TableMapData) (map[string]*plugin.Table, error) {
	tables := map[string]*plugin.Table{}

	config := GetConfig(d.Connection)
	schemaName := *config.Schema
	if schemaName == "" {
		schemaName = "public"
	}

	// 1
	schema, err := GetAtlasSchemaForDBSchema(ctx, *config.ConnectionString, schemaName)
	if err != nil {
		plugin.Logger(ctx).Error("postgres.PluginTables", "get_schema_error", err)
		return nil, err
	}

	for _, tableAtlas := range schema.Tables {
		// Pass the actual *schema.Table as a context key, as the CSV plugin does
		tableCtx := context.WithValue(ctx, keyTable, tableAtlas)

		// 2
		tableSteampipe, err := tablePostgres(tableCtx, d.Connection)
		if err != nil {
			plugin.Logger(ctx).Error("postgres.PluginTables", "create_table_error", err, "tableName", tableAtlas.Name)
			return nil, err
		}
		// 3
		tables[tableAtlas.Name] = tableSteampipe
	}

	return tables, nil
}
```

At a very high level, that looks simple:

1. Connect to the Postgres DB, extract all the info, and return [a `*schema.Schema` variable](https://pkg.go.dev/ariga.io/atlas@v0.14.0/sql/schema#Schema)
2. For each table that was detected, build up a Steampipe table (which requires specifying the columns, key columns and hydrate function)
3. We add that (Steampipe) table to the map of table names to table definitions

The `GetAtlasSchemaForDBSchema` function is quite similar to what we've reviewed in [the previous section](#atlas-inspect), so we won't review it here. It just calls [`InspectSchema`](https://pkg.go.dev/ariga.io/atlas@v0.14.1-0.20230906140243-509a6c18d65f/sql/schema#Inspector.InspectSchema). The `tablePostgres` function is more interesting. It must take [a `*schema.Table`](https://pkg.go.dev/ariga.io/atlas@v0.14.0/sql/schema#Table) (i.e. Atlas's representation of a Postgres table) and return [a `*plugin.table`](https://pkg.go.dev/github.com/turbot/steampipe-plugin-sdk/v5@v5.5.1/plugin#Table) (i.e. Steampipe's representation of a table). While similar, those two pieces of data aren't the same: for example, Atlas's one is database-agnostic since Atlas can be used to introspect any database. For example, Atlas may tell you that a column has [a domain type](https://www.postgresql.org/docs/12/domains.html), while Steampipe can't accept that.

```go
func tablePostgres(ctx context.Context, connection *plugin.Connection) (*plugin.Table, error) {
	tableAtlas := ctx.Value(keyTable).(*schema.Table)
	name := tableAtlas.Name

	return &plugin.Table{
		Name:        name,
		// 1
		Description: FindCommentOnAttrs(tableAtlas.Attrs),
		List: &plugin.ListConfig{
			// 4
			Hydrate:    ListTable,
			// 3
			KeyColumns: makeKeyColumns(ctx, tableAtlas),
		},
		// 2
		Columns: makeColumns(ctx, tableAtlas),
	}, nil
}
```

1. This is a simple function that just runs over all the attrs that are attached to a table, and returns the one that is the table's comment, if it can find it. You'll remember that on our old Go program we had to iterate over all attrs and try to cast each to a comment, since the Atlas data model doesn't treat the comment especially (tables can have other attrs too, such as a collation)
2. The columns are built to reflect, as much as possible, the columns on the backing Postgres DB. This is sometimes not possible, for types that can't be clearly translated to Steampipe's allowed column types. More on that later
3. Steampipe requires key columns, which are used to determine which `WHERE` conditions can be safely forwarded to the backing service. Here, since we're dealing with Postgres DBs, we try to forward _all the things_ that Steampipe allows us to, for extra efficiency
4. The hydration function will be executed when a user runs a `SELECT` that involves our table. It will in turn run a `SELECT` against the backing Postgres DB, forwarding all the conditions that it can, and just stream back what it receives

### Building the columns

To inform Steampipe of which columns exist on the table, we need to refer to the columns that the backing table has, and (try to) convert the types of the original DB into [what Steampipe tolerates](https://steampipe.io/docs/develop/writing-plugins#column-data-types), which is a subset of all Postgres types.

```go
func makeColumns(ctx context.Context, tableAtlas *schema.Table) []*plugin.Column {
	columns := make([]*plugin.Column, 0, len(tableAtlas.Columns))

	for _, col := range tableAtlas.Columns {
		// 1
		postgresType := PostgresColTypeToSteampipeColType(ctx, col)
		if postgresType == proto.ColumnType_UNKNOWN {
			plugin.Logger(ctx).Warn("postgres.makeColumns", "msg", "unknown type, skipping column!", "column", col.Name, "type", col.Type.Raw)
			continue
		}
		columns = append(columns, &plugin.Column{
			Name:        col.Name,
			Type:        postgresType,
			Description: FindCommentOnAttrs(col.Attrs),
			// 2
			Transform:   transform.FromP(getMapKey, col.Name),
		})
	}

	return columns
}

func PostgresColTypeToSteampipeColType(ctx context.Context, col *schema.Column) proto.ColumnType {
	var x proto.ColumnType

	switch t := col.Type.Type.(type) {
	case *schema.BinaryType, *postgres.BitType, *schema.EnumType, *schema.StringType, *schema.UUIDType:
		x = proto.ColumnType_STRING
	case *schema.BoolType:
		x = proto.ColumnType_BOOL
	case *schema.DecimalType, *schema.FloatType, *postgres.CurrencyType:
		x = proto.ColumnType_DOUBLE
	case *schema.IntegerType, *postgres.SerialType:
		x = proto.ColumnType_INT
	case *schema.JSONType:
		x = proto.ColumnType_JSON
	case *schema.TimeType, *postgres.IntervalType:
		x = proto.ColumnType_TIMESTAMP
	case *postgres.NetworkType:
		if t.T == "inet" {
			x = proto.ColumnType_INET
		} else if t.T == "cidr" {
			x = proto.ColumnType_CIDR
		} else {
			x = proto.ColumnType_UNKNOWN
		}
	default:
		// As of writing this, these are the types that fall here, AKA those that we don't know how to translate
		// *schema.SpatialType, *schema.UnsupportedType, *postgres.TextSearchType, *postgres.ArrayType, *postgres.OIDType, *postgres.RangeType, *postgres.UserDefinedType, *postgres.XMLType
		x = proto.ColumnType_UNKNOWN
	}

	return x
}
```

1. The conversion from arbitrary Postgres column types to the subset that Steampipe supports is done on a separate function
2. The `Transform` field is used after the hydration function runs. The hydration function normally returns a single item per record (usually a Go struct, but here it'll be a map of strings to `any`), and the hydration function must somehow extract the value of _this specific column_ from that item. In other words, the same hydration item (which is a row on the result table) is passed through different transform functions, one per column. Here it's easy: just access a key from the map

The `PostgresColTypeToSteampipeColType` has a bunch of rules to translate from arbitrary Postgres types to Steampipe types. For example:

* String-ish types (actual strings, `TEXT`, binary strings, UUIDs, [bitstrings](https://www.postgresql.org/docs/8.3/datatype-bit.html)) become strings in Steampipe
* Numeric types (integers, floats, doubles and [money types](https://www.postgresql.org/docs/8.3/datatype-money.html)) become double-precision floats
* Integers and `SERIAL` become integers
* Timestamps and intervals become timestamps
* Things that can't be cleanly mapped ([spatial types](https://www.postgresql.org/docs/8.3/datatype-geometric.html), for example, or [XML](https://www.postgresql.org/docs/8.3/datatype-xml.html)) are assigned to an `UNKNOWN` type, which causes them to be dropped

### Key columns

Key columns tell Steampipe which operations can be forwarded. For example, if you were to mark `id` as a key column with operation `=`, you're telling Steampipe that, if a query comes in with `WHERE id=1` (or `WHERE id IN(1,2,3)`, which fans out to several `=` queries), it's safe to forward that condition to the actual plugin. For example, if your plugin called out to a REST API that has an endpoint `/widgets/{id}`, you could mark the `id` as a key column. Your plugin must check those key columns, extract any conditions (or _quals_) and use them. 

Without key columns, every `SELECT` would require a full scan of the remote system (think  `GET /widgets` vs. `GET /widgets/{id}`), which would be much slower and sometimes impossible, if the remote system doesn't really have a notion of "all the items". For example, think of [the Code plugin](https://hub.steampipe.io/plugins/turbot/code/tables/code_secret), to which you provide a string with a snippet of code. It then runs some magic and returns sections of that string that look like secrets (AWS access keys, Slack tokens, DB connection strings, and so on). On that plugin, you _must_ provide a code snippet: there's no sense in asking it "give me all the code snippets".

Normally, the columns and operations that can be marked as key columns depends on the capabilities of the remote service. For example, consider [the `github_my_repository` table in the Github plugin](https://hub.steampipe.io/plugins/turbot/github/tables/github_my_repository): you can certainly run `SELECT * FROM github_my_repository WHERE name LIKE 'steampipe-plugin-%'` to return all of your repos that are Steampipe plugins. However, that's not something that can be delegated to the Github API, which can only list all your repos. Indeed, [as you can see on the code](https://github.com/turbot/steampipe-plugin-github/blob/585f9f8adbd40e519a9d5c5e4299ec428fcdf303/github/table_github_my_repository.go#L10-L20), the `github_my_repository` table has no key columns at all! In such a case, the plugin will just fetch "all the data", and filtering will be done client-side, by Steampipe itself. In contrast, [the `github_repository` table](https://github.com/turbot/steampipe-plugin-github/blob/585f9f8adbd40e519a9d5c5e4299ec428fcdf303/github/table_github_repository.go#L105-L116) _does_ mark the `full_name` column as a (required) key column, which means that a) any `SELECT`s to that table must have a `WHERE full_name='org/repo'` condition, somehow, and b) that `full_name` param will be forwarded to Github, which here will just return information about a single repo.

In our Postgres plugin, however, we don't even know the columns! So we can't really hardcode key columns. We could just _not_ declare any, so any queries would just fetch everything from the backing DB, and filtering would be done purely by Steampipe. While that would work, it could be extremely inefficient, and we can't have that. Instead, we'll take the other extreme: declare that every column can handle every operation. That means `=`, `!=`, `>` and its family of comparisons, `(NOT) (I)LIKE` (that's four operators for the four possible combinations), regex operations (between the yes/no and case sensitivity, that's four more operators), and `IS (NOT) NULL`. That's everything that Steampipe knows how to forward, and we'll just handle it all.

```go
func makeKeyColumns(ctx context.Context, tableAtlas *schema.Table) plugin.KeyColumnSlice {
	var all = make([]*plugin.KeyColumn, 0, len(tableAtlas.Columns))

	for _, col := range tableAtlas.Columns {
		postgresType := PostgresColTypeToSteampipeColType(ctx, col)
		if postgresType == proto.ColumnType_UNKNOWN {
			plugin.Logger(ctx).Warn("postgres.makeColumns", "msg", "unknown type, skipping column!", "column", col.Name, "type", col.Type.Raw)
			continue
		}
		all = append(all, &plugin.KeyColumn{
			Name:      col.Name,
			Operators: plugin.GetValidOperators(), // Everything is valid! Just reuse Steampipe's own "list of all operators that can be handled"
			Require:   plugin.Optional,
		})
	}

	return all
}
```

There's not much here. We again run over all of the columns in the backing table, as introspected by Atlas, we try to convert its type to a Postgres type (again, this is done so we ignore those columns that have weird types), and we blindly add another key column object. There, we specify that we can handle a `WHERE` condition for that column, with any operation at all, and it's optional.

Since we definitely want _every operation_ that Steampipe knows how to handle, I found and reference a list of all operators, which resides [in Steampipe's SDK itself](https://pkg.go.dev/github.com/turbot/steampipe-plugin-sdk/v5@v5.5.1/plugin#GetValidOperators). That's guaranteed to always be up-to-date, by definition! I'm quite proud of that :)

This configuration will cause Steampipe to forward many conditions to us. We'll see later, in the hydration function, that we'll use those conditions when we compose the `SELECT` that is sent to the remote DB.

Note that, even if we somehow neglect setting one of those conditions in the `SELECT` that goes out to the backing DB, that won't mean that extraneous results will be provided to the Steampipe user. Steampipe _still_ applies its own filtering on whatever data is provided by the plugin, so it'll just cause extra traffic between Steampipe and the backing DB.

### The hydration function

Steampipe gives the name of [hydrate functions](https://steampipe.io/docs/develop/writing-plugins#hydrate-functions) to Go functions that run whenever Steampipe needs some records from a table. There are usually two, `List` and `Get`. The former may return no, one or many records, while the latter can only return zero or one records. Usually, the `List` function causes a `GET /widgets` call (assuming that the service behind the plugin is a REST-ish API), while `Get` causes a `GET /widgets/{id}` call (using the key columns that we've discussed before).

Here, since we just can't know anything about the data in the remote DB (and, thus, we can't guarantee which quals will absolutely, definitely result in a single record), we'll not implement `Get`. `List` will be enough for our purposes.

```go
func ListTable(ctx context.Context, d *plugin.QueryData, _ *plugin.HydrateData) (interface{}, error) {
	config := GetConfig(d.Connection)
	schemaName := *config.Schema
	if schemaName == "" {
		schemaName = "public"
	}

	results, err := MakeSQLQuery(ctx, *config.ConnectionString, schemaName, d.Table.Name, d.Quals)
	if err != nil {
		return nil, err
	}

	for _, result := range results {
		d.StreamListItem(ctx, result)
	}

	return nil, nil
}
```

There's almost nothing there. `d.Quals` (which, remember, will contain any key column conditions, if any were provided by the user) is passed to `MakeSQLQuery`. Whatever the remote DB returns comes in as a slice of maps, with string keys and `any` values. Every map (every item of the slice) is a single record (i.e. a row) that came in from the backing DB, while every (key, value) pair of said map is a single column in that record. As we've briefly discussed above, Steampipe usually favors returning struct instances, since strong typing is good, but that only works when you know, at compile time, the structure of your data. And we don't have that luxury here, so maps are a good, dynamic alternative.

`List` functions return their results by calling `d.StreamListItem`, which we do for every element of the slice.

Let's now drill down to the `MakeSQLQuery` function, since all the magic lives there:

```go
func MakeSQLQuery(ctx context.Context, connectionString, schema string, table string, quals plugin.KeyColumnQualMap) ([]map[string]any, error) {
	// 1
	query := fmt.Sprintf("SELECT * FROM %s.%s", schema, table)

	// 2
	// If there are any quals, build up a WHERE clause
	conds := make([]string, 0)
	for _, qualsForCol := range quals {
		for _, qual := range qualsForCol.Quals {
			if qual.Value.Value == nil {
				// This handles "colname IS (NOT) NULL"
				conds = append(conds, fmt.Sprintf("%s %s", qual.Column, qual.Operator))
			} else {
				// This handles "colname <op> <val>", e.g. id=1
				conds = append(conds, fmt.Sprintf("%s %s %s", qual.Column, qual.Operator, protoToPostgresValue(qual.Value)))
			}
		}
	}
	// 3
	// If there are any quals, actually append the WHERE ... part to the query string (which currently has SELECT * FROM tablename)
	if len(conds) > 0 {
		query = query + " WHERE " + strings.Join(conds, " AND ")
	}

	// 4
	return MakeRawSQLQuery(ctx, connectionString, schema, table, query)
}

func MakeRawSQLQuery(ctx context.Context, connectionString, schema string, table string, query string) ([]map[string]any, error) {
	conn, err := connect(connectionString)
	if err != nil {
		return nil, fmt.Errorf("can't connect to DB: %w", err)
	}
	defer conn.Close()

	// 5
	rows, err := conn.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("error while making query \"%s\": %w", query, err)
	}
	defer rows.Close()

	colNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("error while reading column names: %w", err)
	}

	// The code here that stores results on a slice of map[string]any was inspired by https://lazypro.medium.com/make-sql-scan-result-be-map-in-golang-e04f0de5950f
	var results []map[string]any
	// 6
	for rows.Next() {
		rowData := make(map[string]any)
		// 7
		cols := prepareSliceForScanResults(colNames)

		// 8
		if err := rows.Scan(cols...); err != nil {
			return nil, fmt.Errorf("error while reading columns: %w", err)
		}

		// 9
		for i, v := range cols {
			rowData[colNames[i]] = v
		}
		// 10
		results = append(results, rowData)
	}

	// This must always be called after the for rows.Next() loop, since it may have terminated with an error
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error while reading columns: %w", err)
	}
	
	// 11
	return results, nil
}

// 7
func prepareSliceForScanResults(columns []string) []any {
	arr := make([]any, len(columns))

	// Convert arr into an array of pointers, so we can save the results there
	for i := range arr {
		arr[i] = &arr[i]
	}

	return arr
}
```

1. The base query is always `SELECT * FROM schema.table`. The `schema` comes from the plugin's config, with a default value of `public` to match Postgres's default. The table name is taken from the Steampipe table name, because when we built the tables we took those names directly from the backing DB, so they're guaranteed to match
2. Here's the fun part: we read [the query quals](https://pkg.go.dev/github.com/turbot/steampipe-plugin-sdk/v5@v5.5.1/plugin/quals#Qual) and for each one, compose a small SQL fragment. For example, let's say that we saw a qual with column=`id`, operator=`=` and value=`1`. That would correspond to a SQL fragment with `id=1`. This needs a bit of care because not all quals have a value (or, in other words, not every operator is [a binary operator](https://mathworld.wolfram.com/BinaryOperation.html)). `IS NULL` and `IS NOT NULL` don't have a value and thus have it set to `nil`. If we didn't handle them especially, we'd have `id IS NULL nil`, which isn't valid SQL.
3. If there are conditions, we now need to add them to the SQL query which we started building on Step 1. We join them with `AND`, because Steampipe will only forward to a plugin quals that were originally joined with AND.
4. Now we have a SQL string, which we can send to the database
5. To do so, we use [the `QueryContext` function](https://pkg.go.dev/database/sql#DB.QueryContext) on [the `database/sql` package](https://pkg.go.dev/database/sql), which is part of Go's stdlib. This function takes a context and a string (with support for [prepared statements](https://en.wikipedia.org/wiki/Prepared_statement) too, which we're not using), and returns [a `Rows` object](https://pkg.go.dev/database/sql#Rows), which can then be used to incrementally scan over the results of the query. Note that the `QueryContext` function doesn't just read everything into memory at once, instead giving you control over the pace at which you read those results
6. This loop is taken [straight from Go's examples](https://github.com/golang/go/wiki/SQLInterface#executing-queries). Every time you call `rows.Next()`, a new record is read from the remote server. However, unlike what you'd expect, `Next()` doesn't return it, just a boolean that indicates whether a record was read at all or not. If it returns `false`, it could be that there are no more rows, or that an error occurred
7. Actually reading the data into memory requires a slice of pointers (see the next step), which we allocate here
8. _Finally_, we can read the data. [The `Rows.Scan()` function](https://pkg.go.dev/database/sql#Rows.Scan) needs the array of pointers that we just allocated. The array must have one pointer per column in the returned record. Normally you can do that manually, but here we had to build a variable number of pointers based on what the `Rows` object reports as its returned columns (recall that, when we made the query, we just said `SELECT *`. The DB reports back the actual columns that it read, and we use that to instantiate the pointers)
9. However, an array of pointers isn't really useful. We want a map of strings (column names) to record values, which we achieve by iterating in parallel over the column names and the array of pointers. We access every value and build up a map (which, remember, represents one single record)
10. Once the map for this record is complete, we add it to a slice of records...
11. ... which we promptly return to the hydrate function, which in turn will stream all the elements in the slice back to Steampipe, which will then run the transform function to compute the final values of each column, and will show them to the user

And that's all! That's the life of a query, as it comes in from the user, then gets converted into a SQL string (which is hopefully a valid statement), then is sent to the backing DB. Then every record in the result set is converted to a map, streamed to Postgres, its values are accessed, and it's shown to the user. And we don't assume anything about the structure of the DB, so (barring bugs) it should work with any PostgreSQL DB.

### The `raw` table

As a courtesy to the user, we also build a static table called `raw`. This table will exist alongside the tables for each remote table. Its purpose is to serve as an escape hatch, should you want to run more complex queries that can't be efficiently served by our qual-forwarding magic.

For example, Steampipe can't forward quals that involve [JSONB operations](https://www.postgresql.org/docs/current/functions-json.html) (for now, that's [in the works](https://github.com/turbot/steampipe-plugin-sdk/commit/f3ceed5752f698262760069012b8d316836ca024)). If you wrote a query that

* Only filters via JSONB operations, and
* Hits a very large table (that gets filtered down to very few records once the JSONB operation is applied)

you'd find that, normally, Steampipe would fetch the entire table to apply the JSONB operation itself. Steampipe can't forward, for example, `json_column->>'id' = 'my_id'`. If the table were very large, and the filtering reduced it to a very small table, it'd be extremely inefficient to fetch it all. (Note that, if the filtering didn't reduce the size of the result set much, it's not really important where you apply the filtering: even if you do it on the remote DB, you'll still have to stream the big result set, so it's not that important). Or what if you want to do aggregations (`GROUP BY` and `COUNT`, for example)? Steampipe can't forward those either, so it'd fetch everything and run the aggregation itself.

Thus, the `raw` table. It can take an arbitrary SQL statement, provided as a string. Since now we're _entirely_ unsure of the shape of the returned data (and it can vary across different `SELECT`s to the same table), we can't perform introspection to determine which columns this table must have. So it has just two columns: `query` and `data`. `query` is "the input", a `TEXT` column. `data` is "the output", a `JSONB` column that will hold a single record.

You'd use the `raw` table as such:

```sql
select 
    * 
from 
    postgres.raw 
where 
    query='SELECT * FROM film JOIN language USING (language_id) LIMIT 3'
```

```
+----------------+--------------------------------------------------------------------------------------------------------------->
| query          | data                                                                                                          >
+----------------+--------------------------------------------------------------------------------------------------------------->
| SELECT * FR... | {"description":"A Astounding Reflection of a Lumberjack And a Car who must Sink a Lumberjack in A Baloon Facto>
| SELECT * FR... | {"description":"A Astounding Epistle of a Database Administrator And a Explorer who must Find a Car in Ancient>
| SELECT * FR... | {"description":"A Epic Drama of a Feminist And a Mad Scientist who must Battle a Teacher in The Canadian Rocki>
+----------------+--------------------------------------------------------------------------------------------------------------->
```

As is usual with escape hatches, use with care. It may not always work, expecially if you need to dynamically vary the query string. And accessing the data gets slightly unclear because you always need to read it from `data` and cast to the correct data types, because (since we can't predict what columns will come in from the response) we need to return it on a JSONB column, which you'll have to unpack yourself.

## Testing

To test the plugin, I used [a port of the Sakila database to Postgres](https://github.com/jOOQ/sakila). Sakila is [a fairly old database](https://dev.mysql.com/doc/sakila/en/sakila-history.html), originally developed by MySQL, back when it was MySQL AB, before it was acquired by Sun in 2008, before _it_ was acquired by Oracle in 2009. Good days, those. It's a model of a DVD rental store: it has tables that model movies (you know, Movie, Actor, MovieActor, Category, Language) and a sort of e-commerce site (but presumably it's for real-life rentals, such as Store, Staff, Rental, Payment, Customer, Address and so on).

### Sakila

Here's what you'd see if you loaded the Sakila dataset:

![](https://camo.githubusercontent.com/a5414b9a1f6336e2bbae5bbf358bd3df76627dc9e73d4800ef5822b1737e2df2/68747470733a2f2f7777772e6a6f6f712e6f72672f696d672f73616b696c612e706e67)

Here's the `.spc` file that declares a Steampipe connection to a local Postgres DB, which happens to have Sakila loaded:

```hcl
connection "pg2" {
  plugin = "jreyesr/postgres"

  # Write a connection string, in the form that is expected by the pgx package:
  # https://pkg.go.dev/github.com/jackc/pgx/v5#hdr-Establishing_a_Connection
  # Example: "postgres://username:password@localhost:5432/database_name"
  connection_string = "postgres://postgres:postgres@localhost/steampipe_host"

  # The remote DB's schema that this plugin will expose
  schema = "public"
}
```

And here's what Steampipe sees (remember, we're _not_ inspecting the DB in which Sakila lives, we're connecting to Steampipe):

```sql
.inspect pg2
```

![e9624ed01529570666d6e31377000304.png](./_resources/e9624ed01529570666d6e31377000304.png)

It looks entirely like the actual Sakila DB, but those tables are under the control of the plugin (as you can see by the fact that there's one other table, `raw`. That table is not part of Sakila)

### Queries

Let's run some simple queries:

```sql
select * from pg2.actor
```

![4a18c4d271f9051217ea4b5c9fc9d3fe.png](./_resources/4a18c4d271f9051217ea4b5c9fc9d3fe.png)

If we've enabled DEBUG-level logging on the Steampipe instance (achieved by running `export STEAMPIPE_LOG_LEVEL=debug` before `steampipe query`), we have some nice logs on Steampipe's logfile (which, for a native Linux install, is on `~/.steampipe/logs/plugin-YYYY-MM-DD.log`):

```
postgres.ListTable: quals={}
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor"
Scan: data=[1, PENELOPE, GUINESS, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:1 first_name:PENELOPE last_name:GUINESS last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[2, NICK, WAHLBERG, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:2 first_name:NICK last_name:WAHLBERG last_update:2006-02-15 04:34:33 +0000 UTC]"
...
```

The third line in that snippet contains the query that was sent to the remote DB. Here it's the same as the query that we wrote, since it's a simple one.

Let's try some predicate pushdown!

```sql
select * from pg2.actor where actor_id=1
```

![eeb41fd6d97a81dad777051b5c442d06.png](./_resources/eeb41fd6d97a81dad777051b5c442d06.png)

It works as expected. However, this time the logs are different:

```
postgres.ListTable: quals="actor_id = 1"
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor WHERE actor_id = 1"
Scan: data=[1, PENELOPE, GUINESS, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:1 first_name:PENELOPE last_name:GUINESS last_update:2006-02-15 04:34:33 +0000 UTC]"
```

On the first line you can see that the quals include our condition, and on the third line you see that said condition is correctly included in the SQL statement that was sent to the remote DB. Thus, the remote DB only has to serve a single record.

What about a more complicated condition?

```sql
select * from pg2.actor where first_name LIKE 'A%'
```

![74bca9ecefa7fe0ee69c6dad575a083d.png](./_resources/74bca9ecefa7fe0ee69c6dad575a083d.png)

```
postgres.ListTable: quals="first_name ~~ A%"
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor WHERE first_name ~~ 'A%'"
Scan: data=[29, ALEC, WAYNE, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:29 first_name:ALEC last_name:WAYNE last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[34, AUDREY, OLIVIER, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:34 first_name:AUDREY last_name:OLIVIER last_update:2006-02-15 04:34:33 +0000 UTC]"
...
```

It's pushed down, as expected, since Steampipe now supports `LIKE` operators in quals. Some months ago, it would have just scanned the entire table and applied the `LIKE` itself. Several conditions are also forwarded:

```sql
select * from pg2.actor where first_name LIKE 'A%' and last_name LIKE 'B%'
```

![cd94de17e138489b14a9f3b0101c455a.png](./_resources/cd94de17e138489b14a9f3b0101c455a.png)

```sql
postgres.ListTable:
  quals=
  | first_name ~~ A%
  | last_name ~~ B%
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor WHERE first_name ~~ 'A%' AND last_name ~~ 'B%'"
Scan: data=[190, AUDREY, BAILEY, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:190 first_name:AUDREY last_name:BAILEY last_update:2006-02-15 04:34:33 +0000 UTC]"
```

Here both quals are correctly forwarded to the remote DB. However, that's only because they're joined by AND. If we change the operator to `OR`, that triggers a full table scan instead:

```sql
select * from pg2.actor where first_name LIKE 'A%' or last_name LIKE 'B%'
```

![7ea5cf6519862c14e05810e6eb748825.png](./_resources/7ea5cf6519862c14e05810e6eb748825.png)

```
postgres.ListTable: quals={}
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor"
Scan: data=[1, PENELOPE, GUINESS, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:1 first_name:PENELOPE last_name:GUINESS last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[2, NICK, WAHLBERG, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:2 first_name:NICK last_name:WAHLBERG last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[3, ED, CHASE, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:3 first_name:ED last_name:CHASE last_update:2006-02-15 04:34:33 +0000 UTC]"
...
```

In theory, I'd expect Steampipe to be able to detect `OR` conditions and split them in two different queries: `SELECT WHERE cond_a OR cond_b` could become `SELECT WHERE cond_a` and `SELECT WHERE cond_b`. Both could be sent in parallel, and then Steampipe could merge the results of both, taking care to not introduce duplicates. However, that's additional complexity to add to an already magical FDW, and I'm sure there are weird edge cases that I haven't even imagined that break that simple rule. Besides, what about `WHERE cond1 OR (cond2 AND NOT cond3)`? You start getting into logical algebra solver territory there. And [that's _hard_](https://en.wikipedia.org/wiki/SAT_solver). Like "we don't even know how hard" hard. So it's just easier to not even try.

However, you'll see that Steampipe still applies your requested filtering criteria. It just does it itself, without delegating that work to the remote DB. You're still getting what you asked for, so correctness is preserved.

### Aggregations

Something similar happens, for example, to aggregations:

```sql
select count(*) from pg2.actor
```

![8f4b9d332a8db0bab1c59ea92f4da411.png](./_resources/8f4b9d332a8db0bab1c59ea92f4da411.png)

```
postgres.ListTable: quals={}
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor"
...
```

Aggregation functions don't get forwarded to the remote database, so Steampipe computes them directly. The remote DB sees a full table scan. The same happens when you start throwing more complex queries at the plugin:

```sql
select first_name, count(actor_id) 
from pg2.actor
group by first_name 
order by 2 desc -- this orders by the second column, BTW
```

![bbab63d1de04efaffb485d2a17c93344.png](./_resources/bbab63d1de04efaffb485d2a17c93344.png)

```
postgres.ListTable: quals={}
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor"
...
```

Neither the grouping nor the `count` call are pushed down. However, here Postgres's awesome query optimizer starts saving our bacon. For example, read this query:

```sql
select first_name, count(actor_id) 
from pg2.actor 
group by first_name 
having first_name LIKE 'A%' 
order by 2 desc
```

It's the same as the previous one (which triggered a full table scan), but now it has a `HAVING` clause. In case you don't know that that is, [`HAVING` is like `WHERE`, but it's applied to the _results_ of aggregate functions](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-having/) (`WHERE`s are applied to the source records instead, before grouping). In other words, you can think of that query as being executed in the following steps:

* Scan the `actor` table
* Group by `first_name`
* Compute the count of each group, compose a table that has the group key (`first_name`) + count for each group
* _Then_ apply the `HAVING` clause, which only leaves the groups for actors whose names start with A
* Finally, order by the count of actors with that name

Since the `HAVING` line is (at least logically) applied _after_ the aggregation (which it must be, since `HAVING` is defined to be a filtering function on groups/aggregates), you'd expect Steampipe to still trigger a full table scan, and then perform all the steps itself. However, that's not what we see:

![6dcfd5c73f625a82956e19e67edf4d20.png](./_resources/6dcfd5c73f625a82956e19e67edf4d20.png)

```
postgres.ListTable: quals="first_name ~~ A%"
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor WHERE first_name ~~ 'A%'"
Scan: data=[29, ALEC, WAYNE, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:29 first_name:ALEC last_name:WAYNE last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[34, AUDREY, OLIVIER, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:34 first_name:AUDREY last_name:OLIVIER last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[49, ANNE, CRONYN, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:49 first_name:ANNE last_name:CRONYN last_update:2006-02-15 04:34:33 +0000 UTC]"
Scan: data=[65, ANGELA, HUDSON, "2006-02-15 04:34:33 +0000 UTC"] mapData="map[actor_id:65 first_name:ANGELA last_name:HUDSON last_update:2006-02-15 04:34:33 +0000 UTC]"
...
```

While I'm not by any means an expert on the Postgres query optimizer, I think that what's happening is this:

1. Steampipe's Postgres core analyzes the query
2. It detects that, since the column used in the `HAVING` query is not a computed column, but exists directly in the source table, the `HAVING` condition can be transformed to a `WHERE`
3. That is deemed more efficient, since a `WHERE` runs _before_ the aggregation. Assuming your database is properly indexed, that will run very fast and reduce the amount of rows that have to be processed by the aggregation function
4. The optimizer always tries to reduce the "cost" of a query, which includes as a parameter the amount of records that are involved
5. Thus, the optimizer converts the query to `SELECT ... WHERE first_name LIKE 'A%' GROUP BY ... ORDER BY ...`
6. That is passed to the Steampipe FDW, which sees a `SELECT ... WHERE first_name LIKE 'A%'`, detects that our plugin announces that it supports quals on `first_name` with the operation `LIKE`, and thus sends it to the plugin
7. The plugin receives a qual `first_name LIKE 'A%'` and proceeds as normal

And all that happened without our plugin ever being aware of it! And, while I have no evidence of that, I wouldn't be surprised if Steampipe's FDW wasn't aware of that either. That smells like a Postgres-wide optimization that you get for free, just by using Postgres as your backing datastore. That's really cool.

However, if we send a `HAVING` condition that involves a computed column (let's say the count), we fall back to a full table scan:

```sql
select first_name, count(actor_id) 
from pg2.actor 
group by first_name 
having count(actor_id) > 1 
order by 2 desc
```

![a1a244cffa9830fc8e96de98a4f01dd8.png](./_resources/a1a244cffa9830fc8e96de98a4f01dd8.png)

```
postgres.ListTable: quals={}
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.actor"
...
```

This is because `count` is not forwarded, and now we can't evaluate the `HAVING` clause without the results of the `count`. In effect, that forces the `HAVING` to be run after the `GROUP BY`, which, as we've already established, runs on Steampipe.

### Joining data

What about `JOIN`s?

```sql
select film.title, language_id, language.name 
from pg2.film 
    join pg2."language" using (language_id)
```

![356c424a8153e56054a9ac24a0e988df.png](./_resources/356c424a8153e56054a9ac24a0e988df.png)

Interestingly, that ends up being _very_ slow (about ten seconds, give or take). The logs explain why:

```
postgres.ListTable: quals={}
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.film"
...
Scan: data=[999, "ZOOLANDER FICTION", "A Fateful Reflection of..."]
Scan: data=[1000, "ZORRO ARK", "A Intrepid Panorama of a Mad S..."]

queryCacheGet returned CACHE MISS (pg2-1694388347937)
postgres.ListTable: quals="language_id = 1"
postgres.ListTable: schema=public
MakeRawSQLQuery.beforeExec: query="SELECT * FROM public.language WHERE language_id = 1"
Plugin execute complete (1694388347937)

queryCacheGet returned CACHE HIT (pg2-1694388347216)
Plugin execute complete (1694388347216)

queryCacheGet returned CACHE HIT (pg2-1694388347216)
Plugin execute complete (1694388347216)

queryCacheGet returned CACHE HIT (pg2-1694388347216)
Plugin execute complete (1694388347216)

... (repeated a ton of times)
```

That explains the slowness: first we full-scan the `film` table, thus getting a list of films. Since we now need to join each film to its language, Steampipe then starts sending off `SELECT`s to the `language` table, one for each film, bearing that film's language ID. Since many films are in English, all those requests (except for the first one) hit Steampipe's cache. That's why you see a first `SELECT * FROM public.language WHERE language_id = 1` and then multiple `CACHE HIT`s. Every distinct language will only be queried once.

In effect, Steampipe is implementing [a nested loop join](https://www.cybertec-postgresql.com/en/join-strategies-and-performance-in-postgresql/). Or, more precisely, I'd expect the Postgres core of Steampipe to be doing so, since the Steampipe FDW isn't building a plan that can push down the `JOIN` to the remote datasource. Thus, Postgres falls back to a nested loop join: the slowest, yet more widely applicable `JOIN` method. Let's verify that!

```sql
explain select film.title, language_id, language.name from pg2.film join pg2."language" using (language_id)
```

```
+-----------------------------------------------------------------------------------+
| QUERY PLAN                                                                        |
+-----------------------------------------------------------------------------------+
| Nested Loop  (cost=0.00..20040002000000.00 rows=5000000000 width=72)              |
|   ->  Foreign Scan on film  (cost=0.00..20000000000000.00 rows=1000000 width=200) |
|   ->  Foreign Scan on language  (cost=0.00..40000.00 rows=200 width=200)          |
|         Filter: (film.language_id = language_id)                                  |
+-----------------------------------------------------------------------------------+
```

Or see [this incredibly awesome web-based plan analyzer](https://explain.dalibo.com/plan/1a1fa5d1g0h5f3c0). That link should work indefinitely, so go play with it yourself if you wish:

![3676d43d391a73fe347fa1e69142a46a.png](./_resources/3676d43d391a73fe347fa1e69142a46a.png)

There you can see that it's indeed running a Nested Loop Join. The first step (on the left) is to scan the first table, `film`. That returns a bunch of rows. The second step (on the right) is to scan the `language` table. Repeatedly. You can see that because the **Loops** property at the bottom says 1000, the same number as the left-hand Scan's **Rows**. That indicates that the right Scan ran once per element returned by the film table scan.

There's even more information if you switch to the Misc tab on the second (right-hand) Scan:

![ebdb29da8ca92dc356ab8192097e0986.png](./_resources/ebdb29da8ca92dc356ab8192097e0986.png)

Notice the Filter, which indicates the condition that is being sent every loop. This matches what we saw on the logs, and what you'd expect a Nested Loop scan to do: it's filtering on the film's `language_id` matching this table's `language_id`.

If such a query is intolerably slow... well, that's what the `raw` table is for! Let's compare the two query plans:

```sql
select * from pg2.raw where query='select film.title, language_id, language.name from film join \"language\" using (language_id)'
```

![23fb370ebd1557789f525bf31be2ddc9.png](./_resources/23fb370ebd1557789f525bf31be2ddc9.png)

[Here's the live URL](https://explain.dalibo.com/plan/3f4722c645b38dfc), so you can play with it.

That's a much faster query! Since we push the query down to the remote Postgres DB, we free it to perform _its own_ optimizations. Now, the remote database (since it has both tables available in its own DB) can perform more advanced optimizations, such as (presumably) choosing a more efficient join type. Hence the drastically reduced execution times (it went down from ~8 seconds to ~80ms, which is a 99% reduction, depending on how you compute percentages).

In return, you're locked to performing queries that can be directly encoded on a string. No more `JOIN`s. And you're responsible for breaking up the `JSONB`-encoded results into something that is more palatable. For example, this is what you see by default:

![78abf8c943408fc1547e4bfa0983468e.png](./_resources/78abf8c943408fc1547e4bfa0983468e.png)

If you need that data transformed to nice columns, you'll have to do that yourself, using [JSON operations](https://www.postgresql.org/docs/9.5/functions-json.html):

```sql
select 
    data->>'title' as title, 
    (data->'language_id')::int as language_id, 
    data->>'name' as name 
from pg2.raw 
where query='select film.title, language_id, language.name from film join "language" using (language_id)'
```

![2f7f0acdb17425552d6aa4dd4602beed.png](./_resources/2f7f0acdb17425552d6aa4dd4602beed.png)

And now we're back to a nice SQL table, but those JSON accessors can get ugly fast. And you're still stuck with static `query`s, since the Steampipe FDW [can't](https://github.com/turbot/steampipe-postgres-fdw/issues/227) [early-evaluate](https://github.com/turbot/steampipe-postgres-fdw/issues/328) [functions](https://github.com/turbot/steampipe-postgres-fdw/issues/137) on quals. Trying to do that is really going against the grain of SQL, too, since as a declarative language you're expected to not specify details like the order of evaluation. If the SQL engine, in its infinite wisdom, decided that a full table scan is better, you're supposed to accept that.

Before we end, now I want to see the plan that the remote Postgres database (the one that actually stores Sakila) produced when we sent that raw query. From the point of view of Steampipe, we just read the entire table with just a `WHERE query=...` clause, but what did the remote DB cook up for us?

As usual, [here's the interactive explorer](https://explain.dalibo.com/plan/00dcb6fd9ae128a4), and here's a screenshot:

![e38093445f38ea90cf0ee42573dda833.png](./_resources/e38093445f38ea90cf0ee42573dda833.png)

The remote DB, when given an entire query (and not just bits of if, as it did when we performed the `JOIN` on Steampipe), can optimize that `JOIN` a lot by using [a hash join](https://postgrespro.com/blog/pgsql/5969673). Now, instead of a nested scan (which, if you've taken an Algorithms course, [is O(n²)](https://jarednielsen.com/big-o-quadratic-time-complexity/)), we just scan both tables once (which is O(2n), which in turn is O(n)), hash the second one to build a hash table, and then `JOIN` by hashing every item on the first and looking up on the table (again, O(n), since a single hash lookup is supposed to be O(1)). So, usually, hash joins are faster, unless your data is so stupidly large that the hash table doesn't fit in memory, or your data has some sort of pathological distribution that degrades the perfomance of the hash table.

## Recap

What have we done in this post?

* We've explored the motivation for building a Steampipe plugin that connects to plain Postgres databases, and we've presented several instances of people asking for just that
* We've presented some alternatives, and discussed why they don't quite work
* We've introduced the concept of _introspection_ as applied to DBs, seen some examples of where it's useful, and found one library ([Atlas](https://atlasgo.io/)) that can introspect Postgres DBs on Go
* We've developed and tested a simple Go program that can connect to a live Postgres DB and print out a list of its tables, each with its columns and the type of each one
* We've then converted that program into a Steampipe plugin that uses [dynamic tables](https://steampipe.io/docs/develop/writing-plugins#dynamic-tables) to replicate the structure of a Postgres DB: one table per table, and it also attempts to copy all the columns while converting their data types to [one of the types that Steampipe supports](https://steampipe.io/docs/develop/writing-plugins#column-data-types)
* We've discussed some important aspects of said plugin: how it declares a variable set of tables, how it translates arbitrary Postgres types into Steampipe types, how it leverages Steampipe's key columns to forward many kinds of `WHERE` conditions to the remote DB (this is done for optimization), and more
* We've tested the plugin with the Sakila DB. We've tried simple queries, complex conditions, aggregation functions, and joins. We've found cases in which seemingly-simple changes to a query switch it from a very efficient query that forwards conditions to the remote DB, into a slow query that can't delegate any prefiltering and must transfer the whole table; and viceversa
* To wrap it up, we've explored some of those queries using [explain.dalibo.com](https://explain.dalibo.com), a PostgreSQL execution plan visualizer, which provides some really nice visualizations

Finally, the code for this plugin is on Github: <https://github.com/jreyesr/steampipe-plugin-postgres>. Depending on when you're reading this, it may already be available for you to download and use. Just try `steampipe plugin install jreyesr/postgres` and see if it works.

This post has been extremely long. If you've reached this point, then congratulations and many thanks for your interest! See you soon!

Also, if you use the plugin and find any bugs, don't hesitate to [open an issue!](https://github.com/jreyesr/steampipe-plugin-postgres/issues) I'd expect many weird bugs to lurk in the code: attempting to wrap "any Postgres DB in existence" is a tall order.
