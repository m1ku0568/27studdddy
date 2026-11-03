import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const bank=JSON.parse(await readFile("data/2026-11-03/mechanical-design.json","utf8"));
test("question bank is not empty",()=>assert.ok(bank.questions.length>0));
test("question IDs are unique",()=>assert.equal(new Set(bank.questions.map(q=>q.id)).size,bank.questions.length));
test("answer indexes are valid",()=>bank.questions.forEach(q=>assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length)));
test("stems and explanations exist",()=>bank.questions.forEach(q=>{assert.ok(q.stem);assert.ok(q.explanation)}));
