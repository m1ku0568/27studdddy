import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/ocr.js";

test("OCR endpoint refuses requests until an access code is configured", async () => {
  const response = await onRequestPost({
    request: new Request("https://example.test/api/ocr", {method:"POST"}),
    env: {}
  });
  assert.equal(response.status, 503);
});

test("OCR endpoint rejects an incorrect access code", async () => {
  const response = await onRequestPost({
    request: new Request("https://example.test/api/ocr", {
      method:"POST",
      headers: {"x-ocr-access-code":"wrong"}
    }),
    env: {OCR_ACCESS_CODE:"correct"}
  });
  assert.equal(response.status, 401);
});

test("OCR endpoint requires the Workers AI binding", async () => {
  const response = await onRequestPost({
    request: new Request("https://example.test/api/ocr", {
      method:"POST",
      headers: {"x-ocr-access-code":"correct"}
    }),
    env: {OCR_ACCESS_CODE:"correct"}
  });
  assert.equal(response.status, 503);
});
