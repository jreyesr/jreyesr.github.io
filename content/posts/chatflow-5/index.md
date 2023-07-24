---
title: "OpenChatflow, Devlog 4"
date: 2023-05-22T22:07:21.000-05:00
summary: "In this devlog, we integrate a real DB (PostgreSQL with the Prisma ORM) with the OpenChatflow application, so that we can create, read and save conversations."
tags: ['open-source', 'telegram', 'chatbots']
categories: ['nextjs', 'tailwind', 'reactflow']
series: ['openchatflow']
---

The app is now live on Vercel! Check the editor out on <https://openchatflow.vercel.app/design>

This devlog covers up to [commit `0b6c5f3`](https://github.com/jreyesr/openchatflow/commit/0b6c5f31cf7fcf96b8686c3555a3ea1fbb2f6b25). This is how the UI looks at this point:

![f824b6d4f9a78b79990143f5b010e4c5.png](./_resources/f824b6d4f9a78b79990143f5b010e4c5.png)

![fac3fd1fd5830dd768c881b502a2a552.png](./_resources/fac3fd1fd5830dd768c881b502a2a552.png)

We have:

* Added Prisma as an ORM to handle database interactions
* Created a first iteration of the DB model, which just saves the conversation templates that the users will edit on the editor that we've been creating until now
* Added a new application page to list all existing conversations, along with a button to create a new conversation
* Explored ways of having direct DB access from a React application, which shouldn't normally work since React was born as a client-side framework
* Verified that we can create new conversation templates
* Implemented automatic saving of the data.

## Integrating with the Prisma ORM

OpenChatflow will use [the Prisma ORM](https://www.prisma.io/), for no particular reason other than that I have heard its name before. Were this Python, I'd be using the Django ORM (for Django) or SQLAlchemy (in any other case). Prisma seems to integrate quite well with Typescript, which is nice. It also seems to have really good migration support, dedicated schema files and multiple database engines.

Prisma's [quickstart (in particular the "Adding Prisma to an existing project" part)](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases-typescript-postgresql) is plenty good enough for adding it to OpenChatflow:

1. `yarn add --dev prisma`
2. `yarn add @prisma/client`
3. `yarn prisma init`
	* This creates a `schema.prisma` file, which will contain the data model's definition (i.e., tables and columns), along with connection information such as database credentials; and a `.env` file, which will hold the actual credentials
4. Add the `.env` file to `.gitignore`
5. Edit the `DATABASE_URL` property in the `.env` file so it points to a local file path for a PostgreSQL database:
    ```env
    DATABASE_URL="postgresql://user:pass@localhost:5432"
    ```
6. Edit the `prisma/schema.prisma` file so that it references the environment variable above:
    ```
	datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }
	```
7. Since we don't have a DB ready to introspect and pull the schema, we'll have to create the schema by hand. More on that in a moment.
8. Once the schema is created, we'll generate the "Prisma Client", which is a dynamically-generated Typescript library, which provides the magical TS bindings, autocompletion and type checks.
9. At this point, we can start using the client in the actual application, to (say) read workflow definitions from a table.

## DB design

Here's a simple DB schema, which seems appropriate for a first version of OpenChatflow:

![c8864a5fc6aa56ddd060f12a9f8f0916.png](./_resources/c8864a5fc6aa56ddd060f12a9f8f0916.png)

`User`s are the application's users, who will log in and do stuff. They'll edit `ConversationTemplate`s, which are what we have been editing until now with the Reactflow editor. Users will also be able to register `TelegramBot`s, which are identified by their token (which is an identifier that lets you send API requests as that specific bot). Each bot may be assigned to a `ConversationTemplate`, which is the conversation which that bot will use whenever a user talks to it.

When a user first talks to a registered bot, it will look up its currently assigned `ConversationTemplate` and create a new `Conversation` from it. This mirrors what N8N does with automations: you edit a Workflow but whenever it runs it transforms into an Execution. Changes in the Workflow don't affect currently-executing or completed Executions, since that would cause utter chaos. Similarly, here, once you talk to a bot, that conversation will be frozen to whatever was at the moment the template.

`TelegramUser`s are users in the context of Telegram (not necessarily application users). Every `Conversation` will have one bot and one user.

## Schema definition

For now, we just need to define the `ConversationTemplate` model, which corresponds to a Reactflow "flow" or a XState "machine". This is what the user of OpenChatflow will edit, and what the bots will check when talking to users. I'm reserving the `Conversation` model name to actual instances of conversations (in much the same way that a class in any OO language creates instances, here a `ConversationTemplate` will spawn `Conversation`s)

A template must have:

* A name and description, just so we have something to show in the Templates list
* (Later) The user who created the template, to implement multi-user behavior
* The date of creation, just because
* The actual flow, as a JSON object. This will be used to load the Reactflow editor, and it will be persisted on save. Later, when we start working with XState, we'll also have to find a way to convert the Reactflow-style JSON into something that XState can work with.

```
model ConversationTemplate {
  id          Int      @id @default(autoincrement())
  createdAt   DateTime @default(now())
  title       String
  description String   @default("")
  flow        Json // Must contain "nodes" and "edges" properties
}
```

After writing the schema, we need to create a _migration_ to apply the change to the database.

If you've used Django, you've found migrations. Roughly, a migration is a series of steps that take the database from state A to state B (much like a Git commit that adds, removes and changes lines). In this specific case, state A is an empty DB, so the operations on the migration are:

* Create a table called `ConversationTemplate`
* Add rows for every field, with the Postgres types that correspond to the types of the fields: for instance, the `id` column will be assigned an auto-incrementing sequence as its default value, while the `flow` column will be stored as a `jsonb` column.
* That's it!
* As a courtesy to the user, some ORMs ([though not Prisma!](https://github.com/prisma/prisma/discussions/4617#discussioncomment-215868)) generate "reverse"/"down" migrations too, that revert the changes. For instance, here the reverse migration would simply drop the `ConversationTemplate` table, since that will also destroy the columns.

In Prisma, the result of the migration is a plain SQL file, in the correct format for the DB engine specified in the config file (here, PostgreSQL):

```sql
-- prisma/migrations/20230520024306_init/migration.sql

-- CreateTable
CREATE TABLE "ConversationTemplate" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "flow" JSONB NOT NULL,

    CONSTRAINT "ConversationTemplate_pkey" PRIMARY KEY ("id")
);
```

You generate that file with the following command:

```bash
$ yarn prisma migrate dev --name init

yarn run v1.22.19
$ /home/reyes/code/openchatflow/node_modules/.bin/prisma migrate dev --name init
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "localhost:5434"

Applying migration `20230520024306_init`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20230520024306_init/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (4.14.1 | library) to ./node_modules/@prisma/client in 114ms
```

This creates the migration file and also applies it to the DB. Also, as you can see in the last line, it generates the "Prisma Client". We'll study that later.

From here on out, any further changes to the schema proceed as follows:

1. Make changes in the `schema.prisma` file
1. Run `yarn prisma migrate dev --name <name_of_migration>`
2. Check that the DB table reflects the changes
3. To apply the changes to the production database, run `yarn prisma migrate deploy`, probably as part of the deployment (since you always need the DB to be on sync with the code!)

## The Prisma Client

The Prisma client is a bunch of auto-generated Typescript code (for a TS-enabled project) that:

* Presents every database table as a TS `type`
* Exposes functions to create, query, update and delete records of every table
* Lets the IDE autocomplete and type-check everything, because Typescript is cool

The client lives... somewhere. Actually, it's in `node_modules/.prisma/client`, but you shouldn't ever need to inspect or edit it. It's regenerated automatically when you create a migration.

To use the client, on your application code, you need to import the Prisma client package:

```tsx
// app/design/[id]/page.tsx

import { PrismaClient } from '@prisma/client'

export default async function ConversationEditor({params}) {
  // The conversationTemplate class is autogenerated
  // and it has, for example, the findUniqueOrThrow method
  const { flow } = await prisma.conversationTemplate.findUniqueOrThrow({
    where: { id: parseInt(params.id) },
  });

  return <Editor initialNodes={flow.nodes} initialEdges={flow.edges} />
}
```

The `prisma.conversationTemplate.findUniqueOrThrow` call retrieves a single object, by its ID. The ID, in turn, comes from the page's URL params, since the editor will live in the URL `/design/<id>`.

In general, that's all the code that you would need for a component that fetches DB data, whether it be lists of entities or a single entity's details, as we do here. Thanks to NextJS's server components, there's no need for an explicit API call. As long as the component is a server component (i.e., it doesn't start with `"use client";`), the DB call will happen from inside the server, not from the client (which should _not_ have access to the DB anyways).

For creating/changing data, you have two options:

* Using [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/router-handlers) to create explicit API handlers, receive whatever data you need from the request, [create the record in the DB](https://www.prisma.io/docs/concepts/components/prisma-client/crud#create-a-single-record) (or edit it, whatever) and then invoke that API call manually from the frontend component.
* The new, still-unstable way: use [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions) directly from the frontend component. This approach saves you the work of creating an isolated endpoint and the explicit serialization-deserialization trip (it happens anyway, you just don't see it!)

## Traps for the unwary: server-side rendering and prefetching on List pages

This is a potential pitfall that confused me for a few hours, while working with the List page (i.e., the page that lists all the Conversation Templates in a table)

Here's a simplified version of the code:

```tsx
export default async function DesignList() {
  const flows = await prisma.conversationTemplate.findMany({
    orderBy: { createdAt: "desc" },
  }); // List all flows for now


  return (
    <table>
      {flows.map((f) => (
        <tr key={f.id} className="hover:bg-gray-50">
          <td className="px-4 py-3">{f.title}</td>
          <td className="px-4 py-3">{f.description}</td>
          <td className="px-4 py-3">
            <span title={f.createdAt.toISOString()}>
              {DateTime.fromJSDate(f.createdAt).toLocaleString()}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-4">
              <Link href={`/design/${f.id}`}>
                <Pencil className="w-6 h-6"/>
              </Link>
            </div>
          </td>
        </tr>
      ))}
    </table>
  )
}
```

This UI looks like this:

![4cfdcc362d25bc645e8b2f95c533da29.png](./_resources/4cfdcc362d25bc645e8b2f95c533da29.png)

So far, so good. That looks perfectly fine: when the render function is called, it will call Prisma's `prisma.conversationTemplate.findMany` function, fetch all flows, and then generate a `table` that lists them all. Simple, right?

As it turns out, it didn't work. When creating a new Conversation, it wasn't reflected in the table. Hard refreshing with `Ctrl+F5` did nothing. What was weirder, looking on the Vercel deployment logs (which contains access logs that record every HTTP request and any logs that were generated while serving the request) revealed that no SQL statements were being executed while serving `GET /design`.

And here's where NextJS's origins as a server-side-rendered framework can bite you. NextJS tries to prerender everything that it can at build time (i.e., every time you push a commit). Normally, that's perfectly fine, as you want to render once if you can. The result of a prerender is a static HTML+JS file, which can be mindlessly served from CDN. Much faster, it puts less load on your application server (and your database or data source), and safer to boot, since serving static files has less of an attack surface than a JS-running server.

NextJS [prerenders every route that doesn't depend on variable parameters](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic-rendering). Now, it happens that the `/design` route triggered the criteria for being pre-rendered, since it doesn't technically use variable parameters: it always does the equivalent of `SELECT * FROM conversation_templates`. Thus, NextJS helpfully renders it once, on build, and from there on serves the same file forever. In other words, the conversation list will be frozen on whatever state the DB was when the last deployment was made, and any further changes won't be reflected until the next deployment. Not good.

To verify that, I checked the build logs for the deployment, and I saw this:

![8f4c4c61f71f6ded12287bef79bbf932.png](./_resources/8f4c4c61f71f6ded12287bef79bbf932.png)

This is a snippet from the build logs. Note that the `/design` route has an empty circle at the left, as opposed to the `/design/[id]` route which has a lambda (λ) character. As you can see below, the λ means "server-side renders at runtime", while the circle means "automatically rendered as static HTML". That confirms that the `/design` route is being rendered once and then frozen, which is _not_ what we need.

Fortunately, the fix is easy: just export a new property `dynamic` from the `/design` component, with the value `force-dynamic`:

```tsx
// app/design/page.js

export const dynamic = "force-dynamic"; // NEW!
export default async function DesignList() {
  const flows = await prisma.conversationTemplate.findMany({
    orderBy: { createdAt: "desc" },
  }); // List all flows for now

  return (...)
```

As outlined in [the docs](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic), this export forces NextJS to treat the file as dynamic, and thus not prerender it. Indeed, the build logs confirm that:

![e682b64ae9815867faa3ce94f122a78e.png](./_resources/e682b64ae9815867faa3ce94f122a78e.png)

Now the `/design` route will be "server-side rendered at runtime" and won't be prerendered. Now creating a new conversation is reflected in the table (but after a hard refresh, as there are [some](https://github.com/vercel/next.js/issues/44431) [bugs](https://github.com/vercel/next.js/issues/49300) around soft-navigation and cache busting...)

## New and improved server actions

From the documentation:

> Server Actions are an alpha feature in Next.js, built on top of React Actions. They enable server-side data mutations, reduced client-side JavaScript, and progressively enhanced forms.
> https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions

In other words, you can write a client component that does this:

```tsx
"use client";

<form
  action={createConversationTemplate}
  className="grid grid-cols-1 gap-6 bg-white p-4"
>
  {/* Form inputs here... */}
	
  <button type="submit">Create</button>
</form>
```

Normally, you'd have to provide a string in the `<form action="...">` parameter, which would be an URL. Server Actions extend that syntax to let you provide an async function.

Internally, that async function will be called on the server, and NextJS inserts the necessary code to make an API call from the client. However, you as a developer don't need to care about that, instead thinking about function calls that cross environment boundaries.

This is the corresponding server action:

```tsx
// app/design/actions.tsx
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createConversationTemplate(data: FormData) {
  const title = data.get("name") as string;
  const description = data.get("description") as string;

  const newObj = await prisma.conversationTemplate.create({
    data: {
      title,
      description,
      flow: { nodes: [], edges: [] },
    },
    select: { id: true },
  });

  redirect(`/design/${newObj.id}`);
}
```

A Server Action is an async function whose file is tagged with `"use server"`. This function is imported and used from whichever component needs to mutate data, typically a form (for "create entity" flows).

For instance, we use a Server Action in the form that creates a new Conversation Template:

![6d27caf6481471a11ac667ebf69f9c87.png](./_resources/6d27caf6481471a11ac667ebf69f9c87.png)

The server action receives the form's contents (a name and description for the new Conversation Template) and creates a new record in the DB. It then redirects the user to the just-created template's Edit view, where the user can start editing the new flow.

![create_flow.gif](./_resources/create_flow.gif)

## Saving from a client component

Saving the Conversation Template is a bit weirder, since there is not a `<form>` element to which we can attach the server action, as above. Instead, we need to manually call the action:

```tsx
// app/design/[id]/page.tsx

export default async function Design({ params }: Props) {
  const id = parseInt(params.id);

  // This fetches the flow data
  const { flow } = await prisma.conversationTemplate.findUniqueOrThrow({
    where: { id },
  });

  // This is called on save
  async function onSave(data: { nodes: any[]; edges: any[] }) {
    "use server"; // NOTE: This is important, even if the function below is already "use server"!
    updateConversationTemplate(id, data);
  }

  return (
    <div className="flex" style={{ height: "75vh" }}>
      <Editor
        initialNodes={(flow as any).nodes}
        initialEdges={(flow as any).edges}
        save={onSave} // Called whenever the nodes or edges change
      />
    </div>
  );
}
```

The actual action is on another file:

```tsx
// app/design/actions.tsx
"use server";

import { prisma } from "@/lib/prisma";

export async function updateConversationTemplate(
  id: number,
  data: { nodes: any[]; edges: any[] }
) {
  await prisma.conversationTemplate.update({
    where: { id },
    data: {
      flow: data,
    },
    select: { id: true },
  });
}
```

The important part here is that the `Editor` component receives a callback prop `save` and takes care to call it whenever the nodes or edges change (actually, there's some debouncing that waits for 2 seconds of inactivity before saving, à la Google Docs, but that's an implementation detail). That callback goes to a function marked with `"use server"`, which simply calls the actual Server Action `updateConversationTemplate`, which in turn uses Prisma to save the changes to the DB.

## Connecting a database to Vercel's deployments: Supabase

Everything until now works fine on localhost, where we can just spin up a Postgres instance (actually, I used [a Supabase instance in Docker](https://supabase.com/docs/guides/self-hosting/docker), because Supabase has goodies and I wanted to use it). However, adding a database to the Vercel deployments is harder:

* The database must be accesible to wherever Vercel runs the app server. In practice, since Vercel runs a global network and what IPs they use is Not Your Concern&trade;, there is actually no way to know which IP your database will see, and thus no way to whitelist IPs. Indeed, [their docs](https://vercel.com/guides/how-to-allowlist-deployment-ip-address) explicitly say that your DB must allow connections from any IP address... or use [Vercel Secure Compute](https://vercel.com/docs/security/secure-compute) and splurge the requisite money
* If you want to have preview deployments (which are nice, as you get to play with new code versions before merging to master), you need two different databases
	* No, you can't use the same DB, even if you're OK with using the same data, because branches may change the DB schema (e.g., add columns). This means that you'd need to run the migrations, and then the production deployment could stop working, as it would expect the old schema. You absolutely need two separate DBs, or two schemas in the same DB, or any other way of isolating changes
* You need to run any migrations as part of the deployment

I haven't found any material covering these problems, so here are some notes that will hopefully be useful to other people running NextJS projects with Postgres DBs on Vercel.

### The DB provider

A note first: here we talk about actual companies that offer actual products that cost money. Don't trust anything I say here, as I just went with whatever was easier to set up and free. I haven't received any compensation (though you, the reader, have no way of verifying that...). My choices may be good for low-usage, yet increase in price very fast once you require more (indeed, that seems to be the story of Vercel).

While you can absolutely stand up a DB on, say, AWS or Google Cloud (and you probably should if you want to build a serious project), I didn't want to add an entirely new platform to this project.

Vercel does offer [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), currently in Beta. It "is a serverless SQL database designed to integrate with Vercel Functions and your frontend framework". In other words, it's a perfectly normal Postgres DB, which thanks to a partnership between Vercel and [Neon](https://neon.tech/), can be used from Vercel with almost zero configuration. Once provisioned, the connection string for the DB gets added as an environment variable to all Vercel deployments.

That takes care of creating a DB and accessing it from Vercel, but it's a single DB. The Vercel docs make no mention of multiple DBs (well, "Database branching is not currently supported, but will be in the future"). We can't really use that.

Instead, we'll use [Supabase](https://supabase.com/), "an open source Firebase alternative for building secure and performant Postgres backends". It's a managed Postgres database and has many more functions, such as an S3-style file storage server, serverless functions and a real-time server. However, we'll just use it for the free plan, since me likes free stuffs.

Creating a Supabase account is easy, if you use Github as a SSO provider. You don't even have to provide a password. You create a project, specify its region and confirm. By the way, don't be like me: when it asks you to generate a password, copy it first, since you won't see it ever again.

To isolate environments (staging/prod), we'll create different schemas. Supabase provides a normal SQL console where you can write SQL commands:

```sql
CREATE SCHEMA staging;
CREATE SCHEMA production;
```

Now, we have two (mostly) isolated DBs. We'll see why in a moment.

### Automatic migrations

Up until now, we have no way of applying the migrations on push. We can do that by overriding Vercel's command:

1. Visit the project's Settings in Vercel
2. On the General tab, find the "Build & Development Settings" section, then override the Build Command. By default, it'll be `next build`. Set it to `prisma generate && prisma migrate deploy && next build`. That will take care of running any non-applied migrations on every deployment

![445e06d68c1d78a02feba5ce5ad8fa16.png](./_resources/445e06d68c1d78a02feba5ce5ad8fa16.png)

That works because Prisma's migrations can be repeatedly applied. Prisma creates a DB table that holds every applied migration, and thus on most deployments no work will be performed.

That also means that, once a migration has been committed and pushed, you should never _ever_ delete it from the repository (which is a good idea anyways). Instead, you should generate a new migration which reverses the change.

We also need to change Prisma's settings. Normally, you want a "pooled connection" to the DB, especially from serverless processes such as Vercel's functions. This reduces connection load on the DB. However, the migration process can't work with that and needs a direct connection, which must be specified in the `schema.prisma` file:

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
  shadowDatabaseUrl = env("DIRECT_URL")
}
```

Then, one more change before deploying the change. We need to add the environment variables on Vercel's settings:

1. Visit the project's Settings in Vercel
2. Visit the Environment Variables tab
3. Add two new envvars, `DATABASE_URL` and `DIRECT_URL`. Ensure that you only tick a single checkbox, either Preview or Production. Fill with the appropriate connection strings. The `DATABASE_URL` is the same as the `DIRECT_URL`, except that (for Supabase) the `DATABASE_URL` is pooled and runs on a different server (6543), while the `DIRECT_URL` is unpooled and runs on the 5432 server of plain Postgres.
  ![d389f29da78e4661fe8d4300ec789cd0.png](./_resources/d389f29da78e4661fe8d4300ec789cd0.png)
4. Repeat for the other environment, changing the database URLs.

In the end, you should have four new environment variables, two for Preview and two for Production:

![38e4d2bc88f56f212ff6c6dd5f3a8451.png](./_resources/38e4d2bc88f56f212ff6c6dd5f3a8451.png)

Then, commit and push the changes to the `schema.prisma` file (in a branch), and wait for the build to finish. It should work:

![add99878fb70ebd63aca8b4ad5de5548.png](./_resources/add99878fb70ebd63aca8b4ad5de5548.png)

By the way, if you make commits that don't involve new migrations, the `prisma migrate deploy` will run anyways, though it will make no changes:

![bfde528b881d90b56cc87b5f42c351e8.png](./_resources/bfde528b881d90b56cc87b5f42c351e8.png)

This is good, since it means that we can just leave the migration command to run all the time, without having to manually migrate the DB whenever we know that there are changes. Such an approach wouldn't scale well.

And also, going to the Supabase dashboard, the `staging` branch should now contain tables (empty, but they're there!):

![20d6e163ff0aac5530047fa8aa1c9632.png](./_resources/20d6e163ff0aac5530047fa8aa1c9632.png)

### Testing!

We can visit the deployment's preview URL, and we indeed are greeted with the "empty UI" state:

![479d9706f9082d5f46f1f434b5871ed6.png](./_resources/479d9706f9082d5f46f1f434b5871ed6.png)

After creating a new Conversation, we can see it in the list:

![508b4141b711b3c069233eafac2c65b5.png](./_resources/508b4141b711b3c069233eafac2c65b5.png)

And it also appears in the Supabase explorer:

![777d7206b80b920248e4592a9ca05dfc.png](./_resources/777d7206b80b920248e4592a9ca05dfc.png)

And on Vercel's deployment logs, where we can check that indeed every visit to the List page fires off a `SELECT` query:

![85e6ced54b510961d8df2be60713a317.png](./_resources/85e6ced54b510961d8df2be60713a317.png)

Similarly, visiting a conversation's editor page triggers a `SELECT` for that record only:

![4f715daacebf15f6b1fdb2567df0076f.png](./_resources/4f715daacebf15f6b1fdb2567df0076f.png)

And saving changes (which happens automatically after you stop editing the conversation for two seconds) triggers an `UPDATE` statement:

![b4211a7acb6c9365c06f63c4e5e59166.png](./_resources/b4211a7acb6c9365c06f63c4e5e59166.png)

## Recap

In this article, we've added an actual DB to the OpenChatflow application, which is [now deployed on Vercel](https://openchatflow.vercel.app/). We've used [Supabase's hosted PostgreSQL server](https://supabase.com/) to store the data, and [the Prisma ORM](https://www.prisma.io/) to model and query it.

We've also handled the issue of multiple DBs for preview and production deployments, we've added automatic migrations for the database, and we've implemented a list view that (as of now) displays every conversation template in the DB, with no regards for user authentication.

