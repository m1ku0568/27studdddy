import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async p => JSON.parse(await readFile(p,"utf8"));
const topics = (await read("knowledge-base/mechanical-design/topics.json")).topics;
const formulas = (await read("knowledge-base/mechanical-design/formulas.json")).formulas;
const confuse = (await read("knowledge-base/mechanical-design/confusions.json")).confusions;
const metadata = await read("knowledge-base/textbooks/mechanical-design-10/metadata.json");
test("45 archived topics with unique IDs",()=>{
  assert.equal(topics.length,45);
  assert.equal(new Set(topics.map(x=>x.id)).size,topics.length);
});
test("every topic preserves source exam trace and has no invented textbook page",()=>{
  for(const t of topics){
    assert.ok(t.id&&t.title&&t.scope&&t.module);
    assert.ok(t.source.paper&&t.source.section&&Number.isInteger(t.source.originalNumber));
    assert.equal(t.textbook.verifiedAgainstTextbook,false);
    assert.equal(t.textbook.printedPage,null);
    assert.equal(t.textbook.chapterNumber,null);
  }
});
test("formula notes retain archival provenance and caution",()=>{
  assert.ok(formulas.length>=10);
  for(const f of formulas){
    assert.ok(topics.some(t=>t.id===f.topicId));
    assert.ok(f.expressions.length>0);
    assert.equal(f.verifiedAgainstTextbook,false);
  }
});
test("confusions refer to a real topic",()=>{
  assert.ok(confuse.length>=8);
  for(const c of confuse) assert.ok(topics.some(t=>t.id===c.relatedTopicId));
});
test("textbook full text must not be declared available",()=>{
  assert.equal(metadata.fullTextStatus,"private_scan_with_unreviewed_ocr");
  assert.equal(metadata.ingestedPdfPages,0);
  assert.equal(metadata.exactPrintedPagesVerified,false);
});

test("scan catalog covers each body page exactly once at chapter level", async () => {
  const dir = "knowledge-base/textbooks/mechanical-design-10";
  const catalog = await read(dir + "/page-index.json");
  const reviewed = await read(dir + "/reviewed-items.json");
  let next = 3;
  assert.equal(catalog.chapters.length, 18);
  for (const {printed:[start,end], sections} of catalog.chapters) {
    assert.equal(start, next);
    for (const [,a,b] of sections) assert.ok(start <= a && a <= b && b <= end);
    next = end + 1;
  }
  assert.equal(next, 439);
  assert.equal(catalog.offset, 11);
  assert.equal(catalog.pdfPageCount, 454);
  for (const item of reviewed) {
    assert.equal(item.status, "verified_against_page_image");
    assert.equal(item.pdfPage, item.printedPage + catalog.offset);
    assert.ok(item.locator);
  }
});
