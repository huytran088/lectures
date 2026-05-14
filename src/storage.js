const PREFIX = "cs336.textbook.";

export function readStore(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function removeStore(key) {
  localStorage.removeItem(PREFIX + key);
}

export function normalizeAnswer(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_+.-]+/g, " ")
    .trim();
}

export function isCorrectAnswer(question, response) {
  if (question.type === "true-false") {
    return String(response) === String(question.answer);
  }
  const expected = normalizeAnswer(question.answer);
  const actual = normalizeAnswer(response);
  if (!actual) return false;
  if (question.type === "short-answer" || question.type === "fill-in-the-blank") {
    return actual.includes(expected) || expected.includes(actual);
  }
  return actual === expected;
}
