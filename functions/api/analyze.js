const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_TEXT_LENGTH = 40000;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function safeEqual(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function extractText(result){if(result&&typeof result.response==="string")return result.response;if(result&&typeof result.result==="string")return result.result;const c=result&&result.choices&&result.choices[0]&&result.choices[0].message&&result.choices[0].message.content;if(typeof c==="string")return c;if(Array.isArray(c))return c.map(x=>x.text||"").join("\n");return JSON.stringify(result);}
function parseJson(text){const cleaned=text.trim().replace(/^\uFEFF/,"").replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"");try{return JSON.parse(cleaned);}catch(e){}const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");if(start>=0&&end>start){try{return JSON.parse(cleaned.slice(start,end+1));}catch(e){}}return null;}
export async function onRequestPost(ctx){
 const request=ctx.request,env=ctx.env;
 if(!env.OCR_ACCESS_CODE)return json({error:"未配置 OCR_ACCESS_CODE。"},503);
 if(!safeEqual(request.headers.get("x-ocr-access-code")||"",env.OCR_ACCESS_CODE))return json({error:"访问口令不正确。"},401);
 if(!env.AI)return json({error:"未绑定 Workers AI（变量名 AI）。"},503);
 let body;try{body=await request.json();}catch(e){return json({error:"请求必须是 JSON。"},400);}
 const sourceText=String(body.sourceText||"").trim();
 if(!sourceText)return json({error:"没有可分析的识别文字。"},400);
 if(sourceText.length>MAX_TEXT_LENGTH)return json({error:"识别文字过长，请分批分析（每批最多40000字符）。"},413);
 const subject=String(body.subject||"机械设计基础");
 const allowed=["机械设计基础","机械原理","数学二","其他"];
 if(!allowed.includes(subject))return json({error:"不支持的科目选项。"},400);
 let book="用户未指定可核实教材。不得编造书名、章节编号或页码；只给出知识点主题并标记教材待核实。";
 if(subject==="机械设计基础")book="用户指定教材：濮良贵等《机械设计》第十版，西北工业大学出版社。只给出可靠的章节主题；章号和页码无法确认时必须为null，严禁编造。";
 if(subject==="机械原理")book="用户尚未确定机械原理教材。不得假定教材，不得编造书名、章号或页码。";
 if(subject==="数学二")book="严格限于考研数学二大纲。不要提及Jordan块、Jordan标准形或dim ker，不要引入超纲概念。";
 const prompt=[
 "你是谨慎的考研试卷知识点分析助手。输入是从试卷图片提取的部分文字，可能缺字、错字、公式丢失或题号不连续。",
 "不要补写完整原题。只利用可见证据推断最可能考点；每项推断都要列证据、理由和置信度。",
 "科目："+subject,
 "教材约束："+book,
 "任务：抽取可确认原文片段；提取关键词、术语、公式、数字单位、题型和图示线索；推断候选知识点；列出替代解释；置信度0至1；低于0.75标记review；只有证据充分的ready知识点才生成原创Quiz草案；禁止复制或猜测原题；禁止编造教材页码。",
 "若无ready知识点，quizDraft必须为空数组，并说明还需要什么信息。答案不确定的题不得生成。",
 "只输出有效JSON，不要Markdown围栏，不要输出JSON以外的文字。",
 "JSON结构：",
 '{"subject":"科目","examContext":{"likelySection":"试卷模块或题型判断","questionStyle":"可观察到的命题形式","confidence":0.0,"evidence":["支持该判断的可见线索"]},"recognizedFragments":[{"text":"原文片段","kind":"keyword|term|formula|number|unit|question_clue|diagram_clue","certainty":"high|medium|low"}],"topicCandidates":[{"topic":"知识点","subtopic":"具体内容","confidence":0.0,"status":"ready|review","evidence":["原文证据"],"reason":"推断理由","alternatives":["其他可能解释"],"textbookMapping":{"book":"教材名或待核实","chapterTitle":"章节主题或待核实","chapterNumber":null,"page":null,"mappingConfidence":0.0}}],"uncertainItems":["无法确认的内容"],"quizDraft":[{"id":"Q1","topic":"知识点","difficulty":"基础|提高|综合","type":"single|judge","stem":"原创题干","options":["A","B","C","D"],"answer":0,"explanation":"原理解析","evidence":["支持该题的证据"],"textbookBasis":"教材知识依据","reviewRequired":true}],"coverageNotes":"覆盖范围和不足"}',
 "recognizedFragments和topicCandidates宁少勿滥；quizDraft按ready知识点生成3至8题，不得凑数。所有生成题目均须标记为待人工审核，不得直接写入正式题库。"
 ].join("\n");
 const started=Date.now();
 try{
  const result=await env.AI.run(MODEL,{messages:[{role:"system",content:"你是谨慎的考试知识点分析专家。宁可说证据不足，也不能猜测原题或教材页码。"},{role:"user",content:prompt+"\n\n以下是OCR提取的原始文字：\n\n"+sourceText}],temperature:0.1,max_tokens:6500,chat_template_kwargs:{enable_thinking:false}});
  const raw=extractText(result).trim(),analysis=parseJson(raw);
  if(!analysis || typeof analysis!=="object")return json({error:"模型返回内容不是有效JSON，请缩小文字范围后重试。",raw:raw,elapsedMs:Date.now()-started},502);
  analysis.subject=subject;
  analysis.recognizedFragments=Array.isArray(analysis.recognizedFragments)?analysis.recognizedFragments:[];
  analysis.topicCandidates=Array.isArray(analysis.topicCandidates)?analysis.topicCandidates:[];
  analysis.uncertainItems=Array.isArray(analysis.uncertainItems)?analysis.uncertainItems:[];
  analysis.quizDraft=Array.isArray(analysis.quizDraft)?analysis.quizDraft:[];
  analysis.topicCandidates=analysis.topicCandidates.map(item=>{
    const confidence=Math.max(0,Math.min(1,Number(item.confidence)||0));
    const evidence=Array.isArray(item.evidence)?item.evidence:[];
    const mapping=item.textbookMapping&&typeof item.textbookMapping==="object"?item.textbookMapping:{};
    mapping.chapterNumber=null;
    mapping.page=null;
    mapping.mappingConfidence=Math.min(0.7,Math.max(0,Number(mapping.mappingConfidence)||0));
    mapping.mappingStatus="候选章节主题，需结合教材目录核对";
    if(subject==="机械设计基础")mapping.book="濮良贵等《机械设计》第十版，西北工业大学出版社";
    else if(subject==="机械原理")mapping.book="参考教材尚未确认";
    else mapping.book=mapping.book||"待核实";
    return {...item,confidence:confidence,status:confidence>=0.75&&evidence.length>0?"ready":"review",evidence:evidence,textbookMapping:mapping};
  });
  const readyTopics=new Set(analysis.topicCandidates.filter(item=>item.status==="ready").map(item=>String(item.topic||"")));
  analysis.quizDraft=analysis.quizDraft.filter(item=>{
    const options=Array.isArray(item.options)?item.options:[];
    return readyTopics.has(String(item.topic||""))&&typeof item.stem==="string"&&item.stem.trim().length>0&&Number.isInteger(item.answer)&&item.answer>=0&&item.answer<options.length&&options.length>=2&&typeof item.explanation==="string"&&item.explanation.trim().length>0;
  }).map(item=>({...item,reviewRequired:true}));
  if(!analysis.quizDraft.length && !readyTopics.size && !analysis.coverageNotes)analysis.coverageNotes="目前没有足够证据支持可靠出题；请补充可辨认术语、公式、题干片段或更清晰的局部图片。";
  return json({subject:subject,model:MODEL,elapsedMs:Date.now()-started,analysis:analysis});
 }catch(error){return json({error:"知识点分析失败，请稍后重试。",detail:String(error&&error.message||error)},502);}
}