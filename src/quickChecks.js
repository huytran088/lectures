import { isCorrectAnswer, readStore, removeStore, writeStore } from "./storage.js";

export function checksStoreKey(lectureId) {
  return `checks.${lectureId}`;
}

export function checksSummary(lectureId, checks) {
  const saved = readStore(checksStoreKey(lectureId), { answers: {} });
  const total = checks?.length || 0;
  const answered = Object.keys(saved.answers || {}).length;
  const correct = Object.values(saved.answers || {}).filter((item) => item.correct).length;
  return { total, answered, correct };
}

export function renderQuickCheck(lectureId, check) {
  const saved = readStore(checksStoreKey(lectureId), { answers: {} });
  const answer = saved.answers?.[check.id];
  return `
    <article class="quick-check${answer ? " is-answered" : ""}" data-check-id="${check.id}">
      <div class="quick-check-label">Check Your Understanding</div>
      <h3>${escapeHtml(check.prompt)}</h3>
      ${renderInput(check, answer?.response)}
      <div class="question-actions">
        <button class="primary-button" type="button" data-submit-check="${check.id}">Check</button>
      </div>
      <div class="feedback" aria-live="polite">${answer ? renderFeedback(check, answer) : ""}</div>
    </article>
  `;
}

export function renderChecksReset(lectureId, checks) {
  const summary = checksSummary(lectureId, checks);
  return `
    <div class="inline-progress">
      <span>${summary.correct}/${summary.total} quick checks correct</span>
      <button class="ghost-button" type="button" data-reset-checks="${lectureId}">Reset quick checks</button>
    </div>
  `;
}

function renderInput(check, savedValue) {
  if (check.type === "multiple-choice") {
    return `
      <div class="choice-list" role="radiogroup">
        ${(check.choices || [])
          .map((choice, index) => `
            <label class="choice-row">
              <input type="radio" name="${check.id}" value="${escapeAttr(choice)}"${choice === savedValue ? " checked" : ""}>
              <span>${escapeHtml(choice)}</span>
            </label>
          `)
          .join("")}
      </div>
    `;
  }
  if (check.type === "true-false") {
    return `
      <div class="choice-list two-col" role="radiogroup">
        ${["true", "false"]
          .map((choice) => `
            <label class="choice-row">
              <input type="radio" name="${check.id}" value="${choice}"${String(savedValue) === choice ? " checked" : ""}>
              <span>${choice}</span>
            </label>
          `)
          .join("")}
      </div>
    `;
  }
  return `
    <label class="text-answer compact">
      <span>Answer</span>
      <input type="text" name="${check.id}" value="${escapeAttr(savedValue || "")}">
    </label>
  `;
}

export function mountQuickChecks(root, lectureId, checks) {
  root.querySelectorAll("[data-submit-check]").forEach((button) => {
    button.addEventListener("click", () => {
      const check = checks.find((item) => item.id === button.dataset.submitCheck);
      if (!check) return;
      const card = button.closest("[data-check-id]");
      const response = readCheckResponse(card, check);
      const correct = isCorrectAnswer(check, response);
      const saved = readStore(checksStoreKey(lectureId), { answers: {} });
      saved.answers = saved.answers || {};
      saved.answers[check.id] = { response, correct, submittedAt: Date.now() };
      writeStore(checksStoreKey(lectureId), saved);
      card.classList.add("is-answered");
      card.querySelector(".feedback").innerHTML = renderFeedback(check, { response, correct });
      window.dispatchEvent(new CustomEvent("cs336-progress-updated"));
    });
  });
  const reset = root.querySelector(`[data-reset-checks="${lectureId}"]`);
  reset?.addEventListener("click", () => {
    removeStore(checksStoreKey(lectureId));
    window.dispatchEvent(new CustomEvent("cs336-route-refresh"));
  });
}

function readCheckResponse(card, check) {
  if (check.type === "multiple-choice" || check.type === "true-false") {
    const selected = card.querySelector(`input[name="${CSS.escape(check.id)}"]:checked`);
    if (!selected) return "";
    return check.type === "true-false" ? selected.value === "true" : selected.value;
  }
  return card.querySelector(`input[name="${CSS.escape(check.id)}"]`)?.value || "";
}

function renderFeedback(check, answer) {
  return `
    <div class="${answer.correct ? "feedback-correct" : "feedback-review"}">
      <strong>${answer.correct ? "Correct." : "Review."}</strong>
      <span>${escapeHtml(check.explanation || "")}</span>
      <div class="answer-line">Answer: <code>${escapeHtml(String(check.answer))}</code></div>
    </div>
  `;
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
