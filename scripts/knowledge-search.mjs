import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const read = async path => JSON.parse(await readFile("knowledge-base/" + path, "utf8"));
const registry = (await read("index.json")).textbooks;

function rankTopics(topics, parts) {
  const bigrams = token => [...new Set([...token].map((_,i,a)=>a.slice(i,i+2).join("")).filter(x=>x.length===2))];
  return topics.map(topic => {
    const title = String(topic.title||"").toLowerCase();
    const body = (topic.scope+" "+(topic.aliases||[]).join(" ")+" "+topic.module).toLowerCase();
    let score=0;
    for (const part of parts) {
      if (title.includes(part)) score+=20;
      if (body.includes(part)) score+=8;
      for (const gram of bigrams(part)) {
        if (title.includes(gram)) score+=2;
        else if (body.includes(gram)) score+=1;
      }
    }
    return {topic,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
}

const { values, positionals } = parseArgs({
  options: { book: { type: "string" } }, allowPositionals: true
});
const input = positionals.join(" ").trim();
if (!input || (values.book && !Object.hasOwn(registry, values.book))) {
  console.error('Usage: node scripts/knowledge-search.mjs [--book md10|mp3] "关键词或自测题号"');
  process.exit(1);
}
const parts = input.toLowerCase().split(/[\s，、,;；/]+/).filter(Boolean);
const matches = title => parts.some(part => title.toLowerCase().includes(part));
const question = input.match(/^(?:自测(?:题)?\s*)?(\d+)\s*[-－–—]\s*(\d+)$/);
const example = input.match(/^例(?:题)?\s*(\d+)\s*[.．]\s*(\d+)$/);
const examples = [];
const locations = [];
const verifiedItems = [];
const exercises = [];
const selected = values.book ? [values.book] : Object.keys(registry);
for (const book of selected) {
  const dir = registry[book];
  const [index, reviewed] = await Promise.all(["page-index.json", "reviewed-items.json"].map(
    name => read(dir + "/" + name)
  ));
  if (book === "mp3" && (question || example)) {
    const list = await read(dir + "/exercises.json");
    if (question) {
      const hit = list.exercises.find(row => row.number === question[1] + "-" + question[2]);
      if (hit) exercises.push({book, ...hit});
    } else {
      const number = example[1] + "." + example[2];
      const hit = list.examples.find(row => row.number === number);
      if (hit) examples.push({book, ...hit});
      verifiedItems.push(...reviewed.filter(item => item.title.startsWith("例" + number + " ")).map(
        item => ({book, ...item})
      ));
    }
    continue;
  }
  for (const chapter of index.chapters) {
    const candidates = [[chapter.title, ...chapter.printed], ...chapter.sections,
      ...index.priority.filter(([,start]) => start >= chapter.printed[0] && start <= chapter.printed[1])];
    for (const [title, start, end] of candidates) {
      if (matches(title)) locations.push({book, title, chapter:chapter.number, printedPages:[start,end],
        pdfPages:[start+index.offset,end+index.offset], status:"catalog_range"});
    }
  }
  for (const item of reviewed) {
    if (matches(item.title + " " + item.summary)) verifiedItems.push({book, ...item});
  }

}
const ranked = selected.includes("md10")
  ? rankTopics((await read("mechanical-design/topics.json")).topics, parts) : [];
const results = ranked.map(({topic,score}) => ({
  id:topic.id, title:topic.title, scope:topic.scope, module:topic.module, score,
  source:topic.source, textbookVerified:topic.textbook.verifiedAgainstTextbook
}));
const totalMatches = results.length + locations.length + verifiedItems.length + examples.length + exercises.length;
console.log(JSON.stringify({query:input,locations,verifiedItems,examples,exercises,totalMatches,results},null,2));
