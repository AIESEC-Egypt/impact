/**
 * IMPACT — Haweya (Dreaming history) quiz respondents → Google Sheet
 *
 * Setup:
 * 1. Create a Google Sheet and copy its ID from the URL
 * 2. Extensions → Apps Script → paste this file
 * 3. Set CONFIG.API_TOKEN and CONFIG.SPREADSHEET_ID
 * 4. Run syncHaweyaRespondents() once, or use menu IMPACT → Sync Haweya respondents
 * 5. Optional: run installDailyHaweyaSyncTrigger() for a daily 6:00 AM Cairo sync
 *
 * API: GET https://impact.aiesec.org.eg/api/exports/haweya-respondents/
 * Auth: Authorization: Bearer <QUIZ_EXPORT_API_TOKEN>
 */

const CONFIG = {
  IMPACT_BASE_URL: 'https://impact.aiesec.org.eg',
  API_TOKEN: '', // same as QUIZ_EXPORT_API_TOKEN in Coolify
  SPREADSHEET_ID: '',
  SHEET_NAME: 'Haweya respondents',
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IMPACT')
    .addItem('Sync Haweya respondents', 'syncHaweyaRespondents')
    .addItem('Install daily sync (6 AM)', 'installDailyHaweyaSyncTrigger')
    .addToUi();
}

/**
 * Fetch Haweya quiz respondents from IMPACT and rewrite the sheet tab.
 */
function syncHaweyaRespondents() {
  if (!CONFIG.API_TOKEN || !CONFIG.SPREADSHEET_ID) {
    throw new Error('Set CONFIG.API_TOKEN and CONFIG.SPREADSHEET_ID first.');
  }
  const url = CONFIG.IMPACT_BASE_URL.replace(/\/$/, '') + '/api/exports/haweya-respondents/';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + CONFIG.API_TOKEN },
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code === 401) {
    throw new Error('401 Unauthorized — check API_TOKEN matches QUIZ_EXPORT_API_TOKEN on IMPACT.');
  }
  if (code === 404) {
    throw new Error('404 — Haweya quiz not found on IMPACT. Run seed_dreaming_history_quiz on the server.');
  }
  if (code !== 200) {
    throw new Error('HTTP ' + code + ': ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());
  const rows = data.respondents || [];
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  } else {
    sheet.clear();
  }

  const headers = [
    'EXPA ID',
    'Full name',
    'Email',
    'Role',
    'Home LC',
    'Score %',
    'Passed',
    'Submitted at',
    'Attempts',
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  const body = rows.map(function (r) {
    return [
      r.expa_id || '',
      r.full_name || '',
      r.email || '',
      r.role_name || '',
      r.home_lc || '',
      r.percentage != null ? r.percentage : '',
      r.passed ? 'Yes' : 'No',
      r.submitted_at || '',
      r.attempt_count != null ? r.attempt_count : '',
    ];
  });
  if (body.length) {
    sheet.getRange(2, 1, body.length, headers.length).setValues(body);
  }

  const title = (data.exam && data.exam.title) ? data.exam.title : 'Haweya quiz';
  const exported = data.exported_at || new Date().toISOString();
  sheet.getRange(body.length + 3, 1).setValue(
    'Exam: ' + title + ' | Respondents: ' + (data.total_respondents || 0) + ' | Exported: ' + exported
  );
  SpreadsheetApp.getUi().alert('Synced ' + rows.length + ' Haweya respondent(s).');
}

function installDailyHaweyaSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncHaweyaRespondents') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncHaweyaRespondents')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  SpreadsheetApp.getUi().alert('Daily Haweya sync scheduled for 6:00 AM.');
}
