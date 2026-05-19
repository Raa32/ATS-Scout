# ATS Scout

AI-powered ATS resume analyser. **Any provider. BYOK. 100% local PDF parsing. Zero servers.**

Your API key lives only in this browser session. Your PDF is parsed locally and never uploaded. Network calls go directly from your browser to your chosen AI provider's API.

---

## Quick Start

```bash
npm install
npm run setup      # copies pdf.worker + generates PNG icons from SVGs
npm run build      # outputs dist/
```

Then in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` folder
4. Pin the ATS Scout extension from the toolbar

---

## Free Tiers (No credit card needed)

| Provider | Free tier | Key starts with | Get key |
|----------|-----------|-----------------|---------|
| **Google Gemini** | ✅ Yes | `AIza...` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq** | ✅ Yes (fast Llama 3.3) | `gsk_...` | [console.groq.com/keys](https://console.groq.com/keys) |
| Cohere | Trial tier | — | [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) |

## Paid / Best Quality

| Provider | Model | Key starts with | Get key |
|----------|-------|-----------------|---------|
| **Claude (Anthropic)** | claude-sonnet-4 | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o mini | `sk-...` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Mistral AI | mistral-small | — | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |

**Best quality:** Claude (Anthropic) or OpenAI GPT-4o mini  
**Best free tier:** Google Gemini (generous limits) or Groq (blazing fast)

---

## Custom Provider (OpenRouter, Together AI, local Ollama, etc.)

1. Select **Custom / Other** in the provider dropdown
2. Enter your endpoint URL, e.g. `https://openrouter.ai/api/v1/chat/completions`
3. Auth style: `Authorization: Bearer`
4. Model name: e.g. `anthropic/claude-3.5-sonnet`
5. Request format: `OpenAI-compatible`
6. Response path: `choices[0].message.content`
7. Paste your OpenRouter key and click Save

Works with any OpenAI-compatible API including:
- [OpenRouter](https://openrouter.ai/keys) — pay-per-token, 100+ models
- [Together AI](https://api.together.xyz)
- [Perplexity AI](https://www.perplexity.ai/settings/api)
- Local Ollama (if CORS headers are configured)
- Azure OpenAI
- AWS Bedrock proxies

---

## How to Use

1. Click the **ATS Scout** icon in Chrome toolbar
2. Select your AI provider and paste your API key → **Save**
3. Drop your resume PDF (parsed entirely in-browser)
4. Paste the job description (or click **Sample** to try it)
5. Click **Run ATS Analysis**
6. The side panel opens with full results:
   - ATS score before/after with animated rings
   - HR perspective card
   - Authenticity panel with 8 dimension scores
   - Experience realism check
   - Flagged AI-language patterns
   - Missing keywords
   - Required rewrites (and optional polish)
   - Annotated PDF with colour-coded highlights

---

## Privacy & Security

- **API keys** stored only in `chrome.storage.session` per-provider — cleared when browser closes, never in `localStorage` or `chrome.storage.local`
- **PDF bytes** never leave the browser — parsed locally by PDF.js WASM
- **History** stores text and JSON only — no binary blobs
- **Network calls** go only from your browser directly to the provider's API endpoint
- **No backend, no database, no proxy, no telemetry**

### Why `<all_urls>` in host_permissions?

Required to support the **Custom Provider** option, where users can enter any API endpoint URL (OpenRouter, Together AI, local servers, etc.). Without this permission, Chrome would block fetch calls to arbitrary domains. This is documented here for Chrome Web Store reviewers.

---

## Chrome Web Store Submission Checklist

- [ ] `dist/` builds without errors (`npm run build`)
- [ ] Icons: `icon16.png`, `icon48.png`, `icon128.png` present in `dist/icons/`
- [ ] Test on Chrome stable + Chrome beta
- [ ] Write store description (max 132 chars short, 16,000 chars long)
- [ ] Screenshots: 1280×800 or 640×400, at least 1 required
- [ ] Privacy policy stub (hosted URL required): cover `<all_urls>` justification + BYOK + no data collection
- [ ] Category: Productivity
- [ ] Single-purpose description: "AI-powered ATS resume analyser — BYOK, any provider, local PDF parsing"
- [ ] Justify `storage`, `sidePanel`, `scripting`, `activeTab` permissions in listing
- [ ] Justify `<all_urls>` host permission: required for user-defined custom API endpoints

### Privacy Policy Stub (host on GitHub Pages or similar)

> ATS Scout does not collect, store, or transmit any personal data to its developer. The extension operates entirely within the user's browser. PDF files are parsed locally using PDF.js and are never uploaded anywhere. API keys are stored only in `chrome.storage.session` (cleared on browser close) and are sent only to the user's chosen AI provider's official API endpoint. The `<all_urls>` host permission is required solely to support user-configured custom API endpoints (e.g. OpenRouter, local servers). No analytics, tracking, or telemetry is included.

---

## Development

```bash
npm run dev     # watch mode — rebuilds on save
npm run build   # production build → dist/
npm run zip     # zips dist/ → ats-scout.zip for Web Store upload
```

File structure:
```
ats-scout/
├── manifest.json
├── background.js
├── popup.html / popup.css / popup.js
├── sidepanel.html / sidepanel.css / sidepanel.js
├── icons/           SVG sources + generated PNGs
├── scripts/         generate-icons.js, copy-pdf-worker.js
├── public/lib/      pdf.worker.min.mjs (auto-copied on build)
└── lib/
    ├── llm.js       Provider-agnostic adapter
    ├── providers.js Static config + logos for all providers
    ├── pdfUtils.js  Local PDF parsing (pdfjs-dist)
    ├── history.js   chrome.storage.local history (last 20)
    └── exportPdf.js jsPDF report export
```
