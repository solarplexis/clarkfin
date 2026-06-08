# Implementation Assumptions — feature/syllabus-rag

Recorded during autonomous implementation session. Review and correct as needed.

---

## Tiptap / Syllabus Editor

1. **HTML storage format** — Syllabus content is stored as Tiptap-generated HTML in Firestore. Plain text is derived at index time by stripping tags. Markdown was considered but HTML is the native Tiptap format and avoids a conversion step in the editor.

2. **Heading extensions** — Added `@tiptap/extension-heading` to the editor (H2 and H3 only). H1 is excluded since the course title already serves as the page heading. These heading levels are the split points for RAG chunking.

3. **Tiptap packages** — Installed `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`. StarterKit includes Heading by default, so no separate heading package is needed.

4. **Syllabus save is separate from course detail save** — The "Details" tab and "Syllabus" tab each have their own Save button. They share the same page but submit independently, to avoid requiring a non-empty syllabus when editing basic course fields.

---

## Full-Screen Course Edit Page

5. **URL structure** — New route is `/app/org/courses/[semesterId]/edit`. The existing `EditSemesterDrawer` component is retained in the codebase (not deleted) since it may be referenced elsewhere, but its trigger in the org dashboard table is replaced with a link.

6. **Create form redirect** — After `CreateSemesterForm` successfully POSTs, it redirects to `/app/org/courses/{semesterId}/edit`. This means the instructor lands directly on the edit page to fill in the syllabus after creating a course.

7. **Back navigation** — The edit page has a `← Courses` link back to `/app/org` (the org dashboard). No breadcrumb beyond that.

---

## Firestore / Data

8. **Syllabus stored in `syllabi` collection** — `syllabi/{semesterId}` with fields `{ content: string, updatedAt: Timestamp }`. This is separate from the `semesters` document to keep course list queries fast (no large HTML blobs fetched on list).

9. **Chunks stored in a subcollection** — Path is `semesters/{semesterId}/syllabusChunks/{chunkIndex}`. Using a subcollection (rather than a top-level collection with a `semesterId` filter) means `findNearest()` runs without a pre-filter, avoiding the composite vector+filter index complexity. On every re-index, all existing chunk documents in the subcollection are deleted and replaced.

10. **Firestore delete-then-write** — Old chunks are deleted in a batch before writing new ones. If the indexing API call fails mid-way, chunks may be partially written. Accepted as a known limitation for now; a re-save will fix it.

11. **No indexing status field** — The edit page shows a static "Syllabus saved" confirmation rather than a live indexing status. Adding a real-time index status indicator (e.g., polling or a Firestore field) is left for a future iteration.

---

## RAG / Embeddings

12. **Embedding model** — `text-embedding-3-small` (1536 dimensions, ~$0.02/1M tokens). Chosen for cost. Can be upgraded to `text-embedding-3-large` (3072 dims) by changing one constant and re-indexing.

13. **Chunk size strategy** — Split on `<h2>` and `<h3>` tags (semantic chunking). Each chunk = heading text + all content until the next heading. If a section exceeds ~800 words, it is not further split (kept as one chunk). A course without headings gets one chunk for the full content.

14. **Top-k retrieval** — Query returns the top 5 most similar chunks. This was chosen as a balance between context richness and token cost. Can be tuned.

15. **Env var name** — Using `OPEN_AI_KEY` (as found in `.env.local`), not the standard `OPENAI_API_KEY`.

16. **No chunk for empty syllabus** — If a course has no syllabus, `querySyllabusChunks` returns null. The AI assistant caller is responsible for injecting the "no syllabus available" message.

---

## Firestore Rules

17. **`syllabi` collection** — Org admins can read/write. Students cannot read directly (they access syllabus content only through the AI assistant, which runs server-side).

18. **`semesters/{id}/syllabusChunks` subcollection** — Firestore rules deny all client reads and writes (`allow read, write: if false`). All vector queries run server-side via firebase-admin, so no client access is needed.

---

## Packages

19. **`openai` package version** — Installed `^6.42.0`. Uses the `openai` npm package with `new OpenAI({ apiKey: process.env.OPEN_AI_KEY })`.

20. **Vector index deployment** — After merging, run `firebase deploy --only firestore:indexes` to activate the vector index on `syllabusChunks.embedding`. Until deployed, `findNearest()` will return a Firestore error on first query. The index config is in `firestore.indexes.json` under `fieldOverrides`.

---

## AI Assistant (feature/ai-assistant)

21. **Model** — `claude-opus-4-8` with `thinking: { type: "adaptive" }`. Using Opus per the claude-api skill default. If response latency becomes a concern, this can be swapped to `claude-haiku-4-5` (much faster, lower cost) by changing the model string in `app/api/ai/chat/route.ts`.

22. **API key env var** — `ANTHROPIC_API_KEY` (standard Anthropic SDK default). Must be added to `.env.local` before the feature works. A blank placeholder is already in `.env.local`.

23. **Ephemeral context** — Chat history lives only in React state. Navigating away clears it. This is enforced by a `useEffect` on `usePathname()` in `AiAssistantPanel`. No chat history is persisted to Firestore.

24. **FAB placement** — Floating action button is fixed to `bottom: 28px; right: 28px`. The panel opens from the right side (width 420px, slides in). It does not push page content left via CSS — that would require body-level state management. The panel overlays content instead. Can revisit if a non-overlapping layout is preferred.

25. **Tool scope** — Three tools exposed to Claude: `create_expense_entry`, `create_income_entry`, `create_debt`. Update/delete is explicitly excluded — the assistant can only add new entries. To edit or delete, users are directed to the relevant app page. This avoids complex disambiguation ("which entry did you mean?") and keeps financial data mutations auditable.

26. **RAG retrieval per message** — The last user message is used to query the syllabus chunks on every assistant call. This keeps syllabus context fresh without maintaining a running embedding across turns.

27. **Student panel only** — `AiAssistantPanel` is rendered in `DashboardShell` only for `STUDENT` role, and only when `user.activeSemesterId` is set. Org admins and system admins do not get the assistant.

28. **Markdown link rendering** — The assistant can include `[text](/path)` links in responses. A simple regex renderer in the component converts these to Next.js `<Link>` components. No full markdown library is used to keep the bundle small.
