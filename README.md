# Spring 2026 CS336 Lectures

This repository contains Stanford CS336 lecture materials and a generated static learning site. The site turns `lecture_XX.py` executable lectures and `lecture_XX.pdf` files into an active-reading textbook with lecture pages, quick checks, quizzes, flashcards, and lightweight interactives.

## Install

```bash
uv sync
npm install
```

`markdown-it-py` is used by the local generator for Markdown rendering. PDF text extraction is attempted only when `pypdf` or `pdfminer.six` is available; otherwise the generator creates a clear placeholder page that links to the original PDF.

## Generate Content

```bash
uv run python scripts/generate-content.py
npm run generate
```

The generator discovers files named `lecture_XX.py` and `lecture_XX.pdf` from the repository root. It does not execute lecture Python files. Python lectures are parsed with `ast` to extract static `text(...)`, `image(...)`, `link(...)`, `article_link(...)`, `post_link(...)`, and `video_link(...)` calls, plus selected source snippets marked by inspection comments or assertions.

Generated files are written to:

```text
content/lectures/lecture_XX.md
content/quizzes/lecture_XX.json
content/checks/lecture_XX.json
content/flashcards/lecture_XX.json
content/interactives/lecture_XX.json
content/flashcards/index.json
content/manifest.json
public/data/site-data.json
public/pages/lecture_XX.html
```

Lecture images are copied to `public/images/`, and PDF sources are copied to `public/sources/` so the built site works as static files.
The `public/pages/lecture_XX.html` files are static entry points for each lecture and route into the interactive app.

## Run Locally

```bash
npm run generate
npm run dev
```

Open `http://127.0.0.1:5173/lectures/`.

## Build

```bash
npm run build
npm run preview
```

Preview serves the static build at `http://127.0.0.1:4173/lectures/`.

## Validate

```bash
npm run generate
npm run build
npm run validate
```

The validation script checks that every detected lecture has generated Markdown, quiz data, quick-check data, flashcards, interactive metadata, and aggregate site data. It also checks for at least one Python lecture extraction, one PDF page or placeholder, one code sandbox placeholder, and one slider interactive.

## Adding a Lecture

Add a new file at the repository root named `lecture_XX.py` or `lecture_XX.pdf`, then run:

```bash
npm run generate
```

For Python lectures, prefer static edtrace-style calls:

```python
text("## Section title")
text("A concise explanation with **important terms**.")
image("images/example.png", width=600)
link(title="paper", url="https://arxiv.org/abs/0000.00000")
```

The generator preserves source order for extracted calls and selected code snippets. It skips dynamic call arguments it cannot safely evaluate.

## Generated Markdown Shape

Each generated Markdown file starts with front matter:

```yaml
---
id: lecture_01
lecture_number: 1
title: Lecture 01: CS336
source_file: lecture_01.py
source_type: py
generated_status: extracted
---
```

The body contains extracted text, image tags, links, and fenced code blocks. Edit the source lecture or generator rather than editing generated Markdown directly.

## Quiz Data Shape

Quiz files use JSON:

```json
{
  "lectureId": "lecture_01",
  "partial": false,
  "questions": [
    {
      "id": "lecture_01-quiz-mc-1",
      "type": "multiple-choice",
      "prompt": "Which statement appears in this lecture section?",
      "choices": ["..."],
      "answer": "...",
      "explanation": "...",
      "sectionId": "lecture_01-section",
      "sectionTitle": "Section"
    }
  ]
}
```

Question generation is deterministic and heuristic. Questions are based on extracted source sentences, headings, bold text, code-like phrases, and selected snippets.

## Quick-Check Data Shape

Quick checks are stored in `content/checks/lecture_XX.json`:

```json
{
  "lectureId": "lecture_01",
  "partial": false,
  "checks": [
    {
      "id": "lecture_01-section-check-mc",
      "type": "multiple-choice",
      "prompt": "Which statement is supported by this section?",
      "choices": ["..."],
      "answer": "...",
      "explanation": "...",
      "sectionId": "lecture_01-section"
    }
  ]
}
```

The frontend renders these inline and persists answers in `localStorage`.

## Flashcard Data Shape

Per-lecture flashcards are stored in `content/flashcards/lecture_XX.json`, and the aggregate deck is stored in `content/flashcards/index.json`:

```json
{
  "id": "lecture_01-card-1",
  "front": "What does this lecture emphasize about tokenization?",
  "back": "Extracted source sentence.",
  "lectureId": "lecture_01",
  "sectionId": "lecture_01-tokenization",
  "tags": ["tokenization"],
  "difficulty": "easy"
}
```

The flashcard page supports flip, next, previous, lecture filter, tag filter, shuffle, known/review-again markers, and local progress persistence.

## Interactive Metadata Shape

Interactive metadata is stored in `content/interactives/lecture_XX.json`:

```json
{
  "lectureId": "lecture_02",
  "interactives": [
    {
      "id": "lecture_02-js-sandbox",
      "type": "code-sandbox",
      "kind": "javascript-worker",
      "safeExecution": true
    },
    {
      "id": "lecture_02-memory",
      "type": "slider",
      "kind": "memory",
      "title": "Memory Accounting",
      "synthetic": true
    },
    {
      "id": "lecture_02-sandbox-1",
      "type": "code-sandbox",
      "kind": "python-placeholder",
      "safeExecution": false
    }
  ]
}
```

Slider demos are synthetic and labeled as illustrative. JavaScript sandboxes execute in a disposable Web Worker with a timeout and blocked network/dynamic import hooks. Python snippets remain editable static sandboxes with reset and reveal controls; browser execution is intentionally disabled for extracted Python.

## Known Limitations

PDF extraction depends on optional local parsers. When neither `pypdf` nor `pdfminer.six` is installed, PDF lectures become placeholders that link to the original file.

Quiz, quick-check, and flashcard generation is heuristic. It favors exact extracted wording and simple concept extraction over invented pedagogy, so some prompts are mechanical.

Code sandboxes execute generated JavaScript demos in the browser. They do not execute arbitrary extracted Python in the browser; Python snippets provide editable snippets, reset controls, and expected inspection targets for future safe execution work.

Interactives are generic slider demos or placeholders generated from detected keywords. They are useful for lightweight exploration, not precise simulations of the lecture math.
