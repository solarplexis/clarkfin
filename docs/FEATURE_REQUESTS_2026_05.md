# Feature Requests — May 2026

## Requests

### 1. Course Duration Field
- Default class duration should be **8 weeks** (currently shows 4; may expand to 10 in future terms)
- Add a **course duration field** for teachers on new class setup: "# weeks"

### 2. Milestone Reports at Week 4 / 8
- Add monthly report milestones after week 4 and week 8
- If 10 weeks: report at month 1 (week 4), month 2 (week 8), then a **class-to-date** summary in the final report (like YTD)

### 3. Final Report PDF (under Goals)
- Add a **FINAL REPORT** box at the bottom of the Goals section
- Generates a downloadable PDF at the end of the last week of class
- Summarizes all student data with **Claude-generated recommendations** unique to the student's performance

### 4. Feedback Button (under Report)
- Free-form comment field for students to send feedback to their instructor
- Emailed to instructor at class end along with student **performance grades**
- Grades should be importable back into Canvas as an assignment

### 5. Weekly Spending → Canvas Grade
- Each week's spending update API links to a Canvas grade assignment
- Scope and rubric TBD — to be discussed separately

### 6. Add Help Section (Students and Course Admins)
- Add a **Help** nav item visible to both students and course admins
- Content: Claude-generated FAQs on usability and step-by-step instructions
- Include a **demo / walkthrough** for first-time users

---

## Analysis & Open Questions

### Course Duration
- Need to confirm whether duration lives on the semester record or elsewhere in the data model
- Duration field unblocks milestone report cadence

### Milestone Reports
- Are reports triggered automatically when the week rolls over, or manually generated?
- Are they in-app views, downloadable, or both?

### Final Report PDF
- Manual trigger (button) or auto-generated when term ends?
- Should the PDF be stored (S3/Vercel Blob) for later retrieval, or one-time download only?
- Is the Anthropic API key already wired into this project?
- Library preference: **react-pdf** (client-side) vs. server route with Puppeteer (higher fidelity)

### Feedback → Instructor Email
- Is email infrastructure already in place (SendGrid, Resend, etc.)?
- What defines "grades" — ClarkFin-calculated score, or instructor-assigned after reading the report?
- Same trigger as Final Report, or separate?

### Canvas Grade Integration
- Is any Canvas integration in place today (tokens, course IDs, OAuth)?
- Push grades automatically each week, or instructor manually syncs?
- Grading rubric: completion of weekly entry, or score based on budget adherence?
- Recommend scoping as a separate phase

### Help Section
- Visible to both students and course admins; API Docs remain under Admin (course admins / admins only)
- Static FAQ page vs. dynamically generated content?
- First-time walkthrough: step-by-step overlay tour, or a dedicated getting-started page?

---

## Suggested Implementation Order

1. **Course Duration field** — unblocks milestone reports
2. **Help Section + Admin rename** — quick wins, fully independent
3. **Milestone Reports** — depends on duration field
4. **Final Report PDF + Claude recommendations** — largest feature; needs library and storage decisions
5. **Feedback → instructor email** — can share the Final Report trigger
6. **Canvas grade integration** — separate discussion / future phase
