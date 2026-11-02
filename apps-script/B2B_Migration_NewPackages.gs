/**
 * B2B contract system - migration for the Nov 2026 package update.
 * Add this file to the "B2B Contracts Handler" project (bound to the master
 * "[New] B2B Contract System" sheet) and run, in order:
 *   1. mig_addHeaders()        - appends columns for iGV roles 16-50 (positions 26-60)
 *                                 and iGT roles 11-16 (positions 61-66)
 *   2. mig_addReferenceTags()  - adds the missing {{tag}} rows to Reference and fixes
 *                                 the swapped Contact Email / Contact Position tags
 *   3. mig_buildTemplates()    - run repeatedly until it logs "ALL TEMPLATES DONE";
 *                                 builds one contract template per new package and
 *                                 registers it in Reference (columns A:B)
 * Every step is idempotent (safe to re-run).
 *
 * Position layout (see igvPosition_ / igtPosition_ in the main script):
 *   iGV roles 1-15 -> 1-15, 16-50 -> 26-60;  iGT roles 1-10 -> 16-25, 11-16 -> 61-66
 */

const MIG_SHEET = 'B2B Contracts';
const MIG_REF = 'Reference';
const MIG_TEMPLATE_FOLDER_ID = ''; // optional: folder for new templates (defaults to the base template's folder)

const MIG_PACKAGES = [
  // name, base package (existing Reference row), iGV roles, iGT roles, unit price, paid, free
  ['iGV 6+1 - (Accommodation Not Covered)', 'iGV 7+2 - (Accommodation Not Covered)', 7, 0, 1950, 6, 1],
  ['iGV 10+3 - (Accommodation Not Covered)', 'iGV 7+2 - (Accommodation Not Covered)', 13, 0, 1950, 10, 3],
  ['iGV 15+5 - (Accommodation Not Covered)', 'iGV 7+2 - (Accommodation Not Covered)', 20, 0, 1950, 15, 5],
  ['iGV 20+10 - (Accommodation Not Covered)', 'iGV 7+2 - (Accommodation Not Covered)', 30, 0, 1950, 20, 10],
  ['iGV 6+1 - (Accommodation Not Covered - 4 Weeks)', 'iGV 7+2 - (Accommodation Not Covered)', 7, 0, 1550, 6, 1],
  ['iGV 10+3 - (Accommodation Not Covered - 4 Weeks)', 'iGV 7+2 - (Accommodation Not Covered)', 13, 0, 1550, 10, 3],
  ['iGV 15+5 - (Accommodation Not Covered - 4 Weeks)', 'iGV 7+2 - (Accommodation Not Covered)', 20, 0, 1550, 15, 5],
  ['iGV 20+10 - (Accommodation Not Covered - 4 Weeks)', 'iGV 7+2 - (Accommodation Not Covered)', 30, 0, 1550, 20, 10],
  ['iGV 7+3 - (Accommodation Covered)', 'iGV 10+5 - (Accommodation Covered)', 10, 0, 650, 7, 3],
  ['iGV 13+7 - (Accommodation Covered)', 'iGV 10+5 - (Accommodation Covered)', 20, 0, 650, 13, 7],
  ['iGV 20+12 - (Accommodation Covered)', 'iGV 10+5 - (Accommodation Covered)', 32, 0, 650, 20, 12],
  ['iGV 30+20 - (Accommodation Covered)', 'iGV 10+5 - (Accommodation Covered)', 50, 0, 650, 30, 20],
  ['iGTa 3+1', 'IGTa 7+3', 0, 4, 1650, 3, 1],
  ['iGTa 6+3', 'IGTa 7+3', 0, 9, 1650, 6, 3],
  ['iGTa 10+6', 'IGTa 7+3', 0, 16, 1650, 10, 6],
  ['iGTe Schools 3+1', 'iGTe Schools 7+3', 0, 4, 1650, 3, 1],
  ['iGTe Schools 6+3', 'iGTe Schools 7+3', 0, 9, 1650, 6, 3],
  ['iGTe Schools 10+6', 'iGTe Schools 7+3', 0, 16, 1650, 10, 6],
  ['iGTe Nurseries 3+1', 'iGTe Nurseries 7+3', 0, 4, 1650, 3, 1],
  ['iGTe Nurseries 6+3', 'iGTe Nurseries 7+3', 0, 9, 1650, 6, 3],
  ['iGTe Nurseries 10+6', 'iGTe Nurseries 7+3', 0, 16, 1650, 10, 6],
  // existing mixed packages get a new template at the new price (Reference row is repointed)
  ['3 iGV + 1 iGTa', '3 iGV + 1 iGTa', 3, 1, 1950, 3, 1],
  ['3 iGV + 1 iGTe', '3 iGV + 1 iGTe', 3, 1, 1950, 3, 1],
  ['6 iGV + 3 iGTa', '3 iGV + 1 iGTa', 6, 3, 1950, 6, 3],
  ['6 iGV + 3 iGTe', '3 iGV + 1 iGTe', 6, 3, 1950, 6, 3],
];

/* ------------------------------------------------------------------ */
/* 1. Headers                                                          */
/* ------------------------------------------------------------------ */
function mig_addHeaders() {
  const sh = SpreadsheetApp.getActive().getSheetByName(MIG_SHEET);
  const lastCol = sh.getLastColumn();
  const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (hdr.indexOf('26. Opportunity Role Title') !== -1) { Logger.log('Headers already added.'); return; }

  const igvProto = hdr.filter(h => /^2\. /.test(h)).map(h => h.replace(/^2\. /, ''));
  const igtProto = hdr.filter(h => /^16\. /.test(h)).map(h => h.replace(/^16\. /, ''));
  if (igvProto.length !== 42 || igtProto.length !== 26) {
    throw new Error(`Unexpected block widths: iGV ${igvProto.length} (want 42), iGT ${igtProto.length} (want 26)`);
  }
  const add = [];
  for (let p = 26; p <= 60; p++) igvProto.forEach(h => add.push(`${p}. ${h}`));
  for (let p = 61; p <= 66; p++) igtProto.forEach(h => add.push(`${p}. ${h}`));

  const need = lastCol + add.length - sh.getMaxColumns();
  if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
  sh.getRange(1, lastCol + 1, 1, add.length).setValues([add]);
  Logger.log(`Added ${add.length} columns (${columnLetter_(lastCol + 1)}:${columnLetter_(lastCol + add.length)}).`);
}

/* ------------------------------------------------------------------ */
/* 2. Reference tags                                                   */
/* ------------------------------------------------------------------ */
const MIG_IGT_TAGS = [ // header suffix -> tag pattern (P = position)
  ['Opportunity Role Title', '{{P_opp_title_iGT}}'], ['Field(s) of Work', '{{P_field_work}}'],
  ['Job Description – Main Activities', '{{P_main_activities}}'],
  ['1st Required Skill', '{{skill_P_1}}'], ['2nd Required Skill', '{{skill_P_2}}'], ['3rd Required Skill', '{{skill_P_3}}'],
  ['1st Required Background', '{{background_P_1}}'], ['2nd Required Background', '{{background_P_2}}'], ['3rd Required Background', '{{background_P_3}}'],
  ['1st Required Language', '{{language_P_1}}'], ['2nd Required Language', '{{language_P_2}}'], ['3rd Required Language', '{{language_P_3}}'],
  ['1st Required Requirement', '{{requirement_P_1}}'], ['2nd Required Requirement', '{{requirement_P_2}}'], ['3rd Required Requirement', '{{requirement_P_3}}'],
  ['Opportunity Duration', '{{P_duration}}'],
  ['Slot 1 - Start Date', '{{P_1_sd}}'], ['Slot 1 - Number of Openings', '{{P_1_open}}'],
  ['Slot 2 - Start Date', '{{P_2_sd}}'], ['Slot 2 - Number of Openings', '{{P_2_open}}'],
  ['Working Hours', '{{P_working_hours}}'], ['Weekend Days', '{{P_weekend_days}}'], ['Salary (If any)', '{{P_salary}}'],
  ['Accommodation', '{{P_acc}}'], ['Transportation', '{{P_trans}}'], ['Meals provided (Specify if any)', '{{P_meals}}'],
];
const MIG_GENERAL_TAGS = [
  ['Industry', '{{industry}}'],
  ['Number of Opportunities required with this contract', '{{number_opps}}'],
  ['AIESECer Name', '{{lc_representative_name}}'],
  ['AIESECer Email', '{{lc_representative_email}}'],
  ['Reference Code', '{{reference_code}}'],
];

function mig_addReferenceTags() {
  const ref = SpreadsheetApp.getActive().getSheetByName(MIG_REF);
  const last = ref.getLastRow();
  const rows = ref.getRange(2, 4, last - 1, 3).getValues(); // D:F = Type, Header, Tag
  const existing = new Set(rows.map(r => _normHeader_(r[1])).filter(Boolean));

  // Fix swapped contact tags
  rows.forEach((r, i) => {
    const h = String(r[1]).trim();
    if (h === 'Contact Email' && r[2] !== '{{contact_person_email}}') ref.getRange(i + 2, 6).setValue('{{contact_person_email}}');
    if (h === 'Contact Position' && r[2] !== '{{contact_person_position}}') ref.getRange(i + 2, 6).setValue('{{contact_person_position}}');
  });

  // iGV prototype = block 2 rows
  const igvProto = rows.filter(r => /^2\. /.test(String(r[1])))
    .map(r => [String(r[1]).replace(/^2\. /, ''), String(r[2])]);
  if (igvProto.length < 30) throw new Error('Could not read the iGV block-2 prototype rows from Reference.');

  const add = [];
  const push = (header, tag) => {
    if (existing.has(_normHeader_(header))) return;
    existing.add(_normHeader_(header));
    add.push(['IGV', header, tag]);
  };
  MIG_GENERAL_TAGS.forEach(([h, t]) => push(h, t));
  const igvPositions = [];
  for (let r = 1; r <= MAX_IGV_ROLES; r++) igvPositions.push(igvPosition_(r));
  igvPositions.forEach(p => igvProto.forEach(([h, t]) => push(`${p}. ${h}`, t.replace(/\{\{2_/g, `{{${p}_`))));
  for (let r = 1; r <= MAX_IGT_ROLES; r++) {
    const p = igtPosition_(r);
    MIG_IGT_TAGS.forEach(([h, t]) => push(`${p}. ${h}`, t.replace(/P/g, String(p))));
  }
  if (!add.length) { Logger.log('Reference already complete.'); return; }
  ref.getRange(last + 1, 4, add.length, 3).setValues(add);
  Logger.log(`Added ${add.length} Reference tag rows.`);
}

/* ------------------------------------------------------------------ */
/* 3. Templates                                                        */
/* ------------------------------------------------------------------ */
function mig_buildTemplates() {
  const start = Date.now();
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty('MIG_TEMPLATES_DONE') || '{}');
  for (const pkg of MIG_PACKAGES) {
    const name = pkg[0];
    if (done[name]) continue;
    if (Date.now() - start > 4 * 60 * 1000) { Logger.log('Time budget used - run mig_buildTemplates() again.'); return; }
    const id = buildTemplate_(pkg);
    setReferenceTemplate_(name, id);
    done[name] = id;
    props.setProperty('MIG_TEMPLATES_DONE', JSON.stringify(done));
    Logger.log(`✅ ${name} -> ${id}`);
  }
  Logger.log('ALL TEMPLATES DONE');
}

function mig_resetTemplateProgress() { PropertiesService.getScriptProperties().deleteProperty('MIG_TEMPLATES_DONE'); }

function buildTemplate_(pkg) {
  const [name, baseName, igvRoles, igtRoles, unit, paid, free] = pkg;
  const baseId = referenceTemplateId_(baseName);
  if (!baseId) throw new Error(`Base template not found in Reference: ${baseName}`);
  const baseFile = DriveApp.getFileById(baseId);
  const folder = MIG_TEMPLATE_FOLDER_ID ? DriveApp.getFolderById(MIG_TEMPLATE_FOLDER_ID) : baseFile.getParents().next();
  const copy = baseFile.makeCopy(`${name} - Template`, folder);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  // Locate role sections. A section starts at "Part II.<roman>: Opportunity Information"
  // (iGV style) or "<n>st/nd/rd/th Opportunity:" (iGT style) and ends at its
  // "{{reference_code}}_<n>" line.
  const n = body.getNumChildren();
  const starts = [], ends = [];
  for (let i = 0; i < n; i++) {
    const t = elText_(body.getChild(i));
    if (SECTION_START_RE_.test(t)) starts.push(i);
    if (/\{\{reference_code\}\}_\d+/.test(t) && starts.length > ends.length) ends.push(i);
  }
  if (!starts.length || starts.length !== ends.length) {
    throw new Error(`${name}: could not find role sections in base template (starts ${starts.length}, ends ${ends.length}).`);
  }

  // Pick prototypes (first iGV-style and first iGT-style section); include the gap up to the next section
  let igvProto = null, igtProto = null;
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s], to = (s + 1 < starts.length) ? starts[s + 1] - 1 : ends[s];
    const els = [];
    let text = '';
    for (let i = from; i <= to; i++) { els.push(body.getChild(i).copy()); text += elText_(body.getChild(i)) + '\n'; }
    const igtM = text.match(/\{\{(\d+)_opp_title_iGT\}\}/);
    const igvM = text.match(/\{\{(\d+)_opp_title\}\}/);
    const refM = text.match(/\{\{reference_code\}\}_(\d+)/);
    const proto = { els, refSuffix: refM ? refM[1] : null };
    if (igtM && !igtProto) igtProto = Object.assign(proto, { pos: igtM[1] });
    else if (igvM && !igvProto) igvProto = Object.assign(proto, { pos: igvM[1] });
  }
  if (igvRoles && !igvProto) throw new Error(`${name}: base has no iGV section to copy.`);
  if (igtRoles && !igtProto) throw new Error(`${name}: base has no iGT section to copy.`);

  // Remove existing sections
  for (let i = ends[ends.length - 1]; i >= starts[0]; i--) body.removeChild(body.getChild(i));

  // Insert generated sections
  let at = starts[0];
  let sectionNo = 0;
  const emit = (proto, kind, role) => {
    sectionNo++;
    const pos = kind === 'igv' ? igvPosition_(role) : igtPosition_(role);
    const refSuffix = kind === 'igv' ? role : pos;
    for (const src of proto.els) {
      const el = src.copy();
      replaceIn_(el, `\\{\\{${proto.pos}_`, `{{${pos}_`);
      if (kind === 'igt') replaceIn_(el, `_${proto.pos}_`, `_${pos}_`);
      if (proto.refSuffix) replaceIn_(el, `\\{\\{reference_code\\}\\}_${proto.refSuffix}`, `{{reference_code}}_${refSuffix}`);
      replaceIn_(el, 'Part II\\.[IVXL]+:', `Part II.${roman_(sectionNo)}:`);
      if (/^\s*\d+\s*(st|nd|rd|th)\s+Opportunity\s*:/i.test(elText_(el))) replaceIn_(el, '^\\s*\\d+\\s*(st|nd|rd|th)', ordinal_(role));
      if (kind === 'igt' && igtRoles > 1 && /^\s*iGT Opportunity(\s+\d+)?\s*:/i.test(elText_(el))) replaceIn_(el, 'iGT Opportunity(\\s+\\d+)?\\s*:', `iGT Opportunity ${role}:`);
      at = insertElement_(body, at, el);
    }
  };
  for (let r = 1; r <= igvRoles; r++) emit(igvProto, 'igv', r);
  for (let r = 1; r <= igtRoles; r++) emit(igtProto, 'igt', r);

  // Price sentence
  updateFeeSentence_(body, name, unit, paid, free);
  doc.saveAndClose();
  return copy.getId();
}

function updateFeeSentence_(body, name, unit, paid, free) {
  const total = unit * paid;
  const found = body.findText('The contract fee.*?total of\\s*[0-9,]+\\s*(EGP|Egyptian Pounds|LE)');
  if (!found) throw new Error(`${name}: fee sentence not found in template.`);
  const text = found.getElement().asText();
  const s = found.getStartOffset(), e = found.getEndOffsetInclusive();
  const before = text.getText().substring(s, e + 1);
  let after = before
    .replace(/is\s+[0-9,]+/, `is ${unit}`)
    .replace(/(EGP|Egyptian Pounds|LE)\s*\+\s*\d+\s*Free/, `$1 for ${paid} + ${free} Free`)
    .replace(/\d+\s*\+\s*\d+\s*Free/, `${paid} + ${free} Free`)
    .replace(/total of\s*[0-9,]+/, `total of ${total}`)
    .replace(/Free iGT slot\b(?!s)/, free > 1 ? 'Free iGT slots' : 'Free iGT slot');
  text.deleteText(s, e);
  text.insertText(s, after);
  Logger.log(`${name} fee: "${before}" -> "${after}"`);
}

function setReferenceTemplate_(name, docId) {
  const ref = SpreadsheetApp.getActive().getSheetByName(MIG_REF);
  const colA = ref.getRange(1, 1, ref.getLastRow(), 1).getValues().map(r => String(r[0]).trim());
  let row = colA.findIndex(v => v.toLowerCase() === name.toLowerCase()) + 1;
  if (!row) {
    row = colA.length - [...colA].reverse().findIndex(v => v !== '') + 1; // first empty row after last name
  }
  ref.getRange(row, 1, 1, 2).setValues([[name, docId]]);
}

function referenceTemplateId_(name) {
  const ref = SpreadsheetApp.getActive().getSheetByName(MIG_REF);
  const vals = ref.getRange(1, 1, ref.getLastRow(), 2).getValues();
  const hit = vals.find(r => String(r[0]).trim().toLowerCase() === name.toLowerCase());
  return hit ? String(hit[1]).trim() : '';
}

/* ---- Doc helpers ---- */
function elText_(el) {
  const T = DocumentApp.ElementType;
  switch (el.getType()) {
    case T.PARAGRAPH: return el.asParagraph().getText();
    case T.LIST_ITEM: return el.asListItem().getText();
    case T.TABLE: return el.asTable().getText();
    default: return '';
  }
}
function replaceIn_(el, pattern, replacement) {
  const T = DocumentApp.ElementType;
  const t = el.getType();
  if (t === T.PARAGRAPH) el.asParagraph().replaceText(pattern, replacement);
  else if (t === T.LIST_ITEM) el.asListItem().replaceText(pattern, replacement);
  else if (t === T.TABLE) el.asTable().replaceText(pattern, replacement);
}
function insertElement_(body, at, el) {
  const T = DocumentApp.ElementType;
  switch (el.getType()) {
    case T.PARAGRAPH: body.insertParagraph(at, el.asParagraph()); break;
    case T.LIST_ITEM: body.insertListItem(at, el.asListItem()); break;
    case T.TABLE: body.insertTable(at, el.asTable()); break;
    case T.HORIZONTAL_RULE: body.insertHorizontalRule(at); break;
    case T.PAGE_BREAK: body.insertPageBreak(at); break;
    default: return at; // e.g. section breaks (UNSUPPORTED) cannot be copied by Apps Script; they hold no text/tags
  }
  return at + 1;
}
const SECTION_START_RE_ = /Part\s+II\.[IVXL]+\s*:\s*Opportunity Information|^\s*\d+\s*(st|nd|rd|th)\s+Opportunity\s*:|^\s*iGT Opportunity(\s+\d+)?\s*:/i;
function ordinal_(n) {
  const s = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return n + s;
}
function roman_(n) {
  const map = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}
function columnLetter_(c) {
  let s = '';
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

/* ---- Nov 2026 follow-up: 4-week mixed packages (1,550 per iGV slot) ---- */
const MIG_PACKAGES_4W_MIXED = [
  ['3 iGV + 1 iGTa - (4 Weeks)', '3 iGV + 1 iGTa', 3, 1, 1550, 3, 1],
  ['3 iGV + 1 iGTe - (4 Weeks)', '3 iGV + 1 iGTe', 3, 1, 1550, 3, 1],
  ['6 iGV + 3 iGTa - (4 Weeks)', '6 iGV + 3 iGTa', 6, 3, 1550, 6, 3],
  ['6 iGV + 3 iGTe - (4 Weeks)', '6 iGV + 3 iGTe', 6, 3, 1550, 6, 3],
];
function mig_build4WeekMixed() {
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty('MIG_TEMPLATES_DONE') || '{}');
  for (const pkg of MIG_PACKAGES_4W_MIXED) {
    if (done[pkg[0]]) continue;
    const id = buildTemplate_(pkg);
    setReferenceTemplate_(pkg[0], id);
    done[pkg[0]] = id;
    props.setProperty('MIG_TEMPLATES_DONE', JSON.stringify(done));
    Logger.log('✅ ' + pkg[0] + ' -> ' + id);
  }
  Logger.log('4-WEEK MIXED DONE');
}
