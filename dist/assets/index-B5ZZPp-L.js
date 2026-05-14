(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`cs336.textbook.`;function t(t,n={}){try{let r=localStorage.getItem(e+t);return r?JSON.parse(r):n}catch{return n}}function n(t,n){localStorage.setItem(e+t,JSON.stringify(n))}function r(t){localStorage.removeItem(e+t)}function i(e){return String(e??``).toLowerCase().replace(/[^a-z0-9_+.-]+/g,` `).trim()}function a(e,t){if(e.type===`true-false`)return String(t)===String(e.answer);let n=i(e.answer),r=i(t);return r?e.type===`short-answer`||e.type===`fill-in-the-blank`?r.includes(n)||n.includes(r):r===n:!1}var o=`flashcards`;function s(e){let n=t(o,{known:{},again:{}});return{known:e.filter(e=>n.known?.[e.id]).length,again:e.filter(e=>n.again?.[e.id]).length,total:e.length}}function c(e){let t=e.flashcards.cards||[],n=[...new Set(t.flatMap(e=>e.tags||[]))].sort(),r=s(t);return`
    <section class="flashcard-page">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">Review</p>
          <h1>Flashcards</h1>
        </div>
        <div class="progress-pill">${r.known}/${r.total} known</div>
      </div>
      <div class="flashcard-controls">
        <label>
          <span>Lecture</span>
          <select data-card-lecture>
            <option value="">All lectures</option>
            ${e.lectures.map(e=>`<option value="${e.id}">${e.title}</option>`).join(``)}
          </select>
        </label>
        <label>
          <span>Tag</span>
          <select data-card-tag>
            <option value="">All tags</option>
            ${n.map(e=>`<option value="${e}">${e}</option>`).join(``)}
          </select>
        </label>
        <button class="secondary-button" type="button" data-card-shuffle>Shuffle</button>
        <button class="ghost-button" type="button" data-card-reset>Reset progress</button>
      </div>
      <div class="flashcard-stage" data-card-stage></div>
    </section>
  `}function l(e,i){let a=i.flashcards.cards||[],s=e.querySelector(`[data-card-stage]`),c=e.querySelector(`[data-card-lecture]`),l=e.querySelector(`[data-card-tag]`),f=a.map((e,t)=>t),p=0,m=!1,h=()=>{let e=c.value,t=l.value;return f.map(e=>a[e]).filter(n=>(!e||n.lectureId===e)&&(!t||(n.tags||[]).includes(t)))},g=()=>{let e=h();if(!e.length){s.innerHTML=`<p class="empty-state">No cards match the current filters.</p>`;return}p=Math.min(p,e.length-1);let r=e[p],i=t(o,{known:{},again:{}});s.innerHTML=`
      <button class="flashcard${m?` is-flipped`:``}" type="button" data-flip-card aria-pressed="${m}">
        <span class="card-face card-front">${d(r.front)}</span>
        <span class="card-face card-back">${d(r.back)}</span>
      </button>
      <div class="flashcard-meta">
        <span>${p+1}/${e.length}</span>
        <span>${d(r.sectionTitle||r.lectureId)}</span>
        <span>${d(r.difficulty||`medium`)}</span>
      </div>
      <div class="flashcard-actions">
        <button class="secondary-button" type="button" data-card-prev>Previous</button>
        <button class="secondary-button" type="button" data-card-next>Next</button>
        <button class="primary-button" type="button" data-card-known>${i.known?.[r.id]?`Known`:`Mark known`}</button>
        <button class="ghost-button" type="button" data-card-again>${i.again?.[r.id]?`Reviewing`:`Review again`}</button>
      </div>
    `,s.querySelector(`[data-flip-card]`).addEventListener(`click`,()=>{m=!m,g()}),s.querySelector(`[data-card-prev]`).addEventListener(`click`,()=>{p=(p-1+e.length)%e.length,m=!1,g()}),s.querySelector(`[data-card-next]`).addEventListener(`click`,()=>{p=(p+1)%e.length,m=!1,g()}),s.querySelector(`[data-card-known]`).addEventListener(`click`,()=>{let e=t(o,{known:{},again:{}});e.known=e.known||{},e.again=e.again||{},e.known[r.id]=!e.known[r.id],e.known[r.id]&&delete e.again[r.id],n(o,e),g()}),s.querySelector(`[data-card-again]`).addEventListener(`click`,()=>{let e=t(o,{known:{},again:{}});e.known=e.known||{},e.again=e.again||{},e.again[r.id]=!e.again[r.id],e.again[r.id]&&delete e.known[r.id],n(o,e),g()})};c.addEventListener(`change`,()=>{p=0,m=!1,g()}),l.addEventListener(`change`,()=>{p=0,m=!1,g()}),e.querySelector(`[data-card-shuffle]`).addEventListener(`click`,()=>{f=u(f),p=0,m=!1,g()}),e.querySelector(`[data-card-reset]`).addEventListener(`click`,()=>{r(o),g()}),g()}function u(e){let t=[...e];for(let e=t.length-1;e>0;--e){let n=Math.floor(Math.random()*(e+1));[t[e],t[n]]=[t[n],t[e]]}return t}function d(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`)}function f(e){return e.type===`code-sandbox`?m(e):e.type===`slider`?p(e):``}function p(e){return`
    <article class="interactive-card" data-interactive="${e.id}" data-kind="${e.kind}">
      <div class="interactive-header">
        <div>
          <p class="eyebrow">Illustrative Interactive</p>
          <h3>${b(e.title)}</h3>
        </div>
        <span class="status-chip">synthetic</span>
      </div>
      <p>${b(e.description)}</p>
      <label class="slider-row">
        <span>Parameter</span>
        <input type="range" min="${e.min}" max="${e.max}" value="${e.default}" data-slider-input>
      </label>
      <div class="slider-output" data-slider-output></div>
      <div class="toy-viz" aria-hidden="true" data-slider-viz>
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </article>
  `}function m(e){let t=e.safeExecution&&e.language===`javascript`;return`
    <article class="interactive-card code-sandbox" data-interactive="${e.id}">
      <div class="interactive-header">
        <div>
          <p class="eyebrow">Try It</p>
          <h3>${b(e.title)}</h3>
        </div>
        <span class="status-chip">${t?`executable`:`static`}</span>
      </div>
      <p>${b(e.description)}</p>
      <textarea spellcheck="false" data-code-editor>${b(e.code||``)}</textarea>
      <div class="question-actions">
        <button class="secondary-button" type="button" data-reset-code>Reset</button>
        ${t?`<button class="primary-button" type="button" data-run-code>Run</button>
               <button class="ghost-button" type="button" data-clear-output>Clear output</button>`:`<button class="primary-button" type="button" data-reveal-output>Reveal</button>`}
      </div>
      ${t?`<pre class="execution-output" aria-live="polite" data-code-output>Run the snippet to see output.</pre>`:``}
      <div class="expected-output" hidden>
        <span>${t?`Expected behavior`:`Expected inspection target`}</span>
        <code>${b(e.expectedOutput||`Source review`)}</code>
      </div>
    </article>
  `}function h(e,t){e.querySelectorAll(`[data-interactive]`).forEach(e=>{let n=t.find(t=>t.id===e.dataset.interactive);n&&(n.type===`slider`&&g(e,n),n.type===`code-sandbox`&&v(e,n))})}function g(e,t){let n=e.querySelector(`[data-slider-input]`),r=e.querySelector(`[data-slider-output]`),i=e.querySelector(`[data-slider-viz]`),a=()=>{let e=Number(n.value);r.innerHTML=_(t.kind,e),i?.querySelectorAll(`span`).forEach((t,n)=>{let r=Math.max(8,(e+n*13)%100+8);t.style.height=`${r}%`})};n.addEventListener(`input`,a),a()}function _(e,t){return e===`token-context`?`<strong>${t*128}</strong> tokens, illustrative attention work index <strong>${Math.round(t*t/4)}</strong>`:e===`learning-rate`?`Learning-rate scale <strong>${(t/1e3).toFixed(3)}</strong>, update size index <strong>${t}</strong>`:e===`batch-size`?`<strong>${t}</strong> sequences, synthetic tokens per update <strong>${t*2048}</strong>`:e.includes(`top`)?`Candidate set size index <strong>${t}</strong>, diversity index <strong>${Math.round(Math.sqrt(t)*10)}</strong>`:e.includes(`temperature`)?`Temperature <strong>${(t/40).toFixed(2)}</strong>, entropy index <strong>${t}</strong>`:e===`memory`?`Memory pressure index <strong>${t}</strong>, optimizer-state multiplier <strong>${Math.max(1,Math.round(t/16))}x</strong>`:`Parameter value <strong>${t}</strong>, illustrative response <strong>${Math.round(Math.log2(t+1)*20)}</strong>`}function v(e,t){let n=e.querySelector(`[data-code-editor]`);e.querySelector(`[data-reset-code]`)?.addEventListener(`click`,()=>{n.value=t.code||``;let r=e.querySelector(`[data-code-output]`);r&&(r.textContent=`Run the snippet to see output.`)}),e.querySelector(`[data-run-code]`)?.addEventListener(`click`,async()=>{let t=e.querySelector(`[data-code-output]`);t&&(t.textContent=`Running...`,t.textContent=await y(n.value),e.querySelector(`.expected-output`).hidden=!1)}),e.querySelector(`[data-clear-output]`)?.addEventListener(`click`,()=>{let t=e.querySelector(`[data-code-output]`);t&&(t.textContent=`Run the snippet to see output.`)}),e.querySelector(`[data-reveal-output]`)?.addEventListener(`click`,()=>{e.querySelector(`.expected-output`).hidden=!1})}function y(e){if(!window.Worker||!window.Blob||!window.URL)return Promise.resolve(`This browser does not support Web Worker execution.`);let t=URL.createObjectURL(new Blob([`
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
  `],{type:`text/javascript`})),n=new Worker(t);return new Promise(r=>{let i=window.setTimeout(()=>{n.terminate(),URL.revokeObjectURL(t),r(`Execution timed out after 1000 ms.`)},1e3);n.onmessage=e=>{window.clearTimeout(i),n.terminate(),URL.revokeObjectURL(t);let{ok:a,logs:o,value:s,error:c}=e.data,l=[...o||[]];a&&s!==`undefined`&&l.push(`return: ${s}`),a||l.push(`error: ${c}`),r(l.join(`\\n`)||`Completed with no output.`)},n.onerror=e=>{window.clearTimeout(i),n.terminate(),URL.revokeObjectURL(t),r(`error: ${e.message}`)},n.postMessage({code:e})})}function b(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`)}function x(e){return`checks.${e}`}function S(e,n){let r=t(x(e),{answers:{}});return{total:n?.length||0,answered:Object.keys(r.answers||{}).length,correct:Object.values(r.answers||{}).filter(e=>e.correct).length}}function C(e,n){let r=t(x(e),{answers:{}}).answers?.[n.id];return`
    <article class="quick-check${r?` is-answered`:``}" data-check-id="${n.id}">
      <div class="quick-check-label">Check Your Understanding</div>
      <h3>${D(n.prompt)}</h3>
      ${ee(n,r?.response)}
      <div class="question-actions">
        <button class="primary-button" type="button" data-submit-check="${n.id}">Check</button>
      </div>
      <div class="feedback" aria-live="polite">${r?E(n,r):``}</div>
    </article>
  `}function w(e,t){let n=S(e,t);return`
    <div class="inline-progress">
      <span>${n.correct}/${n.total} quick checks correct</span>
      <button class="ghost-button" type="button" data-reset-checks="${e}">Reset quick checks</button>
    </div>
  `}function ee(e,t){return e.type===`multiple-choice`?`
      <div class="choice-list" role="radiogroup">
        ${(e.choices||[]).map((n,r)=>`
            <label class="choice-row">
              <input type="radio" name="${e.id}" value="${O(n)}"${n===t?` checked`:``}>
              <span>${D(n)}</span>
            </label>
          `).join(``)}
      </div>
    `:e.type===`true-false`?`
      <div class="choice-list two-col" role="radiogroup">
        ${[`true`,`false`].map(n=>`
            <label class="choice-row">
              <input type="radio" name="${e.id}" value="${n}"${String(t)===n?` checked`:``}>
              <span>${n}</span>
            </label>
          `).join(``)}
      </div>
    `:`
    <label class="text-answer compact">
      <span>Answer</span>
      <input type="text" name="${e.id}" value="${O(t||``)}">
    </label>
  `}function te(e,i,o){e.querySelectorAll(`[data-submit-check]`).forEach(e=>{e.addEventListener(`click`,()=>{let r=o.find(t=>t.id===e.dataset.submitCheck);if(!r)return;let s=e.closest(`[data-check-id]`),c=T(s,r),l=a(r,c),u=t(x(i),{answers:{}});u.answers=u.answers||{},u.answers[r.id]={response:c,correct:l,submittedAt:Date.now()},n(x(i),u),s.classList.add(`is-answered`),s.querySelector(`.feedback`).innerHTML=E(r,{response:c,correct:l}),window.dispatchEvent(new CustomEvent(`cs336-progress-updated`))})}),e.querySelector(`[data-reset-checks="${i}"]`)?.addEventListener(`click`,()=>{r(x(i)),window.dispatchEvent(new CustomEvent(`cs336-route-refresh`))})}function T(e,t){if(t.type===`multiple-choice`||t.type===`true-false`){let n=e.querySelector(`input[name="${CSS.escape(t.id)}"]:checked`);return n?t.type===`true-false`?n.value===`true`:n.value:``}return e.querySelector(`input[name="${CSS.escape(t.id)}"]`)?.value||``}function E(e,t){return`
    <div class="${t.correct?`feedback-correct`:`feedback-review`}">
      <strong>${t.correct?`Correct.`:`Review.`}</strong>
      <span>${D(e.explanation||``)}</span>
      <div class="answer-line">Answer: <code>${D(String(e.answer))}</code></div>
    </div>
  `}function D(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`)}function O(e){return D(e).replaceAll(`'`,`&#39;`)}function k(e){return`quiz.${e}`}function A(e,n){let r=t(k(e),{answers:{}});return{answered:Object.keys(r.answers||{}).length,total:n?.questions?.length||0,correct:Object.values(r.answers||{}).filter(e=>e.correct).length}}function j(e,t){let n=t?.questions||[],r=A(e.id,t);return`
    <section class="quiz-panel" id="quiz" aria-labelledby="quiz-heading">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">End-of-Lecture Quiz</p>
          <h2 id="quiz-heading">Lecture Checkpoint</h2>
        </div>
        <div class="progress-pill" data-quiz-progress>${r.correct}/${r.total} correct</div>
      </div>
      <div class="quiz-actions">
        <button class="secondary-button" type="button" data-reset-quiz="${e.id}">Reset quiz</button>
      </div>
      <div class="question-list">
        ${n.map((t,n)=>M(e.id,t,n)).join(``)}
      </div>
    </section>
  `}function M(e,n,r){let i=t(k(e),{answers:{}}).answers?.[n.id];return`
    <article class="question-card${i?` is-answered`:``}" data-quiz-question="${n.id}">
      <div class="question-topline">
        <span>Question ${r+1}</span>
        <span>${n.type.replaceAll(`-`,` `)}</span>
      </div>
      <h3>${L(n.prompt)}</h3>
      ${n.code?`<pre class="code-block"><code>${L(n.code)}</code></pre>`:``}
      ${N(n,i?.response)}
      <div class="question-actions">
        <button class="primary-button" type="button" data-submit-question="${n.id}">Submit</button>
        <button class="ghost-button" type="button" data-show-answer="${n.id}">Show answer</button>
      </div>
      <div class="feedback" aria-live="polite">${i?P(n,i):``}</div>
    </article>
  `}function N(e,t){return e.type===`multiple-choice`?`
      <div class="choice-list" role="radiogroup">
        ${(e.choices||[]).map((n,r)=>{let i=`${e.id}-${r}`,a=n===t?` checked`:``;return`
              <label class="choice-row" for="${i}">
                <input id="${i}" type="radio" name="${e.id}" value="${R(n)}"${a}>
                <span>${L(n)}</span>
              </label>
            `}).join(``)}
      </div>
    `:e.type===`true-false`?`
      <div class="choice-list two-col" role="radiogroup">
        ${[`true`,`false`].map(n=>{let r=String(t)===n?` checked`:``;return`
              <label class="choice-row">
                <input type="radio" name="${e.id}" value="${n}"${r}>
                <span>${n}</span>
              </label>
            `}).join(``)}
      </div>
    `:`
    <label class="text-answer">
      <span>Answer</span>
      <input type="text" name="${e.id}" value="${R(t||``)}">
    </label>
  `}function P(e,t){let n=t.correct?`Correct`:`Review`;return`
    <div class="${t.correct?`feedback-correct`:`feedback-review`}">
      <strong>${n}.</strong>
      <span>${L(e.explanation||``)}</span>
      <div class="answer-line">Answer: <code>${L(String(e.answer))}</code></div>
    </div>
  `}function ne(e,i,o){o&&(e.querySelectorAll(`[data-submit-question]`).forEach(r=>{r.addEventListener(`click`,()=>{let s=o.questions.find(e=>e.id===r.dataset.submitQuestion);if(!s)return;let c=r.closest(`[data-quiz-question]`),l=F(c,s),u=a(s,l),d=t(k(i.id),{answers:{}});d.answers=d.answers||{},d.answers[s.id]={response:l,correct:u,submittedAt:Date.now()},n(k(i.id),d),c.classList.add(`is-answered`),c.querySelector(`.feedback`).innerHTML=P(s,{response:l,correct:u}),I(e,i.id,o),window.dispatchEvent(new CustomEvent(`cs336-progress-updated`))})}),e.querySelectorAll(`[data-show-answer]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=o.questions.find(t=>t.id===e.dataset.showAnswer),n=e.closest(`[data-quiz-question]`);t&&n&&(n.querySelector(`.feedback`).innerHTML=P(t,{response:t.answer,correct:!0}))})}),e.querySelector(`[data-reset-quiz="${i.id}"]`)?.addEventListener(`click`,()=>{r(k(i.id)),window.dispatchEvent(new CustomEvent(`cs336-route-refresh`))}))}function F(e,t){if(t.type===`multiple-choice`||t.type===`true-false`){let n=e.querySelector(`input[name="${CSS.escape(t.id)}"]:checked`);return n?t.type===`true-false`?n.value===`true`:n.value:``}return e.querySelector(`input[name="${CSS.escape(t.id)}"]`)?.value||``}function I(e,t,n){let r=A(t,n),i=e.querySelector(`[data-quiz-progress]`);i&&(i.textContent=`${r.correct}/${r.total} correct`)}function L(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`)}function R(e){return L(e).replaceAll(`'`,`&#39;`)}var z=`/lectures/`,B=`${z}data/site-data.json`,V=document.querySelector(`#app`),H=null;U();async function U(){V.innerHTML=`<main class="loading-view">Loading CS336 lectures...</main>`;try{let e=await fetch(B);if(!e.ok)throw Error(`Unable to load ${B}`);H=await e.json(),window.addEventListener(`hashchange`,W),window.addEventListener(`cs336-route-refresh`,W),window.addEventListener(`cs336-progress-updated`,Y),W()}catch(e){V.innerHTML=`
      <main class="loading-view">
        <h1>Generated content is missing</h1>
        <p>Run <code>npm run generate</code>, then restart the dev server.</p>
        <pre>${Q(e.message)}</pre>
      </main>
    `}}function W(){let e=G();V.innerHTML=`
    <div class="app-shell">
      ${K(e)}
      <main class="main-pane" id="main" tabindex="-1"></main>
    </div>
  `,J();let t=V.querySelector(`#main`);if(e.type===`flashcards`)t.innerHTML=c(H),l(t,H);else if(e.type===`lecture`){let n=H.lectures.find(t=>t.id===e.lectureId)||H.lectures[0];t.innerHTML=ie(n);let r=H.checks[n.id]?.checks||[],i=H.interactives[n.id]?.interactives||[];te(t,n.id,r),h(t,i),ne(t,n,H.quizzes[n.id])}else t.innerHTML=X(),re(t);ue(t,e),Y(),t.focus({preventScroll:!0})}function G(){let e=window.location.hash.replace(/^#\/?/,``);return e.startsWith(`lecture/`)?{type:`lecture`,lectureId:e.split(`/`)[1]}:e===`flashcards`?{type:`flashcards`}:{type:`home`}}function K(e){return`
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
        ${H.lectures.map(t=>q(t,e)).join(``)}
      </nav>
      <a class="flashcard-link${e.type===`flashcards`?` is-active`:``}" href="#/flashcards">
        <span>Flashcards</span>
        <span>${H.flashcards.cards.length}</span>
      </a>
    </aside>
  `}function q(e,t){let n=t.type===`lecture`&&t.lectureId===e.id,r=A(e.id,H.quizzes[e.id]),i=S(e.id,H.checks[e.id]?.checks||[]),a=`${e.title} ${e.summary} ${(e.concepts||[]).join(` `)}`.toLowerCase();return`
    <a class="nav-item${n?` is-active`:``}" href="#/lecture/${e.id}" data-search-text="${$(a)}" data-progress-for="${e.id}">
      <span class="lecture-number">${String(e.number).padStart(2,`0`)}</span>
      <span class="nav-item-text">
        <strong>${Q(e.title)}</strong>
        <small>${e.sourceType.toUpperCase()} | ${i.correct}/${i.total} checks | ${r.correct}/${r.total} quiz</small>
      </span>
    </a>
  `}function J(){let e=V.querySelector(`[data-sidebar-search]`);e?.addEventListener(`input`,()=>{let t=e.value.toLowerCase().trim();V.querySelectorAll(`[data-search-text]`).forEach(e=>{e.hidden=t&&!e.dataset.searchText.includes(t)})})}function Y(){H&&H.lectures.forEach(e=>{let t=V.querySelector(`[data-progress-for="${e.id}"] small`);if(!t)return;let n=A(e.id,H.quizzes[e.id]),r=S(e.id,H.checks[e.id]?.checks||[]);t.textContent=`${e.sourceType.toUpperCase()} | ${r.correct}/${r.total} checks | ${n.correct}/${n.total} quiz`})}function X(){let e=H.manifest.lectures.filter(e=>e.generatedStatus===`extracted`).length;return`
    <section class="home-header">
      <p class="eyebrow">${H.course.subtitle}</p>
      <h1>${H.course.title}</h1>
      <p>${H.lectures.length} detected lectures, ${e} with extracted text, ${H.flashcards.cards.length} generated review cards.</p>
      <label class="home-search">
        <span>Search course content</span>
        <input type="search" data-home-search placeholder="Try attention, token, memory, scaling">
      </label>
    </section>
    <section class="lecture-grid" aria-label="Detected lectures">
      ${H.lectures.map(Z).join(``)}
    </section>
  `}function Z(e){let t=H.quizzes[e.id],n=H.checks[e.id];return`
    <article class="lecture-card" data-home-card data-search-text="${$(`${e.title} ${e.summary} ${(e.concepts||[]).join(` `)}`.toLowerCase())}">
      <div class="card-topline">
        <span>Lecture ${String(e.number).padStart(2,`0`)}</span>
        <span>${e.sourceType.toUpperCase()}</span>
      </div>
      <h2><a href="#/lecture/${e.id}">${Q(e.title)}</a></h2>
      <p>${Q(e.summary)}</p>
      <div class="metadata-row">
        <span>${e.generatedStatus}</span>
        <span>${t.questions.length} quiz</span>
        <span>${n.checks.length} checks</span>
        <span>${e.metadata.flashcardCount} cards</span>
      </div>
      <div class="concept-list">
        ${(e.concepts||[]).slice(0,5).map(e=>`<span>${Q(e)}</span>`).join(``)}
      </div>
    </article>
  `}function re(e){let t=e.querySelector(`[data-home-search]`);t?.addEventListener(`input`,()=>{let n=t.value.toLowerCase().trim();e.querySelectorAll(`[data-home-card]`).forEach(e=>{e.hidden=n&&!e.dataset.searchText.includes(n)})})}function ie(e){let t=H.checks[e.id]?.checks||[],n=H.quizzes[e.id],r=H.interactives[e.id]?.interactives||[];return`
    <article class="lecture-page">
      <header class="lecture-hero">
        <p class="eyebrow">Lecture ${String(e.number).padStart(2,`0`)}</p>
        <h1>${Q(e.title)}</h1>
        <p>${Q(e.summary)}</p>
        ${ae(e,n,t,r)}
      </header>
      <nav class="section-index" aria-label="Section anchors">
        ${e.sections.map(e=>`<a href="#${e.id}">${Q(e.title)}</a>`).join(``)}
      </nav>
      ${w(e.id,t)}
      <div class="lesson-flow">
        ${e.sections.map(n=>oe(e,n,t,r)).join(``)}
      </div>
      ${j(e,n)}
    </article>
  `}function ae(e,t,n,r){return`
    <dl class="metadata-panel">
      <div><dt>Source</dt><dd>${Q(e.sourceFile)}</dd></div>
      <div><dt>Status</dt><dd>${Q(e.generatedStatus)}</dd></div>
      <div><dt>Quiz</dt><dd>${t.partial?`partial`:`complete`} (${t.questions.length})</dd></div>
      <div><dt>Quick checks</dt><dd>${n.length}</dd></div>
      <div><dt>Flashcards</dt><dd>${e.metadata.flashcardCount}</dd></div>
      <div><dt>Interactives</dt><dd>${r.length}</dd></div>
    </dl>
    ${e.warnings?.length?`<div class="warning-strip">${e.warnings.map(Q).join(` `)}</div>`:``}
  `}function oe(e,t,n,r){let i=n.filter(e=>e.sectionId===t.id),a=r.filter(e=>e.sectionId===t.id);return`
    <section class="lesson-section" id="${t.id}">
      <div class="section-heading-row">
        <div>
          <p class="eyebrow">Active Reading</p>
          <h2>${Q(t.title)}</h2>
        </div>
        <a class="anchor-link" href="#${t.id}" aria-label="Anchor for ${$(t.title)}">#</a>
      </div>
      <div class="section-body">${le(t.html)}</div>
      ${se(t)}
      ${i.map(t=>C(e.id,t)).join(``)}
      ${a.map(f).join(``)}
      ${ce(t)}
    </section>
  `}function se(e){let t=e.plainText.split(/(?<=[.!?])\s+/).map(e=>e.trim()).filter(e=>e.length>45),n=t[0],r=t.find(e=>/wrong|caveat|however|but\b/i.test(e));return`
    <div class="callout-row">
      ${n?`<aside class="callout"><strong>Summary</strong><p>${Q(n)}</p></aside>`:``}
      <details class="hint-box">
        <summary>Hint</summary>
        <p>${Q(n||`Use the nearest extracted section text as evidence before answering.`)}</p>
      </details>
      ${r?`<aside class="misconception"><strong>Common misconception</strong><p>${Q(r)}</p></aside>`:``}
    </div>
  `}function ce(e){let t=(e.concepts||[]).slice(0,6);return t.length?`
    <div class="glossary-strip" aria-label="Section concepts">
      ${t.map(t=>`
            <button class="glossary-term" type="button">
              <span>${Q(t)}</span>
              <small>${Q(e.title)}</small>
            </button>
          `).join(``)}
    </div>
  `:``}function le(e){return String(e||``).replace(/\b(src|href)="(images|sources)\//g,`$1="${z}$2/`)}function ue(e,t){new URLSearchParams(window.location.search).has(`smoke`)&&window.setTimeout(()=>{let n=[];if(t.type===`lecture`){let t=e.querySelector(`.quick-check input[type='radio']`),r=e.querySelector(`.quick-check [data-submit-check]`);t?.click(),r?.click(),n.push(`quick-check:${e.querySelector(`.quick-check .feedback-correct`)?`pass`:`fail`}`);let i=e.querySelector(`.question-card input[type='radio']`),a=e.querySelector(`.question-card [data-submit-question]`);i?.click(),a?.click(),n.push(`quiz:${e.querySelector(`.question-card .feedback-correct`)?`pass`:`fail`}`);let o=e.querySelector(`[data-slider-input]`),s=e.querySelector(`[data-slider-output]`)?.textContent||``;o&&(o.value=`70`,o.dispatchEvent(new Event(`input`,{bubbles:!0})));let c=e.querySelector(`[data-slider-output]`)?.textContent||``;n.push(`slider:${s&&c&&s!==c?`pass`:`fail`}`);let l=e.querySelector(`[data-run-code]`);l?.click();let u=e.querySelector(`[data-reveal-output]`);u?.click(),window.setTimeout(()=>{let t=e.querySelector(`[data-code-output]`),r=e.querySelector(`.expected-output`),i=n.findIndex(e=>e.startsWith(`sandbox:`)),a=t&&!/Run the snippet|Running/.test(t.textContent||``)||r&&r.hidden===!1?`sandbox:pass`:l||u?`sandbox:fail`:`sandbox:absent`;i>=0&&(n[i]=a)},800),n.push(`sandbox:pending`),n.push(`localStorage:${localStorage.length>0?`pass`:`fail`}`)}if(t.type===`flashcards`){e.querySelector(`[data-flip-card]`)?.click();let t=e.querySelector(`.flashcard.is-flipped`);e.querySelector(`[data-card-next]`)?.click(),e.querySelector(`[data-card-known]`)?.click(),e.querySelector(`[data-card-shuffle]`)?.click(),n.push(`flip:${t?`pass`:`fail`}`),n.push(`known:${localStorage.getItem(`cs336.textbook.flashcards`)?`pass`:`fail`}`),n.push(`shuffle:${e.querySelector(`[data-card-stage]`)?.textContent?`pass`:`fail`}`)}let r=document.createElement(`div`);r.id=`smoke-result`,window.setTimeout(()=>{r.textContent=n.join(` `),r.hidden=!0,e.appendChild(r)},1e3)},100)}function Q(e){return String(e??``).replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`)}function $(e){return Q(e).replaceAll(`'`,`&#39;`)}