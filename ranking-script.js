// ==================== AIESEC EGYPT MEMBERSHIP RANKING SYSTEM ====================

// Configuration - You can update these with your actual Google Sheets data
const SHEET_ID = '14pFmfG-2IsCKZbto0j_EWVWQbUAT3Q9lOneqlUGcNsE';
const SHEET_NAME = 'Members data';
const API_KEY = 'AIzaSyBfsAhDtBVPVWS8tlXtwD6UMLqFoVjRBJc'; // Google Sheets API Key

// Global data storage
let memberData = [];
let rawSheetData = [];
let globalSortedData = []; // Store globally sorted data for rank calculation
let currentMonth = 'default'; // Track current month selection

// Function to extract product abbreviation from function string
function extractProductAbbreviation(functionString) {
    if (!functionString) return '';
    
    // Look for patterns like "OGV (Outgoing Global Volunteer)" or "oGTe (Outgoing Global Teacher)" or "oGTa/e" or "B2B"
    const patterns = [
        /(OGV|IGV|OGTa|IGTa|OGTe|IGTe|oGTe|iGTe|OGT|IGT|oGTa\/e|iGTa\/e|B2B)\s*\(/i,
        /(OGV|IGV|OGTa|IGTa|OGTe|IGTe|oGTe|iGTe|OGT|IGT|oGTa\/e|iGTa\/e|B2B)/i
    ];
    
    for (const pattern of patterns) {
        const match = functionString.match(pattern);
        if (match) {
            // Keep original case for oGTe and iGTe, uppercase for others
            const product = match[1];
            if (product === 'oGTe' || product === 'iGTe') {
                return product; // Keep lowercase 'o' and 'i'
            } else if (product === 'oGTa/e') {
                return 'OGTA/E'; // Convert oGTa/e to OGTA/E
            } else if (product === 'iGTa/e') {
                return 'IGTA/E'; // Convert iGTa/e to IGTA/E
            }
            return product.toUpperCase();
        }
    }
    
    return '';
}

// Function to get region from LC name
function getRegionFromLC(lcName) {
    const regionMapping = {
        'Cairo University': 'Cairo',
        'AUC': 'Cairo',
        'GUC': 'Cairo',
        'Ain Shams University': 'Cairo',
        'Helwan': 'Cairo',
        '6th October University': 'Cairo',
        'MIU': 'Cairo',
        'MUST': 'Cairo',
        'AAST In CAIRO': 'Cairo',
        'New Capital': 'Cairo',
        'Alexandria': 'Alexandria',
        'AAST Alexandria': 'Alexandria',
        'Mansoura': 'Delta',
        'Zagazig': 'Delta',
        'Tanta': 'Delta',
        'Menofia': 'Delta',
        'Suez': 'Suez Canal',
        'Beni Suef': 'Upper Egypt',
        'Galala': 'Upper Egypt'
    };
    
    return regionMapping[lcName] || 'Unknown';
}

// Function to check if a month is in the future
function isFutureMonth(month) {
    if (month === 'default' || !month) {
        return false;
    }
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); // 0-11 (0 = January, 11 = December)
    const currentYear = currentDate.getFullYear();
    
    const selectedMonthIndex = monthNames.indexOf(month);
    
    // If month is November, always use current data
    if (month === 'November') {
        return true; // Treat as "future" to use current data
    }
    
    // Check if selected month is in the future
    // If selected month index is greater than current month index, it's in the future
    // (e.g., if current is January (0) and selected is February (1), it's future)
    if (selectedMonthIndex > currentMonthIndex) {
        return true;
    }
    
    // If selected month is the same as current month, it's not future (it's current)
    if (selectedMonthIndex === currentMonthIndex) {
        return false;
    }
    
    // If selected month is before current month, it could be:
    // - Past month in same year (e.g., October when we're in December)
    // - Future month in next year (e.g., December when we're in January - but this is actually past)
    // For our use case, if it's before current month, we'll assume it's past (not future)
    // and try to fetch its data sheet
    
    return false;
}

// Function to get sheet name based on month selection
function getSheetName(month) {
    if (month === 'default' || !month) {
        return SHEET_NAME; // Default to 'Members data'
    }
    
    // November always uses current data
    if (month === 'November') {
        return SHEET_NAME; // Use 'Members data'
    }
    
    // Future months use current data
    if (isFutureMonth(month)) {
        return SHEET_NAME; // Use 'Members data'
    }
    
    // Format: "{Month name} data final" (e.g., "October data final")
    return month + ' data final';
}

// Function to fetch data from Google Sheets
async function fetchMemberData(sheetName = null, fallbackToCurrent = false) {
    try {
        // Check if we have a valid API key
        if (!API_KEY || API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY') {
            if (fallbackToCurrent) {
                // Try to fetch current data as fallback
                await fetchMemberData(SHEET_NAME, false);
                return;
            }
            showDataNotFound();
            return;
        }
        
        // Check if selected month is November or a future month
        // If so, use current data and show notification
        if (!sheetName && currentMonth !== 'default') {
            const targetSheetName = getSheetName(currentMonth);
            if (targetSheetName === SHEET_NAME && (currentMonth === 'November' || isFutureMonth(currentMonth))) {
                // Show notification that we're using current data
                const monthLabel = currentMonth;
                showNotification(monthLabel + ' data not available, showing current data instead', 'info');
                // Update dropdown to show "Current Month"
                const monthFilter = document.getElementById('monthFilter');
                if (monthFilter) {
                    monthFilter.value = 'default';
                }
                currentMonth = 'default';
            }
        }
        
        // Use provided sheet name or get based on current month
        const targetSheetName = sheetName || getSheetName(currentMonth);
        
        // Use Google Sheets API
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(targetSheetName)}?key=${API_KEY}`);
        
        if (!response.ok) {
            if (response.status === 400) {
                // Sheet not found
                if (fallbackToCurrent && currentMonth !== 'default') {
                    // Show notification and fetch current data
                    const monthName = currentMonth;
                    // Reset to default before fetching
                    const originalMonth = currentMonth;
                    currentMonth = 'default';
                    // Update dropdown if it exists
                    const monthFilter = document.getElementById('monthFilter');
                    if (monthFilter) {
                        monthFilter.value = 'default';
                    }
                    showNotification(monthName + ' data not found showing current data instead', 'info');
                    // Fetch current data
                    await fetchMemberData(SHEET_NAME, false);
                    return;
                }
                showDataNotFound();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if data is empty or has no values
        if (!data.values || data.values.length === 0) {
            if (fallbackToCurrent && currentMonth !== 'default') {
                // Show notification and fetch current data
                const monthName = currentMonth;
                // Reset to default before fetching
                const originalMonth = currentMonth;
                currentMonth = 'default';
                // Update dropdown if it exists
                const monthFilter = document.getElementById('monthFilter');
                if (monthFilter) {
                    monthFilter.value = 'default';
                }
                showNotification(monthName + ' data not found showing current data instead', 'info');
                // Fetch current data
                await fetchMemberData(SHEET_NAME, false);
                return;
            }
            showDataNotFound();
            return;
        }
        
        rawSheetData = data.values || [];
        
        // Process the data
        processSheetData();
        
    } catch (error) {
        // Show error message instead of fallback data
        console.error('Error fetching data:', error);
        if (fallbackToCurrent && currentMonth !== 'default') {
            // Show notification and fetch current data
            const monthName = currentMonth;
            // Reset to default before fetching
            currentMonth = 'default';
            // Update dropdown if it exists
            const monthFilter = document.getElementById('monthFilter');
            if (monthFilter) {
                monthFilter.value = 'default';
            }
            showNotification(monthName + ' data not found showing current data instead', 'info');
            // Fetch current data
            await fetchMemberData(SHEET_NAME, false);
            return;
        }
        showDataNotFound();
    }
}

// Function to show "data is not found" message
function showDataNotFound() {
    memberData = [];
    rawSheetData = [];
    currentData = [];
    
    // Clear the table
    const tbody = document.getElementById('rankingTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; font-family: \'Unbounded\', sans-serif; font-size: 1.2rem; color: #666;">Data is not found</td></tr>';
    }
    
    // Update statistics to show zeros
    const totalMembersEl = document.getElementById('totalMembers');
    const totalApprovalsEl = document.getElementById('totalApprovals');
    const totalSlotsEl = document.getElementById('totalSlots');
    
    if (totalMembersEl) totalMembersEl.textContent = '0';
    if (totalApprovalsEl) totalApprovalsEl.textContent = '0';
    if (totalSlotsEl) totalSlotsEl.textContent = '0';
    
    // Update top performers
    const performer1 = document.getElementById('topPerformer1');
    const performer2 = document.getElementById('topPerformer2');
    const performer3 = document.getElementById('topPerformer3');
    const performer1Approvals = document.getElementById('topPerformer1Approvals');
    const performer2Approvals = document.getElementById('topPerformer2Approvals');
    const performer3Approvals = document.getElementById('topPerformer3Approvals');
    const performer1Slots = document.getElementById('topPerformer1Slots');
    const performer2Slots = document.getElementById('topPerformer2Slots');
    const performer3Slots = document.getElementById('topPerformer3Slots');
    
    if (performer1) performer1.textContent = 'No data';
    if (performer2) performer2.textContent = 'No data';
    if (performer3) performer3.textContent = 'No data';
    if (performer1Approvals) performer1Approvals.textContent = '0 Approvals';
    if (performer2Approvals) performer2Approvals.textContent = '0 Approvals';
    if (performer3Approvals) performer3Approvals.textContent = '0 Approvals';
    if (performer1Slots) performer1Slots.style.display = 'none';
    if (performer2Slots) performer2Slots.style.display = 'none';
    if (performer3Slots) performer3Slots.style.display = 'none';
    
    // Show notification
    showNotification('Data is not found for the selected period', 'error');
}

// Process raw sheet data into member objects
function processSheetData() {
    memberData = [];
    
    // Skip header row (index 0)
    for (let i = 1; i < rawSheetData.length; i++) {
        const row = rawSheetData[i];
        
        // Ensure row has enough columns (minimum 7 for our required columns)
        if (row.length < 7) {
            continue;
        }
        
        const memberID = row[0] || ''; // Column A: Member ID
        const memberName = row[1] || ''; // Column B: Member Name
        let lcName = row[3] || ''; // Column D: Local Committee
        const functionString = row[4] || ''; // Column E: Function/Product
        const approvals = parseInt(row[7]) || 0; // Column H: Total Approvals (if exists)
        const slots = parseInt(row[8]) || 0; // Column I: Total Slots (if exists)
        
        // Clean up committee names (fix "Zewail" issue)
        if (lcName.toLowerCase().includes('zewail')) {
            lcName = 'Cairo University'; // Replace Zewail with Cairo University
        }
        
        // Skip empty rows
        if (!memberName.trim()) {
            continue;
        }
        
        const product = extractProductAbbreviation(functionString);
        const region = getRegionFromLC(lcName);
        
        memberData.push({
            id: i,
            memberID: memberID.trim(),
            memberName: memberName.trim(),
            lc: lcName.trim(),
            product: product,
            approvals: approvals,
            slotsOpened: slots,
            region: region
        });
    }
}

// Sample data function removed - no longer using mockup data

// Manual refresh function
async function refreshData() {
    const refreshButton = document.querySelector('.refresh-btn');
    if (refreshButton) {
        refreshButton.innerHTML = '<div class="loading-spinner"></div> Refreshing...';
        refreshButton.disabled = true;
    }
    
    try {
        // Fetch data using current month selection
        await fetchMemberData();
        currentData = [...memberData];
        sortData(currentSort, sortDirection);
        renderTableView();
        updateStatistics();
        updateSlotsColumnVisibility();
        updateSortIndicators();
        updateLastUpdatedTime();
        setupLCFiltering();
        
        // Show success message
        showNotification('Data refreshed successfully!', 'success');
        
    } catch (error) {
        showNotification('Error refreshing data. Using cached data.', 'error');
    } finally {
        if (refreshButton) {
            refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshButton.disabled = false;
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Global variables
let currentData = [...memberData];
let currentSort = 'approvals';
let sortDirection = 'desc'; // 'asc' or 'desc'
let currentProduct = 'OGV'; // Default to OGV
let currentLC = 'all'; // Default to all LCs

// Initialize the ranking page
document.addEventListener('DOMContentLoaded', async function() {
    // Fetch member data first
    await fetchMemberData();
    
    initializeRankingPage();
    setupEventListeners();
    renderTableView();
    updateStatistics();
    updateSlotsColumnVisibility();
    updateSortIndicators();
    updateSubmitAPDButtonVisibility();
    initializeCharts();
    updateLastUpdatedTime();
    
    // Update time every minute
    setInterval(updateLastUpdatedTime, 60000);
    
    // Refresh data every 5 minutes (uses current month selection)
    setInterval(async () => {
        await fetchMemberData();
        initializeRankingPage();
        renderTableView();
        updateStatistics();
        updateSlotsColumnVisibility();
        updateSortIndicators();
        setupLCFiltering();
    }, 300000);
});

// Initialize the ranking page
function initializeRankingPage() {
    // Filter data by default product (OGV)
    filterByProduct('OGV');
    
    
    // Setup table sorting
    setupTableSorting();
    
    // Initialize sorting indicators
    updateSortIndicators();
    
    // Setup product tabs
    setupProductTabs();
    
    // Setup LC filtering
    setupLCFiltering();
    
    // Setup event listeners
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Product tabs are handled in setupProductTabs()
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchMembers(this.value);
        });
    }
    
    // Sort functionality
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            const sortValue = this.value;
            let sortType, sortDirection;
            
            if (sortValue.includes('-')) {
                [sortType, sortDirection] = sortValue.split('-');
                sortDirection = sortDirection === 'asc' ? 'asc' : 'desc';
            } else {
                sortType = sortValue;
                sortDirection = 'desc'; // Default to descending
            }
            
            sortData(sortType, sortDirection);
            calculateGlobalRanks();
            renderTableView();
            updateStatistics();
            updateSlotsColumnVisibility();
            updateSortIndicators();
        });
    }
    
    // LC filter functionality
    const lcFilter = document.getElementById('lcFilter');
    if (lcFilter) {
        lcFilter.addEventListener('change', function() {
            filterByLC(this.value);
        });
    }
    
    // Month filter functionality
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', async function() {
            const selectedMonth = this.value;
            currentMonth = selectedMonth;
            
            // Show loading state
            const monthLabel = currentMonth === 'default' ? 'Current Month' : currentMonth;
            showNotification('Loading data for ' + monthLabel + '...', 'info');
            
            // Fetch data for selected month with fallback enabled for non-default months
            const shouldFallback = currentMonth !== 'default';
            await fetchMemberData(null, shouldFallback);
            
            // Only re-initialize if data was found
            if (memberData.length > 0) {
                // Re-initialize the page with new data
                initializeRankingPage();
                renderTableView();
                updateStatistics();
                updateSlotsColumnVisibility();
                updateSortIndicators();
                updateSubmitAPDButtonVisibility();
                setupLCFiltering();
                
                // Show success message only if we didn't already show a fallback message
                // (fallback message is shown in fetchMemberData, so we check if month changed)
                if (currentMonth === selectedMonth) {
                    showNotification('Data loaded successfully!', 'success');
                }
            }
        });
    }
    
}

// Sort data based on selected criteria
function sortData(sortType, direction = 'desc') {
    currentData.sort((a, b) => {
        let comparison = 0;
        
        switch (sortType) {
            case 'memberName':
                comparison = a.memberName.localeCompare(b.memberName);
                break;
            case 'lc':
                comparison = a.lc.localeCompare(b.lc);
                break;
            case 'product':
                comparison = a.product.localeCompare(b.product);
                break;
            case 'approvals':
                comparison = a.approvals - b.approvals;
                break;
            case 'slotsOpened':
                comparison = (a.slotsOpened || 0) - (b.slotsOpened || 0);
                break;
            default:
                comparison = a.approvals - b.approvals;
        }
        
        return direction === 'desc' ? -comparison : comparison;
    });
    
    currentSort = sortType;
    sortDirection = direction;
}

// Calculate global rank for each member based on the current product context
function calculateGlobalRanks() {
    // Create a copy of current data with all members for the current product
    let contextData = [];
    
    if (currentProduct === 'all') {
        contextData = [...memberData];
    } else if (currentProduct === 'OGT') {
        contextData = memberData.filter(member => 
            member.product === 'OGTA' || 
            member.product === 'oGTe' || 
            member.product === 'OGTA/E' ||
            member.product === 'OGT'
        );
    } else if (currentProduct === 'IGT') {
        contextData = memberData.filter(member => 
            member.product === 'IGTA' || 
            member.product === 'iGTe' || 
            member.product === 'IGTA/E' ||
            member.product === 'IGT'
        );
    } else if (currentProduct === 'B2B') {
        contextData = memberData.filter(member => member.product === 'B2B');
    } else {
        contextData = memberData.filter(member => member.product === currentProduct);
    }
    
    // Sort context data using the same criteria as current sort
    const sortedContextData = [...contextData].sort((a, b) => {
        let comparison = 0;
        
        switch (currentSort) {
            case 'memberName':
                comparison = a.memberName.localeCompare(b.memberName);
                break;
            case 'lc':
                comparison = a.lc.localeCompare(b.lc);
                break;
            case 'product':
                comparison = a.product.localeCompare(b.product);
                break;
            case 'approvals':
                comparison = a.approvals - b.approvals;
                break;
            case 'slotsOpened':
                comparison = (a.slotsOpened || 0) - (b.slotsOpened || 0);
                break;
            default:
                comparison = a.approvals - b.approvals;
        }
        
        return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    // Store sorted context data
    globalSortedData = sortedContextData;
}

// Filter data by product
function filterByProduct(productName) {
    currentProduct = productName; // Update current product
    
    let filteredData = [];
    
    if (productName === 'all') {
        filteredData = [...memberData];
    } else if (productName === 'OGT') {
        // Show all OGT variants: oGTa, oGTe, oGTa/e
        filteredData = memberData.filter(member => 
            member.product === 'OGTA' || 
            member.product === 'oGTe' || 
            member.product === 'OGTA/E' ||
            member.product === 'OGT'
        );
    } else if (productName === 'IGT') {
        // Show all IGT variants: iGTa, iGTe, iGTa/e
        filteredData = memberData.filter(member => 
            member.product === 'IGTA' || 
            member.product === 'iGTe' || 
            member.product === 'IGTA/E' ||
            member.product === 'IGT'
        );
    } else if (productName === 'B2B') {
        // Show B2B members
        filteredData = memberData.filter(member => member.product === 'B2B');
    } else {
        filteredData = memberData.filter(member => member.product === productName);
    }
    
    // Apply LC filter if active
    if (currentLC !== 'all') {
        filteredData = filteredData.filter(member => member.lc === currentLC);
    }
    
    currentData = filteredData;
    
    // Set default sort based on product type
    if (productName === 'B2B') {
        // B2B products: sort by slots by default
        sortData('slotsOpened', 'desc');
    } else {
        // Other products: sort by approvals by default
        sortData('approvals', 'desc');
    }
    
    // Calculate global ranks for the context
    calculateGlobalRanks();
    
    renderTableView();
    updateStatistics();
    updateSlotsColumnVisibility();
    updateSortIndicators();
    updateSubmitAPDButtonVisibility();
}

// Update Submit ICX APD button visibility
function updateSubmitAPDButtonVisibility() {
    const submitAPDContainer = document.getElementById('submitAPDContainer');
    if (!submitAPDContainer) return;
    
    // Show button only for IGV and IGT products
    if (currentProduct === 'IGV' || currentProduct === 'IGT') {
        submitAPDContainer.style.display = 'block';
    } else {
        submitAPDContainer.style.display = 'none';
    }
}

// Filter data by Local Committee
function filterByLC(lc) {
    currentLC = lc;
    
    // Start with all data
    let filteredData = [...memberData];
    
    // Apply product filter first
    if (currentProduct !== 'all') {
        if (currentProduct === 'OGT') {
            filteredData = filteredData.filter(member => 
                member.product === 'OGTA' || 
                member.product === 'oGTe' || 
                member.product === 'OGTA/E' ||
                member.product === 'OGT'
            );
        } else if (currentProduct === 'IGT') {
            filteredData = filteredData.filter(member => 
                member.product === 'IGTA' || 
                member.product === 'iGTe' || 
                member.product === 'IGTA/E' ||
                member.product === 'IGT'
            );
        } else if (currentProduct === 'B2B') {
            filteredData = filteredData.filter(member => member.product === 'B2B');
        } else {
            filteredData = filteredData.filter(member => member.product === currentProduct);
        }
    }
    
    // Apply LC filter
    if (lc !== 'all') {
        filteredData = filteredData.filter(member => member.lc === lc);
    }
    
    currentData = filteredData;
    
    // Set default sort based on product type (same logic as filterByProduct)
    if (currentProduct === 'B2B') {
        // B2B products: sort by slots by default
        sortData('slotsOpened', 'desc');
    } else {
        // Other products: sort by approvals by default
        sortData('approvals', 'desc');
    }
    
    // Calculate global ranks for the context
    calculateGlobalRanks();
    
    // Re-render data
    renderTableView();
    updateStatistics();
    updateSlotsColumnVisibility();
    updateSortIndicators();
    updateSubmitAPDButtonVisibility();
}

// Setup LC filtering functionality
function setupLCFiltering() {
    const lcFilter = document.getElementById('lcFilter');
    if (!lcFilter) return;
    
    // Get unique LCs from member data
    const uniqueLCs = [...new Set(memberData.map(member => member.lc))].sort();
    
    // Clear existing options (except "All Local Committees")
    lcFilter.innerHTML = '<option value="all">All Local Committees</option>';
    
    // Add LC options
    uniqueLCs.forEach(lc => {
        const option = document.createElement('option');
        option.value = lc;
        option.textContent = lc;
        lcFilter.appendChild(option);
    });
}

// Search Members
function searchMembers(searchTerm) {
    if (!searchTerm.trim()) {
        // Reset to show all members filtered by current product and LC
        if (currentLC !== 'all') {
            filterByLC(currentLC);
        } else {
            filterByProduct(currentProduct);
        }
        return;
    }
    
    const term = searchTerm.toLowerCase();
    let filteredData = memberData.filter(member => 
        member.memberName.toLowerCase().includes(term) ||
        member.lc.toLowerCase().includes(term) ||
        member.product.toLowerCase().includes(term)
    );
    
    // Apply current product filter to search results
    if (currentProduct !== 'all') {
        if (currentProduct === 'OGT') {
            filteredData = filteredData.filter(member => 
                member.product === 'OGTA' || 
                member.product === 'oGTe' || 
                member.product === 'OGTA/E' ||
                member.product === 'OGT'
            );
        } else if (currentProduct === 'IGT') {
            filteredData = filteredData.filter(member => 
                member.product === 'IGTA' || 
                member.product === 'iGTe' || 
                member.product === 'IGTA/E' ||
                member.product === 'IGT'
            );
        } else if (currentProduct === 'B2B') {
            filteredData = filteredData.filter(member => member.product === 'B2B');
        } else {
            filteredData = filteredData.filter(member => member.product === currentProduct);
        }
    }
    
    // Apply current LC filter to search results
    if (currentLC !== 'all') {
        filteredData = filteredData.filter(member => member.lc === currentLC);
    }
    
    currentData = filteredData;
    sortData(currentSort, sortDirection);
    calculateGlobalRanks();
    renderTableView();
    updateStatistics();
    updateSlotsColumnVisibility();
    updateSortIndicators();
}


// Render ranking data
function renderRankingData() {
    renderTableView();
    
    // Update top performers
    updateTopPerformers();
}

// Render table view
function renderTableView() {
    const tbody = document.getElementById('rankingTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Calculate global ranks before rendering
    calculateGlobalRanks();
    
    currentData.forEach((member, index) => {
        // Find the member's rank in the global sorted data
        const globalRank = globalSortedData.findIndex(m => 
            m.memberName === member.memberName && 
            m.lc === member.lc && 
            m.product === member.product
        ) + 1;
        
        const rank = globalRank;
        const row = document.createElement('tr');
        
        // Check if this is an "O" product (no slots), "I" product (show slots), or B2B (show slots only)
        const isOProduct = member.product.startsWith('O') || 
                          member.product.startsWith('o') ||
                          member.product === 'OGT' ||
                          member.product === 'OGTA' ||
                          member.product === 'oGTe' ||
                          member.product === 'OGTA/E' ||
                          member.product === 'OGV';
        const isB2BProduct = member.product === 'B2B';
        // For O products, show empty string. For I products and B2B, show actual slots value
        const slotsDisplay = isOProduct ? '' : (member.slotsOpened !== undefined && member.slotsOpened !== null ? member.slotsOpened : 0).toLocaleString();
        
        // Different HTML for B2B vs other products
        if (isB2BProduct) {
            // B2B: Show slots only, no approvals
            row.innerHTML = `
                <td class="rank-cell rank-${rank <= 3 ? rank : ''}">${rank}</td>
                <td class="member-name">${member.memberName}</td>
                <td class="lc-name">${member.lc}</td>
                <td class="product-name">${member.product}</td>
                <td class="metric-value" style="display: none;"></td>
                <td class="metric-value slots-cell">${slotsDisplay}</td>
            `;
        } else {
            // Other products: Show approvals and slots
            row.innerHTML = `
                <td class="rank-cell rank-${rank <= 3 ? rank : ''}">${rank}</td>
                <td class="member-name">${member.memberName}</td>
                <td class="lc-name">${member.lc}</td>
                <td class="product-name">${member.product}</td>
                <td class="metric-value">${member.approvals.toLocaleString()}</td>
                <td class="metric-value slots-cell">${slotsDisplay}</td>
            `;
        }
        
        tbody.appendChild(row);
    });
}


// Update top performers section
function updateTopPerformers() {
    const top3 = currentData.slice(0, 3);
    
    // Check if current data contains O products (hide slots)
    const hasOProducts = currentData.some(member => 
        member.product.startsWith('O') || 
        member.product.startsWith('o') ||
        member.product === 'OGT' ||
        member.product === 'OGTA' ||
        member.product === 'oGTe' ||
        member.product === 'OGTA/E' ||
        member.product === 'OGV'
    );
    
    // Update performer 1
    const performer1 = document.getElementById('topPerformer1');
    const performer1Approvals = document.getElementById('topPerformer1Approvals');
    const performer1Slots = document.getElementById('topPerformer1Slots');
    
    if (performer1 && top3[0]) {
        performer1.textContent = top3[0].memberName;
        if (performer1Approvals) {
            performer1Approvals.textContent = `${top3[0].approvals.toLocaleString()} Approvals`;
        }
        if (performer1Slots) {
            if (hasOProducts) {
                performer1Slots.style.display = 'none';
            } else {
                performer1Slots.style.display = 'inline';
                performer1Slots.textContent = `${(top3[0].slotsOpened || 0).toLocaleString()} Slots`;
            }
        }
    } else if (performer1) {
        performer1.textContent = 'No data';
        if (performer1Approvals) performer1Approvals.textContent = '0 Approvals';
        if (performer1Slots) performer1Slots.style.display = 'none';
    }
    
    // Update performer 2
    const performer2 = document.getElementById('topPerformer2');
    const performer2Approvals = document.getElementById('topPerformer2Approvals');
    const performer2Slots = document.getElementById('topPerformer2Slots');
    
    if (performer2 && top3[1]) {
        performer2.textContent = top3[1].memberName;
        if (performer2Approvals) {
            performer2Approvals.textContent = `${top3[1].approvals.toLocaleString()} Approvals`;
        }
        if (performer2Slots) {
            if (hasOProducts) {
                performer2Slots.style.display = 'none';
            } else {
                performer2Slots.style.display = 'inline';
                performer2Slots.textContent = `${(top3[1].slotsOpened || 0).toLocaleString()} Slots`;
            }
        }
    } else if (performer2) {
        performer2.textContent = 'No data';
        if (performer2Approvals) performer2Approvals.textContent = '0 Approvals';
        if (performer2Slots) performer2Slots.style.display = 'none';
    }
    
    // Update performer 3
    const performer3 = document.getElementById('topPerformer3');
    const performer3Approvals = document.getElementById('topPerformer3Approvals');
    const performer3Slots = document.getElementById('topPerformer3Slots');
    
    if (performer3 && top3[2]) {
        performer3.textContent = top3[2].memberName;
        if (performer3Approvals) {
            performer3Approvals.textContent = `${top3[2].approvals.toLocaleString()} Approvals`;
        }
        if (performer3Slots) {
            if (hasOProducts) {
                performer3Slots.style.display = 'none';
            } else {
                performer3Slots.style.display = 'inline';
                performer3Slots.textContent = `${(top3[2].slotsOpened || 0).toLocaleString()} Slots`;
            }
        }
    } else if (performer3) {
        performer3.textContent = 'No data';
        if (performer3Approvals) performer3Approvals.textContent = '0 Approvals';
        if (performer3Slots) performer3Slots.style.display = 'none';
    }
}

// Update statistics
function updateStatistics() {
    const totalMembers = currentData.length;
    const totalApprovals = currentData.reduce((sum, member) => sum + member.approvals, 0);
    const totalSlots = currentData.reduce((sum, member) => sum + (member.slotsOpened || 0), 0);
    
    const totalMembersEl = document.getElementById('totalMembers');
    const totalApprovalsEl = document.getElementById('totalApprovals');
    const totalSlotsEl = document.getElementById('totalSlots');
    
    if (totalMembersEl) totalMembersEl.textContent = totalMembers.toLocaleString();
    
    // Check if current data contains O products (hide slots) or B2B (show slots, hide approvals)
    const hasOProducts = currentData.some(member => 
        member.product.startsWith('O') || 
        member.product.startsWith('o') ||
        member.product === 'OGT' ||
        member.product === 'OGTA' ||
        member.product === 'oGTe' ||
        member.product === 'OGTA/E' ||
        member.product === 'OGV'
    );
    
    const hasB2BProducts = currentData.some(member => member.product === 'B2B');
    
    // Handle approvals display
    if (totalApprovalsEl) {
        if (hasB2BProducts) {
            // Hide approvals stat for B2B products
            totalApprovalsEl.parentElement.style.display = 'none';
        } else {
            // Show approvals stat for other products
            totalApprovalsEl.parentElement.style.display = 'flex';
            totalApprovalsEl.textContent = totalApprovals.toLocaleString();
        }
    }
    
    // Handle slots display
    if (totalSlotsEl) {
        if (hasOProducts) {
            // Hide slots stat for O products
            totalSlotsEl.parentElement.style.display = 'none';
        } else {
            // Show slots stat for I products and B2B
            totalSlotsEl.parentElement.style.display = 'flex';
            totalSlotsEl.textContent = totalSlots.toLocaleString();
        }
    }
}

// Setup table sorting functionality
function setupTableSorting() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sortType = this.getAttribute('data-sort');
            
            // Toggle sort direction if clicking the same column
            if (currentSort === sortType) {
                sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
            } else {
                sortDirection = 'desc'; // Default to descending for new columns
            }
            
            sortData(sortType, sortDirection);
            calculateGlobalRanks();
            renderTableView();
            updateStatistics();
            updateSlotsColumnVisibility();
            updateSortIndicators();
        });
        
        // Add hover effect
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
    });
}

// Update sort indicators on table headers
function updateSortIndicators() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        const sortType = header.getAttribute('data-sort');
        
        // Remove all sort classes first
        header.classList.remove('sort-asc', 'sort-desc');
        
        // Add the appropriate sort class to the active column
        if (currentSort === sortType) {
            if (sortDirection === 'desc') {
                header.classList.add('sort-desc');
            } else {
                header.classList.add('sort-asc');
            }
        }
    });
}

// Update slots column visibility based on current filter
function updateSlotsColumnVisibility() {
    const slotsHeader = document.getElementById('slotsHeader');
    const slotsCells = document.querySelectorAll('.slots-cell');
    const approvalsHeader = document.querySelector('.ranking-table th:nth-child(5)');
    const approvalsCells = document.querySelectorAll('.ranking-table td:nth-child(5)');
    const rankingTable = document.querySelector('.ranking-table');
    
    if (!slotsHeader) {
        return;
    }
    
    // Remove last-visible-column class from all columns first
    document.querySelectorAll('.ranking-table th, .ranking-table td').forEach(cell => {
        cell.classList.remove('last-visible-column');
    });
    
    // Handle B2B mode separately
    if (currentProduct === 'B2B') {
        // B2B mode: hide approvals, show slots only
        rankingTable.classList.add('b2b-mode');
        
        // Change header text for B2B
        if (slotsHeader) {
            slotsHeader.textContent = 'Slots';
        }
        
        // Add last-visible-column class to slots column
        slotsHeader.classList.add('last-visible-column');
        slotsCells.forEach(cell => cell.classList.add('last-visible-column'));
        return;
    } else {
        // Remove B2B mode class and restore original header text
        rankingTable.classList.remove('b2b-mode');
        if (slotsHeader) {
            slotsHeader.textContent = 'Slots Opened';
        }
    }
    
    // Check if current product filter is for "I" products (ICX) or "O" products (OGX)
    // Show slots column only for ICX products (IGV, IGT variants)
    const isICXProduct = currentProduct === 'IGV' || 
                        currentProduct === 'IGT' ||
                        currentProduct === 'ICX' ||
                        (currentData.length > 0 && currentData.every(member => 
                            member.product.startsWith('I') || 
                            member.product.startsWith('i') ||
                            member.product === 'IGT' ||
                            member.product === 'IGTA' ||
                            member.product === 'iGTe' ||
                            member.product === 'IGTA/E' ||
                            member.product === 'IGV'
                        ));
    
    if (isICXProduct) {
        // Show slots column - slots is the last visible column for ICX
        slotsHeader.classList.add('show-slots');
        slotsCells.forEach(cell => cell.classList.add('show-slots'));
        
        // Add last-visible-column class to slots column
        slotsHeader.classList.add('last-visible-column');
        slotsCells.forEach(cell => cell.classList.add('last-visible-column'));
    } else {
        // Hide slots column - approvals is the last visible column for OGX
        slotsHeader.classList.remove('show-slots');
        slotsCells.forEach(cell => cell.classList.remove('show-slots'));
        
        // Add last-visible-column class to approvals column
        if (approvalsHeader) {
            approvalsHeader.classList.add('last-visible-column');
        }
        approvalsCells.forEach(cell => {
            cell.classList.add('last-visible-column');
        });
    }
}

// Setup product buttons functionality
function setupProductTabs() {
    const productButtons = document.querySelectorAll('.product-btn');
    
    productButtons.forEach(button => {
        button.addEventListener('click', function() {
            const product = this.getAttribute('data-product');
            
            // Remove active class from all buttons
            productButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Filter data by selected product
            filterByProduct(product);
        });
    });
}


// Update last updated time
function updateLastUpdatedTime() {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastUpdatedEl.textContent = timeString;
    }
}

// Initialize charts
function initializeCharts() {
    initializeApprovalChart();
    initializeFunctionChart();
}

// Initialize approval trends chart
function initializeApprovalChart() {
    const ctx = document.getElementById('approvalChart');
    if (!ctx) return;
    
    // Sample data for approval trends
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const approvals = [180, 220, 195, 280, 320, 380];
    const slots = [120, 150, 135, 190, 210, 250];
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Approvals',
                    data: approvals,
                    borderColor: '#037EF3',
                    backgroundColor: 'rgba(3, 126, 243, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Slots Opened',
                    data: slots,
                    borderColor: '#8a2be2',
                    backgroundColor: 'rgba(138, 43, 226, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#404040'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#555'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#555'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            }
        }
    });
}

// Initialize function distribution chart
function initializeFunctionChart() {
    const ctx = document.getElementById('functionChart');
    if (!ctx) return;
    
    // Sample data for function distribution
    const functions = ['OGV', 'IGV', 'OGT', 'IGT'];
    const counts = [45, 38, 42, 35];
    const colors = ['#037EF3', '#8a2be2', '#FFD700', '#FF6B35'];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: functions,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#404040',
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
    }
});

// Performance optimization: Debounce search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debouncing to search
const debouncedSearch = debounce(searchMembers, 300);
document.getElementById('searchInput')?.addEventListener('input', function() {
    debouncedSearch(this.value);
});

// ==================== ICX APD SUBMISSIONS INTEGRATION ====================
// Handle APD submissions and update member data accordingly

// Function to process APD submission and update member data
function processAPDSubmission(apdData) {
    if (!apdData || !apdData.epID || !apdData.product) {
        return false;
    }
    
    // Find member by EP ID and product
    const member = memberData.find(m => 
        m.memberID === apdData.epID && 
        m.product === apdData.product.toUpperCase()
    );
    
    if (member) {
        // Update member approvals (assuming APD = approval for ICX)
        member.approvals = (member.approvals || 0) + 1;
        return true;
    } else {
        return false;
    }
}

// Listen for APD submission events from other pages
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'APD_SUBMITTED') {
        setTimeout(() => {
            refreshData();
        }, 2000);
    }
});
