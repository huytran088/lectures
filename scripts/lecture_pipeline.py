from __future__ import annotations

import ast
import html
import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from markdown_it import MarkdownIt
except ImportError:  # pragma: no cover - validation checks the preferred path.
    MarkdownIt = None


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content"
PUBLIC_DIR = ROOT / "public"
DATA_DIR = PUBLIC_DIR / "data"

LECTURE_RE = re.compile(r"lecture_(\d{2})\.(py|pdf)$")
WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9_+-]{2,}")
STOPWORDS = {
    "about",
    "above",
    "after",
    "again",
    "against",
    "also",
    "because",
    "before",
    "being",
    "between",
    "could",
    "course",
    "during",
    "every",
    "example",
    "following",
    "given",
    "however",
    "important",
    "lecture",
    "lectures",
    "model",
    "models",
    "next",
    "other",
    "should",
    "something",
    "these",
    "thing",
    "things",
    "today",
    "using",
    "where",
    "which",
    "while",
    "would",
}


@dataclass
class LectureFile:
    lecture_id: str
    number: int
    path: Path
    source_type: str


@dataclass
class ExtractedLecture:
    lecture_id: str
    number: int
    source_file: str
    source_type: str
    status: str
    components: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def slugify(value: str, fallback: str = "section") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or fallback


def literal_string(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def literal_number(node: ast.AST | None) -> int | float | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    return None


def call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def clean_markdown_text(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text.strip())


def strip_markdown(value: str) -> str:
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"\1", value)
    value = re.sub(r"\*([^*]+)\*", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).strip()


def split_sentences(text: str) -> list[str]:
    text = strip_markdown(text)
    text = re.sub(r"\s+", " ", text)
    parts = re.split(r"(?<=[.!?])\s+", text)
    sentences = []
    for part in parts:
        part = part.strip(" -")
        if 45 <= len(part) <= 220 and len(part.split()) >= 6:
            sentences.append(part)
    return sentences


def extract_terms(text: str) -> list[str]:
    terms: list[str] = []
    for pattern in (r"\*\*([^*]{3,80})\*\*", r"`([^`]{3,80})`"):
        for match in re.findall(pattern, text):
            term = strip_markdown(match)
            if term and term.lower() not in STOPWORDS:
                terms.append(term)
    for line in text.splitlines():
        if line.startswith("#"):
            heading = strip_markdown(line.lstrip("#").strip())
            if heading and len(heading) <= 80:
                terms.append(heading)
    for word in WORD_RE.findall(strip_markdown(text)):
        lowered = word.lower()
        if lowered not in STOPWORDS and (word.isupper() or "_" in word or len(word) > 8):
            terms.append(word)
    return unique_preserve_order(terms)[:18]


def unique_preserve_order(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        key = value.lower()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def read_reference_map(root: Path) -> dict[str, dict[str, str]]:
    path = root / "references.py"
    if not path.exists():
        return {}
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:
        return {}
    refs: dict[str, dict[str, str]] = {}
    for stmt in tree.body:
        if not isinstance(stmt, ast.Assign) or not isinstance(stmt.value, ast.Call):
            continue
        targets = [target.id for target in stmt.targets if isinstance(target, ast.Name)]
        if not targets:
            continue
        name = targets[0]
        func = call_name(stmt.value.func)
        if func not in {"Reference", "url_reference"}:
            continue
        title = name.replace("_", " ")
        url = ""
        if func == "url_reference" and stmt.value.args:
            url = literal_string(stmt.value.args[0]) or ""
        for kw in stmt.value.keywords:
            if kw.arg == "url":
                url = literal_string(kw.value) or url
            elif kw.arg == "title":
                title = literal_string(kw.value) or title
        refs[name] = {"title": title, "url": url}
    return refs


def discover_lectures(root: Path = ROOT) -> list[LectureFile]:
    lectures = []
    for path in sorted(root.glob("lecture_??.*")):
        match = LECTURE_RE.match(path.name)
        if not match:
            continue
        number = int(match.group(1))
        source_type = match.group(2)
        lectures.append(LectureFile(f"lecture_{number:02d}", number, path, source_type))
    return sorted(lectures, key=lambda item: (item.number, item.source_type))


class LectureCallExtractor(ast.NodeVisitor):
    def __init__(self, source: str, references: dict[str, dict[str, str]]):
        self.source = source
        self.references = references
        self.components: list[dict[str, Any]] = []
        self.warnings: list[str] = []

    def visit_Call(self, node: ast.Call) -> Any:
        name = call_name(node.func)
        if name in {"text", "image", "link", "article_link", "post_link", "video_link"}:
            component = self.extract_component(name, node)
            if component:
                component["line"] = getattr(node, "lineno", 0)
                component["column"] = getattr(node, "col_offset", 0)
                self.components.append(component)
            return
        self.generic_visit(node)

    def extract_component(self, name: str, node: ast.Call) -> dict[str, Any] | None:
        if name == "text":
            value = literal_string(node.args[0]) if node.args else None
            if value is None:
                self.warnings.append(f"Skipped dynamic text() call on line {node.lineno}.")
                return None
            return {"type": "markdown", "text": clean_markdown_text(value)}

        if name == "image":
            url = literal_string(node.args[0]) if node.args else None
            if not url:
                self.warnings.append(f"Skipped dynamic image() call on line {node.lineno}.")
                return None
            width = None
            alt = "Lecture image"
            for kw in node.keywords:
                if kw.arg == "width":
                    width = literal_number(kw.value)
                elif kw.arg == "alt":
                    alt = literal_string(kw.value) or alt
            return {"type": "image", "url": url, "alt": alt, "width": width}

        link = self.extract_link(name, node)
        if link:
            return {"type": "link", **link}
        self.warnings.append(f"Skipped dynamic {name}() call on line {node.lineno}.")
        return None

    def extract_link(self, name: str, node: ast.Call) -> dict[str, str] | None:
        title = {"article_link": "article", "post_link": "post", "video_link": "video"}.get(name, "reference")
        url = ""
        for kw in node.keywords:
            if kw.arg == "title":
                title = literal_string(kw.value) or title
            elif kw.arg == "url":
                url = literal_string(kw.value) or url
        if node.args:
            first = node.args[0]
            direct = literal_string(first)
            if direct:
                url = direct
                if name == "link":
                    title = title_from_url(direct)
            elif isinstance(first, ast.Name) and first.id in self.references:
                ref = self.references[first.id]
                title = ref.get("title") or first.id
                url = ref.get("url") or ""
            elif name == "link":
                title = ast.unparse(first)
        if not url and name != "link":
            return None
        return {"title": title, "url": url}


def title_from_url(url: str) -> str:
    if url.startswith("http"):
        host = re.sub(r"^https?://", "", url).split("/")[0]
        return host or "link"
    return Path(url).name or "link"


def is_extraction_expr(stmt: ast.stmt) -> bool:
    if not isinstance(stmt, ast.Expr):
        return False
    calls = [node for node in ast.walk(stmt.value) if isinstance(node, ast.Call)]
    return any(call_name(call.func) in {"text", "image", "link", "article_link", "post_link", "video_link"} for call in calls)


def collect_code_components(tree: ast.AST, source: str) -> list[dict[str, Any]]:
    components: list[dict[str, Any]] = []

    def walk_statements(statements: list[ast.stmt]) -> None:
        for stmt in statements:
            if is_extraction_expr(stmt):
                continue
            segment = ast.get_source_segment(source, stmt) or ""
            line_count = len(segment.splitlines())
            should_record = "# @inspect" in segment or (
                isinstance(stmt, ast.Assert) and line_count <= 5
            )
            if should_record:
                components.append(
                    {
                        "type": "code",
                        "language": "python",
                        "code": segment.strip(),
                        "line": getattr(stmt, "lineno", 0),
                        "column": -1,
                    }
                )
                continue
            for attr in ("body", "orelse", "finalbody"):
                body = getattr(stmt, attr, None)
                if isinstance(body, list):
                    walk_statements(body)

    for node in ast.iter_child_nodes(tree):
        body = getattr(node, "body", None)
        if isinstance(body, list):
            walk_statements(body)
    return components


def code_component_for_stmt(stmt: ast.stmt, source: str) -> dict[str, Any] | None:
    if is_extraction_expr(stmt):
        return None
    segment = ast.get_source_segment(source, stmt) or ""
    line_count = len(segment.splitlines())
    should_record = "# @inspect" in segment or (isinstance(stmt, ast.Assert) and line_count <= 5)
    if not should_record:
        return None
    return {
        "type": "code",
        "language": "python",
        "code": segment.strip(),
        "line": getattr(stmt, "lineno", 0),
        "column": -1,
    }


def local_function_call(stmt: ast.stmt, functions: dict[str, ast.FunctionDef]) -> str | None:
    if not isinstance(stmt, ast.Expr) or not isinstance(stmt.value, ast.Call):
        return None
    name = call_name(stmt.value.func)
    if name in functions:
        return name
    return None


def collect_ordered_components(
    tree: ast.Module,
    source: str,
    references: dict[str, dict[str, str]],
) -> tuple[list[dict[str, Any]], list[str]]:
    functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
    warnings: list[str] = []
    components: list[dict[str, Any]] = []
    order = 0

    def append(component: dict[str, Any]) -> None:
        nonlocal order
        component["order"] = order
        order += 1
        components.append(component)

    def visit_statement(stmt: ast.stmt, stack: tuple[str, ...]) -> None:
        function_name = local_function_call(stmt, functions)
        if function_name and function_name not in stack:
            visit_statements(functions[function_name].body, (*stack, function_name))
            return

        code_component = code_component_for_stmt(stmt, source)
        if code_component:
            append(code_component)
            return

        extractor = LectureCallExtractor(source, references)
        extractor.visit(stmt)
        warnings.extend(extractor.warnings)
        for component in sorted(extractor.components, key=lambda item: (item.get("line", 0), item.get("column", 0))):
            append(component)

        if extractor.components:
            return

        for attr in ("body", "orelse", "finalbody"):
            body = getattr(stmt, attr, None)
            if isinstance(body, list):
                visit_statements(body, stack)

    def visit_statements(statements: list[ast.stmt], stack: tuple[str, ...]) -> None:
        for stmt in statements:
            visit_statement(stmt, stack)

    if "main" in functions:
        visit_statements(functions["main"].body, ("main",))
    else:
        for stmt in tree.body:
            visit_statement(stmt, tuple())

    components.sort(key=lambda item: item.get("order", 0))
    return components, warnings


def extract_python_lecture(lecture: LectureFile, references: dict[str, dict[str, str]]) -> ExtractedLecture:
    source = lecture.path.read_text(encoding="utf-8")
    extracted = ExtractedLecture(
        lecture_id=lecture.lecture_id,
        number=lecture.number,
        source_file=lecture.path.name,
        source_type="py",
        status="extracted",
    )
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        extracted.status = "placeholder"
        extracted.warnings.append(f"Python parse failed: {exc}")
        extracted.components.append(
            {
                "type": "markdown",
                "text": f"## Extraction placeholder\n\nCould not parse `{lecture.path.name}` as Python, so no lecture text was extracted.",
                "line": 1,
                "column": 0,
            }
        )
        return extracted

    components, ordered_warnings = collect_ordered_components(tree, source, references)
    extracted.components = components
    extracted.warnings.extend(ordered_warnings)
    if not extracted.components:
        extracted.status = "placeholder"
        extracted.warnings.append("No static text/image/link calls were extracted.")
        extracted.components.append(
            {
                "type": "markdown",
                "text": f"## Extraction placeholder\n\n`{lecture.path.name}` was detected, but no static edtrace-style calls were found.",
                "line": 1,
                "column": 0,
            }
        )
    return extracted


def extract_pdf_lecture(lecture: LectureFile) -> ExtractedLecture:
    extracted = ExtractedLecture(
        lecture_id=lecture.lecture_id,
        number=lecture.number,
        source_file=lecture.path.name,
        source_type="pdf",
        status="placeholder",
    )
    pdf_text = ""
    parser = "none"
    try:
        from pypdf import PdfReader  # type: ignore

        parser = "pypdf"
        reader = PdfReader(str(lecture.path))
        pdf_text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        try:
            from pdfminer.high_level import extract_text  # type: ignore

            parser = "pdfminer.six"
            pdf_text = extract_text(str(lecture.path))
        except Exception:
            pdf_text = ""

    if pdf_text.strip():
        extracted.status = "extracted"
        clipped = pdf_text.strip()
        if len(clipped) > 40000:
            clipped = clipped[:40000].rsplit(" ", 1)[0] + "\n\n[PDF text clipped by the deterministic generator.]"
            extracted.warnings.append("PDF text was clipped at 40,000 characters for site size.")
        extracted.components.append(
            {
                "type": "markdown",
                "text": f"## Extracted PDF text\n\nExtracted locally with `{parser}`.\n\n{clipped}",
                "line": 1,
                "column": 0,
            }
        )
    else:
        extracted.warnings.append("No local PDF text parser was available or extraction returned no text.")
        extracted.components.append(
            {
                "type": "markdown",
                "text": (
                    "## PDF placeholder\n\n"
                    f"`{lecture.path.name}` was detected, but local PDF text extraction could not be completed in this environment. "
                    "The generated lecture page links to the original PDF and records this limitation."
                ),
                "line": 1,
                "column": 0,
            }
        )
    extracted.components.append(
        {
            "type": "link",
            "title": "Open original PDF",
            "url": f"sources/{lecture.path.name}",
            "line": 2,
            "column": 0,
        }
    )
    return extracted


def markdown_renderer() -> Any:
    if MarkdownIt is None:
        return None
    return MarkdownIt("commonmark", {"html": True, "linkify": False})


def render_markdown(md: Any, text: str) -> str:
    if md is None:
        return "".join(f"<p>{html.escape(part)}</p>" for part in text.split("\n\n") if part.strip())
    return md.render(text)


def component_to_html(component: dict[str, Any], md: Any) -> str:
    kind = component["type"]
    if kind == "markdown":
        return render_markdown(md, component["text"])
    if kind == "image":
        url = component["url"]
        width = component.get("width")
        width_attr = f' width="{int(width)}"' if isinstance(width, (int, float)) else ""
        alt = html.escape(component.get("alt") or "Lecture image")
        return f'<figure class="lecture-figure"><img src="{html.escape(url)}" alt="{alt}" loading="lazy"{width_attr}></figure>'
    if kind == "link":
        title = html.escape(component.get("title") or component.get("url") or "link")
        url = html.escape(component.get("url") or "#")
        if component.get("url"):
            return f'<p class="resource-link"><a href="{url}" target="_blank" rel="noreferrer">{title}</a></p>'
        return f'<p class="resource-link"><span>{title}</span></p>'
    if kind == "code":
        code = html.escape(component.get("code") or "")
        language = html.escape(component.get("language") or "text")
        return f'<pre class="code-block"><code data-language="{language}">{code}</code></pre>'
    return ""


def split_sections(lecture: ExtractedLecture, md: Any) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    current = new_section(lecture, "opening", "Opening")

    def push_current() -> None:
        if current["items"] or current["title"] != "Opening":
            current["html"] = "\n".join(component_to_html(item, md) for item in current["items"])
            current["plainText"] = section_plain_text(current["items"])
            current["concepts"] = extract_terms(current["plainText"] + "\n" + current["title"])[:10]
            sections.append(current.copy())

    for component in lecture.components:
        if component["type"] == "markdown":
            heading = first_heading(component["text"])
            if heading:
                push_current()
                section_id = unique_section_id(sections, slugify(heading))
                current = new_section(lecture, section_id, heading)
                rest = remove_first_heading(component["text"])
                if rest:
                    current["items"].append({**component, "text": rest})
                continue
        current["items"].append(component)

    push_current()
    if not sections:
        fallback = new_section(lecture, "content", f"Lecture {lecture.number:02d}")
        fallback["items"] = lecture.components
        fallback["html"] = "\n".join(component_to_html(item, md) for item in fallback["items"])
        fallback["plainText"] = section_plain_text(fallback["items"])
        fallback["concepts"] = extract_terms(fallback["plainText"])[:10]
        sections.append(fallback)
    return sections


def new_section(lecture: ExtractedLecture, section_id: str, title: str) -> dict[str, Any]:
    return {
        "id": f"{lecture.lecture_id}-{section_id}",
        "title": strip_markdown(title),
        "items": [],
        "html": "",
        "plainText": "",
        "concepts": [],
    }


def unique_section_id(sections: list[dict[str, Any]], base: str) -> str:
    existing = {section["id"].split("-", 1)[1] for section in sections}
    candidate = base
    index = 2
    while candidate in existing:
        candidate = f"{base}-{index}"
        index += 1
    return candidate


def first_heading(text: str) -> str | None:
    for line in text.splitlines():
        if line.startswith("#"):
            return line.lstrip("#").strip()
        if line.strip():
            return None
    return None


def remove_first_heading(text: str) -> str:
    lines = text.splitlines()
    removed = False
    result = []
    for line in lines:
        if not removed and line.startswith("#"):
            removed = True
            continue
        result.append(line)
    return clean_markdown_text("\n".join(result))


def section_plain_text(items: list[dict[str, Any]]) -> str:
    parts = []
    for item in items:
        if item["type"] == "markdown":
            parts.append(strip_markdown(item["text"]))
        elif item["type"] == "link":
            parts.append(item.get("title") or item.get("url") or "")
        elif item["type"] == "code":
            parts.append(item.get("code") or "")
    return "\n".join(part for part in parts if part)


def lecture_markdown(lecture: ExtractedLecture, title: str) -> str:
    lines = [
        "---",
        f"id: {lecture.lecture_id}",
        f"lecture_number: {lecture.number}",
        f"title: {title}",
        f"source_file: {lecture.source_file}",
        f"source_type: {lecture.source_type}",
        f"generated_status: {lecture.status}",
        "---",
        "",
        "<!-- Generated by scripts/generate-content.py. Edit the lecture source or generator instead. -->",
        "",
    ]
    for component in lecture.components:
        if component["type"] == "markdown":
            lines.extend([component["text"], ""])
        elif component["type"] == "image":
            width = component.get("width")
            width_text = f' width="{int(width)}"' if isinstance(width, (int, float)) else ""
            lines.append(f'<img src="{component["url"]}" alt="{component.get("alt", "Lecture image")}"{width_text}>')
            lines.append("")
        elif component["type"] == "link":
            title_text = component.get("title") or component.get("url") or "link"
            url = component.get("url")
            lines.append(f"[{title_text}]({url})" if url else f"`{title_text}`")
            lines.append("")
        elif component["type"] == "code":
            language = component.get("language") or "text"
            lines.append(f"```{language}")
            lines.append(component.get("code") or "")
            lines.append("```")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def summarize_lecture(sections: list[dict[str, Any]]) -> str:
    for section in sections:
        for sentence in split_sentences(section.get("plainText", "")):
            return sentence
    return "Generated lecture content is available for active review."


def lecture_title(lecture: ExtractedLecture, sections: list[dict[str, Any]]) -> str:
    for section in sections:
        title = section["title"]
        if title and title != "Opening":
            if title.lower().startswith("lecture "):
                return title
            return f"Lecture {lecture.number:02d}: {title}"
    return f"Lecture {lecture.number:02d}"


def collect_concepts(sections: list[dict[str, Any]]) -> list[str]:
    concepts: list[str] = []
    for section in sections:
        concepts.extend(section.get("concepts", []))
        concepts.extend(extract_terms(section.get("plainText", "")))
    return unique_preserve_order(concepts)[:24]


def generate_quiz(lecture: dict[str, Any]) -> dict[str, Any]:
    candidates = sentence_candidates(lecture)
    code_candidates = code_candidates_for_lecture(lecture)
    questions: list[dict[str, Any]] = []
    lecture_id = lecture["id"]

    for idx, candidate in enumerate(candidates[:3]):
        choices = unique_preserve_order([candidate["text"]] + [item["text"] for item in candidates[idx + 1 : idx + 4]])
        while len(choices) < 4:
            choices.append(f"Review section: {candidate['sectionTitle']}")
        questions.append(
            {
                "id": f"{lecture_id}-quiz-mc-{idx+1}",
                "type": "multiple-choice",
                "prompt": "Which statement appears in this lecture section?",
                "choices": choices[:4],
                "answer": candidate["text"],
                "explanation": f"This statement is drawn from {candidate['sectionTitle']}.",
                "sectionId": candidate["sectionId"],
                "sectionTitle": candidate["sectionTitle"],
            }
        )

    if candidates:
        candidate = candidates[min(3, len(candidates) - 1)]
        questions.append(
            {
                "id": f"{lecture_id}-quiz-tf-1",
                "type": "true-false",
                "prompt": f"True or false: the lecture states, \"{candidate['text']}\"",
                "answer": True,
                "explanation": f"The sentence is extracted from {candidate['sectionTitle']}.",
                "sectionId": candidate["sectionId"],
                "sectionTitle": candidate["sectionTitle"],
            }
        )

    for idx, term in enumerate(lecture.get("concepts", [])[:2]):
        source = find_sentence_with_term(candidates, term)
        questions.append(
            {
                "id": f"{lecture_id}-quiz-short-{idx+1}",
                "type": "short-answer",
                "prompt": f"What term or concept is emphasized by this prompt: {term}?",
                "answer": term,
                "explanation": source or "This term was extracted from a heading, bold phrase, or code-like phrase in the lecture.",
                "sectionId": candidates[0]["sectionId"] if candidates else lecture["sections"][0]["id"],
                "sectionTitle": candidates[0]["sectionTitle"] if candidates else lecture["sections"][0]["title"],
            }
        )

    fill_candidate = first_fill_candidate(candidates, lecture.get("concepts", []))
    if fill_candidate:
        questions.append(fill_candidate)

    if code_candidates:
        snippet = code_candidates[0]
        questions.append(
            {
                "id": f"{lecture_id}-quiz-code-1",
                "type": "code-prediction",
                "prompt": "Which source expression is highlighted for inspection or assertion in this snippet?",
                "code": snippet["code"],
                "answer": snippet["answer"],
                "explanation": "The answer is taken from the executable lecture source comments or assert expression; the generator does not execute arbitrary lecture code.",
                "sectionId": snippet["sectionId"],
                "sectionTitle": snippet["sectionTitle"],
            }
        )

    max_questions = 8 if len(candidates) >= 8 else max(2, min(5, len(questions)))
    questions = questions[:max_questions]
    return {
        "lectureId": lecture_id,
        "partial": len(questions) < 5,
        "questions": questions,
    }


def sentence_candidates(lecture: dict[str, Any]) -> list[dict[str, str]]:
    candidates = []
    for section in lecture["sections"]:
        for sentence in split_sentences(section.get("plainText", "")):
            candidates.append(
                {
                    "text": sentence,
                    "sectionId": section["id"],
                    "sectionTitle": section["title"],
                }
            )
    return candidates


def code_candidates_for_lecture(lecture: dict[str, Any]) -> list[dict[str, str]]:
    candidates = []
    for section in lecture["sections"]:
        for item in section.get("items", []):
            if item.get("type") != "code":
                continue
            code = item.get("code", "")
            answer = ""
            inspect_match = re.search(r"#\s*@inspect\s+([A-Za-z_][A-Za-z0-9_]*)", code)
            if inspect_match:
                answer = inspect_match.group(1)
            elif code.strip().startswith("assert "):
                answer = code.strip()[len("assert ") :].split("#", 1)[0].strip()
            if answer:
                candidates.append(
                    {
                        "code": code,
                        "answer": answer,
                        "sectionId": section["id"],
                        "sectionTitle": section["title"],
                    }
                )
    return candidates


def javascript_demo_for_lecture(lecture: dict[str, Any]) -> dict[str, Any] | None:
    concepts = [concept for concept in lecture.get("concepts", []) if concept][:5]
    if not concepts:
        return None
    section = lecture["sections"][0]
    concept_json = json.dumps(concepts)
    title_json = json.dumps(lecture["title"])
    code = f"""const lectureTitle = {title_json};
const concepts = {concept_json};

console.log(`Lecture: ${{lectureTitle}}`);
console.log(`Concept count: ${{concepts.length}}`);

const ranked = concepts
  .map((concept) => ({{ concept, length: concept.length }}))
  .sort((left, right) => right.length - left.length);

console.log(ranked.map((item) => `${{item.concept}} (${{item.length}})`).join(", "));
return ranked;"""
    return {
        "id": f"{lecture['id']}-js-sandbox",
        "type": "code-sandbox",
        "kind": "javascript-worker",
        "title": "Try It: Browser Sandbox",
        "description": "Executable JavaScript sandbox generated from extracted lecture concepts. Runs in a disposable Web Worker with a timeout.",
        "language": "javascript",
        "code": code,
        "expectedOutput": "A ranked list of extracted lecture concepts by string length.",
        "safeExecution": True,
        "sectionId": section["id"],
        "sectionTitle": section["title"],
    }


def find_sentence_with_term(candidates: list[dict[str, str]], term: str) -> str:
    lowered = term.lower()
    for candidate in candidates:
        if lowered in candidate["text"].lower():
            return candidate["text"]
    return ""


def first_fill_candidate(candidates: list[dict[str, str]], concepts: list[str]) -> dict[str, Any] | None:
    for candidate in candidates:
        for term in concepts:
            if len(term.split()) <= 4 and term.lower() in candidate["text"].lower():
                blanked = re.sub(re.escape(term), "____", candidate["text"], count=1, flags=re.IGNORECASE)
                if blanked != candidate["text"]:
                    return {
                        "id": f"{candidate['sectionId']}-fill-1",
                        "type": "fill-in-the-blank",
                        "prompt": blanked,
                        "answer": term,
                        "explanation": f"The missing phrase appears in {candidate['sectionTitle']}.",
                        "sectionId": candidate["sectionId"],
                        "sectionTitle": candidate["sectionTitle"],
                    }
    return None


def generate_checks(lecture: dict[str, Any]) -> dict[str, Any]:
    checks = []
    for idx, section in enumerate(lecture["sections"][:6]):
        sentences = split_sentences(section.get("plainText", ""))
        if not sentences:
            continue
        sentence = sentences[0]
        concepts = extract_terms(section.get("plainText", "")) or lecture.get("concepts", [])
        if idx % 3 == 0:
            checks.append(
                {
                    "id": f"{section['id']}-check-mc",
                    "type": "multiple-choice",
                    "prompt": "Which statement is supported by this section?",
                    "choices": unique_preserve_order([sentence] + sentences[1:4])[:4],
                    "answer": sentence,
                    "explanation": f"This wording is extracted from {section['title']}.",
                    "sectionId": section["id"],
                    "sectionTitle": section["title"],
                }
            )
        elif idx % 3 == 1:
            checks.append(
                {
                    "id": f"{section['id']}-check-tf",
                    "type": "true-false",
                    "prompt": f"True or false: this section says, \"{sentence}\"",
                    "answer": True,
                    "explanation": "The statement is quoted from the extracted lecture material.",
                    "sectionId": section["id"],
                    "sectionTitle": section["title"],
                }
            )
        else:
            term = concepts[0] if concepts else lecture["title"]
            checks.append(
                {
                    "id": f"{section['id']}-check-fill",
                    "type": "fill-in-the-blank",
                    "prompt": f"Fill in the concept emphasized here: ____",
                    "answer": term,
                    "explanation": find_sentence_with_term(
                        [{"text": item, "sectionId": section["id"], "sectionTitle": section["title"]} for item in sentences],
                        term,
                    )
                    or f"`{term}` is extracted from this section.",
                    "sectionId": section["id"],
                    "sectionTitle": section["title"],
                }
            )
    return {"lectureId": lecture["id"], "partial": len(checks) < 2, "checks": checks[:6]}


def generate_flashcards(lecture: dict[str, Any]) -> dict[str, Any]:
    candidates = sentence_candidates(lecture)
    cards = []
    for idx, term in enumerate(lecture.get("concepts", [])[:10]):
        source = find_sentence_with_term(candidates, term)
        if not source and idx < len(candidates):
            source = candidates[idx]["text"]
        if not source:
            continue
        cards.append(
            {
                "id": f"{lecture['id']}-card-{idx+1}",
                "front": f"What does this lecture emphasize about {term}?",
                "back": source,
                "lectureId": lecture["id"],
                "sectionId": candidates[idx]["sectionId"] if idx < len(candidates) else lecture["sections"][0]["id"],
                "sectionTitle": candidates[idx]["sectionTitle"] if idx < len(candidates) else lecture["sections"][0]["title"],
                "tags": [slugify(term)],
                "difficulty": "easy" if idx < 3 else "medium" if idx < 7 else "hard",
            }
        )
    return {"lectureId": lecture["id"], "partial": len(cards) < 3, "cards": cards}


INTERACTIVE_RULES = [
    ("token", "token-context", "Token and Context Length", "slider"),
    ("context", "token-context", "Token and Context Length", "slider"),
    ("learning rate", "learning-rate", "Learning Rate", "slider"),
    ("batch", "batch-size", "Batch Size", "slider"),
    ("temperature", "sampling-temperature", "Sampling Temperature", "slider"),
    ("top-k", "top-k", "Top-k Sampling", "slider"),
    ("top-p", "top-p", "Top-p Sampling", "slider"),
    ("loss", "loss-curve", "Loss Curve", "slider"),
    ("scaling", "scaling-law", "Scaling Law", "slider"),
    ("attention", "attention", "Attention Weights", "slider"),
    ("memory", "memory", "Memory Accounting", "slider"),
]


def generate_interactives(lecture: dict[str, Any]) -> dict[str, Any]:
    text = " ".join(section.get("plainText", "") for section in lecture["sections"]).lower()
    interactives = []
    used = set()
    js_demo = javascript_demo_for_lecture(lecture)
    if js_demo:
        interactives.append(js_demo)
    for keyword, kind, title, interactive_type in INTERACTIVE_RULES:
        if keyword in text and kind not in used:
            used.add(kind)
            interactives.append(
                {
                    "id": f"{lecture['id']}-{kind}",
                    "type": interactive_type,
                    "kind": kind,
                    "title": title,
                    "description": f"Illustrative client-side control generated because `{keyword}` appears in the extracted lecture material.",
                    "synthetic": True,
                    "sectionId": lecture["sections"][0]["id"],
                    "sectionTitle": lecture["sections"][0]["title"],
                    "min": 1,
                    "max": 100,
                    "default": 40,
                    "unit": "relative units",
                }
            )
        if len(interactives) >= 2:
            break
    for snippet in code_candidates_for_lecture(lecture)[:2]:
        interactives.append(
            {
                "id": f"{lecture['id']}-sandbox-{len(interactives)+1}",
                "type": "code-sandbox",
                "kind": "python-placeholder",
                "title": "Try It: Source Snippet",
                "description": "Editable static Python snippet. Browser execution is intentionally disabled for extracted Python; copy and run locally if needed.",
                "language": "python",
                "code": snippet["code"],
                "expectedOutput": snippet["answer"],
                "safeExecution": False,
                "sectionId": snippet["sectionId"],
                "sectionTitle": snippet["sectionTitle"],
            }
        )
    return {"lectureId": lecture["id"], "interactives": interactives}


def copy_public_assets(lectures: list[LectureFile]) -> None:
    (PUBLIC_DIR / "images").mkdir(parents=True, exist_ok=True)
    (PUBLIC_DIR / "sources").mkdir(parents=True, exist_ok=True)
    image_dir = ROOT / "images"
    if image_dir.exists():
        for source in image_dir.iterdir():
            if source.is_file():
                shutil.copy2(source, PUBLIC_DIR / "images" / source.name)
    for lecture in lectures:
        if lecture.source_type == "pdf":
            shutil.copy2(lecture.path, PUBLIC_DIR / "sources" / lecture.path.name)


def prepare_output_dirs() -> None:
    for relative in ["lectures", "quizzes", "checks", "flashcards", "interactives"]:
        path = CONTENT_DIR / relative
        path.mkdir(parents=True, exist_ok=True)
        pattern = "lecture_*.md" if relative == "lectures" else "lecture_*.json"
        for generated in path.glob(pattern):
            generated.unlink()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pages_dir = PUBLIC_DIR / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    for generated in pages_dir.glob("lecture_*.html"):
        generated.unlink()


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_page_entry(lecture: dict[str, Any]) -> str:
    route = f"/lectures/#/lecture/{lecture['id']}"
    path = PUBLIC_DIR / "pages" / f"{lecture['id']}.html"
    title = html.escape(lecture["title"])
    body = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url={route}">
    <title>{title}</title>
  </head>
  <body>
    <main>
      <h1>{title}</h1>
      <p><a href="{route}">Open the interactive lecture page.</a></p>
    </main>
  </body>
</html>
"""
    path.write_text(body, encoding="utf-8")
    return f"pages/{lecture['id']}.html"


def generate_site(root: Path = ROOT) -> dict[str, Any]:
    prepare_output_dirs()
    lectures = discover_lectures(root)
    references = read_reference_map(root)
    md = markdown_renderer()
    copy_public_assets(lectures)

    lecture_payloads = []
    quizzes: dict[str, Any] = {}
    checks: dict[str, Any] = {}
    flashcards_by_lecture: dict[str, Any] = {}
    interactives_by_lecture: dict[str, Any] = {}
    warnings: list[str] = []

    for lecture_file in lectures:
        if lecture_file.source_type == "py":
            extracted = extract_python_lecture(lecture_file, references)
        else:
            extracted = extract_pdf_lecture(lecture_file)

        sections = split_sections(extracted, md)
        title = lecture_title(extracted, sections)
        concepts = collect_concepts(sections)
        lecture_payload = {
            "id": extracted.lecture_id,
            "number": extracted.number,
            "title": title,
            "summary": summarize_lecture(sections),
            "sourceFile": extracted.source_file,
            "sourceType": extracted.source_type,
            "generatedStatus": extracted.status,
            "warnings": extracted.warnings,
            "sections": sections,
            "concepts": concepts,
            "metadata": {
                "quizStatus": "generated",
                "flashcardCount": 0,
                "quickCheckCount": 0,
                "interactiveCount": 0,
            },
        }

        markdown = lecture_markdown(extracted, title)
        (CONTENT_DIR / "lectures" / f"{extracted.lecture_id}.md").write_text(markdown, encoding="utf-8")

        quiz = generate_quiz(lecture_payload)
        quick_checks = generate_checks(lecture_payload)
        flashcards = generate_flashcards(lecture_payload)
        interactives = generate_interactives(lecture_payload)

        lecture_payload["metadata"]["quizStatus"] = "partial" if quiz["partial"] else "complete"
        lecture_payload["metadata"]["flashcardCount"] = len(flashcards["cards"])
        lecture_payload["metadata"]["quickCheckCount"] = len(quick_checks["checks"])
        lecture_payload["metadata"]["interactiveCount"] = len(interactives["interactives"])
        lecture_payload["pagePath"] = write_page_entry(lecture_payload)

        write_json(CONTENT_DIR / "quizzes" / f"{extracted.lecture_id}.json", quiz)
        write_json(CONTENT_DIR / "checks" / f"{extracted.lecture_id}.json", quick_checks)
        write_json(CONTENT_DIR / "flashcards" / f"{extracted.lecture_id}.json", flashcards)
        write_json(CONTENT_DIR / "interactives" / f"{extracted.lecture_id}.json", interactives)

        quizzes[extracted.lecture_id] = quiz
        checks[extracted.lecture_id] = quick_checks
        flashcards_by_lecture[extracted.lecture_id] = flashcards
        interactives_by_lecture[extracted.lecture_id] = interactives
        warnings.extend(f"{extracted.lecture_id}: {warning}" for warning in extracted.warnings)
        lecture_payloads.append(lecture_payload)

    all_cards = [card for value in flashcards_by_lecture.values() for card in value["cards"]]
    flashcard_index = {"cards": all_cards, "lectureCount": len(lecture_payloads)}
    write_json(CONTENT_DIR / "flashcards" / "index.json", flashcard_index)

    manifest = {
        "generatedBy": "scripts/generate-content.py",
        "lectureCount": len(lecture_payloads),
        "lectures": [
            {
                "id": lecture["id"],
                "sourceFile": lecture["sourceFile"],
                "sourceType": lecture["sourceType"],
                "generatedStatus": lecture["generatedStatus"],
                "quizQuestions": len(quizzes[lecture["id"]]["questions"]),
                "quickChecks": len(checks[lecture["id"]]["checks"]),
                "flashcards": len(flashcards_by_lecture[lecture["id"]]["cards"]),
                "interactives": len(interactives_by_lecture[lecture["id"]]["interactives"]),
                "pagePath": lecture["pagePath"],
            }
            for lecture in lecture_payloads
        ],
        "warnings": warnings,
    }
    write_json(CONTENT_DIR / "manifest.json", manifest)

    site_data = {
        "course": {
            "title": "CS336: Language Models From Scratch",
            "subtitle": "Interactive static lecture textbook",
        },
        "generatedBy": "scripts/generate-content.py",
        "lectures": lecture_payloads,
        "quizzes": quizzes,
        "checks": checks,
        "flashcards": flashcard_index,
        "interactives": interactives_by_lecture,
        "manifest": manifest,
    }
    write_json(DATA_DIR / "site-data.json", site_data)
    return manifest


def main() -> None:
    manifest = generate_site()
    print(f"Generated {manifest['lectureCount']} lectures.")
    for warning in manifest["warnings"]:
        print(f"warning: {warning}")


if __name__ == "__main__":
    main()
