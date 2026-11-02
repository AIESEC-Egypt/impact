/**
 * "iGT B2B with references" sheet - setup for up to 16 iGT roles per contract.
 * Run igt_setup() once after the master sheet has the new columns. It rewrites the
 * Raw adjusted formulas (one QUERY per role block + a per-role reference code), widens
 * the iGT QUERY, and the split constants in Splits.gs must be MAX_BLOCKS = 16 with
 * EXTRA_TAIL_COLS pointing at the new tail (see IGT_TAIL_* below).
 *
 * Raw adjusted layout:  A:S constants | 16 x (26 data cols + "<ref>_<pos>") | Email Sent? | Reference Code
 */
const IGT_MASTER_ID = '1xcVsxO-7PYCtjoo6clI5m7RB9nA2RKDICxnT9jbk1UM';
const IGT_ROLES = 16;
const IGT_BLOCK = 26;
const IGT_ADJ_BLOCK = 27;
const IGT_FIRST = 20; // column T
const IGT_TAIL_EMAIL = IGT_FIRST + IGT_ROLES * IGT_ADJ_BLOCK;     // 452
const IGT_TAIL_REF = IGT_TAIL_EMAIL + 1;                          // 453

function igtPos_(role) { return role <= 10 ? role + 15 : role + 50; }

function igt_setup() {
  const ss = SpreadsheetApp.getActive();
  const master = SpreadsheetApp.openById(IGT_MASTER_ID).getSheetByName('B2B Contracts');
  const mHeaders = master.getRange(1, 1, 1, master.getLastColumn()).getValues()[0];
  const col = h => { const i = mHeaders.indexOf(h); if (i < 0) throw new Error('Master header missing: ' + h); return i + 1; };

  const raw = ss.getSheetByName('Raw');
  ensureColsT_(raw, mHeaders.length);
  raw.getRange(1, 1, 1, mHeaders.length).setValues([mHeaders]);
  raw.getRange('A2').setFormula(`=IMPORTRANGE("${IGT_MASTER_ID}","'B2B Contracts'!A2:${colLetterT_(mHeaders.length)}")`);

  const adj = ss.getSheetByName('Raw adjusted');
  ensureColsT_(adj, IGT_TAIL_REF + 1);
  adj.getRange(2, 1, 1, adj.getMaxColumns()).clearContent();
  const headers = mHeaders.slice(0, 19);
  adj.getRange('A2').setFormula('=QUERY(Raw!A2:S)');
  const refLetter = colLetterT_(IGT_TAIL_REF);
  for (let r = 1; r <= IGT_ROLES; r++) {
    const p = igtPos_(r);
    const s = col(`${p}. Opportunity Role Title`);
    const c = IGT_FIRST + (r - 1) * IGT_ADJ_BLOCK;
    adj.getRange(2, c).setFormula(`=QUERY(Raw!${colLetterT_(s)}2:${colLetterT_(s + IGT_BLOCK - 1)})`);
    adj.getRange(2, c + IGT_BLOCK).setFormula(
      `=ARRAYFORMULA(IF(${refLetter}2:${refLetter}="","",${refLetter}2:${refLetter}&"_${p}"))`);
    mHeaders.slice(s - 1, s - 1 + IGT_BLOCK).forEach(h => headers.push(String(h).replace(/^\d+\.\s/, `${16}. `)));
    headers.push(`16. Reference Code`);
  }
  const email = col('Email Sent?'), ref = col('Reference Code');
  adj.getRange(2, IGT_TAIL_EMAIL).setFormula(`=QUERY(Raw!${colLetterT_(email)}2:${colLetterT_(ref)})`);
  headers.push('Email Sent?', 'Reference Code', '');
  adj.getRange(1, 1, 1, headers.length).setValues([headers]);

  const igt = ss.getSheetByName('iGT');
  ensureColsT_(igt, headers.length);
  igt.getRange(1, 1, 1, headers.length).setValues([headers]);
  igt.getRange('A2').setFormula(
    `=QUERY('Raw adjusted'!A2:${colLetterT_(headers.length)}, ` +
    `"select * where F matches '^[iI]GT[ae] .*[0-9]+\\+[0-9]+$' or F matches '^[0-9]+ iGV \\+ [0-9]+ iGT[ae].*'", 0)`);
  Logger.log(`iGT sheet set up. Tail: Email ${colLetterT_(IGT_TAIL_EMAIL)}, Ref ${colLetterT_(IGT_TAIL_REF)}`);
}

function ensureColsT_(sheet, n) {
  const need = n - sheet.getMaxColumns();
  if (need > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), need);
}
function colLetterT_(c) {
  let s = '';
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

function igt_runAll() {
  splitIGTSlotsToRows_QUERY_SAFE();
  map_iGT_Split_to_Unified_AAM_ANAS_AT();
}
