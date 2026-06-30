# FITYUGA Goal Confirmation Survey
### Full implementation guide and reference documentation

---

## 1. What this is

A dynamic, branching, AI-personalised goal confirmation survey for the FITYUGA 2026 employee fitness challenge at SCM YUGA Technologies. Everyone in the challenge goes through this to lock in their exact goal for the year. Based on what they pick, the form shows only the questions relevant to their path. At the end, each person gets a personalised, AI-generated insight tied to their specific numbers, plus a teaser about the prize waiting for them if they commit.

**Stack:** Next.js app hosted on Vercel, with a serverless API route that calls the Claude API for the personalised insight, and a Google Apps Script endpoint that writes every response into a Google Sheet.

**Why this architecture:** The Claude API key never touches the browser. It lives only in Vercel's server-side environment variables. The survey itself is a single static HTML file (no React complexity, fast to load, easy to edit), served by Next.js. The Google Sheet acts as the database, exactly like the earlier FITYUGA surveys, so all your existing reporting and analysis habits carry over.

---

## 2. The complete survey, question by question

### Screen 0 — Welcome

Not a question. A motivating intro screen with:
- Headline: "Time to lock in your goal for the year."
- Subtext: explains that they'll pick a path, set a target, and get a personalised plan, with something big waiting at the finish line if they stick with it
- Three stat chips: 3 paths to choose / 2 min to complete / 1 personalised report
- A single button: "Let's lock it in"

No mention of any previous survey. This is framed as a forward-looking commitment moment, not a check-in on old data.

### Section A — Common questions (everyone answers these, in this order)

| # | ID | Question | Type | Notes |
|---|----|----|------|-------|
| 1 | `name` | "What's your name?" | Free text | First name is fine |
| 2 | `weight` | "What's your current weight today?" | Free text | e.g. "78 kg". This is the shared baseline metric used across all three goal paths |
| 3 | `height` | "What's your height?" | Free text | e.g. "172 cm". Context only |
| 4 | `activity` | "How active have you been in a typical week recently?" | 5-option multiple choice | Rarely or never, mostly sedentary → Once or twice a month → About once a week → 2–3 times a week fairly consistently → Almost every day, it's part of my routine |
| 5 | `injury` | "Any current injury or medical limitation we should know about?" | Free text, optional | Type "none" if not applicable |
| 6 | `goal_type` | "What do you want to achieve this year?" | Goal card selector (3 large tappable cards, not radio buttons) | This is the branch point. See below. |

**The three goal cards (question 6):**

1. **⚖️ Lose weight / gain weight** — "Body recomposition by the scale, fat loss or lean mass gain"
2. **💪 Get stronger** — "Push-up or pull-up based, build real bodyweight strength"
3. **🏃 Run a distance or a marathon** — "5K, 10K, half marathon, or a specific race"

Whichever card is tapped determines which question set appears next. The person never sees the other two paths' questions.

### Section B1 — Path: Weight (only if "Lose weight / gain weight" was selected)

| # | ID | Question | Type | Notes |
|---|----|----|------|-------|
| 7 | `w_direction` | "Are you looking to lose weight or gain weight?" | 2-option multiple choice | Lose weight / Gain weight (lean mass) |
| 8 | `w_target` | "What's your target weight by the end of the year?" | Free text | e.g. "68 kg" |
| 9 | `w_deadline` | "Any specific deadline in mind, or should we use the standard end of year target?" | Free text | Type a date, or "standard" |

### Section B2 — Path: Strength (only if "Get stronger" was selected)

| # | ID | Question | Type | Notes |
|---|----|----|------|-------|
| 7 | `s_pushups` | "Right now, what's your honest max push-ups in one go?" | 5-option multiple choice | 0–3, it's a real struggle → 4–10 → 11–20 → 21–40 → More than 40 |
| 8 | `s_pullups` | "And your honest max pull-ups right now?" | 5-option multiple choice | Zero, haven't been able to do one → 1–3 → 4–7 → 8–12 → More than 12 |
| 9 | `s_focus` | "Which is your main goal?" | 3-option multiple choice | Push-ups / Pull-ups / Both equally |
| 10 | `s_target` | "What's your target number by the end of the year?" | Free text | e.g. "30 push-ups, or 10 pull-ups" |

### Section B3 — Path: Running (only if "Run a distance or a marathon" was selected)

| # | ID | Question | Type | Notes |
|---|----|----|------|-------|
| 7 | `r_longest` | "Right now, what's your longest continuous run without stopping?" | 5-option multiple choice | Under 1 km, I tire quickly → Around 1–3 km with effort → About 5 km → 5–10 km comfortably → More than 10 km, I run regularly |
| 8 | `r_target_type` | "What's your goal?" | 4-option multiple choice | Complete a 5K / Complete a 10K / Complete a half marathon (21K) / A specific race or event |
| 9 | `r_event` | "If there's a specific race or event, name it (and the date if you know it)." | Free text, optional | e.g. "Bangalore 10K, October 2026" |

### Section C — Final question (everyone answers this, after their path questions)

| # | ID | Question | Type | Notes |
|---|----|----|------|-------|
| 11 | `commit` | "Let's do this as a challenge, you in?" | Yes/No card selector | Two large buttons: "💪 Yes, let's go" and "🤔 Not this time". Hint text: "Squads, friendly competition, and something big waiting for whoever crosses the line." This is framed as an invitation, not a permission request. |

**Total questions per person:** 11 (6 common + 3 path-specific + 1 closing), regardless of which path they take. Roughly 2 minutes to complete.

---

## 3. How the branching actually works

This is a single-page app with no page reloads. The question flow is held in a JavaScript array called `questions`, which starts as just the 6 common questions. The moment someone presses Continue on the goal card question (`goal_type`), the code splices in the correct path array (`weightQuestions`, `strengthQuestions`, or `runningQuestions`) plus the final commit question, all before the person sees the next screen. They only ever see their own path's questions: a Runner never sees push-up questions, a Transformer never sees running questions.

Every multiple-choice and card-based question requires the user to actively press **Continue** to advance. Selecting an option only highlights it; it does not auto-submit. This was a deliberate fix from an earlier version, so people can change their mind before moving forward.

---

## 4. The results screen — what appears at the end

After the final question, the screen shows, in this order:

1. **Personal greeting** — "You're all set, [Name]." with a subtitle that differs depending on whether they said yes or no to the commit question.
2. **Summary card** (dark navy) — shows their goal path label and the specific numbers they entered, formatted differently per path (e.g. for weight: current weight, target weight, timeline; for running: current longest run, goal, event).
3. **AI insight card** (gold-tinted) — a personalised, evidence-flavoured insight generated by the Claude API based on their exact answers. See section 5 below for full detail on how this works.
4. **Prize teaser card** (dark navy, only shown if they committed) — a one-line teaser about a reward waiting for them if they hit their goal, worded specifically for their path (weight/strength/running each get distinct phrasing). This is shown last, after the science-backed insight, so the person has already built some investment in the goal before the stakes are revealed.
5. **Closing message** — confirms next steps (squad assignment incoming on WhatsApp) if committed, or a no-pressure note if not.

---

## 5. How the AI insight is generated

When the form is submitted, the browser sends all answers to `/api/submit`, a serverless function running on Vercel. That function:

1. Builds a short text description of the person's exact goal (e.g. "Lose weight. Current weight: 82kg. Target weight: 72kg. Timeline: standard.")
2. Sends this to the Claude API (`claude-sonnet-4-6`) with a system prompt instructing it to write one punchy, evidence-flavoured insight, specific to their numbers, in strict JSON format: `{"icon", "eyebrow", "headline", "body"}`
3. Parses the response and returns it to the browser
4. Separately, forwards the full survey response plus the generated insight to the Google Apps Script endpoint, which writes everything into the Google Sheet

If the Claude API call fails for any reason (missing key, rate limit, network issue), the function falls back to one of three pre-written insights (one per goal path) so the user never sees an error. This fallback logic lives in `pages/api/submit.js`.

The Claude API key is read from the environment variable `CLAUDE_API_KEY`, set in Vercel's dashboard. It is never present in any file that reaches the browser.

---

## 6. Data captured in the Google Sheet

Every submission creates one row in a sheet/tab called **GoalConfirmations** with these 19 columns:

| Column | Source |
|--------|--------|
| Timestamp | Auto-generated |
| Name | Q1 |
| Current Weight | Q2 |
| Height | Q3 |
| Activity Level | Q4 (full text of selected option) |
| Injury / Limitation | Q5 |
| Goal Path | Derived: "Weight" / "Strength" / "Running" |
| Weight: Direction | Q7 (weight path only) |
| Weight: Target | Q8 (weight path only) |
| Weight: Deadline | Q9 (weight path only) |
| Strength: Push-ups | Q7 (strength path only) |
| Strength: Pull-ups | Q8 (strength path only) |
| Strength: Focus | Q9 (strength path only) |
| Strength: Target | Q10 (strength path only) |
| Running: Longest Run | Q7 (running path only) |
| Running: Goal | Q8 (running path only) |
| Running: Event | Q9 (running path only) |
| Committed to Challenge | Q11, Yes/No, colour-coded green/red |
| AI Insight | The full JSON of the generated insight, stored for your records |

The "Goal Path" column is colour-coded automatically: amber for Weight, blue for Strength, green for Running, so you can scan the sheet visually and instantly see your track distribution, exactly like the squad-balancing work done on the original wellness survey.

---

## 7. All files you need

```
fityuga-vercel/
├── package.json                    Next.js + React dependencies
├── next.config.js                  Minimal Next.js config
├── .gitignore                      Excludes node_modules, .env files
├── .env.local.example              Template for local environment variables
├── google_apps_script_writer.js    Paste this into Google Apps Script
├── pages/
│   ├── index.js                    Redirects "/" to the survey
│   └── api/
│       └── submit.js               Serverless function: calls Claude, writes to Sheet
└── public/
    └── survey.html                 The entire survey UI (HTML/CSS/JS, single file)
```

Everything is in the attached `fityuga-vercel.zip`. The Apps Script file is also provided standalone since it gets pasted into a different place (the Google Sheets editor, not your code folder).

---

## 8. Step-by-step implementation plan

### Part 1 — Google Sheet backend (5 minutes)

1. Open your Google Sheet (the same one used for previous FITYUGA surveys, or a new one, your choice)
2. **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Paste the entire contents of `google_apps_script_writer.js`
5. Save (Ctrl+S or Cmd+S)
6. In the function dropdown at the top, select **`setupSheet`** → click **▶ Run**
7. Authorize when prompted: **Review permissions → your Google account → Advanced → Go to [project name] (unsafe) → Allow**
8. Wait for "Execution completed", then check the Sheet, you should see a new tab called **GoalConfirmations** with formatted headers
9. **Deploy → New deployment**
   - Click the gear icon → select **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
10. Click **Deploy**, then **copy the Web App URL**. Save it somewhere, you'll need it in Part 3.

This Apps Script only writes data. It has no API keys and no AI logic. That's intentional, it keeps this part simple and hard to break.

### Part 2 — Get a Claude API key (2 minutes)

1. Go to **console.anthropic.com**
2. Sign in or create an account
3. **API Keys → Create Key**
4. Copy the key immediately (you won't be able to see it again), it starts with `sk-ant-...`
5. Save it somewhere safe temporarily, you'll paste it into Vercel in Part 4

### Part 3 — Local setup (5 minutes)

1. Unzip `fityuga-vercel.zip` on your computer
2. Open a terminal inside that folder
3. Run:
   ```
   npm install
   ```
4. Copy the environment template:
   ```
   cp .env.local.example .env.local
   ```
5. Open `.env.local` in a text editor and fill in both values:
   ```
   CLAUDE_API_KEY=sk-ant-your-actual-key
   GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_ID/exec
   ```
   (Use the URL you copied in Part 1, step 10)

### Part 4 — Test locally (optional but strongly recommended)

```
npm run dev
```

Open `http://localhost:3000` in your browser. You should land directly on the survey. Go through it end to end with one of the three goal paths. Confirm:
- The AI insight on the results screen feels genuinely specific to what you entered (not generic)
- A new row appears in your Google Sheet's GoalConfirmations tab with all your answers and the AI insight populated

If both of those work, you're ready to deploy.

### Part 5 — Deploy to Vercel

**Option A: Vercel CLI**
```
npm install -g vercel
vercel
```
Follow the prompts. Accept the default settings when asked.

**Option B: GitHub + Vercel dashboard**
1. Push the project folder to a new GitHub repository
2. Go to **vercel.com → Add New → Project**
3. Import the repository, Vercel will auto-detect it as a Next.js app, no configuration needed

Either way, you'll get a live URL like `fityuga-survey.vercel.app` or similar.

### Part 6 — Add environment variables in Vercel (critical, do not skip)

The `.env.local` file only works for local testing. Production needs the same two variables set directly in Vercel:

1. Open your project on **vercel.com**
2. **Settings → Environment Variables**
3. Add:
   - `CLAUDE_API_KEY` = your Claude key
   - `GOOGLE_SHEET_WEBHOOK_URL` = your Apps Script Web App URL
4. Save
5. Go to **Deployments**, find the latest one, click the **⋯** menu → **Redeploy**

Environment variables only take effect after a redeploy, this step is easy to miss.

### Part 7 — Final test on the live URL

Visit your live Vercel URL. Run through the survey once more, end to end. Confirm the AI insight appears and a row lands in your Sheet. Once confirmed, this is the link to share in your WhatsApp groups.

---

## 9. Design and brand notes

- Colour palette matches the rest of the FITYUGA program: navy `#1a2535`, gold `#f5c200`, light cream/white background
- Fonts: Clash Grotesk for headings, General Sans for body text (both loaded via Fontshare CDN)
- No em dashes anywhere in user-facing copy, by design
- No references to "November 30" or any specific end date, all framed as "the end of the year"
- No mention of any prior survey or "checking in again", the experience is framed as a single forward-looking commitment moment

---

## 10. Things to customise before launch

- [ ] Replace the placeholder year (2026) if needed, it currently appears in the welcome badge and a couple of confirmation messages
- [ ] If you want the prize teaser to reference something more concrete (a specific gift, an amount, an experience), edit the `getPrizeTeaser()` function in `public/survey.html`
- [ ] Double check the Claude model name in `pages/api/submit.js` (`claude-sonnet-4-6`) is still the model you want to use at the time you deploy, in case Anthropic's model lineup has changed
- [ ] Decide whether to reuse the same Google Sheet as your earlier surveys or start a fresh one, both work, the script auto-creates the tab either way
