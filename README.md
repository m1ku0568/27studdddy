# Kaoyan Quiz Platform

Public starter for a date-organized postgraduate exam quiz platform.

## Features
- Responsive static quiz site
- JSON question banks organized by date and subject
- Automatic grading and explanations
- Wrong-answer, uncertainty and favorites filters
- Browser-local progress and JSON export
- GitHub Actions data validation and build

## Preview locally
Run `python -m http.server 8000` in the repository root and open http://localhost:8000.

## Add a question bank
Add JSON under `data/YYYY-MM-DD/`. Each question requires a unique `id`, `chapter`, `stem`, `options`, zero-based `answer`, and `explanation`.

## Cloudflare deployment
Configure repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and repository variable `CLOUDFLARE_PAGES_PROJECT`. The Pages project must already exist. The deploy workflow builds `dist/` and deploys it.

## Privacy
Do not commit personal answer records, learner identifiers, credentials, private exam scans or copyrighted source material without permission. Answer progress remains in the learner's browser.