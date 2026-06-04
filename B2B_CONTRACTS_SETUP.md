# B2B Contracts System - Setup Instructions

This guide will help you set up the Google Apps Script to receive form submissions from your website and store them in a Google Sheet.

## Prerequisites

1. A Google account
2. Access to Google Sheets and Google Apps Script
3. The `mixed-contract-headers.csv` file (already created)

## Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "B2B Contracts" (or any name you prefer)
4. Copy the **Spreadsheet ID** from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
   - The `SPREADSHEET_ID_HERE` is what you need

## Step 2: Set Up Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Click "New Project"
3. Delete the default `myFunction` code
4. Copy the entire contents of `B2B_Contract_Apps_Script.gs` into the editor
5. **Update the configuration** at the top of the script:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Paste your Spreadsheet ID here
   const SHEET_NAME = 'B2B Contracts'; // Keep this or change to match your sheet tab name
   ```
6. Save the project (Ctrl+S or Cmd+S)
7. Name your project: "B2B Contracts Handler"

## Step 3: Initialize the Sheet

1. In the Apps Script editor, select the `initializeSheet` function from the dropdown
2. Click the "Run" button (▶️)
3. Authorize the script when prompted:
   - Click "Review Permissions"
   - Choose your Google account
   - Click "Advanced" → "Go to [Project Name] (unsafe)"
   - Click "Allow"
4. The script will create the headers in your Google Sheet
5. Check your Google Sheet - you should see all the headers populated in row 1

## Step 4: Deploy as Web App

1. In the Apps Script editor, click "Deploy" → "New deployment"
2. Click the gear icon (⚙️) next to "Select type" → "Web app"
3. Configure the deployment:
   - **Description**: "B2B Contracts Form Handler"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone" (or "Anyone with Google account" if you want to restrict)
4. Click "Deploy"
5. **Copy the Web App URL** - you'll need this for the next step
6. Click "Done"

## Step 5: Update Website Form

1. Open `b2b-contracts.html` in your editor
2. Add this script tag before the closing `</body>` tag:
   ```html
   <script src="b2b-contracts-submit.js"></script>
   ```
3. Open `b2b-contracts-submit.js`
4. Update the `APPS_SCRIPT_URL` constant with your Web App URL:
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
5. Save both files

## Step 6: Test the System

1. Open `b2b-contracts.html` in your browser
2. Fill out the form with test data
3. Submit the form
4. Check your Google Sheet - you should see a new row with the submitted data

## How It Works

### Data Mapping Logic

- **iGV Contracts**: Opportunities are mapped to positions 1-15
- **iGTa/e Contracts**: Opportunities are mapped starting from position 16
- **Mixed Contracts** (3 iGV + 1 iGTa/e):
  - iGV opportunities go to positions 1-3
  - iGTa/e opportunity goes to position 16

### Opportunity Detection

The script automatically detects opportunity type based on:
- **iGV**: Has "Project Type" field
- **iGTa/e**: Has "Duration" dropdown and "Field(s) of Work" field

## Troubleshooting

### Sheet not initializing
- Make sure you've updated `SPREADSHEET_ID` in the script
- Check that you have edit access to the spreadsheet
- Run `initializeSheet` function again

### Form submissions not working
- Verify the `APPS_SCRIPT_URL` in `b2b-contracts-submit.js` is correct
- Check browser console for errors (F12 → Console tab)
- Make sure the web app deployment has "Anyone" access
- Verify the form is collecting data correctly (check `collectFormData` function)

### Data not appearing in correct columns
- Ensure headers match exactly between the CSV and the script
- Check that opportunity numbers are being mapped correctly
- Verify contract type detection is working

### Permission errors
- Make sure you've authorized the script
- Check that the web app has proper permissions
- Try redeploying the web app

## Advanced Configuration

### Custom Field Mapping

If you need to add custom fields or change field names:
1. Update the headers in `mixed-contract-headers.csv`
2. Run `initializeSheet` again to update the sheet
3. Update the mapping functions in the Apps Script (`mapBasicInfo`, `mapIGVOpportunities`, `mapIGTaOpportunities`)
4. Update the `collectFormData` function in `b2b-contracts-submit.js`

### Multiple Sheets

To use different sheets for different contract types:
1. Modify the `doPost` function to select different sheets based on `contractType`
2. Create separate initialization functions for each sheet type

## Support

If you encounter issues:
1. Check the Apps Script execution log (View → Execution log)
2. Check browser console for JavaScript errors
3. Verify all URLs and IDs are correct
4. Test with the `testSubmission` function in Apps Script

## Next Steps

After setup is complete, you can:
1. Customize the form validation
2. Add email notifications on submission
3. Create reports and dashboards from the Google Sheet data
4. Set up automated workflows based on submissions
