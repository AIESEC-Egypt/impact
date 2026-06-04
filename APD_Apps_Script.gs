/**
 * Google Apps Script for ICX APD Submissions
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets where you want to store APD submissions
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire code
 * 4. Update the SPREADSHEET_ID and SHEET_NAME constants below
 * 5. Save the script (Ctrl+S or Cmd+S)
 * 6. Deploy as web app:
 *    - Click "Deploy" > "New deployment"
 *    - Choose type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 *    - Click "Deploy"
 *    - Copy the Web App URL and replace YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE in icx-apds-submissions.js
 * 
 * SHEET STRUCTURE:
 * The sheet should have these columns (in order):
 * A: Timestamp
 * B: EP ID
 * C: OP ID
 * D: Product (iGV or iGTa)
 * E: AIESEC Mail
 * F: Additional Notes
 * G: Status
 */

// ==================== CONFIGURATION ====================
// Replace with your Google Sheet ID (found in the sheet URL)
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
// Replace with the exact name of the sheet tab where APD data will be stored
const SHEET_NAME = 'ICX APDs';

// ==================== MAIN FUNCTIONS ====================

/**
 * Handle HTTP POST request from the form
 */
function doPost(e) {
    try {
        // Parse the form data
        const formData = e.parameter;
        
        // Validate required fields
        const epID = formData.epID ? formData.epID.trim() : '';
        const opID = formData.opID ? formData.opID.trim() : '';
        const product = formData.product ? formData.product.trim() : '';
        const aiesecMail = formData.aiesecMail ? formData.aiesecMail.trim() : '';
        const notes = formData.notes ? formData.notes.trim() : '';
        
        // Validate required fields
        if (!epID || !opID || !product || !aiesecMail) {
            return ContentService
                .createTextOutput(JSON.stringify({
                    success: false,
                    error: 'Missing required fields. Please fill in EP ID, OP ID, Product, and AIESEC Mail.'
                }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        
        // Validate product (must be iGV or iGTa)
        const validProducts = ['iGV', 'iGTa'];
        if (!validProducts.includes(product)) {
            return ContentService
                .createTextOutput(JSON.stringify({
                    success: false,
                    error: 'Invalid product. Must be iGV or iGTa.'
                }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        
        // Validate EP ID and OP ID (must be numeric)
        if (!/^\d+$/.test(epID) || !/^\d+$/.test(opID)) {
            return ContentService
                .createTextOutput(JSON.stringify({
                    success: false,
                    error: 'EP ID and OP ID must contain only numbers.'
                }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        
        // Validate email format
        if (!aiesecMail.includes('@')) {
            return ContentService
                .createTextOutput(JSON.stringify({
                    success: false,
                    error: 'Please enter a valid email address.'
                }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        
        // Open the spreadsheet
        const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
        let sheet = spreadsheet.getSheetByName(SHEET_NAME);
        
        // Create sheet if it doesn't exist
        if (!sheet) {
            sheet = spreadsheet.insertSheet(SHEET_NAME);
            // Add headers
            sheet.getRange(1, 1, 1, 7).setValues([[
                'Timestamp',
                'EP ID',
                'OP ID',
                'Product',
                'AIESEC Mail',
                'Additional Notes',
                'Status'
            ]]);
            // Format headers
            sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
            sheet.getRange(1, 1, 1, 7).setBackground('#f0f0f0');
        }
        
        // Check for duplicate submission (same EP ID + OP ID combination)
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        
        // Skip header row (index 0)
        for (let i = 1; i < values.length; i++) {
            const rowEPID = values[i][1] ? values[i][1].toString().trim() : '';
            const rowOPID = values[i][2] ? values[i][2].toString().trim() : '';
            const rowProduct = values[i][3] ? values[i][3].toString().trim() : '';
            
            // Check if this exact combination already exists
            if (rowEPID === epID && rowOPID === opID && rowProduct === product) {
                return ContentService
                    .createTextOutput(JSON.stringify({
                        success: false,
                        isDuplicate: true,
                        error: 'This APD has already been submitted. EP ID: ' + epID + ', OP ID: ' + opID + ', Product: ' + product
                    }))
                    .setMimeType(ContentService.MimeType.JSON);
            }
        }
        
        // Add new row with submission data
        const timestamp = new Date();
        const newRow = [
            timestamp,
            epID,
            opID,
            product,
            aiesecMail,
            notes || '',
            'Submitted'
        ];
        
        sheet.appendRow(newRow);
        
        // Optional: Try to update the member rankings sheet if it exists
        try {
            updateMemberRankings(epID, opID, product);
        } catch (error) {
            Logger.log('Could not update member rankings: ' + error);
            // Don't fail the submission if ranking update fails
        }
        
        // Return success response
        return ContentService
            .createTextOutput(JSON.stringify({
                success: true,
                message: 'APD submitted successfully!',
                timestamp: timestamp.toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
            
    } catch (error) {
        Logger.log('Error processing APD submission: ' + error);
        return ContentService
            .createTextOutput(JSON.stringify({
                success: false,
                error: 'Server error: ' + error.toString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * Optional: Update member rankings sheet with new approval
 * This function looks for the member in the "Members data" sheet and increments their approvals
 */
function updateMemberRankings(epID, opID, product) {
    try {
        const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
        const membersSheet = spreadsheet.getSheetByName('Members data');
        
        if (!membersSheet) {
            Logger.log('Members data sheet not found, skipping ranking update');
            return;
        }
        
        const dataRange = membersSheet.getDataRange();
        const values = dataRange.getValues();
        
        // Skip header row (index 0)
        for (let i = 1; i < values.length; i++) {
            const memberID = values[i][0] ? values[i][0].toString().trim() : '';
            const functionString = values[i][4] ? values[i][4].toString() : '';
            
            // Check if member ID matches EP ID and product matches
            if (memberID === epID || memberID.includes(epID)) {
                // Check if product matches (iGV or iGTa in function string)
                const productUpper = product.charAt(0).toUpperCase() + product.slice(1);
                if (functionString.includes(productUpper) || functionString.includes('IGV') || functionString.includes('IGT')) {
                    // Found the member, increment approvals (Column H, index 7)
                    const currentApprovals = parseInt(values[i][7]) || 0;
                    const newApprovals = currentApprovals + 1;
                    
                    // Update the approvals cell
                    membersSheet.getRange(i + 1, 8).setValue(newApprovals);
                    
                    Logger.log(`Updated approvals for EP ID ${epID} (Product: ${product}): ${currentApprovals} → ${newApprovals}`);
                    return;
                }
            }
        }
        
        Logger.log(`Member with EP ID ${epID} and Product ${product} not found in Members data sheet`);
        
    } catch (error) {
        Logger.log('Error updating member rankings: ' + error);
        throw error;
    }
}

/**
 * Handle HTTP GET request (for testing)
 */
function doGet(e) {
    return ContentService
        .createTextOutput(JSON.stringify({
            success: true,
            message: 'ICX APD Submission API is running',
            timestamp: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - Run this to verify the script is working
 */
function testSubmission() {
    const testData = {
        parameter: {
            formType: 'icx-apd',
            epID: '1234567',
            opID: '7654321',
            product: 'iGV',
            aiesecMail: 'test@aiesec.net',
            notes: 'Test submission'
        }
    };
    
    const result = doPost(testData);
    Logger.log(result.getContent());
}




