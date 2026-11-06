import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=async(path)=>JSON.parse(await readFile(path,"utf8"));
test("chapter study catalog is complete and evidence-aware",async()=>{
 const d=await read("study/data/catalog.json");
 assert.equal(d.books.find(x=>x.id==="md").chapters.length,18);
 assert.equal(d.books.find(x=>x.id==="mp").chapters.length,15);
 assert.equal(d.topics.length,60);
 assert.ok(d.principles.length>=20);
 assert.equal(d.exercises.length,68);
 assert.equal(new Set(d.topics.map(x=>x.id)).size,d.topics.length);
 for(const x of d.topics){assert.ok(Number.isInteger(x.chapter)&&x.chapter>=1&&x.chapter<=18,x.id);assert.ok(x.source.paper&&x.source.section&&x.source.number);assert.equal(x.status,"archived_source_topic_not_photo_reverified")}
 for(const b of d.books){for(const c of b.chapters){assert.ok(c.sections.length);assert.ok(c.printed[0]<=c.printed[1]);}}
 assert.equal(d.limits.noExamFrequencyClaim,true);
 assert.equal(d.limits.originalStemsAvailable,false);
});
test("chapter page and assets are linked",async()=>{
 const home=await readFile("index.html","utf8"),page=await readFile("study/index.html","utf8"),js=await readFile("study/app.js","utf8"),build=await readFile("scripts/build.mjs","utf8");
 assert.match(home,/study\/index\.html/);
 assert.match(page,/\.\/app\.js/);
 assert.match(js,/data\/catalog\.json/);
 assert.match(js,/localStorage/);
 assert.match(js,/频次/);
 assert.match(build,/"study"/);
});
