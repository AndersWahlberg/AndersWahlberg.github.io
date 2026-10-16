# Adding a post

No CMS, Node setup or local build is needed. You can write directly on GitHub.

1. Open the `_posts` folder.
2. Create a new `.md` file (GitHub: **Add file → Create new file**).
3. Name it `YYYY-MM-DD-title-slug.md`, for example `2026-10-16-learning-by-writing.md`.
4. Copy the template below. Replace the title, date, description and tags.
5. Write normal Markdown below the closing `---`.
6. Commit the file to `main`.
7. GitHub Pages builds and publishes the article automatically. It appears in Writing, newest first, and replaces the empty state.

Use today's date or an earlier date, matching the filename. Future-dated posts are hidden until a build runs after their date; Pages does not schedule a build for that date automatically. Dates use Europe/Helsinki. Tags are optional; remove the tags block if unnecessary. The post layout is assigned automatically.

## Copy-paste template

````markdown
---
title: "Learning by writing"
date: 2026-10-16
description: "A short, specific introduction to this article."
tags:
  - Software
  - Learning
---

Write your introduction here.

## A section heading

Write the rest of your article here.
````

## Markdown basics

The layout already supplies the article's main heading from `title`.
`# Heading` is a main heading; start sections inside a post with `## Heading`, then `### Subheading`.

````markdown
**bold** and *italic*

[link text](https://example.com)

- First item
- Second item

> A quotation or thought to highlight.

Use `inline code` within a sentence.

```java
System.out.println("Hello");
```

![Describe the image](/assets/your-image.webp)
````

For images, upload the file to `assets/`, use a descriptive filename and meaningful alt text. Do not upload private files or location metadata. Preview your post after publishing. Use headings, short paragraphs and descriptive links.

## One-time GitHub Pages setting

Under **Settings → Pages**, use **Deploy from a branch**, branch **main**, folder **/ (root)**. Native Jekyll processes Markdown and layouts while keeping the existing plain HTML homepage intact. Do not add `.nojekyll`. No custom workflow is required. This change does not alter repository settings automatically.

See [GitHub's Jekyll publishing guide](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/adding-content-to-your-github-pages-site-using-jekyll).
