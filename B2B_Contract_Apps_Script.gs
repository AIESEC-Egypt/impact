/**
 * B2B Contracts System - Google Apps Script
 * 
 * This script:
 * 1. Sets up headers from mixed-contract-headers.csv
 * 2. Receives form submissions from the website
 * 3. Maps data to Google Sheet based on opportunity type:
 *    - iGV opportunities: positions 1-15
 *    - iGTa/e opportunities: positions 16-25
 *    - Mixed contracts: iGV in 1-3, iGTa/e starting from 16
 */

// Configuration - UPDATE THESE VALUES
const SPREADSHEET_ID = '1xcVsxO-7PYCtjoo6clI5m7RB9nA2RKDICxnT9jbk1UM'; // Replace with your Google Sheet ID
const SHEET_NAME = 'B2B Contracts'; // Name of the sheet tab
const REF_SHEET_NAME = 'Reference'; // Name of the reference sheet tab
const OUTPUT_FOLDER_ID = '1W6kcHP2tGofNnNvuMA7Q3Y4acOskKzXy'; // Google Drive folder ID for generated contracts

/**
 * Set up a time-based trigger to process pending contracts every 3 minutes
 * Run this function ONCE to enable automatic contract generation
 * 
 * Note: Trigger interval is set to 3 minutes to prevent overlaps since
 * contract generation takes 2+ minutes per contract
 */
function setupContractGenerationTrigger() {
  // Delete existing triggers for this function to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processPendingContracts') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create a new trigger that runs every 3 minutes (to prevent overlaps)
  ScriptApp.newTrigger('processPendingContracts')
    .timeBased()
    .everyMinutes(3)
    .create();
  
  Logger.log('✅ Contract generation trigger set up successfully');
  Logger.log('📋 Contracts will be generated automatically every 3 minutes for pending rows');
}

/**
 * Initialize the sheet with headers from mixed-contract-headers.csv
 * Run this function once to set up the sheet
 */
function initializeSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // Clear existing content
  sheet.clear();
  
  // Headers from mixed-contract-headers.csv
  const headers = [
    'Timestamp', 'AIESECer Name', 'AIESECer Email', 'AIESECer Role', 'LC Name', 'Contract Type',
    'Organization Name', 'Org Email', 'Website', 'Phone', 'Address', 'Contact Name',
    'Contact Email', 'Contact Position', 'Contact Phone', 'Organization Size', 'Industry',
    'If "other" is chosen above write the name of the industry', 'Number of Opportunities required with this contract',
    'Email Sent?', 'Reference Code'
  ];
  
  // Add iGV opportunity headers (1-15)
  for (let i = 1; i <= 15; i++) {
    headers.push(
      `${i}. Opportunity Role Title`, `${i}. Project Type`, `${i}. SDG Number`, `${i}. SDG Target`,
      `${i}. Project Description`, `${i}. Expected Outcomes`, `${i}. Role Description`, `${i}. Expected Outputs`,
      `${i}. Week 1`, `${i}. Week 2`, `${i}. Week 3`, `${i}. Week 4`, `${i}. Week 5`, `${i}. Week 6`,
      `${i}. Field of Work`, `${i}. If "other" is chosen above write the name of the field of work`,
      `${i}. Job Description – Main Activities`, `${i}. 1st Required Skill`, `${i}. 2nd Required Skill`, `${i}. 3rd Required Skill`,
      `${i}. 1st Required Background`, `${i}. 2nd Required Background`, `${i}. 3rd Required Background`,
      `${i}. 1st Required Language`, `${i}. 2nd Required Language`, `${i}. 3rd Required Language`,
      `${i}. 1st Required Requirement`, `${i}. 2nd Required Requirement`, `${i}. 3rd Required Requirement`,
      `${i}. Opportunity Duration`, `${i}. Slot 1 - Min Start Date`, `${i}. Slot 1 - Max Start Date`, `${i}. Slot 1 - Number of Opens`,
      `${i}. Slot 2 - Min Start Date`, `${i}. Slot 2 - Max Start Date`, `${i}. Slot 2 - Number of Opens`,
      `${i}. Working Hours`, `${i}. Weekend Days`, `${i}. Transportation`, `${i}. Meals provided (Specify if any)`,
      `${i}. Accommodation is provided by`, `${i}. Accommodation is covered by`
    );
  }
  
  // Add iGTa/e opportunity headers (16-25)
  for (let i = 16; i <= 25; i++) {
    headers.push(
      `${i}. Opportunity Role Title`, `${i}. Field(s) of Work`, `${i}. Job Description – Main Activities`,
      `${i}. 1st Required Skill`, `${i}. 2nd Required Skill`, `${i}. 3rd Required Skill`,
      `${i}. 1st Required Background`, `${i}. 2nd Required Background`, `${i}. 3rd Required Background`,
      `${i}. 1st Required Language`, `${i}. 2nd Required Language`, `${i}. 3rd Required Language`,
      `${i}. 1st Required Requirement`, `${i}. 2nd Required Requirement`, `${i}. 3rd Required Requirement`,
      `${i}. Opportunity Duration`, `${i}. Slot 1 - Start Date`, `${i}. Slot 1 - Number of Openings`,
      `${i}. Slot 1 - Number of Opens`, `${i}. Slot 2 - Start Date`, `${i}. Slot 2 - Number of Openings`,
      `${i}. Slot 2 - Number of Opens`,
      `${i}. Working Hours`, `${i}. Weekend Days`, `${i}. Salary (If any)`,
      `${i}. Accommodation`, `${i}. Transportation`, `${i}. Meals provided (Specify if any)`
    );
  }
  
  // Set headers in row 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFrozenRows(1);
  
  Logger.log('Sheet initialized successfully with ' + headers.length + ' columns');
}

/**
 * Web app entry point - receives POST requests from the website
 * Deploy this as a web app with execute as: Me, access: Anyone
 */
function doPost(e) {
  try {
    const data = e.parameter || JSON.parse(e.postData.contents);
    
    // Log received data for debugging
    Logger.log('Received data keys: ' + Object.keys(data).length);
    Logger.log('Contract type: ' + (data.contractType || 'not found'));
    Logger.log('Opportunity count: ' + (data.oppCount || 'not found'));
    Logger.log('Industry: ' + (data.industry || 'not found'));
    
    // Log opportunity data
    const oppCount = parseInt(data.oppCount || '0');
    for (let i = 1; i <= oppCount && i <= 4; i++) {
      const prefix = `opp_${i}_`;
      Logger.log(`Opportunity ${i} - Title: ${data[prefix + 'title'] || 'not found'}`);
      Logger.log(`Opportunity ${i} - Field of Work: ${data[prefix + 'fieldOfWork'] || 'not found'}`);
      Logger.log(`Opportunity ${i} - Duration: ${data[prefix + 'duration'] || 'not found'}`);
      Logger.log(`Opportunity ${i} - Skills: ${data[prefix + 'skill1'] || ''}, ${data[prefix + 'skill2'] || ''}, ${data[prefix + 'skill3'] || ''}`);
      Logger.log(`Opportunity ${i} - Backgrounds: ${data[prefix + 'background1'] || ''}, ${data[prefix + 'background2'] || ''}, ${data[prefix + 'background3'] || ''}`);
      Logger.log(`Opportunity ${i} - Languages: ${data[prefix + 'language1'] || ''}, ${data[prefix + 'language2'] || ''}, ${data[prefix + 'language3'] || ''}`);
      Logger.log(`Opportunity ${i} - Requirements: ${data[prefix + 'requirement1'] || ''}, ${data[prefix + 'requirement2'] || ''}, ${data[prefix + 'requirement3'] || ''}`);
      Logger.log(`Opportunity ${i} - Accommodation: ${data[prefix + 'accommodation'] || 'not found'}`);
      Logger.log(`Opportunity ${i} - Transportation: ${data[prefix + 'transportation'] || 'not found'}`);
      Logger.log(`Opportunity ${i} - Salary: ${data[prefix + 'salary'] || 'not found'}`);
      Logger.log(`Opportunity ${i} - Description: ${(data[prefix + 'description'] || '').substring(0, 50)}...`);
    }
    
    // Open the spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Initialize sheet if it doesn't exist
    if (!sheet) {
      initializeSheet();
      sheet = ss.getSheetByName(SHEET_NAME);
    }
    
    // Prepare row data
    const rowData = new Array(sheet.getLastColumn()).fill('');
    
    // Map headers to column indices
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    // Log slot headers for debugging
    Logger.log('[doPost] Checking for Slot Min/Max headers in headerMap:');
    const slotHeaders = ['1. Slot 1 - Min Start Date', '1. Slot 1 - Max Start Date', '1. Slot 2 - Min Start Date', '1. Slot 2 - Max Start Date'];
    slotHeaders.forEach(header => {
      if (headerMap[header] !== undefined) {
        Logger.log(`  ✅ Found: "${header}" at column index ${headerMap[header]}`);
      } else {
        Logger.log(`  ❌ NOT FOUND: "${header}"`);
      }
    });
    
    // Set timestamp
    if (headerMap['Timestamp'] !== undefined) {
      rowData[headerMap['Timestamp']] = new Date();
    }
    
    // Map basic organization information
    mapBasicInfo(data, rowData, headerMap);
    
    // Map opportunities based on contract type
    const contractType = data.contractType || '';
    const isMixed = contractType.includes('3 iGV + 1 iGTa') || contractType.includes('3 iGV + 1 iGTe');
    const isIGTa = contractType.includes('iGTa') || contractType.includes('iGTe');
    
    if (isMixed) {
      // Mixed contract: iGV opportunities go to 1-3, iGTa/e goes to 16
      mapIGVOpportunities(data, rowData, headerMap, 1, 3);
      // For mixed contracts, the 4th opportunity (opp_4_) should map to position 16
      mapIGTaOpportunityFromSource(data, rowData, headerMap, 16, 4);
    } else if (isIGTa) {
      // iGTa/e contract: opportunities start from position 16
      const oppCount = parseInt(data.oppCount || '0');
      mapIGTaOpportunities(data, rowData, headerMap, 16, oppCount);
    } else {
      // iGV contract: opportunities go to positions 1-15
      const oppCount = parseInt(data.oppCount || '0');
      mapIGVOpportunities(data, rowData, headerMap, 1, oppCount);
    }
    
    // Append row to sheet
    sheet.appendRow(rowData);
    
    // Contract generation now runs asynchronously via time-based trigger
    // No blocking - form submission returns immediately
    // Contracts are generated automatically by processPendingContracts() trigger
    
    // Set CORS headers for Web App
    const output = ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Contract data submitted successfully'
    }));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    const errorOutput = ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    }));
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    return errorOutput;
  }
}

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'B2B Contracts API is running',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Map basic organization information
 */
function mapBasicInfo(data, rowData, headerMap) {
  const basicFields = {
    'AIESECer Name': 'aiesecerName',
    'AIESECer Email': 'aiesecerEmail',
    'AIESECer Role': 'aiesecerRole',
    'LC Name': 'lcName',
    'Contract Type': 'contractType',
    'Organization Name': 'orgName',
    'Org Email': 'orgEmail',
    'Website': 'website',
    'Phone': 'phone',
    'Address': 'address',
    'Contact Name': 'contactName',
    'Contact Email': 'contactEmail',
    'Contact Position': 'contactPosition',
    'Contact Phone': 'contactPhone',
    'Organization Size': 'orgSize',
    'Industry': 'industry',
    'If "other" is chosen above write the name of the industry': 'industryOther',
    'Number of Opportunities required with this contract': 'oppCount'
  };
  
  for (const [header, dataKey] of Object.entries(basicFields)) {
    if (headerMap[header] !== undefined && data[dataKey]) {
      rowData[headerMap[header]] = data[dataKey];
    }
  }
}

/**
 * Map iGV opportunities (positions 1-15)
 */
function mapIGVOpportunities(data, rowData, headerMap, startPos, count) {
  for (let i = 1; i <= count && (startPos + i - 1) <= 15; i++) {
    const oppNum = startPos + i - 1;
    const prefix = `opp_${i}_`;
    
    // Basic opportunity fields (in order matching CSV headers)
    setValue(rowData, headerMap, `${oppNum}. Opportunity Role Title`, data[prefix + 'title']);
    setValue(rowData, headerMap, `${oppNum}. Project Type`, data[prefix + 'projectType']);
    
    // SDG and project details (populated automatically for specific project types)
    setValue(rowData, headerMap, `${oppNum}. SDG Number`, data[prefix + 'sdgNumber']);
    setValue(rowData, headerMap, `${oppNum}. SDG Target`, data[prefix + 'sdgTarget']);
    setValue(rowData, headerMap, `${oppNum}. Project Description`, data[prefix + 'projectDescription']);
    setValue(rowData, headerMap, `${oppNum}. Expected Outcomes`, data[prefix + 'expectedOutcomes']);
    setValue(rowData, headerMap, `${oppNum}. Role Description`, data[prefix + 'roleDescription']);
    setValue(rowData, headerMap, `${oppNum}. Expected Outputs`, data[prefix + 'expectedOutputs']);
    
    // Week fields (populated automatically for specific project types)
    for (let week = 1; week <= 6; week++) {
      setValue(rowData, headerMap, `${oppNum}. Week ${week}`, data[prefix + `week${week}`]);
    }
    
    // Field of Work and Job Description
    setValue(rowData, headerMap, `${oppNum}. Field of Work`, data[prefix + 'fieldOfWork']);
    setValue(rowData, headerMap, `${oppNum}. If "other" is chosen above write the name of the field of work`, data[prefix + 'fieldOfWorkOther']);
    setValue(rowData, headerMap, `${oppNum}. Job Description – Main Activities`, data[prefix + 'description']);
    
    Logger.log(`[iGV Opportunity ${oppNum}] Mapping skills, backgrounds, requirements...`);
    // Skills, Backgrounds, Languages, Requirements
    for (let j = 1; j <= 3; j++) {
      // Determine correct ordinal suffix (1st, 2nd, 3rd)
      let suffix = 'st';
      if (j === 2) suffix = 'nd';
      else if (j === 3) suffix = 'rd';
      
      const skillValue = data[prefix + `skill${j}`] || '';
      const bgValue = data[prefix + `background${j}`] || '';
      const langValue = data[prefix + `language${j}`] || '';
      const reqValue = data[prefix + `requirement${j}`] || '';
      
      Logger.log(`[iGV Opportunity ${oppNum}] Skill ${j}: "${skillValue}" -> Header: "${oppNum}. ${j}${suffix} Required Skill"`);
      Logger.log(`[iGV Opportunity ${oppNum}] Background ${j}: "${bgValue}" -> Header: "${oppNum}. ${j}${suffix} Required Background"`);
      Logger.log(`[iGV Opportunity ${oppNum}] Requirement ${j}: "${reqValue}" -> Header: "${oppNum}. ${j}${suffix} Required Requirement"`);
      
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Skill`, skillValue);
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Background`, bgValue);
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Language`, langValue);
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Requirement`, reqValue);
    }
    
    // Duration
    setValue(rowData, headerMap, `${oppNum}. Opportunity Duration`, data[prefix + 'duration']);
    
    // Slots
    Logger.log(`[iGV Opportunity ${oppNum}] Slot 1 - Min Start: "${data[prefix + 'slot1MinStart'] || 'not found'}"`);
    Logger.log(`[iGV Opportunity ${oppNum}] Slot 1 - Max Start: "${data[prefix + 'slot1MaxStart'] || 'not found'}"`);
    Logger.log(`[iGV Opportunity ${oppNum}] Slot 1 - Opens: "${data[prefix + 'slot1Opens'] || 'not found'}"`);
    setValue(rowData, headerMap, `${oppNum}. Slot 1 - Min Start Date`, data[prefix + 'slot1MinStart']);
    setValue(rowData, headerMap, `${oppNum}. Slot 1 - Max Start Date`, data[prefix + 'slot1MaxStart']);
    setValue(rowData, headerMap, `${oppNum}. Slot 1 - Number of Opens`, data[prefix + 'slot1Opens']);
    
    // Slot 2
    Logger.log(`[iGV Opportunity ${oppNum}] Slot 2 - Min Start: "${data[prefix + 'slot2MinStart'] || 'not found'}"`);
    Logger.log(`[iGV Opportunity ${oppNum}] Slot 2 - Max Start: "${data[prefix + 'slot2MaxStart'] || 'not found'}"`);
    Logger.log(`[iGV Opportunity ${oppNum}] Slot 2 - Opens: "${data[prefix + 'slot2Opens'] || 'not found'}"`);
    setValue(rowData, headerMap, `${oppNum}. Slot 2 - Min Start Date`, data[prefix + 'slot2MinStart']);
    setValue(rowData, headerMap, `${oppNum}. Slot 2 - Max Start Date`, data[prefix + 'slot2MaxStart']);
    setValue(rowData, headerMap, `${oppNum}. Slot 2 - Number of Opens`, data[prefix + 'slot2Opens']);
    
    // Other fields
    setValue(rowData, headerMap, `${oppNum}. Working Hours`, data[prefix + 'workingHours']);
    setValue(rowData, headerMap, `${oppNum}. Weekend Days`, data[prefix + 'weekendDays']);
    // Note: Old "Accommodation" field removed for iGV - replaced with "Accommodation is provided by" and "Accommodation is covered by"
    setValue(rowData, headerMap, `${oppNum}. Transportation`, data[prefix + 'transportation']);
    setValue(rowData, headerMap, `${oppNum}. Meals provided (Specify if any)`, data[prefix + 'meals']);
    setValue(rowData, headerMap, `${oppNum}. Accommodation is provided by`, data[prefix + 'accommodationProvidedBy']);
    setValue(rowData, headerMap, `${oppNum}. Accommodation is covered by`, data[prefix + 'accommodationCoveredBy']);
  }
}

/**
 * Map iGTa/e opportunities (positions 16-25)
 */
function mapIGTaOpportunities(data, rowData, headerMap, startPos, count) {
  for (let i = 1; i <= count && (startPos + i - 1) <= 25; i++) {
    const oppNum = startPos + i - 1;
    const prefix = `opp_${i}_`;
    
    Logger.log(`[iGTa/e Opportunity ${oppNum}] Using prefix: ${prefix}`);
    
    // Basic opportunity fields
    setValue(rowData, headerMap, `${oppNum}. Opportunity Role Title`, data[prefix + 'title']);
    setValue(rowData, headerMap, `${oppNum}. Field(s) of Work`, data[prefix + 'fieldOfWork']);
    setValue(rowData, headerMap, `${oppNum}. Job Description – Main Activities`, data[prefix + 'description']);
    setValue(rowData, headerMap, `${oppNum}. Opportunity Duration`, data[prefix + 'duration']);
    
    // Skills, Backgrounds, Languages, Requirements
    for (let j = 1; j <= 3; j++) {
      // Determine correct ordinal suffix (1st, 2nd, 3rd)
      let suffix = 'st';
      if (j === 2) suffix = 'nd';
      else if (j === 3) suffix = 'rd';
      
      const skillValue = data[prefix + `skill${j}`] || '';
      const bgValue = data[prefix + `background${j}`] || '';
      const langValue = data[prefix + `language${j}`] || '';
      const reqValue = data[prefix + `requirement${j}`] || '';
      
      Logger.log(`[iGTa/e Opportunity ${oppNum}] Skill ${j}: "${skillValue}"`);
      Logger.log(`[iGTa/e Opportunity ${oppNum}] Background ${j}: "${bgValue}"`);
      Logger.log(`[iGTa/e Opportunity ${oppNum}] Language ${j}: "${langValue}"`);
      Logger.log(`[iGTa/e Opportunity ${oppNum}] Requirement ${j}: "${reqValue}"`);
      
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Skill`, skillValue);
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Background`, bgValue);
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Language`, langValue);
      setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Requirement`, reqValue);
    }
    
    // Slots
    setValue(rowData, headerMap, `${oppNum}. Slot 1 - Start Date`, data[prefix + 'slot1StartDate']);
    setValue(rowData, headerMap, `${oppNum}. Slot 1 - Number of Openings`, data[prefix + 'slot1Opens']);
    setValue(rowData, headerMap, `${oppNum}. Slot 1 - Number of Opens`, data[prefix + 'slot1Opens']);
    setValue(rowData, headerMap, `${oppNum}. Slot 2 - Start Date`, data[prefix + 'slot2StartDate']);
    setValue(rowData, headerMap, `${oppNum}. Slot 2 - Number of Openings`, data[prefix + 'slot2Opens']);
    setValue(rowData, headerMap, `${oppNum}. Slot 2 - Number of Opens`, data[prefix + 'slot2Opens']);
    
    // Other fields
    setValue(rowData, headerMap, `${oppNum}. Working Hours`, data[prefix + 'workingHours']);
    setValue(rowData, headerMap, `${oppNum}. Weekend Days`, data[prefix + 'weekendDays']);
    setValue(rowData, headerMap, `${oppNum}. Salary (If any)`, data[prefix + 'salary']);
    setValue(rowData, headerMap, `${oppNum}. Accommodation`, data[prefix + 'accommodation']);
    setValue(rowData, headerMap, `${oppNum}. Transportation`, data[prefix + 'transportation']);
    setValue(rowData, headerMap, `${oppNum}. Meals provided (Specify if any)`, data[prefix + 'meals']);
  }
}

/**
 * Map a single iGTa/e opportunity from a specific source opportunity number
 * Used for mixed contracts where the 4th opportunity (opp_4_) maps to position 16
 */
function mapIGTaOpportunityFromSource(data, rowData, headerMap, targetPos, sourceOppNum) {
  const oppNum = targetPos;
  const prefix = `opp_${sourceOppNum}_`;
  
  Logger.log(`[Mixed Contract] Mapping source opportunity ${sourceOppNum} (prefix: ${prefix}) to position ${oppNum}`);
  
  // Log all available data for this opportunity
  Logger.log(`[Mixed Contract] Available data keys for ${prefix}:`);
  Object.keys(data).filter(key => key.startsWith(prefix)).forEach(key => {
    Logger.log(`  ${key}: "${(data[key] || '').substring(0, 100)}"`);
  });
  
  // Basic opportunity fields
  const titleValue = data[prefix + 'title'] || '';
  const fieldOfWorkValue = data[prefix + 'fieldOfWork'] || '';
  const descValue = data[prefix + 'description'] || '';
  const durationValue = data[prefix + 'duration'] || '';
  
  Logger.log(`[Mixed Contract] Title: "${titleValue}"`);
  Logger.log(`[Mixed Contract] Field of Work: "${fieldOfWorkValue}"`);
  Logger.log(`[Mixed Contract] Description: "${descValue.substring(0, 50)}..."`);
  Logger.log(`[Mixed Contract] Duration: "${durationValue}"`);
  
  setValue(rowData, headerMap, `${oppNum}. Opportunity Role Title`, titleValue);
  setValue(rowData, headerMap, `${oppNum}. Field(s) of Work`, fieldOfWorkValue);
  setValue(rowData, headerMap, `${oppNum}. Job Description – Main Activities`, descValue);
  setValue(rowData, headerMap, `${oppNum}. Opportunity Duration`, durationValue);
  
  // Skills, Backgrounds, Languages, Requirements
  for (let j = 1; j <= 3; j++) {
    // Determine correct ordinal suffix (1st, 2nd, 3rd)
    let suffix = 'st';
    if (j === 2) suffix = 'nd';
    else if (j === 3) suffix = 'rd';
    
    const skillValue = data[prefix + `skill${j}`] || '';
    const bgValue = data[prefix + `background${j}`] || '';
    const langValue = data[prefix + `language${j}`] || '';
    const reqValue = data[prefix + `requirement${j}`] || '';
    
    Logger.log(`[Mixed Contract] Skill ${j}: "${skillValue}"`);
    Logger.log(`[Mixed Contract] Background ${j}: "${bgValue}"`);
    Logger.log(`[Mixed Contract] Language ${j}: "${langValue}"`);
    Logger.log(`[Mixed Contract] Requirement ${j}: "${reqValue}"`);
    
    setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Skill`, skillValue);
    setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Background`, bgValue);
    setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Language`, langValue);
    setValue(rowData, headerMap, `${oppNum}. ${j}${suffix} Required Requirement`, reqValue);
  }
  
  // Slots
  setValue(rowData, headerMap, `${oppNum}. Slot 1 - Start Date`, data[prefix + 'slot1StartDate']);
  setValue(rowData, headerMap, `${oppNum}. Slot 1 - Number of Openings`, data[prefix + 'slot1Opens']);
  setValue(rowData, headerMap, `${oppNum}. Slot 1 - Number of Opens`, data[prefix + 'slot1Opens']);
  setValue(rowData, headerMap, `${oppNum}. Slot 2 - Start Date`, data[prefix + 'slot2StartDate']);
  setValue(rowData, headerMap, `${oppNum}. Slot 2 - Number of Openings`, data[prefix + 'slot2Opens']);
  setValue(rowData, headerMap, `${oppNum}. Slot 2 - Number of Opens`, data[prefix + 'slot2Opens']);
  
  // Other fields
  const workingHoursValue = data[prefix + 'workingHours'] || '';
  const weekendDaysValue = data[prefix + 'weekendDays'] || '';
  const salaryValue = data[prefix + 'salary'] || '';
  const accommodationValue = data[prefix + 'accommodation'] || '';
  const transportationValue = data[prefix + 'transportation'] || '';
  const mealsValue = data[prefix + 'meals'] || '';
  
  Logger.log(`[Mixed Contract] Working Hours: "${workingHoursValue}"`);
  Logger.log(`[Mixed Contract] Weekend Days: "${weekendDaysValue}"`);
  Logger.log(`[Mixed Contract] Salary: "${salaryValue}"`);
  Logger.log(`[Mixed Contract] Accommodation: "${accommodationValue}"`);
  Logger.log(`[Mixed Contract] Transportation: "${transportationValue}"`);
  Logger.log(`[Mixed Contract] Meals: "${mealsValue}"`);
  
  setValue(rowData, headerMap, `${oppNum}. Working Hours`, workingHoursValue);
  setValue(rowData, headerMap, `${oppNum}. Weekend Days`, weekendDaysValue);
  setValue(rowData, headerMap, `${oppNum}. Salary (If any)`, salaryValue);
  setValue(rowData, headerMap, `${oppNum}. Accommodation`, accommodationValue);
  setValue(rowData, headerMap, `${oppNum}. Transportation`, transportationValue);
  setValue(rowData, headerMap, `${oppNum}. Meals provided (Specify if any)`, mealsValue);
}

/**
 * Helper function to set value in row data if header exists
 * Updated to always set predefined values for project type auto-population
 */
function setValue(rowData, headerMap, header, value) {
  if (headerMap[header] !== undefined) {
    // Always set the value if provided (including empty strings for predefined fields)
    // This ensures auto-populated project type values are always written to the sheet
    if (value !== undefined && value !== null) {
      rowData[headerMap[header]] = String(value);
      // Log for debugging slot Min/Max fields
      if (header.includes('Slot') && (header.includes('Min Start Date') || header.includes('Max Start Date'))) {
        Logger.log(`[setValue] Set ${header} = "${String(value)}" (column index: ${headerMap[header]})`);
      }
    } else {
      // Log when value is missing for slot fields
      if (header.includes('Slot') && (header.includes('Min Start Date') || header.includes('Max Start Date'))) {
        Logger.log(`[setValue] WARNING: ${header} has no value (value is ${value})`);
      }
    }
  } else {
    // Log when header is not found
    if (header.includes('Slot') && (header.includes('Min Start Date') || header.includes('Max Start Date'))) {
      Logger.log(`[setValue] ERROR: Header "${header}" not found in headerMap`);
    }
  }
}

/**
 * Test function to verify the script works
 */
function testSubmission() {
  const testData = {
    aiesecerName: 'Test User',
    aiesecerEmail: 'test@aiesec.net',
    contractType: 'iGV 5+1 - (Accommodation Not Covered) 6 Weeks',
    oppCount: '2',
    'opp_1_title': 'Test Opportunity 1',
    'opp_2_title': 'Test Opportunity 2'
  };
  
  const mockEvent = {
    parameter: testData
  };
  
  doPost(mockEvent);
}

/********************* CONTRACT GENERATION *********************/

/**
 * Generate contract for a specific row (recommended for WebApp doPost),
 * or fallback to the last pending row (Email Sent? != TRUE).
 *
 * ✅ WebApp-safe: uses SpreadsheetApp.openById(SPREADSHEET_ID)
 */
function generateB2BContract(rowIndexOverride) {
  try {
    Logger.log("🚀 generateB2BContract started");
    Logger.log("📌 rowIndexOverride = " + rowIndexOverride);

    // ✅ WebApp-safe (NO getActiveSpreadsheet)
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const referenceSheet = ss.getSheetByName(REF_SHEET_NAME);

    if (!sheet) throw new Error(`Missing sheet: ${SHEET_NAME}`);
    if (!referenceSheet) throw new Error(`Missing sheet: ${REF_SHEET_NAME}`);

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) throw new Error('No data rows found in B2B sheet.');

    // --- Find required columns once ---
    const sendCol = firstColByHeader_(sheet, 'Email Sent?');
    if (!sendCol) throw new Error(`Header not found: Email Sent? (Add it to initializeSheet headers)`);

    const aiesecerNameCol = firstColByHeader_(sheet, 'AIESECer Name');
    if (!aiesecerNameCol) throw new Error(`Header not found: AIESECer Name`);

    // ✅ If doPost passes the submitted row, use it. Otherwise fallback to last pending.
    const rowIndex = rowIndexOverride || findLastPendingRow_(sheet, sendCol);
    if (!rowIndex) {
      Logger.log('✅ No pending rows found (all Email Sent? are TRUE).');
      return;
    }

    // If the passed row is already sent, skip (avoid double-processing)
    const alreadySent = sheet.getRange(rowIndex, sendCol).getValue() === true;
    if (alreadySent) {
      Logger.log(`✅ Row ${rowIndex} already marked as sent. Skipping.`);
      return;
    }

    Logger.log("📍 Processing rowIndex = " + rowIndex);

    // Read only that row (FAST)
    const rowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

    // Fixed columns from your logic (still ok)
    const lcName = sheet.getRange(rowIndex, 5).getValue();      // E
    const contractType = sheet.getRange(rowIndex, 6).getValue(); // F
    const partner_name = sheet.getRange(rowIndex, 7).getValue(); // G
    const aiesecerName = sheet.getRange(rowIndex, aiesecerNameCol).getValue();

    Logger.log("🏷 contractType = " + contractType);
    Logger.log("🤝 partner_name = " + partner_name);
    Logger.log("🏛 lcName = " + lcName);

    // Destination folder
    const folder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);

    // --- Find template in Reference by contractType ---
    const found = referenceSheet.createTextFinder(String(contractType))
      .matchEntireCell(true)
      .findNext();
    if (!found) throw new Error(`Template not found in Reference for type: ${contractType}`);

    const contractIDRow = found.getRow();
    const contractID = referenceSheet.getRange(contractIDRow, 2).getValue(); // col B
    const template = DriveApp.getFileById(String(contractID));

    // Make document copy
    const name = `${contractType} - ${partner_name}`;
    const newFile = template.makeCopy(name, folder);
    Logger.log("📄 Doc created: " + newFile.getUrl());

    const doc = DocumentApp.openById(newFile.getId());
    const body = doc.getBody();

    // --- Build mapping from Reference sheet ---
    const refLastRow = referenceSheet.getLastRow();
    const refLastCol = referenceSheet.getLastColumn();
    const refData = referenceSheet.getRange(1, 1, refLastRow, refLastCol).getValues();

    // Assumption: Type column is D, Header is E, Tag is F
    const TYPE_COL = 4;   // D
    const HEADER_COL = 5; // E
    const TAG_COL = 6;    // F

    // Prepare emails & lc for lcMap usage
    const emails = [];
    let lc = '';

    // --- Preload Reference Code uniqueness set ---
    const refCodeCol = firstColByHeader_(sheet, 'Reference Code');
    const existingCodes = new Set();

    if (refCodeCol && lastRow > 2) {
      const codes = sheet.getRange(2, refCodeCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < codes.length; i++) {
        const v = codes[i][0];
        if (v !== '' && v !== null && v !== undefined) existingCodes.add(String(v));
      }
    }

    // --- Build tag->value map for ONE-PASS replacement in doc ---
    const tagValueMap = {};

    for (let r = 1; r < refData.length; r++) { // start from row 2
      const type = String(refData[r][TYPE_COL - 1] || '').trim();

      // ⚠️ You currently only process rows where type === 'IGV'
      // Keep as-is (your original), change if you want iGT mapping too.
      if (type !== 'IGV') continue;

      const header = refData[r][HEADER_COL - 1];
      const tag = refData[r][TAG_COL - 1];
      if (!header || !tag) continue;

      const colIndex = firstColByHeader_(sheet, String(header));
      if (!colIndex) {
        Logger.log('⚠️ Header not found in B2B sheet: ' + header);
        continue;
      }

      let value = rowValues[colIndex - 1];

      // Capture LC
      if (String(header) === 'LC Name') {
        lc = String(value || '');
      }

      // Force GV value
      if (String(header) === 'GV') {
        value = 'GV';
      }

      // Email collection
      if (String(header) === 'AIESECer Email') {
        const mail = String(value || '').trim();
        if (mail) emails.push(mail);
      }

      // Other fallback (industry other)
      if (value === 'Other') {
        const altCol = firstColByHeader_(sheet, `If "other" is chosen above write the name of the industry`);
        if (altCol) value = rowValues[altCol - 1];
      }

      // Date placeholders
      if (String(tag).includes('sd}}')) {
        value = value ? Utilities.formatDate(new Date(value), 'GMT+3', 'dd/MM/yyyy') : '';
      }

      // Reference Code generation (if used in Reference mapping)
      if (String(header) === 'Reference Code') {
        const df = (typeof dateFormat !== 'undefined' && dateFormat) ? dateFormat : 'ddMMyyyy';
        const today = Utilities.formatDate(new Date(), 'GMT+3', df);
        const lcCode = (typeof lcMap !== 'undefined' && lcMap) ? (lcMap[String(lc)] || '') : '';
        let code = lcCode + convertTexttoNumber(partner_name) + today;

        if (existingCodes.size > 0) {
          while (existingCodes.has(String(code))) {
            code = String(code) + '1';
          }
          existingCodes.add(String(code));
        }

        value = code;
        sheet.getRange(rowIndex, colIndex).setValue(value); // write back to sheet
      }

      tagValueMap[String(tag)] = (value === undefined || value === null) ? '' : String(value);
    }

    // ✅ One-pass replacement
    fastReplaceAll_(body, tagValueMap);

    doc.saveAndClose();

    // Move to LC folder if configured
    if (typeof lcsFolders !== 'undefined' && lcsFolders) {
      const lcFolderId = lcsFolders[String(lcName)];
      if (lcFolderId) moveFileId(newFile.getId(), lcFolderId);
    }

    Logger.log("📧 About to send email to: " + emails.join(','));

    // Send email
    MailApp.sendEmail({
      to: emails.join(','),
      subject: `${name} Contract`,
      body:
        `Hello ${aiesecerName},\n` +
        `Greeting from AIESEC in Egypt.\n\n` +
        `You can find your copy of the contract that should be signed in the next few days with your partner.\n\n` +
        `Thank you.\n\n` +
        `Please, don't reply. This is an automated mail.`,
      attachments: [newFile.getAs(MimeType.PDF)]
    });

    // Mark sent
    sheet.getRange(rowIndex, sendCol)
      .setValue(true)
      .setBackground('green')
      .setFontColor('white');

    Logger.log(`✅ Done. Row processed: ${rowIndex}`);

  } catch (error) {
    Logger.log(`Error in generateB2BContract: ${error.toString()}`);
    throw error;
  }
}

/**
 * Process pending contracts asynchronously (called by trigger)
 * This function finds rows where "Email Sent?" is not TRUE and generates contracts
 * Uses a lock mechanism to prevent overlapping executions
 */
function processPendingContracts() {
  const LOCK_KEY = 'contract_generation_lock';
  const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout
  const properties = PropertiesService.getScriptProperties();
  
  try {
    // Check if another execution is already running (lock mechanism)
    const lockTime = properties.getProperty(LOCK_KEY);
    if (lockTime) {
      const lockTimestamp = parseInt(lockTime);
      const now = Date.now();
      const elapsed = now - lockTimestamp;
      
      if (elapsed < LOCK_TIMEOUT) {
        Logger.log(`⏸️ Another contract generation is already running (started ${Math.round(elapsed/1000)}s ago). Skipping.`);
        return;
      } else {
        Logger.log(`⚠️ Lock expired (${Math.round(elapsed/1000)}s old). Clearing and proceeding.`);
        properties.deleteProperty(LOCK_KEY);
      }
    }
    
    // Acquire lock
    properties.setProperty(LOCK_KEY, Date.now().toString());
    Logger.log("🔒 Lock acquired - processPendingContracts started");
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      Logger.log("❌ Sheet not found");
      properties.deleteProperty(LOCK_KEY);
      return;
    }
    
    const sendCol = firstColByHeader_(sheet, 'Email Sent?');
    if (!sendCol) {
      Logger.log("❌ 'Email Sent?' column not found");
      properties.deleteProperty(LOCK_KEY);
      return;
    }
    
    // Find the last pending row (where Email Sent? is not TRUE and not "Processing")
    const pendingRowIndex = findLastPendingRow_(sheet, sendCol);
    
    if (!pendingRowIndex || pendingRowIndex < 2) {
      Logger.log("✅ No pending contracts to process");
      properties.deleteProperty(LOCK_KEY);
      return;
    }
    
    // Mark row as "Processing" to prevent other triggers from picking it up
    const currentStatus = sheet.getRange(pendingRowIndex, sendCol).getValue();
    if (currentStatus === 'Processing') {
      Logger.log(`⏸️ Row ${pendingRowIndex} is already being processed. Skipping.`);
      properties.deleteProperty(LOCK_KEY);
      return;
    }
    
    sheet.getRange(pendingRowIndex, sendCol).setValue('Processing');
    Logger.log(`📋 Processing contract for row ${pendingRowIndex}`);
    
    // Generate contract for the pending row
    generateB2BContract(pendingRowIndex);
    
    Logger.log(`✅ Contract generated successfully for row ${pendingRowIndex}`);
    
  } catch (error) {
    Logger.log(`❌ Error in processPendingContracts: ${error.toString()}`);
    Logger.log(`Stack: ${error.stack}`);
  } finally {
    // Always release lock, even if there was an error
    properties.deleteProperty(LOCK_KEY);
    Logger.log("🔓 Lock released");
  }
}

/** ========= FAST HELPERS ========= */

/** Find last row where Email Sent? is NOT TRUE and NOT "Processing" */
function findLastPendingRow_(sheet, sendCol) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const vals = sheet.getRange(2, sendCol, lastRow - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const status = vals[i][0];
    // Skip rows that are TRUE (completed) or "Processing" (being processed)
    if (status !== true && status !== 'Processing') {
      return i + 2;
    }
  }
  return 0;
}

/** One-pass replace across paragraphs + table cells using a combined regex */
function fastReplaceAll_(body, tagValueMap) {
  const tags = Object.keys(tagValueMap || {});
  if (!tags.length) return;

  const escaped = tags
    .map(t => String(t).replace(/[\u200B-\u200D]/g, '').trim())
    .filter(Boolean)
    .map(t => t.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'));

  if (!escaped.length) return;

  const re = new RegExp(escaped.join('|'), 'g');

  const replaceFn = (match) => {
    const v = tagValueMap[match];
    return (v === '' || v === null || v === undefined) ? ' ' : String(v);
  };

  const paras = body.getParagraphs();
  for (let i = 0; i < paras.length; i++) {
    const t = paras[i].getText();
    if (!t) continue;
    if (re.test(t)) {
      const replaced = t.replace(re, replaceFn);
      paras[i].setText(replaced === '' ? ' ' : replaced);
    }
    re.lastIndex = 0;
  }

  const tables = body.getTables();
  for (let ti = 0; ti < tables.length; ti++) {
    const tbl = tables[ti];
    for (let r = 0; r < tbl.getNumRows(); r++) {
      const row = tbl.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        const ct = cell.getText();
        if (!ct) continue;
        if (re.test(ct)) {
          const replaced = ct.replace(re, replaceFn);
          cell.setText(replaced === '' ? ' ' : replaced);
        }
        re.lastIndex = 0;
      }
    }
  }
}

/** Find first column by header text, tolerant of spacing/dashes/case */
function firstColByHeader_(sheet, headerText) {
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const want = _normHeader_(headerText);
  for (let i = 0; i < headerRow.length; i++) {
    if (_normHeader_(headerRow[i]) === want) return i + 1;
  }
  return 0;
}

function _normHeader_(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\u2013|\u2014/g, '-')
    .trim()
    .toLowerCase();
}

/** Convert text into numeric code (used for Reference Code) */
function convertTexttoNumber(partnerName) {
  partnerName = String(partnerName || '');
  let out = '';
  for (let i = 0; i < partnerName.length; i++) {
    out += partnerName.codePointAt(i);
  }
  return out.substring(0, 10);
}

/** Move file by ID into another folder ID */
function moveFileId(fileId, toFolderId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const sourceFolder = file.getParents().hasNext() ? file.getParents().next() : null;
    const targetFolder = DriveApp.getFolderById(toFolderId);
    targetFolder.addFile(file);
    if (sourceFolder) sourceFolder.removeFile(file);
  } catch (error) {
    Logger.log(`Error in moveFileId: ${error.toString()}`);
  }
}
