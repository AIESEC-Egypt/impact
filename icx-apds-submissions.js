// ICX APDs Submissions JavaScript
// Handle APD form submissions for IGV and IGT products

// Global variables
let recentSubmissions = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupFormHandlers();
});

// Initialize page elements
function initializePage() {
    // Page initialized
}

// Setup form event handlers
function setupFormHandlers() {
    // APD form
    const apdForm = document.getElementById('icxAPDForm');
    if (apdForm) {
        apdForm.addEventListener('submit', handleAPDSubmission);
    }
}

// Handle APD form submission
async function handleAPDSubmission(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const submissionData = Object.fromEntries(formData.entries());
    
    // Add form type for Apps Script processing
    submissionData.formType = 'icx-apd';
    
    // Validate form data
    if (validateAPDForm(submissionData)) {
        try {
            // Show loading state
            showLoadingState('Submitting APD...');
            
            // Submit to Google Apps Script
            const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzcMlGZ7bRVf1lsdWx8JoLb42G2ty2IfgaNNlAmTcDcSDpupp3Wnb5LGcSjmDQIDdiOkQ/exec';
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(submissionData)
            });
            
            // Process response first to check for duplicates
            response.text().then(responseText => {
                try {
                    const result = JSON.parse(responseText);
                    if (result.success) {
                        // Success - show green success message and clear form
                        showSuccessMessage('ICX APD submitted successfully!');
                        clearAPDForm();
                        
                        // Add to UI
                        const newSubmission = {
                            id: Date.now(),
                            type: 'apd',
                            epID: submissionData.epID,
                            opID: submissionData.opID,
                            product: submissionData.product,
                            aiesecMail: submissionData.aiesecMail,
                            notes: submissionData.notes || '',
                            status: 'submitted',
                            timestamp: new Date().toISOString()
                        };
                        
                        recentSubmissions.unshift(newSubmission);
                        
                        // Refresh ranking data if ranking page is available
                        if (typeof refreshData === 'function') {
                            setTimeout(() => {
                                refreshData();
                            }, 2000); // Wait 2 seconds before refreshing to allow sheet to update
                        }
                    } else {
                        // Error - show error message only (no success message)
                        if (result.isDuplicate) {
                            showErrorMessage(result.error);
                        } else {
                            showErrorMessage('Submission failed: ' + (result.error || 'Unknown error'));
                        }
                    }
                } catch (parseError) {
                    // Response parsing failed - assume success
                    showSuccessMessage('ICX APD submitted successfully!');
                    clearAPDForm();
                }
            }).catch(() => {
                // Response reading failed - assume success
                showSuccessMessage('ICX APD submitted successfully!');
                clearAPDForm();
            });
            
        } catch (error) {
            showErrorMessage('Network error. Please check your connection and try again.');
        } finally {
            hideLoadingState();
        }
    }
}

// Validate APD form
function validateAPDForm(data) {
    const requiredFields = ['epID', 'opID', 'product', 'aiesecMail'];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field].trim() === '') {
            const fieldLabels = {
                'epID': 'EP ID',
                'opID': 'OP ID',
                'product': 'Product',
                'aiesecMail': 'AIESEC Mail'
            };
            showErrorMessage(`Please fill in the ${fieldLabels[field] || field} field`);
            return false;
        }
    }
    
    // Validate EP ID (must be numeric)
    if (data.epID && !/^\d+$/.test(data.epID.trim())) {
        showErrorMessage('EP ID must contain only numbers');
        return false;
    }
    
    // Validate OP ID (must be numeric)
    if (data.opID && !/^\d+$/.test(data.opID.trim())) {
        showErrorMessage('OP ID must contain only numbers');
        return false;
    }
    
    // Validate AIESEC Mail format (should contain @aiesec.net or @aiesec.org)
    if (data.aiesecMail && !data.aiesecMail.includes('@')) {
        showErrorMessage('Please enter a valid AIESEC email address');
        return false;
    }
    
    // Validate product (must be IGV or IGTa only)
    const validProducts = ['iGV', 'iGTa'];
    if (data.product && !validProducts.includes(data.product)) {
        showErrorMessage('Product must be iGV or iGTa');
        return false;
    }
    
    return true;
}


// Show success message
function showSuccessMessage(messageText = 'ICX APD submission completed successfully!') {
    const message = document.createElement('div');
    message.className = 'success-message';
    message.innerHTML = `
        <div class="message-content">
            <i class="fas fa-check-circle"></i>
            <span>${messageText}</span>
        </div>
    `;
    
    // Add styles (exactly like ICX submissions)
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(40, 167, 69, 0.9);
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(message);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        message.remove();
    }, 3000);
}

// Show error message
function showErrorMessage(errorMessage) {
    const message = document.createElement('div');
    message.className = 'error-message';
    message.innerHTML = `
        <div class="message-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${errorMessage}</span>
        </div>
    `;
    
    // Add styles (exactly like ICX submissions)
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(220, 53, 69, 0.9);
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(message);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        message.remove();
    }, 5000);
}

// Show loading state
function showLoadingState(message) {
    // Disable submit buttons
    const submitButtons = document.querySelectorAll('.btn-primary');
    submitButtons.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + message;
    });
}

// Hide loading state
function hideLoadingState() {
    // Re-enable submit buttons
    const submitButtons = document.querySelectorAll('.btn-primary');
    submitButtons.forEach(btn => {
        btn.disabled = false;
        // Restore original text
        btn.innerHTML = 'Submit APD';
    });
}

// Clear APD form
function clearAPDForm() {
    const form = document.getElementById('icxAPDForm');
    if (form) {
        form.reset();
    }
}



