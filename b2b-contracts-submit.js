/**
 * B2B Contracts Form Submission Handler
 * 
 * This script handles form submission and sends data to Google Apps Script
 * 
 * SETUP INSTRUCTIONS:
 * 1. Deploy the Apps Script as a web app
 * 2. Copy the web app URL
 * 3. Update APPS_SCRIPT_URL below with your web app URL
 */

// Configuration - UPDATE THIS URL after deploying Apps Script
const APPS_SCRIPT_URL =  'https://script.google.com/macros/s/AKfycbyoSqcDZUyXvvdDD_sa6G6rCJ1AcNgAJJSgOG-38KvKB3SFC7Ufj1K5JDs-OndHvYPs/exec'
/**
 * Collect form data and submit to Google Apps Script
 */
// Flag to prevent double submission
let isSubmitting = false;

async function submitB2BContract(event) {
  console.log('=== B2B Contract Submission Started ===');
  event.preventDefault();
  
  // Prevent double submission
  if (isSubmitting) {
    console.warn('[WARNING] Submission already in progress, ignoring duplicate call');
    event.preventDefault();
    return false;
  }
  
  // Show loading state and disable button immediately
  console.log('[1/7] Initializing submission...');
  const form = event.target;
  console.log('[1/7] Form element found:', form.id);
  
  const submitBtn = form.querySelector('button[type="submit"]') || 
                    document.querySelector('#b2bForm button[type="submit"]');
  
  if (!submitBtn) {
    console.error('[ERROR] Submit button not found');
    alert('Error: Submit button not found. Please refresh the page and try again.');
    return false;
  }
  
  // Disable button immediately to prevent double clicks
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  isSubmitting = true;
  
  try {
    console.log('[1/7] Submit button found:', originalText);
    
    // Collect form data
    console.log('[2/7] Collecting form data...');
    const formData = collectFormData();
    console.log('[2/7] Form data collected:', {
      contractType: formData.contractType,
      oppCount: formData.oppCount,
      aiesecerName: formData.aiesecerName,
      orgName: formData.orgName,
      industry: formData.industry,
      totalFields: Object.keys(formData).length
    });
    
    // Log iGTa opportunity data if it exists (for mixed contracts)
    if (formData.contractType && (formData.contractType.includes('3 iGV + 1 iGTa') || formData.contractType.includes('3 iGV + 1 iGTe'))) {
      console.log('[2/7] iGTa Opportunity 4 data:', {
        title: formData.opp_4_title,
        fieldOfWork: formData.opp_4_fieldOfWork,
        duration: formData.opp_4_duration,
        description: (formData.opp_4_description || '').substring(0, 50) + '...',
        skill1: formData.opp_4_skill1,
        skill2: formData.opp_4_skill2,
        skill3: formData.opp_4_skill3,
        background1: formData.opp_4_background1,
        background2: formData.opp_4_background2,
        background3: formData.opp_4_background3,
        language1: formData.opp_4_language1,
        language2: formData.opp_4_language2,
        language3: formData.opp_4_language3,
        requirement1: formData.opp_4_requirement1,
        requirement2: formData.opp_4_requirement2,
        requirement3: formData.opp_4_requirement3,
        accommodation: formData.opp_4_accommodation,
        transportation: formData.opp_4_transportation,
        salary: formData.opp_4_salary
      });
    }
    
    // Auto-populate predefined values
    console.log('[3/7] Auto-populating predefined project type values...');
    const beforePopulate = JSON.stringify(formData);
    populateOnTheMapValues(formData);
    const afterPopulate = JSON.stringify(formData);
    if (beforePopulate !== afterPopulate) {
      console.log('[3/7] Predefined values populated for project types');
      // Log which opportunities had predefined values
      const oppCount = parseInt(formData.oppCount || '0');
      for (let i = 1; i <= oppCount; i++) {
        if (formData[`opp_${i}_sdgNumber`]) {
          console.log(`[3/7]   Opportunity ${i}: Project Type "${formData[`opp_${i}_projectType`]}" - SDG ${formData[`opp_${i}_sdgNumber`]}`);
        }
      }
    } else {
      console.log('[3/7] No predefined values to populate');
    }
    
    // Validate required fields
    console.log('[4/7] Validating form data...');
    const validationResult = validateFormData(formData);
    if (!validationResult) {
      console.warn('[4/7] Validation failed');
      // Specific error messages are already shown in validateFormData
      // Only show generic message if no specific message was shown
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      isSubmitting = false; // Reset flag on validation failure
      return;
    }
    console.log('[4/7] Validation passed');
    
    // Submit to Apps Script
    console.log('[5/7] Preparing submission to Apps Script...');
    console.log('[5/7] Apps Script URL:', APPS_SCRIPT_URL);
    console.log('[5/7] Form data summary:', {
      contractType: formData.contractType,
      opportunities: formData.oppCount,
      aiesecer: formData.aiesecerName,
      organization: formData.orgName
    });
    
    const requestBody = new URLSearchParams(formData);
    console.log('[5/7] Request body length:', requestBody.toString().length, 'characters');
    
    // Log slot Min/Max fields being sent
    console.log('[5/7] Slot fields in request:');
    for (let i = 1; i <= parseInt(formData.oppCount || '0'); i++) {
      const slot1Min = formData[`opp_${i}_slot1MinStart`];
      const slot1Max = formData[`opp_${i}_slot1MaxStart`];
      const slot2Min = formData[`opp_${i}_slot2MinStart`];
      const slot2Max = formData[`opp_${i}_slot2MaxStart`];
      console.log(`  Opp ${i}: Slot1Min="${slot1Min}", Slot1Max="${slot1Max}", Slot2Min="${slot2Min}", Slot2Max="${slot2Max}"`);
    }
    
    console.log('[6/7] Sending POST request...');
    
    // Check if running from file:// protocol (CORS issue)
    if (window.location.protocol === 'file:') {
      console.warn('[WARNING] File opened via file:// protocol - CORS may block the request');
      console.warn('[WARNING] For best results, serve the HTML file from a web server (http:// or https://)');
    }
    
    let response;
    try {
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors', // Explicitly set CORS mode
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody
      });
    } catch (fetchError) {
      // CORS or network error
      if (fetchError.message === 'Failed to fetch' || fetchError.name === 'TypeError') {
        console.error('[ERROR] CORS or network error detected');
        console.error('[ERROR] This usually happens when:');
        console.error('  1. HTML file is opened via file:// protocol (use a web server instead)');
        console.error('  2. Apps Script Web App is not properly deployed');
        console.error('  3. Apps Script needs to be redeployed with "Who has access: Anyone"');
        throw new Error('Network error: Please ensure the HTML file is served from a web server (not file://) and the Apps Script is properly deployed. Error: ' + fetchError.message);
      }
      throw fetchError;
    }
    
    console.log('[6/7] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    const responseText = await response.text();
    console.log('[6/7] Response text:', responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('[6/7] Response parsed successfully:', result);
    } catch (e) {
      console.error('[ERROR] Failed to parse JSON response:', e);
      console.error('[ERROR] Raw response:', responseText);
      throw new Error('Invalid response from server: ' + responseText);
    }
    
    console.log('[7/7] Processing submission result...');
    if (result.success) {
      console.log('[SUCCESS] Contract submitted successfully!');
      console.log('[7/7] Resetting form...');
      alert('Contract submitted successfully!');
      event.target.reset();
      
      // Reset opportunity count and container
      const container = document.getElementById('opportunities-container');
      if (container) {
        container.innerHTML = '';
        console.log('[7/7] Opportunities container cleared');
      }
      // Reset oppCount if it exists in global scope
      if (typeof oppCount !== 'undefined') {
        oppCount = 0;
        console.log('[7/7] Opportunity count reset to 0');
      }
      // Call updateMaxOpportunities if it exists
      if (typeof updateMaxOpportunities === 'function') {
        updateMaxOpportunities();
        console.log('[7/7] Max opportunities updated');
      }
      console.log('=== B2B Contract Submission Completed Successfully ===');
    } else {
      console.error('[ERROR] Submission failed:', result.error || 'Unknown error');
      alert('Error submitting contract: ' + (result.error || 'Unknown error'));
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    console.log('[7/7] Submit button re-enabled');
    isSubmitting = false; // Reset flag on completion
    
  } catch (error) {
    console.error('=== B2B Contract Submission Error ===');
    console.error('[ERROR] Error type:', error.name);
    console.error('[ERROR] Error message:', error.message);
    console.error('[ERROR] Error stack:', error.stack);
    console.error('[ERROR] Full error object:', error);
    console.error('=== End Error Details ===');
    
    alert('An error occurred while submitting. Please try again. Check the console for details.');
    
    // Re-enable submit button
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]') || 
                      document.querySelector('#b2bForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Contract Data';
      console.log('[ERROR] Submit button re-enabled after error');
    }
    
    isSubmitting = false; // Reset flag on error
  }
}

/**
 * Collect all form data into a structured object
 */
function collectFormData() {
  console.log('[collectFormData] Starting data collection...');
  const form = document.getElementById('b2bForm');
  if (!form) {
    console.error('[collectFormData] Form not found!');
    return {};
  }
  const formData = new FormData(form);
  const data = {};
  
  // Basic AIESECer information
  console.log('[collectFormData] Collecting AIESECer information...');
  data.aiesecerName = form.querySelector('input[placeholder*="Full Name"]')?.value || '';
  data.aiesecerEmail = form.querySelector('input[type="email"][placeholder*="aiesec.net"]')?.value || '';
  data.aiesecerRole = form.querySelector('select').options[form.querySelector('select').selectedIndex]?.text || '';
  data.lcName = Array.from(form.querySelectorAll('select'))[1]?.value || '';
  console.log('[collectFormData] AIESECer info:', {
    name: data.aiesecerName,
    email: data.aiesecerEmail,
    role: data.aiesecerRole,
    lc: data.lcName
  });
  
  // Contract type
  data.contractType = document.getElementById('contractType')?.value || '';
  console.log('[collectFormData] Contract type:', data.contractType);
  
  // Organization information
  data.orgName = form.querySelector('input[placeholder*="Organization Name"]')?.value || 
                 Array.from(form.querySelectorAll('input[type="text"]')).find(inp => inp.previousElementSibling?.textContent?.includes('Organization Name'))?.value || '';
  data.orgEmail = form.querySelector('input[name="orgEmail"]')?.value || 
                  form.querySelector('input[placeholder*="Organization Email"]')?.value || 
                  Array.from(form.querySelectorAll('input[type="email"]')).find(inp => 
                    inp.previousElementSibling?.textContent?.includes('Organization Email'))?.value || '';
  console.log('[collectFormData] Organization Email:', data.orgEmail);
  data.website = form.querySelector('input[type="url"]')?.value || '';
  data.phone = form.querySelector('input[type="tel"]')?.value || '';
  data.address = form.querySelector('textarea')?.value || '';
  
  // Contact person
  data.contactName = Array.from(form.querySelectorAll('input[type="text"]')).find(inp => 
    inp.previousElementSibling?.textContent?.includes('Contact Name'))?.value || '';
  data.contactEmail = Array.from(form.querySelectorAll('input[type="email"]')).find(inp => 
    inp.previousElementSibling?.textContent?.includes('Contact Email'))?.value || '';
  data.contactPosition = Array.from(form.querySelectorAll('input[type="text"]')).find(inp => 
    inp.previousElementSibling?.textContent?.includes('Contact Position'))?.value || '';
  data.contactPhone = Array.from(form.querySelectorAll('input[type="tel"]')).find(inp => 
    inp.previousElementSibling?.textContent?.includes('Contact Phone'))?.value || '';
  
  // Organization size and industry
  data.orgSize = Array.from(form.querySelectorAll('select')).find(sel => 
    sel.previousElementSibling?.textContent?.includes('Organization Size'))?.value || '';
  
  // Industry - find select inside industryField div
  const industryFieldDiv = document.getElementById('industryField');
  const industrySelect = industryFieldDiv ? industryFieldDiv.querySelector('select') : null;
  data.industry = industrySelect?.value || '';
  console.log('[collectFormData] Industry:', data.industry);
  
  data.industryOther = document.getElementById('industryOther')?.value || '';
  console.log('[collectFormData] Industry Other:', data.industryOther);
  
  // Count opportunities
  const opportunities = form.querySelectorAll('.opp-card');
  data.oppCount = opportunities.length;
  console.log('[collectFormData] Found', data.oppCount, 'opportunities');
  
  // Collect opportunity data
  opportunities.forEach((opp, index) => {
    const oppNum = index + 1;
    const prefix = `opp_${oppNum}_`;
    
    // Check if this is an iGTa/e opportunity
    const contractType = data.contractType || '';
    
    // Method 1: Check contract type first (most reliable)
    // Pure iGV contracts: contains "iGV" but NOT "iGTa" or "iGTe" (unless it's a mixed contract)
    const isMixed = contractType.includes('3 iGV + 1 iGTa') || contractType.includes('3 iGV + 1 iGTe');
    const isPureIGVContract = contractType.includes('iGV') && 
                              !contractType.includes('iGTa') && 
                              !contractType.includes('iGTe') && 
                              !isMixed;
    // Pure iGTa contracts: contains "iGTa" or "iGTe" but NOT mixed
    const isPureIGTaContract = (contractType.includes('iGTa') || contractType.includes('iGTe')) && !isMixed;
    
    // Method 2: Check DOM structure as fallback
    // iGTa has "Duration" label (iGV does NOT have this)
    const hasDurationLabel = Array.from(opp.querySelectorAll('label')).some(lbl => 
      lbl.textContent && lbl.textContent.trim().includes('Duration'));
    // iGTa has "Field(s) of Work" (plural with parentheses), iGV has "Field of Work" (singular)
    const hasFieldsOfWorkLabel = Array.from(opp.querySelectorAll('label')).some(lbl => 
      lbl.textContent && lbl.textContent.includes('Field(s) of Work'));
    
    // Determine if this is iGTa:
    // Priority 1: Pure iGTa contract → all opps are iGTa
    // Priority 2: Mixed contract → only opp 4 is iGTa
    // Priority 3: Pure iGV contract → all opps are iGV (NOT iGTa)
    // Priority 4: Fallback to DOM structure (has Duration label)
    let isIGTa = false;
    if (isPureIGTaContract) {
      // Pure iGTa contract: all opportunities are iGTa
      isIGTa = true;
    } else if (isMixed) {
      // Mixed contract: only opportunity 4 is iGTa
      isIGTa = (oppNum === 4);
    } else if (isPureIGVContract) {
      // Pure iGV contract: all opportunities are iGV (NOT iGTa)
      isIGTa = false;
    } else {
      // Fallback: check DOM structure (has Duration label = iGTa)
      isIGTa = hasDurationLabel;
    }
    
    console.log(`[collectFormData] Opportunity ${oppNum} detection - Contract: "${contractType}", isPureIGV: ${isPureIGVContract}, isMixed: ${isMixed}, isPureIGTa: ${isPureIGTaContract}, hasDurationLabel: ${hasDurationLabel}, hasFieldsOfWorkLabel: ${hasFieldsOfWorkLabel}, isIGTa: ${isIGTa}`);
    
    // Role title
    data[prefix + 'title'] = opp.querySelector('input[name*="title"]')?.value || '';
    
    if (isIGTa) {
      // iGTa/e fields - use simpler, direct selectors
      
      // Duration - find label then get select in same parent or next sibling
      const durationLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Duration'));
      let durationSelect = null;
      if (durationLabel) {
        // Check if select is in same parent (col-md-4 div)
        durationSelect = durationLabel.parentElement?.querySelector('select');
        // If not found, check next sibling
        if (!durationSelect) {
          durationSelect = durationLabel.nextElementSibling;
        }
      }
      // Fallback: get first select
      if (!durationSelect) {
        durationSelect = Array.from(opp.querySelectorAll('select'))[0];
      }
      data[prefix + 'duration'] = durationSelect?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Duration: "${data[prefix + 'duration']}" (select found: ${!!durationSelect}, value: ${durationSelect?.value})`);
      
      // Field(s) of Work - find label then get select in same parent or next sibling
      const fieldOfWorkLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && (lbl.textContent.includes('Field(s) of Work') || lbl.textContent.includes('Field of Work')));
      let fieldOfWorkSelect = null;
      if (fieldOfWorkLabel) {
        // Check if select is in same parent (mb-3 div)
        fieldOfWorkSelect = fieldOfWorkLabel.parentElement?.querySelector('select');
        // If not found, check next sibling
        if (!fieldOfWorkSelect) {
          fieldOfWorkSelect = fieldOfWorkLabel.nextElementSibling;
        }
      }
      // Fallback: get second select (after Duration)
      if (!fieldOfWorkSelect) {
        const allSelects = Array.from(opp.querySelectorAll('select'));
        fieldOfWorkSelect = allSelects[1] || allSelects[0];
      }
      data[prefix + 'fieldOfWork'] = fieldOfWorkSelect?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Field of Work: "${data[prefix + 'fieldOfWork']}" (select found: ${!!fieldOfWorkSelect}, value: ${fieldOfWorkSelect?.value})`);
      
      // Job Description - find textarea
      const descTextareaIGT = opp.querySelector('textarea[name*="description"]') || 
                              Array.from(opp.querySelectorAll('textarea')).find(ta => 
                                !ta.id?.includes('other')) ||
                              opp.querySelector('textarea');
      data[prefix + 'description'] = descTextareaIGT?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Job description: "${data[prefix + 'description']}"`);
      
      // Skills - find by label, then get inputs in the same col-md-3 div
      const skillsLabelIGT = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Skills'));
      let skillsContainerIGT = null;
      if (skillsLabelIGT) {
        skillsContainerIGT = skillsLabelIGT.closest('.col-md-3');
      }
      const skillInputsIGT = skillsContainerIGT ? 
        Array.from(skillsContainerIGT.querySelectorAll('input[placeholder*="Skill"]')) :
        Array.from(opp.querySelectorAll('input[placeholder*="Skill"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Found ${skillInputsIGT.length} skill inputs`);
      skillInputsIGT.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `skill${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Skill ${i + 1}: "${data[prefix + `skill${i + 1}`]}"`);
        }
      });
      
      // Backgrounds - find by label, then get inputs in the same col-md-3 div
      const bgLabelIGT = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Backgrounds'));
      let bgContainerIGT = null;
      if (bgLabelIGT) {
        bgContainerIGT = bgLabelIGT.closest('.col-md-3');
      }
      const bgInputsIGT = bgContainerIGT ? 
        Array.from(bgContainerIGT.querySelectorAll('input[placeholder*="Background"]')) :
        Array.from(opp.querySelectorAll('input[placeholder*="Background"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Found ${bgInputsIGT.length} background inputs`);
      bgInputsIGT.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `background${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Background ${i + 1}: "${data[prefix + `background${i + 1}`]}"`);
        }
      });
      
      // Languages - find by label, then get inputs in the same col-md-3 div
      const langLabelIGT = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Languages'));
      let langContainerIGT = null;
      if (langLabelIGT) {
        langContainerIGT = langLabelIGT.closest('.col-md-3');
      }
      const langInputsIGT = langContainerIGT ? 
        Array.from(langContainerIGT.querySelectorAll('input[placeholder*="Language"]')) :
        Array.from(opp.querySelectorAll('input[placeholder*="Language"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Found ${langInputsIGT.length} language inputs`);
      langInputsIGT.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `language${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Language ${i + 1}: "${data[prefix + `language${i + 1}`]}"`);
        }
      });
      
      // Requirements - find by label, then get inputs in the same col-md-3 div
      const reqLabelIGT = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && (lbl.textContent.includes('Other Requirements') || lbl.textContent.includes('Requirements')));
      let reqContainerIGT = null;
      if (reqLabelIGT) {
        reqContainerIGT = reqLabelIGT.closest('.col-md-3');
      }
      const reqInputsIGT = reqContainerIGT ? 
        Array.from(reqContainerIGT.querySelectorAll('input[placeholder*="Requirement"]')) :
        Array.from(opp.querySelectorAll('input[placeholder*="Requirement"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Found ${reqInputsIGT.length} requirement inputs`);
      reqInputsIGT.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `requirement${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Requirement ${i + 1}: "${data[prefix + `requirement${i + 1}`]}"`);
        }
      });
      
      // Slots - iGTa/e has simpler structure (just Start Date, not Min/Max)
      const allDateInputs = Array.from(opp.querySelectorAll('input[type="date"]'));
      const allNumberInputs = Array.from(opp.querySelectorAll('input[type="number"]'));
      
      // Slot 1: first date input, first number input
      if (allDateInputs[0]) {
        data[prefix + 'slot1StartDate'] = allDateInputs[0].value || '';
        console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Slot 1 Start Date: "${data[prefix + 'slot1StartDate']}"`);
      }
      if (allNumberInputs[0]) {
        data[prefix + 'slot1Opens'] = allNumberInputs[0].value || '';
        console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Slot 1 Opens: "${data[prefix + 'slot1Opens']}"`);
      }
      
      // Slot 2: second date input, second number input
      if (allDateInputs[1]) {
        data[prefix + 'slot2StartDate'] = allDateInputs[1].value || '';
        console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Slot 2 Start Date: "${data[prefix + 'slot2StartDate']}"`);
      }
      if (allNumberInputs[1]) {
        data[prefix + 'slot2Opens'] = allNumberInputs[1].value || '';
        console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Slot 2 Opens: "${data[prefix + 'slot2Opens']}"`);
      }
      
      // Other fields
      data[prefix + 'workingHours'] = Array.from(opp.querySelectorAll('input[type="text"]')).find(inp => 
        inp.previousElementSibling?.textContent?.includes('Working Hours'))?.value || '';
      data[prefix + 'salary'] = Array.from(opp.querySelectorAll('input[type="text"]')).find(inp => 
        inp.previousElementSibling?.textContent?.includes('Salary'))?.value || '';
      
      // Weekend days (checkboxes) - specifically from weekend-days-container
      const weekendContainer = opp.querySelector('.weekend-days-container');
      const weekendCheckboxes = weekendContainer ? 
        Array.from(weekendContainer.querySelectorAll('input[type="checkbox"]')) :
        Array.from(opp.querySelectorAll('input[type="checkbox"]'));
      const weekendDays = Array.from(weekendCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .join(', ');
      data[prefix + 'weekendDays'] = weekendDays;
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Weekend Days: "${data[prefix + 'weekendDays']}" (found ${weekendCheckboxes.length} checkboxes, ${weekendCheckboxes.filter(cb => cb.checked).length} checked)`);
      
      // Accommodation - find label then get select
      const accommodationLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Accommodation'));
      const accommodationSelect = accommodationLabel ? 
        accommodationLabel.parentElement?.querySelector('select') ||
        accommodationLabel.nextElementSibling :
        Array.from(opp.querySelectorAll('select')).find(sel => {
          const label = sel.previousElementSibling;
          return label && label.textContent && label.textContent.includes('Accommodation');
        });
      data[prefix + 'accommodation'] = accommodationSelect?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Accommodation: "${data[prefix + 'accommodation']}" (select found: ${!!accommodationSelect}, value: ${accommodationSelect?.value})`);
      
      // Transportation - find label then get select
      const transportationLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Transportation'));
      const transportationSelect = transportationLabel ? 
        transportationLabel.parentElement?.querySelector('select') ||
        transportationLabel.nextElementSibling :
        Array.from(opp.querySelectorAll('select')).find(sel => {
          const label = sel.previousElementSibling;
          return label && label.textContent && label.textContent.includes('Transportation');
        });
      data[prefix + 'transportation'] = transportationSelect?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Transportation: "${data[prefix + 'transportation']}" (select found: ${!!transportationSelect}, value: ${transportationSelect?.value})`);
      
      // Meals - find label then get input
      const mealsLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Meals'));
      const mealsInput = mealsLabel ? 
        mealsLabel.parentElement?.querySelector('input[type="text"]') ||
        mealsLabel.nextElementSibling :
        Array.from(opp.querySelectorAll('input[type="text"]')).find(inp => {
          const label = inp.previousElementSibling;
          return label && label.textContent && label.textContent.includes('Meals');
        });
      data[prefix + 'meals'] = mealsInput?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGTa/e) - Meals: "${data[prefix + 'meals']}" (input found: ${!!mealsInput}, value: ${mealsInput?.value})`);
        
    } else {
      // iGV fields
      const projectTypeSelect = Array.from(opp.querySelectorAll('select')).find(sel => 
        sel.previousElementSibling?.textContent?.includes('Project Type'));
      if (projectTypeSelect && projectTypeSelect.selectedIndex > 0) {
        const selectedOption = projectTypeSelect.options[projectTypeSelect.selectedIndex];
        // Use text content since options don't have explicit values
        data[prefix + 'projectType'] = selectedOption ? selectedOption.text.trim() : '';
      }
      data[prefix + 'fieldOfWork'] = Array.from(opp.querySelectorAll('select')).find(sel => 
        sel.previousElementSibling?.textContent?.includes('Field of Work'))?.value || '';
      data[prefix + 'fieldOfWorkOther'] = opp.querySelector('input[id*="other_field"]')?.value || '';
      
      // Job Description - find textarea that's not for "other" field
      const allTextareas = Array.from(opp.querySelectorAll('textarea'));
      const descTextarea = allTextareas.find(ta => 
        !ta.id || (!ta.id.includes('other') && !ta.placeholder?.includes('specify'))) ||
        allTextareas.find(ta => ta.name?.includes('description')) ||
        allTextareas[0]; // Fallback to first textarea
      data[prefix + 'description'] = descTextarea?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} - Job description: "${data[prefix + 'description']}"`);
      
      // Skills - find inputs within the skills row (check for both "Required Skills" and "Skills")
      const skillsLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && (lbl.textContent.includes('Required Skills') || lbl.textContent.includes('Skills')));
      let skillsRow = null;
      if (skillsLabel) {
        skillsRow = skillsLabel.nextElementSibling;
        if (!skillsRow || !skillsRow.querySelector('input[placeholder*="Skill"]')) {
          skillsRow = skillsLabel.parentElement?.nextElementSibling;
        }
        // If still not found, check if label is in a col-md-3 div, then get the parent row
        if (!skillsRow || !skillsRow.querySelector('input[placeholder*="Skill"]')) {
          const labelParent = skillsLabel.closest('.col-md-3');
          if (labelParent) {
            skillsRow = labelParent;
          }
        }
      }
      const skillInputs = skillsRow ? Array.from(skillsRow.querySelectorAll('input[placeholder*="Skill"]')) : 
                           Array.from(opp.querySelectorAll('input[placeholder*="Skill"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Found ${skillInputs.length} skill inputs`);
      skillInputs.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `skill${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Skill ${i + 1}: "${data[prefix + `skill${i + 1}`]}"`);
        }
      });
      
      // Backgrounds - find inputs within the backgrounds row (check for both "Required Backgrounds" and "Backgrounds")
      const bgLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && (lbl.textContent.includes('Required Backgrounds') || lbl.textContent.includes('Backgrounds')));
      let bgRow = null;
      if (bgLabel) {
        bgRow = bgLabel.nextElementSibling;
        if (!bgRow || !bgRow.querySelector('input[placeholder*="Background"]')) {
          bgRow = bgLabel.parentElement?.nextElementSibling;
        }
        // If still not found, check if label is in a col-md-3 div, then get the parent row
        if (!bgRow || !bgRow.querySelector('input[placeholder*="Background"]')) {
          const labelParent = bgLabel.closest('.col-md-3');
          if (labelParent) {
            bgRow = labelParent;
          }
        }
      }
      const bgInputs = bgRow ? Array.from(bgRow.querySelectorAll('input[placeholder*="Background"]')) : 
                       Array.from(opp.querySelectorAll('input[placeholder*="Background"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Found ${bgInputs.length} background inputs`);
      bgInputs.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `background${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Background ${i + 1}: "${data[prefix + `background${i + 1}`]}"`);
        }
      });
      
      // Languages - find inputs within the languages row (check for both "Required Languages" and "Languages")
      const langLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && (lbl.textContent.includes('Required Languages') || lbl.textContent.includes('Languages')));
      let langRow = null;
      if (langLabel) {
        langRow = langLabel.nextElementSibling;
        if (!langRow || !langRow.querySelector('input[placeholder*="Language"]')) {
          langRow = langLabel.parentElement?.nextElementSibling;
        }
        // If still not found, check if label is in a col-md-3 div, then get the parent row
        if (!langRow || !langRow.querySelector('input[placeholder*="Language"]')) {
          const labelParent = langLabel.closest('.col-md-3');
          if (labelParent) {
            langRow = labelParent;
          }
        }
      }
      const langInputs = langRow ? Array.from(langRow.querySelectorAll('input[placeholder*="Language"]')) : 
                           Array.from(opp.querySelectorAll('input[placeholder*="Language"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Found ${langInputs.length} language inputs`);
      langInputs.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `language${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Language ${i + 1}: "${data[prefix + `language${i + 1}`]}"`);
        }
      });
      
      // Requirements - find inputs within the requirements row (check for both "Specific Requirements" and "Other Requirements")
      const reqLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && (lbl.textContent.includes('Specific Requirements') || lbl.textContent.includes('Other Requirements') || lbl.textContent.includes('Requirements')));
      let reqRow = null;
      if (reqLabel) {
        reqRow = reqLabel.nextElementSibling;
        if (!reqRow || !reqRow.querySelector('input[placeholder*="Req"]')) {
          reqRow = reqLabel.parentElement?.nextElementSibling;
        }
        // If still not found, check if label is in a col-md-3 div, then get the parent row
        if (!reqRow || !reqRow.querySelector('input[placeholder*="Req"]')) {
          const labelParent = reqLabel.closest('.col-md-3');
          if (labelParent) {
            reqRow = labelParent;
          }
        }
      }
      const reqInputs = reqRow ? Array.from(reqRow.querySelectorAll('input[placeholder*="Req"]')) : 
                        Array.from(opp.querySelectorAll('input[placeholder*="Req"]')).slice(0, 3);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Found ${reqInputs.length} requirement inputs`);
      reqInputs.forEach((inp, i) => {
        if (i < 3) {
          data[prefix + `requirement${i + 1}`] = inp.value || '';
          console.log(`[collectFormData] Opportunity ${oppNum} - Requirement ${i + 1}: "${data[prefix + `requirement${i + 1}`]}"`);
        }
      });
      
      // Duration (iGV) - find by label then get select, similar to iGTa approach
      const durationLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
        lbl.textContent && lbl.textContent.includes('Duration'));
      let durationSelect = null;
      if (durationLabel) {
        // Check if select is in same parent (col-md-6 div)
        durationSelect = durationLabel.parentElement?.querySelector('select[name*="duration"]');
        // If not found, check next sibling
        if (!durationSelect) {
          durationSelect = durationLabel.nextElementSibling;
        }
      }
      // Fallback: find select by name attribute
      if (!durationSelect) {
        durationSelect = opp.querySelector('select[name*="duration"]');
      }
      // Get value - always get text content of selected option since options don't have explicit value attributes
      if (durationSelect) {
        if (durationSelect.selectedIndex > 0 && durationSelect.selectedIndex < durationSelect.options.length) {
          // Get text content of selected option (options don't have explicit value attributes)
          const selectedOption = durationSelect.options[durationSelect.selectedIndex];
          data[prefix + 'duration'] = selectedOption ? selectedOption.text.trim() : '';
          // Also try value property as fallback
          if (!data[prefix + 'duration'] && durationSelect.value) {
            data[prefix + 'duration'] = durationSelect.value.trim();
          }
        } else {
          data[prefix + 'duration'] = '';
        }
        console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Duration: "${data[prefix + 'duration']}" (select found: ${!!durationSelect}, selectedIndex: ${durationSelect.selectedIndex}, value prop: "${durationSelect.value}", option text: "${durationSelect.selectedIndex > 0 ? durationSelect.options[durationSelect.selectedIndex]?.text : 'N/A'}")`);
      } else {
        data[prefix + 'duration'] = '';
        console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Duration: SELECT ELEMENT NOT FOUND`);
      }
      
      // Slots (iGV has Min/Max Start dates) - use robust selectors
      // Slot 1
      let slot1MinStart = opp.querySelector('input[name*="slot1MinStart"]');
      let slot1MaxStart = opp.querySelector('input[name*="slot1MaxStart"]');
      let slot1Opens = opp.querySelector('input[name*="slot1Opens"]');
      
      // Fallback: find by label if name selector fails
      if (!slot1MinStart) {
        const slot1MinLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
          lbl.textContent && lbl.textContent.includes('Min Start') && lbl.textContent.includes('Slot 1'));
        if (slot1MinLabel) {
          slot1MinStart = slot1MinLabel.nextElementSibling || slot1MinLabel.parentElement?.querySelector('input[type="date"]');
        }
      }
      if (!slot1MaxStart) {
        const slot1MaxLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
          lbl.textContent && lbl.textContent.includes('Max Start') && lbl.textContent.includes('Slot 1'));
        if (slot1MaxLabel) {
          slot1MaxStart = slot1MaxLabel.nextElementSibling || slot1MaxLabel.parentElement?.querySelector('input[type="date"]');
        }
      }
      
      data[prefix + 'slot1MinStart'] = slot1MinStart?.value || '';
      data[prefix + 'slot1MaxStart'] = slot1MaxStart?.value || '';
      data[prefix + 'slot1Opens'] = slot1Opens?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Slot 1 Min Start: "${data[prefix + 'slot1MinStart']}" (found: ${!!slot1MinStart}), Max Start: "${data[prefix + 'slot1MaxStart']}" (found: ${!!slot1MaxStart}), Opens: "${data[prefix + 'slot1Opens']}" (found: ${!!slot1Opens})`);
      
      // Slot 2 (iGV has Min/Max Start dates) - use robust selectors
      let slot2MinStart = opp.querySelector('input[name*="slot2MinStart"]');
      let slot2MaxStart = opp.querySelector('input[name*="slot2MaxStart"]');
      let slot2Opens = opp.querySelector('input[name*="slot2Opens"]');
      
      // Fallback: find by label if name selector fails
      if (!slot2MinStart) {
        const slot2MinLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
          lbl.textContent && lbl.textContent.includes('Min Start') && lbl.textContent.includes('Slot 2'));
        if (slot2MinLabel) {
          slot2MinStart = slot2MinLabel.nextElementSibling || slot2MinLabel.parentElement?.querySelector('input[type="date"]');
        }
      }
      if (!slot2MaxStart) {
        const slot2MaxLabel = Array.from(opp.querySelectorAll('label')).find(lbl => 
          lbl.textContent && lbl.textContent.includes('Max Start') && lbl.textContent.includes('Slot 2'));
        if (slot2MaxLabel) {
          slot2MaxStart = slot2MaxLabel.nextElementSibling || slot2MaxLabel.parentElement?.querySelector('input[type="date"]');
        }
      }
      
      data[prefix + 'slot2MinStart'] = slot2MinStart?.value || '';
      data[prefix + 'slot2MaxStart'] = slot2MaxStart?.value || '';
      data[prefix + 'slot2Opens'] = slot2Opens?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Slot 2 Min Start: "${data[prefix + 'slot2MinStart']}" (found: ${!!slot2MinStart}), Max Start: "${data[prefix + 'slot2MaxStart']}" (found: ${!!slot2MaxStart}), Opens: "${data[prefix + 'slot2Opens']}" (found: ${!!slot2Opens})`);
      
      // Other fields
      data[prefix + 'workingHours'] = Array.from(opp.querySelectorAll('input[type="text"]')).find(inp => 
        inp.previousElementSibling?.textContent?.includes('Working Hours'))?.value || '';
      
      // Weekend days (checkboxes) - specifically from weekend-days-container
      const weekendContainer = opp.querySelector('.weekend-days-container');
      const weekendCheckboxes = weekendContainer ? 
        Array.from(weekendContainer.querySelectorAll('input[type="checkbox"]')) :
        Array.from(opp.querySelectorAll('input[type="checkbox"]'));
      const weekendDays = Array.from(weekendCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .join(', ');
      data[prefix + 'weekendDays'] = weekendDays;
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Weekend Days: "${data[prefix + 'weekendDays']}" (found ${weekendCheckboxes.length} checkboxes, ${weekendCheckboxes.filter(cb => cb.checked).length} checked)`);
      
      // Transportation and Meals
      data[prefix + 'transportation'] = Array.from(opp.querySelectorAll('select')).find(sel => 
        sel.previousElementSibling?.textContent?.includes('Transportation'))?.value || '';
      data[prefix + 'meals'] = Array.from(opp.querySelectorAll('input[type="text"]')).find(inp => 
        inp.previousElementSibling?.textContent?.includes('Meals'))?.value || '';
      
      // Accommodation Provided By and Accommodation Covered By (iGV only - replaces old "Accommodation" field)
      const accommodationProvidedBySelect = opp.querySelector('select[name*="accommodationProvidedBy"]');
      const accommodationCoveredBySelect = opp.querySelector('select[name*="accommodationCoveredBy"]');
      data[prefix + 'accommodationProvidedBy'] = accommodationProvidedBySelect?.value || '';
      data[prefix + 'accommodationCoveredBy'] = accommodationCoveredBySelect?.value || '';
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Accommodation Provided By: "${data[prefix + 'accommodationProvidedBy']}"`);
      console.log(`[collectFormData] Opportunity ${oppNum} (iGV) - Accommodation Covered By: "${data[prefix + 'accommodationCoveredBy']}"`);
      // Note: iGV does NOT have the old "accommodation" field - it's replaced by accommodationProvidedBy and accommodationCoveredBy
    }
  });
  
  console.log('[collectFormData] Data collection complete. Total fields:', Object.keys(data).length);
  console.log('[collectFormData] Opportunity count:', data.oppCount);
  
  // Log all duration fields for debugging
  console.log('[collectFormData] Duration fields collected:');
  for (let i = 1; i <= parseInt(data.oppCount || '0'); i++) {
    const durationKey = `opp_${i}_duration`;
    if (data[durationKey] !== undefined) {
      console.log(`  Opportunity ${i}: "${data[durationKey]}"`);
    }
  }
  
  // Log all slot Min/Max fields for debugging
  console.log('[collectFormData] Slot Min/Max fields collected:');
  for (let i = 1; i <= parseInt(data.oppCount || '0'); i++) {
    const slot1MinKey = `opp_${i}_slot1MinStart`;
    const slot1MaxKey = `opp_${i}_slot1MaxStart`;
    const slot2MinKey = `opp_${i}_slot2MinStart`;
    const slot2MaxKey = `opp_${i}_slot2MaxStart`;
    console.log(`  Opportunity ${i}:`);
    console.log(`    Slot 1 Min: "${data[slot1MinKey] || 'NOT FOUND'}"`);
    console.log(`    Slot 1 Max: "${data[slot1MaxKey] || 'NOT FOUND'}"`);
    console.log(`    Slot 2 Min: "${data[slot2MinKey] || 'NOT FOUND'}"`);
    console.log(`    Slot 2 Max: "${data[slot2MaxKey] || 'NOT FOUND'}"`);
  }
  
  return data;
}

/**
 * Auto-populate predefined values for specific project types
 */
function populateOnTheMapValues(data) {
  console.log('[populateOnTheMapValues] Starting auto-population...');
  const oppCount = parseInt(data.oppCount || '0');
  console.log('[populateOnTheMapValues] Processing', oppCount, 'opportunities');
  
  // Predefined values for different project types
  const projectTypeData = {
    'Heartbeat - SDG3.4': {
      sdgNumber: '3.4',
      sdgTarget: 'SDG 3.4 – By 2030, reduce by one third premature mortality from non-communicable diseases through prevention and treatment, and promote mental health and well-being',
      roleDescription: 'Global Volunteers engage in community outreach within the public health field by creating and delivering activities that raise awareness about prevention of non-communicable diseases, healthy lifestyle habits, and mental health',
      projectDescription: 'The project aims to impact SDG 3 by increasing awareness about the prevention of non-communicable diseases and highlighting the importance of mental health and well-being within the community',
      expectedOutcomes: 'Increase awareness of healthy lifestyle behaviors and their connection to NCD prevention\nRaise awareness about the importance of mental health and well-being in society',
      expectedOutputs: 'Number of workshops or sessions conducted on personal wellness and healthy lifestyle practices\nNumber of people reached through outreach campaigns and awareness activities\nNumber of activities implemented as part of the outreach campaign',
      week1: 'Onboarding and planning\nGet to know NGO and non-profit representatives\nAnalyze NGO progress and focus areas related to NCDs, substance abuse, and mental health initiatives\nResearch priority non-communicable diseases, substance abuse issues, and mental health needs within the community\nBuild the activity plan for the following weeks based on NGO and community needs, focusing on the most relevant health issues',
      week2: 'Planning outreach campaign\nDefine the public target based on age group and health issue (NCDs, mental health, substance abuse)\nMap and approach stakeholders who can realistically contribute to the project\nCreate an online presence and engagement through social media to boost community interest\nBuild physical community presence through participation in community spaces, pamphlet distribution, and engagement activities\nPlan and prepare materials for outcome data collection',
      week3: 'Preparation and assessment\nRun initial assessments for outcome measurement\nPrepare training sessions and workshop materials\nDeliver an introductory workshop for G2K project beneficiaries and present the educational roadmap\nConduct alignment sessions with partner organizations to prepare for activity implementation',
      week4: 'Healthy lifestyle week\nWorkshop: Key elements of a healthy lifestyle\nExercise session: Demonstration of basic at-home physical activities (dancing, conscious walking, morning running, etc.)\nNutrition workshop: Healthy eating habits, basic nutrition, and balanced diet (partner-led session recommended)\nSubstance abuse workshop: Consequences of substance abuse and its link to NCDs and mental health (partner-led session recommended)\nSession: Good habits commitment – beneficiaries reflect and commit to adopting healthier habits',
      week5: 'Mindfulness week\nWorkshop: Acts of kindness and the importance of gratitude\nMeditation session: Understanding and practicing meditation (partner-led session recommended)\nJournaling workshop: Building reading and journaling habits to support mental health\nYoga session: Yoga demonstration and mindfulness practice (partner-led session recommended)\nWorkshop: Connecting with your emotions',
      week6: 'Outcome analysis and reporting\nCollect data from beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results, including post-project awareness levels\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives\nShare campaign outcomes and final recommendations for sustaining healthy habits with beneficiaries'
    },
    'Global classroom - SDG4.6': {
      sdgNumber: '4.6',
      sdgTarget: 'SDG 4.6 – By 2030, ensure that all youth and a substantial proportion of adults achieve literacy and numeracy',
      roleDescription: 'Global Volunteers directly contribute to improving community literacy and numeracy through non-formal education methods, addressing mathematics, science, and languages while fostering intercultural understanding',
      projectDescription: 'The project aims to contribute to SDG 4 by providing quality education spaces for people of all ages, ensuring access to literacy, numeracy, science, and language learning opportunities',
      expectedOutcomes: 'Increase basic literacy skills among children, youth, and adults (reading, interpreting, and creating written texts)\nIncrease basic numeracy skills among children, youth, and adults (counting, prices, percentages, and daily numerical use)',
      expectedOutputs: 'Number of illiterate or innumerate people connected with peers who support learning to read, write, or count\nNumber of materials developed that showcase available literacy and numeracy learning services\nNumber of lessons and workshops delivered on reading, numeracy, science, and languages',
      week1: 'Preparation\nOnboarding space with school representatives to understand the current educational scenario and student needs (math, reading, foreign languages, etc.)\nSet up a buddy system for beneficiaries and learners\nDesign and create educational materials (grammar books, basic numeracy booklets, etc.)\nTraining on how to manage and engage with project beneficiaries\nDetermine outcome measurement system and data collection materials',
      week2: 'Introduction\nIntroductory session about the project and presentation of the volunteer to students\nConduct an initial assessment to measure baseline knowledge (can include official school data)\nCreate a Personal Development Plan (PDP) for each participant and track progress weekly through coaching\nDynamic: Set up the "Book Club," present selected books, and explain the process\nWorkshop: The importance of SDG 4 and access to quality education',
      week3: 'Teaching fundamentals – Phase 1\nRun lessons based on student and school needs (math, reading skills, foreign language, etc.)\nRun interactive dynamics to reinforce weekly lessons (math games, speaking clubs, lab practices)\nWeekly Book Club meeting\nRun personalized coaching meetings\nConduct weekly assessments to measure learning progress',
      week4: 'Teaching fundamentals – Phase 2\nContinue lessons based on identified learning needs\nIntroduce more advanced literacy and numeracy exercises adapted to participant levels\nRun reinforcement dynamics and group activities\nWeekly Book Club meeting\nRun coaching sessions and weekly learning assessments',
      week5: 'Teaching fundamentals – Phase 3\nDeliver final cycle of literacy, numeracy, and language lessons\nRun applied learning activities (real-life math, reading comprehension, speaking practice)\nWeekly Book Club meeting\nRun final coaching sessions\nConduct final weekly assessments before project closure',
      week6: 'Measure the knowledge received\nClosing session where participants showcase their learning through challenges or competitions (math, reading, speaking, or art)\nCollect data from project beneficiaries (surveys, interviews, focus groups, test results)\nAnalyze data to determine outcome results, including weekly assessment trends\nBuild the final project report\nPresent results to AIESEC members and school representatives'
    },
    'Youth 4 Impact - SDG4.7': {
      sdgNumber: '4.7',
      sdgTarget: 'SDG 8.9 – By 2030, devise and implement policies to promote sustainable tourism that creates jobs and promotes local culture and products',
      roleDescription: 'Global Volunteers foster educational spaces on the Sustainable Development Goals and local/global issues in collaboration with schools and local NGOs, using interactive, non-formal educational methods and practical community-based activities',
      projectDescription: 'The project aims to contribute to SDG 8 by strengthening local communities\' capacity to promote sustainable tourism activities that generate income, preserve local culture, and enhance employability in the region',
      expectedOutcomes: 'Increase awareness among young people about the SDGs, local and global issues, and their personal ability to contribute\nIncrease the number of SDG advocates who understand the impact of the SDGs and actively promote them within their communities',
      expectedOutputs: 'Connect local community members with SDG advocates\nNumber of people with increased knowledge of the SDGs and opportunities to contribute to them\nNumber of community members adopting more SDG-aligned behaviors in daily life',
      week1: 'Onboarding and preparation\nOnboarding space with a partner representative to understand the current community scenario and beneficiaries\' needs\nTraining on how to manage and engage with project beneficiaries\nCreate and prepare materials for sessions, dynamics, and workshops for the following weeks\nDetermine outcome measurement system and data collection materials',
      week2: 'Introduction to SDGs\nIntroductory session about the project and presentation of the volunteer to beneficiaries\nConduct an initial assessment to measure beneficiaries\' understanding of the SDGs\nDynamic: What are the SDGs?\nGame: Play "Go, Goals" (UN SDG Board Game)',
      week3: 'Activities for SDG targets\nDynamic: Build the SDG map of the city or community and identify the most relevant SDGs for the local reality\nStorytelling: Invite a local SDG advocate to share their journey and impact\nDynamic: How can young people contribute to achieving the SDGs?',
      week4: 'Organize local SDG challenge\nChallenge: Organize and run an SDG Day at school involving parents and the local community\nPrepare the event agenda and send invitations together with students\nPrepare fun SDG-related activities and challenges with students\nCreate decorative and educational materials for the classroom or school',
      week5: 'Map behaviors and create initiatives\nGroup challenge: Create a "Children\'s Guide to Save the World" focused on positive change in school and community\nDivide students into SDG-based groups and support them in developing ideas and initiatives\nEncourage creativity through drawings, stories, or other artistic expressions\nConsolidate the guide and present it to school authorities',
      week6: 'Recap and outcome measurement\nClosing day with the students\nCollect data from project beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and partner representatives'
    },
    'Discover yourself - SDG4.7': {
      sdgNumber: '4.7',
      sdgTarget: 'SDG 4.7 – By 2030, ensure that all learners acquire the knowledge and skills needed to promote sustainable development, including, among others, through education for sustainable development and sustainable lifestyles, human rights, gender equality, promotion of a culture of peace and non-violence, global citizenship and appreciation of cultural diversity and of culture\'s contribution to sustainable development',
      roleDescription: 'Global Volunteers engage in holistic educational activities that develop critical thinking, emotional intelligence, social skills, and sustainable practices through interdisciplinary learning, social-emotional education, and community engagement',
      projectDescription: 'The project aims to impact SDG 4.7 by equipping youth with critical thinking, emotional intelligence, social skills, and sustainable practices through a holistic educational approach. Integrating interdisciplinary learning, social-emotional and wellness education, as well as community engagement, it fosters well-rounded individuals ready to address real-world challenges and promote global citizenship',
      expectedOutcomes: 'Increase critical thinking skills among youth\nEnhance emotional intelligence and social skills\nDevelop sustainable practices and global citizenship awareness',
      expectedOutputs: 'Number of workshops conducted on interdisciplinary learning\nNumber of social-emotional learning sessions delivered\nNumber of community engagement activities organized\nNumber of beneficiaries with improved self-awareness and personal development',
      week1: 'Onboarding and Preparation\nOnboarding space with partner representatives to understand the current scenario, beneficiaries and discuss about the outcome of the project\nIntroductory session with the beneficiaries, presentation of the volunteers and project objectives\nRun the initial assessment needed for measuring the outcome/impact of the project\nPreparing the activities that will be done in the following weeks and receiving feedback from the partners and AIESEC\nCreate an implementation plan on how the project should unfold and determine materials to be used',
      week2: 'Introduction to Interdisciplinary Learning\nWorkshop: Introduction to interdisciplinary learning\nWorkshop: Understanding the strengths of each subject and how they work together in real life\nWorkshop: Introduction to multiple perspectives - solving problems from different angles\nDynamic: Exploring environmental science through art\nDynamic: How is geography seen in other subjects?',
      week3: 'Interdisciplinary Learning\nWorkshop: Physics and their presence in day to day life\nDynamic: The interdisciplinarity of mathematics\nDynamic: Exploring historical and contemporary social issues through literature\nDynamic: Understanding global interdependence through social studies\nTeamwork: Create a project that solves global issues through interdisciplinary actions',
      week4: 'Social and Emotional Learning\nWorkshop: Linking learning and emotional well-being\nWorkshop: Emotional awareness and management through interactive activities\nDynamic: Exploring self-perception, passions and values\nActivity: Facing failure, fears, and uncertainty through mindfulness and creative expression\nWorkshop: The impact of digital environments on mental health',
      week5: 'Community Engagement\nWorkshop: Exploring multiculturality\nConnecting the Dots: The Role of SDGs in a Sustainable World\nWorkshop: Exploring the role of changemakers in the communities and understanding how I can contribute to mine\nWorkshop: Understanding equity and peace\nPlan and organize Global Village Day',
      week6: 'Closing and Reporting\nCollect data from beneficiaries (you can use surveys, interviews, focus groups, etc.)\nAnalyze data to determinate outcome/impact results (level of awareness of beneficiaries post-project activities)\nBuild final project report and presented to AIESEC members and NGO/non-profit representatives\nClosing day with beneficiaries\nDebrief the impact of the project, how the beneficiaries developed, discuss about what went well and even better if and include this in the report'
    },
    'Raise your Voice - SDG5.1': {
      sdgNumber: '5.1',
      sdgTarget: 'SDG 5.1 – End all forms of discrimination against all women and girls everywhere',
      roleDescription: 'Global Volunteers create and deliver workshops and activities that engage communities toward gender equality, raise awareness on gender discrimination, and promote diverse and equal spaces for all genders through education and action',
      projectDescription: 'The project aims to impact SDG 5 by fostering educational spaces that raise awareness of gender-related issues and support the creation of initiatives to reduce gender inequality in communities',
      expectedOutcomes: 'Increase gender diversity within company HR practices, creating more job opportunities for women and gender non-conforming people\nIncrease understanding among women and gender non-conforming people of gender discrimination and their legal rights',
      expectedOutputs: 'Number of opportunities created for students or adults to teach others about gender equality\nNumber of initiatives created to reduce gender discrimination in the community\nNumber of people participating in workshops and project activities',
      week1: 'Onboarding and analysis\nOnboarding space with NGO representatives to understand community context and urgent gender equality needs\nAnalyze historical gender equality movements and current national legislation related to women and gender non-conforming people\nVisit community leaders from diverse backgrounds to gather insights on women empowerment and gender equality\nCreate and prepare materials for sessions, dynamics, and workshops\nDetermine outcome measurement system and data collection materials',
      week2: 'Introduction\nConduct an initial assessment to measure beneficiaries\' understanding of gender discrimination and legal rights\nIntroductory session on project objectives, volunteer presentation, and SDG 5 overview\nActivity: Watch "Power Up 19 Conference" and facilitate a reflection and discussion space\nWorkshop: What does equality mean? Exploring equality beyond gender\nWorkshop: Exploring the concept of gender',
      week3: 'Workshops\nWorkshop: Gender roles, stereotypes, and microaggressions\nPractice: Role plays exploring inclusion, identity, and gender roles\nWorkshop: The importance of women and gender non-conforming representation in politics\nWorkshop: Closing the gap – generating leadership opportunities for women and gender non-conforming people\nWorkshop: Inspiration around the world – global examples of women and gender non-conforming leadership',
      week4: 'Capacity building\nRun capacity building sessions based on beneficiary needs and demands\nCapacity building: Empowering others – how to uplift people around me\nCapacity building: Project planning for beginners\nCapacity building: My rights and how to advocate for gender equality',
      week5: 'Working on actions\nOpen mic and sharing space on "My Body, My Choice"\nInterview local women and gender non-conforming people about their lived experiences and, when possible, showcase them\nPractice: Analyze representation of women and gender non-conforming people in media, highlighting harmful and positive portrayals\nPrepare for the Gender Equality Festival, including identifying local partners, advocates, and speakers',
      week6: 'Closing and outcome analysis\nCelebrate and host the Gender Equality Festival\nCollect data from beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives'
    },
    'Eco city - SDG12.8': {
      sdgNumber: '12.8',
      sdgTarget: 'SDG 12.8 – By 2030, ensure that people everywhere have the relevant information and awareness for sustainable development and lifestyles in harmony with nature',
      roleDescription: 'Global Volunteers are involved in community outreach in the sustainable living field by running activities that develop and increase sustainable understanding and knowledge within community life',
      projectDescription: 'The project aims to impact SDG 12 by raising awareness about sustainable communities and lifestyles through volunteers\' experiences',
      expectedOutcomes: 'Increase knowledge about sustainable practices in daily life\nImprove sustainable behavior and understanding in partners\' and beneficiaries\' routines',
      expectedOutputs: 'Number of workshops and sessions conducted on sustainable lifestyles\nNumber of people reached through outreach campaigns and awareness activities\nNumber of activities conducted as part of the outreach campaign',
      week1: 'Onboarding and planning\nOnboarding space with a partner to understand workers\' routines and daily lifestyles\nLearning space about the work field and identifying possibilities for outdoor activities in the surrounding area\nRun an analysis on partner projects, focus areas, and priorities\nStart building the plan for the following weeks based on community needs and the most relevant local issues',
      week2: 'Agriculture development\nShadow partner activities related to current agricultural practices\nResearch and analyze sustainable agricultural practices and responsible farming methods\nWorkshop: Present good case practices in sustainable agriculture based on recent studies\nFieldwork: Gardening and animal care activities aligned with the current season\nDocument activities and learnings and share content on partner social media platforms',
      week3: 'Agriculture development (continued)\nShadow partner activities related to current agricultural practices\nResearch and analyze sustainable agricultural practices and responsible farming methods\nWorkshop: Present good case practices in sustainable agriculture based on recent studies\nFieldwork: Gardening and animal care activities aligned with the current season\nDocument activities and learnings and share content on partner social media platforms',
      week4: 'Sustainable lifestyle development\nResearch and analyze existing sustainable and responsible consumption practices within the partner organization\nOutdoor activities (nature-based treasure hunts for children, artistic expression using recycled materials for teens, human-powered activities for youth and adults)\nRoundtable: Responsible consumption in daily life (water and energy use, food waste, electronic waste, fashion and sustainability)\nWorkshop: Practical recycling ideas to integrate into beneficiaries\' daily routines\nDocument sustainable lifestyle practices introduced and implemented at the partner site',
      week5: 'Sustainable lifestyle development (continued)\nResearch and analyze existing sustainable and responsible consumption practices within the partner organization\nOutdoor activities (nature-based treasure hunts for children, artistic expression using recycled materials for teens, human-powered activities for youth and adults)\nRoundtable: Responsible consumption in daily life (water and energy use, food waste, electronic waste, fashion and sustainability)\nWorkshop: Practical recycling ideas to integrate into beneficiaries\' daily routines\nDocument sustainable lifestyle practices introduced and implemented at the partner site',
      week6: 'Outcome analysis and reporting\nCollect data from project activities and beneficiaries\nAnalyze data to determine outcome results related to sustainable living, building, and agriculture\nBuild the final project report\nPresent results to AIESEC members and the community\nPresent final recommendations on sustainable living'
    },
    'Skill Up! - SDG8.6': {
      sdgNumber: '8.6',
      sdgTarget: 'SDG 8.6 – By 2030, substantially reduce the proportion of youth not in employment, education, or training',
      roleDescription: 'Global Volunteers collaborate with formal and technical schools to deliver soft and hard skills training, provide career guidance, and build entrepreneurship skills for local youth',
      projectDescription: 'The project aims to impact SDG 8 by equipping young people with employability-related soft and hard skills and providing career guidance needed to qualify for decent jobs',
      expectedOutcomes: 'Increase employability-related hard skills among young people\nIncrease employability-related soft skills among young people',
      expectedOutputs: 'Number of coaching sessions conducted to identify soft skills participants want to develop\nIncreased awareness of individual fit within the job market (talents, job opportunities, and further education needs)\nNumber of participants applying to jobs at the end of the project',
      week1: 'Onboarding and analysis\nOnboarding space with a partner representative to understand the context and urgent needs of youth\nAnalyze country-level youth employability and job-hunting challenges\nCreate and prepare materials for sessions, dynamics, and workshops of the following weeks\nDevelop an assessment (with partner or teacher support) to evaluate beneficiaries\' soft and hard skills\nDetermine outcome measurement system and data collection materials',
      week2: 'Introductory\nIntroductory session with beneficiaries, including presentation of volunteers and project objectives\nAssess current hard and soft skills to identify improvement areas\nSet up a mentorship or buddy program based on desired soft skills development\nCoordinate individual sessions to identify skills to develop\nCreate a Personal Development Plan (PDP) for each participant',
      week3: 'Soft skills\nIntrospection activities to help participants identify strengths, weaknesses, and soft skills to improve\nSoft skills workshops tailored to participant needs\nDevelopment spaces using games, role plays, dynamics, and roundtables (solution-oriented thinking, world citizenship, empowerment, self-awareness)\nContinue buddy and coaching dynamics',
      week4: 'Hard skills\nPractical workshops on essential 21st-century hard skills (digital work, Microsoft packages, etc.)\nPractical workshops on high-demand skills (programming, entrepreneurship, UX design, etc.)\nPractical workshops aligned with participants\' ambitions and talents\nContinue buddy and coaching dynamics\nActivity: Introduce beneficiaries to professionals from different fields to explore job opportunities and required hard skills',
      week5: 'Mastering job-hunting\nWorkshop: Self-branding – how to present and "sell" yourself\nWorkshop: Application procedures – CV writing, motivation letters, and interview skills\nPractice: Mock application processes with structured feedback\nProvide working spaces for participants with limited internet access to apply for jobs\nEnsure participation in local online and physical job fairs',
      week6: 'Closing\nCollect data from project beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives'
    },
    'Equify - SDG10.2': {
      sdgNumber: '10.2',
      sdgTarget: 'SDG 10.2 – By 2030, empower and promote the social, economic, and political inclusion of all, irrespective of age, sex, disability, race, ethnicity, origin, religion, or economic or other status',
      roleDescription: 'Global Volunteers deliver workshops and dynamics on human rights, inequality, and inclusion, while supporting students to become agents of change by creating local initiatives that tackle inequality in their communities',
      projectDescription: 'The project aims to impact SDG 10 by fostering educational spaces on inequality and social inclusion and promoting student-led initiatives to address discrimination and inequality at the local level',
      expectedOutcomes: 'Increase the number of local community initiatives focused on inclusion\nShift community mindsets toward being more inclusive of all people',
      expectedOutputs: 'Increased knowledge among community members on how to organize impactful initiatives to reduce inequalities\nIncreased awareness of social inclusion challenges faced within the community',
      week1: 'Onboarding and analysis\nOnboarding space with a partner representative to understand the current community scenario\nAnalyze SDG 10 and inequality at the country and regional level\nCreate and prepare materials for sessions, dynamics, and workshops for the following weeks\nDetermine outcome measurement system and data collection materials',
      week2: 'Introduction to inequality\nIntroductory session about the project and presentation of the volunteer to the students\nConduct an initial assessment to measure beneficiaries\' understanding of inequality\nSession: Origins of inequality and social inclusion challenges in the community\nDynamic: Human rights and the SDGs (key message: all humans are equal)\nDynamic: The world is not equal – is that fair? (World\'s Largest Lesson)\nHelp students understand the different types of inequality',
      week3: 'Citizenship and awareness\nWorkshop: My role as a citizen\nRoundtable discussion on how local community issues relate to global inequality\nDynamic: "Cross the line" activity to raise awareness of personal privilege\nStorytelling session with guests who have overcome discrimination or inequality\nWorkshop: How to become agents of change',
      week4: 'Designing impact initiatives\nWorkshop: Using Theory of Change (ToC) to create impactful projects\nWorkshop: How to create an awareness campaign\nWorkshop: Basics of social entrepreneurship\nWorking time for students to apply learning and design social initiatives to tackle inequality in their community',
      week5: 'Implementing and monitoring initiatives\nOrganize a mentorship program with change makers or community leaders\nProvide working time for students to develop and refine their initiatives\nStudents present their projects to teachers or NGO representatives\nCreate a system to monitor the results and impact of student initiatives and include it in the final report',
      week6: 'Closing and reporting\nClosing day with the students\nCollect data from project beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives'
    },
    'Green Leaders - SDG13.3': {
      sdgNumber: '13.3',
      sdgTarget: 'SDG 13 – Improve education, awareness-raising, and human and institutional capacity on climate change mitigation, adaptation, impact reduction, and early warning',
      roleDescription: 'Global Volunteers engage communities to raise awareness about climate change, promote sustainable practices, and support the development of solutions and initiatives to reduce climate change impact in local communities',
      projectDescription: 'The project aims to impact SDG 13 by educating communities about climate change and supporting the creation of action plans to reduce critical environmental factors',
      expectedOutcomes: 'Develop sustainable lifestyles and behaviors within the local community\nIncrease education and awareness about climate change issues',
      expectedOutputs: 'Increased skills to assess the climate impact of lifestyle choices\nImproved local understanding of climate mitigation and early warning indicators\nIncreased local capacity to design and implement climate action initiatives',
      week1: 'Preparation and onboarding\nOnboarding space with opportunity provider representatives to understand community context and urgent climate needs\nAnalyze country and local climate change issues\nCreate and prepare materials for sessions, dynamics, and workshops for the following weeks\nDetermine outcome measurement system and materials to be used',
      week2: 'Introduction\nIntroductory session with beneficiaries, including presentation of volunteers and project objectives\nDocumentary screenings related to climate change\nRoundtable discussion on causes and effects of climate change\nLab practice: Demonstration of the greenhouse effect\nResearch activity: Students investigate how climate change has affected their local community (sea level rise, temperature increase, desertification, etc.)',
      week3: 'Learning about climate change\nRoundtable: Sharing and discussion on climate action initiatives in participants\' countries\nWorkshop: The 3 Rs of ecology (Reduce, Reuse, Recycle)\nRoundtable: Use the Climate Change Scorecard to discuss ways to reduce greenhouse gas emissions at home and school\nPractice: Brainstorm and add new energy-saving and pollution-reduction ideas to the scorecard',
      week4: 'Learning about climate change\nWorkshop: Carbon footprint and the butterfly effect of daily lifestyle choices\nRoundtable: Calculate individual carbon footprints\nWorkshop: Sustainable alternatives to reduce carbon footprint at home\nPractice: Run climate awareness campaigns through social media or organize a one-day physical awareness campaign',
      week5: 'Taking action against climate change\nFieldwork: Tree planting or school gardening activities to promote greener environments\nOrganize lifestyle change challenges (recycling, composting, reduced consumption)\nBuild an Ambassadorship Program to sustain activities beyond the project duration\nSession: Earth Hour (WWF) – stop activities for one hour to reflect on energy consumption',
      week6: 'Closing and analysis\nClosing session with beneficiaries\nCollect data from project beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives'
    },
    'Eat4change - SDG12.8': {
      sdgNumber: '12.8',
      sdgTarget: 'SDG 12.8 – By 2030, ensure that people everywhere have the relevant information and awareness for sustainable development and lifestyles in harmony with nature',
      roleDescription: 'Global Volunteers are prepared on sustainable diets and facilitation using WWF-developed materials, and work with high-school students to raise awareness and support collective action through creative group work',
      projectDescription: 'The project is part of the EU co-funded, WWF-led international initiative Eat4Change, which aims to engage youth in taking active roles in society and shifting diets toward more plant-based choices for the wellbeing of people and the planet\nThe volunteering project in schools focuses on raising awareness among high-school students about the environmental impact of diets and engaging them to take action toward more sustainable, plant-based eating habits',
      expectedOutcomes: 'Increase awareness among young people about the impact of diets on the planet\nDevelop student-led actions and projects that promote sustainable diets',
      expectedOutputs: 'Number of workshops delivered on sustainable diets\nNumber of high-school students reached through workshops\nNumber of actionable ideas and initiatives developed by students',
      week1: 'Onboarding and preparation\nUnderstand the framework of the Eat4Change project\nGet to know other volunteers through team-building activities\nDevelop delivery and facilitation skills for workshops\nLearn and understand the curriculum using WWF studies and the Eat4Change Educators Manual\nPrepare lesson plans for schools according to the Educators Manual',
      week2: 'Delivery – Understand your pupils\nGet to know students\' current knowledge, awareness, and needs through games, surveys, and non-formal activities\nDevelop and deliver workshops adapted to students\' awareness levels and interests\nIntroduce students to the idea of future actions they can take to address sustainable diet challenges\nDeliver the initial workshop to all participating classes',
      week3: 'Delivery – Dive into the theory\nUnderstand key facts and data related to global and local food production and consumption\nDevelop and deliver workshops based on research findings\nDeliver a second workshop to all participating classes\nContinue buddy and coaching dynamics',
      week4: 'Delivery – Set things in motion\nMobilize students around sustainable diets through videos, group discussions, and non-formal education activities\nIdentify sustainable diet challenges and begin forming working groups\nDevelop and deliver workshops focused on taking action\nDeliver a third workshop to all participating classes',
      week5: 'Delivery – Teamwork time\nGroup students and support them in developing a mini-project for themselves or another target audience\nFacilitate the process of designing and planning mini-projects using activities from the Educators Manual\nSupport students during and outside classes through continuous communication and volunteer presence during implementation\nDeliver the final workshop to all participating classes',
      week6: 'Closing and evaluation\nFinalize the experience by giving feedback to the organizing team and fellow volunteers and receiving feedback from students\nCollect project data (number of students reached, workshops delivered, action projects developed, and overall impact)\nBuild the final project report\nPresent the project results to AIESEC\nPresent campaign outcomes to project beneficiaries'
    },
    'Rooted - SDG15.5': {
      sdgNumber: '15.5',
      sdgTarget: 'SDG 15.5 – Take urgent and significant action to reduce the degradation of natural habitats, halt biodiversity loss, and protect threatened species from extinction',
      roleDescription: 'Global Volunteers foster educational spaces about life on land, ecosystem biodiversity, and wildlife protection, while supporting communities to take action towards preserving biodiversity and protecting wildlife in the region',
      projectDescription: 'The project aims to impact SDG 15 by building community capacity to respond to natural habitat degradation, biodiversity loss, and wildlife protection challenges',
      expectedOutcomes: 'Increase community education on natural habitat degradation and biodiversity protection\nIncrease positive behavioral actions by community members to reduce the risk of extinction of threatened species',
      expectedOutputs: 'Number of educational spaces conducted for community members on natural habitats\nPercentage of community members involved in designing local conservation initiatives\nNumber of animal and wildlife protection activities organized',
      week1: 'Onboarding\nOnboarding space with a partner representative to understand the context and urgent ecosystem needs of the area\nField trip to analyze natural habitat degradation, local ecosystem issues, and endangered species\nPrepare educational materials and workshop sessions for the following weeks\nDetermine outcome measurement methods and data collection materials',
      week2: 'Introduction to SDG 15\nIntroductory session with beneficiaries and presentation of volunteers and project objectives\nWorkshop: SDG 15 and the impact of habitat degradation and biodiversity loss\nGame: Scavenger hunt to identify signs of environmental degradation\nActivity: Map root causes of habitat degradation with community members\nRoundtable: Watch documentaries on ecosystems and discuss how humans can prevent degradation',
      week3: 'Taking actions\nWorkshop: How to take care of the ecosystem we live in\nRoundtable: Invite community elders to share stories about how the area looked in the past\nActivity: Create a community accountability system for nature conservation\nRun a local launch event for the accountability system with commitment signing by local representatives',
      week4: 'Endangered species\nWorkshop: How to protect endangered species\nChallenge: Encourage participants to adopt lifestyle choices that are less harmful to endangered species\nActivity: Appoint species ambassadors to protect local endangered species\nFieldwork: Conduct activities at animal rescue centers',
      week5: 'Taking actions\nFundraising campaign for the protection of a specific endangered species or natural habitat\nCreate a short film highlighting a species or environmental degradation in the region\nActivity: Run a podcast titled "The Voice of [Region/Species]" to give a voice to endangered species\nBuild a system to measure the impact of initiatives created during the project',
      week6: 'Debrief and final report\nNature conservation presentation by an NGO or conservation group\nCollect data from project beneficiaries (surveys, interviews, focus groups, etc.)\nAnalyze data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives'
    },
    'Scale up - SDG17.17': {
      sdgNumber: '17.17',
      sdgTarget: 'SDG 17.17 – Encourage and promote effective public, public-private, and civil society partnerships, building on experience and resourcing strategies of partnerships, data, monitoring, and accountability',
      roleDescription: 'Global Volunteers analyze the needs of NGOs, non-profits, and foundations, identify improvement areas in social projects, and propose realistic solutions that strengthen organizational capacity to deliver community impact',
      projectDescription: 'The project aims to contribute to SDG 17 by building the capacity of local NGOs, non-profits, and foundations to deliver stronger social impact through collaboration with local social projects and grassroots initiatives',
      expectedOutcomes: 'Improve NGO partnership procedures for specific projects or campaigns (attraction, data management, monitoring, accountability)\nEnhance the positioning of NGOs at the local, national, and international level regarding social impact',
      expectedOutputs: 'Strengthened partnerships and connections between stakeholders\nPercentage growth in B2B marketing opportunities and new contacts created\nPercentage achievement of defined project or campaign goals',
      week1: 'Onboarding\nOnboarding meeting with NGO representatives\nReview past projects and campaigns to analyze data, insights, and GCPs\nAnalyze the scope of the social impact project or campaign and create a strategic plan to boost results\nReview current procedures to identify strengths and areas for improvement',
      week2: 'Stakeholders mapping\nMap existing stakeholders\nGather feedback from current partners to improve collaboration\nConduct local market research to enhance partnerships between stakeholders\nInterview potential partners to assess needs and collaboration capacity\nBuild a customer/partner flow model',
      week3: 'On-demand\nSet up or improve the NGO project\'s social media and website presence\nCreate branding guidelines for the social impact project or campaign\nRun on-demand workshops to address NGO project deficiencies\nWorkshop: Stakeholder mapping and management\nWorkshop: Case solving',
      week4: 'On-demand and networking\nOrganize branding events to promote the NGO social impact project or campaign\nHost networking events to seek alliances and potential investors\nRun on-demand workshops to tackle identified NGO project deficiencies',
      week5: 'On-demand and networking\nRun additional on-demand workshops to address NGO project gaps\nHost networking events to strengthen alliances and attract potential investors for the project or campaign',
      week6: 'Debrief and final report\nCollect outcome measurement data (recommended to use NGO official data)\nAnalyze data to determine outcome results and improvement opportunities\nBuild the final project report\nPresent results to AIESEC members and NGO / non-profit representatives'
    },
    'Fingertips - SDG4.4': {
      sdgNumber: '4.4',
      sdgTarget: 'SDG 4.4 – By 2030, substantially increase the number of youth and adults who have relevant skills, including technical and vocational skills, for employment, decent jobs, and entrepreneurship',
      roleDescription: 'Global Volunteers deliver immersive and artistic activities that inspire imagination, problem solving, critical thinking, creativity, teamwork, and communication skills applicable across different occupational fields',
      projectDescription: 'The project aims to impact SDG 4 by developing high-level cognitive and transferable skills for people of all ages through activities and workshops connected to arts production (painting, sculpture, music, theater, photography, etc.)',
      expectedOutcomes: 'Increase the use of art-based activities in educational spaces as a creative method to develop cognitive skills\nIncrease awareness of the benefits and opportunities of art-related skills in youth development',
      expectedOutputs: 'Number of lessons connecting arts and creativity with personal and professional development\nNumber of artistic workshops focused on imagination, problem solving, critical thinking, creativity, teamwork, and communication\nNumber of final art projects presented and evaluated with feedback',
      week1: 'Onboarding\nGet to know staff and beneficiaries\nOnboarding space with a partner to align expectations on artistic focus and beneficiaries\' development\nShadowing at the workplace to understand routines and beneficiary profiles\nTraining on how to manage and engage with project beneficiaries\nDetermine outcome measurement system and data collection materials',
      week2: 'First steps\nIntroductory session about the project, SDG focus, and presentation of the volunteer to participants\nInteractive classes to understand beneficiaries\' artistic backgrounds and personal and professional aspirations\nDesign and prepare educational methodology and materials (activity instructions, raw materials, tools)\nBuild and present an activities calendar progressing from practical learning to hands-on experiences (peer tutoring, chain drawings, jigsaws, etc.)',
      week3: 'Developing skills\nRun introductory artistic activities to expose beneficiaries to different artistic media (drawing, painting, sculpture, photography, etc.)\nDeliver activities that develop imagination, problem solving, critical thinking, creativity, teamwork, and communication\nCreate a Personal Development Plan (PDP) for each participant\nTrack participant progress weekly through a coaching system',
      week4: 'Developing culture\nExplore the city\'s cultural and artistic scene outside the classroom (museums, galleries, local projects, art schools, artist panels)\nDeliver lessons connecting art and creativity development with beneficiaries\' future goals and plans\nPresent data on Arts & Employability and assign case studies or group presentations on the topic\nUse libraries and computer labs to diversify research spaces and support interactive learning',
      week5: 'Developing the final project\nRun creative brainstorming sessions to define the artistic direction of the final project\nBreak down the final project into smaller activities and assign responsibilities based on interests and previous work\nFinalize the main artistic project\nOrganize and deliver an Art Exhibition showcasing all artistic outputs from the project',
      week6: 'Closing\nCollect data from project activities and participant learning\nAnalyze data to determine outcome results (impact of art on cognitive and transferable skills)\nBuild the final project report\nPresent results to AIESEC members and the community\nPresent final project outcomes and recommendations for sustainable personal and professional development'
    },
    'Happy Bus - SDG4.2': {
      sdgNumber: '4.2',
      sdgTarget: 'SDG 4.2 – By 2030, ensure that all girls and boys have access to quality early childhood development, care, and pre-primary education so that they are ready for primary education',
      roleDescription: 'Global Volunteers animate the time of small children through interactive and informal educational methods, introducing cultural diversity education, teaching English and foreign languages, and creating a friendly learning atmosphere while traveling from village to village',
      projectDescription: 'The project aims to contribute to SDG 4.2 by opening access to quality early education for small children from smaller towns and villages, providing cultural, social, and linguistic learning opportunities before primary education and fostering intercultural integration',
      expectedOutcomes: 'Increase access for children from small towns and villages to cultural diversity education and foreign language learning before primary education\nIncrease the number of children who break language and cultural barriers regardless of gender before entering primary education',
      expectedOutputs: 'Provide children from small villages with equitable cultural and linguistic development opportunities\nNumber of children who have their first contact with a foreign culture\nNumber of children who have their first contact with a foreign language',
      week1: 'Preparation\nArrival, introduction to the team, and integration with other volunteers\nOnboarding space with NGO representatives to understand the current scenario and beneficiaries\' needs\nFieldwork: Visit villages and activity areas, introduction to materials, and explanation of the workflow\nTraining on how to manage and engage with small children as project beneficiaries\nIncoming preparation seminar',
      week2: 'Introduction\nPractical introduction to the project working system\nDeparture from the hosting city and visits to the first two villages, including first contact and initial sessions with children\nPractical training for volunteers on organizing games and activities (face painting, multilingual memory games, songs, and chants)\nPossibility to explore and visit the nearby area\nStart collecting beneficiaries\' data (semi-weekly)',
      week3: 'Teaching and creating relations\nVisit new villages (around two villages per week), ensuring care for transportation and the environment\nPlay-based engagement with children, creating a friendly and safe atmosphere\nOrganize English language classes based on play (songs, colors, numbers, rhymes)\nOrganize and present sessions about foreign cultures (e.g. reading foreign books)\nCollect and analyze data from beneficiaries\nPossibility of exploring the area for volunteers',
      week4: 'Teaching languages and culture\nVisit the next two villages while ensuring care for transportation and the environment\nInteractive play sessions and storytelling using games from different cultures\nOrganize English or other foreign language classes based on play\nOrganize and present cultural activities such as arts, crafts, and cultural creations\nCollect and analyze data from beneficiaries\nPossibility of exploring the area for volunteers',
      week5: 'Cooking and teaching\nVisit two additional villages, ensuring care for transportation and the environment\nPlay-based engagement and creation of a friendly learning atmosphere\nOrganize foreign language classes focused on cooking and safety\nOrganize and present cultural sessions related to cooking or preparing traditional food\nCollect and analyze data from beneficiaries\nPossibility of exploring the area for volunteers',
      week6: 'Closing and outcome analysis\nOrganize and participate in the final closing festival\nReturn to the hosting city and conduct feedback discussions (1–3 days)\nOrganize and participate in the goodbye party for volunteers\nAnalyze collected data to determine outcome results\nBuild the final project report\nPresent results to AIESEC members and partner representatives'
    }
  };
  
  for (let i = 1; i <= oppCount; i++) {
    const projectType = data[`opp_${i}_projectType`];
    
    if (!projectType) continue;
    
    // Check for matching project type
    let projectData = null;
    for (const [key, value] of Object.entries(projectTypeData)) {
      if (projectType.includes(key)) {
        projectData = value;
        break;
      }
    }
    
    if (projectData) {
      const prefix = `opp_${i}_`;
      
      // Populate all predefined values
      data[prefix + 'sdgNumber'] = projectData.sdgNumber;
      data[prefix + 'sdgTarget'] = projectData.sdgTarget;
      data[prefix + 'roleDescription'] = projectData.roleDescription;
      data[prefix + 'projectDescription'] = projectData.projectDescription;
      data[prefix + 'expectedOutcomes'] = projectData.expectedOutcomes;
      data[prefix + 'expectedOutputs'] = projectData.expectedOutputs;
      data[prefix + 'week1'] = projectData.week1;
      data[prefix + 'week2'] = projectData.week2;
      data[prefix + 'week3'] = projectData.week3;
      data[prefix + 'week4'] = projectData.week4;
      data[prefix + 'week5'] = projectData.week5;
      data[prefix + 'week6'] = projectData.week6;
      
      console.log(`[populateOnTheMapValues] Populated values for Opportunity ${i}: ${projectType}`);
    }
  }
  
  console.log('[populateOnTheMapValues] Auto-population complete');
}

/**
 * Validate form data
 */
function validateFormData(data) {
  console.log('[validateFormData] Starting validation...');
  
  // Check required fields
  if (!data.aiesecerName || !data.aiesecerEmail || !data.contractType) {
    console.warn('[validateFormData] Missing required fields:', {
      hasName: !!data.aiesecerName,
      hasEmail: !!data.aiesecerEmail,
      hasContractType: !!data.contractType
    });
    return false;
  }
  
  // Validate AIESECer email domain
  if (data.aiesecerEmail && !data.aiesecerEmail.toLowerCase().endsWith('@aiesec.net')) {
    console.warn('[validateFormData] Invalid AIESECer email domain:', data.aiesecerEmail);
    alert('⚠️ Please use your AIESEC email address ending with @aiesec.net');
    return false;
  }
  
  // Check that at least one opportunity has a title
  const oppCount = parseInt(data.oppCount || '0');
  console.log('[validateFormData] Validating', oppCount, 'opportunities');
  
  if (oppCount === 0) {
    console.warn('[validateFormData] No opportunities found');
    return false;
  }
  
  const missingTitles = [];
  for (let i = 1; i <= oppCount; i++) {
    if (!data[`opp_${i}_title`]) {
      missingTitles.push(i);
    }
  }
  
  if (missingTitles.length > 0) {
    console.warn('[validateFormData] Missing titles for opportunities:', missingTitles);
    return false;
  }
  
  console.log('[validateFormData] Validation passed');
  return true;
}

/**
 * Set up real-time email validation
 */
function setupEmailValidation() {
  const emailInput = document.querySelector('input[type="email"][placeholder*="aiesec.net"]');
  
  if (!emailInput) {
    // Retry after a short delay if input not found yet
    setTimeout(setupEmailValidation, 500);
    return;
  }
  
  // Create warning message element
  let warningMsg = document.createElement('div');
  warningMsg.className = 'text-danger small mt-1';
  warningMsg.id = 'email-warning-msg';
  warningMsg.style.display = 'none';
  warningMsg.textContent = '⚠️ Please use your AIESEC email address ending with @aiesec.net';
  
  // Insert warning message after the email input
  emailInput.parentElement.appendChild(warningMsg);
  
  // Add validation on input/blur events
  emailInput.addEventListener('input', function() {
    const email = this.value.trim().toLowerCase();
    if (email && !email.endsWith('@aiesec.net')) {
      warningMsg.style.display = 'block';
      this.classList.add('is-invalid');
    } else {
      warningMsg.style.display = 'none';
      this.classList.remove('is-invalid');
    }
  });
  
  emailInput.addEventListener('blur', function() {
    const email = this.value.trim().toLowerCase();
    if (email && !email.endsWith('@aiesec.net')) {
      warningMsg.style.display = 'block';
      this.classList.add('is-invalid');
    } else {
      warningMsg.style.display = 'none';
      this.classList.remove('is-invalid');
    }
  });
  
  console.log('[setupEmailValidation] Email validation initialized');
}

// Initialize email validation when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEmailValidation);
} else {
  setupEmailValidation();
}

// Note: Submit handler is attached via inline onsubmit in HTML
// No need to addEventListener here to avoid double submission
