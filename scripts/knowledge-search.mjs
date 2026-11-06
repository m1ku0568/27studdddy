import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile("knowledge-base/mechanical-design/topics.json","utf8"));
const input = process.argv.slice(2).join(" ").trim();
if (!input) { console.error('Usage: node scripts/knowledge-search.mjs "螺栓 预紧力"'); process.exitCode=1; }
else {
  const parts = input.toLowerCase().split(/[\s，、,;；/]+/).filter(Boolean);
  const bigrams = token => [...new Set([...token].map((_,i,a)=>a.slice(i,i+2).join("")).filter(x=>x.length===2))];
  const ranked = data.topics.map(topic => {
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
  const book = "knowledge-base/textbooks/mechanical-design-10/";
  const [index, reviewed] = await Promise.all(["page-index.json", "reviewed-items.json"].map(
    async name => JSON.parse(await readFile(book + name, "utf8"))
  ));
  const matches = title => parts.some(part => title.toLowerCase().includes(part));
  const locations = [];
  for (const chapter of index.chapters) {
    const candidates = [[chapter.title, ...chapter.printed], ...chapter.sections,
      ...index.priority.filter(([,start]) => start >= chapter.printed[0] && start <= chapter.printed[1])];
    for (const [title, start, end] of candidates) {
      if (matches(title)) locations.push({title, chapter:chapter.number, printedPages:[start,end],
        pdfPages:[start+index.offset,end+index.offset], status:"catalog_range"});
    }
  }
  const verifiedItems = reviewed.filter(item => matches(item.title + " " + item.summary));
  console.log(JSON.stringify({query:input,locations,verifiedItems,totalMatches:ranked.length,results:ranked.map(({topic,score})=>({id:topic.id,title:topic.title,scope:topic.scope,module:topic.module,score,source:topic.source,textbookVerified:topic.textbook.verifiedAgainstTextbook}))},null,2));
}
