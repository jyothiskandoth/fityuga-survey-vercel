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

  const systemPrompt = `You are writing a personalised insight card for someone who just confirmed their fitness goal in FITYUGA, a 7-month company wellness challenge at SCM YUGA Technologies.

Write ONE punchy, evidence-flavoured insight tied directly to their exact numbers. Reference a real, plausible health/fitness research finding specific to their goal type (weight loss/gain, push-up/pull-up strength, or running endurance). Make it feel personal and exciting, not generic. Include their specific numbers in the headline.

Respond ONLY with valid JSON in this exact format, no markdown, no preamble:
{"icon":"<single relevant emoji>","eyebrow":"<3-5 word category label>","headline":"<one punchy sentence max 14 words, reference their specific numbers>","body":"<2-3 sentences max 75 words, specific to their exact goal and numbers>","key_stat":{"value":"<striking number e.g. '58%' or '2.4x' or '11 yrs'>","label":"<what that number means, max 7 words>"},"fun_fact":"<one sentence, a surprising population benchmark or comparison relevant to their goal — e.g. 'Only 1% of people ever complete a half marathon — you are about to join them.'>"}`;


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
      headline: 'Every kilogram lost is a step toward a longer life',
      body: 'Losing even 5-10% of body weight slashes type 2 diabetes risk by up to 58%. Your 7-month timeline gives your body exactly the time it needs to make this change permanent, not just a blip on the scale.',
      key_stat: { value: '58%', label: 'lower type 2 diabetes risk' },
      fun_fact: 'People who set a specific weight target are 42% more likely to achieve their goal than those with only a vague intention.',
    },
    Strength: {
      icon: '💪', eyebrow: 'Your strength upside',
      headline: 'Bodyweight strength predicts how long you will live well',
      body: 'Men who can do 40+ push-ups have a 96% lower risk of cardiovascular events than those who can do fewer than 10. Every rep you add this year is building strength that carries into everyday life, not just the gym.',
      key_stat: { value: '96%', label: 'lower cardiovascular risk at 40+ push-ups' },
      fun_fact: 'Fewer than 5% of adults can perform 20 or more consecutive pull-ups — you are building toward a genuinely elite tier of bodyweight strength.',
    },
    Running: {
      icon: '🏃', eyebrow: 'Your endurance upside',
      headline: 'Running reshapes your heart, brain, and sleep all at once',
      body: 'Running as little as 5-10 minutes a day is linked to a 45% lower risk of cardiovascular death. Whatever distance you are building toward, the benefits start showing up in your energy and sleep well before race day.',
      key_stat: { value: '45%', label: 'lower cardiovascular mortality risk' },
      fun_fact: 'Only about 1% of the world population has ever completed a half marathon — finishing one puts you in a genuinely elite group.',
    },
  };
  return fallbacks[goalPath] || {
    icon: '🎯', eyebrow: 'Your goal',
    headline: 'Every goal here moves the needle',
    body: "Consistent effort over 7 months produces real, lasting change — whatever you're working toward.",
    key_stat: { value: '3x', label: 'more likely to succeed in a group challenge' },
    fun_fact: 'People who join a structured group challenge are 3x more likely to hit their fitness goal than those going it alone.',
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
