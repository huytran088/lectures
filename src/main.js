import "./styles.css";
import { renderFlashcardsPage, mountFlashcards } from "./flashcards.js";
import { renderInteractive, mountInteractives } from "./interactives.js";
import { renderChecksReset, renderQuickCheck, mountQuickChecks, checksSummary } from "./quickChecks.js";
import { renderQuiz, mountQuiz, quizSummary } from "./quiz.js";

const BASE_URL = import.meta.env.BASE_URL || "/";
const DATA_URL = `${BASE_URL}data/site-data.json`;
const app = document.querySelector("#app");

let site = null;

init();

async function init() {
  app.innerHTML = `<main class="loading-view">Loading CS336 lectures...</main>`;
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Unable to load ${DATA_URL}`);
    site = await response.json();
    window.addEventListener("hashchange", renderApp);
    window.addEventListener("cs336-route-refresh", renderApp);
    window.addEventListener("cs336-progress-updated", updateSidebarProgress);
    renderApp();
  } catch (error) {
    app.innerHTML = `
      <main class="loading-view">
        <h1>Generated content is missing</h1>
        <p>Run <code>npm run generate</code>, then restart the dev server.</p>
        <pre>${escapeHtml(error.message)}</pre>
      </main>
    `;
  }
}

function renderApp() {
  const route = parseRoute();
  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(route)}
      <main class="main-pane" id="main" tabindex="-1"></main>
    </div>
  `;
  mountSidebar();
  const main = app.querySelector("#main");
  if (route.type === "flashcards") {
    main.innerHTML = renderFlashcardsPage(site);
    mountFlashcards(main, site);
  } else if (route.type === "lecture") {
    const lecture = site.lectures.find((item) => item.id === route.lectureId) || site.lectures[0];
    main.innerHTML = renderLecturePage(lecture);
    const checks = site.checks[lecture.id]?.checks || [];
    const interactives = site.interactives[lecture.id]?.interactives || [];
    mountQuickChecks(main, lecture.id, checks);
    mountInteractives(main, interactives);
    mountQuiz(main, lecture, site.quizzes[lecture.id]);
  } else {
    main.innerHTML = renderHomePage();
    mountHomeSearch(main);
  }
  runSmokeIfRequested(main, route);
  updateSidebarProgress();
  main.focus({ preventScroll: true });
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("lecture/")) return { type: "lecture", lectureId: hash.split("/")[1] };
  if (hash === "flashcards") return { type: "flashcards" };
  return { type: "home" };
}

function renderSidebar(route) {
  return `
    <aside class="sidebar">
      <a class="brand" href="#/">
        <span class="brand-mark">CS</span>
        <span>
          <strong>CS336</strong>
          <small>Interactive lectures</small>
        </span>
      </a>
      <label class="sidebar-search">
        <span>Filter lectures</span>
        <input type="search" data-sidebar-search placeholder="Search titles, concepts, summaries">
      </label>
      <nav class="nav-list" aria-label="Lecture index">
        ${site.lectures.map((lecture) => renderLectureNavItem(lecture, route)).join("")}
      </nav>
      <a class="flashcard-link${route.type === "flashcards" ? " is-active" : ""}" href="#/flashcards">
        <span>Flashcards</span>
        <span>${site.flashcards.cards.length}</span>
      </a>
    </aside>
  `;
}

function renderLectureNavItem(lecture, route) {
  const active = route.type === "lecture" && route.lectureId === lecture.id;
  const quiz = quizSummary(lecture.id, site.quizzes[lecture.id]);
  const checks = checksSummary(lecture.id, site.checks[lecture.id]?.checks || []);
  const searchable = `${lecture.title} ${lecture.summary} ${(lecture.concepts || []).join(" ")}`.toLowerCase();
  return `
    <a class="nav-item${active ? " is-active" : ""}" href="#/lecture/${lecture.id}" data-search-text="${escapeAttr(searchable)}" data-progress-for="${lecture.id}">
      <span class="lecture-number">${String(lecture.number).padStart(2, "0")}</span>
      <span class="nav-item-text">
        <strong>${escapeHtml(lecture.title)}</strong>
        <small>${lecture.sourceType.toUpperCase()} | ${checks.correct}/${checks.total} checks | ${quiz.correct}/${quiz.total} quiz</small>
      </span>
    </a>
  `;
}

function mountSidebar() {
  const input = app.querySelector("[data-sidebar-search]");
  input?.addEventListener("input", () => {
    const query = input.value.toLowerCase().trim();
    app.querySelectorAll("[data-search-text]").forEach((item) => {
      item.hidden = query && !item.dataset.searchText.includes(query);
    });
  });
}

function updateSidebarProgress() {
  if (!site) return;
  site.lectures.forEach((lecture) => {
    const item = app.querySelector(`[data-progress-for="${lecture.id}"] small`);
    if (!item) return;
    const quiz = quizSummary(lecture.id, site.quizzes[lecture.id]);
    const checks = checksSummary(lecture.id, site.checks[lecture.id]?.checks || []);
    item.textContent = `${lecture.sourceType.toUpperCase()} | ${checks.correct}/${checks.total} checks | ${quiz.correct}/${quiz.total} quiz`;
  });
}

function renderHomePage() {
  const complete = site.manifest.lectures.filter((lecture) => lecture.generatedStatus === "extracted").length;
  return `
    <section class="home-header">
      <p class="eyebrow">${site.course.subtitle}</p>
      <h1>${site.course.title}</h1>
      <p>${site.lectures.length} detected lectures, ${complete} with extracted text, ${site.flashcards.cards.length} generated review cards.</p>
      <label class="home-search">
        <span>Search course content</span>
        <input type="search" data-home-search placeholder="Try attention, token, memory, scaling">
      </label>
    </section>
    <section class="lecture-grid" aria-label="Detected lectures">
      ${site.lectures.map(renderLectureCard).join("")}
    </section>
  `;
}

function renderLectureCard(lecture) {
  const quiz = site.quizzes[lecture.id];
  const checks = site.checks[lecture.id];
  const searchable = `${lecture.title} ${lecture.summary} ${(lecture.concepts || []).join(" ")}`.toLowerCase();
  return `
    <article class="lecture-card" data-home-card data-search-text="${escapeAttr(searchable)}">
      <div class="card-topline">
        <span>Lecture ${String(lecture.number).padStart(2, "0")}</span>
        <span>${lecture.sourceType.toUpperCase()}</span>
      </div>
      <h2><a href="#/lecture/${lecture.id}">${escapeHtml(lecture.title)}</a></h2>
      <p>${escapeHtml(lecture.summary)}</p>
      <div class="metadata-row">
        <span>${lecture.generatedStatus}</span>
        <span>${quiz.questions.length} quiz</span>
        <span>${checks.checks.length} checks</span>
        <span>${lecture.metadata.flashcardCount} cards</span>
      </div>
      <div class="concept-list">
        ${(lecture.concepts || []).slice(0, 5).map((concept) => `<span>${escapeHtml(concept)}</span>`).join("")}
      </div>
    </article>
  `;
}

function mountHomeSearch(root) {
  const input = root.querySelector("[data-home-search]");
  input?.addEventListener("input", () => {
    const query = input.value.toLowerCase().trim();
    root.querySelectorAll("[data-home-card]").forEach((card) => {
      card.hidden = query && !card.dataset.searchText.includes(query);
    });
  });
}

function renderLecturePage(lecture) {
  const checks = site.checks[lecture.id]?.checks || [];
  const quiz = site.quizzes[lecture.id];
  const interactives = site.interactives[lecture.id]?.interactives || [];
  return `
    <article class="lecture-page">
      <header class="lecture-hero">
        <p class="eyebrow">Lecture ${String(lecture.number).padStart(2, "0")}</p>
        <h1>${escapeHtml(lecture.title)}</h1>
        <p>${escapeHtml(lecture.summary)}</p>
        ${renderMetadata(lecture, quiz, checks, interactives)}
      </header>
      <nav class="section-index" aria-label="Section anchors">
        ${lecture.sections.map((section) => `<a href="#${section.id}">${escapeHtml(section.title)}</a>`).join("")}
      </nav>
      ${renderChecksReset(lecture.id, checks)}
      <div class="lesson-flow">
        ${lecture.sections.map((section) => renderSection(lecture, section, checks, interactives)).join("")}
      </div>
      ${renderQuiz(lecture, quiz)}
    </article>
  `;
}

function renderMetadata(lecture, quiz, checks, interactives) {
  return `
    <dl class="metadata-panel">
      <div><dt>Source</dt><dd>${escapeHtml(lecture.sourceFile)}</dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(lecture.generatedStatus)}</dd></div>
      <div><dt>Quiz</dt><dd>${quiz.partial ? "partial" : "complete"} (${quiz.questions.length})</dd></div>
      <div><dt>Quick checks</dt><dd>${checks.length}</dd></div>
      <div><dt>Flashcards</dt><dd>${lecture.metadata.flashcardCount}</dd></div>
      <div><dt>Interactives</dt><dd>${interactives.length}</dd></div>
    </dl>
    ${lecture.warnings?.length ? `<div class="warning-strip">${lecture.warnings.map(escapeHtml).join(" ")}</div>` : ""}
  `;
}

function renderSection(lecture, section, checks, interactives) {
  const sectionChecks = checks.filter((check) => check.sectionId === section.id);
  const sectionInteractives = interactives.filter((interactive) => interactive.sectionId === section.id);
  return `
    <section class="lesson-section" id="${section.id}">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">Active Reading</p>
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        <a class="anchor-link" href="#${section.id}" aria-label="Anchor for ${escapeAttr(section.title)}">#</a>
      </div>
      <div class="section-body">${prefixGeneratedUrls(section.html)}</div>
      ${renderCallouts(section)}
      ${sectionChecks.map((check) => renderQuickCheck(lecture.id, check)).join("")}
      ${sectionInteractives.map(renderInteractive).join("")}
      ${renderGlossary(section)}
    </section>
  `;
}

function renderCallouts(section) {
  const sentences = section.plainText
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 45);
  const summary = sentences[0];
  const caution = sentences.find((item) => /wrong|caveat|however|but\b/i.test(item));
  return `
    <div class="callout-row">
      ${summary ? `<aside class="callout"><strong>Summary</strong><p>${escapeHtml(summary)}</p></aside>` : ""}
      <details class="hint-box">
        <summary>Hint</summary>
        <p>${escapeHtml(summary || "Use the nearest extracted section text as evidence before answering.")}</p>
      </details>
      ${caution ? `<aside class="misconception"><strong>Common misconception</strong><p>${escapeHtml(caution)}</p></aside>` : ""}
    </div>
  `;
}

function renderGlossary(section) {
  const concepts = (section.concepts || []).slice(0, 6);
  if (!concepts.length) return "";
  return `
    <div class="glossary-strip" aria-label="Section concepts">
      ${concepts
        .map(
          (concept) => `
            <button class="glossary-term" type="button">
              <span>${escapeHtml(concept)}</span>
              <small>${escapeHtml(section.title)}</small>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function prefixGeneratedUrls(markup) {
  return String(markup || "").replace(/\b(src|href)="(images|sources)\//g, `$1="${BASE_URL}$2/`);
}

function runSmokeIfRequested(main, route) {
  if (!new URLSearchParams(window.location.search).has("smoke")) return;
  window.setTimeout(() => {
    const results = [];
    if (route.type === "lecture") {
      const checkInput = main.querySelector(".quick-check input[type='radio']");
      const checkButton = main.querySelector(".quick-check [data-submit-check]");
      checkInput?.click();
      checkButton?.click();
      results.push(`quick-check:${main.querySelector(".quick-check .feedback-correct") ? "pass" : "fail"}`);

      const quizInput = main.querySelector(".question-card input[type='radio']");
      const quizButton = main.querySelector(".question-card [data-submit-question]");
      quizInput?.click();
      quizButton?.click();
      results.push(`quiz:${main.querySelector(".question-card .feedback-correct") ? "pass" : "fail"}`);

      const slider = main.querySelector("[data-slider-input]");
      const before = main.querySelector("[data-slider-output]")?.textContent || "";
      if (slider) {
        slider.value = "70";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const after = main.querySelector("[data-slider-output]")?.textContent || "";
      results.push(`slider:${before && after && before !== after ? "pass" : "fail"}`);

      const run = main.querySelector("[data-run-code]");
      run?.click();
      const reveal = main.querySelector("[data-reveal-output]");
      reveal?.click();
      window.setTimeout(() => {
        const execution = main.querySelector("[data-code-output]");
        const output = main.querySelector(".expected-output");
        const previous = results.findIndex((item) => item.startsWith("sandbox:"));
        const status =
          execution && !/Run the snippet|Running/.test(execution.textContent || "")
            ? "sandbox:pass"
            : output && output.hidden === false
              ? "sandbox:pass"
              : run || reveal
                ? "sandbox:fail"
                : "sandbox:absent";
        if (previous >= 0) results[previous] = status;
      }, 800);
      results.push("sandbox:pending");
      results.push(`localStorage:${localStorage.length > 0 ? "pass" : "fail"}`);
    }

    if (route.type === "flashcards") {
      const card = main.querySelector("[data-flip-card]");
      card?.click();
      const flipped = main.querySelector(".flashcard.is-flipped");
      main.querySelector("[data-card-next]")?.click();
      main.querySelector("[data-card-known]")?.click();
      main.querySelector("[data-card-shuffle]")?.click();
      results.push(`flip:${flipped ? "pass" : "fail"}`);
      results.push(`known:${localStorage.getItem("cs336.textbook.flashcards") ? "pass" : "fail"}`);
      results.push(`shuffle:${main.querySelector("[data-card-stage]")?.textContent ? "pass" : "fail"}`);
    }

    const node = document.createElement("div");
    node.id = "smoke-result";
    window.setTimeout(() => {
      node.textContent = results.join(" ");
      node.hidden = true;
      main.appendChild(node);
    }, 1000);
  }, 100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
