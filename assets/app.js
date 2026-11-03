const $ = (selector) => document.querySelector(selector);
let catalog = [];
let bank = null;
let answers = {};
let filter = "all";

const storageKey = () => `kaoyan-quiz:${bank.date}:${bank.subject}`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const letters = ["A","B","C","D","E","F"];

async function init() {
  try {
    const response = await fetch("./data/index.json");
    if (!response.ok) throw new Error("题库目录加载失败，请稍后刷新。");
    catalog = await response.json();
    const select = $("#bank");
    select.innerHTML = catalog.map(item => `<option value="${escapeHtml(item.path)}">${escapeHtml(item.date)} · ${escapeHtml(item.subject)}（${item.count}题）</option>`).join("");
    select.addEventListener("change", loadBank);
    $("#export").addEventListener("click", exportAnswers);
    $("#reset").addEventListener("click", resetProgress);
    $("#questions").addEventListener("click", handleQuestionClick);
    $("#questions").addEventListener("change", handleQuestionChange);
    document.querySelectorAll(".filters button").forEach(button => button.addEventListener("click", () => {
      filter = button.dataset.filter;
      document.querySelectorAll(".filters button").forEach(item => item.classList.toggle("active", item === button));
      render();
    }));
    await loadBank();
  } catch (error) {
    $("#error").textContent = error.message;
  }
}

async function loadBank() {
  const item = catalog.find(entry => entry.path === $("#bank").value);
  if (!item) return;
  try {
    const response = await fetch(`./data/${item.path}`);
    if (!response.ok) throw new Error("无法读取所选题库。");
    bank = await response.json();
    answers = JSON.parse(localStorage.getItem(storageKey()) || "{}");
    filter = "all";
    document.querySelectorAll(".filters button").forEach(button => button.classList.toggle("active", button.dataset.filter === "all"));
    $("#error").textContent = "";
    $("#meta").textContent = `${bank.date} · ${bank.subject} · ${bank.questions.length}题`;
    render();
  } catch (error) {
    $("#error").textContent = error.message;
  }
}

function save() {
  localStorage.setItem(storageKey(), JSON.stringify(answers));
  render();
}

function updateStats() {
  const questions = bank.questions;
  const done = questions.filter(question => answers[question.id]?.choice !== undefined);
  const correct = done.filter(question => answers[question.id].choice === question.answer).length;
  $("#done").textContent = `${done.length}/${questions.length}`;
  $("#acc").textContent = done.length ? `${Math.round(correct / done.length * 100)}%` : "—";
  $("#unc").textContent = questions.filter(question => ["模糊","不会"].includes(answers[question.id]?.level)).length;
  $("#fav").textContent = questions.filter(question => answers[question.id]?.fav).length;
  $("#progress").style.width = questions.length ? `${done.length / questions.length * 100}%` : "0%";
}

function render() {
  if (!bank) return;
  const visible = bank.questions.filter(question => {
    const state = answers[question.id] || {};
    if (filter === "wrong") return state.choice !== undefined && state.choice !== question.answer;
    if (filter === "uncertain") return ["模糊","不会"].includes(state.level);
    if (filter === "fav") return !!state.fav;
    return true;
  });
  $("#questions").innerHTML = visible.map(question => renderQuestion(question)).join("") || '<p class="empty">这个分类暂时没有题目。</p>';
  updateStats();
  if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([$("#questions")]).catch(() => {});
}

function renderQuestion(question) {
  const state = answers[question.id] || {};
  const submitted = state.choice !== undefined;
  const options = question.options.map((option, index) => {
    const correct = submitted && index === question.answer;
    const incorrect = submitted && index === state.choice && state.choice !== question.answer;
    return `<label class="option ${correct ? "correct" : incorrect ? "incorrect" : ""}">
      <input type="radio" name="${escapeHtml(question.id)}" value="${index}" ${state.choice === index ? "checked" : ""} ${submitted ? "disabled" : ""}>
      <span><b>${letters[index] || index + 1}.</b> ${escapeHtml(option)}</span>
    </label>`;
  }).join("");
  const typeLabel = question.type === "judge" ? "判断题" : "单选题";
  return `<article class="question" data-question="${escapeHtml(question.id)}">
    <div class="question-meta"><span>${escapeHtml(question.chapter || "综合")} · ${escapeHtml(question.difficulty || "基础")}</span><span>${typeLabel}</span></div>
    <h2>${escapeHtml(question.stem)}</h2>
    <div class="options">${options}</div>
    <div class="actions">
      ${submitted ? '<button data-action="explain">查看解析</button>' : '<button class="primary" data-action="submit">提交答案</button>'}
      <label class="level-label">掌握程度
        <select data-action="level"><option value="">未标记</option>${["会做","模糊","不会"].map(level => `<option value="${level}" ${state.level === level ? "selected" : ""}>${level}</option>`).join("")}</select>
      </label>
      <button data-action="favorite">${state.fav ? "★ 已收藏" : "☆ 收藏"}</button>
    </div>
    <div class="explanation ${state.show ? "visible" : ""}">
      <b>${submitted ? (state.choice === question.answer ? "回答正确" : "回答错误") : "参考解析"}</b>
      <p>${escapeHtml(question.explanation || "暂无解析。")}</p>
      ${question.formula ? `<p class="formula"><b>公式 / 记忆提示：</b> ${escapeHtml(question.formula)}</p>` : ""}
    </div>
  </article>`;
}

function handleQuestionClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-question]");
  const id = card.dataset.question;
  const question = bank.questions.find(item => item.id === id);
  const state = answers[id] || {};
  if (button.dataset.action === "submit") {
    const selected = card.querySelector('input[type="radio"]:checked');
    if (!selected) return alert("请先选择答案。");
    state.choice = Number(selected.value);
    state.show = true;
  } else if (button.dataset.action === "explain") {
    state.show = !state.show;
  } else if (button.dataset.action === "favorite") {
    state.fav = !state.fav;
  }
  answers[id] = state;
  save();
}

function handleQuestionChange(event) {
  if (event.target.dataset.action !== "level") return;
  const card = event.target.closest("[data-question]");
  const id = card.dataset.question;
  answers[id] = {...(answers[id] || {}), level: event.target.value};
  save();
}

function exportAnswers() {
  const payload = {
    date: bank.date,
    subject: bank.subject,
    exportedAt: new Date().toISOString(),
    answers,
    summary: {
      total: bank.questions.length,
      answered: bank.questions.filter(question => answers[question.id]?.choice !== undefined).length,
      wrong: bank.questions.filter(question => answers[question.id]?.choice !== undefined && answers[question.id].choice !== question.answer).map(question => question.id),
      uncertain: bank.questions.filter(question => ["模糊","不会"].includes(answers[question.id]?.level)).map(question => question.id),
      favorites: bank.questions.filter(question => answers[question.id]?.fav).map(question => question.id)
    }
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${bank.date}-${bank.subject}-答题归档.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetProgress() {
  if (!confirm("确定清空本套题的本地答题进度吗？")) return;
  localStorage.removeItem(storageKey());
  answers = {};
  render();
}

init();
