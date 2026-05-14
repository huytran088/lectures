import { readStore, removeStore, writeStore } from "./storage.js";

const STORE_KEY = "flashcards";

export function flashcardSummary(cards) {
  const state = readStore(STORE_KEY, { known: {}, again: {} });
  const known = cards.filter((card) => state.known?.[card.id]).length;
  const again = cards.filter((card) => state.again?.[card.id]).length;
  return { known, again, total: cards.length };
}

export function renderFlashcardsPage(site) {
  const cards = site.flashcards.cards || [];
  const tags = [...new Set(cards.flatMap((card) => card.tags || []))].sort();
  const summary = flashcardSummary(cards);
  return `
    <section class="flashcard-page">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">Review</p>
          <h1>Flashcards</h1>
        </div>
        <div class="progress-pill">${summary.known}/${summary.total} known</div>
      </div>
      <div class="flashcard-controls">
        <label>
          <span>Lecture</span>
          <select data-card-lecture>
            <option value="">All lectures</option>
            ${site.lectures.map((lecture) => `<option value="${lecture.id}">${lecture.title}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Tag</span>
          <select data-card-tag>
            <option value="">All tags</option>
            ${tags.map((tag) => `<option value="${tag}">${tag}</option>`).join("")}
          </select>
        </label>
        <button class="secondary-button" type="button" data-card-shuffle>Shuffle</button>
        <button class="ghost-button" type="button" data-card-reset>Reset progress</button>
      </div>
      <div class="flashcard-stage" data-card-stage></div>
    </section>
  `;
}

export function mountFlashcards(root, site) {
  const allCards = site.flashcards.cards || [];
  const stage = root.querySelector("[data-card-stage]");
  const lectureSelect = root.querySelector("[data-card-lecture]");
  const tagSelect = root.querySelector("[data-card-tag]");
  let order = allCards.map((_, index) => index);
  let position = 0;
  let flipped = false;

  const filteredCards = () => {
    const lecture = lectureSelect.value;
    const tag = tagSelect.value;
    return order
      .map((index) => allCards[index])
      .filter((card) => (!lecture || card.lectureId === lecture) && (!tag || (card.tags || []).includes(tag)));
  };

  const render = () => {
    const cards = filteredCards();
    if (!cards.length) {
      stage.innerHTML = `<p class="empty-state">No cards match the current filters.</p>`;
      return;
    }
    position = Math.min(position, cards.length - 1);
    const card = cards[position];
    const state = readStore(STORE_KEY, { known: {}, again: {} });
    stage.innerHTML = `
      <button class="flashcard${flipped ? " is-flipped" : ""}" type="button" data-flip-card aria-pressed="${flipped}">
        <span class="card-face card-front">${escapeHtml(card.front)}</span>
        <span class="card-face card-back">${escapeHtml(card.back)}</span>
      </button>
      <div class="flashcard-meta">
        <span>${position + 1}/${cards.length}</span>
        <span>${escapeHtml(card.sectionTitle || card.lectureId)}</span>
        <span>${escapeHtml(card.difficulty || "medium")}</span>
      </div>
      <div class="flashcard-actions">
        <button class="secondary-button" type="button" data-card-prev>Previous</button>
        <button class="secondary-button" type="button" data-card-next>Next</button>
        <button class="primary-button" type="button" data-card-known>${state.known?.[card.id] ? "Known" : "Mark known"}</button>
        <button class="ghost-button" type="button" data-card-again>${state.again?.[card.id] ? "Reviewing" : "Review again"}</button>
      </div>
    `;
    stage.querySelector("[data-flip-card]").addEventListener("click", () => {
      flipped = !flipped;
      render();
    });
    stage.querySelector("[data-card-prev]").addEventListener("click", () => {
      position = (position - 1 + cards.length) % cards.length;
      flipped = false;
      render();
    });
    stage.querySelector("[data-card-next]").addEventListener("click", () => {
      position = (position + 1) % cards.length;
      flipped = false;
      render();
    });
    stage.querySelector("[data-card-known]").addEventListener("click", () => {
      const next = readStore(STORE_KEY, { known: {}, again: {} });
      next.known = next.known || {};
      next.again = next.again || {};
      next.known[card.id] = !next.known[card.id];
      if (next.known[card.id]) delete next.again[card.id];
      writeStore(STORE_KEY, next);
      render();
    });
    stage.querySelector("[data-card-again]").addEventListener("click", () => {
      const next = readStore(STORE_KEY, { known: {}, again: {} });
      next.known = next.known || {};
      next.again = next.again || {};
      next.again[card.id] = !next.again[card.id];
      if (next.again[card.id]) delete next.known[card.id];
      writeStore(STORE_KEY, next);
      render();
    });
  };

  lectureSelect.addEventListener("change", () => {
    position = 0;
    flipped = false;
    render();
  });
  tagSelect.addEventListener("change", () => {
    position = 0;
    flipped = false;
    render();
  });
  root.querySelector("[data-card-shuffle]").addEventListener("click", () => {
    order = shuffle(order);
    position = 0;
    flipped = false;
    render();
  });
  root.querySelector("[data-card-reset]").addEventListener("click", () => {
    removeStore(STORE_KEY);
    render();
  });
  render();
}

function shuffle(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
