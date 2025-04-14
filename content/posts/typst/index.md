---
title: "Exploring Typst, a new typesetting system similar to LaTeX"
date: 2024-10-07T22:07:11-0500
summary: "In this article, we explore Typst, a new typesetting system similar to LaTeX. We explore its syntax, current uses and possible uses; we test its scripting system, which is incredibly powerful; we compare it with LaTeX, Markdown and Word, which can be used in similar roles; and we explore its applicability to the task of automatically generating documents from templates, such as in automatic invoice, certificate or report generation."
toc: true
---

Hello again! Today we'll review Typst ("[Ty like in Typesetting and pst like in hipster](https://github.com/typst/typst?tab=readme-ov-file#pronunciation-and-spelling)"), a language and tool to write text documents, usually PDF documents. This will be a very long article; it started small but then kept growing and growing.

Typst is similar in spirit and aims to LaTeX: it's a typesetting tool that can be used to write and generate documents, usually PDF files. It intends to be used in academic/scientific environments, much like LaTeX is nowadays. 

> Typst is a good choice for writing any long form text such as essays, articles, scientific papers, books, reports, and homework assignments. Moreover, Typst is a great fit for any documents containing mathematical notation, such as papers in the math, physics, and engineering fields. Finally, due to its strong styling and automation features, it is an excellent choice for any set of documents that share a common style, such as a book series.
> 
> https://typst.app/docs/tutorial/

Since this is the internet, we'll first start with The People's Source of Truth, Reddit&trade;. [Here's a thread on `/r/LaTeX`](https://www.reddit.com/r/LaTeX/comments/zyuyfc/has_anyone_tried_typst/), which you'd expect to be biased, if anything, towards LaTeX. And _holy cow isn't that the nicest, most civil Reddit thread in all of the universe_. Seriously. In the LaTeX community, talking about a LaTeX alternative. There's just one (1) rude comment. That's two years old, so some shortcomings mentioned there (e.g. introspection for counters, and the compiler not being open source) have already been solved.

In this article, we'll review Typst's syntax and compare it to LaTeX and Markdown. We'll see the manner in which Typst is normally used, and then we'll explore its applicability to a scenario that isn't mentioned in their docs: using Typst as a way to generate PDF reports, invoices and other similar documents that follow a template that must be filled with variable data.

A word: throughout this article I'll mention LaTeX as the comparison for Typst, even though LaTeX [is a collection of macros that uses TeX](https://tex.stackexchange.com/questions/49/what-is-the-difference-between-tex-and-latex) under the hood, and some properties (e.g. the layout algorithms used) are more properly predicated of TeX than of LaTeX. Yet other properties (e.g. the UI pattern of having the raw LaTeX file at the left of the screen and the rendered PDF at the right) are actually properties of the editing programs that handle LaTeX documents, not of LaTeX. In short, whenever you see LaTeX in this document, it may actually mean "something on the constellation of tools and programs in the vicinity of LaTeX", not necessarily LaTeX itself, because making all those distinctions may become confusing and provides no additional clarity for the purposes of this post.

## Showcase

Before starting, let's showcase some documents made in Typst. They may look similar to those that could be made in LaTeX, but that's the point: if it can come close to The Great LaTeX, that's a win! LaTeX has had several decades and tons of very smart people pouring tons of very smart work into it.

![the first page of a PDF paper, filled with placeholder text, showing a title, authors, an abstract, and two-column text with sections](https://typst.app/assets/docs/3-advanced-paper.png "A normal paper, styled with Typst")

![a set of equations](./_resources/eqn.png "Equations")

![a Python code block where some lines have been highlighted in different colors](./_resources/3bbacdff0ace9f15bb8e929c81beea01.png "Code blocks with syntax highlighting and annotations: https://typst.app/universe/package/codly")

![a song with lyrics and chords above the lyrics, plus the digitations for the corresponding guitar chords](https://raw.githubusercontent.com/typst/packages/main/packages/preview/conchord/0.2.0/examples/zombie.png "Songs with lyrics and chords: https://typst.app/universe/package/conchord")

![a dataflow diagram with an input, three processing steps and an output, joined with arrows of various styles](https://github.com/typst/packages/raw/main/packages/preview/fletcher/0.5.1/docs/gallery/io-flowchart.svg "Flowchart-style diagrams of boxes and arrows: https://typst.app/universe/package/fletcher")

![a set of slides in a PDF document, one slide per page](./_resources/slides.png "Slides for presentations: https://typst.app/universe/package/polylux")

![a Gantt chart with three sections and activities in each section](https://github.com/typst/packages/raw/main/packages/preview/timeliney/0.0.1/sample.png "Gantt charts: https://typst.app/universe/package/timeliney")

![a chess board](https://github.com/typst/packages/raw/main/packages/preview/board-n-pieces/0.5.0/examples/example-2.svg "Chess boards in FEN: https://typst.app/universe/package/board-n-pieces")

![a diagram of a network packet or similar, showing the use of each bit in the packet](https://github.com/jomaway/typst-bytefield/blob/main/docs/bytefield_example.png?raw=true "Bit-level packet diagrams: https://typst.app/universe/package/bytefield")

![a circuit diagram of a basic processor, showing the data path](https://github.com/typst/packages/raw/main/packages/preview/circuiteria/0.1.0/gallery/test.png "Block circuit diagrams: https://typst.app/universe/package/circuiteria")

![several keyboard shortcuts, displayed as rectangles that represent the key combinations](https://github.com/typst/packages/raw/main/packages/preview/keyle/0.2.0/test/test-3.png "Keyboard shortcuts: https://typst.app/universe/package/keyle")

![some integral approximations (Riemann sums) where the area under a curve is approximated by rectangles that go up to the curve](https://github.com/ThatOneCalculator/riesketcher/assets/44733677/4f87b750-e4be-4698-b650-74f4fe56789d "Displaying Riemann sums: https://typst.app/universe/package/riesketcher")

![two side-by-side versions of an exam, where one is unfilled and the other has the solutions](https://raw.githubusercontent.com/rangerjo/tutor/main/imgs/example_mod.png "Exams with and without solutions from the same source: https://typst.app/universe/package/tutor")

![a digital timing/waveform diagram, with a clock signal that toggles periodically, a bus that changes values, and a "wire" signal](https://github.com/typst/packages/raw/main/packages/preview/wavy/0.1.1/wavy.svg "Waveform diagrams: https://typst.app/universe/package/wavy")

![a checklist with multiple checks to be performed for a plane](https://github.com/TomVer99/Typst-checklist-template/blob/main/img/BN%20Islander-0.png?raw=true "Aviation-style checklists: https://typst.app/universe/package/aero-check")

![a CV with personal data, previous experience, education, skills, languages and other information](https://github.com/typst/packages/raw/main/packages/preview/grotesk-cv/0.1.2/thumbnail.png "One of many CV templates: https://typst.app/universe/package/grotesk-cv")

![an invoice with recipient information, a table of bought items, pricing and payment information](./_resources/invoice.png "Invoices: https://typst.app/universe/package/invoice-maker")

![a directed graph/tree layout](https://github.com/cetz-package/cetz/raw/master/gallery/tree.png "A directed tree, made with CetZ: https://github.com/cetz-package/cetz/blob/master/gallery/tree.typ")

![a badge/diploma for a participant in a congress, containing the person's name, some logos, and a QR code](https://forum.typst.app/uploads/default/original/1X/0fb27441c50538a2308003df4701a22f1e47b199.png "Badges/diplomas for participants in a university event: https://forum.typst.app/t/using-typst-for-event-badges/128")

## Introduction to Typst

Typst intends to be similar to LaTeX: it "[is designed to be as powerful as LaTeX while being much easier to learn and use](https://github.com/typst/typst?tab=readme-ov-file)". The constructs that it supports are the traditional ones in markup/typesetting systems, which are also similar to those of HTML and languages that compile to HTML, like Markdown: paragraphs of text, [headings in several levels](https://typst.app/docs/reference/model/heading/), [ordered](https://typst.app/docs/reference/model/enum/) and [unordered](https://typst.app/docs/reference/model/list/) lists, [bold](https://typst.app/docs/reference/model/strong/) and [italics](https://typst.app/docs/reference/model/emph/), [images](https://typst.app/docs/reference/visualize/image/), [tables](https://typst.app/docs/reference/model/table/), [footnotes](https://typst.app/docs/reference/model/footnote/), [hyperlinks](https://typst.app/docs/reference/model/link/), and such. 

It also has other elements that aren't too common in Web content (e.g. HTML and Markdown), yet very common in academic documents (i.e. LaTeX, and to a degree MS Word): [numbered images and tables](https://typst.app/docs/reference/model/figure/), [automatic cross-references](https://typst.app/docs/reference/model/ref/) to said numbered images, tables and headings; [bibliography](https://typst.app/docs/reference/model/bibliography/) and [citations](https://typst.app/docs/reference/model/cite/), a [table of contents](https://typst.app/docs/reference/model/outline/) that is automatically kept up-to-date, [tables of tables, images, equations or code blocks](https://typst.app/docs/reference/model/outline/#parameters-target), [different page sizes](https://typst.app/docs/reference/layout/page/#parameters-paper), [large amounts of math/equations symbols](https://typst.app/docs/reference/math/), the concept of a document's [author](https://typst.app/docs/reference/model/document/#parameters-author) and [creation date](https://typst.app/docs/reference/model/document/#parameters-date), and [a package ecosystem](https://typst.app/universe/) for things like [drawing stuff](https://typst.app/universe/package/cetz/) (the equivalent of [TikZ](https://www.overleaf.com/learn/latex/TikZ_package)) or [building presentation slides](https://typst.app/universe/package/polylux/) (the equivalent of [Beamer](https://www.overleaf.com/learn/latex/Beamer)).

In short, Typst intends to provide more or less the same elements as those provided by LaTeX. Many already exist, those that don't may be added later, since Typst is still a very young project.

## Typst, LaTeX and Markdown

The syntax of the Typst language is way closer to Markdown than it is to LaTeX. Compare Markdown:

```markdown
# A Sample Document

## Introduction

This is an introduction.

## Section One

* A
* B
* C

Figure 1 shows a figure. As can be seen, 
the figure depicts an image of a picture.

![Figure 1: Observe the image in the picture](image.jpg)

[This is a link](https://example.com)
```

Here's LaTeX:

```latex
\documentclass[12pt, a4paper]{article}

\usepackage{graphicx}
\usepackage{hyperref}

\title{A Sample Document}
\author{My Name}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}
This is an introduction.

\section{Section One}
\begin{itemize}
	\item{A}
	\item{B}
	\item{C}
\end{itemize}

Figure \ref{fig:figure} shows a figure. As can be seen, 
the figure depicts an image of a picture.

\begin{figure}[h]
    \centering
    \includegraphics[width=0.7\textwidth]{image}
    \caption{Observe the image in the picture}
    \label{fig:figure}
\end{figure}

\href{https://example.com}{This is a link}
\end{document}
```

And Typst:

```typst
= Introduction

This is an introduction.

= Section One

- A
- B
- C

@figure shows a figure. As can be seen, the figure depicts
an image of a picture.

#figure(
  image("image.jpg", width: 70%),
  caption: [
    Observe the image in the picture
  ],
) <figure>

#link("https://example.com")[This is a link]
```

Let's now compare Typst individually with LaTeX, Markdown and Word and similar editors.

### vs. LaTeX

As can be seen, Typst is much less verbose than LaTeX. For example, a heading isn't `\section{Title}`, but rather `= Title`, in the spirit of Markdown's `# Title`. Links aren't `\usepackage{hyperref}` and then `\href{https://example.com}{This is a link}`, but just `#link("https://example.com")[This is a link]`, again quite similar to Markdown. And so on. Typst relies much less on backslash-prefixed macros to write special elements, instead using dedicated syntax for the most common operations (for example, unordered lists, AKA bullet lists, use `-` for every entry. Numbered lists, on the other hand, use `+`. Headings use `=`s, one per level of the heading. Citations use `<tag>` to create the reference and `@tag` to refer to it. Bold and italics use `*content*` and `_content_`. Code uses `` `backticks` ``). 

Anything that doesn't have dedicated syntax uses "function calls", which are quite similar to a programming language's function calls. For example, to add a strikethrough:

```text
This is #strike[not] relevant.
```

whereas for LaTeX:

```latex
\usepackage{soul}

This is \st{relevant}
```

The function call syntax is much closer to LaTeX's macros, except that LaTeX backslashes are replaced by number/pound signs `#`, and arguments aren't provided inside curly braces, but inside regular parentheses and square brackets.

More complicated syntax, such as tables, also looks similar:

```text
#table(
  columns: 4,
  [], [Exam 1], [Exam 2], [Exam 3],

  [John],   N/A, A, N/A,
  [Mary],   N/A, A, A,
  [Robert], B,   A, B,
)
```

which generates something like this (after applying some styling that I don't show here for clarity):

![a picture of a table containing the data above](./_resources/styled_table.png)

In LaTeX, said table may look like this:

```latex
\begin{tabular}{|l|l|l|l|}
	\hline
	& Exam 1 & Exam 2 & Exam 3 \\
	\hline
	John & N/A & A & N/A \\
	\hline
	Mary & N/A & A & A \\
	\hline
	Robert & B & A & B \\
	\hline
\end{tabular}
```

Again, slightly similar. LaTeX's table may be slightly less clean, such as in the explicit newlines and column separators, and in the way in which presentation (namely, the `\hline`s) is mixed with the data (the actual content of the cells).

Typst can also read bibliographies [in BibLaTeX format](https://typst.app/docs/reference/model/bibliography/), which is nice because many tools (e.g. Google Scholar or Mendeley) can export references in that format. It can also use [Hayagriva](https://github.com/typst/hayagriva/blob/main/docs/file-format.md), another format (also developed by Typst themselves) based on YAML:

```yaml
harry:
    type: Book
    title: Harry Potter and the Order of the Phoenix
    author: Rowling, J. K.
    volume: 5
    page-total: 768
    date: 2003-06-21

electronic:
    type: Web
    title: Ishkur's Guide to Electronic Music
    serial-number: v2.5
    author: Ishkur
    url: http://www.techno.org/electronic-music-guide/
```

Citing references is done like this:

```text
@electronic states that electronic music is made by electrons.
```

Again, quite similar to LaTeX's `\cite{electronic}`. Unlike LaTeX, the exact same syntax is also used to insert cross-references: if you have, say, a table with a label `<table_label>`, you can also insert a reference to the table with `@table_label`. LaTeX uses distinct commands, `\cite{}` for citations and `\ref{}` for cross-references. Another difference is that LaTeX's references only insert the number (e.g. you'd write `Figure~\ref{fig:something} shows that ...`, and LaTeX would only substitute the number), while Typst references insert the entire name+number (i.e. you'd write `@fig_something shows that ...`, and the `@fig_something` reference would be replaced by `Figure 1` or something similar)

Equations are also supported (as you would expect of anything that even tries to play in the same league as LaTeX). Both inline equations (i.e. those that are typeset inside a paragraph, inside the normal flow of text) and block-mode (equations that are set in their own paragraph) are available:

```text
#set math.equation(numbering: "(1)")

It has always been known that, for physicists, $pi = 3$.

Proof:

$ 
  & pi = 3.14 \
  & 3.14 = 3 \
  therefore & pi = 3
$
```

![a screenshot of rendered text with the same content as the code block above](./_resources/f6b8eb53d4507d8e6e24f5398d7645b0.png)

For LaTeX:

```latex
\usepackage{amssymb}
\usepackage{amsmath}

It has always been known that, for physicists, $\pi = 3$.

Proof:

\begin{equation}
\begin{split}
	& \pi = 3.14 \\
	& 3.14 = 3 \\
	\therefore & \pi = 3
\end{split}
\end{equation}
```

generates this:

![a screenshot of rendered text with the same content as the code block above](./_resources/177ac92384e160dd70459d7728ebabd0.png)

Probably the biggest difference with equations is that, in Typst, symbols are inserted via normal words. Observe, for example, the `$pi = 3$` inline equation: `pi` is converted to the actual π symbol. (The dollar sign at the start isn't part of the `pi` symbol, it's the delimiter of the entire inline equation, much like in LaTeX). In LaTeX, symbols always require the backslash. The same thing happens with the three dots in a triangle that make up ∴ the _therefore_ symbol: LaTeX requires a backslash, while Typst doesn't. Just writing `pi` with no backslash in LaTeX would interpret it as the two variables `p` and `i`, which are typeset in italics. Typst only does that for single-letter words. Anything longer than that is interpreted [as a symbol](https://typst.app/docs/reference/symbols/sym/). To write actual sequences of variables (such as `ab > 0`, where `a` and `b` are multiplied), you leave a space between them: `a b > 0`. To write actual text, which shouldn't be composed of sequences of italicized letters, you wrap it in double quotes: `{ x | x "is positive" }`

![a screenshot of an equation with some words in normal (upright) font, generated in Typst](./_resources/4e6aa4c80e9c6ff7482505aeb75ae242.png)

LaTeX would do it like this:

```latex
\{ x \mid x \textrm{ is positive} \}
```

![a screenshot of an equation with some words in normal (upright) font, generated in LaTeX](./_resources/baea2122974af41901b3c3bd35d3ec2b.png)

### vs. Markdown

As we've seen, the most common syntax constructs in Typst look fairly close to Markdown. In particular, headings, bold&italics, links and lists (both ordered and unordered) use very minimal special characters, which aren't those of Markdown but fulfill the same purpose.

Nonetheless, Markdown and Typst are quite different in their aims. Markdown's intended destination is typically either Markdown itself (e.g. when you use Markdown to take notes, as is done in the [Obsidian](https://help.obsidian.md/Editing+and+formatting/Basic+formatting+syntax) and [Joplin](https://joplinapp.org/) note-taking applications, which store notes in Markdown) or HTML (as is done, for example, on [the READMEs that are included on Github repositories](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), or on some website generators [such as Hugo](https://gohugo.io/), in which this very blog is written, at least currently). Markdown's data model is therefore a restricted subset of HTML's available elements, with far less syntax (for example, a level 1 heading, `# Title`, is translated into `<h1>Title</h1>`. Images `![alt](link)` are translated into `<img src="link" alt="alt">`, [with no native control over sizes](https://www.markdownguide.org/hacks/#image-size)).

In other words, Markdown is a product of the age of the Web and works with and for the Web. Things that don't appear normally on web pages won't appear on Markdown either. This means things like [a table of contents](https://www.markdownguide.org/hacks/#table-of-contents), [underlined text](https://www.markdownguide.org/hacks/#underline) (which in the Web means almost exclusively a hyperlink, and so shouldn't be exposed for people to use on things that aren't hyperlinks), equations, citations, the concept of a "document author", or cross-references to other parts of the document (though most Markdown processors do support [cross-linking](https://www.markdownguide.org/extended-syntax/#heading-ids), just not automatically inserting text like "Section 2.1" where the number is the correct one for the link's destination).

Being Web-focused, Markdown's documents also like to live on a single vertically-infinite page (web pages don't usually have page breaks).

Typst and LaTeX, by contrast, operate on the world of PDF documents composed of a certain number of rectangular pages, perhaps numbered. In Markdown you'll never find a setting to set the page size to A4... because on the Web that makes no sense! Same goes for margins, page numbers, adding the current section at "the top of each page", per-page headers and footers, anything to do with odd vs. even pages (e.g. aligning the page number to the right or to the left, or having asymmetric margins for bookbinding at the left edge), leaving blank pages as necessary so chapters always start on the right side when a book is printed, or prevention of [widows and orphans](https://en.wikipedia.org/wiki/Widows_and_orphans) (i.e. very short one-or-two-lines paragraphs that are left at the top and bottom of a page, respectively).

All of those, however, are provided by LaTeX and Typst. In short: if your document will become a PDF with separate pages, and it isn't just a cascade of text and images (which could just be dumped to pages as they come, breaking when the page runs out of space), Markdown isn't as useful, since it doesn't provide page-aware features.

Furthermore, Markdown doesn't have built-in support for some features that are used (and arguably vital) in academic/scientific documents:

* Citations and bibliography
* Cross-references (e.g. referring to Table 1, Figure 2, or Section 3.4 in other parts of the text)
* Equations (some tools, such as Hugo, do [support equations](https://gohugo.io/content-management/mathematics/), but that is not Markdown's concern: it's handled [elsewhere](https://www.mathjax.org/), with Markdown just ignoring all that content)
* Captioned images. Markdown's images, `![alt text](link)`, are just rendered as `<img>` elements. That can again [be added](https://adityanaik.dev/blog/2022/04/23/links-images-captions-quotes-and-iframes-in-a-hugo-blog/#image-handling-and-adding-a-caption), but it's beyond Markdown itself
* Captioned tables, necessary for cross-referencing said tables
* [Any way of styling content](https://www.markdownguide.org/hacks/#color), at least directly on Markdown. For instance, it isn't possible to have a certain word colored red. If converting the Markdown document to HTML, it is sometimes possible to use the Markdown rendering tool to [provide a CSS file](https://pandoc.org/MANUAL.html#option--css) that will style the resulting output. In particular, Markdown provides no facilities to have all section titles be in Arial 12 point bold _al dente_ typeface, which may be required by the journal to which you want to submit your awesome paper

Note that all of these could be manually added. For example, a citation can be typed out literally, such as `See [2] for a review of available methods...` (like, the _literal_ 2 surrounded in literal brackets), and then at the end a `# Bibliography` section could be added, where each reference is manually written, including the number that it was assigned, the authors, the title, the journal, and whatever else. Of course, the minute another reference is added it may be necessary to reshuffle all existing references (since some reference styles mandate that references be sorted on the first author's last name or something), and all citations to reshuffled references need to be updated too. Image captions can be added, for example, by wrapping the image in a two-row table, where the top row contains the image and the bottom row says literally `Figure 1: A Title For The Image`. That can't be done for tables, but it would be possible to just insert the table caption as a lone paragraph just above or below the table. And then "cross-references" can be the literal words `Figure 1 shows that ...`. Of course, once again, if another figure or table needs to be inserted between two others, it'd cause the numbering of all later entries to change, thereby requiring that all references to those elements be changed too.

Equations and content styling are simply outside of Markdown's purview. They can be handled elsewhere, in the surrouding application that parses the Markdown document and renders something else, typically HTML, or PDF with HTML as an intermediate step (converting an HTML document to PDF is fairly mechanical, by using an HTML rendering engine such [as those found in browsers](https://help.syncfusion.com/document-processing/pdf/conversions/html-to-pdf/net/blink) or [Qt's WebKit engine](https://wkhtmltopdf.org/))

In general, the issue (which is only an issue when trying to use it as a LaTeX replacement. Markdown is plenty good for what it does) with Markdown is that it doesn't operate at the abstraction level (and, therefore, with the concepts) of "research paper". It operates at the level of "text document". In the land of text documents, the important entities are paragraphs, sentences, headings, images, lists, tables, hyperlinks and such. The land of research papers is also concerned with references, figures, tables of contents, and more. Note that the higher-level concepts that are found in scientific papers are actually composed of lower-level concepts: a citation is actually just a hyperlink, that displays a bit of text, but it embodies some additional ideas, such a specific format (e.g. `[1]` for IEEE-style citations), the fact that its hyperlink goes to another location in the document (namely, the corresponding entry in the references list), and the ability to change automatically when its corresponding reference is reordered. 

In a similar way, a paper's figures are a raw image (a rectangle filled with colored pixels) + some text (the caption), but there are additional constraints placed upon it: the image and the text are part of the same entity, such that they move as a unit (i.e. no decent typesetting system will place the image at the end of a page and its caption at the start of the next one, but instead place both elements together on one page or the other), the fact that the provided caption will be automatically prefixed with something like `Figure 1: `, the automatically-increasing counter for images (which, by the way, is separate from similar counters that may be used for section names, tables, code blocks and other enumerated elements), and the ability to create references to that element that automatically get replaced with the figure's current number. 

A table of contents is similarly composed of lines of text, but they aren't any random lines of text: a table of contents gets its data from the headings/section names that are defined elsewhere in a document, and presents them in order, maybe preserving their hierarchy (e.g. subsections are presented indented relative to their parent section), where each entry may have its page number (which, again, is a PDF-specific concept that makes no sense in the Web, where each page is on an infinitely tall container) displayed at the right side, with a character (e.g. dots `.`) filling the space between the end of the title and the page number. All of these features could be manually typed from text lines, but the higher-level concept of a table of contents implies all those constraints already, freeing the author from the work of keeping the table well-formed. This is arguably one of the biggest reasons for the existence of tools that focus on papers and similar documents: they provide higher-level concepts directly in the language.

### vs. Word, Google Docs and text processors

Of course, whoever doesn't write papers in LaTeX most likely writes them in Word or other equivalent text processor[[citation needed]](https://xkcd.com/285/). Word has the advantage that it's probably one of the most well-known pieces of (desktop) software in the world (surprisingly, there appears to be no easily-found chart of the most common applications in a desktop environment!). It now has multi-user simultaneous editing too, via Office's cloud subscription plans (which is called Office 365, I think?), which is useful for collaborative editing.

There's also [Google Docs](https://docs.google.com/), part of Google's suite of "office tools". It links everything to your Google account, whereas Word does so to your Microsoft account (if you want to. Word also works with no connection to the mothership... _for now_. Looking at you, [Windows 11](https://www.tomshardware.com/how-to/install-windows-11-without-microsoft-account)!). As a web-first application (as opposed to Word, which was born when the Web wasn't a thing, and is therefore a child of the desktop age), Google Docs is exclusively accessed through a browser (ignoring browsers-in-disguise such as PWAs, which I couldn't verify are used by Google Docs). Features such as cloud saving and collaboration come built-in with Google Docs. The interface is also different to that of Word: Word uses [the ribbon](https://support.microsoft.com/en-us/office/customize-the-ribbon-in-word-c4b6051a-7a70-43c8-a527-932917dec682), whereas Google Docs uses the more traditional [menu bar](https://edu.gcfglobal.org/en/googledocuments/getting-started-with-your-document/1/) with dropdown menus, plus right-click contextual menus. Google Docs therefore allocates more screen space to the document itself.

And then there's everyone else: [LibreOffice](https://www.libreoffice.org/) (bundled with Ubuntu), [OpenOffice](https://www.openoffice.org/) ([from which LibreOffice was forked](https://en.wikipedia.org/wiki/LibreOffice#History), way back in 2010), [OnlyOffice](https://www.onlyoffice.com/), [WPS Office](https://www.wps.com/), [Apple Pages](https://support.apple.com/pages), and probably a bazillion more.

All of these apps have something in common: they're [WYSIWYG](https://en.wikipedia.org/wiki/WYSIWYG) text/word processors, AKA "awhat you see is what you get", AKA you edit a document that has the same appearance as the final document:

> WYSIWYG was a great advance over earlier interactions, in which users specified their goals more abstractly and didn't see the results until far later. To make text bold in a WYSIWYG interface, for example, you highlight the text with the mouse and choose the "Bold" command from a formatting menu. Easy. And, even more important, as soon as you choose the formatting command, the document's screen appearance changes to reflect the new formatting. At any given time, what you see on the screen is what you've built and what you'll get if you print it.
> 
> Jakob Nielsen, https://www.nngroup.com/articles/rip-wysiwyg/

This is as opposed to LaTeX, where, say, bolding text is done by surrounding it with `\textbf{...}` in the source (plaintext) document, and then observing the change in the rendered PDF; Typst and Markdown, where it is done by surrounding it with `*...*`; or HTML, where it's done by surrounding it with `<b>...</b>`. In all of those cases, formatting of the text is performed by adding more text around it: formatting isn't a magical property, but more text near (usually around) the "target" text. On the other hand, on Word, Google Docs and such, formatting lives on a different realm, "superimposed over" the content as it were, rather than alongside it.

This means that WYSIWYG editors are easier for people to grasp, since the performed operations are immediately reflected in-place, rather than being instructions to a build process that generates another document.

On the other hand, since styling is applied on top of the content, it's usually more difficult to globally apply styles, absent a way to declare "styles" that are later applied to the "content". To be fair, [Word](https://support.microsoft.com/en-us/office/customize-or-create-new-styles-d38d6e47-f6fc-48eb-a607-1eb120dec563), [Google Docs](https://support.google.com/docs/thread/29527841/creating-a-new-style?hl=en), [LibreOffice](https://books.libreoffice.org/en/GS73/GS7303-StylesAndTemplates.html#toc6) and everyone else do support styles, i.e. a set of properties (such as font size, color, line spacing, whether or not the content is numbered, indentation, alignment, and more) that can then be applied to multiple parts of the content at once. For example, in a Word document, most content would probably be in the Normal style, which is the standard boring text. Section titles may be in Heading 1, subsections in Heading 2, the title of the whole document in Title, and so on. In fact, you can usually spot a Word document because section titles are in the traditional light blue of Heading 1 (or 2, or 3):

![a screenshot of Word's ribbon showing the style list](https://support.content.office.net/en-us/media/aba917d3-4fab-4697-829d-a3e5065162be.png)

However, the fact that those styles are optional means that you are free to ignore them and apply changes to pieces of the document itself. Need some more spacing between lines? Rather than editing the Normal style, most people will likely Ctrl+A to select the entire document (or, more likely, go to the start of the document, click there, and then drag to the bottom), then change the spacing. This will apply the new setting to everything that exists already, and then Word will keep applying the same style to any new paragraphs that are inserted by pressing Enter...

Until it doesn't, that is, and for some reason one paragraph picks up the original line spacing again. Or you paste some content from a web page and it carries over its own formatting, and you click the Clear Formatting button to delete it, and your custom spacing gets lost too.

And there's also the issue that a style applied via... well, a Style, is indistinguishable from one applied manually, by virtue of these applications being WYSIWYG. That's the whole point! In other words, these two lines look the same:

![a screenshot of a text document with two lines that look the same, but the second one doesn't have the same style applied as the first one](./_resources/e39715cd7a207fe2e8244d9a666107a5.png)

The second line was manually styled to match the Title style. But it doesn't _have_ the Title style, it's just a Body Text. And if we changed the Title style, that second line wouldn't have the changes applied: as far as the editor is concerned, it's a piece of normal text. And there's no way to detect that except for clicking on each piece of text that looks like it has the style applied, and checking if it actually does. 

Also, there are the minor annoyances with graphical tools: ever tried to enter thirty references in Word? At least back when I used to write papers, it was a very boring task: open the References dialog, click New, choose a type of reference, then manually click and fill several text fields, then click Save, then repeat it all over for the other twenty-nine references. The root cause of that is that point-and-clicking is slower than copy-pasting text, and Word doesn't have something like a textual representation of a template. By contrast, Google Scholar (and probably other sites that produce bibliography) can very easily provide a way to import a reference into LaTeX:

![a screenshot of Google Scholar showing the Cite menu of a reference, which has an option to copy the BibTeX-formatted reference](./_resources/cf006702ba6e3489297a1371b5d10011.png)

The actual reference is a piece of plain text that can be copied into a clipboard, passed around through an email or text message, and pasted into a file. Try doing that with a Word reference:

```
@book{vulis1992modern,
  title={Modern TEX and its Applications},
  author={Vulis, Michael},
  year={1992},
  publisher={CRC Press}
}
```

Or have you ever found a numbered list that is composed of literal numbers at the start? Word tries very hard to identify things that look like the start of a numbered list and turns them into actual numbered lists, but it may fail if someone uses a non-recognized format. Such lists would look mostly like real numbered lists, except that they have none of the list-specific features: no auto-incrementing number, no automatic indentation, no adding child lists that use a different numbering style (e.g. the main list using 1., 2., 3. and the sublist using a., b., c.). Have you found a section heading that was manually styled? Or an image that was manually captioned? Or (_shudder_) a manually written reference list? Or a manually written and painstakingly maintained table of contents? Or one that, while automatically created, is out of sync with the actual document? All of these are things that can happen with a general-purpose text processor that isn't operating at the abstraction level of "this is the heading of a section", but just at "this is a line of text". 

And let's not forget that, not being typesetting systems, Word and company don't usually have the fancier typesetting features. Have you ever had to go to the start of a paragraph and manually press Enter a couple of times, just to make that paragraph start at the start of the next page (or, if you were really fancy, Ctrl+Enter to insert a page break)? That's Word not trying to prevent widows and orphans. Ever had one of those justified paragraphs [where a line has huge spaces between words](https://www.datanumen.com/blogs/5-ways-not-stretch-last-line-justified-paragraph/), for some reason? That's a less-than-ideal justification algorithm being used. [Ligatures (e.g. between the _f_ and the _i_ in the word "official")](https://en.wikipedia.org/wiki/Ligature_(writing)#Computer_typesetting) aren't used in Word by default, as far as I'm aware. [A large list of differences, written from the perspective of a LaTeX enjoyer, is here](https://nitens.org/w/latex/) (though keep in mind that it's fairly old, circa 2008, and Word especially is liable to have changed a lot in the meantime. LaTeX is more stable and should have changed less). To be sure, most of those are very small changes, probably only perceivable if you _really_ like fonts or when seeing them side-by-side, but still.

Text processors typically use an opaque-ish data format as the backing store for the document (for example, Word's DOCX documents [are actually ZIP files in disguise](https://docs.fileformat.com/word-processing/docx/#docx-file-format-specifications---more-information), filled with XML documents). This means that they aren't really amenable to automation, or in other words, automatically generating documents with variable information, in the style of a template (for example, an automatic letter that always starts with "Dear &lt;name&gt;"). There are tools to do so, to be sure, [many](https://carbone.io/) [of](https://docxtemplater.com/) [them](https://jsreport.net/learn/docx) [in](https://www.docmosis.com/how-it-works/) [fact](https://templater.info/), but they all have to fight _against_ the DOCX data model. For example, consider [this tool](https://templater.info/), which lets you insert variable data in a document by surrounding it with double square brackets, `[[variable]]`:

![a screenshot of Word showing the replacement of a tag](https://templater.info/images/my-document-example/a+bath-300.png)

In [their documentation](https://templater.info/user-manual) they have the following paragraphs:

> On surface Templater looks just like a mail merge solution. You can put tags on specific places in the document and replace them later with actual values. One could wonder why a library would even be required for that, as OOXML is just a ZIP file with an XML files which can be easily edited/manipulated.
> 
> But even in such a simple use case there are obstacles, as Word tends to split text into paragraphs so even a simple text such as [[TAG]] often looks like
> 
> ```xml
> <w:r w:rsidRPr="00A42204">
>   <w:rPr>
>     <w:lang w:val="en-US"/>
>   </w:rPr>
>   <w:t>[[</w:t>
> </w:r>
> <w:proofErr w:type="spellStart"/>
> <w:r w:rsidRPr="00A42204">
>   <w:rPr>
>     <w:lang w:val="en-US"/>
>   </w:rPr>
>   <w:t>TAG</w:t>
> </w:r>
> <w:proofErr w:type="spellEnd"/>
> <w:r w:rsidRPr="00A42204">
>   <w:rPr>
>     <w:lang w:val="en-US"/>
>   </w:rPr>
>   <w:t xml:space="preserve">]] </w:t>
> </w:r>
>```
>
> which contains various "useless" Word specific information not really relevant for the original [[TAG]] text. There are also various Word specific rules such as **xml:space="preserve"** which must be respected during processing.
> 
> Once tables and lists start to get used, replacing a tag is no longer: *"just locate and replace tag value in XML"*. With the addition of images, special Word objects, such as charts which are implemented as an embedded Excel file within the Word zip changing tags requires extensive knowledge of the Word behavior, format and rules. Therefore, a library which copes with those adjustments can be of quite a big help to the developer, even if his is quite familiar with the OOXML format.

Oof. When even simple words aren't preserved in the source XML document, things get really nasty. Naïve text replacement or the traditional text templating engines that are used, for example, on server-side HTML frameworks (e.g. [Jinja](https://jinja.palletsprojects.com/en/3.1.x/templates/#synopsis) or [Go's `text/template`](https://pkg.go.dev/text/template)) don't work on those XML documents, because they rely on special markers (typically `{{ some_var }}` or something to that effect), which, as we've seen above, Word breaks into different XML elements so the literal content `{{ ... }}` doesn't appear anywhere in the XML. And that's before we start with repetitions (say you want to render a list of items into a bullet list), conditional formatting (e.g. coloring some items in the list red or conditionally bold them), tables (where you may want to [repeat a row](https://carbone.io/documentation.html#repetitions) several times), inserting images or charts (which involve an entire embedded Excel document which contains the data that feeds the table), trying to add data (e.g. today's date) in a header, adding variable data as a watermark, or other more advanced replacements, then things get ugly fast.

By contrast, tools like LaTeX or Typst, where the source data is a plain text file, play very nicely with templating tools. There's no mysterious syntax that is added behind the scenes. Therefore, including automatic data in a document is fairly easy to do: we could just use any text templating engine to insert the requisite tags and/or directives in the LaTeX/Typst document, then render with the engine to generate a LaTeX/Typst document, then render _that_ document with TeX or Typst respectively to generate a PDF document. The key here is that since the source documents are plain text, there are many tools that can process them, unlike the weird XML documents of Word.

We'll see more examples of templating documents with Typst in a later section.

Generating reports or other automatic documents starting from a Typst or LaTeX template has the issue that they render into PDF. This means that the output is already set in stone, more or less. There are ways of editing PDF documents ([Word can](https://edu.gcfglobal.org/en/word2013/editing-pdf-files/1/), at the possible cost of some formatting; and there's also [Adobe Acrobat](https://www.adobe.com/acrobat.html), not the Reader version, which can do so starting at the low cost of $12.99 per month, about $150 per year), but they're unwieldy and/or paid. Thus, there's no easy way to pre-render most of the document, perhaps the boring parts that are always the same or can be filled directly from some data source, and then present the half-filled document to a person for the final touches to be added or corrections to be made. Tools that template Word documents [can usually take a Word document and output another Word document](https://carbone.io/documentation.html#quickstart-carbone-js), which is much easier for people to edit afterwards; they don't freeze their output in a difficult-to-edit PDF.

To recap: text/word processors like Word or Google Docs are a different kind of beast to typesetting systems like LaTeX or Typst. They're much more general, yet operate at a lower level of abstraction (by need of being more general). The mixing of styling and content, which is natural to WYSIWYG editors, means that there are more opportunities for styles or content patterns to drift out of sync across a document or across several documents. LaTeX and Typst (and HTML, for that matter) have a level of "semantic" annotation, meaning that it's not "this line is Arial 14, bolded, left-justified, with two levels of numbering"; but instead "this line has whatever styling is applied to subsection headings", which is a higher-level concept. Furthermore, since DOCX documents carry the document's raw information in XML files, it's fairly difficult to use them as templates from which documents are rendered with variable information, unlike plain-text-based formats such as Markdown, HTML, LaTeX and Typst where such templating is fairly easy to perform.

Finally, can Word [do this](https://github.com/liantze/AltaCV) (showing little circles for the competency level of several languages in a CV)?

```latex
\cvsection{Languages}
\cvskill{English}{5}
\divider
\cvskill{Spanish}{4}
\divider
\cvskill{German}{3.5}
```

![a screenshot of part of a CV showing several languages and a "skill level" from 1 to 5, displayed as filled or empty circles](./_resources/f672d6c165c6014411bb84f8ed5a8fa2.png)

Or [this](https://www.ctan.org/pkg/menukeys) (displaying key presses, such as in a software manual, in little boxes)?

```latex
This is some more or less blind text, 
to demonstrate how the sequence looks 
in text. This \keys{\ctrl+\alt+Q} is 
the result of a style which name...
```

![a screenshot of a PDF document where a sequence of keys is displayed with the keys surrounded in little boxes that simulate keycaps](./_resources/8366882151d8a87fb58f3306f2c12b23.png)

Or [this](https://www.baeldung.com/cs/latex-drawing-graphs) (drawing graphs directly in the document)?

```latex
\begin{tikzpicture}[node distance={15mm}, thick, main/.style = {draw, circle}] 
\node[main] (1) {$x_1$}; 
\node[main] (2) [above right of=1] {$x_2$}; 
\node[main] (3) [below right of=1] {$x_3$}; 
\node[main] (4) [above right of=3] {$x_4$}; 
\node[main] (5) [above right of=4] {$x_5$}; 
\node[main] (6) [below right of=4] {$x_6$}; 
\draw[->] (1) -- (2); 
\draw[->] (1) -- (3); 
\draw (1) to [out=135,in=90,looseness=1.5] (5); 
\draw (1) to [out=180,in=270,looseness=5] (1); 
\draw (2) -- (4); 
\draw (3) -- (4); 
\draw (5) -- (4); 
\draw[->] (5) to [out=315, in=315, looseness=2.5] (3); 
\draw[->] (6) -- node[midway, above right, sloped, pos=1] {+1} (4); 
\end{tikzpicture} 
```

![a picture of a graph with several circular nodes joined with arrows and lines. Each node has a name from x1 to x6](./_resources/36edc3c6700ed83e8bca543461db89c9.png)

Or, my personal favorite, [this](https://www.ctan.org/pkg/songbook)? It's a package to write songbooks, with lyrics and chords, complete with such fancy tools as [replaying a verse's sequence of chords on the next verses](https://songs.sourceforge.net/songsdoc/songs.html#sec5.4), showing [parts that should be echoed](https://songs.sourceforge.net/songsdoc/songs.html#sec5.6), [notes to the musicians](https://songs.sourceforge.net/songsdoc/songs.html#sec5.8) that don't appear on the singer's books, [guitar tablatures](https://songs.sourceforge.net/songsdoc/songs.html#sec6), [automatic transposition](https://songs.sourceforge.net/songsdoc/songs.html#sec7), [smart enharmonics](https://songs.sourceforge.net/songsdoc/songs.html#sec7.0.0.1) (i.e. whether a certain chord should be displayed as B♭ or A♯, which are technically the same sound. Which one to choose depends on the song's key, usually dictated by the song's first chord), [quotations from the Bible](https://songs.sourceforge.net/songsdoc/songs.html#sec8.2), [automatic indices](https://songs.sourceforge.net/songsdoc/songs.html#sec10) (by title, by author, by Bible reference, by notable lyrics such as the first line), and [the ability to create books with and without chords](https://songs.sourceforge.net/songsdoc/songs.html#sec4.0.0.1) (for the musicians and for the singers respectively) from the same source document.

```latex
\songsection{Worship Songs}

\begin{songs}{}
\beginsong{Doxology}[by={Louis Bourgeois and Thomas Ken},
                     sr={Revelation 5:13},
                     cr={Public domain.},
                     index={Praise God, from Whom all blessings flow}]
\transpose{2}
\beginverse
\[G]Praise God, \[D]from \[Em]Whom \[Bm]all \[Em]bless\[D]ings \[G]flow;
\[G]Praise Him, all \[D]crea\[Em]tures \[C]here \[G]be\[D]low;
\[Em]Praise \[D]Him \[G]a\[D]bove, \[G]ye \[C]heav'n\[D]ly \[Em]host;
\[G]Praise Fa\[Em]ther, \[D]Son, \[Am]and \[G/B G/C]Ho\[D]ly \[G]Ghost.
\[C]A\[G]men.
\endverse
\endsong
\end{songs}
```

![a screenshot of a PDF document containing a song with chords placed in the correct places in the song's lyrics](./_resources/7cf654add475e8a8ea281a0631f644f4.png)

Or, finally, can Word do [ducks](https://ctan.org/pkg/tikzducks)? [Many ducks](https://github.com/samcarter/tikzducks?tab=readme-ov-file#examples)? Tons of ducks?

```latex
\begin{tikzpicture}[scale=0.6]
\duck
\duck[xshift=90pt, scale=.3, yshift=150pt]
\duck[xshift=60pt, scale=.3, yshift=100pt]
\duck[body=gray!50!white, head=gray!50!white,
xshift=80pt, scale=.3, yshift=50pt]
\end{tikzpicture}
```

![a picture of four ducks, a large yellow one, two small yellow ones following the large duck, and a small gray duck also following the large one](./_resources/e4680717b1e1fe86c7e2df70461a5e61.png)

To be fair, all of these were done in LaTeX, not in Typst, but the point was to compare to Word. Word doesn't do any of those (maybe with macros, but hopefully we've agreed, as a species, on the fact that [macros are evil](https://en.wikipedia.org/wiki/Macro_virus)). Typst, being similar to LaTeX in capabilities, should at least in theory be able to do all of that. For example, all the graphical examples (namely, the circles for the language competency, the fancy keystrokes, the graph with arrows, and the ducks) use [TikZ](https://en.wikipedia.org/wiki/PGF/TikZ) in LaTeX. Typst already has [`cetz`](https://typst.app/universe/package/cetz), "a library for drawing with Typst with an API inspired by TikZ". It should allow users to do similar things (otherwise, contributions are probably welcome). For the songbook, [there's already `conchord`](https://typst.app/universe/package/conchord) [and `chordx`](https://github.com/ljgago/typst-chords?tab=readme-ov-file#single-chords), both of which already typeset chords over lyrics. There's also Typst packages [for drawing diagrams made of nodes and arrows](https://typst.app/universe/package/fletcher) à la [Graphviz](https://graphviz.org/)/[DOT](https://graphviz.org/doc/info/lang.html), [timing/signal diagrams](https://typst.app/universe/package/physica), [quantum circuits](https://typst.app/universe/package/quill), [slides](https://typst.app/universe/package/polylux) à la [Beamer](https://www.overleaf.com/learn/latex/Beamer), [Gantt charts](https://typst.app/universe/package/timeliney), [units for physical quantities](https://typst.app/universe/package/unify), [chess boards](https://typst.app/universe/package/board-n-pieces) (including Forsyth–Edwards Notation), [chemical formulae](https://github.com/jamesrswift/typst-chem-par), [calendars with events](https://typst.app/universe/package/cineca), [TODOs or editor's notes or comments at the sides of the content](https://typst.app/universe/package/dashy-todo), [fractals](https://typst.app/universe/package/fractusist), [genealogical trees](https://typst.app/universe/package/genealotree), [color-matched parentheses](https://typst.app/universe/package/iridis), [Karnaugh maps](https://typst.app/universe/package/k-mapper), [Tetris screens](https://typst.app/universe/package/mino), [multiple types of diagrams](https://typst.app/universe/package/pintorita), [Riemann sums](https://typst.app/universe/package/riesketcher), [chip pinout diagrams](https://typst.app/universe/package/salsa-dip), [exams](https://typst.app/universe/package/tutor), [truth tables](https://typst.app/universe/package/truthfy) (automatically filled!), [more timing diagrams](https://typst.app/universe/package/wavy), and more.

## Styling documents

Styling in Typst uses an approach that I hadn't seen before, which they call [set rules and show rules](https://typst.app/docs/reference/styling/). Set rules behave somewhat like CSS, in that a set rule specifies a certain type of element that will be affected by it, and some parameters (e.g. that element's color, size, position or alignment) can be controlled. However, unlike CSS, set rules can be applied in the middle of a document (they only take effect from the point that they're encountered). Their "selector" capability is also much less powerful than that of CSS, as a set rule only targets one type of element (then again, different elements have entirely different settings, so being able to target multiple elements at once isn't that useful).

Set and show rules are what Typst packages use to control the appearance of documents. They're what differentiates an IEEE-style paper from a book from a leaflet from a 16th-century-style book. They control the appearance of headings (font family and size, indentation, numbering style), paragraphs (font family and size, spacing), tables (the style of headings, cells, borders and more), pages (size, margins, columns, binding style, numbering, header, footer), figures (the numbering style and naming convention), and more. All those very detailed conventions that a certain conference, journal or book may want your document to follow are converted to set rules.

A simple set rule looks like this:

```typst
= Unstyled introduction
This title hasn't had the new style applied yet

#set heading(numbering: "1.")

= Introduction
The set rule above was applied to the title
```

![a screenshot of a PDF document showing two titles, one with no number and one with a number. A set rule between the two titles causes the second one to have a number](./_resources/58c602ad2f69d7c158647486490e64ab.png)

As discussed above, set rules take effect from the moment they're declared until the end of the document (or containing block, if they're declared inside some sort of block). Here we [configured the `numbering` parameter of the `heading(...)` function](https://typst.app/docs/reference/model/heading/#parameters-numbering), which is what `= Title` headings end up as. We specified that headings should be numbered with arabic numberals, and the second heading had that new style applied.

In general, set rules can modify anything that the element in question exposes as a parameter. Recall that, in Typst, every element (yes, including plain text) is actually a function call. For example, `= Title` is secretly a `heading(level: 1, "Title")`. `- Element` (in the context of an unordered list) is [an element inside an `enum`'s last variadic argument](https://typst.app/docs/reference/model/enum/). A citation, inserted with `@citation_key`, is actually [a call to `cite(label("citation_key"))`](https://typst.app/docs/reference/model/cite/).

Therefore, since every part of the text is a function, and every function has some configurable parameters, set rules can control aspects of each element. For example, [headings can have their numbering style controlled, as well as whether or not they appear in the table of contents](https://typst.app/docs/reference/model/heading/#parameters). Other functions have other parameters, such as [the `text(...)` function](https://typst.app/docs/reference/text/text/), which has [a ton of parameters](https://typst.app/docs/reference/text/text/#parameters) that control the appearance of that bit of text: the font, weight, size, fill color, stroke color, spacing (between characters, words and lines), language, direction (left-to-right or right-to-left), whether to request the character that adds a slash across the zero, and more.

For an example, observe [the `charged-ieee` template](https://typst.app/universe/package/charged-ieee), which implements styling to conform to the IEEE conferences and journals guidelines. The template [is open source](https://github.com/typst/templates/tree/main/charged-ieee), under a variant of the MIT license that requires no attribution. As can be seen in the template's source code, [the largest amount of the template's code](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L31-L183) is devoted to set rules that configure various aspects of the document: there's [font family and size](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L34), the [styles for numbered lists](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L37) (first level is "1)", second level is "a)" and third level is "i)"), [styling for table's captions](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L41-L44), [styling for images](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L469), [margins and page size](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L53-L65), [equation numbering](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L68-L69), [heading numbering](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L90) (sections are "I.", subsections are "A.", and sub-sub-sections are "a."), [font size for the bibliography](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L137), [two-column mode](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L181), and finally [the content](https://github.com/typst/templates/blob/fd8fd73a825bef6e7fbc85f0dc9eac43b67c5715/charged-ieee/lib.typ#L197). While it's been a while since I've had to write a paper in IEEE format, I'm fairly sure that all those set rules have a more-or-less direct correspondence with the IEEE guidelines.

Typst's set rules can also target with more granularity than entire functions, by [using `where(...)` to compose more precise selectors](https://typst.app/docs/reference/foundations/selector/). For example, let's say that we wanted to target only second-level headings (i.e. `== Title` but not `= Title` or `=== Title`). This would be expressed in a show-set rule as:

```typst
#show heading.where(level: 2): set heading(numbering: "1.")
```

![a screenshot of a PDF with three titles, one of level 1, one of level 2, and one of level 3. Only the level 2 title has a number](./_resources/aec592ea10b72ca295fb690f80ed0b8a.png)

Only the second-level heading gets the numbering applied.

The last rule was an example of a show-set rule: rather than being applied to each instance of the `heading(...)` function, i.e. all headings, this one applies only to level 2 headings, via the `.where(level: 2)` part. This capability is not available to set rules, only to show rules. These are much closer to CSS selectors: where a set rule can do something like `a {...}` (i.e. matching all `<a>` elements), a show rule can be much closer to `button[type='submit'] {...}` (i.e. match only `<button type="submit" ...>`). Show rules can match only function calls that have a certain parameter, or a certain element, as long as it has a label.

Show rules aren't limited either to only presetting the arguments that the specific function has available. Instead, a show rule can declare a function that receives the raw element that is being formatted. The function should return some content, but it is not limited to modifying the element that it received; it can build one from scratch instead. For example, we could write a Typst document where it isn't possible to bold content:

```typst
*Normal Bold*

#show strong: it => emph(it.body.text)

*Still Bold?*
```

![a screenshot of a PDF document where bolded text actually appears in italics](./_resources/7cbada243d1e877b3b76b1c69dd1b49b.png)

As can be seen above, once the show rule has been declared, any further attempts to print bolded text actually print italicized text. This is because, whenever [a call to `strong(...)`](https://typst.app/docs/reference/model/strong/) is encountered, Typst instead invokes the function that was passed to the show rule. `it` contains the entire bold element, which happens to contain its raw text in `it.body.text`. Thus, we wrap it [with a call to `emph(...)`](https://typst.app/docs/reference/model/emph/), which italicizes its argument, and return it. No more bold text.

In effect, when used in this way, show rules are capable of completely intercepting calls to a certain content function, and the actual return value of that function is completely under the control of the show rule, which can decide to return an entirely different element. 

To recap: Styling in Typst is achieved via _set rules_, which target a class of elements (e.g. headings, or text blocks, or code blocks, or unordered lists) and can preset configuration values for that class of elements. There are also _show rules_, which can target elements with more precision, and can also completely override the presentation of an element by providing a custom function that will be called whenever a certain class of element is encountered. Said custom functions can completely drop the element, change some arguments, or replace it entirely.

## Scripting in Typst

Typst, much like LaTeX, embeds [something that acts like a programming language](https://typst.app/docs/reference/scripting/), though I'm unsure if it's Turing complete. Typst's scripting language is a bit like [JSX](https://react.dev/learn/writing-markup-with-jsx) (React's language, that allows Javascript to manipulate HTML elements) in that functions written in the scripting language can directly return Typst elements (e.g. headings, tables, or images), in the same way that in JSX it's valid to write `return <h1>Hello!</h1>`, i.e. returning (from Javascript) an HTML element. Similarly, in Typst:

```typst
#let name = "jreyesr"
#let titlify(text) = heading(level: 1, text)

#titlify("Written by " + name)
```

![a screenshot of a PDF document with a single level 1 heading that says "Written by jreyesr"](./_resources/599f2b0e78d82ce31079019c0e9737c6.png)

The first line declares a variable, `name`, with a value, in the same way as any mainstream programming language would (though, in the spirit of JS and Python, types are inferred rather than stated). This variable will be available to the rest of the document. By the way, a line that starts with `#` belongs to the scripting realm, rather than the standard Typst "content" realm. In the scripting realm, scripting lines are executed, and what appears back in the content realm is the _return value_ of each line. A `let` binding, which assigns a name to something, returns nothing. Not even a blank line. Therefore, the first line causes nothing to appear on the output document.

The second line is more of the same: it binds the name `titlify`, but this time _to a function_ rather than to a static value. This function, when called, will return (Typst functions have an implicit return of their last statement, like Rust's [implicit returns](https://users.rust-lang.org/t/explicit-and-implicit-return-in-functions/17089)) [a heading element](https://typst.app/docs/reference/model/heading/), which is itself composed by calling the `heading(level: N, content)` function that is built-in to the language. In fact, this function is called internally when you write a heading in normal Typst content, e.g. `== Something` would call `heading(level: 2, "Something")`. After the second line, we have a function available that takes some text (as a normal string) and returns a content block that is a heading of level 1 whose text content is the provided text.

Again, since the entire line is actually a `let` binding, and `let` bindings return nothing, this line doesn't output anything to the document either.

And then, on the third line (actually fourth), we call/invoke that `titlify` function. We pass it an expression (joining two strings, a fixed one and the variable `name` that was declared before). This concatenates the strings first, then passes them to `titlify`, which in turn calls `heading(level: 1, ...)` with that value. `heading(...)` returns a piece of content, which is in turn returned by `titlify(...)` because its last line was the call to `heading(...)`. Therefore, the fourth line is replaced by a piece of content that contains a heading. This _is_ printed to the output document, and causes the heading to appear in the PDF.

Script snippets can be interspersed with text content:

```typst
#let name = "jreyesr"

This was *written by #name!*
```

![a screenshot of a PDF document with a single line, that says "This was written by jreyesr!". Part of the line is bolded](./_resources/dca2e02c0682a1415100e9a3b60829a2.png)

This is similar to [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) in Javascript, where it's possible to embed variables in a string. The working principle in this example is the same as above: the first line, which declares the `name` variable via `let`, returns nothing and therefore prints nothing on the document. The second (actually third) line enters the scripting realm when `#name` is encountered, which when evaluated actually returns a string, which is therefore printed on the content realm.

Expressions can be more complex than just a variable name, i.e. `We've found #(items.len()) results`, which uses `#()` to delimit the expression `items.len()`raw, and also [calls a method on the `items` array](https://typst.app/docs/reference/foundations/array/#definitions-len). Again, this is similar to the capabilities of [Swift](https://www.hackingwithswift.com/articles/178/super-powered-string-interpolation-in-swift-5-0), [Dart](https://www.hackingwithswift.com/articles/178/super-powered-string-interpolation-in-swift-5-0) or JS, where full expressions (not just variable names) are allowed inside strings.

We've seen that Typst documents alternate between two modes: normal "content" mode, in which text is output to the PDF document; and code/scripting mode, in which a different syntax is used. There's also math mode, in which equations are typeset, but that's not used here. You enter code mode by typing `#`. In code mode, Typst behaves more like a traditional programming language in which variables can be defined and [logic (e.g. if-else expressions)](https://typst.app/docs/reference/scripting/#conditionals) can be expressed. There are values (e.g. strings, numbers, arrays/lists, and dictionaries/hashmaps), which can be passed to functions, have methods called on them, and otherwise manipulated. Each expression (roughly a line) in code mode has a "return value". For example, `let x = "abc"` returns nothing (it's a variable assignment, and the interesting part of variable assignments is the fact that they assign a variable, not their return value as if they were a mathematical operation), whereas `"abc".len()` would return 3 (the length of the string `"abc"`). Whenever a line in code mode returns something, that return value is transported back into the content mode and placed there. This is the way in which code mode can have an effect on the output: if it couldn't communicate back to content mode, nothing that happened in code mode would change the PDF output, and at that point, why have it at all?

Of course, once code mode can produce content that is output to the document, it's possible to build a document, at least in part, from code. For example, [code mode supports for-each and do-while loops](https://typst.app/docs/reference/scripting/#loops). Each iteration of the loop can output some content, which is useful, for example, to write variable-length bullet lists:

```typst
#let vowels = "aeiou".clusters()
#let consonants = "bcdfghjklmnpqrstvwxyz".clusters()

#let word = "Hello!"

= Word of the day: "#word" (#word.len() characters)

#for c in word [
    - #c #sym.triangle.filled.small.r #if vowels.contains(lower(c)) [Vowel] else if consonants.contains(lower(c)) [Consonant] else [Symbol]
]
```

This would evaluate to something like this (still in Typst format, but now with all scripting content already evaluated and therefore removed):

```typst
= Word of the day: "Hello!" (6 characters)

- H #sym.triangle.filled.small.r Consonant
- e #sym.triangle.filled.small.r Vowel
- l #sym.triangle.filled.small.r Consonant
- l #sym.triangle.filled.small.r Consonant
- o #sym.triangle.filled.small.r Vowel
- ! #sym.triangle.filled.small.r Symbol
```

which in turn renders into this PDF:

![a screenshot of a PDF document with a bullet list containing each letter of the word "Hello". Each letter also has an indication on whether it's a vowel, a consonant or a symbol](./_resources/3ecce6af6341001b5fe2943c5a9c4a19.png)

Notice how the entire content of the document (the title, the character count in the title, how many bullet points there are, and the content of each one) is controlled by a single variable, `word`. If we just change the word, the entire document changes to match:

```typst
#let vowels = "aeiou".clusters()
#let consonants = "bcdfghjklmnpqrstvwxyz".clusters()

#let word = "test"

= Word of the day: "#word" (#word.len() characters)

#for c in word [
    - #c #sym.triangle.filled.small.r #if vowels.contains(lower(c)) [Vowel] else if consonants.contains(lower(c)) [Consonant] else [Symbol]
]
```

![a screenshot of a PDF document with the same structure as the screenshot above, except that now it talks about the word "test" instead of "Hello"](./_resources/c522ce25e33d0da929878df72f8127c5.png)

Tables can also be filled with this approach, albeit with a bit more syntax:

```typst
#let vowels = "aeiou".clusters()
#let consonants = "bcdfghjklmnpqrstvwxyz".clusters()
#let descr(c) = if vowels.contains(lower(c)) {"Vowel"} else if consonants.contains(lower(c)) {"Consonant"} else {"Symbol"}

#let word = "Hello!"

= Advanced analysis of the word "#word"

#table(
  columns: (auto, auto),
  inset: 10pt,
  align: horizon,
  table.header(
    [*Letter*], [*Type*],
  ),
  ..for c in word {
    (c, descr(c))
  }
)
```

The first part is the same as above. The `table()` call, [which is always used to create tables](https://typst.app/docs/reference/model/table/), happens to [take the cells as its last arguments](https://typst.app/docs/reference/model/table/#parameters-children). In other words, it's always called like this: `#table(arg1: val1, arg2: val2, cell1, cell2, cell3, cell4, ...)`. The first arguments, which have a name and a value, are configuration/formatting arguments for the table, such as the number and width of the columns, alignment, padding, row heights, colors for the lines and cell backgrounds, and similar. Then, anything else is collected and treated as cells: the final argument argument is variadic, meaning that it can take an unspecified number of arguments, acting as a catch-all that eats everything that isn't a formatting parameter for the table. In our case, we use a for-each loop to run over each character and, for each one, create [an array](https://typst.app/docs/reference/foundations/array/) with two values: the character itself and a description of the character, e.g. "Vowel" or "Consonant". Therefore, the for-each loop itself can be thought of as being replaced by an array of arrays: for each character in the word, there's an array with two values. 

Then, [the `..` operator](https://typst.app/docs/reference/foundations/arguments/#spreading) is used to "spread" that array of arrays into the variadic argument of the `table(...)` function. [That pattern is discussed here](https://github.com/typst/typst/discussions/3365), and is explicitly endorsed by Typst's authors. The table rendering code then takes over, having received a bunch of cells, and renders this:

![a screenshot of a PDF document which contains a table with two columns. In the left column are the letters of the word "Hello", and on the right column there is whether that letter is a vowel, a consonant or a symbol](./_resources/15cef0151d4795a7231a0c8a1d38e714.png)

This demonstrates that tables can be created programmatically, by generating their cells in code and then passing them to the `#table(...)` function. Of course, we can then apply traditional programming techniques, such as extracting the code which generates a single row to another function:

```typst
#let vowels = "aeiou".clusters()
#let consonants = "bcdfghjklmnpqrstvwxyz".clusters()
#let descr(c) = if vowels.contains(lower(c)) {"Vowel"} else if consonants.contains(lower(c)) {"Consonant"} else {"Symbol"}

#let word = "Hello!"

= Advanced analysis of the word "#word"

#let row(letter) = (strong(letter), descr(letter))

#table(
  columns: (auto, auto),
  inset: 10pt,
  align: horizon,
  table.header(
    [*Letter*], [*Type*],
  ),
  ..for c in word {
    row(c)
  }
)
```

This is nearly the same as the previous example, except that now we have a new function, `row(letter)`. It receives a single character and returns the row that corresponds to that character. Here it's just two cells: the first (leftmost) cell displays the character itself, bolded; and the second (rightmost) cell contains its description, either "Vowel", "Consonant" or "Symbol". Then, the table merely calls `row(letter)` inside the for-each loop. Of course, since this is a trivial table, doing this is unnecessary, but for more complex tables it may be useful since now the `row(letter)` function is just concerned with _a single row_ of the table. 

People familiar with React may recognize this as similar to [React's components](https://react.dev/learn/your-first-component#components-ui-building-blocks), AKA new-style or function components (not [class components](https://www.twilio.com/en-us/blog/react-choose-functional-components), which are older). Of course, all concepts related to interactivity (event handlers, hooks, lifecycle functions) don't apply to Typst. But the idea of ["a JavaScript function that you can sprinkle with markup"](https://react.dev/learn/your-first-component#defining-a-component) can be carried over to Typst. For example, our `row(c)` function in the example above would be similar to a `function Row({character})` component in React, called like this: `<Row character={c}>`:

```jsx
function descr(c) {
  if("aeiou".includes(c.toLowerCase())) {
    return "Vowel"
  } else if("bcdfghjklmnpqrstvwxyz".includes(c.toLowerCase())) {
    return "Consonant"
  }
  return "Symbol"
}

function Row({character}) {
  return (
    <tr>
      <td>{character}</td>
      <td>{descr(character)}</td>
    </tr>
  )
}

function Table({word}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Letter</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        {[...word].map((c, i) => (<Row character={c} key={i}/>))}
      </tbody>
    </table>
  )
}

export function App(props) {
  return (
    <Table word="Hello!"/>
  );
}
```

In both cases (React and Typst), it's possible (and, in the case of React, it's the official way too) to write functions that receive some parameters and return a piece of visual content (a bit of HTML code in React, and something that gets printed to the PDF in Typst). Those functions can compose neatly, since they can be called by other functions, even repeatedly, which is actually React's core idea of [the UI being a tree](https://react.dev/learn/understanding-your-ui-as-a-tree) where components are nested inside other components. In the case of Typst, that model (that of nested elements) may not be as useful since the final destination of the content is a PDF, where things are a lot more "linear" in nature, but it may still be of use.

Images can also be inserted automatically, even from a string. Let's say that you have a Base64-encoded string that contains an image. [The `based` package](https://typst.app/universe/package/based/) (third party, open source, available [on Github](https://github.com/EpicEricEE/typst-based)) can decode that Base64 string to a raw byte array (Typst [does have a native Bytes type](https://typst.app/docs/reference/foundations/bytes/) which can represent arbitrary sequences of bytes, so there's no need to transport them as strings, where special characters may cause issues). At this point, we have a byte array with the raw image data. Then, there's [the `image.decode(...)` function](https://typst.app/docs/reference/visualize/image/#definitions-decode), which can read said byte array and generate an image. Normally, images are loaded by providing a file path, e.g. `image("path.png")`, but it's also possible to load them from a bytes object, which doesn't require that any files on disk are read.

```typst
#import "@preview/based:0.1.0": base64

#let data = base64.decode("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")

#figure(
    image.decode(data),
    caption: "Very important image"
)
```

![a screenshot of a PDF showing an image that was decoded from a Base64 string](./_resources/37f556a06e486e1175390fadb6b07298.png)

You're welcome.

And, finally, Typst scripts are capable of intepreting and running _other_ Typst scripts that come in as a string, which therefore grants Typst scripts the same power as Typst itself. This is done [by using the `eval(...)` function](https://typst.app/docs/reference/foundations/eval/), which takes a string (i.e. a sequence of characters) and interprets it as Typst code, in one of three contexts: markup/content mode, scripting mode, or math mode:

```typst
Code: #eval("1 + 1") // outputs 2, code mode is the default

Markup: #eval("= Title", mode: "markup") // Outputs a level-1 heading

Math: #eval("1 + 1", mode: "math") // Outputs 1+1, typeset as an equation

#table(
    columns: (auto, auto, auto),
    table.header([*Mode*], [*Result*], [*Type*]),
    [Code (default)], repr(eval("1+1")), repr(type(eval("1+1"))),
    [Markup], eval("1+1", mode: "markup"), repr(type(eval("1+1", mode: "markup"))),
    [Math], eval("1+1", mode: "math"), repr(type(eval("1+1", mode: "math")))
)
```

![a screenshot of a PDF document which displays the different interpretation modes for 1+1, as described in the text above](./_resources/8bc82d59522730c15299bf1ddcf34dd3.png)

In theory, `eval(...)` would allow Typst code to dynamically generate _more_ Typst code. It could also be used to, say, [read other Typst files from disk](https://typst.app/docs/reference/data-loading/read/), and then pass them to Typst's engine for evaluation, with their results (be them the result of code being run, or markdown) being included in the main document that called `eval`. This isn't quite LISP levels of code inception, but it's fairly close without the code-is-data philosophy of LISPs.

Use of `eval` isn't recommended, as is the case with similar functions in other programming languages that offer similar functionality. For references, see [Javascript's dire warnings](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_direct_eval!) and [an article on Python's `eval`](https://www.udacity.com/blog/2023/03/pythons-eval-the-most-powerful-function-you-should-never-use.html).

> This function should only be used as a last resort.

However, it's still there, in case you need it.

To conclude this part: Typst's documents have [a fairly powerful scripting language](https://typst.app/docs/reference/scripting/) that can perform various operations, such as logical and arithmetical operations, string manipulations, reading data from disk, and more. Furthermore, the scripts that exist inside a Typst document can build and output content to the PDF that is being generated. This means that Typst documents can have parts that are generated dynamically, such as a bullet list whose elements are read from a file, images that vary, or tables with a variable number of rows. This means that Typst can be used as a tool to build dynamic "reports" or other similar documents, that have a fixed structure and some parts but where other parts vary per document.

### Bonus: plugins!

While we're on the topic of Typst's scripting language, let's briefly mention Typst's plugins, since they're very useful in extending Typst's capabilities.

Typst natively supports plugins, pieces of third-party code that extend the functionality of Typst's scripting language. Plugins are used to implement templates (e.g. a certain journal's style guidelines), visualizations, pure logic (such as the base-64 package that we've just used) and other features that aren't feasible to include with the Typst core.

As we've discussed before, there's a repository where plugins can be published, called [Universe](https://typst.app/universe/). It's where most plugins live (though note that it's not required, as you could publish a package just on Github or elsewhere and direct people to [download the code and place it in the appropriate directory](https://github.com/typst/packages#local-packages)). The Universe provides discoverability (it has a really nice web UI with a search bar and a preview of each package's README, much like NPM, Pip, Cargo or other package managers), and it also eases installation (if a package is published in the Universe, users can just import it in their Typst files. There's no need to run any commands or install things). Some LaTeX distributions, such as MiKTeX, also [have the ability to autoinstall packages](https://docs.miktex.org/manual/autoinstall.html) when they're imported and aren't installed in the computer.

To use a package in a document, you use [the `import` function](https://typst.app/docs/reference/scripting/#modules):

```typst
#import "@preview/based:0.1.0"

#str(based.base64.decode("SGVsbG8h"))

OR

#import "@preview/based:0.1.0": base64

#str(base64.decode("SGVsbG8h"))
```

The first form imports the entire package, here `based`, [a package that implements conversions to and from base-16, base-32 and base-64](https://typst.app/universe/package/based). That package has a `base64` variable that contains a `decode(...)` function.

In the second form, we specify which elements from the package should be imported, here only `base64`. The rest of the code is the same.

Some packages are pure Typst code, such [as the `based` package above](https://github.com/EpicEricEE/typst-based/tree/master/src). They may just contain logic that can be expressed in Typst code. Or they may not need anything else: consider templates for a certain journal, where everything can in principle be written in Typst itself (it's just a lot of settings for a lot of elements, and set rules, and show rules, and other Typst constructs). Or they may be providing a higher-level API over lower-level functions that already exist on Typst, such as [the `cetz` package](https://github.com/cetz-package/cetz), which eventually resolves its shapes to [raw visualization calls](https://typst.app/docs/reference/visualize/), in terms of lines, ellipses and polygons. 

However, Typst also supports plugins written in other programming languages. This is done [via WebAssembly plugins](https://typst.app/docs/reference/foundations/plugin/). WebAssembly is a fairly modern technology, [originally designed, as its name implies, for web browsers](https://developer.mozilla.org/en-US/docs/WebAssembly). It's fairly low level code (similar to assembly in that it operates on primitive instructions such as addition or loading to a register, along with a very simple linear memory model), which can be executed in a browser in a very performant manner, close to that of native (compiled) code. Of course, much like with traditional assembly language, you most likely won't write programs directly in it. Instead, other higher-level programming languages (e.g. Rust, C# or Python) can be compiled into WebAssembly and used in browsers, as long as they obey the calling conventions, which are standardized.

WebAssembly, being a web technology that would be used on browsers, is _very_ concerned with safety. Safety [as in memory-safe](https://www.embedded.com/memory-safety-in-rust/), AKA preventing null-pointers from doing null-pointery things; and also safety as in sandboxing, AKA very strong guarantees (that can be enforced by the host application, typically the browser) on what can be done by the WebAssembly programs that run inside of it. This is, of course, because browsers need to treat all their inputs (usually Javascript code, and now WASM too) as potentially untrusted, since the user may have visited a malicious page. In practice, this means that a lot of care has been taken to prevent WASM programs from being able to compromise their host application/interpreter/VM. In a browser, such compromises (such as being able to read arbitrary process memory) would allow a malicious page to extract user data, such as what other tabs are open and what is displayed on them, or the user's credentials that are saved in the browser password manager, or cookies, or (if writes are possible) to modify said data. Hence the memory safety.

That being said, WASM has also found some popularity in other, [non-Web environments](https://webassembly.org/docs/non-web/). Its emphasis in memory safety means that it's much more difficult for a plugin written in WASM to crash its entire host entire application, because traditional bad reads and writes that are possible in, say, C are a lot more difficult (ideally impossible). The sandboxing capabilities mean that the host application can provide good guarantees on what the plugin is and isn't allowed to do, which is nice when you may be running not-necessarily-trusted code. Since WASM was defined for browsers, which are by necessity cross-OS, WASM's semantics are the same across OSs and processor architectures, which means that (as long as there's a compliant interpreter for your processor+OS+whatever else combo) WASM programs should run in the same way for everyone. WASM programs aren't tied to, say, the Windows API, or the Linux API, or the Mac OS API.

For example, WebAssembly programs [can run in Deno](https://docs.deno.com/runtime/reference/wasm/), a Javascript runtime (think "replacement for Node.JS") with [very nice security guarantees](https://docs.deno.com/runtime/fundamentals/security/) (e.g. "no programs can read the file system or make network calls unless explicitly allowed"). WASM is used [by Spin](https://developer.fermyon.com/spin/v2/), a serverless platform (similar to AWS Lambda or Cloudflare Workers) where event handlers can be written in one of many programming languages (they're then all compiled to WASM before they're loaded on Spin). Istio (a service mesh that is fairly common in Kubernetes ecosytems) [can load and use WASM plugins](https://istio.io/latest/docs/reference/config/proxy_extensions/wasm-plugin/) at various points when a request is being processed. Fluent Bit, which is a program that collects, processes and forwards observability data (i.e. logs, metrics and traces) from applications to monitoring applications, [supports WASM plugins](https://docs.fluentbit.io/manual/development/wasm-filter-plugins) for inputs (i.e. sources of data) and filters (i.e. stages that receive some data, transform it in some way and then output the new data). The Open Policy Agent, OPA, which is a tool where authorization policies can be expressed (e.g. "users who are in the Customer Service group can see the accounts of other users who are in their same region, for troubleshooting purposes") and evaluated (e.g. given a certain user X who wants to see the account of another user Y, should that be allowed?) can [dynamically generate and return small WASM programs](https://www.openpolicyagent.org/docs/latest/wasm/) that implement the authorization policy. For example, OPA would be able to generate a WASM program that, when called with the data of two users, returns either `true` or `false`, depending on whether the first input user is allowed to access the account of the second input user. In effect, that's the authorization policy, embodied in an executable form. In this way, the application that needs to enforce that policy can do so itself (it asks OPA for the decision program, then loads it locally using a WASM runtime in the app's language, and then calls it repeatedly whenever it needs to authorize an operation). Otherwise, the application would have to call OPA, which is a separate component, whenever an authorization decision needs to be made, which adds latency (because of the network hop) into _every_ request, because most requests probably need authorization.

There are probably many more examples. WASM provides a nice way for programs to load and run small pieces of code that need to run fast and should be isolated, perhaps because they may not be trusted. It's also useful to provide cross-language compatibility (by using yet another language, WASM). And it's supposed to be fast.

Typst can also load and invoke WASM plugins. They're completely isolated:

> Plugins run in isolation from your system, which means that printing, reading files, or anything like that will not be supported for security reasons.

This means that WASM plugins in Typst are limited to "pure" computations, i.e. take an input, crunch the data, spit out an output. No reading files, calling servers, or other environmental interactions.

While it's not explicitly stated in the docs, one of the points of providing WASM plugins is to allow people to write plugins in other programming languages, not necessarily on Typst's scripting language. As long as it can compile into WASM (and most mainstream programming languages can), it should be possible to use many languages to express the logic of the plugin, and then have the WASM compiler translate it into something that Typst can load and use.

Since WASM is a very low-level language, there's [a protocol that all plugins must adhere to](https://typst.app/docs/reference/foundations/plugin/#protocol). It involves a bunch of byte arrays (the equivalent of `char*` in C), into which the input arguments are read. Once it has its arguments, the WASM function can do whatever it wants with them (subject to the constraints of the sandbox), and it'll then place its output in another byte array, from which Typst code will read it. Typst provides [an example repo](https://github.com/astrale-sharp/wasm-minimal-protocol) with Rust, Zig and C examples, all of which can compile into WASM.

## Typst as a dynamic document generator

Now that we've seen that Typst embeds a scripting engine that has many of the capabilities of a programming language, we will see how Typst could be used as a report generator or templating engine. 

### Alternatives

There are many tools that can take a Word document with some special markup (a "template"), plus some variable "data" (typically a JSON document) and generate either Word or PDF documents where the variable data has been merged into the template document. A non-exhaustive list, in alphabetical order, is as follows (each one links to a page with demos):

* [Carbone](https://carbone.io/templates-examples.html)
* [Docmosis](https://www.docmosis.com/how-it-works/document-gallery/)
* [Docxtemplater](https://docxtemplater.com/demo/#/view/energy-performance-certificate)
* [JSReport](https://playground.jsreport.net/w/admin/d7o0nIWc) (note: click the Run button at the top left to generate the output report)
* [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/demos.html)
* [Templater](https://templater.info/demo)

They all use the same ideas: you design (typically in Word, which is what people are familiar with) something that looks like this:

![a screenshot of a Word document with variables included](./_resources/e7074bdf99a30309581b6d96a1d381b7.png "Docmosis syntax, wrap variables with <<angle brackets>>")

This is the template, from which many documents will be rendered. To render a document, the templating engine is called with that template and a set of data to replace into the template, typically a JSON document, which may look like this:

```json
{
	"title": "Miss",
	"firstName": "Victoria",
	"lastName": "Barton",
	...
}
```

The result is either a Word or PDF document that may look like this:

![a screenshot of a Word document with the placeholders replaced by real values](./_resources/ec54bc168a015236b3d7f8d9e2a443db.png)

Another example, this time of an invoice:

![a screenshot of a Word invoice with variables included](./_resources/a53c6880bbaaa53456499ada778ef91e.png "Plumsail syntax, variables are wrapped in {{curly braces}}")

![a screenshot of a Word invoice with the placeholders replaced by real values](./_resources/92fa50cfddc4b9d3d23fe126765da56d.png)

Of course, all these templating engines aren't just capable of replacing `<<var>>`, `[[var]]` or `{{var}}` placeholders (the exact syntax depends on the engine). They can also run loops to repeat elements. Some of them do it automatically, such as in the Plumsail invoice just above. Observe how the table has a single row in the template, which represents a single line item in the invoice. However, once rendered the row has four items, one for each of the elements in the `items` array. Other engines, such as Carbone, have explicit markers for the start and end of the loop. 

They can also conditionally show or hide parts of the document, depending on conditions that are checked against the input data. Most of them can include images in the document, though for most of the listed projects the ability to do so is paid (and, in some, the entire engine is paid). Some even allow for conditional formatting (say, only bold some text if a certain condition is fulfilled).

### Uses

Engines such as these are useful whenever you have an application that needs to generate PDF documents, e.g. invoices, certificates, or other documents that have a fixed skeleton but variable contents. For example, my bank can generate account statements that certify that person X with national ID document N has account M in the bank with a balance of between A and B. Somewhere in the bank's applications is a templating engine. Our tax authority also generates PDF certificates whenever you submit a tax declaration, displaying the amount that you declared, any paid money, and the date. If you have an online course service (à la Coursera/edX/whatever), the PDF certificates of completion/passing are generated from a template. Most if not all e-commerce sites can generate PDF invoices. Our traffic department (called [DMV](https://en.wikipedia.org/wiki/Department_of_motor_vehicles) in the US) generates PDFs that contain the date, time and license plate of your car for your annual car revision appointments, which you must present when taking the car there. SaaS applications may be interested in generating, say, a report of user accounts, each with its active/inactive status, time of last activity and granted privileges. My university, if I ask nicely and pay a certain amount of dobloons, will probably generate a transcript with the courses that I took and the grades that I got on each. There's [a government dependency](https://www.senescyt.gob.ec/) which validates all university-and-higher degrees, without which your title isn't valid in Ecuador, and you can also check the degrees that a certain person has. They can generate, on demand, a PDF with a list of all said degrees. And so on.

Some of those applications (e.g. a bank that emits the account certificates, the DMV generating appointment PDFs, or a university that can generate course grade transcripts) have fixed templates, that just need to be filled with variable data. They can be thought of as having empty "slots" that should be filled by data to generate a complete document. For example, a bank account certificate may contain:

* The date the certificate was generated
* A "certificate number"
* A validity date, which when I generated one was 15 days after generation
* A name to which the entire certificate, which is in the form of a letter, is addressed to 
* The name of the account holder who requested the certificate
* The identity number of the account holder
* A table with all the "financial products" that the account holder has on the bank (e.g. accounts), each with the product name (e.g. checking or savings account), the account number, opening date, and status (active/inactive)

Of that data, some comes from the bank's app database (e.g. the user's name and ID number, which were collected when opening the online banking account, and the contents of the table with the user's accounts), some comes from the web application and is collected when the report generation is commanded (namely, the name of whoever the certificate is addressed to), some comes from internal logic (the certificate number), some is a property of the universe at that time (the date of generation), and some could be computed just-in-time from other properties (the validity date, which is the generation date, plus 15 days).

For other use cases (e.g. an e-learning platform where people or organizations can submit courses, and other users can take them), the templates _themselves_ aren't part of the platform itself, but are instead part of the user-submitted data that the application manages. Much like course creators provide a course name, description and image when submitting a new course (along, of course, with the course's actual content), they may also have the ability to control the appearance of the certificates that they emit. Not all e-learning platforms have this, presumably due to the difficulty of implementing it: Udemy [only allows coursemakers to request that their organization's logo be added to certificates](https://business-support.udemy.com/hc/en-us/articles/4421577903383-How-to-Add-Your-Company-s-Logo-to-Certificates-of-Completion-for-Custom-Courses), while edX [only seems to support customization of the HTML templates that generate certificates](https://edx.readthedocs.io/projects/edx-installing-configuring-and-running/en/latest/configuration/enable_certificates.html#customize-certificate-templates-for-your-organization) in the self-hosted Open edX platform (I couldn't find any such information for course makers in the official edX site).

Same goes for e-commerce sites: the platform that implements the e-commerce stuff is usually separate from the products themselves that are sold there. The application is just "an e-commerce platform" that then a company deploys and fills with the things that they actually sell. If the "e-commerce platform" wants to provide the people that deploy it with a way to send customized PDF invoices on every order, then they need a way to render arbitrary user-submitted templates. Or consider Amazon, which (ignoring Amazon-sold products) is supposed to be just a channel between sellers and buyers. If Amazon allowed sellers to generate custom invoices (I couldn't find any evidence that they do), they'd need a way for sellers to upload a template that would then be filled, by Amazon, with each purchase's information; and mailed, by Amazon, to the purchaser. Same goes for PayPal, where payments can be made and invoices sent: they'll always, as far as I could see, use [this same payment template](https://www.paypal.com/us/invoice/invoice-template-generator). In fact, that's a really good example because it neatly highlights the variable fields (pointed to below by red arrows) and the fields that, while not static, can be computed from others (pointed to by green arrows):

![a screenshot of PayPal's invoice generator, showing many empty fields that must be filled to create an invoice](./_resources/ebf696a9e05b43b355405ee039996a2c.png)

### Typst's applicability

As we've seen, Typst is mainly intended to be used to generate static documents (i.e. ones where the source `.typ` file, plus any resources such as images that need to be displayed, will generate the same PDF every time). This is much in the spirit of LaTeX, where the source `.tex` file is the source of truth for the output PDF, another representation of the same content. The source files (`.typ` or `.tex`, respectively) would have been lovingly typed, character by character, by whoever is authoring the document.

However, Typst (and LaTeX too, for that matter, since it also embeds a programming language) can also be used to dynamically replace content into the document, thereby allowing them to be used to implement templates. These documents would be generated automatically, outside of anyone's direct supervision, and embedded in automatic processes such as invoicing or reporting, where the first time that someone would see the document is when it's already generated and sent to someone, such as via a monthly email or on every purchase.

### Feeding variable data

The first need of templating engines is to have a way to pass variable data into the template, so it can be referred to. The way of doing so varies per engine, but it typically involves providing a JSON document that will then be accessible in the template, either directly or under a magic name. For example, [Carbone](https://carbone.io/documentation.html#substitutions) exposes all the input data under the `d` variable:

![Carbone's way of referring to input data as d.X](./_resources/be3a43d4e5e8d266558e8027a67b868c.png)

whereas [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/how-it-works.html) puts each key of the input JSON document into the topmost context, much as if they were global variables:

![Plumsail's way of referring to input data as plain variables](./_resources/779326853cfd379f2317e93d5870aab4.png)

In Typst, there are two (that I could see) main ways of passing data _into_ the template. The first one would be to [read a file and parse it as JSON](https://typst.app/docs/reference/data-loading/json/), after which point the data will be available as a native Typst value, probably a [dictionary](https://typst.app/docs/reference/foundations/dictionary/) or an [array](https://typst.app/docs/reference/foundations/array/):

```typst
#let d = json("invoice_data.json")

= Invoice #sym.hash #d.number

/ Due date: #d.due_date
/ Bill to: #d.buyer_name (#link("mailto:" + d.buyer_email)[d.buyer_email])

TODO table here!
```

If we place a file named `invoice_data.json` right besides the `.typ` file and then run the Typst compiler, we get a PDF like this:

![a screenshot of a PDF containing the header for an invoice](./_resources/b156b921fe5d556bc8bbbe18595e0149.png)

In practice, a web application that wanted to use this approach would do something like this:

1. The Typst template should already exist, either hardcoded as part of the application (if it's controlled by the application's developers and changes aren't frequent, as happens for example with password reset emails, whose templates are typically included in the app's code), provided by the application's users (as in the case of e-learning with custom certificates) or read from some sort of object storage (which would allow changes to the template without the need to deploy a new version of the application)
2. When a PDF needs to be generated (say, a sale is made and an invoice should be sent, or the user of the banking application clicks the button to download his account certificate), the application copies the master template into a new, empty directory (probably on the system's temp directory, e.g. `/tmp` on Linux)
3. The application prepares the data that should be rendered into the template, as a JSON-equivalent document, and saves it as a JSON-encoded file in the same directory
4. The application invokes the Typst compiler on that directory
	* The easiest way is to shell out and call the `typst` command. This approach [is taken by the `typst.js` Javascript package](https://github.com/typst-community/typst.js/tree/main) ([here](https://github.com/typst-community/typst.js/blob/cebc5e31651d1f0c5180bf7320136d10de836bff/src/compile.ts#L44-L46) you can see how it dynamically builds the CLI arguments for Typst and then calls something equivalent to `typst compile --flag1 val1 --flag2 val2 input_file.typ`) 
	* It's also possible to call Typst directly from the programming language used, for some programming languages: Typst is [a Rust library](https://crates.io/crates/typst), and by depending on that crate it's possible (from a Rust program) to call [the top-level `compile` function](https://docs.rs/typst/0.11.1/typst/fn.compile.html), which wraps the entire compilation process. There is also [a Python package, `typst-py`](https://github.com/messense/typst-py), which embeds Rust code and thus includes Typst's crate directly: [here's](https://github.com/messense/typst-py/blob/4492759b5a06f820a0c026852022275f25bc69c4/src/lib.rs#L193) the calls to Rust code, which is then wrapped and presented as a Pythonic library
5. Whatever the approach, the result is either a new document written to the same directory (such as when using the Typst CLI) or a binary string that contains the PDF's bytes (the Typst crate and Python library, for example, support that)
6. The new document can be served to the user, e.g. by returning it as a HTTP response [with the `Content-Disposition` header set to `inline`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition), which triggers the browser to display the image in the built-in PDF viewer, or to `attachment` to trigger the browser to download the PDF directly
7. Alternatively, the PDF can be sent via email, stored in object storage to be presented to the user later, or whatever else needs to be done

The main idea is therefore to write templates assuming that there's a magical JSON file that will always exist and have data _for the current rendering of the template_. It's then the application's responsibility to ensure that the template is always rendered with the proper data, hence the whole process of copying the template to a temp directory for each render. Otherwise, it wouldn't be possible to render the same template multiple times simultaneously, since they all would try to point to the same JSON file

There's an alternative, provided by Typst's [`sys.inputs` dictionary](https://typst.app/docs/reference/foundations/sys/). This "makes external inputs available to the project", and they're provided on the CLI by using `--input key=value`, which will then be available on the template as `#sys.inputs.key`, of value `"value"` (always a string). For the use case of rendering templates, where it's very likely that things more complex than a single string are required, [the `json.decode` function](https://typst.app/docs/reference/data-loading/json/#definitions-decode) can be used to convert that string into a Typst dictionary, which can then be used just like the result of `json("path.json")`.

The advantage of this method is that it keeps data flow explicit and it's purer (in [the functional programming sense of the word](https://wiki.haskell.org/Pure)), whereas dropping the JSON data into a file and then having the Typst compiler read it relies on side-effects: one part of the program writes a file, later another part reads that same path, and they expect the same contents to be read from that path as were written there. This is why we had to have the temp directory and copy the template there. By contrast, using `sys.inputs` passes the data straight from the compiler to the Typst template. It also incurs in no I/O, which may be nice in certain situations and plays well with the stateless nature of containers (which, to be fair, could also use `/tmp`), since all the data is passed around in memory only.

```typst
#let d = json.decode(sys.inputs.data)

// NOTE: Below is the same, d contains the same data as in the example above

= Invoice #sym.hash #d.number

/ Due date: #d.due_date
/ Bill to: #d.buyer_name (#link("mailto:" + d.buyer_email, d.buyer_email))

TODO table here!
```

This needs to be compiled like this (in Bash. Other shells may need a different syntax for quote escapement, since it's necessary that the inner quotes, which are provided to Typst, are double quotes. JSON needs those):

```bash
typst compile --input data='{"number": "INV01-2024-012345","due_date": "2024-09-30","buyer_name": "John Doe","buyer_email": "jdoe@gmail.com"}'
```

Or, if using the Python library, where `sys.inputs` can be provided:

```py
import json
import typst

# Read from DB, compose dynamically, or whatever
context = {
  "number": "INV01-2024-012345",
  "due_date": "2024-09-30",
  "buyer_name": "John Doe",
  "buyer_email": "jdoe@gmail.com",
}

# Rendr template into PDF
pdf_bytes = typst.compile(
              "template.typ", # Should refer to sys.inputs.data
              sys_inputs={"data": json.dumps(context)})

# Now pdf_bytes can be written to a file, sent via email, stored on object storage, or whatever
```

This compiles into exactly the same PDF as in the example above, where we read the JSON document from a file in the filesystem.

Of course, since `sys.inputs` is a built-in feature of Typst, it can be used on [the Rust crate](https://docs.rs/typst/0.11.1/typst/foundations/sys/fn.module.html) or any other bindings that use it (e.g. [Python's binding](https://github.com/messense/typst-py/blob/4492759b5a06f820a0c026852022275f25bc69c4/python/typst/__init__.pyi#L108)). In this way, applications can compile Typst documents without ever shelling out (to call the Typst CLI) or performing disk operations (to read the template and/or data files, nor to write out the PDF), purely in memory and as close as it's possible to get to pure computation.

It's unclear how much of Typst's incremental compilation (yes, [they do have incremental compilation](https://github.com/typst/comemo/), which is useful to speed up PDF generation) would be used in such cases. Then again, how much is shared in the case of templates with variable data? When writing a paper, most of the time you'll be recompiling documents that have almost the same content as the last time, usually with some more added. Therefore, a large portion of work (say, each paragraph that wasn't touched. I'm uncertain on how Typst handles it) could be reused. Not so in document generation, where the changes happen all at once and across the entire document.

A possible middle point (between reading actual files from disk using `json("filename.json")` and using `sys.inputs` for direct-to-engine injection of values) would be, if using a library that supports it, to intercept file reads and, if they refer to files that end in `.json`, not to read them from disk but to return the template data. In such cases, it would be possible to provide "virtual files", i.e. files that don't actually exist, but to the template they do exist, and contain data (which is transparently switched on each invocation, but the template doesn't need to know that).

For example, the Python library [reads all files from disk](https://github.com/messense/typst-py/blob/4492759b5a06f820a0c026852022275f25bc69c4/src/world.rs#L317-L324) directly, whenever a file read is requested. However, it could, in theory, provide a hook for Python code to intercept the read request and decide how it wants to proceed. The code could decide to read an actual file from disk, or maybe just return some data directly, in the case of the template's context. Such read-file hooks may also be useful to implement a level of sandboxing, since all reads requested by the template would go through developer-controlled code that could, for example, return a "file not found" error if a file that isn't in a whitelist of approved files is read by the template. Typst itself isn't that concerned with that[^1], since it's assumed that you'll write and compile your own templates, and therefore no shenaniganry should be afoot. But in the context of a multi-user web application where people may upload templates, some more care may be necessary.

### Variable interpolation

We've already seen the simple case of variable interpolation, i.e. taking something from the input data and "filling in" the template. This is normally done by `{{field}}` or `[[field]]` or something to the effect, a marker sequence that wraps the name of the field that should be read and replaced.

In Typst, since we have a variable (declared in scripting context) that holds the template's data, we can just switch to scripting mode and print out the value, like this:

```typst
// Assume that "data" contains the input data

Greetings, #data.first_name #data.last_name!

...
```

While on scripting mode, some more complex expressions that are based on the input data can be inserted in exactly the same way:

```typst
To be paid to: #upper(data.name)

Details (#data.items.len() items)
```

We can call functions (e.g. `upper(somestring)`) or methods (e.g. `somearray.len()`), and those values can be inserted too. This may be useful to perform some lightweight calculations on the input data.

### Conditionals and loops

Templates may need to conditionally show and/or hide content. An easy example would be to display "You've bought the following product" vs. "You've bought the following 4 products", depending on whether a single product or several were bought.

Some of the projects that we've been comparing to Typst work by wrapping the content that should either appear or not in a special block, where the condition is specified. For example, [DOCXTemplater does that](https://docxtemplater.com/docs/tag-types/#conditions):

![a screenshot from DOCXTemplater docs showing that a section can be wrapped in a condition to either hide or show it](./_resources/327441f2e1dba5ee680caa688fd586c1.png)

whereas [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/conditionally-hide-blocks.html#hide-arbitrary-block) uses a magical `hide-block-if` tag that, when found and true, causes its containing block (e.g. a table cell, which can have invisible borders) to disappear:

![an image from a Word document where a hidden table contains content that will disappear](https://plumsail.com/docs/documents/v1.x/_images/hide-arbitrary-block-template.webp)

Typst [supports `if-else` blocks](https://typst.app/docs/reference/scripting/#conditionals) natively, so it can already show or hide content:

```typst
#let d = json("invoice_data.json")
#repr(d)

= Invoice #d.number

/ Bill to: #d.buyer_name #if(d.at("buyer_email", default: none) != none)[(#d.buyer_email)]
```

When we try to render a document with a `buyer_email`, the if block renders, as expected:

![a PDF document where a user's email is displayed](./_resources/60bd288819c6af7a2bbe0bd66b58d9ac.png)

However, if we don't have a `buyer_email` in `d`, then the key lookup [returns the `none` value](https://typst.app/docs/reference/foundations/none/), and the block isn't displayed, and neither are its parentheses:

![a PDF document where a user's email is not displayed](./_resources/cc2ea840f8bbb12b66f1d433d00c3071.png)

In general, it should always be possible to make Typst completely hide content, because [of the existence of `none`](https://typst.app/docs/reference/foundations/none/). This is the equivalent of `null`/`nil`/`None` in other programming languages, and it represents, as usual, the absence of a value. However, in Typst this value has another use: if it is inserted into the document, it generates nothing, not even an empty space. As we've seen, scripting lines that shouldn't generate output (e.g `let var = val`) _actually_ output a `none`. Therefore, if at any point it is necessary to not output something, it's always possible to emit a `none`. It'll be safely non-printed on the document.

As for loops, some tools (e.g. [Carbone](https://carbone.io/documentation.html#repetitions)) employ some sort of marker for the start and end of the loop. Carbone, as an example, uses the reserved variables `i` and `i+1`, much as you'd use if you were writing a classical `for` loop in C. Whenever a "repeatable section" (e.g. a bullet point, or a table's row, or a paragraph) is found that mentions the `i` variable, it will be repeated until `i+1` is found:

![a screenshot of Carbone's docs showing that a section (a title and a table) can be repeated](./_resources/93c04537e12483073944d7aa96d471f2.png)

As can be seen in the example above, it's typically possible to perform nested repeats. Above we want to repeat sections of the document, one for each brand of car, where each brand has _itself_ a table that is composed of repeated car models. For the top level, Carbone repeats everything between the `{d[i].brand}` and `{d[i+1].brand}` markers, and for the inner repeat, it uses `{d[i].models[i].size}` and `{d[i].models[i+1].size}` as endpoints.

There are other engines, e.g. [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/loops-and-nesting.html), where repetition is implicit (i.e. it has no start and end markers. Instead, it's inferred when the template contains a reference to a key that is _inside_ an array). For example, if you had the following data:

```json
[
    {
        "firstName": "Efren",
        "lastName": "Gaskill"
    }, {
        "firstName": "Sanly",
        "lastName": "Keyme"
    }, {
        "firstName": "Mark",
        "lastName": "Nigma"
    }
]
```

the following template, by referring to the properties `firstName` and `lastName`, which are properties of objects that are inside an array, trigger a repetition (in this case, of bullet points):

![a Word template that expands into a series of bullet points, one per person](./_resources/83832b13f91438bff63992d9bc73d018.png)

The issue with this approach is that, since there is no end marker, there must be some rules as to what elements are "repeatable". For example, in Plumsail only table rows, bullet lists (and numbered list) and chapters (sections, as defined by using one of the Heading styles) can be repeated.

> If you need to repeat some content that is not a table, bullet list or chapter, just create a single table cell with transparent borders and put content that you want to repeat inside.
> 
> https://plumsail.com/docs/documents/v1.x/document-generation/docx/loops-and-nesting.html

In Typst, looping is achieved by generating an array of `content` elements (which can be anything, such as paragraphs, tables, table cells, images, or whatever. Everything that is output to the PDF is a `content` in Typst.) Arrays of `content` elements are displayed one after the other.

For example, if you wanted to write a set of bullet points, you'd write [a `for` loop](https://typst.app/docs/reference/scripting/#loops) that generated one bullet point (which is internally represented by [a call to `list.item(...)`](https://typst.app/docs/reference/model/list/#definitions-item)) per item in the array:

```json
[
    {
        "firstName": "Efren",
        "lastName": "Gaskill"
    }, {
        "firstName": "Sanly",
        "lastName": "Keyme"
    }, {
        "firstName": "Mark",
        "lastName": "Nigma"
    }
]
```

```typst
#let d = json("invoice_data.json")

#repr(d)

= List of customers (#d.len() total)

#for person in d [- #person.firstName #person.lastName]
```

![a PDF document that shows a bullet list with three items, corresponding to the three elements of the input array](./_resources/7cfee14533216956f36528fadfd35e17.png)

A similar construct, albeit with more nested loops, can be used to repeat things that themselves have repetitions, such as sections where each section has a table where rows repeat:

```json
[
  {
    "brand": "Toyota",
    "models": [{ "size": "Prius 2" }, { "size": "Prius 3" }]
  },
  {
    "brand": "Tesla",
    "models": [{ "size": "S" }, { "size": "X" }]
  }
]
```

```typst
#let brands = json("invoice_data.json")

#repr(brands)

#for brand in brands {
  heading(level: 1, brand.brand)
  table(
    columns: (auto),
    table.header([*Models*]),
    ..brand.models.map(model => model.size)
  )
}
```

![a PDF document with two sections, one for each car manufacturer, where each section contains a table with car models made by that manufacturer](./_resources/6361edf59fb5a0bec50df8261dc79ec5.png)

Here we use [the `array.map()` function](https://typst.app/docs/reference/foundations/array/#definitions-map). This function is "the map function", one of the three of the holy triad [in functional programming](https://dev.to/mlevkov/the-holy-trinity-map-filter-and-reduce-381e): it's invoked on an array (here, `brand.models`), it takes a function that describes how each element of the array should be transformed (here, we receive the entire model and pick out the `size` property, which happens to be the only one), and it returns another array, of the same size as the original one, where each element has been transformed as indicated by the provided function. We then [spread](https://typst.app/docs/reference/foundations/arguments/#spreading) that array into the call to `table(...)`, so each model becomes a cell (and, since the table has only one column, each cell in turn becomes a separate row).

Of course, nothing prevents us from nesting _even more_ loops inside them. Perhaps having bullet lists inside the cells that are inside the table that is inside the repeated sections. At that point, it probably makes sense to separate parts of the code (for example, the table) to a separate "component function", which receives a single brand/manufacturer and renders that manufacturer's table.

### Formatting

All of the tools that we've been reviewing respect the formatting of the source document. In other words, if a certain template tag (e.g. `{{some_var}}`) is in a certain font, size or color, then when that tag gets replaced with its actual value, the value will also have that font, size or color. For example, observe the following Word template:

![a screenshot of a template for a list of beer ratings, where some placeholders are in large font and in other colors](./_resources/8e7c9a19e8cb7e69ae29f5695b2a0a71.png)

Once compiled, the user's name and age are in large orange font, as expected, since they're part of the title. Similarly, each beer's name is bolded, and the brewery is italicized:

![a PDF document containing a user's beer ratings, where the placeholders have been replaced by actual values, but the formatting of the placeholders has been preserved](./_resources/b68f0c69810c5214ff6f5149f8c6af47.png)

This is nice because formatting can be performed in the usual Word/WYSIWYG way, while editing the template, by selecting a bit of content and applying a format to it. Technically, what was styled isn't actually _the content_, but rather _the placeholder for the content_, but all engines handle that properly.

Typst also works well with that, because interpolating content is a first-class citizen of the language (i.e. switching between markup mode and scripting mode is a normal thing to do in the middle of, for example, a heading or a bolded block). Formatting is therefore preserved:

```typst
#let d = json("invoice_data.json")

#show emph: it => {
  text(red, it.body)
}

= Invoice #d.number

_ Hello, #d.buyer_name _
```

Here we place the invoice number within a level 1 heading, and the buyer's name inside an italics block:

![a PDF document where a variable appears as part of a title and another variable appears inside an italicized red block](./_resources/4e103adbb101c71f55ddf92e34f33a9c.png)

We've switched italics so they render in red, so you can see that the `d.buyer_name` variable is also colored (as it should be, since it's _inside_ the underscores that mark the borders of the `emph` block).

Then there's the issue of _conditional formatting_, such as coloring some table cells (those that indicate errors) in red, or perhaps specifying a color as a variable that comes in as template data (consider, for example, rendering reports in the user's preferred color, perhaps as part of a B2B application where companies can provide their logo and company color).

[In JSReport](https://jsreport.net/learn/docx#docxstyle) that can be done by [using the `docxStyle` tag](https://playground.jsreport.net/w/admin/Mc2Pdcyo):

```handlebars
{{#docxStyle textColor=user.theme.mainColor}}{{companyName}}'s Report{{/docxStyle}}
```

This can be rendered with the following JSON data:

```json
{
    "user": {
        "theme": {
            "mainColor": "green"
        }
    },
    "companyName": "ACME Co."
}
```

![a screenshot of a Word template where the color of a heading has been changed based on context data](./_resources/0cefe88ab964cb653fcf6b2ed113ee7e.png)

[Carbone](https://carbone.io/documentation.html#-color) also has a `:color` formatter that, when applied to a paragraph, table cell or table row, can change either the element's text or background color. For example, assume that the input JSON data has a key `error` with value `#FF0000`, the hexadecimal color for pure red. The following text will take that color and apply it to the entire paragraph where the tag appears:

```
The assessment did not passed {d.error:color(p)}
```

![a screenshot from Carbone's docs showing a paragraph whose text color has been changed to red, as indicated in the input JSON data](./_resources/ecfa98d1dfbf0e2661dee226f7e367c3.png)

This also works neatly to conditionally color table rows, since the `:color` formatter can alter the colors of the table row in which it appears. For example, below we have some sort of cybersecurity assessment report, where each failed test should be highlighted in red:

![a screenshot from Carbone's docs showing how to render a table where some rows are colored in red](./_resources/e060c91f004e5586da05e123ecfd97a3.png)

Typst can also do that by directly using [the `text(...)` function](https://typst.app/docs/reference/text/text/), which "Customizes the look and layout of text in a variety of ways". This function can receive [many parameters](https://typst.app/docs/reference/text/text/#parameters), and (at the end, or optionally after the call, in square brackets) a content element. This element will be displayed just as it would normally be, except that whatever parameters were provided to `text(...)` will be overridden. For example, consider the Typst document below:

```typst
#let d = json("invoice_data.json")

#text(fill: rgb(d.user.theme.mainColor))[= #d.companyName's Invoice]
```

After the line that reads the data from a JSON file, we have a call of the form `text(fill: <color>)[= A heading]`. This is syntactic sugar for a call of the form `text(fill: <color>, <content>)`, where `<color>` is in turn a call to `rgb(d.user.theme.mainColor)` (which is itself a constructor of [the `color` type](https://typst.app/docs/reference/visualize/color/), a way of initializing a `color` value from a hexadecimal string), and `<content>` contains a level 1 heading, `= #d.companyName's Invoice`, which _in turn_ interpolates a variable, `#d.companyName`. In this way, the entire document jumps three or four times between markup mode and scripting mode:

![a diagram showing how the Typst template above switches between markup and scripting mode as the template is parsed](./_resources/f8969024f95008fd69c9144d66cf5e40.png)

The example that controls the background of a table's color is also possible, because [Typst allows for a cell's properties, such as the background color, to be manually specified](https://typst.app/docs/reference/model/table/#definitions-cell):

```typst
#let d = json("invoice_data.json")

#repr(d)

#let row(test) = {
  let fillColor = if test.result == "ok" {white} else {red}
  let textColor = if test.result == "ok" {black} else {white}
  let textWeight = if test.result == "ok" {"regular"} else {"semibold"}
  let cell(content) = table.cell(fill: fillColor, text(fill: textColor, weight: textWeight, content))
  
  (cell(test.name), cell(test.result))
}

#table(
  columns: (auto, 1fr),
  align: horizon,
  table.header(
    [*Test name*], [*Success*]
  ),
  ..for t in d.tests {
    row(t)
  }
)
```

In the document above, we create a `row(test)` function, which receives a dictionary with the keys `name` and `result`, and returns all the cells (two in this case) that would make up the row in the table that corresponds to that test. It uses the test's `result` to decide whether that row should have black test on white background (in the case of passed tests, where `result = "ok"`), or white text on red background (otherwise, which are failed tests). The background color is applied to the `table.cell(...)` call, while the text color is applied to the `text(...)` call, not to `table.cell(...)`. As far as this last function is concerned, it just receives _some content_. The fact that this content happens to be colored text isn't its business. This is useful because text color is controlled in just one place, in `text(...)` calls; there's no separate "table cell text color" setting. 

`row(test)` returns an array of two cells. Since it's called in a `for...in` loop, which is then [spread](https://typst.app/docs/reference/foundations/arguments/#spreading) into the table call, it generates two cells per test (there are three tests in the sample JSON, so six cells in total, not counting the two heading cells).

![a PDF document with a table that has three "tests", one failed and two passed. The failed test's row is colored red and the text is bolded](./_resources/19e54ad910ec6a9377145d646a2c864e.png)

This example also highlights a point where Typst seems more powerful than the other templating engines that we've been comparing it to: conditional formatting can be applied to any property, not just color. Notice how the text in the failed test in the table above is bolded, it hasn't just had its text color changed to white. And the same thing could be done for the text's font family, size or alignment. By contrast, in [Carbone](https://carbone.io/documentation.html#-color) and [JSReport](https://jsreport.net/learn/docx#docxstyle) (to take two examples), setting the color is a dedicated operation, with no equivalent operation for bolding, switching the font size, or other similar operations. In Typst, however, they're all handled in exactly the same way: as arguments to the `text(...)` call.

### Images

Inserting static images in a templated document (say, your company's logo, if you're generating invoices) is trivial: they can just be inserted in the template and they'll appear on each output document.

Inserting _dynamic_ images, on the other hand, is much more difficult. Say that you're a university and want to generate student transcripts, and you want the student's picture to appear in a corner of the document. Somewhere in a web application there's a file for each student, which let's imagine they had to submit when they enrolled, or that picture was taken when they were issued their university ID card. The issue is: how can that (variable per-user) picture be inserted in the template?

This is typically done (see [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/pictures.html), [Carbone](https://carbone.io/documentation.html#pictures), [JSReport](https://jsreport.net/learn/docx#docximage)) by inserting a "placeholder image" in the template document, perhaps a blank image. Then, that [picture's Alt Text](https://support.microsoft.com/en-us/office/add-alternative-text-to-a-shape-picture-chart-smartart-graphic-or-other-object-44989b2a-903c-4d9a-b742-6a75b451c669) is used to provide the tag that indicates from where in the context the image data will be read:

![a diagram showing how an image with alt text is replaced by the image that lives at the URL indicated by that alt text](./_resources/0e57ce9828061b7f8cebdb20713a4dad.png)

Other tools (namely [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/pictures.html#insert-picture-using-text-token)) can use pure text tags, without requiring the template to have a placeholder image:

![a Word template containing a tag that will be replaced by a picture](./_resources/dac8bb0bc8c8e33537d3edfc375d1d7a.png)

As for the actual _data_ of the image, two options are commonly offered: either the variable that is mentioned in the alt text contains a URL:

```json
{
    "publicUrl": "https://plumsail.com/docs/documents/v1.x/_images/plumsail-logo.png"
}
```

or it contains the raw image data, encoded in Base64 so it can be transported on a JSON string:

```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQABLAEsAAD/4QGERXhpZgAATU0AKgAAAAgACQEPAAIAAAAGAAAAegEQAAIAAAANAAAAgAESAAMAAAABAAEAAAEaAAUAAAABAAAAjgEbAAUAAAABAAAAlgEoAAMAAAABAAIAAAExAAIAAAAUAAAAngEyAAIAAAAUAAAAsodpAAQAAAABAAAAxgAAAABDYW5vbgBDYW5vbiBFT1MgNkQAAAAAASwAAAABAAABLAAAAAFBZG9iZSBQaG90b3Nob3AgNy4wADIwMTc6MTE6MjAgMTE6MzE6MTQAAAmCmgAFAAAAAQAAATiCnQAFAAAAAQAAAUCIJwADAAAAAgDIAACQAwACAAAAFAAAAUiSCgAFAAAAAQAAAVygAQADAAAAAQABAACgAgAEAAAAAQAAAGSgAwAEAAAAAQAAAD6kNAACAAAAFwAAAWQAAAAAAAAAAQAAAFAAAAAEAAAAATIwMTY6MDM6MjYgMTM6MDg6MDcAAAAAaQAAAAFFRjI0LTEwNW1tIGYvNEwgSVMgVVNNAAD/4Qn2aHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA1LjQuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiBwaG90b3Nob3A6RGF0ZUNyZWF0ZWQ9IjIwMTYtMDMtMjZUMTM6MDg6MDciIHhtcDpNb2RpZnlEYXRlPSIyMDE3LTExLTIwVDExOjMxOjE0IiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCA3LjAiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/tAGBQaG90b3Nob3AgMy4wADhCSU0EBAAAAAAAJxwBWgADGyVHHAIAAAIAAhwCPAAGMTMwODA3HAI3AAgyMDE2MDMyNgA4QklNBCUAAAAAABDW6DtHA0U5WqoLeQsJGPlt/8AAEQgAPgBkAwERAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAwMDAwMDAwMDA//bAEMBAQEBAQEBAQEBAQICAQICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//dAAQADf/aAAwDAQACEQMRAD8A/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//Q/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//R/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//S/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//T/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//U/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//V/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//W/nfr/twP8vwoAKALFp/x9W3/AF8Q/wDoxazrfwqv+F/ka0P49D/r5H/0pH+lR/wQt/5RQfsbf9iD4h/9WH4xr/lf/aEf8pjeOP8A2MaP/qFhj/QXw5/5IvIv+vcv/Tkz9aK/jM+2CgAoA/lN/wCDiL/kr37MX/ZJ/i9/6nfwsr+KPpdfBw//ANeJ/wDp6kf72fsef+TfeOP/AGPsp/8AUHMz+dGv4WP9jAoAKACgD//Z"
}
```

If a URL is provided, the templating engine fetches the image that lives at that URL internally while rendering the document. If a Base64 string is provided instead, it can be processed directly, since it contains the image's pixels already.

In Typst, images (just like everything else) are content that is generated via function calls. Images are typically specified by a file path on disk, from where the Typst engine reads them, but it's also possible to pass the raw image data, [by using the built-in `image.decode(...)` function](https://typst.app/docs/reference/visualize/image/#definitions-decode):

```typst
#import "@preview/based:0.1.0": base64
#let d = json("invoice_data.json")
#let imgBytes = base64.decode(d.imageData.split(",").at(1))

#image.decode(imgBytes)
```

The input JSON, truncated, looks like this:

```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQABLAEsAAD/4QGERXhpZgAATU0AKgAAAAgACQEPAAIAAAAGAAAAegEQAAIAAAANAAAAgAESAAMAAAABAAEAAAEaAAUAAAABAAAAjgEbAAUAAAABAAAAlgEo..."
}
```

We need to first clean up the image data, because it starts with the `data:image/jpeg;base64,` preamble, which isn't actually part of the data. This is only there because I copied this example directly from Carbone's docs. If we were in control of the application that is generating the data, it would be possible to avoid generating that preamble.

![a PDF document where a small France flag has been inserted into the document](./_resources/901b49cd9242821525ddc90e6ef7fe5c.png)

The issue with Typst is that [it isn't possible, by design, to use web URLs for dynamic images](https://github.com/typst/typst/discussions/1219). This is because compilation of Typst documents is sandboxed _very tightly_ to prevent anything from accessing "the outside world". The Typst compiler itself can pierce the sandbox (as it does, for example, when loading images by path, when it reaches out to the local disk), but there's no functionality to read files from URLs. And, based on [this very long and detailed discussion](https://github.com/typst/typst/issues/1056), there's not much interest in adding so: adding that would, for example, expose anyone who receives Typst documents from other sources (e.g. editors in journals, reviewers) to very nasty attacks or data exfiltration. The recommended way is to have an external application (which, in the case of automatic document generation, would be whatever application wants to have the documents generated) predownload any files that are needed and place them next to the Typst source file. Or, as we discussed above in the case of reading JSON data from disk, it may be possible, if using the Rust crate or any other libraries that embed it, to intercept file reads so it's not necessary to actually write the files to disk.

In fact, there's [a package that helps with that, `prequery`](https://typst.app/universe/package/prequery/):

> Typst compilations are sandboxed: it is not possible for Typst packages, or even just a Typst document itself, to access the “ouside world”. The only inputs that a Typst document can read are files within the compilation root, and strings given on the command line via `--input`. For example, if you want to embed an image from the internet in your document, you need to download the image using its URL, save the image in your Typst project, and then show that file using the `image()` function. Within your document, the image is not linked to its URL; that step was something *you* had to do, and have to do for every image you want to use from the internet.
> 
> This sandboxing of Typst has good reasons. Yet, it is often convenient to trade a bit of security for convenience by weakening it. Prequery helps with that by providing some simple scaffolding for supporting preprocessing of documents. The process is roughly like that:
> 1. You start authoring a document without all the external data ready, but specify in the document which data you will need. (With an image for example, you’d use Prequery’s `image()` instead of the built-in one to specify not only the file path but also the URL.)
> 2. Using `typst query`, you extract a list of everything that’s necessary from the document. (For images, the command is given in `image()`’s documentation.)
> . You run an external tool (a preprocessor) that is not subject to Typst’s sandboxing to gather all the data into the expected places. (There is a *not very well implemented* Python script for image download in the gallery. For now, treat it as an example and not part of this package’s feature set!)
> 4. Now that the external data is available, you compile the document.

It works like this:

```typst
#import "@preview/prequery:0.1.0"

#prequery.image(
  "https://en.wikipedia.org/static/images/icons/wikipedia.png",
  "assets/wikipedia.png")
```

When the following command is run:

```bash
typst query --input prequery-fallback=true --field value \
    main.typ '<web-resource>'
```

it outputs a JSON document like this:

```json
[{"url": "https://en.wikipedia.org/static/images/icons/wikipedia.png", "path": "assets/wikipedia.png"}]
```

This JSON document is an array that contains one item per `prequery.image(...)` call that appears in the Typst document, and holds the `url` and `path` for each one. With this, an external tool can fetch the file that lives in `url`, then write it to the local path indicated in `path`. It can then run the render command for the Typst document (either `typst compile` directly by shelling out or, if using a library, whatever function call is used on that library to render a document).

By the way, the magical `typst query` command that generated the JSON file is [a built-in Typst utility](https://typst.app/docs/reference/introspection/query/#command-line-queries). The main idea is that, at any point in a Typst document, [the `metadata(...)` function](https://typst.app/docs/reference/introspection/metadata/) can be called. This function generates no visible output in the document, but it registers a bit of data. What that data means is left to the user, Typst just records it as it appears. Then, the `typst query` CLI command (or, from within a Typst document itself, [the `query(...)` function](https://typst.app/docs/reference/introspection/query)) can be used to ask for, for example, "all the `figure`s in the document", or "the element with tag `ref1`" (as indicated by writing `<fig1>` somewhere in the Typst document). In this case, each image that is inserted with a URL, via `prequery.image(...)`, is tagged with `<web-resource>` (multiple elements can have the same tag, or in other words, tags aren't necessarily unique identifiers of an element in the document). Therefore, when `typst query` is invoked with that tag as the selector, it fetches each instance of those images. Each image carries two pieces of metadata: a URL and a path, both of which were provided by the user. Those are output as a JSON document, which can be read by other systems.

In this way, Typst is kept pure and calm in its nice isolated side-effect-free world. Typst can assume that it'll have whatever resources it needs whenever it needs them. The wrapper application handles that.

Furthermore, if using a library that bundles the Cargo library, it's not necessary to run the `typst query` step in a shell either. For example, [the Python library](https://github.com/messense/typst-py) (which, as we've seen, actually wraps the Rust library via inter-language calls) can [run something equivalent to the `typst query` command directly](https://github.com/messense/typst-py/blob/4492759b5a06f820a0c026852022275f25bc69c4/python/typst/__init__.pyi#L100-L122):

```py
import json

import typst

imgs = json.loads(
  typst.query(
    "main.typ", 
    selector="<web-resource>", 
    field="value", 
    sys_inputs={"prequery-fallback": "true"}))

# imgs will be something like: 
# [
#   {"url": "https://en.wikipedia.org/static/images/icons/wikipedia.png", "path": "assets/wikipedia.png"}
# ]
```

From there on, the application would be able to fetch the URLs in that list, save them to the requested directory, and then run the `typst.compile` function in the same package to generate the actual PDF.

Otherwise, if the language in which the application is written doesn't embed the Cargo library directly, there's always the option of shelling out and running the `typst` CLI manually.

To recap: when generating documents from templates, it may be necessary to insert images that vary per document, such as photos, profile pictures, charts, logos, or even QR codes that are tied to the document. In Typst, this can be done by passing the image data as Base64 strings in the input JSON document. These strings can be read directly by a sibling of the `image` function that is used normally to insert static images that are read from disk, except that now, since the actual image data is passed to the template, it can vary per render. 

If the images are instead provided as (public, non-authenticated) URLs, then Typst doesn't support downloading them as part of the render process, by design, since rendering is supposed to be a sandboxed, self-contained process that involves as little from the external world as possible. However, there's [the `prequery` package](https://typst.app/universe/package/prequery), whose main example usecase is precisely to download images from URLs. It works by adding a pre-processing step in which `typst query` is run, which collects all the appearances of Web-hosted images and outputs a JSON document which contains the URL from which each image should be downloaded, and the path in which the downloaded file should be placed. An external system (here, whichever application needs a PDF rendered) should parse that JSON document, download the URLs, place them in the appropriate locations, and then re-render the Typst document, at which point it'll pick up the (now local) images and render them as normal.

### Charts

To round up the feature recap, let's look at charts. Statistical charts, to be precise, such as bar plots or pie charts.

Word [supports charts](https://support.microsoft.com/en-us/office/add-a-chart-to-your-document-in-word-ff48e3eb-5e04-4368-a39e-20df7c798932), which are internally implemented as embedded Excel documents _inside_ the Word document. Therefore, the raw data that feeds a chart is an Excel sheet. The rendering engine is also shared, or at least looks the same.

Templating engines support charts via several methods. [DOCXTemplater](https://docxtemplater.com/modules/chart/), for example, detects a chart if the title of the chart or a paragraph just before it mentions the chart's data, starting with a dollar sign:

![a Word template chart which is preceded by a paragraph with a special tag](./_resources/1d437aa744d96c6956b6fd8b8cda476c.png)

Since that is a bar chart, it has "categories" (each clump of bars) and "series" (each color of bar), each combination of which has a "value" (which determines the width of that clump+color combination). This is passed as part of the JSON context:

```json
{
	  "chart2": {
        "categories": ["5th Qtr", "6th Qtr", "7th Qtr", "8th Qtr"],
        "series": [{ "data": [130, 20, 40, 10] }],
    }
}
```

This renders into a four-category, single-series (hence single-color) plot:

![a Word chart with four bars](./_resources/5ba4f05b49a9071e4e210a16243fb6f7.png)

Therefore, the only connection between the input data (in JSON form) and the chart is the `{$chart}` tag that should appear near the chart.

Other tools, such as [Plumsail](https://plumsail.com/docs/documents/v1.x/document-generation/docx/charts.html) or [Carbone](https://carbone.io/documentation.html#native-charts), prefer to make the relationship between input (JSON) data and chart (Excel) data explicit. They allow you to edit the internal XLSX file, in the same way as if you were manually inserting data for the chart. Inside that Excel file, it's possible to use the same template tags, loops and whatever else the templater can use, so the Excel file will also be filled dynamically. Observe the image below, and notice how the Excel file that feeds the chart has been filled with a loop (this is Carbone, hence the two rows with `{d.temps[i]}` and `d.temps[i+1]`, which acts as the end marker):

![a Word document with an embedded chart being edited, showing the Excel editor that appears when doing so](./_resources/83e8dbd30eef2375a9073c01c9f3f0aa.png)

This is rendered as normal with a JSON context that looks like this:

```json
{
  "temps": [
    {
      "date": "01/07/2022",
      "min": 13,
      "max": 28,
      "avg": 20.5
    },
    ...
  ]
}
```

This generates the following PDF, as expected:

![a PDF document with a line chart of minimum, maximum and average temperatures](./_resources/9e263c7345742dd503e06982984f4c28.png)

In effect, these tools extend the templating abilities of the tool into embedded Excel documents too. When a chart is encountered, its backing Excel sheet is also templated, just as if it were part of the main document. This generates a filled sheet. This newly-generated data is then used to render the chart.

In Typst, charts could be generated [with `cetz-plot`](https://github.com/cetz-package/cetz-plot), a library that adds statistical plots to `cetz`, Typst's equivalent to TikZ in LaTeX. This library, which is still very new, supports bar, column and pie charts (no scatter plots or line charts yet)

![a XY plot of three functions, with colored regions](https://github.com/cetz-package/cetz-plot/raw/master/gallery/line.png)

![a pie chart](https://github.com/cetz-package/cetz-plot/raw/master/gallery/piechart.png)

There's also [`typst-plotting`](https://github.com/Pegacraft/typst-plotting), which [can draw](https://github.com/Pegacraft/typst-plotting/blob/master/example/Plotting.pdf) scatter, line, histogram, pie and bar charts, plus some more exotic chart types such as radar charts and box-and-whiskers:

![two line plots, one where points are joined with straight lines, and another where they're joined with curves](https://github.com/Pegacraft/typst-plotting/raw/master/images/graph.png)

![a bar chart with five colored horizontal bars, one for each working day of the week](https://github.com/Pegacraft/typst-plotting/raw/master/images/bar.png)

And [`neoplot`](https://typst.app/universe/package/neoplot), which provides a way to embed [Gnuplot](http://www.gnuplot.info/) (which, despite its name, is _not_ related to the GNU project), a very robust plotting framework used, among others, by [GNU Octave](https://octave.org/), the open-source alternative (not necessarily replacement, though) to Matlab. Gnuplot is more aimed at function plotting (i.e. 2D `y=f(x)` and 3D `z=f(x, y)` functions), so it can be used in that case. It can, however, also be used for stats charts (which I know because Octave can render them, so Gnuplot must be able to).

There's also [`nulite`](https://typst.app/universe/package/nulite/), which embeds [Vega-Lite](https://vega.github.io/vega-lite/). Vega-Lite is a language, based on JSON, that can specify the data and the visualization, in a similar manner to [Plotly's JSON syntax](https://plotly.com/javascript/reference/index/). Since `nulite` is mostly a pass-through to Vega-Lite, it follows that it can render whatever Vega-Lite supports, [which is a lot](https://vega.github.io/vega-lite/examples/#single-view-plots).

`nulite` uses [the `ctxjs` package](https://typst.app/universe/package/ctxjs/) under the hood. This is "A Typst plugin to evaluate javascript code". It can load JS modules directly on Typst and run them. `nulite` uses it because Vega-Lite is developed and distributed as a JS library, which is then brought into Typst's plugin environment. In particular, `ctxjs` is a Rust plugin that uses [the `rquickjs` Rust bindings](https://github.com/DelSkayn/rquickjs) to [the QuickJS Javascript engine](https://bellard.org/quickjs/), which is what actually interprets and runs the JS code. This is an alternative implementation of a Javascript interpreter, different to that used by browsers (for example, Chromium uses [V8](https://v8.dev/), Firefox uses [SpiderMonkey](https://spidermonkey.dev/), Safari uses... something?) and server/other environments (for example, Node.js, Electron and Deno all use V8). They're all supposed to perform the same tasks (take in Javascript files, text files, and run them performing whatever steps the files contain) in the same way (which is defined in the [ECMAScript specification](https://tc39.github.io/ecma262/) and its [accompanying Conformance Test Suite](https://github.com/tc39/test262), which "covers every observable behavior specified in the ECMA-414 Standards Suite")

Thus, `nulite`, via `ctxjs`, via `rquickjs`, via QuickJS, embeds an actual Javascript interpreter. This interpreter is then used to load and run the (unmodified, as far as I can see) Vega-Lite visualization library. All of this is done out of view of the user of `nulite`. The user just feeds JSON documents (AKA Vega-Lite specs) that are used by Vega-Lite to lay out and render a chart, such as a bar chart or scatter plot. The result of this call to Vega-Lite is [a Vega spec](https://vega.github.io/vega/), another JSON document that is fed to Vega, a related project that actually generates the visualizations (in this sense, Vega-Lite is just a higher-level library that abstracts away the chore of specifying each aspect of the charts, using sensible defaults, and [hides the lower-level Vega (sans -Lite) syntax](https://vega.github.io/vega-lite/usage/compile.html)). Vega (which is also included and run in the QuickJS Javascript interpreter that is bundled with `nulite`) [renders the chart to SVG](https://vega.github.io/vega/docs/api/view/#view_toSVG), which Typst [natively supports](https://typst.app/docs/reference/visualize/image/#parameters-format), and is included into the document just as if it were imported from disk.

As you can see, even in Typst's fairly early stage of life, there's already several packages for rendering charts, including at least two (`neoplot`, which calls Gnuplot; and `nulite`, which embeds Vega) that make use of very robust, external plotting libraries, thus giving Typst very mature plotting capabilities. In other words, Typst already has, through those libraries, charts comparable to those of Matplotlib or Octave, in terms of capabilities and aesthetics. In fact, it could be argued that, just by having Gnuplot or Vega available, Typst is _already_ better than Word, which is not a dedicated statistical plotting program. Word charts are nice and useful and all, but still... Compare this:

![a stacked 3D bar chart generated in Excel](./_resources/1ec71f45aa3f279386244b9e228a8403.png "An Excel chart")

with this:

![a horizontal stacked bar chart generated in Vega](./_resources/visualization.png "A Vega chart")

(Okay, I'm intentionally using one of the worst Excel visualization types, a 3D bar chart. You get the point, though)

Let's replicate [an example from DOCXTemplater](https://docxtemplater.com/modules/chart/#viewport) in Typst, using `nulite`, which uses Vega. As a reminder, the original chart (made in Word) looks like this:

![a bar chart in a Word document with four horizontal bars](./_resources/6ddf35089e54e2b0571479b0932da760.png)

The Typst document is as follows:

```typst
#import "@preview/nulite:0.1.0" as nulite
#let d = json("invoice_data.json")

#repr(d)

#nulite.render(
  width: 50%,
  height: 20%,
  zoom: 1,
  (
    data: (values: d),
    mark: "bar",
    encoding: (
      x: (field: "val", type: "quantitative"),
      y: (field: "qtr", type: "nominal"),
    )
  )
)
```

This is rendered with the following JSON data:

```json
[
  {"qtr": "5th Qtr", "val": 130},
  {"qtr": "6th Qtr", "val": 20},
  {"qtr": "7th Qtr", "val": 40},
  {"qtr": "8th Qtr", "val": 10}
]
```

and generates the following PDF:

![a PDF document with a bar chart generated with Vega](./_resources/5f3ea6e42ba5bfd86e66e60c85cd84b4.png)

Of course, anything that is possible with Vega should also possible here, absent any weird bugs in the QuickJS interpreter or the magical bundling into a Typst plugin.

To recap: Word templating engines (e.g. Carbone, Plumsail, DOCXTemplater, and so) typically offer a way to render those statistical charts that can be inserted natively in Word (that is, not image, but actual charts that are backed by an actual Excel spreadsheet that is embedded in the Word document). This is sometimes done by extending the templating logic of the engine (e.g. the fact that writing `{{some_var}}` or something to that effect looks up `some_var` in the JSON context and inserts its value at that point, or a way to perform loops) into Excel too, such that it's possible to use data that is passed via the JSON context (say, an array of records, each with a label and a number) to "fill up" the Excel sheet that will then render, say, a pie chart. In this way, rendered documents can include charts whose values change with each render, according to the JSON context passed to each render.

Typst doesn't support that natively (it's a typesetting system, after all, not a plotting library), but there are plenty of packages already that do so. For example, `cetz-plot` is a part of CetZ, Typst's _de facto_ standard graphing library, which supports several types of charts. There are some more independent graphing libraries. There's also `neoplot`, which leverages Gnuplot, a third-party, very mature graphing library (also used, among other things, in GNU Octave). And finally (and my personal favorite), there's `nulite`, which allows the use of Vega and Vega-Lite specs to render very configurable and fairly modern-looking charts, of [all sorts of different types](https://vega.github.io/vega-lite/examples/). Charts are typically inserted as SVG documents, vector images, not PNG or JPEG raster images, which is nice when zooming in.

## Conclusions

In this (very long) article, we've reviewed Typst, a very young (at least when compared to LaTeX and Word) typesetting system that is similar in spirit and intended usage to LaTeX. It was conceived by two German academics, and its main audience is academia, where papers are written, containing Sections, an Abstract, several authors, each with his own affiliation, Figure 1s, Equation 2s, and IEEE citations.

The name Typst is applied to both the _compiler_ (i.e. an application that takes in a Typst file and generates a PDF document) and to the _language_ itself (i.e. the syntax that should be obeyed in those files that will be passed to the compiler). Typst is also a web application, similar to Overleaf and other online  collaborative LaTeX editors, which has paid plans. The compiler and the language, however, [are all properly open sourced](https://github.com/typst/typst?tab=Apache-2.0-1-ov-file#readme) ([like LaTeX](https://www.latex-project.org/publications/2011-FMi-TUB-tb100mittbach-lppl-history.pdf)), so hopefully there's no drama lurking there.

Like LaTeX and Markdown, and unlike Word, Typst's source documents are plain text that can be read and edited in any ultra-basic text editor. Also unlike Word, to see the modifications you need to recompile the source document and generate the output PDF, i.e. you don't edit the preview of the document, as is done in Word, where selecting a word and bolding it instantly changes _the same word_ that was selected. Typst's compilation times are supposed to be faster than LaTeX's (I've seen on the order of tens of *milli*seconds when rerendering a document where not much has changed), and it has incremental compilation (i.e. it can reuse parts of the previous compilation, maybe things like entirely skipping a paragraph if it hasn't changed since the previous time). Typst can therefore provide a live preview of changes (i.e. you type and the PDF at the side changes in near-real-time), which LaTeX tools like Overleaf don['t typically support](https://www.reddit.com/r/LaTeX/comments/17dw2r4/is_there_latex_editor_that_compilesrenders_as_you/), because it may be slightly not-fast-enough.

Typst's syntax is, at least in the common cases, fairly more lightweight than that of LaTeX. The syntax overhead for common cases (i.e. the amount of characters that must be used to mark common formatting constructs such as headings or bold letters) is on par with Markdown (e.g. `= Title` for titles, `*bold*` for bolding, as opposed to `\section{Title}` and `\textbf{bold}` respectively).

Typst, like LaTeX, embeds a "scripting engine" (equivalent to LaTeX's macros), which can be interleaved with the actual content (called _markup_) and is able to generate content itself. For example, a script can insert the content of a variable (which has been declared beforehand in script-land) into the document. Or it can use a loop to generate a set of bullet points or table rows, such that it's not necessary to type them all out by hand, or several representations of the same data can always be kept up-to-date.

Then, we explored the applicability of Typst to the job of generating, not hand-written papers, but instead machine-generated documents (e.g. invoices, reports, certificates, and such) where _a template_ is hand-designed and provided with placeholders, and then that template is repeatedly _rendered_ with different data in each invocation. These are normally driven from a larger application: e.g. an e-learning site may wish to issue certificates of course completion to students, normally subject to the payment of a modically exorbitant sum of galactic credits. Or a bank that offers a button where account holders can generate and download a letter that certifies, To Whom It May Concern, that person Such-And-Such has account #Something open in this bank.

An alternative for generating such automated documents can be found in Word-based templating engines, such as Carbone, Plumsail, DOCXTemplater, JSReport, Docmosis and Templater. These use a normal Word document, filled with magical syntax, as the template. The advantage of such systems is that everyone (who uses Windows, that is) will most likely already have the template editor installed (it's Word, after all), and that, at least for simple cases such as replacing a variable (e.g. "Dear X Y"), the template looks very similar to the documents that it will generate. For more complex constructs, such as paragraphs that should only be shown when a certain condition is true, things may get weirder (some engines, for example, require that you wrap the paragraph in question in a single-row, single-column table with invisible borders, so it can be hidden or shown as a block).

Typst, since it has a scripting engine, is also capable of expressing the conditions that typical templating engines use. Inserting a variable value into the document is done by just switching to scripting mode and inserting that variable. Loops (such as repeating bullet points, table rows, figures or entire sections) are also possible. Conditional display of content (i.e. content that appears and disappears depending on some condition) is possible since Typst has the concept of a "null" value, actually the absence of a value, that can be used at any point and generates no output. Therefore, it's possible to make content appear or disappear by switching in either the actual content or the null value. Finally, since content can also be styled (e.g. the text color can be set) and all Typst syntax ultimately resolves to function calls (e.g. the title `== Heading` is internally interpreted as a function call similar to `heading(level: 2, "Heading")`), it's possible to dynamically style content by using the raw function calls instead of the syntactic sugar and using the appropriate styling parameters, which can now be controlled by the input values for _this particular_ rendering of the template.

Dynamic images can also be inserted by passing them as Base-64 encoded strings, which can then be interpreted by Typst just as if they had just been read from disk, which is "the normal" way of using images when writing papers. Word templating engines also tend to support this. In Typst, however, it's not possible, by design, to use a URL as the source for an image, since Typst wants to treat compilation as an isolated, sandboxed process. There are some workarounds for it that involve a pre-processing step where an external system (which, in the case of automated document generation, could very well be the external application that is driving the process) retrieves information about which URLs are mentioned in the document, then downloads them and places them on local files, and then the Typst document can be rendered as normal, reading the images from disk as necessary.

Finally, Word templating engines also tend to support Word's native charts, which are backed by an internal Excel sheet. This is usually done by allowing said Excel sheet to be templated like the Word document, thereby allowing variable data to be inserted into the sheet, which then causes the chart to change (e.g. bar lengths change, pie sections are added and their angles change, scatter points are added, and so on). In Typst, charts can be added via several packages. Some internally use CetZ, which is used to render arbitrary graphics, in terms of basic graphical elements such as lines, arrows, points, rectangles, circles and polygons. At least one package delegates the chart generation to Gnuplot, which receives commands in [its own special language](https://lwn.net/Articles/628537/). And another embeds and delegates to Vega, a Javascript library that is used to generate plots, one of Javascript's equivalents to Python's Matplotlib or Seaborn (another fairly common one is Plotly). By using Vega, Typst inherits all kinds of charts, which can be rendered from a JSON document, which Typst handles just fine.

In conclusion, we've seen how Typst can be used as a general-purpose document typesetting system, in the same areas as LaTeX (i.e. academic papers and such), and also in other areas. In particular, we reviewed the case of automatically generating documents from templates, in which the structure is fixed (more or less, since pieces may be repeated, or appear and disappear) but the content changes per document (such as reports or certificates that must be emitted with different content each time, but keeping the same style and general structure). We saw how, combining Typst's basic markup constructs (e.g. titles, lists, images, tables) with Typst's scripting engine (which adds the ability to read data as part of the document render, insert that data into the document as-is, or use the data to control the rendering of the document, such as repeating a table row for each item in an array), it's possible to write Typst documents that change themselves based on input data. This is all done without any reliance on text templating systems such as those typically used to generate HTML in server-side frameworks (e.g. Handlebars or Mustache, or Jinja or Django's templates, or Go's templating language, or Twig). Instead of such text-replacement systems, which don't take into account the specific syntax of the file that is being templated (i.e. if we used one of those systems here, it wouldn't be aware of Typst's syntax and could therefore introduce nonsensical syntax), we use Typst's native facilities to keep all processing Typst-aware. Things that aren't available in Typst proper, such as charting, can be handled (and, indeed, have been handled already!) by plugins that, thanks to WebAssembly, can have some very powerful abilities, up to and including embedding an entire Javascript interpreter in which third-party Javascript libraries, that know nothing about the Typst project, can be loaded and used.

Overall, Typst seems like a very nice project. It's a joy to work with, and very powerful if you want it to. The scripting system can be made to work in fairly advanced ways, it's not just a gimmick. Since it's very new, it can get inspiration from all sorts of modern ideas (observe: functions as first-class values, lambda expressions, a modern syntax for the language, Markdown's lightweight markup syntax, JSON as an interchange format, WebAssembly for plugins, a first-class web application, which also causes an insistence on live reloading). If you're in academia or in any other environment (if there are any) where LaTeX is popular, consider giving Typst a whirl.

[^1]: Though it should be noted that even the Typst CLI, a single-user application, doesn't allow arbitrary file reads. In particular, only files within the _project root_, which by default is the directory where the `.typ` file that is being compiled resides, can be read. So no `read("/etc/passwd")`, unless the user were to explicitly switch the project root to `/` or `/etc`
