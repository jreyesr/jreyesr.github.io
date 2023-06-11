---
title: "Coopting Terraform into generic API management - Part 2 - Dynamic resources"
date: 2023-06-11T12:20:10.000-05:00
summary: "This article explores continues the exploration of Terraform, this time for dynamically generating configurations (e.g. generating one EC2 server for each entry in a DB)"
tags: ['experiments', 'iac', 'rest']
categories: ['terraform']
---

TL;DR: How can we take a random REST API and make it declarative? In other words, instead of sending a POST request to create a third Widget called Great Widget, you *declare* that the application should now three Widgets, the third one being called Great Widget. _Something_ should then take your desired state (three Widgets), compare it with the current state (two Widgets), figure out that the first two Widgets are unchanged and there's a new one, and then issue a create command for the new Widget. Once said Widget is created, its hunger for order and equality will be satisfied, and it should go back to sleep since the desired state matches the current state... until such time as something changes (either you change the desired state, or someone or something changes the actual state), at which point it should wake up, drive the actual state to match the desired state (never the opposite! Things don't work that way!), and then go back to sleep, and so on. Forever.

Note: This is the second post about the subject. [Here's the first one](https://jreyesr.github.io/posts/terraform-declarative-api-management-1/).

## Problem statement

This is a perfectly standard Terraform config:

```hcl
resource "aws_instance" "web" {
  ami                    = "ami-a0cfeed8"
  instance_type          = "t2.micro"

  tags = {
    Name = "web"
  }
}
```

This is a perfectly standard SQL table:

|id|name|ami|instance_type|
|--|----|---|-------------|
|1|web|ami-a0cfeed8|t2.micro|
|2|web-2|ami-a0cfeed8|t2.micro|
|3|db|ami-a0cfeed8|t3.big|
|3|proxy|ami-a0cfeed8|t2.micro|


What is not standard, however, is a way of using the data in the SQL table to generate a Terraform configuration; something that, when applied, has the same effect as:

```hcl
resource "aws_instance" "web" {
  ami                    = "ami-a0cfeed8"
  instance_type          = "t2.micro"

  tags = {
    Name = "web"
  }
}

resource "aws_instance" "web-2" {
  ami                    = "ami-a0cfeed8"
  instance_type          = "t2.micro"

  tags = {
    Name = "web-2"
  }
}

resource "aws_instance" "db" {
  ami                    = "ami-a0cfeed8"
  instance_type          = "t3.big"

  tags = {
    Name = "db"
  }
}

resource "aws_instance" "proxy" {
  ami                    = "ami-a0cfeed8"
  instance_type          = "t2.micro"

  tags = {
    Name = "proxy"
  }
}
```

Note that, in the HCL file, we have one `resource` block for each row in the DB table.

The purpose of this article is to explore ways of dynamically generating Terraform configuration. As far as I can tell, Terraform is developed with the expectation that users will manually and lovingly edit Terraform files, and then probably check in to version control where an automated process will pick them up and apply them, thus bringing the real world back in alignment with whatever is desired.

This is all well and good, as long as you don't mind manually editing Terraform files.

However, what about integrating Terraform into other, larger workflows? We have seen in [the previous article](https://jreyesr.github.io/posts/terraform-declarative-api-management-1/) that Terraform can be used to control fairly arbitrary APIs. How can we leverage Terraform for interacting with those APIs, without having to manually maintain Terraform files?

### The running example

Let's say that you are developing some sort of ecommerce site builder. By that, I mean not an ecommerce site *per se*, but rather a site where others can go to build ecommerce sites. Think Squarespace (also, very much _not_ sponsored, I get bombarded with enough sponsors in YT as it is; hence the lack of a link). As far as ~~YT shill ads~~ their documentation seems to state, when building your webpage you can also provision an online store.

Let's further say that you (the site's developer) want to use Stripe to manage merchant accounts. Merchants are your customers, the people who build ecommerce sites using your service; but you don't want them to have to provision an account on Stripe, generate an OAuth client and provide the credentials to you. You want all that to be transparent.

So, whenever a user signs up, you have to sign up for an account on Stripe (in that customer's name) and then remember the credentials somewhere, linked to your User table.

Then, when your user creates a product to sell in your nice, shiny UI, you need to propagate that information back to Stripe, since that's what is eventually used for purchases. Same on every product change or delete: you need to propagate those changes back to Stripe.

There is a [community Provider for Stripe](https://registry.terraform.io/providers/lukasaron/stripe/latest/docs), which can manage [Products](https://registry.terraform.io/providers/lukasaron/stripe/latest/docs/resources/stripe_product), each with a name, description, price and availability. However, clearly it is _not_ feasible to have a huge Terraform file holding the information of every Product sold by every one of your clients, hand-edit the monster file whenever anyone changes one of his products on your DB, and then `terraform apply` that file so changes are pushed to Stripe.

What instead?

Well, we could have some sort of _virtual Terraform file_. A file that doesn't actually exist, yet can somehow be generated on demand (which would be whenever anyone makes a change) and then applied via Terraform.

Terraform should detect that nothing has changed, except the single product that was just edited, and then it should go and apply that single change to Stripe.

In other words, the following SQL tables:

`table_users`
|id|email|password|stripe_api_key|
|--|-----|--------|--------------|
|1|me@example.com|s3cr3t|CXLP04i5meA|
|2|another@seller.com|password|AwwuKzJdUzU|

`table_products`

|id|seller_id|name|description|price|
|--|---------|----|-----------|-----|
|1|1|Widget|Shiny, useful Widget|9.99|
|2|1|Frobnicator|Fresh and crunchy Frobnicator|4.99|
|3|2|Foobar|Harvested from the original metavariables tree|0.99|

should somehow become something like the following Terraform file:

```hcl
# PROVIDERS
provider "stripe" {
  alias = "stripe_user_1"
  api_key = "CXLP04i5meA"
}

provider "stripe" {
  alias = "stripe_user_2"
  api_key = "AwwuKzJdUzU"
}

# RESOURCES FOR USER 1 (me@example.com)
resource "stripe_product" "product_1" {
  provider    = stripe.stripe_user_1
  name        = "Widget"
  description = "Shiny, useful Widget"
}

resource "stripe_price" "price_product_1" {
  provider    = stripe.stripe_user_1
  product     = stripe_product.product_1.id
  currency    = "usd"
  unit_amount = 999
}

resource "stripe_product" "product_2" {
  provider    = stripe.stripe_user_1
  name        = "Frobnicator"
  description = "Fresh and crunchy Frobnicator"
}

resource "stripe_price" "price_product_2" {
  provider    = stripe.stripe_user_1
  product     = stripe_product.product_2.id
  currency    = "usd"
  unit_amount = 499
}

# RESOURCES FOR USER 2 (another@seller.com)
resource "stripe_product" "product_3" {
  provider    = stripe.stripe_user_2
  name        = "Foobar"
  description = "Harvested from the original metavariables tree"
}

resource "stripe_price" "price_product_3" {
  provider    = stripe.stripe_user_2
  product     = stripe_product.product_13.id
  currency    = "usd"
  unit_amount = 99
}
```

Such a file could then be applied `terraform apply`ed at will, and it would sync the Stripe accounts of all the users with the configuration that exists in our database.

So, now the question is as follows: How can we programmatically generate Terraform config, or otherwise write a Terraform file that expands to more resources than those which are explicitly written?

## Built-in functionality: loops and dynamic blocks

### Looping

Terraform has a `for_each` keyword (actually a meta-argument, and I really like that word) that lets you [configure a set of similar resources by iterating over a data structure to configure a resource or module for each item in the data structure](https://developer.hashicorp.com/terraform/tutorials/configuration-language/for-each).

For example, this:

```hcl
resource "azurerm_resource_group" "rg" {
  for_each = {
    a_group = "eastus"
    another_group = "westus2"
  }
  name     = each.key
  location = each.value
}
```

is *somewhat* equivalent to this:

```hcl
resource "azurerm_resource_group" "rg" {
  name     = "a_group"
  location = "eastus"
}

resource "azurerm_resource_group" "rg" {
  name     = "another_group"
  location = "westus2"
}
```

Note that the "expanded" HCL code above is not valid, since we're creating several `azurerm_resource_group`s with the same name, `rg`:

```
❯ terraform validate
╷
│ Error: Duplicate resource "azurerm_resource_group" configuration
│ 
│   on main.tf line 6:
│    6: resource "azurerm_resource_group" "rg" {
│ 
│ A azurerm_resource_group resource named "rg" was already declared at
│ main.tf:1,1-39. Resource names must be unique per type in each module.
╵
```

However, the `for_each` meta-argument _can_ create multiple instances of the same block.

So, with regards to the `for_each` keyword:

* You can use it to create multiple instances of the same `resource { }` block
* The block needs to be provided with either a Map (AKA hashmap in Java, hash in Ruby, associative array in PHP, table in Lua, dictionary in Python... or Data.Map in Haskell) or a Set (somewhat like an array, but where order doesn't matter). In the case of a Map, the keys must be strings, the values can be of arbitrary type. In the case of a Set, the items can be of arbitrary type
* Inside the "looped" block, you get access to the variable `each`, which has fields `key` and `value`, which do what you expect: they expose the key and value, if iterating over a Map, or they _are_ the same value, if iterating over a Set
* You can use the contents of the `each.key` and `each.value` variables to make some properties of the block vary
* The data that is iterated over could come from [input variables](https://developer.hashicorp.com/terraform/language/values/variables) or from a [data source](https://developer.hashicorp.com/terraform/language/data-sources)

Pros:

* Built-in! Supported! Documented!
* Having to think about data passing forces you to define your interfaces well
* [Plays well with modules](https://developer.hashicorp.com/terraform/tutorials/configuration-language/for-each#add-for_each-to-the-vpc)

Cons:

* Doesn't support everything: for instance, AFAICT, it [can't dynamically generate providers](https://github.com/hashicorp/terraform/issues/9448), which we most definitely need
* You still need something to pass the data from the outside, probably as input vars
* Repeated properties inside one block are not supported: for example, see [the "tiered price" example here](https://registry.terraform.io/providers/lukasaron/stripe/latest/docs/resources/stripe_price): there are multiple `tiers { }` sub-blocks inside a `stripe_price` resource, but those cannot be expressed with `for_each` (read below for the solution!)

### Dynamic blocks

[Dynamic blocks](https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks) are a companion to the `for_each` meta-argument, and they cover the other half of the problem: repeatable nested blocks.

For example, see this Stripe price resource:

```hcl
resource "stripe_price" "price" {
  # product needs to be defined
  product        = stripe_product.product.id
  currency       = "aud"
  billing_scheme = "tiered"
  tiers_mode     = "graduated"

  # free up to ten
  tiers {
    up_to       = 10
    unit_amount = 0
  }

  tiers {
    up_to       = 100
    unit_amount = 300
  }

  tiers {
    up_to       = -1
    unit_amount = 100.5
  }
}
```

There are multiple `tiers { }` blocks. You can express those with a dynamic block:

```hcl
# Assume that the tiers variable is set to: set(
#   {up_to: 10, amount: 0},
#   {up_to: 100, amount: 300},
#   {up_to: -1, amount: 100.5}
# )


resource "stripe_price" "price" {
  # product needs to be defined
  product        = stripe_product.product.id
  currency       = "aud"
  billing_scheme = "tiered"
  tiers_mode     = "graduated"

  dynamic "tiers" {
    for_each = var.tiers
    iterator = each
    content {
      up_to       = each.value["up_to"]
      unit_amount = each.value["amount"]
    }
  }
}
```

So, using `for_each` together with `dynamic { }` blocks, you could design concise HCL files that still expand to multiple copies of a resource. Nice.

Sadly, that won't be enough for our desired toy example. As you'll remember, we want every user of our application to have an isolated Stripe account, which requires a `provider` block, which cannot be covered by `for_each`. We need something else.

## The brute-force way: templating your way to victory

Every web developer is familiar with the concept of templates: files that have placeholder variables and get rendered into new files.

They pop up in essentially every server-side web framework: [Django](https://docs.djangoproject.com/en/4.2/topics/templates/), [Spring Web](https://pebbletemplates.io/), [Laravel](https://laravel.com/docs/10.x/blade#displaying-data), [Go-based frameworks](https://pkg.go.dev/text/template). Even frontend frameworks such as [Vue](https://vuejs.org/guide/essentials/template-syntax.html), [Svelte](https://svelte.dev/docs#template-syntax) and [Angular](https://angular.io/guide/interpolation) have standalone templates (React and friends, not so much, since it gets smushed with the logic)

This is a simple template, in Django syntax:

```django
<h1>{{ question.question_text }}</h1>
<ul>
{% for choice in question.choice_set %}
    <li>{{ choice.choice_text }}</li>
{% endfor %}
</ul>
```

This can be rendered with the following data:

```json
{
	"question": {
		"question_text": "Do you really want to delete the file?",
		"choice_set": [
			{"id": 1, "choice_text": "Yes"},
			{"id": 2, "choice_text": "No"},
			{"id": 3, "choice_text": "I'm not sure"}
		]
	}
}
```

to produce the following HTML:

```html
<h1>Do you really want to delete the file?</h1>
<ul>
    <li>Yes</li>
    <li>No</li>
    <li>I'm not sure</li>
</ul>
```

Now, there's nothing in most (if not all) template libraries that dictates that they _must_ be used to generate HTML. Sure, it's one of their main features, but you can definitely use them to generate arbitrary text. Most of them can be operated as pure functions of the form:

```ts
render(template: String, data: Any) → String
```

We could use something like that to generate HCL files, with whatever content we wish.

The choice of templating library would be dictated by the language in which you are building your main application. Go? Use [the builtin `text/template` module](https://pkg.go.dev/text/template). Python? Use [Jinja](https://jinja.palletsprojects.com/en/3.1.x/). Python with Django? Maybe reuse the Django templating engine. JS? Consider [Mustache](https://github.com/janl/mustache.js/) (actually, consider Mustache no matter the language, they have a *massive* amount of ports). Java? Maybe use [Apache FreeMarker](https://freemarker.apache.org/) or [Thymeleaf](http://www.thymeleaf.org/). In any case, you'd need to provide templates in the format expected by your templating engine, plus data taken from the DB. The output would be a massive file that (hopefully) would be valid HCL, which could then be used by Terraform.

Pros:

* Absolute control over the generated file, since it's treated as a text file: you could definitely generate repeated Providers, which you can't do from inside Terraform
* The mental model is quite simple (at least for me, since I have already worked with server-side web frameworks)

Cons:

* There's no guarantee that the output will be syntactically valid HCL code. This could cause parse errors when trying to read the output file with Terraform.
* Autogenerated source code can get difficult to read.
* In general, by treating the source files as plain text, you lose the context of the source language (HCL, in this case): syntax highlighting can get messed up, for example, as your templates are no longer valid HCL.
* You drag with you some problems: [XSS, anyone](https://www.stackhawk.com/blog/django-xss-examples-prevention/#unquoted-payload)? What would code injection even _look like_ on HCL? Especially bad because most templating libraries have strong defenses against HTML injection and (maybe) JS, but definitely not for HCL. Injection is [fiendlishly hard to defend against](https://benhoyt.com/writings/dont-sanitize-do-escape/), and you can'd do it blindly: you need to understand the target language to find out what you need to escape. And, as we all know, [mixing control and data planes is bad news](https://github.blog/2022-02-16-encoding-escaping-untrusted-data-prevent-injection-attacks/#other-encoding-or-escaping-scenarios).

## The elegant way from a more civilized era: Serializing Go structs to HCL

Since HCL comes from Hashicorp, of course [it's written in Go](https://pkg.go.dev/github.com/hashicorp/hcl/v2#section-readme). For example, this is from the docs linked just above:

```go
package main

import (
	"log"

	"github.com/hashicorp/hcl/v2/hclsimple"
)

type Config struct {
	IOMode  string        `hcl:"io_mode"`
	Service ServiceConfig `hcl:"service,block"`
}

type ServiceConfig struct {
	Protocol   string          `hcl:"protocol,label"`
	Type       string          `hcl:"type,label"`
	ListenAddr string          `hcl:"listen_addr"`
	Processes  []ProcessConfig `hcl:"process,block"`
}

type ProcessConfig struct {
	Type    string   `hcl:"type,label"`
	Command []string `hcl:"command"`
}

func main() {
	var config Config
	err := hclsimple.DecodeFile("config.hcl", nil, &config)
	if err != nil {
		log.Fatalf("Failed to load configuration: %s", err)
	}
	log.Printf("Configuration is %#v", config)
}
```

This short Go program reads and parses HCL files like the following:

```hcl
io_mode = "async"

service "http" "web_proxy" {
  listen_addr = "127.0.0.1:8080"
  
  process "main" {
    command = ["/usr/local/bin/awesome-app", "server"]
  }

  process "mgmt" {
    command = ["/usr/local/bin/awesome-app", "mgmt"]
  }
}
```

into the following Go data:

```go
config := Config{
	IOMode: "async",
	Service: ServiceConfig{
		Protocol: "http",
		Type: "web_proxy",
		ListenAddr: "127.0.0.1:8080",
		Processes: []ProcessConfig{
			ProcessConfig{Type: "main", Command: ["/usr/local/bin/awesome-app", "server"]},
			ProcessConfig{Type: "mgmt", Command: ["/usr/local/bin/awesome-app", "mgmt"]},
		},
	},
}
```

Indeed, that's probably what Terraform does internally, for deserializing your arbitrary Terraform files into actual, actionable data. However, here we don't care about that, but about the reverse bit: turning Go data structures into syntactically valid HCL strings.

Luckily, that is also implemented by the `dev/github.com/hashicorp/hcl2` package, though it's [a bit hidden](https://pkg.go.dev/github.com/hashicorp/hcl2/gohcl#EncodeIntoBody):

```go
// Assume that the config variable above (of type Config) is available

f := hclwrite.NewEmptyFile()
gohcl.EncodeIntoBody(&config, f.Body())
fmt.Printf("%s", f.Bytes())
```

This will properly serialize the contents of the `config` variable (and all its nested properties) into a string.

In the case of our running example (the ecommerce site builder), if we were developing the backend in Go, we could then write a few struct types, then instantiate some structs, and serialize the whole lot into strings.

As a reminder, this is a snippet from the final HCL file that we want:

```hcl
provider "stripe" {
  alias = "stripe_user_1"
  api_key = "CXLP04i5meA"
}

resource "stripe_product" "product_1" {
  provider    = stripe.stripe_user_1
  name        = "Widget"
  description = "Shiny, useful Widget"
}

resource "stripe_price" "price_product_1" {
  provider    = stripe.stripe_user_1
  product     = stripe_product.product_1.id
  currency    = "usd"
  unit_amount = 999
}
```

The following Go program generates that file:

```go
package main

import (
	"fmt"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/gohcl"
	"github.com/hashicorp/hcl/v2/hclwrite"
)

type StripeProvider struct {
	Label  string `hcl:"label,label"`
	Alias  string `hcl:"alias"`
	APIKey string `hcl:"api_key"`
}
type StripeProduct struct {
	Label       string          `hcl:"label,label"`
	ID          string          `hcl:"id,label"`
	Provider    *hcl.Expression `hcl:"provider"`
	Name        string          `hcl:"name"`
	Description string          `hcl:"description"`
}
type StripePrice struct {
	Label      string          `hcl:"label,label"`
	ID         string          `hcl:"id,label"`
	Provider   *hcl.Expression `hcl:"provider"`
	Product    *hcl.Expression `hcl:"product"`
	Currency   string          `hcl:"currency"`
	UnitAmount int             `hcl:"unit_amount"`
}

func main() {
	f := hclwrite.NewEmptyFile()

	prov := StripeProvider{
		Label:  "stripe",
		Alias:  "stripe_user_1",
		APIKey: "CXLP04i5meA",
	}
	f.Body().AppendBlock(gohcl.EncodeAsBlock(prov, "provider"))

	product_1 := StripeProduct{
		Label: "stripe_product",
		ID:    "product_1",
		// Provider: nil, // This has to be set manually!
		Name:        "Widget",
		Description: "Shiny, useful Widget",
	}
	product_1_body := gohcl.EncodeAsBlock(product_1, "resource")
	product_1_body.Body().SetAttributeTraversal("provider", hcl.Traversal{
		hcl.TraverseRoot{Name: "stripe"},
		hcl.TraverseAttr{Name: "stripe_user_1"},
	})
	f.Body().AppendBlock(product_1_body)

	price_1 := StripePrice{
		Label: "stripe_price",
		ID:    "stripe_price_1",
		// Provider: nil, // This has to be set manually!
		// Product: nil, // This has to be set manually!
		Currency:   "usd",
		UnitAmount: 999,
	}
	price_1_body := gohcl.EncodeAsBlock(price_1, "resource")
	price_1_body.Body().SetAttributeTraversal("provider", hcl.Traversal{
		hcl.TraverseRoot{Name: "stripe"},
		hcl.TraverseAttr{Name: prov.Alias},
	})
	price_1_body.Body().SetAttributeTraversal("product", hcl.Traversal{
		hcl.TraverseRoot{Name: "stripe_product"},
		hcl.TraverseAttr{Name: product_1.ID},
		hcl.TraverseAttr{Name: "id"},
	})
	f.Body().AppendBlock(price_1_body)

	fmt.Printf("%s", f.Bytes())
}
```

Running that program with `go run encoder.go` generates the following output:

```bash
❯ go run encoder.go
provider "stripe" {
  alias   = "stripe_user_1"
  api_key = "CXLP04i5meA"
}
resource "stripe_product" "product_1" {
  name        = "Widget"
  description = "Shiny, useful Widget"
  provider    = stripe.stripe_user_1
}
resource "stripe_price" "stripe_price_1" {
  product     = stripe_product.product_1.id
  currency    = "usd"
  unit_amount = 999
  provider    = stripe.stripe_user_1
}
```

The nastiest part is the expressions, or references to other blocks. See, for example, the reference to the provider in the product's `provider` block: we had to manually manipulate the HCL AST to introduce that data, since [apparently the package that converts back to HCL files cannot generate anything other than constant values](https://github.com/hashicorp/hcl/issues/318#issuecomment-549576126).

So, by varying the data that is used to initialize the structs, we could generate multiple Providers (one for each user of our application), multiple Products (one for each product that every user has created) and multiple Prices (one for each Product). Then, we can dump each of them to a `hclwrite.File`, then write that file to disk, and then use it as normal with Terraform.

Pros:

* Completely official, therefore should have the most features and the fewest bugs
* Clean translation from structs to HCL code
* Should generate syntactically valid HCL code, with no risk of injections

Cons:

* Only works in Go :(
* Expressions are somewhat awkward: the package really wants to [interpret expressions as if it were a templating language](https://hcl.readthedocs.io/en/latest/go_expression_eval.html), by providing an "evaluation context" that holds the values for the variables. That is in the reverse direction to what we want

So, if you are already building your application in Go, you may as well use this alternative. Otherwise, read on.

## The alternatives: From other programming languages

What if your project doesn't use Go? How about NodeJS or Python, for example?

There is at least one tool that does something slightly similar to the HCL Go package, but on Python: [Pretf](https://github.com/raymondbutcher/pretf). With Pretf, you write a Python file that defines the resources that will be created. This file is then run by Pretf and generates some Terraform files, which in turn can be run by Terraform as normal.

For example, this Python file:

```py
from pretf.api import block

def pretf_blocks():
    yield block("resource", "random_integer", "dog", {
        "min": 1,
        "max": 10,
    })

    yield block("resource", "random_integer", "cat", {
        "min": 1,
        "max": 10,
    })

    yield block("resource", "random_integer", "buffalo", {
        "min": 1,
        "max": 10,
    })
```

can be "compiled" by Pretf by running `pretf validate`, and it will generate this[^1]:

```hcl
resource "random_integer" "dog" {
	min = 1
	max = 10
}

resource "random_integer" "cat" {
	min = 1
	max = 10
}

resource "random_integer" "buffalo" {
	min = 1
	max = 10
}
```

Now, this is somewhat of a paradigm change with respect to normal Python scripts. When you run the Python file, you do _not_ create the actual resources. You just generate HCL data. The actual resource creation is handled by Terraform, as usual.

### Sidenote: Does this smell like Amaranth?

This pattern of writing code that defines entities reminds me of FPGA hardware description languages like [Amaranth, previously nMigen](https://amaranth-lang.org/docs/amaranth/latest/intro.html) (with which I have worked briefly) and [SpinalHDL](https://github.com/SpinalHDL/SpinalHDL).

Briefly, these languages are used in the FPGA/hardware development world to describe circuits. Normally, you'd use Verilog or VHDL, but ask anyone: those languages are _weird_. And toolchains are ugly. And expensive. And closed-source. And they don't compose well. And...

So, there is a family of HDLs (Hardware Description Languages) that use more mainstream programming languages to describe the actual hardware. For example, this is nMigen, which should translate very directly to Amaranth (Amaranth is a rename of the nMigen project):

```py
from amaranth import *
from amaranth.back import verilog

class Blinker(Elaboratable):
    def __init__(self, period):
        assert period % 2 == 0, 'period must be even'
        self.period = period
        self.led = Signal()
        self.counter = Signal((period - 4).bit_length())
        self.ports = [self.led]

    def elaborate(self, platform):
        m = Module()
        with m.If(self.counter[-1]):
            m.d.sync += [
                self.counter.eq(self.period // 2 - 2),
                self.led.eq(~self.led),
            ]
        with m.Else():
            m.d.sync += [
                self.counter.eq(self.counter - 1),
            ]
        return m

class Top(Elaboratable):
    def __init__(self):
        self.led = Signal()

    def elaborate(self, platform):
        m = Module()
        blink = Blinker(period=int(25_000_000))
        m.submodules += blink
        m.d.comb += self.led.eq(blink.led)
        return m
		
top = Top()
with open("up_counter.v", "w") as f:
    f.write(verilog.convert(top, ports=[top.led]))

```

Running this script generates the following Verilog code (cleaned for readability):

```verilog
module blinker (rst, clk, led);
  input clk;
  wire clk;
  input rst;
  wire rst;

  output led;
  
  wire [25:0] \$2 ;
  assign \$2  = counter - 1'h1;
  wire \$4 ;
  assign \$4  = ~led;
  reg [24:0] counter = 25'h0000000;
  reg [24:0] \counter$next ;
  reg led = 1'h0;
  reg \led$next ;
  
  always @(posedge clk)
    led <= \led$next ;
  always @(posedge clk)
    counter <= \counter$next ;
  always @* begin
    casez (counter[24])
      1'h1:
          \counter$next  = 25'h0bebc1e;
      default:
          \counter$next  = \$2 [24:0];
    endcase
    casez (rst)
      1'h1:
          \counter$next  = 25'h0000000;
    endcase
  end
  always @* begin
    \led$next  = led;
    casez (counter[24])
      1'h1:
          \led$next  = \$4 ;
    endcase
    casez (rst)
      1'h1:
          \led$next  = 1'h0;
    endcase
  end
endmodule

module top(clk, rst, led);
  input clk;
  input rst;
  output led;
  
  blinker blinker (
    .clk(clk),
    .led(led),
    .rst(rst)
  );
endmodule
```

Don't try to understand all that, the multiple registers and automatic names get ugly. The point is that the Python code doesn't somehow _blink an LED_ (which LED would it blink on your PC?), nor is it downloaded to the FPGA (you'd need a _huge_ amount of effort and a soft core to run Python on an FPGA!). Instead, running the Python code _synthesizes_ Verilog code that describes hardware that can blink an LED. What you download on the FPGA is the Verilog code that the Python code describes.

So, Python is here acting somehow like a [transpiler](https://en.wikipedia.org/wiki/Source-to-source_compiler), as Python constructs then get converted to Verilog constructs.

In the same vein, Pretf doesn't actually instantiate resources in remote infrastructure. When run, it synthesizes code (Terraform files) that describes infrastructure.

### Back to Pretf

So, we can use Pretf to generate Terraform code. We can even [add references to other blocks](https://pretf.readthedocs.io/en/latest/tutorial/dynamic-references/). The output is a set of JSON files that can be accepted by the Terraform CLI.

For example, this is how we'd create the data for User 1 (one Provider, two Products, each with a Price):

```py
from pretf.api import block

def pretf_blocks():
    provider = yield block("provider", "stripe", {
        "alias": "stripe_user_1",
        "api_key": "CXLP04i5meA",
    })
    
    product = yield block("resource", "stripe_product", "product_1", {
        "name": "Widget",
        "description": "Shiny, useful Widget",
        "provider": provider,
    })
    yield block("resource", "stripe_price", "stripe_price_1", {
        "product": product.id,  # NOTE: This is a reference to a property of a previous block!
        "provider": provider,
        "currency": "usd",
        "unit_amount": 999,
    })
```

will generate the following JSON file:

```json
[
  {
    "provider": {
      "stripe": {
        "alias": "stripe_user_1",
        "api_key": "CXLP04i5meA"
      }
    }
  },
  {
    "resource": {
      "stripe_product": {
        "product_1": {
          "name": "Widget",
          "description": "Shiny, useful Widget",
          "provider": "stripe.stripe_user_1"
        }
      }
    }
  },
  {
    "resource": {
      "stripe_price": {
        "stripe_price_1": {
          "product": "${stripe_product.product_1.id}",
          "provider": "stripe.stripe_user_1",
          "currency": "usd",
          "unit_amount": 999
        }
      }
    }
  }
]
```

Hopefully you can see the structure there. It's the same as the HCL file that we generated in Go using the official HCL package, just expressed as JSON.

Pros:

* Should be able to generate any set of HCL constructs
* Should not let you generate invalid HCL
* You have the entire power of Python at your disposal, and you should be able to (say) access external resources such as API endpoints or DBs while generating resources
* Handling cross-resource dependencies as simple variable access is really clean

Cons:

* Only works on Python
* It still writes JSON files to disk for the Terraform CLI to execute, so not so tight integration with the rest of your program
* You can't (easily) call the generation logic frm another part of your code, it's expected that you'll use their CLI

## Pulumi

This is technically not an alternative like the others, since it is a completely different tool and ecosystem. I decided to include it here because it smells similar to using Python to declare Terraform blocks.

There's another tool to do something like what Terraform does. It's called [Pulumi](https://www.pulumi.com/), and it bills itself as "Infrastructure as code in any programming language". They [know that they are somewhat of an alternative to Terraform](https://www.pulumi.com/docs/concepts/vs/terraform/).

The main value proposition of Pulumi is that you can write code in several programming languages (Typescript, Python, Go, C# and Java right now. Feature parity not guaranteed). From there on, the experience is similar to that of Pretf (or Amaranth, for that matter): You write a program that describes the resources that you want. Inside that program you can use whatever you can (loops, function calls, possibly even calls to external files, HTTP services or DBs) to instantiate Resources.

Again, like Pretf or HDLs, running the program doesn't actually instantiate the resources. It just constructs a sort of "resource graph", which contains all the desired resources and dependencies between them. Then, the Pulumi engine takes the graph, compares it with the current state of the world, and applies whichever changes are required, and no more.

From [the docs](https://www.pulumi.com/registry/packages/aws/how-to-guides/ec2-webserver/), this is a simple Typescript program:

```ts
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const size = "t2.micro";
const ami = aws.getAmiOutput({
    filters: [{
        name: "name",
        values: ["amzn-ami-hvm-*"],
    }],
    owners: ["137112412989"], // This owner ID is Amazon
    mostRecent: true,
});

const group = new aws.ec2.SecurityGroup("webserver-secgrp", {
    ingress: [
        { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
    ],
});

const server = new aws.ec2.Instance("webserver-www", {
    instanceType: size,
    vpcSecurityGroupIds: [ group.id ], // reference the security group resource above
    ami: ami.id,
});

export const publicIp = server.publicIp;
export const publicHostName = server.publicDns;
```

This creates a Security Group and an EC2 server in AWS.

It's quite similar to Terraform: the AMI output would be a data source in Terraform, the SG and instances would be Resources, and here the provider is implicitly configured via environment variables.

Pulumi also lets you [create new dynamic resource providers](https://www.pulumi.com/docs/concepts/resources/dynamic-providers/), which are similar to Terraform's third-party providers: they extend Pulumi's capabilities to new services (the example that they give is Wordpress, where presumably you'd have resources to represent Posts, Tags and Categories, for instance).

Indeed, the [interface that you have to implement](https://www.pulumi.com/docs/concepts/resources/dynamic-providers/#the-resource-provider-interface) is quite similar to that [required by a Terraform provider](https://developer.hashicorp.com/terraform/plugin/framework/resources): namely, functions to fetch data from the remote API, create a new resource in the remote service, and functions to update and delete said resources. Pulumi also requires a function to [compare states](https://www.pulumi.com/docs/concepts/resources/dynamic-providers/#diffid-olds-news), which Terraform doesn't seem to require (they probably implement the diffing logic internally).

Pros:

* It's more likely that you can use the same programming language as your shiny web application, as they cover JS, Python, Java and Go.
* The conceptual model is quite similar to Terraform, so you should not need much adjustment
* Can use [any Terraform provider](https://github.com/pulumi/pulumi-terraform-bridge) through bridges, so (in theory) its functionality is a strict superset of Terraform's
* The [Automation API](https://www.pulumi.com/docs/using-pulumi/automation-api/) seems like a really neat idea that fits our usecase perfectly (namely, embedding stuff into a larger web application). Terraform integration is somewhat awkward, in that you have to 1) generate the Terraform file, 2) save it to disk, and 3) run the Terraform CLI as a subprocess/spawned shell, with the associated issues: your only communication channel is a text-based stdout, way less integration, no breakpointing, and so on
* You can [unit test the code](https://www.pulumi.com/docs/using-pulumi/testing/unit/), to verify that it generates the correct resources

Cons:

* It's not Terraform, so you may not want to migrate your entire business over
* The differences between programming languages may come to bite you at some point
* It pushes you quite hard to use Pulumi Cloud (you can disable it, and Terraform is guilty of the same with TF Enterprise, sooo...)
* Probably less known than Terraform: it's a newer project, with fewer commits and stars. Note that it's very active, it's not like it's abandoned or anything

In summary: if you are not invested into Terraform already, consider evaluating Pulumi too! It's a bit of a perspective shift, as you now describe your resources in a full-fledged programming language, but you get more flexibility (and footguns, for the same price!). Otherwise, never mind, carry on.

If you'd like to read more (coming from the camp of "why Pulumi better"), maybe [give a look at this article](https://www.techwatching.dev/posts/pulumi-vs-terraform).

## The Unstable One: Terraform CDK

Coming back to Terraform land, there's a new (not yet stable) product, the [Terraform CDK](https://developer.hashicorp.com/terraform/cdktf) (Cloud Development Kit). It "allows you to use familiar programming languages to define and provision infrastructure". Now where have we heard that before?

It supports "TypeScript, Python, Java, C#, and Go". Where have we heard that before?

That's right! Terraform has a solution that is similar in spirit to Pulumi: a way of declaring infrastructure using programming languages. Fun.

This code (in JS):

```js
import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { Container } from "@cdktf/provider-docker/lib/container";

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new DockerProvider(this, "docker", {});

    const dockerImage = new Image(this, "nginxImage", {
      name: "nginx:latest",
      keepLocally: false,
    });

    new Container(this, "nginxContainer", {
      name: "tutorial",
      image: dockerImage.name,
      ports: [
        {
          internal: 80,
          external: 8000,
        },
      ],
    });
  }
}

const app = new App();
new MyStack(app, "learn-cdktf-docker");
app.synth();
```

synthesizes into this HCL code (but as JSON):

```hcl
resource "docker_image" "nginx" {
  name         = "nginx:latest"
  keep_locally = false
}

resource "docker_container" "nginx" {
  image = docker_image.nginx.name
  name  = "tutorial"
  ports {
    internal = 80
    external = 8000
  }
}
```

You can run `cdktf synth` to generate the JSON equivalent of the HCL code above, which you could then, say, commit to Git and let your CD pipeline pick up and apply. Or you could just run `cdktf deploy`, which would generate the JSON files and then apply them directly.

Pros:

* Comes from Hashicorp, so it better have 100% compatibility with plain Terraform and its vibrant community of providers
* It's more likely that you can use the same programming language as your shiny web application, as they cover JS, Python, Java and Go.
* Can use [any Terraform provider](https://developer.hashicorp.com/terraform/cdktf/concepts/hcl-interoperability), so (in theory) its functionality is strictly equal to Terraform's
* Outputs Terraform JSON files (like Pretf above), so it can plug in to an already-working Terraform pipeline: in effect, it's "just" is another way of producing the JSON files, with better developer experience and autocompletion
* You can [unit test](https://developer.hashicorp.com/terraform/cdktf/test/unit-tests) the code: you get to synthesize the JSON representation of the infrastructure and then run assertions against it

Cons:

* It doesn't embed well on larger applications: like non-(Automation API) Pulumi or plain Terraform, you have to trigger it from a subprocess
* It may inherit some suboptimal design decisions of Terraform, but as I haven't worked extensively with it, I can't enumerate any

## The compromise: generating the JSON representation of HCL

As an alternative to the CDKTF (say, if you're developing your larger application in a language that isn't supported), you may want to generate the JSON representations of Terraform resources yourself.

In effect, this is similar to the Brute Force approach that we explored faaaar above (it's actually the first approach in this post!). However, in that section we manually generated HCL files, treating them as text files with no structure. As we covered there, doing so loses you all the benefits of a defined syntax: you are no longer writing valid HCL, so it's far too easy to introduce syntax errors and open yourself up to injection attacks.

However, the folks at Hashicorp have provided us with a [strict JSON spec of the HCL language](https://github.com/hashicorp/hcl/blob/main/json/spec.md). In other words, every HCL file has a JSON equivalent (but not viceversa: not every JSON file can be translated to HCL!). For instance, this HCL file:

```hcl
io_mode = "async"

service "http" "web_proxy" {
  listen_addr = "127.0.0.1:8080"
  
  process "main" {
    command = ["/usr/local/bin/awesome-app", "server"]
  }

  process "mgmt" {
    command = ["/usr/local/bin/awesome-app", "mgmt"]
  }
}
```

is to be treated as exactly equivalent to this (perfectly legal) JSON file:

```json
{
  "io_mode": "async",
  "service": {
    "http": {
      "web_proxy": {
        "listen_addr": "127.0.0.1:8080",
        "process": {
          "main": {
            "command": ["/usr/local/bin/awesome-app", "server"]
          },
          "mgmt": {
            "command": ["/usr/local/bin/awesome-app", "mgmt"]
          },
        }
      }
    }
  }
}
```

In fact, translation can mostly be done in your head, with some [edge cases around expressions](https://github.com/hashicorp/hcl/blob/main/json/spec.md#strings), and [some edge cases on the edge cases](https://developer.hashicorp.com/terraform/language/syntax/json#resource-and-data-blocks). Now, JSON is far, _far_ easier to generate programmatically, so you can probably generate valid JSON documents with nothing else but what your programming language of choice includes in its standard library for dumping dictionaries/hashmaps/maps/associative arrays/whatever they're called to JSON.

For example, in Python:

```py
def make_stripe_provider(user_id, apikey):
	return {"provider": {"stripe": {
		"alias": f"user_{user_id}",
		"api_key": apikey,
	}}}
		
def make_stripe_product(user_id, product_id, name, description):
	return {"resource": {"stripe_product": { 
		f"product_{product_id}": {
			"name": name,
			"description": description,
			"provider": f"stripe.user_{user_id}",
		}
	}}}

def make_stripe_price(user_id, product_id, currency, amount):
	return {"resource": {"stripe_price": { 
		f"price_{product_id}": {
			"provider": f"stripe.user_{user_id}",
			"product": f"${{stripe_product.product_{product_id}.id}}",
			"currency": currency,
			"unit_amount": amount,
		}
	}}}
	
print([
	make_stripe_provider(1, "CXLP04i5meA"),
	make_stripe_product(1, 1, "Widget", "Shiny, useful Widget"),
	make_stripe_price(1, 1, "usd", 999),
])
```

would output the following:

```json
[
   {
      "provider":{
         "stripe":{
            "alias":"user_1",
            "api_key":"CXLP04i5meA"
         }
      }
   },
   {
      "resource":{
         "stripe_product":{
            "product_1":{
               "name":"Widget",
               "description":"Shiny, useful Widget",
               "provider":"stripe.user_1"
            }
         }
      }
   },
   {
      "resource":{
         "stripe_price":{
            "price_1":{
               "provider":"stripe.user_1",
               "product":"${stripe_product.product_1.id}",
               "currency":"usd",
               "unit_amount":999
            }
         }
      }
   }
]
```

which, once written to a file, is fair game for the Terraform CLI to use.

Pros:

* Should be implementable in any programming language that has some sort of Map structure and can output JSON (so, all of them)
* The output plugs into the standard Terraform workflow
* You can unit test the generated JSON to verify that your generation functions build JSON snippets with certain properties
* There's no magic: the mapping logic is perfectly clear for all to see
* You get to reuse all Terraform providers

Cons:

* You have to implement everything yourself, even the translation from HCL to JSON
* You are still open to (at least some) code injections, AFAICT. Impact not clear, needs more research
* Like the CDKTF, it doesn't embed well: you still need to shell out to the Terraform CLI, and get data from it via unstructured stdout

Alternatively, if you want to ~~overengineer~~ explore new alternatives, consder "programmable config languages" such as [Jsonnet](https://jsonnet.org/), [Datasonnet](https://datasonnet.github.io/datasonnet-mapper/datasonnet/latest/index.html) and [Grafana Tanka](https://tanka.dev/), or (on a different vein) [Dhall](https://dhall-lang.org/).

The first three come from the same family, Jsonnet being the father of the other two. Jsonnet is "an extension of JSON" (technically a superset) that lets you generate config data. It's a really neat declarative, functional, lazy language that lets you generate JSON documents. However, the way in which you generate them is fairly close to the pure functionalities of a fully-fledged programming language: you get loops, arithmetic operations, string functions, the holy map-reduce-filter triad that gives you functional programming, lambda functions, `self` and `super` references to reduce duplication, and some other goodies.

Jsonnet started its life as a tool to generate Kubernetes configs, where you commonly have to generate many resources, across several CRDs, to deploy a single container. Some values have to be shared across the different CRDs (for instance, tags have to be the same in a Deployment and its Pods, and on Pods and Services). Jsonnet and Co. can take high-level inputs (such as application name + number of replicas) and "expand" it into a large amount of JSON/YAML data filled with boilerplate Kubernetes code.

For instance, if you have the following Jsonnet function:

```jsonnet
function newDeployment(name, containers) {
	apiVersion: "apps/v1",
	kind: "Deployment",
	metadata: {
		name: name,
	},
	spec: {
		selector: { matchLabels: {
			name: name,
		}},
		template: {
			metadata: { labels: {
			  name: name,
			}},
			spec: { containers: containers }
		}
	}
}
```

you can generate Kubernetes Deployments by simply passing an app name and container spec:

```jsonnet
newDeployment("grafana", [{
	image: 'grafana/grafana',
	name: 'grafana',
	ports: [{
		containerPort: 3000,
		name: 'ui',
	}],
}])
```

As you can see, the application name is repeated multiple times: in the Deployment's labels, in the Deployment's selector, and in the Pod's labels (which are used by the selector). Of course, you can now reuse the `newDeployment` function to generate as many Deployments as you wish.

Jsonnet, Datasonnet and Tanka use this exact same paradigm and syntax.

Dhall is a really weird language that reads like Haskell. You know you are in trouble when the docs state that Dhall's type system "is a variation on CCω". Okayyy. In other words, the mental model for Dhall is quite bizarre, but the general idea is the same: it's JSON on steroids. If you haven't worked with Haskell before, though, the syntax may trip you up. Use with care.

## Recap

We have reviewed several alternatives to generate dynamic Terraform files, or otherwise achieving equivalent results.

* Builtin Terraform utilities, `for_each` and dynamic blocks: supported and documented, can't express some complexities such as looped providers
* Using templating languages: Easy to understand, can generate any HCL output that you desire, you lose syntactic support for HCL and can thus introduce typos, should be implementable anywhere, ugly integration with the rest of your program
* Using the Go HCL library: Only works on Go, shouldn't generate invalid HCL files, can generate any HCL output that you desire, ugly integration with the rest of your program, only one that can generate honest HCL output (the alternatives generate the JSON representation of HCL, which is far more verbose and difficult to read)
* Using Pretf: Only works on Python, shouldn't generate invalid HCL files, can generate any HCL output that you desire, ugly integration with the rest of your program
* Pulumi: It's an entirely different ecosystem, has integration with several mainstream programming languages (but not all), should be able to use any Terraform provider so you can reuse code, the Automation API _may_ be a nice, clean way to integrate with your larger application (untested!)
* CDKTF: Terraform official, it's in alpha, has integration with several mainstream programming languages (but not all), should be able to use any Terraform provider, ugly integration with the rest of your program
* Manually generating JSON representations: Adds the least amount of magic to the workflow, can be used from any programming language, _can_ generate invalid documents, can generate any HCL output that you desire, ugly integration with the rest of your program

You decide. If you have any more alternatives, feel free to comment below!

That's it for this article! Again, I decided to write it because I couldn't find anything about this specific use case. Maybe it's not common, because you don't want your cloud infra to be dynamically specified, as I can see a runaway script creating infinitely many servers and exploding your AWS bill, but just in case you need such a tool, now you have several options.

[^1]: Actually, it'll generate a JSON representation of the HCL data, but the translation between both is lossless and well defined. Furthermore, Terraform also accepts the JSON representation, so no harm done there.
