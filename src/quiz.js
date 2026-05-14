import { isCorrectAnswer, normalizeAnswer, readStore, removeStore, writeStore } from "./storage.js";

export function quizStoreKey(lectureId) {
  return `quiz.${lectureId}`;
}

export function quizSummary(lectureId, quiz) {
  const saved = readStore(quizStoreKey(lectureId), { answers: {} });
  const answered = Object.keys(saved.answers || {}).length;
  const total = quiz?.questions?.length || 0;
  const correct = Object.values(saved.answers || {}).filter((item) => item.correct).length;
  return { answered, total, correct };
}

export function renderQuiz(lecture, quiz) {
  const questions = quiz?.questions || [];
  const summary = quizSummary(lecture.id, quiz);
  return `
    <section class="quiz-panel" id="quiz" aria-labelledby="quiz-heading">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">End-of-Lecture Quiz</p>
          <h2 id="quiz-heading">Lecture Checkpoint</h2>
        </div>
        <div class="progress-pill" data-quiz-progress>${summary.correct}/${summary.total} correct</div>
      </div>
      <div class="quiz-actions">
        <button class="secondary-button" type="button" data-reset-quiz="${lecture.id}">Reset quiz</button>
      </div>
      <div class="question-list">
        ${questions.map((question, index) => renderQuestion(lecture.id, question, index)).join("")}
      </div>
    </section>
  `;
}

function renderQuestion(lectureId, question, index) {
  const saved = readStore(quizStoreKey(lectureId), { answers: {} });
  const answer = saved.answers?.[question.id];
  const answeredClass = answer ? " is-answered" : "";
  return `
    <article class="question-card${answeredClass}" data-quiz-question="${question.id}">
      <div class="question-topline">
        <span>Question ${index + 1}</span>
        <span>${question.type.replaceAll("-", " ")}</span>
      </div>
      <h3>${escapeHtml(question.prompt)}</h3>
      ${question.code ? `<pre class="code-block"><code>${escapeHtml(question.code)}</code></pre>` : ""}
      ${renderInput(question, answer?.response)}
      <div class="question-actions">
        <button class="primary-button" type="button" data-submit-question="${question.id}">Submit</button>
        <button class="ghost-button" type="button" data-show-answer="${question.id}">Show answer</button>
      </div>
      <div class="feedback" aria-live="polite">${answer ? renderFeedback(question, answer) : ""}</div>
    </article>
  `;
}

function renderInput(question, savedValue) {
  if (question.type === "multiple-choice") {
    return `
      <div class="choice-list" role="radiogroup">
        ${(question.choices || [])
          .map((choice, index) => {
            const id = `${question.id}-${index}`;
            const checked = choice === savedValue ? " checked" : "";
            return `
              <label class="choice-row" for="${id}">
                <input id="${id}" type="radio" name="${question.id}" value="${escapeAttr(choice)}"${checked}>
                <span>${escapeHtml(choice)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    `;
  }
  if (question.type === "true-false") {
    return `
      <div class="choice-list two-col" role="radiogroup">
        ${["true", "false"]
          .map((choice) => {
            const checked = String(savedValue) === choice ? " checked" : "";
            return `
              <label class="choice-row">
                <input type="radio" name="${question.id}" value="${choice}"${checked}>
                <span>${choice}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    `;
  }
  return `
    <label class="text-answer">
      <span>Answer</span>
      <input type="text" name="${question.id}" value="${escapeAttr(savedValue || "")}">
    </label>
  `;
}

function renderFeedback(question, answer) {
  const status = answer.correct ? "Correct" : "Review";
  return `
    <div class="${answer.correct ? "feedback-correct" : "feedback-review"}">
      <strong>${status}.</strong>
      <span>${escapeHtml(question.explanation || "")}</span>
      <div class="answer-line">Answer: <code>${escapeHtml(String(question.answer))}</code></div>
    </div>
  `;
}

export function mountQuiz(root, lecture, quiz) {
  if (!quiz) return;
  root.querySelectorAll("[data-submit-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = quiz.questions.find((item) => item.id === button.dataset.submitQuestion);
      if (!question) return;
      const card = button.closest("[data-quiz-question]");
      const response = readQuestionResponse(card, question);
      const correct = isCorrectAnswer(question, response);
      const saved = readStore(quizStoreKey(lecture.id), { answers: {} });
      saved.answers = saved.answers || {};
      saved.answers[question.id] = { response, correct, submittedAt: Date.now() };
      writeStore(quizStoreKey(lecture.id), saved);
      card.classList.add("is-answered");
      card.querySelector(".feedback").innerHTML = renderFeedback(question, { response, correct });
      updateQuizProgress(root, lecture.id, quiz);
      window.dispatchEvent(new CustomEvent("cs336-progress-updated"));
    });
  });
  root.querySelectorAll("[data-show-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = quiz.questions.find((item) => item.id === button.dataset.showAnswer);
      const card = button.closest("[data-quiz-question]");
      if (question && card) {
        card.querySelector(".feedback").innerHTML = renderFeedback(question, {
          response: question.answer,
          correct: true,
        });
      }
    });
  });
  const reset = root.querySelector(`[data-reset-quiz="${lecture.id}"]`);
  reset?.addEventListener("click", () => {
    removeStore(quizStoreKey(lecture.id));
    window.dispatchEvent(new CustomEvent("cs336-route-refresh"));
  });
}

function readQuestionResponse(card, question) {
  if (question.type === "multiple-choice" || question.type === "true-false") {
    const selected = card.querySelector(`input[name="${CSS.escape(question.id)}"]:checked`);
    if (!selected) return "";
    return question.type === "true-false" ? selected.value === "true" : selected.value;
  }
  return card.querySelector(`input[name="${CSS.escape(question.id)}"]`)?.value || "";
}

function updateQuizProgress(root, lectureId, quiz) {
  const summary = quizSummary(lectureId, quiz);
  const node = root.querySelector("[data-quiz-progress]");
  if (node) node.textContent = `${summary.correct}/${summary.total} correct`;
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
