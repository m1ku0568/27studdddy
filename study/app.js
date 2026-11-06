"use strict";
const $ = (s) => document.querySelector(s);
let catalog=null, subject="md", chapter=3, query="", filter="all";
const STORAGE="mechanical-study:review-v1";
const escapeHtml=(x)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeNumber=(x)=>Number.isFinite(+x)?+x:0;
let records={};
try { const raw=JSON.parse(localStorage.getItem(STORAGE)||"{}");records=raw && typeof raw==="object" && !Array.isArray(raw)?raw:{}; }catch{records={};}
const book=()=>catalog.books.find(x=>x.id===subject);
function topicsOf(n){return subject==="md"?catalog.topics.filter(x=>x.chapter===n):[]}
function principlesOf(n){return subject==="mp"?catalog.principles.filter(x=>x.chapter===n):[]}
function exercisesOf(n){return subject==="mp"?catalog.exercises.filter(x=>x.chapter===n):[]}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(records))}catch{alert("本机存储失败，请用导出功能备份")}}
function selectedRecord(id){return records[id]??{}}
function isWeak(r){return r.level==="uncertain"||r.level==="unknown"}
function mapCounts(items){
  const groups=new Map();
  for(const t of items){
    const key=t.group||t.title; if(!groups.has(key))groups.set(key,{name:key,count:0,papers:new Set(),topics:[]});
    const s=groups.get(key);s.count++;s.papers.add(t.source.paper);s.topics.push(t);
  }
  return Array.from(groups.values()).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"zh-CN"));
}
function updateOverview(){
 const md=catalog.books.find(x=>x.id==="md").chapters.length;
 const mp=catalog.books.find(x=>x.id==="mp").chapters.length;
 const assessed=Object.entries(records).filter(([id])=>catalog.topics.some(t=>t.id===id)||catalog.principles.some(t=>t.id===id));
 const weak=assessed.filter(([,r])=>isWeak(r)).length;
 $("#overview").innerHTML=[
  [String(md+" + "+mp),"教材章节（设计+原理）"],
  [String(catalog.topics.length),"归档考点出现记录"],
  [String(catalog.principles.length),"机械原理已核实条目"],
  [String(assessed.length)+" / "+String(weak),"已标记 / 模糊或不会"]
 ].map(([n,label])=>'<div class="metric"><strong>'+escapeHtml(n)+'</strong><span>'+escapeHtml(label)+'</span></div>').join("");
}
function setSubject(s){subject=s;chapter=s==="md"?3:1;filter="all";$("#search").value="";query="";render();}
function renderNavigation(){
 $("#design-btn").classList.toggle("active",subject==="md");
 $("#principle-btn").classList.toggle("active",subject==="mp");
 const chapters=book().chapters.filter(c=>{
 const hay=[c.title,...c.sections.map(x=>x[0]),...topicsOf(c.number).map(t=>t.title),...principlesOf(c.number).map(t=>t.title)].join(" ");
 return hay.toLowerCase().includes(query.toLowerCase());
 });
 $("#chapters").innerHTML=chapters.map(c=>{
 const count=subject==="md"?topicsOf(c.number).length:principlesOf(c.number).length;
 return '<button class="chapter-link '+(chapter===c.number?'active':'')+'" type="button" data-chapter="'+c.number+'"><span>第'+c.number+'章 '+escapeHtml(c.title)+'</span><span class="count">'+count+'</span></button>';
 }).join("")||'<p class="hint">未找到匹配章节或考点。</p>';
}
function render(){
 renderNavigation(); updateOverview();
 const c=book().chapters.find(c=>c.number===chapter);
 if(!c){$("#content").innerHTML='<p>请选择一个章节</p>';return}
 const topics=topicsOf(chapter), principles=principlesOf(chapter), exercises=exercisesOf(chapter), groups=mapCounts(topics);
 const subtitle=subject==="md"?"原始教材第十版目录索引":"《机械原理学习指导》第三版目录及经原页核对的学习条目";
 const header='<p class="eyebrow">'+escapeHtml(book().title)+' / 第'+c.number+'章</p><h2 class="chapter-title">'+escapeHtml(c.title)+'</h2><p class="desc">'+escapeHtml(subtitle)+' · 印刷页 '+c.printed[0]+'—'+c.printed[1]+' / PDF页 '+(c.printed[0]+book().pdfOffset)+'—'+(c.printed[1]+book().pdfOffset)+'</p>'
  +'<div class="tag-row"><span class="pill strong">章节目录已登记</span><span class="pill">'+(subject==="md"?topics.length+" 条归档题目考点":principles.length+" 条已核实知识摘要")+'</span>'+(subject==="mp"?'<span class="pill">'+exercises.length+' 道教材自测题索引</span>':'')+'</div>';
 const sections='<section class="section"><h3>一、教材章节与小节</h3><div class="topic-list">'+c.sections.map(x=>'<div class="topic"><strong>'+escapeHtml(x[0])+'</strong><div class="meta">印刷页 '+x[1]+'—'+x[2]+' · PDF页 '+(x[1]+book().pdfOffset)+'—'+(x[2]+book().pdfOffset)+'</div></div>').join("")+'</div><p class="hint">目录页码用于定位，不表示小节内全部公式已逐页复核。</p></section>';
 const metrics=subject==="md"?'<section class="section"><h3>二、本章考点出现频次</h3><div class="notice">样本仅为试题4、5中的60条判断／选择考点映射；同一原卷的两题也计2次。统计的是“考点组出现次数”，不是历年真题频率。跨卷是指试题4与试题5均有该组。</div>'+
  (groups.length?'<table class="freq-table"><thead><tr><th>考点组</th><th>样本次数</th><th>跨卷</th></tr></thead><tbody>'+groups.map(g=>'<tr><td>'+escapeHtml(g.name)+'<div class="bartrack"><div class="barfill" style="width:'+Math.round(g.count/groups[0].count*100)+'%"></div></div></td><td>'+g.count+'</td><td>'+(g.papers.size>1?'两卷均出现':'仅一卷')+'</td></tr>').join("")+'</tbody></table>':'<p class="empty">当前已归档的两套判断／选择试卷未在本章找到考点，不能判定本章不考。</p>')+'</section>':'<section class="section"><h3>二、考点覆盖情况</h3><p class="notice">机械原理已建立可核实的教材条目与自测题号索引。尚无足够可追溯的历年专业课试卷样本，不显示“高频”排名或虚构频次。</p></section>';
 const sourceItems=subject==="md"?topics:principles.map(p=>({...p,group:p.kind,source:{paper:"机械原理学习指导 第3版",section:p.kind,number:p.id,page:p.printedPage},detail:p.summary}));
 const visible=sourceItems.filter(t=>{
 const r=selectedRecord(t.id);
 return filter==="all"||(filter==="weak"&&isWeak(r))||(filter==="unmarked"&&!r.level)||(filter==="mastered"&&r.level==="mastered");
 });
 const countLabel=subject==="md"?'三、试卷题号 → 教材考点':'三、已核实的教材知识条目';
 const cards='<section class="section"><h3>'+countLabel+'</h3>'+
 '<div class="toolbar"><div class="filters" role="group" aria-label="学习状态筛选"><button class="'+(filter==="all"?'on':'')+'" data-filter="all">全部</button><button class="'+(filter==="weak"?'on':'')+'" data-filter="weak">需复习</button><button class="'+(filter==="unmarked"?'on':'')+'" data-filter="unmarked">未标记</button><button class="'+(filter==="mastered"?'on':'')+'" data-filter="mastered">掌握</button></div><button class="linkbtn secondary" id="export-progress">导出学习记录</button><button class="linkbtn secondary" id="import-progress">导入学习记录</button><input type="file" accept=".json,application/json" id="progress-file" hidden></div><p class="hint">这里是考点索引，不是已审核的原题题库。标记不会被当成真实的Quiz作答，也不会改变原卷覆盖进度。</p>'+
 (visible.length?'<div class="topic-list">'+visible.map(t=>{
  const r=selectedRecord(t.id),p=t.source;
  const sourceLine=subject==="md"?p.paper+' · '+p.section+' 第'+p.number+'题 · 试卷印刷页'+p.page:'教材印刷页'+t.printedPage+' / PDF页'+t.pdfPage;
  const desc=t.detail?(subject==="mp"?t.summary:t.detail):"";
  const status=subject==="md"?"来源为已归档考点映射，原题全文尚未本次复核":"对照原页核实的概念摘要";
  return '<article class="topic"><div class="topic-top"><strong>'+escapeHtml(t.title)+'</strong><small>'+escapeHtml(t.id)+'</small></div><div class="meta">'+escapeHtml(sourceLine)+'</div>'+(desc?'<div class="hint">'+escapeHtml(desc)+'</div>':'')+'<div class="meta">'+escapeHtml(status)+'</div><div class="controls">'+["mastered","uncertain","unknown"].map((key,i)=>'<button type="button" class="mark '+(r.level===key?'on':'')+'" data-topic="'+escapeHtml(t.id)+'" data-mark="'+key+'">'+["已掌握","模糊","不会"][i]+'</button>').join("")+'</div></article>';
 }).join("")+'</div>':'<p class="empty">当前筛选条件下没有记录。</p>')+'</section>';
 const exHtml=subject==="mp"?'<section class="section"><h3>四、教材自测题号索引</h3><p class="hint">仅展示已定位的教材题号和页码。完整题干与机构图必须查看原PDF，不能仅凭编号自动生成原题。</p><div class="exercise-list">'+exercises.map(t=>'<span class="exercise-tag">自测 '+escapeHtml(t.number)+' · 印刷页 '+t.printed[0]+'—'+t.printed[1]+'</span>').join("")+'</div></section>':'';
 const call='<section class="section"><h3>'+(subject==="md"?'四、下一步训练':'五、下一步训练')+'</h3><p class="notice">在正式题库中，只允许通过原图核实并通过答案审核的题目进入练习。计算题与证明／机构分析题保留主观解答形式，不改成猜答案的选择题。</p><a href="../index.html" class="linkbtn" style="display:inline-block;margin-top:10px;text-decoration:none">返回现有试卷识别与Quiz</a></section>';
 $("#content").innerHTML=header+sections+metrics+cards+exHtml+call;
}
function download(name,payload){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener("click",event=>{
 const b=event.target.closest("button");if(!b)return;
 if(b.id==="design-btn")return setSubject("md");
 if(b.id==="principle-btn")return setSubject("mp");
 if(b.dataset.chapter){chapter=Number(b.dataset.chapter);filter="all";return render()}
 if(b.dataset.filter){filter=b.dataset.filter;return render()}
 if(b.dataset.topic && b.dataset.mark){
  const old=selectedRecord(b.dataset.topic);
  const level=old.level===b.dataset.mark?null:b.dataset.mark;
  if(level)records[b.dataset.topic]={level,updatedAt:new Date().toISOString()};else delete records[b.dataset.topic];
  save();return render();
 }
 if(b.id==="export-progress")download("mechanical-study-progress.json",{schemaVersion:1,exportedAt:new Date().toISOString(),records});
 if(b.id==="import-progress")$("#progress-file").click();
});
$("#search").addEventListener("input",e=>{query=e.target.value.trim();renderNavigation()});
document.addEventListener("change",async event=>{
 if(event.target.id!=="progress-file")return;
 const f=event.target.files?.[0]; if(!f)return;
 try{
  if(f.size>2*1024*1024)throw new Error("文件超过2MB");
  const d=JSON.parse(await f.text());
  if(d.schemaVersion!==1 || !d.records || typeof d.records!=="object" || Array.isArray(d.records))throw new Error("不是本学习空间的进度JSON");
  const valid=new Set([...catalog.topics,...catalog.principles].map(t=>t.id));
  const next={...records};let merged=0;
  for(const [id,r] of Object.entries(d.records)){
   if(!valid.has(id)||!r||!["mastered","uncertain","unknown"].includes(r.level))continue;
   if(!next[id] || String(r.updatedAt||"")>String(next[id].updatedAt||"")){next[id]={level:r.level,updatedAt:r.updatedAt||new Date().toISOString()};merged++;}
  }
  records=next;save();render();alert("成功导入 / 合并 "+merged+" 条学习标记");
 }catch(err){alert("导入失败："+err.message)}finally{event.target.value=""}
});
(async()=>{
 try{
  const response=await fetch("./data/catalog.json",{cache:"no-store"});
  if(!response.ok)throw new Error("目录数据读取失败（"+response.status+"）");
  catalog=await response.json();
  if(catalog.topics.length!==60 || catalog.books[0].chapters.length!==18 || catalog.books[1].chapters.length!==15)throw new Error("目录数据完整性校验失败");
  render();
 }catch(err){$("#content").innerHTML='<p role="alert" class="empty">加载失败：'+escapeHtml(err.message)+'</p>'}
})();