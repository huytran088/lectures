#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    manifest_path = ROOT / "content" / "manifest.json"
    data_path = ROOT / "public" / "data" / "site-data.json"
    assert manifest_path.exists(), "content/manifest.json is missing"
    assert data_path.exists(), "public/data/site-data.json is missing"

    manifest = load_json(manifest_path)
    site = load_json(data_path)
    lecture_files = sorted(ROOT.glob("lecture_??.*"))
    detected = [path for path in lecture_files if re.match(r"lecture_\d{2}\.(py|pdf)$", path.name)]
    assert manifest["lectureCount"] == len(detected), "generated lecture count does not match detected files"
    assert len(site["lectures"]) == len(detected), "site data lecture count mismatch"

    source_types = {item["sourceType"] for item in manifest["lectures"]}
    assert "py" in source_types, "no Python lecture was generated"
    assert "pdf" in source_types, "no PDF lecture placeholder/page was generated"

    for lecture in manifest["lectures"]:
        lecture_id = lecture["id"]
        assert (ROOT / "content" / "lectures" / f"{lecture_id}.md").exists(), f"missing markdown for {lecture_id}"
        assert (ROOT / "content" / "quizzes" / f"{lecture_id}.json").exists(), f"missing quiz for {lecture_id}"
        assert (ROOT / "content" / "checks" / f"{lecture_id}.json").exists(), f"missing checks for {lecture_id}"
        assert (ROOT / "content" / "flashcards" / f"{lecture_id}.json").exists(), f"missing flashcards for {lecture_id}"
        assert (ROOT / "content" / "interactives" / f"{lecture_id}.json").exists(), f"missing interactives for {lecture_id}"
        assert (ROOT / "public" / "pages" / f"{lecture_id}.html").exists(), f"missing static page entry for {lecture_id}"
        assert lecture["quizQuestions"] >= 1, f"no quiz questions for {lecture_id}"
        assert lecture["quickChecks"] >= 1, f"no quick checks for {lecture_id}"

    total_cards = len(site["flashcards"]["cards"])
    total_interactives = sum(len(value["interactives"]) for value in site["interactives"].values())
    assert total_cards > 0, "no aggregate flashcards generated"
    assert total_interactives > 0, "no interactives generated"
    assert any(
        item["type"] == "code-sandbox"
        for value in site["interactives"].values()
        for item in value["interactives"]
    ), "no code sandbox placeholder generated"
    assert any(
        item["type"] == "code-sandbox" and item.get("safeExecution") is True and item.get("language") == "javascript"
        for value in site["interactives"].values()
        for item in value["interactives"]
    ), "no executable browser JavaScript sandbox generated"
    assert any(
        item["type"] == "slider"
        for value in site["interactives"].values()
        for item in value["interactives"]
    ), "no slider interactive generated"

    app_files = [
        ROOT / "src" / "main.js",
        ROOT / "src" / "quiz.js",
        ROOT / "src" / "quickChecks.js",
        ROOT / "src" / "flashcards.js",
        ROOT / "src" / "interactives.js",
        ROOT / "src" / "styles.css",
    ]
    for path in app_files:
        assert path.exists(), f"missing app source {path.relative_to(ROOT)}"

    dist_index = ROOT / "dist" / "index.html"
    if dist_index.exists():
        assert "assets/" in dist_index.read_text(encoding="utf-8"), "dist index does not reference built assets"

    print(
        f"Validated {manifest['lectureCount']} lectures, "
        f"{total_cards} flashcards, {total_interactives} interactives."
    )


if __name__ == "__main__":
    main()
