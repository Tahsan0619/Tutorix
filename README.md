# Tutorix

**AI toolkit for teachers and students**: 10 teacher tools and 10 student tools, running on Supabase (Postgres, Auth, Edge Functions) and Groq LLMs. Supports English, বাংলা and bilingual output.

![Tutorix](public/logo-192.png)

![Tutorix landing page](submission/screenshots/01-landing-hero.png)

## Screenshots

**Sign in and landing**

<table>
  <tr>
    <td width="50%"><img src="submission/screenshots/03-login.png" alt="Login"><br><sub>Login</sub></td>
    <td width="50%"><a href="submission/screenshots/02-landing-full-page.jpg"><img src="submission/screenshots/02-landing-full-page.jpg" alt="Full landing page"></a><br><sub>Full landing page (click to enlarge)</sub></td>
  </tr>
</table>

**Teacher tools**

<table>
  <tr>
    <td width="50%"><img src="submission/screenshots/04-teacher-dashboard.png" alt="Teacher dashboard"><br><sub>Teacher dashboard</sub></td>
    <td width="50%"><img src="submission/screenshots/05-my-materials.png" alt="My materials"><br><sub>My materials</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/06-worksheet-grounded-in-material.png" alt="Worksheet grounded in material"><br><sub>Worksheet grounded in the teacher's own material</sub></td>
    <td><img src="submission/screenshots/07-attach-material-picker.png" alt="Attach material picker"><br><sub>Attach material picker</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/08-lesson-plan.png" alt="Lesson plan"><br><sub>Lesson Plan Generator</sub></td>
    <td><img src="submission/screenshots/09-blooms-analyzer.png" alt="Bloom's analyzer"><br><sub>Bloom's Taxonomy Analyzer</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/10-test-quality.png" alt="Test quality"><br><sub>Standardized Test Quality Tester</sub></td>
    <td><img src="submission/screenshots/11-rubric.png" alt="Rubric"><br><sub>Rubrics Generator</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/12-term-planner.png" alt="Term planner"><br><sub>Syllabus / Term Planner</sub></td>
    <td></td>
  </tr>
</table>

**Student tools**

<table>
  <tr>
    <td width="50%"><img src="submission/screenshots/13-student-dashboard.png" alt="Student dashboard"><br><sub>Student dashboard</sub></td>
    <td width="50%"><img src="submission/screenshots/14-smart-notes.png" alt="Smart notes"><br><sub>Smart Notes</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/15-practice-quiz.png" alt="Practice quiz"><br><sub>Practice Quiz &amp; Weak Topic Analyzer</sub></td>
    <td><img src="submission/screenshots/16-mind-map.png" alt="Mind map"><br><sub>Mind Map Generator</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/17-concept-explainer.png" alt="Concept explainer"><br><sub>Concept Explainer</sub></td>
    <td><img src="submission/screenshots/18-problem-solver.png" alt="Problem solver"><br><sub>Step-by-Step Problem Solver</sub></td>
  </tr>
  <tr>
    <td><img src="submission/screenshots/19-flashcards.png" alt="Flashcards"><br><sub>Flashcards</sub></td>
    <td><img src="submission/screenshots/20-vocabulary-bangla-english.png" alt="Vocabulary builder"><br><sub>Vocabulary Builder (English ↔ বাংলা)</sub></td>
  </tr>
</table>

**Library and admin**

<table>
  <tr>
    <td width="50%"><img src="submission/screenshots/21-my-library.png" alt="My library"><br><sub>My Library</sub></td>
    <td width="50%"><img src="submission/screenshots/22-admin-overview.png" alt="Admin overview"><br><sub>Admin overview</sub></td>
  </tr>
</table>

## Quick start

1. Install [Node.js](https://nodejs.org) (LTS).
2. Double-click **`start.bat`** (or run `npm install` then `npm run dev`).
3. Open <http://localhost:5173> and sign in with a demo account:

| Role    | Email                  | Password      |
| ------- | ---------------------- | ------------- |
| Admin   | admin@tutorix.test     | `Admin@123`   |
| Teacher | teacher@gmail.com      | `Teacher@123` |
| Student | student@gmail.com      | `Student@123` |
| Teacher | teacher@tutorix.test   | `Teacher@123` |
| Student | student@tutorix.test   | `Student@123` |

New users can register as a teacher or student from the sign-up page. Admins are promoted from **Admin → Users**.

## Tools

**Teachers**

1. Bloom's Taxonomy Analyzer (single question + bulk paper analysis)
2. Lesson Plan Generator
3. Rubrics Generator (with interactive scoring)
4. Question & Worksheet Generator (MCQ, T/F, fill-in, short, long, matching; printable worksheet)
5. Standardized Test Quality Tester (AI review + classical item analysis from a response CSV: difficulty, discrimination, point-biserial, KR-20, SEM, distractors)
6. Answer Key & Marking Scheme Generator
7. Differentiated Content Generator (Support / Core / Extension)
8. Learning Objectives Generator (SMART + Bloom)
9. Report Card & Feedback Comment Generator (up to 40 students)
10. Syllabus / Term Planner (real calendar weeks, holidays, assessments, progress tracking)

**Students**

1. Smart Notes & Revision Sheet Generator (outline / Cornell / detailed, one-page revision sheets)
2. To-Do List Generator (phased tasks, progress, custom tasks)
3. Study Planner / Timetable (exam-aware, tick off sessions)
4. Flashcard Generator (flip + "I know it" study mode)
5. Practice Quiz & Weak Topic Analyzer (AI-graded short answers, history, subtopic accuracy, AI diagnosis)
6. Mind Map Generator (interactive collapsible map + outline)
7. Concept Explainer (4 levels, analogies, comparisons, follow-up chat)
8. Step-by-Step Problem Solver (LaTeX math, reveal-one-step mode, practice problem)
9. Mnemonic Generator (acronym, sentence, rhyme, story, memory palace)
10. Vocabulary Builder (English ↔ বাংলা, IPA, pronunciation, self-quiz)

Every result is saved to **My Library** (search, filter, favourite, rename, delete) and can be exported as Markdown, Word, or a downloadable A4 **PDF** (branded header, page numbers, clean typography, rendered math and Bangla text). Interactive progress (ticked tasks, known flashcards, quiz answers, chat) is saved with the item.

All AI text is sanitized twice: in the Edge Function (repairs LaTeX damaged by JSON escaping, converts HTML to markdown, strips stray bullets, code fences and invisible characters) and in the browser before rendering or exporting (math delimiters, currency vs. math, table cells). Run `npx tsx scripts/test-sanitize.mts` to check the sanitizers.

## Your own material: CAG, RAG and caching

Smart Notes, Flashcards, Practice Quiz, Mind Map, Concept Explainer (and its follow-up chat) and the Question & Worksheet Generator can work from the user's own material: pasted text, an uploaded PDF, or chapters saved under **My materials**.

- **CAG (cache-augmented generation)**: when the material fits the budget (about 3,000 tokens, roughly 9,000 English characters), the whole text is preloaded at the very start of the system prompt. Nothing is left out, and repeated requests on the same material reuse Groq's prompt cache (same prefix, cheaper and faster).
- **RAG (retrieval-augmented generation)**: longer material (up to 400,000 characters per item, 5 items per request) is split into ~1,100-character passages. Each request retrieves the passages that matter for that tool and topic with hybrid search: BM25 keyword ranking (works for Bangla and English) fused with semantic vector search (Supabase's built-in `gte-small` embeddings in pgvector) using reciprocal rank fusion. Neighbouring passages are added for context, and if the query matches little, passages are sampled evenly so the whole chapter is represented. Long pasted text uses the same search on the fly instead of being cut off.
- **Response cache**: an identical request (same tool, inputs, material versions, prompts and models) within 7 days is answered from `ai_cache` instantly and does not count towards the hourly limit. **Regenerate** always asks for a fresh answer. Date-relative tools (to-do, study planner, weak topics) are never cached.
- Each result shows what it was based on, e.g. "Based on Class 8 Science: read in full" or "12 of 37 passages most relevant to this request".

Saved materials are private (RLS); chunks and embeddings are written only by the Edge Function. Semantic embeddings are English-only, so Bangla passages rely on keyword search, which handles Bengali script natively.

![CAG / RAG pipeline](submission/diagrams/rag-cag-pipeline.png)

## Architecture

![Architecture](submission/diagrams/architecture.png)

```
React (Vite + TS + Tailwind)  ──►  Supabase Auth (email/password)
          │                         Supabase Postgres (RLS on every table)
          └── supabase.functions.invoke('ai', {tool, input})
                     │
                     ▼
          Edge Function `ai` (Deno)
            • verifies the user's JWT, role, account status and hourly rate limit
            • answers repeats from ai_cache; otherwise grounds the request in the
              user's material (CAG or RAG), calls Groq (JSON mode) with model fallback
            • logs usage to ai_usage, saves the result to generations
```

- **Database** – `supabase/migrations/20260930000000_tutorix_schema.sql`: `profiles`, `generations`, `quiz_attempts`, `app_settings`, `ai_usage`, plus admin RPCs (`admin_overview`, `admin_set_role`, `admin_set_status`). Users can only see their own data; admins can see everything. `20260930120000_rag_cag.sql` adds pgvector, `materials`, `material_chunks` (HNSW index), the `match_material_chunks` RPC and `ai_cache`.
- **AI** – `supabase/functions/ai/`: `teacher.ts` and `student.ts` hold every prompt and output normaliser; `groq.ts` handles token budgeting, retries, rate limits and fallback models; `knowledge.ts` does chunking, BM25, embeddings and the CAG/RAG context builder.
- **Frontend** – `src/tools/teacher/*` and `src/tools/student/*` each export a form, a result view and a Markdown exporter; `src/components/ToolWorkspace.tsx` provides saving, exports and the library integration.

## Configuration

`.env` (public values only, safe for the browser):

```
VITE_SUPABASE_URL=https://gkdvlkkxzdcagxduzeay.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Server secrets live in Supabase, never in the frontend:

- `GROQ_API_KEY`: Edge Function secret (Dashboard → Edge Functions → Secrets).
- `GROQ_API_KEY_2` (optional, also `_3`…`_5`): fallback keys. When a key is rate-limited or rejected, the request switches to the next key for the same model before falling back to another model. **Admin → AI settings → Test** shows whether each key is valid.
- Models and per-user hourly limit: editable in the app under **Admin → AI settings** (with a live model test).

## Scripts

These need a Supabase personal access token in `SUPABASE_ACCESS_TOKEN`:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
node scripts/run-sql.mjs supabase/migrations/20260930000000_tutorix_schema.sql   # (re)create the schema (drops existing Tutorix tables)
node scripts/run-sql.mjs supabase/migrations/20260930120000_rag_cag.sql          # materials, vector search, response cache
node scripts/seed-demo-users.mjs                                                   # create/reset the 5 demo accounts
npm run deploy:functions                                                           # deploy the Edge Function
npm run test:ai                                                                    # end-to-end test of every tool + security checks
node scripts/test-ai.mjs flashcards mind-map                                       # test specific tools
node scripts/test-rag.mjs                                                          # CAG, RAG (English + Bangla), embeddings, cache, access control
```

Other commands: `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`.

## Notes on the Groq free tier

The free tier allows about 8,000 tokens per minute and 1,000 requests per day per model. Tutorix keeps each request under the per-minute budget, spreads large jobs (bulk Bloom analysis, long worksheets, report comments) across models, and automatically falls back to another model when one is rate-limited. If many people use it at once, some requests may take a little longer or ask you to retry after a minute; a paid Groq key removes these limits.

## Credits

Built as **Tutorix** (formerly ShikkhAI).
