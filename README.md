# Kaoyan Quiz Platform

Public starter for a date-organized postgraduate entrance-exam quiz platform.

## Features
- Responsive static quiz site
- Automatically generated question-bank selector from `data/**.json`
- Automatic grading, explanations, progress and accuracy statistics
- Wrong-answer, uncertainty and favorites filters
- Browser-local progress and JSON export
- MathJax 3 support for inline and display mathematics
- Batch image transcription endpoint using Cloudflare Workers AI
- Three concurrent browser-side OCR tasks and SHA-256 local result cache
- GitHub Actions validation, build and ZIP artifact

## Local preview
Run `python -m http.server 8000` in the repository root and open http://localhost:8000.

## Add a question bank
Add a JSON file under `data/YYYY-MM-DD/`. Each bank needs `date`, `subject`, and `questions`. Each question needs a unique `id`, `chapter`, `stem`, `options`, zero-based `answer`, and `explanation`. Optional fields include `formula`, `difficulty`, and `type` (`judge` for true/false).

The build script scans all question-bank JSON files and generates `dist/data/index.json`; the website reads this index to populate its selector automatically.

## Enable image recognition on Cloudflare Pages
1. Open Pages project `1103zzzzz` → Settings → Functions → Bindings → Add → Workers AI.
2. Set the variable name to exactly `AI`, save, then redeploy.
3. Open Settings → Variables and Secrets for the Production environment.
4. Add the secret `OCR_ACCESS_CODE` with a strong private passphrase. Do not put this value in GitHub or commit it to this public repository.
5. Redeploy the Pages project so the Function receives the binding and secret.

The image endpoint is `POST /api/ocr`, accepts one JPG/PNG/WebP file (maximum 8 MB) as multipart field `file`, and requires the `x-ocr-access-code` header. The browser upload center runs up to three images concurrently, caches successful transcriptions by SHA-256 in that browser, and exports editable Markdown. Original images are processed in memory and are not stored by this project.

The recognition model is Cloudflare Workers AI `@cf/google/gemma-4-26b-a4b-it`. Workers AI usage is billable; review Cloudflare pricing and usage before enabling it. Image transcription is an OCR aid, not a substitute for checking ambiguous exam text and diagrams.

## Cloudflare deployment
The GitHub Actions deployment workflow targets the existing Cloudflare Pages project `1103zzzzz`. It requires repository secret `CLOUDFLARE_API_TOKEN`. The account ID is configured in the workflow. The Pages project must already exist.

## Privacy and copyright
This repository is public. Do not commit personal answer records, learner identifiers, credentials, private exam scans, or copyrighted source material without permission. Answer progress and OCR cache remain in each learner's browser; they are not uploaded to this repository.
