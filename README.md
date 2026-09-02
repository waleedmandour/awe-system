# AWE System - Automated Writing Evaluation

A Multimodal, LLM-based Automated Writing Evaluation (AWE) System for Formative Assessment

**For Foundation and Credit Course Students at Sultan Qaboos University**

---

## Overview

This Progressive Web App (PWA) enables students to upload photos of handwritten essays, extract text using AI-powered OCR, and receive detailed, rubric-aligned assessments with constructive feedback. The system supports multiple courses across SQU's Foundation and Post-Foundation programs, each with tailored rubrics, word count targets, and assessment criteria. Students can install the app on their phones for quick, on-the-go practice, and all data is stored locally in the browser for privacy.

**Key capabilities:**

- Upload photos of handwritten essays (up to 2 pages) or type directly
- Extract text using Google Gemini OCR or Google Cloud Vision API
- Receive AI-powered assessment based on course-specific rubrics aligned with CEFR levels
- Choose between cloud (Gemini) and on-device (local LLM) assessment in Settings — on-device assessment works fully offline and keeps essays 100% private
- Get detailed feedback with justifications, error identification, and improvement suggestions
- Select exam type (Mid-semester or Final) for FP0230 and FP0340 with appropriate word count targets
- Enter an optional writing prompt for Foundation Final Exam to guide assessment
- Practice summary writing and synthesis essay writing for LANC2160 with source texts
- Practice 4-paragraph essay writing for LANC1070 with mid-semester and final tests
- Download assessment reports as PDF
- Install the app on mobile devices for quick offline-capable access

---

## Supported Courses

### Foundation Program

| Course Code | Course Name | Rubric Scale | Exam Types |
|-------------|-------------|:------------:|------------|
| FP0230 | English Language Foundation I | 0-6 per criterion | Mid-semester (120 words) / Final (200 words) |
| FP0340 | English Language Foundation II | 0-6 per criterion | Mid-semester (120 words) / Final (200 words) |

**FP0230 & FP0340 Special Features:**
- Exam-type selection (Mid-semester or Final) with dynamic word count targets
- Optional writing prompt input for Final Exam — if provided by the instructor, it is appended to the assessment criteria sent to Gemini, enabling more focused and context-aware feedback

### Post-Foundation Program

| Course Code | Course Name | Rubric Scale | Writing Tasks |
|-------------|-------------|:------------:|---------------|
| LANC1070 | Academic English: Essay Writing | 0-25 per criterion | Mid-Semester Practice Tests / Final Practice Tests |
| LANC2160 | Academic English: Summary Writing & Synthesis Essay | 0-5 per criterion (2-Point) / 0-25 per criterion | Summary Writing / Synthesis Essay |
| LANC2146 | Report Writing | 0-5 per criterion | Discussion & Conclusion Practice (350-450 words, +/-20 tolerance) |

---

## Assessment Criteria

### Foundation Courses (FP0230, FP0340)

| Criterion | Scale | Description |
|-----------|:-----:|-------------|
| Task Response | 0-6 | How well the essay addresses the task requirements, audience, purpose, and genre |
| Coherence and Cohesion | 0-6 | Logical organization, paragraphing, and use of cohesive devices |
| Lexical Resource | 0-6 | Range and accuracy of vocabulary, word choice, and spelling |
| Grammatical Range and Accuracy | 0-6 | Range and accuracy of grammatical structures and punctuation |

**Total:** 24 marks | **Special Rules:** Off-topic penalties apply to Task Response and Lexical Resource. Half-point scoring (0.5 increments) supported.

### LANC1070 — 4-Paragraph Essay Rubric

| Criterion | Weight | Scale | Description |
|-----------|:------:|:-----:|-------------|
| Content (Task Achievement) | 25% | 0-25 | Addresses question, understanding of source, relevance, word count |
| Cohesion & Coherence (Organization) | 25% | 0-25 | Logical flow, thesis, paragraph structure, topic sentences, cohesive devices |
| Paraphrasing + Lexical Resources | 25% | 0-25 | Vocabulary appropriateness, spelling, originality, use of own words |
| Grammatical Range and Accuracy | 25% | 0-25 | Sentence correctness, effectiveness, originality, freedom from plagiarism |

**Total:** 100 marks | **Practice Tests:** 3 mid-semester practice tests available (job market skills, monopoly, marketing strategies). Expected CEFR level: A2-B1. Target word count: 300-350 words.

### LANC2160 — Summary Writing (2-Point Scale)

| Criterion | Scale | Description |
|-----------|:-----:|-------------|
| Task Achievement | 0-5 | How well the summary captures the main points from the source text |
| Coherence & Cohesion | 0-5 | Logical organization and linking of ideas within the summary |
| Lexical Resource | 0-5 | Range and accuracy of vocabulary used in the summary |
| Grammatical Range & Accuracy | 0-5 | Range and accuracy of grammatical structures in the summary |

**Total:** 20 marks | **Available Source Text:** "The Salmon Cannon" (613 words, target summary: 160-220 words)

### LANC2160 — Synthesis Essay (2-Point Scale)

| Criterion | Scale | Description |
|-----------|:-----:|-------------|
| Task Achievement | 0-5 | Quality of synthesis from multiple source texts, relevance of selected information |
| Coherence & Cohesion | 0-5 | Logical flow, paragraph structure, and effective use of cohesive devices |
| Lexical Resource | 0-5 | Range, accuracy, and appropriateness of vocabulary with proper paraphrasing |
| Grammatical Range & Accuracy | 0-5 | Range and accuracy of grammar, sentence structures, and punctuation |

**Total:** 20 marks

**Available Synthesis Assignments:**

| # | Title | Sources | Word Count | Paragraphs |
|---|-------|:-------:|:----------:|:----------:|
| 1 | Two Common Sources of Poisoning Nitrates | 3 | 200-300 | 4 |
| 2 | Two Advantages of the Xeros Waterless Washing Machine | 3 | 300-350 | 4 |

### LANC2146 — Report Writing: Discussion & Conclusion (B1-B2 Level)

| Criterion | Scale | Description |
|-----------|:-----:|-------------|
| Task Response | 0-5 | Analysis and interpretation of data with details/examples/statistics; quality of the discussion section; adequacy of the conclusion |
| Coherence and Cohesion | 0-5 | Logical organization of information and ideas; use of cohesive devices; paragraphing |
| Grammatical Range and Accuracy | 0-5 | Use of grammatical functions (cause/effect, compare/contrast, prediction, recommendation); grammar structures accuracy; punctuation |
| Lexical Resource | 0-5 | Vocabulary range and genre-specific register; spelling, word formation, and capitalization |

**Total:** 20 marks | **Word Count Target:** 350-450 words (ideal: 400) with +/-20 word tolerance (effective acceptable range: 330-470)

**Practice Test:** "Investigating the Effects of Seed Priming with PEG on Wheat Seedling Germination" — Students write the Discussion and Conclusion sections based on provided Abstract, Introduction, Methods, and Results (including a bar graph figure). Expected CEFR level: B1-B2.

---

## FP0340 Exam-Type Selection

FP0340 (English Language Foundation II) supports two exam types with different word count targets:

| Exam Type | Target Word Count | Acceptable Range |
|-----------|:-----------------:|:----------------:|
| Mid-semester Exam | 120 words | 110-130 words |
| Final Exam | 200 words | 190-210 words |

When FP0340 is selected, students choose between "For Mid-semester Exam" and "For Final Exam." For the Final Exam, an optional writing prompt field appears — students can enter the essay topic or prompt provided by their instructor. If a writing prompt is entered, it is appended to the assessment criteria sent to Gemini, enabling the AI to evaluate the essay with awareness of the specific topic context.

---

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui
- **State Management:** Zustand (persisted to localStorage)
- **AI Assessment:** Google Gemini (gemini-2.5-flash-lite primary, with automatic fallback to gemini-2.5-flash → gemini-2.0-flash)
- **OCR:** Google Gemini + Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)
- **On-Device Assessment (optional):** MediaPipe LLM Inference for Web (Gemma / Qwen `.task` models), models stored in IndexedDB
- **Animations:** Framer Motion
- **PDF Generation:** PDFKit
- **Testing:** Vitest
- **CI/CD:** GitHub Actions (lint, typecheck, tests, build)
- **Deployment:** Vercel (serverless)

---

## Project Structure

```
awe-system/
├── .github/workflows/
│   └── build.yml              # CI pipeline (lint, typecheck, test, build)
├── public/
│   ├── squ_logo.png           # SQU logo
│   ├── manifest.json          # PWA manifest
│   ├── models/                # (optional) pre-downloaded local LLM weights
│   └── sw.js                  # Service worker
├── prisma/
│   └── schema.prisma          # Database schema (optional)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── assess/route.ts    # AI assessment endpoint (Gemini)
│   │   │   ├── courses/route.ts   # Course data endpoint
│   │   │   ├── essays/route.ts    # Essay CRUD endpoint
│   │   │   ├── ocr/route.ts       # OCR processing (Gemini + Vision)
│   │   │   └── pdf/route.ts       # PDF report generation
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx               # Main application (SPA router)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── ModelSelectionCard.tsx # Cloud/local model picker card
│   │   ├── screens/               # Modular screen components
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── SetupScreen.tsx
│   │   │   ├── CourseSelectionScreen.tsx
│   │   │   ├── UploadScreen.tsx
│   │   │   ├── ReviewScreen.tsx
│   │   │   ├── AssessmentScreen.tsx
│   │   │   ├── ResultsScreen.tsx
│   │   │   ├── RecordsScreen.tsx
│   │   │   └── RecordDetailScreen.tsx
│   │   ├── layout/                # Layout components
│   │   │   ├── AppShell.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   └── ErrorBoundary.tsx
│   ├── hooks/                    # Custom React hooks
│   └── lib/
│       ├── store.ts              # Zustand store (courses, assignments, state)
│       ├── config.ts             # AI model configuration (cloud tiers + local catalog)
│       ├── local-llm-service.ts  # On-device assessment (MediaPipe LLM Inference)
│       ├── model-downloader.ts   # Model downloads + IndexedDB storage
│       ├── scoring-utils.ts      # Score recalculation utilities
│       ├── display-utils.ts      # Display formatting helpers
│       ├── image-utils.ts        # Image processing utilities
│       ├── animations.ts         # Framer Motion animation configs
│       └── __tests__/            # Unit tests
│           ├── scoring-utils.test.ts
│           └── local-llm.test.ts
├── scripts/
│   └── download-models.mjs        # Pre-download local LLM weights to public/models/
├── CONTRIBUTING.md               # Contribution guidelines
├── CITATION.cff                  # Machine-readable citation file
├── LICENSE                       # MIT License
├── vitest.config.ts              # Vitest configuration
├── vercel.json                   # Vercel deployment config
└── package.json
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- npm or Bun runtime
- Google Gemini API key (free tier available)
- Google Cloud Vision API key (optional, for enhanced OCR)

### Installation

```bash
# Clone the repository
git clone https://github.com/waleedmandour/awe-system.git
cd awe-system

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Run TypeScript type checking |

---

## Deployment on Vercel

The AWE System is configured for one-click deployment on [Vercel](https://vercel.com). The project uses serverless API routes for OCR and assessment, and all student data is stored in the browser's localStorage — no server-side database is required for core functionality.

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/waleedmandour/awe-system)

### Manual Deploy

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select `waleedmandour/awe-system`
4. Leave all defaults — Vercel auto-detects Next.js
5. Click "Deploy"

> **Note:** No environment variables are required. API keys (Gemini, Vision) are entered by users directly in the app and stored in their browser's localStorage.

---

## PWA Installation

Students can install the app on their devices for a native-like experience:

**iOS (Safari):**
1. Open the app URL in Safari
2. Tap Share > "Add to Home Screen"

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap Menu > "Install app"

---

## API Keys

API keys are entered by each user inside the app and stored locally in their browser. No server-side keys are needed for deployment.

### Gemini API Key (Required)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click "Get API Key"
3. Free tier: 15 requests/minute (1,000 requests/day on gemini-2.5-flash-lite)

### Google Vision OCR Key (Optional)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable "Cloud Vision API"
3. Create credentials > API Key
4. Free tier: 1,000 units/month

---

## AI Model Selection

Students choose how their essays are assessed in **Settings → Assessment Model**. Both paths use the same course rubrics, and the cloud path remains the default behavior — nothing changes for students who never open Settings.

**Every user passes through Settings after the splash screen**, so API keys and the assessment model are reviewed before a program, course, and task are selected.

**OCR is always cloud-based.** Photo → text extraction runs exclusively on Gemini (via the `/api/ocr` route) because small on-device models cannot match its handwriting/character-recognition quality. The on-device option affects the essay **assessment (grading) step only**.

### Cloud Models (default — requires internet)

The assessment endpoint tries models in order and automatically falls back when one is rate-limited or unavailable:

| Model | Free tier (per key) | Role |
|-------|--------------------|------|
| gemini-2.5-flash-lite | 15 req/min, 1,000 req/day | Primary — best quota, lowest latency |
| gemini-2.5-flash | 10 req/min, 250 req/day | Automatic fallback |
| gemini-2.0-flash | 15 req/min, 200 req/day | Last-resort fallback |

Students can also pin a preferred cloud model (it is tried first, then the remaining tiers act as fallbacks). All tiers use structured JSON output with thinking disabled, and existing API keys continue to work unchanged.

### On-Device Models (optional — works offline)

For privacy-focused or offline use, students can download a small language model that runs **entirely in the browser** via MediaPipe LLM Inference (WebAssembly/WebGL). After the one-time download, on-device assessment needs no internet connection and essays never leave the phone.

| Model | Download size | Notes |
|-------|--------------:|-------|
| Gemma 3 1B | ~668 MB | Recommended — Google's web conversion via ungated mirrors, with automatic fallbacks |
| Qwen 2.5 0.5B | ~521 MB | Official Google conversion (ungated) — smallest, works on older phones |
| Qwen 2.5 1.5B | ~1.5 GB | Official Google conversion (ungated) — best on-device quality, needs a modern phone |
| TinyLlama 1.1B | ~1.1 GB | Experimental — official conversion, modest essay quality |

Every download URL in the catalog is verified to work **without authentication**. The downloader tries the primary URL first and then any configured fallback mirrors, so a single dead link never blocks a download.

**How it works:**
1. Download a model once in Settings (stored in the browser's IndexedDB, with a storage-space check and progress bar)
2. Enable "Assess on-device first"
3. Assessment runs locally; if the local model fails for any reason, the app automatically falls back to the cloud path

**Device readiness checks:** when an on-device model is selected, Settings shows a warning banner when the Battery Status API reports a low battery (< 20% and not charging) or when the device's cores/RAM look entry-level for the chosen model size. Warnings are advisory only — the user's choice is never blocked, and the cloud fallback always remains available (iOS Safari exposes no Battery API, so the check is simply skipped there).

**Model behavior on-device:**
- Output is parsed into the same rubric-aligned assessment shape as the cloud route, with scores recomputed deterministically from per-criterion results
- The local prompt pins the rubric to strict examiner behavior (evidence-quoted scoring, explicit caps for error-heavy essays, full score range) and decoding uses a low temperature so small models stay deterministic and JSON-faithful
- Rubric criteria, source texts, and word-count targets are resolved from client-side catalogs, so no server call is needed
- The WASM runtime is warmed once and reused across retries

**Pre-downloading models (optional, for restricted networks):**

```bash
npm run download-models            # downloads all catalog models to public/models/
npm run download-models --list     # list available models
```

Then point the model's `downloadUrl` in `src/lib/config.ts` at `/models/<file>.task`. Model configuration (cloud tiers, free-tier limits, local catalog) lives in one file: `src/lib/config.ts`.

> **Note on Gemma licensing:** Google's official `litert-community` Gemma repos on Hugging Face are license-gated (`gated: auto`) — anonymous downloads return HTTP 401, which is why the in-app catalog uses ungated public mirrors for Gemma and official ungated conversions (Qwen/TinyLlama) everywhere else. If you prefer the official source, accept the license on [litert-community/Gemma3-1B-IT](https://huggingface.co/litert-community/Gemma3-1B-IT), download `gemma3-1b-it-int4-web.task`, and host it yourself (e.g. in `public/models/`) — then point `downloadUrl` at your copy.

---

## Privacy & Security

- No data is shared with third parties beyond Google APIs (OCR and assessment)
- API keys are stored locally in each user's browser (localStorage)
- Essays and assessment records are stored in the browser, not on any server
- Server-side API routes only proxy requests to Google APIs
- **On-device assessment goes further: with a downloaded local model, essays never leave the device at all — no network request is made for assessment**
- Safety filters are configured to minimize false-positive blocking of academic content

---

## Design Features

- **Mobile-First:** Optimized for iOS and Android with touch-friendly UI, safe area support, and iOS press effects
- **Smooth Animations:** Framer Motion page transitions and micro-interactions
- **SQU Branding:** Official green (#1a5f2a) and gold (#c9a227) color scheme throughout, supporting 5 courses
- **Dark Mode:** Automatic theme detection (light/dark/system)
- **PWA Features:** Offline support, install prompts, service worker caching
- **Responsive:** Works seamlessly on phones, tablets, and desktop browsers
- **Error Boundaries:** Graceful error handling with user-friendly fallback UI
- **Modular Architecture:** Screen-based component structure for maintainability

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit pull requests, report bugs, and suggest features.

---

## Credits

**Developed by:** Dr. Waleed Mandour
**Year:** 2025-2026
**Institution:** Sultan Qaboos University — Center for Preparatory Studies

---

## How to Cite

If you use **awe-system** in your research, teaching, or publications, please cite it as follows:

### APA

> Mandour, W. (2025). *awe-system: A Multimodal, LLM-based Automated Writing Evaluation System for Formative Assessment* (Version 1.0.0) [Computer software]. Sultan Qaboos University — Center for Preparatory Studies. https://github.com/waleedmandour/awe-system

### BibTeX

```bibtex
@software{mandour_awe_system_2025,
  author    = {Mandour, Waleed},
  title     = {{awe-system: A Multimodal, LLM-based Automated Writing Evaluation System for Formative Assessment}},
  year      = {2025},
  version   = {1.0.0},
  publisher = {Sultan Qaboos University -- Center for Preparatory Studies},
  url       = {https://github.com/waleedmandour/awe-system}
}
```

### MLA

> Mandour, Waleed. *awe-system: A Multimodal, LLM-based Automated Writing Evaluation System for Formative Assessment*. Version 1.0.0, Sultan Qaboos University — Center for Preparatory Studies, 2025, https://github.com/waleedmandour/awe-system.

> A machine-readable citation file ([`CITATION.cff`](CITATION.cff)) is also available in the repository root.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*Built with ♥️ to the Language Teaching Community.*
