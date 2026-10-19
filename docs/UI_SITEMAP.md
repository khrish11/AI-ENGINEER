# UI/UX Sitemap & Interface Architecture
## AI Engineer OS — Visual System, Navigation & Accessibility Specification (Corrected)

---

### 1. Design System & Aesthetic Principles

AI Engineer OS blends the precision and density of high-performance developer tools (e.g., VS Code, Linear, GitHub) with the clarity and accessibility of modern education platforms.

#### Visual Tokens
- **Typography**: 
  - Primary UI Font: `Inter` or `Geist Sans` (high legibility, neutral modern grotesque).
  - Code & Monospace: `JetBrains Mono` or `Geist Mono` (ligatures, distinct glyphs for 0/O, 1/l).
- **Color Palette**:
  - Dark Theme (Default): Deep slate canvas (`#090D16`), card surface (`#111827`), subtle borders (`#1F2937`), accent cyan (`#06B6D4`), accent violet (`#8B5CF6`), text primary (`#F9FAFB`), text secondary (`#9CA3AF`).
  - Light Theme: Clean zinc canvas (`#F8FAFC`), card surface (`#FFFFFF`), borders (`#E2E8F0`), accent cyan (`#0891B2`), text primary (`#0F172A`), text secondary (`#475569`).
  - Semantic Status:
    - Mastered / Completed: Emerald (`#10B981`)
    - In Progress: Cyan (`#06B6D4`)
    - Needs Review: Amber (`#F59E0B`)
    - Not Started: Zinc / Slate (`#64748B`)
- **Micro-Animations**: Smooth 150ms-250ms cubic-bezier ease transitions for accordion expansion, sidebar collapse, modal entrance, and progress bar advances. No distracting gratuitous animations.

---

### 2. Complete Application Route Map & Phased Delivery

```
/ (Root)
│
├── /curriculum                      # [MVP] Complete 20-phase curriculum browser
│   └── /[phaseSlug]                 # [MVP] Phase overview & lesson listing
│       └── /[lessonSlug]            # [MVP] Dedicated Lesson Workspace (Reading, Video, Code, Notes)
│
├── /resources                       # [MVP] Curated Resource Registry
│   ├── /resources/videos            # [MVP] YouTube deep-dives & playlists
│   ├── /resources/repositories      # [MVP] GitHub reference implementations
│   └── /resources/papers            # [MVP] Research papers & official documentation
│
├── /projects                        # [MVP] Project catalog (basic)
│   └── /[projectSlug]               # [Enhanced - Phase 6] Project challenge workspace (Milestones, Rubrics, Proof-of-work submission)
│
├── /settings                        # [MVP] Preferences, data export/import, sync
│   ├── /settings/profile            # [MVP] Public handle, bio, specialization
│   ├── /settings/sync               # [MVP] Guest-to-Account sync, offline storage status
│   └── /settings/export             # [MVP] Versioned JSON data backup & restore
│
├── /dashboard                       # [MVP/Enhanced] Primary learner control center
│
├── /onboarding                      # [Enhanced] Multi-step goal & skill placement flow
│
├── /roadmap                         # [Enhanced] Personalized week-by-week schedule
│   ├── /roadmap/schedule            # [Enhanced] Calendar view & rescheduling drawer
│   └── /roadmap/paths               # [Enhanced] Browse other specialization tracks
│
├── /practice                        # [Enhanced] Assessments & Practice Arena
│   ├── /practice/quizzes            # [Enhanced] Cumulative quiz review & weak topic drills
│   └── /practice/flashcards         # [Enhanced] Key terms & spaced repetition review queue
│
├── /analytics                       # [Enhanced] Real-time study analytics & mastery radar
│
└── /portfolio/[username]            # [Enhanced] Public proof-of-work portfolio (shareable URL)
```

---

### 3. Page Shells & Wireframe Layouts

#### 3.1 Global Navigation Shell
- **Desktop (>= 1024px)**: Left collapsible sidebar (260px expanded, 72px collapsed) containing:
  - Brand header with Git Revision indicator.
  - Core navigation links with status badges.
  - Quick Search trigger (`Ctrl + K` / `Cmd + K`).
  - Learner profile badge / Guest Mode indicator.
  - Theme toggle (Dark / Light).
- **Mobile (< 1024px)**: Bottom tab bar (Curriculum, Resources, Projects, Dashboard, Settings) + Slide-out navigation drawer.

#### 3.2 Dashboard (`/dashboard`)
```
+---------------------------------------------------------------------------------------+
|  Welcome back, Girish [General AI Track]                 [Sync: Up-to-date]  [Theme]  |
+---------------------------------------------------------------------------------------+
|  [ RESUME LEARNING: 11-llm-engineering / 06-rag ]                                     |
|  Current Step: Interactive Retrieval Lab (In Progress)   [ Continue Lesson -> ]       |
+---------------------------------------------------+-----------------------------------+
|  CURRENT WEEKLY PLAN (Week 4 of 16)               |  OVERALL CURRICULUM PROGRESS      |
|  * [x] Vector Embeddings Math (Completed)         |  Lessons: {completed} / {total}   |
|  * [ ] Chunking Strategies (In Progress)          |  Mastered: {masteredCount} skills |
|  * [ ] Hybrid Search & Reranking (Due Friday)     |  Study Time: {hours} hrs active   |
|  [ Reschedule Week ]  [ Buffer Day: +1 ]          |  Active Projects: {projectCount}  |
+---------------------------------------------------+-----------------------------------+
|  TOPICS REQUIRING REVIEW (Spaced Repetition)      |  RECENT LEARNING ACTIVITY         |
|  * Dot-product Attention QK^T / sqrt(d)           |  * Today: Passed quiz (100%)      |
|  * Backprop gradient flow in LayerNorm            |  * Yesterday: Solved lab exercise |
|  [ Launch 10-Min Flash Drill ]                    |  * Oct 14: Completed Phase 02     |
+---------------------------------------------------+-----------------------------------+
```

#### 3.3 Lesson Workspace (`/curriculum/[phaseSlug]/[lessonSlug]`)
```
+---------------------------------------------------------------------------------------+
| < Back to Phase 11     Phase 11: LLM Engineering / Lesson 06: RAG         [ Bookmark ]|
+---------------------------------------------------------------------------------------+
| [TAB 1: Read Guide]  [TAB 2: Video (YouTube)]  [TAB 3: Code Lab]  [TAB 4: Quiz (Post)]|
+-----------------------------------------------------------+---------------------------+
|                                                           | LESSON METADATA & DRAWER  |
| # Retrieval-Augmented Generation (RAG)                    | * Difficulty: Intermediate|
| > Grounding model answers in verified source documents.   | * Est. Time: ~75 minutes  |
|                                                           | * Upstream Git: c81651a   |
| ## The Problem                                            |                           |
| LLMs suffer from hallucinations and knowledge cutoff...   | CURATED RESOURCES         |
|                                                           | * [Video] Verified Embed  |
| ## The Concept (Interactive Diagram)                      | * [Repo] Reference Code   |
| [ Mermaid Flow: Document -> Chunks -> VectorDB -> Query ] | * [Paper] arXiv Link      |
|                                                           |                           |
| ## Build It (From Scratch Implementation)                 | MY NOTES (Revision 2)     |
| ```python                                                 | [ Synced 2 mins ago ]     |
| def cosine_similarity(a, b):                              | "Need to test BM25 hybrid |
|     return np.dot(a, b) / (np.linalg.norm(a)*norm(b))     |  weighting next..."       |
| ```                                                       |                           |
|                                                           | [ Mark Lesson Complete ]  |
+-----------------------------------------------------------+---------------------------+
```

---

### 4. Accessibility Design Targets & Verification Criteria (WCAG 2.2 AA)

1. **Keyboard Operability**:
   - Every interactive control (tabs, buttons, dropdowns, code copy buttons, quiz radio choices) is reachable and operable via `Tab`, `Space`, `Enter`, and arrow keys.
   - Visible high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-cyan-500`).
   - Skip to main content link (`Skip to content`) for keyboard and screen-reader users.
2. **Contrast Standards**:
   - Normal text meets >= 4.5:1 contrast against background in both light and dark themes.
   - Large text (>= 18pt or 14pt bold) meets >= 3:1.
   - Non-text UI components (input borders, active tab underlines) meet >= 3:1.
3. **Screen Readers & ARIA**:
   - Semantic HTML5 structure (`<header>`, `<nav>`, `<main>`, `<aside>`, `<article>`, `<footer>`).
   - Tab panels with `role="tablist"`, `role="tab"`, and `role="tabpanel"`.
   - Accessible labels on icon-only buttons (`aria-label="Bookmark lesson"`).
   - Announce dynamic status changes via `aria-live="polite"` (e.g. sync notifications, quiz score alerts).
4. **Data Display Integrity**:
   - Every data-driven container provides explicit **Loading** (skeleton screens), **Empty** (friendly actionable guides), and **Error** (retry buttons) states.
   - No mock counters or fake streak animations.
