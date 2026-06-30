// ════════════════════════════════════════════════════════════════
//  FITYUGA — Goal Confirmation Sheet Writer (Vercel architecture)
//  This is now a DUMB endpoint — it just writes rows.
//  All AI logic lives in Vercel. No API keys live here.
//
//  Setup:
//  1. Open Google Sheet → Extensions → Apps Script
//  2. Paste this entire file (replace existing code)
//  3. Run setupSheet() once
//  4. Deploy → New deployment → Web app → Anyone → Deploy
//  5. Copy the Web App URL → put it in Vercel as GOOGLE_SHEET_WEBHOOK_URL
// ════════════════════════════════════════════════════════════════

const SHEET_NAME = 'GoalConfirmations';

const HEADERS = [
  'Timestamp', 'Name',
  'Current Weight', 'Height', 'Activity Level', 'Injury / Limitation',
  'Goal Path',
  'Weight: Direction', 'Weight: Target', 'Weight: Deadline',
  'Strength: Push-ups', 'Strength: Pull-ups', 'Strength: Focus', 'Strength: Target',
  'Running: Longest Run', 'Running: Goal', 'Running: Event',
  'Committed to Challenge', 'AI Insight'
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    const hr = sheet.getRange(1, 1, 1, HEADERS.length);
    hr.setBackground('#1a2535');
    hr.setFontColor('#F5C200');
    hr.setFontWeight('bold');
    hr.setFontSize(11);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 120);
    for (let i = 3; i <= 18; i++) sheet.setColumnWidth(i, 160);
    sheet.setColumnWidth(19, 320);
  }
  return sheet;
}

function writeRow(sheet, data) {
  const row = [
    data.timestamp || new Date().toLocaleString('en-IN'),
    data.name || '',
    data.weight || '',
    data.height || '',
    data.activity_text || '',
    data.injury || '',
    data.goal_path || '',
    data.w_direction || '',
    data.w_target || '',
    data.w_deadline || '',
    data.s_pushups_text || '',
    data.s_pullups_text || '',
    data.s_focus_text || '',
    data.s_target || '',
    data.r_longest_text || '',
    data.r_target_text || '',
    data.r_event || '',
    data.commit === 'yes' ? 'Yes' : 'No',
    data.ai_insight || '',
  ];
  sheet.appendRow(row);

  const newRowNum = sheet.getLastRow();
  const pathCell = sheet.getRange(newRowNum, 7);
  const pathColors = {
    'Weight':   { bg: '#FAEEDA', font: '#78350f' },
    'Strength': { bg: '#E6F1FB', font: '#1e3a5f' },
    'Running':  { bg: '#E1F5EE', font: '#14532d' },
  };
  const pc = pathColors[data.goal_path];
  if (pc) { pathCell.setBackground(pc.bg); pathCell.setFontColor(pc.font); pathCell.setFontWeight('bold'); }

  const commitCell = sheet.getRange(newRowNum, 18);
  if (data.commit === 'yes') { commitCell.setBackground('#dcfce7'); commitCell.setFontColor('#14532d'); }
  else { commitCell.setBackground('#fee2e2'); commitCell.setFontColor('#991b1b'); }
  commitCell.setFontWeight('bold');
}

// Vercel calls this with a normal POST + JSON body — no JSONP needed
// since this call happens server-to-server, not browser-to-server.
function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    let data = null;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    if (!data || !data.name) throw new Error('No valid data received');
    writeRow(sheet, data);
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('FITYUGA Sheet writer is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function setupSheet() {
  getOrCreateSheet();
  SpreadsheetApp.getUi().alert('Sheet ready.');
}
