import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function collect(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json") files.push(full);
  }
  return files;
}
const files = await collect("data");
test("at least one question bank exists", () => assert.ok(files.length > 0));
for (const file of files) {
  const bank = JSON.parse(await readFile(file, "utf8"));
  test(`${file}: metadata and questions are valid`, () => {
    assert.ok(bank.date && bank.subject && Array.isArray(bank.questions) && bank.questions.length > 0);
    const ids = bank.questions.map(q => q.id);
    assert.equal(new Set(ids).size, ids.length, "question IDs must be unique within a bank");
    for (const q of bank.questions) {
      assert.ok(q.id && q.stem && q.chapter && q.explanation);
      assert.ok(Array.isArray(q.options) && q.options.length >= 2);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
    }
  });
}
