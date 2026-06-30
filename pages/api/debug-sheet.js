// pages/api/debug-sheet.js
// Temporary debug endpoint — visit /api/debug-sheet in your browser to test the sheet write.
// DELETE this file once you confirm the sheet is working.

export default async function handler(req, res) {
  const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  if (!sheetUrl) {
    return res.status(500).json({
      status: 'error',
      step: 'env_check',
      message: 'GOOGLE_SHEET_WEBHOOK_URL is not set in Vercel environment variables.',
    });
  }

  const testPayload = {
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    name: 'Debug Test',
    weight: '75 kg',
    height: '170 cm',
    activity_text: 'About once a week',
    injury: 'None',
    goal_path: 'Running',
    w_direction: '', w_target: '', w_deadline: '',
    s_pushups_text: '', s_pullups_text: '', s_focus_text: '', s_target: '',
    r_longest_text: 'About 5 km',
    r_target_text: 'Complete a 10K',
    r_event: 'Debug test event',
    commit: 'yes',
    ai_insight: JSON.stringify({ icon: '🧪', eyebrow: 'Debug test', headline: 'This is a test row', body: 'If you see this in the sheet, the webhook is working correctly.' }),
  };

  try {
    const response = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        status: 'error',
        step: 'sheet_write',
        http_status: response.status,
        response_body: responseText,
        message: 'The Apps Script endpoint returned an error.',
      });
    }

    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = responseText; }

    return res.status(200).json({
      status: 'ok',
      message: 'Test row written successfully. Check your GoalConfirmations sheet tab.',
      sheet_url_used: sheetUrl.slice(0, 60) + '...',
      sheet_response: parsed,
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      step: 'fetch',
      message: err.message,
      hint: 'This usually means the Apps Script URL is wrong or the deployment is not set to "Anyone".',
    });
  }
}
