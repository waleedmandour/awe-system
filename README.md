# AWE System - Automated Writing Evaluation

A Multimodal, LLM-based Automated Writing Evaluation (AWE) System for Formative Assessment

**For Foundation and Post-Foundation Year Students At Sultan Qaboos University**

---

## 🎯 Overview

This PWA (Progressive Web App) enables students to:
- Upload photos of handwritten essays
- Extract text using Google Vision OCR
- Receive AI-powered assessment based on IELTS criteria
- Get constructive feedback to improve their writing

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun runtime
- Google Gemini API key (free tier available)
- Google Cloud Vision API key (free tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/awe-system.git
cd awe-system

# Install dependencies
bun install

# Setup database
bun run db:push

# Run development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
bun run build
bun run start
```

---

## 📱 PWA Installation

Students can install the app on their devices:

**iOS (Safari):**
1. Open the app URL
2. Tap Share → "Add to Home Screen"

**Android (Chrome):**
1. Open the app URL
2. Tap Menu → "Install app"

---

## 🔑 API Keys

### Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API Key"
3. Free tier: 15 requests/minute

### Google Vision OCR Key
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable "Cloud Vision API"
3. Create credentials → API Key
4. Free tier: 1,000 units/month

---

## 📚 Supported Courses

### Foundation Program
| Course Code | Course Name | Assessment Scale |
|-------------|-------------|------------------|
| 0230 | English Language Foundation I | 0-6 per criterion |
| 0340 | English Language Foundation II | 0-6 per criterion |

### Post-Foundation Program
| Course Code | Course Name | Assessment Scale |
|-------------|-------------|------------------|
| LANC2160 | Academic English: Summary Writing | 0-5 per criterion |

---

## 📋 Assessment Criteria

### Foundation Courses (0230, 0340)
| Criterion | Scale | Description |
|-----------|-------|-------------|
| Task Response | 0-6 | How well the essay addresses the given task |
| Coherence & Cohesion | 0-6 | Logical organization and linking of ideas |
| Lexical Resource | 0-6 | Range and accuracy of vocabulary |
| Grammatical Range & Accuracy | 0-6 | Range and accuracy of grammar |

### Post-Foundation (LANC2160)
| Criterion | Scale | Description |
|-----------|-------|-------------|
| Task Achievement | 0-5 | How well the summary captures main points |
| Coherence & Cohesion | 0-5 | Logical organization and linking of ideas |
| Lexical Resource | 0-5 | Range and accuracy of vocabulary |
| Grammatical Range & Accuracy | 0-5 | Range and accuracy of grammar |

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Database**: Prisma ORM with SQLite
- **State**: Zustand
- **AI**: Google Gemini 2.0
- **OCR**: Google Vision API
- **Animations**: Framer Motion

---

## 📂 Project Structure

```
├── prisma/
│   └── schema.prisma      # Database schema
├── public/
│   ├── squ_logo.png       # SQU logo
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── assess/    # AI assessment endpoint
│   │   │   ├── courses/   # Course data endpoint
│   │   │   ├── essays/    # Essay CRUD endpoint
│   │   │   └── ocr/       # OCR processing endpoint
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Main application
│   ├── components/ui/     # shadcn/ui components
│   ├── hooks/             # Custom React hooks
│   └── lib/
│       ├── db.ts          # Database client
│       ├── store.ts       # Zustand store
│       └── utils.ts       # Utility functions
├── download/
│   └── index.html         # PWA installation page
└── package.json
```

---

## 🔒 Privacy

- No data is shared with third parties
- API keys stored locally in user's browser
- All processing happens via Google APIs
- Student essays are stored locally in SQLite

---

## 🎨 Design Features

- **Mobile-First**: Optimized for iOS and Android
- **Native Feel**: Smooth animations with Framer Motion
- **Safe Areas**: Support for notched devices
- **PWA Features**: Offline support, install prompts
- **Accessibility**: ARIA support, semantic HTML
- **Dark Mode**: Automatic theme detection

---

## 📦 Updating on GitHub

### Initial Setup (One-time)

```bash
# Initialize git if not already done
git init

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/awe-system.git

# Create main branch
git branch -M main
```

### Regular Updates

```bash
# Check status of changed files
git status

# Add all changes
git add .

# Or add specific files
git add src/app/page.tsx public/squ_logo.png

# Commit with a descriptive message
git commit -m "Enhance PWA with professional mobile design and SQU branding"

# Push to GitHub
git push origin main
```

### Update Specific Files

```bash
# Update only the main page
git add src/app/page.tsx
git commit -m "Update main app UI"
git push origin main

# Update logo and manifest
git add public/squ_logo.png public/manifest.json
git commit -m "Update SQU logo and PWA manifest"
git push origin main

# Update API routes
git add src/app/api/
git commit -m "Update API routes for OCR and assessment"
git push origin main
```

---

## 👨‍🏫 Credits

**Developed by:** Dr. Waleed Mandour  
**Year:** 2025-2026  
**Institution:** Sultan Qaboos University

---

## 📄 License

Educational use only. All rights reserved.
