/**
 * IMPACT — Howya (Dreaming history) quiz respondents → Google Sheet
 *
 * SETUP:
 * 1. Open your target Google Sheet → Extensions → Apps Script
 * 2. Paste this file, set CONFIG below
 * 3. In Coolify, set QUIZ_EXPORT_API_TOKEN to the same value as API_TOKEN
 * 4. Run syncHowyaRespondents() once, or use menu IMPACT → Sync Howya respondents
 * 5. Optional: run installDailyHowyaSyncTrigger() for a daily 6:00 AM Cairo sync
 *
 * API: GET https://impact.aiesec.org.eg/api/exports/howya-respondents/
 * Auth: Authorization: Bearer <API_TOKEN>  (or ?token= in URL)
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  IMPACT_BASE_URL: 'https://impact.aiesec.org.eg',
  API_TOKEN: 'YOUR_QUIZ_EXPORT_API_TOKEN_HERE',
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  SHEET_NAME: 'Howya respondents',
};

const HEADERS = [
  'EXPA ID',
  'Full name',
  'Email',
  'Best %',
  'Passed',
  'Last submitted',
  'Attempt count',
  'Role',
  'Home LC',
  'Exported at',
];

// ==================== MENU ====================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IMPACT')
    .addItem('Sync Howya respondents', 'syncHowyaRespondents')
    .addItem('Install daily sync (6 AM)', 'installDailyHowyaSyncTrigger')
    .addToUi();
}

// ==================== SYNC ====================

/**
 * Fetch Howya quiz respondents from IMPACT and rewrite the sheet tab.
 */
function syncHowyaRespondents() {
  const sheet = getOrCreateSheet_(CONFIG.SHEET_NAME);
  const url = CONFIG.IMPACT_BASE_URL.replace(/\/$/, '') + '/api/exports/howya-respondents/';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + CONFIG.API_TOKEN,
      Accept: 'application/json',
    },
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code === 401) {
    throw new Error('401 Unauthorized — check API_TOKEN matches QUIZ_EXPORT_API_TOKEN in Coolify.');
  }
  if (code === 404) {
    throw new Error('404 — Howya quiz not found on IMPACT. Run seed_dreaming_history_quiz on the server.');
  }
  if (code !== 200) {
    throw new Error('HTTP ' + code + ': ' + body.substring(0, 500));
  }

  const data = JSON.parse(body);
  const exportedAt = data.exported_at || new Date().toISOString();
  const rows = (data.respondents || []).map(function (r) {
    return [
      r.expa_id || '',
      r.full_name || '',
      r.email || '',
      r.percentage != null ? r.percentage : '',
      r.passed ? 'Yes' : 'No',
      r.submitted_at || '',
      r.attempt_count != null ? r.attempt_count : '',
      r.role_name || '',
      r.home_lc || '',
      exportedAt,
    ];
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }

  sheet.autoResizeColumns(1, HEADERS.length);

  const title = (data.exam && data.exam.title) ? data.exam.title : 'Howya quiz';
  SpreadsheetApp.getActiveSpreadsheet().toast(
    rows.length + ' respondent(s) from “' + title + '”.',
    'IMPACT sync done',
    5
  );

  return { count: rows.length, exam: data.exam };
}

/**
 * Daily trigger at 6:00 AM (spreadsheet timezone).
 */
function installDailyHowyaSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncHowyaRespondents') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncHowyaRespondents')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  SpreadsheetApp.getUi().alert('Daily Howya sync scheduled for 6:00 AM.');
}

// ==================== HELPERS ====================

function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
