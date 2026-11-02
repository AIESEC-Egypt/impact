/**
 * "iGV B2B with references" sheet - scripts updated for up to 50 iGV roles per contract.
 * Replaces the old "query row from rows adjusted.gs" (hardWriteRawAdjusted) and the
 * constants in "Splits.gs". Run igv_setup() once after the master sheet has the new columns.
 *
 * Pipeline:  Raw (IMPORTRANGE from master) -> Raw adjusted (hardWriteRawAdjusted)
 *            -> iGV (QUERY) -> iGV Split (splitIGVSlotsToRows_QUERY_SAFE)
 *            -> iGV Split headers unified (rebuildUnified_AllRows_BKtoAS, unchanged)
 */
const IGV_MASTER_ID = '1xcVsxO-7PYCtjoo6clI5m7RB9nA2RKDICxnT9jbk1UM'; // master "[New] B2B Contract System"
const IGV_ROLES = 50;
const IGV_CONST_COLS = 20;   // A:T
const IGV_BLOCK = 42;        // master iGV block width
const IGV_ADJ_BLOCK = IGV_BLOCK + 1; // + per-role reference code column
const IGV_ADJ_REF_COL = IGV_CONST_COLS + IGV_ROLES * IGV_ADJ_BLOCK + 1; // final "Reference Code"

function igvPos_(role) { return role <= 15 ? role : role + 10; }

/** One-time setup: headers, IMPORTRANGE range, QUERY range, grid sizes. */
function igv_setup() {
  const ss = SpreadsheetApp.getActive();
  const master = SpreadsheetApp.openById(IGV_MASTER_ID).getSheetByName('B2B Contracts');
  const mHeaders = master.getRange(1, 1, 1, master.getLastColumn()).getValues()[0];

  // Raw
  const raw = ss.getSheetByName('Raw');
  ensureCols_(raw, mHeaders.length);
  raw.getRange(1, 1, 1, mHeaders.length).setValues([mHeaders]);
  raw.getRange('A2').setFormula(`=IMPORTRANGE("${IGV_MASTER_ID}","'B2B Contracts'!A2:${colLetter_(mHeaders.length)}")`);

  // Raw adjusted (shrink rows: it used to have ~11k rows, which eats the 10M cell limit)
  const adj = ss.getSheetByName('Raw adjusted');
  if (adj.getMaxRows() > 1000) adj.deleteRows(1001, adj.getMaxRows() - 1000);
  ensureCols_(adj, IGV_ADJ_REF_COL);
  adj.getRange(1, 1, 1, IGV_ADJ_REF_COL).setValues([adjustedHeaders_(mHeaders)]);

  // iGV (QUERY on package name, regex so new packages need no edits)
  const igv = ss.getSheetByName('iGV');
  ensureCols_(igv, IGV_ADJ_REF_COL);
  igv.getRange(1, 1, 1, IGV_ADJ_REF_COL).setValues([adjustedHeaders_(mHeaders)]);
  igv.getRange('A2').setFormula(
    `=QUERY('Raw adjusted'!A2:${colLetter_(IGV_ADJ_REF_COL)}, ` +
    `"select * where F matches '^iGV [0-9]+\\+[0-9]+.*' or F matches '^[0-9]+ iGV \\+ [0-9]+ iGT[ae].*'", 0)`);
  Logger.log('iGV sheet set up. Raw adjusted/iGV width: ' + IGV_ADJ_REF_COL);
}

function adjustedHeaders_(mHeaders) {
  const out = mHeaders.slice(0, IGV_CONST_COLS);
  for (let r = 1; r <= IGV_ROLES; r++) {
    const p = igvPos_(r);
    const start = mHeaders.indexOf(`${p}. Opportunity Role Title`);
    const block = start >= 0 ? mHeaders.slice(start, start + IGV_BLOCK) : new Array(IGV_BLOCK).fill('');
    // present every block with its role number so the split sees uniform headers
    block.forEach(h => out.push(String(h).replace(/^\d+\.\s/, `${r}. `)));
    out.push(`${r}. Reference Code`);
  }
  out.push('Reference Code');
  return out;
}

/** Copies Raw -> Raw adjusted: constant columns, 50 role blocks (+ref code formula each), final ref code. */
function hardWriteRawAdjusted() {
  const ss = SpreadsheetApp.getActive();
  const source = ss.getSheetByName('Raw');
  const target = ss.getSheetByName('Raw adjusted');
  const lastRow = source.getLastRow();
  if (lastRow < 2) { Logger.log('No data to copy.'); return; }
  const numRows = lastRow - 1;
  const lastCol = source.getLastColumn();
  const headers = source.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = source.getRange(2, 1, numRows, lastCol).getValues();
  const refSrc = headers.indexOf('Reference Code');
  if (refSrc < 0) throw new Error('"Reference Code" header not found in Raw.');
  const starts = [];
  for (let r = 1; r <= IGV_ROLES; r++) starts.push(headers.indexOf(`${igvPos_(r)}. Opportunity Role Title`));

  const refLetter = colLetter_(IGV_ADJ_REF_COL);
  const out = data.map((row, i) => {
    const o = row.slice(0, IGV_CONST_COLS);
    const ref = String(row[refSrc] || '').trim();
    starts.forEach((s, k) => {
      for (let c = 0; c < IGV_BLOCK; c++) o.push(s >= 0 ? row[s + c] : '');
      o.push(ref ? `=CONCATENATE($${refLetter}${i + 2},"_${k + 1}")` : '');
    });
    o.push(row[refSrc]);
    return o;
  });

  if (target.getMaxRows() < lastRow) target.insertRowsAfter(target.getMaxRows(), lastRow - target.getMaxRows());
  ensureCols_(target, IGV_ADJ_REF_COL);
  target.getRange(2, 1, Math.max(target.getMaxRows() - 1, 1), IGV_ADJ_REF_COL).clearContent();
  target.getRange(2, 1, numRows, IGV_ADJ_REF_COL).setValues(out); // formulas strings starting with "=" are evaluated
  Logger.log(`Raw adjusted rebuilt: ${numRows} rows x ${IGV_ADJ_REF_COL} cols.`);
}

function ensureCols_(sheet, n) {
  const need = n - sheet.getMaxColumns();
  if (need > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), need);
}
function colLetter_(c) {
  let s = '';
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

/** Runs the whole iGV pipeline in order. */
function igv_runAll() {
  hardWriteRawAdjusted();
  splitIGVSlotsToRows_QUERY_SAFE();
  rebuildUnified_AllRows_BKtoAS();
}
