# AI Resume Matcher

A Chrome extension that analyses your resume against any job description using Google's Gemini AI — giving you a match score, identifying gaps, and optionally rewriting your resume to better target the role.

---

## Features

- **Resume Analysis** — Upload your resume (PDF) and paste or auto-capture a job description from LinkedIn. Get an instant match score (0–100) with:
  - Score label (Strong / Good / Partial / Weak Match)
  - Summary of fit
  - Strong matches (skills present in both resume and JD)
  - Missing keywords
  - Top actionable improvements

- **AI Resume Rewrite** — One click rewrites your resume to surface inferable skills, mirror the JD's language, and strengthen your summary — without fabricating experience you don't have.

- **Before / After Score** — After rewriting, the extension automatically re-analyses the new resume and shows you the score improvement side by side.

- **Multiple Download Formats**
  - **PDF Preview** — Opens a print-ready page in a new tab; save as PDF via Chrome's print dialog
  - **Word (.doc)** — Download a formatted Word-compatible document
  - **Plain Text (.txt)** — Simple text version

- **Works for any profession** — Not limited to tech roles. Works for marketing, finance, healthcare, design, law, or any field.

---

## How It Works

1. You provide your own **Google Gemini API key** (free tier is sufficient for personal use)
2. The extension reads your PDF resume entirely **in your browser** — nothing is uploaded to any server
3. It calls the **Gemini API** directly from your browser with your key
4. All data stays local except for the Gemini API call

---

## Getting Started

### 1. Get a Gemini API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **"Create API key"**
3. Copy the key

### 2. Install the Extension (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"**
5. Select the `ai-resume-matcher` folder

### 3. Use It

1. Click the extension icon in your Chrome toolbar
2. Paste your Gemini API key and click **Save**
3. Upload your resume PDF
4. Navigate to a LinkedIn job posting — the JD auto-fills. Or paste any JD manually
5. Click **Analyse**
6. Optionally click **Rewrite My Resume** and choose your download format

---

## Project Structure

```
ai-resume-matcher/
├── manifest.json               # Chrome extension manifest (MV3)
├── icons/                      # Extension icons
├── popup/
│   ├── popup.html              # Extension popup UI
│   ├── popup.js                # Popup logic & orchestration
│   ├── popup.css               # Popup styles
│   ├── resume-preview.html     # Print-ready resume preview page
│   ├── resume-preview.js       # Preview rendering & PDF zoom logic
│   └── resume-preview.css      # Preview styles (screen + print CSS)
├── services/
│   ├── llm.js                  # Gemini API calls with retry/rate-limit handling
│   └── pipeline.js             # Analysis & rewrite orchestration
├── utils/
│   ├── parser.js               # Robust JSON parsing helpers
│   └── preprocess.js           # Resume text cleaning
└── libs/
    ├── pdf.min.mjs             # PDF.js (client-side PDF parsing)
    └── pdf.worker.min.mjs      # PDF.js worker
```

---

## Privacy

- Your resume is processed **entirely in your browser** — it is never uploaded to any external server
- Your Gemini API key is stored **locally** in `chrome.storage.local` and is only sent to `generativelanguage.googleapis.com` (Google's official API endpoint)
- No analytics, no tracking, no data collection

---

## Tech Stack

- **Chrome Extension** — Manifest V3
- **Google Gemini API** — `gemini-2.5-flash` model
- **PDF.js** — Client-side PDF text extraction
- Vanilla HTML / CSS / JavaScript — no build step required

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
