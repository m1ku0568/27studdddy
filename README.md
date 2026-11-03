# Kaoyan Quiz Platform

Public starter for a date-organized postgraduate entrance-exam quiz platform.

## Features
- Responsive static quiz site
- Automatically generated question-bank selector from `data/**.json`
- Single-choice and judgment question data model
- Automatic grading, explanations, progress and accuracy statistics
- Wrong-answer, uncertainty and favorites filters
- Browser-local progress and JSON export
- MathJax 3 support for inline and display mathematics
- GitHub Actions validation, build and ZIP artifact

## Local preview
Run `python -m http.server 8000` in the repository root and open http://localhost:8000.

## Add a question bank
Add a JSON file under `data/YYYY-MM-DD/`. Each bank needs `date`, `subject`, and `questions`. Each question needs a unique `id`, `chapter`, `stem`, `options`, zero-based `answer`, and `explanation`. Optional fields include `formula`, `difficulty`, and `type` (`judge` for true/false).

The build script scans all question-bank JSON files and generates `dist/data/index.json`; the website reads this index to populate its selector automatically.

## Cloudflare deployment
The GitHub Actions deployment workflow targets the existing Cloudflare Pages project `1103zzzzz`. It requires repository secret `CLOUDFLARE_API_TOKEN`. The account ID is configured in the workflow. The Pages project must already exist.

## Privacy and copyright
This repository is public. Do not commit personal answer records, learner identifiers, credentials, private exam scans, or copyrighted source material without permission. Answer progress remains in the learner's browser and is not uploaded to this repository.
