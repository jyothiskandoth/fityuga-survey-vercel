// pages/api/submit.js
// This runs server-side on Vercel. The Claude API key never reaches the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const data = req.body;

  if (!data || !data.name) {
    return res.status(400).json({ status: 'error', message: 'Missing required fields' });
  }

  // ── 1. Generate the personalised insight via Claude ──────────────
  let insight;
  try {
    insight = await generateInsight(data);
  } catch (err) {
    console.error('Claude call failed:', err);
    insight = fallbackInsight(data.goal_path);
  }

  // ── 2. Forward the full record + insight to Google Sheets ────────
  try {
    await writeToSheet(data, insight);
  } catch (err) {
    console.error('Sheet write failed:', err);
    // Don't fail the whole request if the sheet write fails —
    // the person should still see their insight.
  }

  return res.status(200).json({ status: 'ok', insight });
}

// ── CLAUDE API CALL ──────────────────────────────────────────────
async function generateInsight(data) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not set');
  }

  const goalDescription = buildGoalDescription(data);

  const systemPrompt = `You are writing a short, exciting, evidence-flavoured personal insight for someone who just confirmed their fitness goal in a 7-month company wellness challenge called FITYUGA.

Your job: write ONE punchy, specific, motivating insight tied directly to their exact goal. Reference a real, plausible health/fitness research finding relevant to their specific goal (weight loss/gain, push-ups/pull-ups, or running distance). Make it feel personal and exciting, not generic. Use a vivid concrete number or fact (e.g. "X years of life expectancy", "X% lower risk", "X calories burned at rest").

Respond ONLY with valid JSON in this exact format, no markdown, no preamble:
{"icon":"<single relevant emoji>","eyebrow":"<3-5 word category label like 'Your health upside'>","headline":"<one punchy sentence, max 14 words>","body":"<2-3 sentences, max 75 words, exciting and specific to their exact numbers>"}`;

  const userPrompt = `Goal type: ${data.goal_path}\nDetails: ${goalDescription}\nName: ${data.name}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const content = json.content && json.content[0] && json.content[0].text;
  if (!content) throw new Error('No content in Claude response');

  const cleaned = content.replace(/```json|```/g, '').trim();
  const insight = JSON.parse(cleaned);

  if (!insight.icon || !insight.headline || !insight.body) {
    throw new Error('Malformed insight from Claude');
  }

  return insight;
}

function buildGoalDescription(data) {
  if (data.goal_path === 'Weight') {
    return `${data.w_direction}. Current weight: ${data.weight}. Target weight: ${data.w_target}. Timeline: ${data.w_deadline || 'standard 7-month program'}.`;
  }
  if (data.goal_path === 'Strength') {
    return `Focus: ${data.s_focus_text}. Current push-ups: ${data.s_pushups_text}. Current pull-ups: ${data.s_pullups_text}. Target: ${data.s_target}.`;
  }
  if (data.goal_path === 'Running') {
    return `Current longest run: ${data.r_longest_text}. Goal: ${data.r_target_text}. Event: ${data.r_event || 'no specific event'}.`;
  }
  return 'General fitness goal.';
}

function fallbackInsight(goalPath) {
  const fallbacks = {
    Weight: {
      icon: '⚡', eyebrow: 'Your health upside',
      headline: 'Every kilogram of change compounds over time',
      body: 'Sustained, gradual weight change is one of the most well-documented ways to improve long-term cardiovascular health and daily energy levels. Your 7-month timeline gives your body the time it needs to make this change stick.',
    },
    Strength: {
      icon: '💪', eyebrow: 'Your strength upside',
      headline: 'Bodyweight strength is the most functional fitness there is',
      body: 'Push-up and pull-up capacity are strongly linked to overall injury resilience and long-term joint health. Every rep you add this year is building strength that carries into everyday life, not just the gym.',
    },
    Running: {
      icon: '🏃', eyebrow: 'Your endurance upside',
      headline: 'Endurance training reshapes more than your legs',
      body: "Regular running is one of the most studied interventions for improving cardiovascular health, mood regulation, and sleep quality. Whatever distance you're building toward, the benefits start showing up well before you cross the finish line.",
    },
  };
  return fallbacks[goalPath] || {
    icon: '🎯', eyebrow: 'Your goal',
    headline: 'Every goal here moves the needle',
    body: "Consistent effort over 7 months produces real, lasting change — whatever you're working toward.",
  };
}

// ── GOOGLE SHEETS WRITE (via Apps Script endpoint) ────────────────
async function writeToSheet(data, insight) {
  const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!sheetUrl) {
    console.warn('GOOGLE_SHEET_WEBHOOK_URL not set — skipping sheet write');
    return;
  }

  const payload = { ...data, ai_insight: JSON.stringify(insight) };

  const response = await fetch(sheetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sheet webhook error ${response.status}: ${errText}`);
  }
}
