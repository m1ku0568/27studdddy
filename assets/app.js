const $ = (selector) => document.querySelector(selector);
let catalog = [], bank = null, answers = {}, filter = "all";
let ocrResults = [], analysisData = null, isRecognizing = false, isAnalyzing = false;

const storageKey = () => `kaoyan-quiz:${bank.date}:${bank.subject}`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const letters = ["A","B","C","D","E","F"];
const OCR_CACHE_PREFIX = "kaoyan-ocr-cache:";

async function init() {
  bindOcrUi();
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

function bindOcrUi() {
  $("#recognize-btn").addEventListener("click", recognizeImages);
  $("#clear-ocr").addEventListener("click", () => {
    if (isRecognizing || isAnalyzing) return;
    ocrResults = [];
    analysisData = null;
    $("#ocr-results").innerHTML = "";
    $("#analysis-results").innerHTML = "";
    $("#manual-clues").value = "";
    $("#ocr-status").textContent = "识别结果已清空。本机缓存仍保留。";
    $("#analysis-status").textContent = "等待识别文字或人工补充线索。";
    $("#ocr-progress").style.width = "0%";
    $("#export-ocr").disabled = true;
    $("#analyze-btn").disabled = true;
    $("#export-analysis").disabled = true;
  });
  $("#export-ocr").addEventListener("click", exportOcr);
  $("#analyze-btn").addEventListener("click", analyzeRecognizedText);
  $("#export-analysis").addEventListener("click", exportAnalysis);
  $("#manual-clues").addEventListener("input", () => {
    const hasText = $("#manual-clues").value.trim().length > 0;
    const hasOcr = ocrResults.some(result => result && result.ok);
    $("#analyze-btn").disabled = !(hasText || hasOcr) || isAnalyzing;
  });
}

async function sha256(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,"0")).join("");
}
function getCached(hash) {
  try { return JSON.parse(localStorage.getItem(OCR_CACHE_PREFIX + hash) || "null"); }
  catch { return null; }
}
function setCached(hash, value) {
  try {
    localStorage.setItem(OCR_CACHE_PREFIX + hash, JSON.stringify(value));
    const keys = Object.keys(localStorage).filter(key => key.startsWith(OCR_CACHE_PREFIX));
    if (keys.length > 100) localStorage.removeItem(keys[0]);
  } catch { /* Cache is an optimization; quota errors must not block recognition. */ }
}
function setOcrProgress(done, total, message) {
  $("#ocr-progress").style.width = total ? `${Math.round(done / total * 100)}%` : "0%";
  $("#ocr-status").textContent = message;
}

async function recognizeOne(file, code) {
  const hash = await sha256(file);
  const cached = getCached(hash);
  if (cached?.transcription) {
    return {...cached, filename:file.name, cached:true, hash};
  }
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch("./api/ocr", {
    method: "POST",
    headers: {"x-ocr-access-code":code},
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `识别失败（HTTP ${response.status}）`);
  const result = {...payload, hash, cached:false};
  setCached(hash, result);
  return result;
}

async function recognizeImages() {
  if (isRecognizing) return;
  const files = [...($("#image-files").files || [])];
  const code = $("#ocr-code").value.trim();
  if (!code) return alert("请先输入识别访问口令。");
  if (!files.length) return alert("请先选择试卷图片。");
  if (files.length > 20) return alert("单批最多上传20张图片，请分批处理。");
  const invalid = files.find(file => !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 8*1024*1024);
  if (invalid) return alert(`${invalid.name} 格式不支持或超过8MB。`);

  isRecognizing = true;
  $("#recognize-btn").disabled = true;
  $("#export-ocr").disabled = true;
  $("#analyze-btn").disabled = true;
  $("#export-analysis").disabled = true;
  $("#analysis-results").innerHTML = "";
  analysisData = null;
  ocrResults = [];
  $("#ocr-results").innerHTML = "";
  setOcrProgress(0, files.length, `准备识别 ${files.length} 张图片…`);
  const results = new Array(files.length);
  let cursor = 0, completed = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      try {
        results[index] = {ok:true, ...(await recognizeOne(file, code))};
      } catch (error) {
        results[index] = {ok:false, filename:file.name, error:error.message};
      }
      completed++;
      setOcrProgress(completed, files.length, `已处理 ${completed}/${files.length} 张：${file.name}`);
      $("#ocr-results").innerHTML = results.map((result,index) => result ? renderOcrResult(result,index) : "").join("");
    }
  };
  await Promise.all(Array.from({length:Math.min(3,files.length)},worker));
  ocrResults = results;
  const success = results.filter(result => result?.ok).length;
  const cached = results.filter(result => result?.ok && result.cached).length;
  const failed = files.length - success;
  setOcrProgress(files.length, files.length, `完成：成功 ${success} 张，缓存命中 ${cached} 张，失败 ${failed} 张。可编辑识别文本后导出。`);
  $("#export-ocr").disabled = success === 0;
  $("#analyze-btn").disabled = success === 0;
  $("#export-analysis").disabled = true;
  $("#recognize-btn").disabled = false;
  isRecognizing = false;
}

function renderOcrResult(result, index) {
  const safeName = escapeHtml(result.filename);
  if (!result.ok) return `<article class="ocr-result failed"><div class="ocr-result-head"><b>${safeName}</b><span>识别失败</span></div><p>${escapeHtml(result.error)}</p></article>`;
  const text = escapeHtml(result.transcription);
  return `<article class="ocr-result"><div class="ocr-result-head"><b>${safeName}</b><span>${result.cached?"本机缓存":`识别完成 · ${result.elapsedMs ?? "—"} ms`}</span></div><textarea data-ocr-index="${index}" rows="9" spellcheck="false">${text}</textarea></article>`;
}

function exportOcr() {
  const payload = ocrResults.filter(result => result?.ok).map((result,index) => ({
    filename:result.filename,
    transcription:document.querySelector(`textarea[data-ocr-index="${ocrResults.indexOf(result)}"]`)?.value ?? result.transcription,
    model:result.model || "local-cache",
    cached:!!result.cached
  }));
  if (!payload.length) return;
  const markdown = payload.map((item,index) => `# 图片 ${index+1}：${item.filename}\n\n${item.transcription}`).join("\n\n---\n\n");
  const blob = new Blob([markdown],{type:"text/markdown;charset=utf-8"});
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "试卷图片OCR识别结果.md"; link.click(); URL.revokeObjectURL(url);
}

function collectOcrText() {
  const pieces = [];
  ocrResults.forEach((result,index) => {
    if (!result || !result.ok) return;
    const field = document.querySelector('textarea[data-ocr-index="' + index + '"]');
    const text = field ? field.value.trim() : String(result.transcription || "").trim();
    if (text) pieces.push("【图片：" + result.filename + "】\\n" + text);
  });
  const manual = $("#manual-clues").value.trim();
  if (manual) pieces.push("【人工补充线索】\\n" + manual);
  return pieces.join("\\n\\n==========\\n\\n");
}

async function analyzeRecognizedText() {
  if (isAnalyzing) return;
  const sourceText = collectOcrText();
  const code = $("#ocr-code").value.trim();
  if (!code) return alert("请先输入 OCR 访问口令。");
  if (!sourceText) return alert("没有可分析的文字。请先识别图片，或补充可辨认的题干、术语和公式。");
  isAnalyzing = true;
  $("#analyze-btn").disabled = true;
  $("#export-analysis").disabled = true;
  $("#analysis-status").textContent = "正在匹配试卷线索与教材知识点，并为证据充分的考点生成 Quiz 草案…";
  $("#analysis-results").innerHTML = "";
  try {
    const response = await fetch("./api/analyze", {
      method:"POST",
      headers:{"content-type":"application/json","x-ocr-access-code":code},
      body:JSON.stringify({subject:$("#analysis-subject").value,sourceText:sourceText})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "知识点分析失败（HTTP " + response.status + "）");
    analysisData = payload.analysis;
    renderAnalysis(analysisData);
    $("#export-analysis").disabled = false;
    const topics = analysisData.topicCandidates || [];
    const ready = topics.filter(item => item.status === "ready").length;
    const review = topics.length - ready;
    const drafts = (analysisData.quizDraft || []).length;
    $("#analysis-status").textContent = "分析完成：可用于出题的知识点 " + ready + " 个，待复核 " + review + " 个，Quiz 草案 " + drafts + " 道。请先核对推断，再用于正式题库。";
  } catch (error) {
    $("#analysis-status").textContent = "分析失败：" + error.message;
  } finally {
    isAnalyzing = false;
    $("#analyze-btn").disabled = false;
  }
}

function renderAnalysis(data) {
  const exam = data.examContext || {};
  const fragments = data.recognizedFragments || [];
  const topics = data.topicCandidates || [];
  const drafts = data.quizDraft || [];
  const fragmentHtml = fragments.map(item =>
    '<li><span class="confidence ' + escapeHtml(item.certainty || "low") + '">' +
    escapeHtml(item.certainty || "待确认") + '</span> ' + escapeHtml(item.text) +
    ' <small>' + escapeHtml(item.kind || "") + '</small></li>'
  ).join("");
  const topicHtml = topics.map(item => {
    const mapping = item.textbookMapping || {};
    const percent = Math.round(Number(item.confidence || 0) * 100);
    const status = item.status === "ready" ? "证据充分" : "需要复核";
    return '<article class="topic-card"><div class="ocr-result-head"><b>' + escapeHtml(item.topic) +
      '</b><span>' + status + ' · ' + percent + '%</span></div><p>' + escapeHtml(item.subtopic || "") +
      '</p><p><b>推断理由：</b>' + escapeHtml(item.reason || "") +
      '</p><p><b>原文证据：</b>' + escapeHtml((item.evidence || []).join("；")) +
      '</p><p><b>教材映射：</b>' + escapeHtml(mapping.book || "待核实") + " · " +
      escapeHtml(mapping.chapterTitle || "章节待核实") + " · 页码：" +
      escapeHtml(mapping.page === null || mapping.page === undefined ? "待核实" : mapping.page) +
      '</p>' + ((item.alternatives || []).length ? '<p><b>其他可能：</b>' + escapeHtml(item.alternatives.join("；")) + '</p>' : "") +
      '</article>';
  }).join("");
  const quizHtml = drafts.map((item,index) =>
    '<article class="topic-card"><div class="ocr-result-head"><b>草案 ' + (index+1) + " · " +
    escapeHtml(item.topic) + '</b><span>' + escapeHtml(item.difficulty || "") + '</span></div><p>' +
    escapeHtml(item.stem) + '</p>' + (item.options || []).map((option,i) =>
      '<p>' + (letters[i] || (i+1)) + ". " + escapeHtml(option) + '</p>').join("") +
    '<p><b>参考答案：</b>' + escapeHtml(letters[item.answer] || String(item.answer)) +
    '</p><p><b>解析：</b>' + escapeHtml(item.explanation || "") +
    '</p><p class="muted">依据：' + escapeHtml((item.evidence || []).join("；")) + '</p></article>'
  ).join("");
  const uncertain = (data.uncertainItems || []).map(item => "<li>" + escapeHtml(item) + "</li>").join("");
  $("#analysis-results").innerHTML =
    '<section class="analysis-section"><h3>试卷题型与命题形式拟合</h3><p><b>可能模块：</b>' + escapeHtml(exam.likelySection || "暂无法判断") + '</p><p><b>题型特征：</b>' + escapeHtml(exam.questionStyle || "待确认") + '</p><p><b>置信度：</b>' + Math.round(Number(exam.confidence || 0) * 100) + '%</p><p><b>依据：</b>' + escapeHtml((exam.evidence || []).join("；")) + '</p></section>' +
    '<section class="analysis-section"><h3>提取到的文字线索（' + fragments.length + '）</h3><ul>' +
    (fragmentHtml || "<li>没有提取到足够明确的文字线索</li>") + '</ul></section>' +
    '<section class="analysis-section"><h3>候选知识点（' + topics.length + '）</h3>' +
    (topicHtml || "<p>证据不足，暂不推断知识点。请补充文字或重新拍摄局部。</p>") + '</section>' +
    '<section class="analysis-section"><h3>Quiz 草案（' + drafts.length + '）</h3>' +
    (quizHtml || "<p>没有证据充分的知识点，因此暂不生成题目。</p>") + '</section>' +
    '<section class="analysis-section"><h3>待确认内容</h3><ul>' + (uncertain || "<li>无</li>") +
    '</ul><p><b>覆盖说明：</b>' + escapeHtml(data.coverageNotes || "") + '</p></section>';
}

function exportAnalysis() {
  if (!analysisData) return;
  downloadText(JSON.stringify(analysisData,null,2),"试卷知识点拟合与Quiz草案.json","application/json;charset=utf-8");
}

function downloadText(text,filename,type) {
  const url = URL.createObjectURL(new Blob([text],{type:type}));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
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
  return `<article class="question" data-question="${escapeHtml(question.id)}">
    <div class="question-meta"><span>${escapeHtml(question.chapter || "综合")} · ${escapeHtml(question.difficulty || "基础")}</span><span>${question.type === "judge" ? "判断题" : "单选题"}</span></div>
    <h2>${escapeHtml(question.stem)}</h2><div class="options">${options}</div>
    <div class="actions">${submitted ? '<button data-action="explain">查看解析</button>' : '<button class="primary" data-action="submit">提交答案</button>'}
      <label class="level-label">掌握程度 <select data-action="level"><option value="">未标记</option>${["会做","模糊","不会"].map(level => `<option value="${level}" ${state.level === level ? "selected" : ""}>${level}</option>`).join("")}</select></label>
      <button data-action="favorite">${state.fav ? "★ 已收藏" : "☆ 收藏"}</button></div>
    <div class="explanation ${state.show ? "visible" : ""}"><b>${submitted ? (state.choice === question.answer ? "回答正确" : "回答错误") : "参考解析"}</b>
      <p>${escapeHtml(question.explanation || "暂无解析。")}</p>${question.formula ? `<p class="formula"><b>公式 / 记忆提示：</b> ${escapeHtml(question.formula)}</p>` : ""}</div>
  </article>`;
}

function handleQuestionClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-question]"), id = card.dataset.question;
  const state = answers[id] || {};
  if (button.dataset.action === "submit") {
    const selected = card.querySelector('input[type="radio"]:checked');
    if (!selected) return alert("请先选择答案。");
    state.choice = Number(selected.value); state.show = true;
  } else if (button.dataset.action === "explain") state.show = !state.show;
  else if (button.dataset.action === "favorite") state.fav = !state.fav;
  answers[id] = state; save();
}

function handleQuestionChange(event) {
  if (event.target.dataset.action !== "level") return;
  const id = event.target.closest("[data-question]").dataset.question;
  answers[id] = {...(answers[id] || {}), level:event.target.value}; save();
}

function exportAnswers() {
  const payload = {date:bank.date,subject:bank.subject,exportedAt:new Date().toISOString(),answers,
    summary:{total:bank.questions.length,answered:bank.questions.filter(q=>answers[q.id]?.choice!==undefined).length,
    wrong:bank.questions.filter(q=>answers[q.id]?.choice!==undefined&&answers[q.id].choice!==q.answer).map(q=>q.id),
    uncertain:bank.questions.filter(q=>["模糊","不会"].includes(answers[q.id]?.level)).map(q=>q.id),
    favorites:bank.questions.filter(q=>answers[q.id]?.fav).map(q=>q.id)}};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download=`${bank.date}-${bank.subject}-答题归档.json`;link.click();URL.revokeObjectURL(url);
}

function resetProgress() {
  if (!confirm("确定清空本套题的本地答题进度吗？")) return;
  localStorage.removeItem(storageKey()); answers = {}; render();
}

init();
