const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extractText(result) {
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.result === "string") return result.result;
  const choice = result?.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice;
  if (Array.isArray(choice)) return choice.map(part => part.text || "").join("\n");
  return JSON.stringify(result);
}

export async function onRequestPost({ request, env }) {
  if (!env.OCR_ACCESS_CODE) {
    return json({ error: "图片识别服务尚未配置访问口令，请先完成 Cloudflare Pages 配置。" }, 503);
  }
  const accessCode = request.headers.get("x-ocr-access-code") || "";
  if (!safeEqual(accessCode, env.OCR_ACCESS_CODE)) {
    return json({ error: "访问口令不正确。" }, 401);
  }
  if (!env.AI) {
    return json({ error: "Workers AI 尚未绑定到 Pages 项目。" }, 503);
  }
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return json({ error: "请使用 multipart/form-data 上传图片。" }, 415);
  }

  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "无法读取上传内容。" }, 400); }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "没有收到图片文件。" }, 400);
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: "仅支持 JPG、PNG、WebP 图片。" }, 415);
  if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "单张图片必须大于0且不超过8MB。" }, 413);

  const started = Date.now();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${toBase64(bytes)}`;
    const prompt = [
      "你是严谨的中文考研试卷文字转录助手。请逐字转录这张图片中所有清晰可见的内容。",
      "要求：",
      "1. 保留原始题号、题干、选项顺序、标点、数字、单位和页码；不要自行改写或纠错。",
      "2. 数学公式尽量使用 LaTeX；上下标、希腊字母、矩阵、积分符号必须准确表达。",
      "3. 机械结构图、受力图、表格不要臆造细节；用【图示描述】记录可见零件、标号、箭头、尺寸和相互位置。",
      "4. 无法辨认的局部写作【不清晰】，不要根据上下文猜测或补全。",
      "5. 不要解题，不要给答案，不要生成知识点分析。",
      "6. 按图片从上到下、从左到右的阅读顺序输出 Markdown。",
      "只输出转录结果，不要输出开场白或总结。"
    ].join("\n");

    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: "你负责高准确度试卷转录。忠实于图像，不推测缺失内容。" },
        { role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } }
        ]}
      ],
      temperature: 0.1,
      max_tokens: 3500,
      chat_template_kwargs: { enable_thinking: false }
    });

    const transcription = extractText(result).trim();
    if (!transcription) return json({ error: "模型没有返回可用的转录文本。" }, 502);
    return json({
      filename: file.name,
      mimeType: file.type,
      bytes: file.size,
      model: MODEL,
      elapsedMs: Date.now() - started,
      transcription
    });
  } catch (error) {
    return json({ error: "图片识别失败，请稍后重试。", detail: String(error?.message || error) }, 502);
  }
}
