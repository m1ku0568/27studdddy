import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/analyze.js";

test("topic analysis requires OCR access secret", async () => {
  const response = await onRequestPost({
    request: new Request("https://example.test/api/analyze", {method:"POST"}),
    env: {}
  });
  assert.equal(response.status,503);
});

test("topic analysis rejects wrong access code", async () => {
  const response = await onRequestPost({
    request: new Request("https://example.test/api/analyze", {
      method:"POST",
      headers:{"x-ocr-access-code":"wrong","content-type":"application/json"},
      body:JSON.stringify({sourceText:"螺栓连接"})
    }),
    env:{OCR_ACCESS_CODE:"correct"}
  });
  assert.equal(response.status,401);
});

test("topic analysis validates empty input", async () => {
  const response = await onRequestPost({
    request: new Request("https://example.test/api/analyze", {
      method:"POST",
      headers:{"x-ocr-access-code":"correct","content-type":"application/json"},
      body:JSON.stringify({sourceText:""})
    }),
    env:{OCR_ACCESS_CODE:"correct",AI:{}}
  });
  assert.equal(response.status,400);
});
