export function renderInteractive(interactive) {
  if (interactive.type === "code-sandbox") {
    return renderCodeSandbox(interactive);
  }
  if (interactive.type === "slider") {
    return renderSlider(interactive);
  }
  return "";
}

function renderSlider(interactive) {
  return `
    <article class="interactive-card" data-interactive="${interactive.id}" data-kind="${interactive.kind}">
      <div class="interactive-header">
        <div>
          <p class="eyebrow">Illustrative Interactive</p>
          <h3>${escapeHtml(interactive.title)}</h3>
        </div>
        <span class="status-chip">synthetic</span>
      </div>
      <p>${escapeHtml(interactive.description)}</p>
      <label class="slider-row">
        <span>Parameter</span>
        <input type="range" min="${interactive.min}" max="${interactive.max}" value="${interactive.default}" data-slider-input>
      </label>
      <div class="slider-output" data-slider-output></div>
      <div class="toy-viz" aria-hidden="true" data-slider-viz>
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </article>
  `;
}

function renderCodeSandbox(interactive) {
  const executable = interactive.safeExecution && interactive.language === "javascript";
  return `
    <article class="interactive-card code-sandbox" data-interactive="${interactive.id}">
      <div class="interactive-header">
        <div>
          <p class="eyebrow">Try It</p>
          <h3>${escapeHtml(interactive.title)}</h3>
        </div>
        <span class="status-chip">${executable ? "executable" : "static"}</span>
      </div>
      <p>${escapeHtml(interactive.description)}</p>
      <textarea spellcheck="false" data-code-editor>${escapeHtml(interactive.code || "")}</textarea>
      <div class="question-actions">
        <button class="secondary-button" type="button" data-reset-code>Reset</button>
        ${
          executable
            ? `<button class="primary-button" type="button" data-run-code>Run</button>
               <button class="ghost-button" type="button" data-clear-output>Clear output</button>`
            : `<button class="primary-button" type="button" data-reveal-output>Reveal</button>`
        }
      </div>
      ${executable ? `<pre class="execution-output" aria-live="polite" data-code-output>Run the snippet to see output.</pre>` : ""}
      <div class="expected-output" hidden>
        <span>${executable ? "Expected behavior" : "Expected inspection target"}</span>
        <code>${escapeHtml(interactive.expectedOutput || "Source review")}</code>
      </div>
    </article>
  `;
}

export function mountInteractives(root, interactives) {
  root.querySelectorAll("[data-interactive]").forEach((card) => {
    const interactive = interactives.find((item) => item.id === card.dataset.interactive);
    if (!interactive) return;
    if (interactive.type === "slider") mountSlider(card, interactive);
    if (interactive.type === "code-sandbox") mountCodeSandbox(card, interactive);
  });
}

function mountSlider(card, interactive) {
  const input = card.querySelector("[data-slider-input]");
  const output = card.querySelector("[data-slider-output]");
  const viz = card.querySelector("[data-slider-viz]");
  const update = () => {
    const value = Number(input.value);
    output.innerHTML = sliderOutput(interactive.kind, value);
    viz?.querySelectorAll("span").forEach((bar, index) => {
      const scale = Math.max(8, ((value + index * 13) % 100) + 8);
      bar.style.height = `${scale}%`;
    });
  };
  input.addEventListener("input", update);
  update();
}

function sliderOutput(kind, value) {
  if (kind === "token-context") {
    return `<strong>${value * 128}</strong> tokens, illustrative attention work index <strong>${Math.round((value * value) / 4)}</strong>`;
  }
  if (kind === "learning-rate") {
    return `Learning-rate scale <strong>${(value / 1000).toFixed(3)}</strong>, update size index <strong>${value}</strong>`;
  }
  if (kind === "batch-size") {
    return `<strong>${value}</strong> sequences, synthetic tokens per update <strong>${value * 2048}</strong>`;
  }
  if (kind.includes("top")) {
    return `Candidate set size index <strong>${value}</strong>, diversity index <strong>${Math.round(Math.sqrt(value) * 10)}</strong>`;
  }
  if (kind.includes("temperature")) {
    return `Temperature <strong>${(value / 40).toFixed(2)}</strong>, entropy index <strong>${value}</strong>`;
  }
  if (kind === "memory") {
    return `Memory pressure index <strong>${value}</strong>, optimizer-state multiplier <strong>${Math.max(1, Math.round(value / 16))}x</strong>`;
  }
  return `Parameter value <strong>${value}</strong>, illustrative response <strong>${Math.round(Math.log2(value + 1) * 20)}</strong>`;
}

function mountCodeSandbox(card, interactive) {
  const editor = card.querySelector("[data-code-editor]");
  card.querySelector("[data-reset-code]")?.addEventListener("click", () => {
    editor.value = interactive.code || "";
    const output = card.querySelector("[data-code-output]");
    if (output) output.textContent = "Run the snippet to see output.";
  });
  card.querySelector("[data-run-code]")?.addEventListener("click", async () => {
    const output = card.querySelector("[data-code-output]");
    if (!output) return;
    output.textContent = "Running...";
    const result = await runJavaScriptInWorker(editor.value);
    output.textContent = result;
    card.querySelector(".expected-output").hidden = false;
  });
  card.querySelector("[data-clear-output]")?.addEventListener("click", () => {
    const output = card.querySelector("[data-code-output]");
    if (output) output.textContent = "Run the snippet to see output.";
  });
  card.querySelector("[data-reveal-output]")?.addEventListener("click", () => {
    card.querySelector(".expected-output").hidden = false;
  });
}

function runJavaScriptInWorker(code) {
  if (!window.Worker || !window.Blob || !window.URL) {
    return Promise.resolve("This browser does not support Web Worker execution.");
  }

  const workerSource = `
    const format = (value) => {
      if (typeof value === "undefined") return "undefined";
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    };

    self.onmessage = async (event) => {
      const logs = [];
      const scopedConsole = {
        log: (...args) => logs.push(args.map(format).join(" ")),
        warn: (...args) => logs.push("warn: " + args.map(format).join(" ")),
        error: (...args) => logs.push("error: " + args.map(format).join(" ")),
      };
      const blocked = () => {
        throw new Error("Network and dynamic imports are disabled in this sandbox.");
      };
      try {
        const fn = new Function(
          "console",
          "fetch",
          "XMLHttpRequest",
          "WebSocket",
          "importScripts",
          '"use strict";\\n' + event.data.code,
        );
        const value = await fn(scopedConsole, blocked, undefined, undefined, blocked);
        self.postMessage({ ok: true, logs, value: format(value) });
      } catch (error) {
        self.postMessage({ ok: false, logs, error: error && error.message ? error.message : String(error) });
      }
    };
  `;

  const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const worker = new Worker(url);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve("Execution timed out after 1000 ms.");
    }, 1000);

    worker.onmessage = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      const { ok, logs, value, error } = event.data;
      const lines = [...(logs || [])];
      if (ok && value !== "undefined") lines.push(`return: ${value}`);
      if (!ok) lines.push(`error: ${error}`);
      resolve(lines.join("\\n") || "Completed with no output.");
    };

    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(`error: ${event.message}`);
    };

    worker.postMessage({ code });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
