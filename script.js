// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Global state
let masterData = null;
let buyerData = null;
let masterFile = null;
let buyerFile = null;

// DOM Elements
const masterUploadZone = document.getElementById('masterUploadZone');
const masterFileInput = document.getElementById('masterFileInput');
const masterFileInfo = document.getElementById('masterFileInfo');
const masterFileName = document.getElementById('masterFileName');
const masterFileSize = document.getElementById('masterFileSize');
const removeMasterBtn = document.getElementById('removeMasterBtn');

const buyerUploadZone = document.getElementById('buyerUploadZone');
const buyerFileInput = document.getElementById('buyerFileInput');
const buyerFileInfo = document.getElementById('buyerFileInfo');
const buyerFileName = document.getElementById('buyerFileName');
const buyerFileSize = document.getElementById('buyerFileSize');
const removeBuyerBtn = document.getElementById('removeBuyerBtn');

const compareBtn = document.getElementById('compareBtn');
const resultsSection = document.getElementById('resultsSection');
const errorsContainer = document.getElementById('errorsContainer');
const noErrors = document.getElementById('noErrors');
const totalChecked = document.getElementById('totalChecked');
const duplicatesFound = document.getElementById('duplicatesFound');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');

// Event Listeners - Master Upload
masterUploadZone.addEventListener('click', () => masterFileInput.click());
masterFileInput.addEventListener('change', (e) => handleMasterFileSelect(e.target.files[0]));
removeMasterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeMasterFile();
});

// Drag and drop for master
masterUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    masterUploadZone.classList.add('drag-over');
});

masterUploadZone.addEventListener('dragleave', () => {
    masterUploadZone.classList.remove('drag-over');
});

masterUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    masterUploadZone.classList.remove('drag-over');
    handleMasterFileSelect(e.dataTransfer.files[0]);
});

// Event Listeners - Buyer Upload
buyerUploadZone.addEventListener('click', () => buyerFileInput.click());
buyerFileInput.addEventListener('change', (e) => handleBuyerFileSelect(e.target.files[0]));
removeBuyerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeBuyerFile();
});

// Drag and drop for buyer
buyerUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    buyerUploadZone.classList.add('drag-over');
});

buyerUploadZone.addEventListener('dragleave', () => {
    buyerUploadZone.classList.remove('drag-over');
});

buyerUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    buyerUploadZone.classList.remove('drag-over');
    handleBuyerFileSelect(e.dataTransfer.files[0]);
});

// Compare button
compareBtn.addEventListener('click', compareData);

// File handling functions
function handleMasterFileSelect(file) {
    if (!file) return;

    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type)) {
        showToast('❌', 'Please upload a valid Excel file (.xlsx or .xls)');
        return;
    }

    masterFile = file;
    masterFileName.textContent = file.name;
    masterFileSize.textContent = formatFileSize(file.size);
    masterUploadZone.style.display = 'none';
    masterFileInfo.style.display = 'flex';

    parseExcelFile(file, 'master');
    updateCompareButton();
    showToast('✓', 'Master sheet uploaded successfully');
}

function handleBuyerFileSelect(file) {
    if (!file) return;

    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf'
    ];

    if (!validTypes.includes(file.type)) {
        showToast('❌', 'Please upload a valid Excel or PDF file');
        return;
    }

    buyerFile = file;
    buyerFileName.textContent = file.name;
    buyerFileSize.textContent = formatFileSize(file.size);
    buyerUploadZone.style.display = 'none';
    buyerFileInfo.style.display = 'flex';

    if (file.type === 'application/pdf') {
        parsePDFFile(file);
    } else {
        parseExcelFile(file, 'buyer');
    }

    updateCompareButton();
    showToast('✓', 'Buyer form uploaded successfully');
}

function removeMasterFile() {
    masterFile = null;
    masterData = null;
    masterFileInput.value = '';
    masterUploadZone.style.display = 'block';
    masterFileInfo.style.display = 'none';
    updateCompareButton();
    hideResults();
}

function removeBuyerFile() {
    buyerFile = null;
    buyerData = null;
    buyerFileInput.value = '';
    buyerUploadZone.style.display = 'block';
    buyerFileInfo.style.display = 'none';
    updateCompareButton();
    hideResults();
}

function updateCompareButton() {
    compareBtn.disabled = !(masterData && buyerData);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Excel parsing
function parseExcelFile(file, type) {
    showLoading();
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            const normalizedData = normalizeData(jsonData);

            if (type === 'master') {
                masterData = normalizedData;
            } else {
                buyerData = normalizedData;
            }

            hideLoading();
            updateCompareButton();
        } catch (error) {
            hideLoading();
            showToast('❌', 'Error parsing Excel file: ' + error.message);
        }
    };

    reader.onerror = () => {
        hideLoading();
        showToast('❌', 'Error reading file');
    };

    reader.readAsArrayBuffer(file);
}

// PDF parsing
async function parsePDFFile(file) {
    showLoading();
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        // Extract structured data from PDF text
        const extractedData = extractDataFromPDFText(fullText);
        buyerData = normalizeData(extractedData);

        hideLoading();
        updateCompareButton();
    } catch (error) {
        hideLoading();
        showToast('❌', 'Error parsing PDF: ' + error.message);
    }
}

function extractDataFromPDFText(text) {
    // This is a simple extraction - can be customized based on PDF structure
    const lines = text.split('\n').filter(line => line.trim());
    const data = [];

    // Try to extract common patterns
    const namePattern = /name[:\s]+([^\n]+)/i;
    const idPattern = /(?:id|cnic|card)[:\s]+([0-9-]+)/i;
    const fatherPattern = /father[:\s]+([^\n]+)/i;
    const addressPattern = /address[:\s]+([^\n]+)/i;

    const entry = {};

    const nameMatch = text.match(namePattern);
    if (nameMatch) entry.Name = nameMatch[1].trim();

    const idMatch = text.match(idPattern);
    if (idMatch) entry['ID Card'] = idMatch[1].trim();

    const fatherMatch = text.match(fatherPattern);
    if (fatherMatch) entry['Father Name'] = fatherMatch[1].trim();

    const addressMatch = text.match(addressPattern);
    if (addressMatch) entry.Address = addressMatch[1].trim();

    if (Object.keys(entry).length > 0) {
        data.push(entry);
    }

    return data;
}

// Data normalization
function normalizeData(data) {
    return data.map(row => {
        const normalized = {};
        for (let key in row) {
            const normalizedKey = normalizeKey(key);
            normalized[normalizedKey] = normalizeValue(row[key]);
        }
        return normalized;
    });
}

function normalizeKey(key) {
    // Normalize common field name variations
    const keyMap = {
        'name': 'Name',
        'full name': 'Name',
        'fullname': 'Name',
        'id': 'ID Card',
        'id card': 'ID Card',
        'cnic': 'ID Card',
        'identity card': 'ID Card',
        'father': 'Father Name',
        'father name': 'Father Name',
        'fathername': 'Father Name',
        'address': 'Address',
        'location': 'Address',
        'residence': 'Address'
    };

    const lowerKey = key.toLowerCase().trim();
    return keyMap[lowerKey] || key;
}

function normalizeValue(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }
    return value.trim().toLowerCase();
}

// Data comparison
function compareData() {
    if (!masterData || !buyerData) return;

    showLoading();
    resultsSection.style.display = 'none';

    setTimeout(() => {
        const errors = [];
        const fieldsToCheck = ['Name', 'ID Card', 'Father Name', 'Address'];

        buyerData.forEach((buyerRow, buyerIndex) => {
            masterData.forEach((masterRow, masterIndex) => {
                const duplicateFields = [];

                fieldsToCheck.forEach(field => {
                    const buyerValue = buyerRow[field];
                    const masterValue = masterRow[field];

                    if (buyerValue && masterValue && buyerValue === masterValue) {
                        duplicateFields.push({
                            field: field,
                            value: buyerValue,
                            masterValue: masterValue
                        });
                    }
                });

                if (duplicateFields.length > 0) {
                    errors.push({
                        buyerIndex: buyerIndex + 1,
                        masterIndex: masterIndex + 1,
                        duplicateFields: duplicateFields,
                        buyerRow: buyerRow,
                        masterRow: masterRow
                    });
                }
            });
        });

        displayResults(errors, buyerData.length);
        hideLoading();
    }, 500);
}

function displayResults(errors, totalRecords) {
    resultsSection.style.display = 'block';
    totalChecked.textContent = totalRecords;
    duplicatesFound.textContent = errors.length;

    errorsContainer.innerHTML = '';

    if (errors.length === 0) {
        noErrors.style.display = 'block';
        errorsContainer.style.display = 'none';
    } else {
        noErrors.style.display = 'none';
        errorsContainer.style.display = 'flex';

        errors.forEach((error, index) => {
            const errorCard = createErrorCard(error, index);
            errorsContainer.appendChild(errorCard);
        });
    }

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createErrorCard(error, index) {
    const card = document.createElement('div');
    card.className = 'error-card';
    card.style.animationDelay = `${index * 0.1}s`;

    const duplicateFieldsList = error.duplicateFields.map(f => f.field).join(', ');

    let fieldsHTML = '';
    const allFields = ['Name', 'ID Card', 'Father Name', 'Address'];

    allFields.forEach(field => {
        const isDuplicate = error.duplicateFields.some(f => f.field === field);
        const buyerValue = error.buyerRow[field] || 'N/A';
        const masterValue = error.masterRow[field] || 'N/A';

        fieldsHTML += `
            <div class="field-comparison">
                <div class="field-label">${field} ${isDuplicate ? '⚠️ DUPLICATE' : ''}</div>
                <div class="field-value ${isDuplicate ? 'duplicate' : ''}">
                    Buyer: ${buyerValue}
                </div>
                <div class="field-value ${isDuplicate ? 'duplicate' : ''}">
                    Master: ${masterValue}
                </div>
            </div>
        `;
    });

    card.innerHTML = `
        <div class="error-header">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Duplicate Entry Found (Buyer #${error.buyerIndex} ↔ Master #${error.masterIndex})</div>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">
            Matching fields: <strong style="color: #fa709a;">${duplicateFieldsList}</strong>
        </p>
        <div class="error-body">
            ${fieldsHTML}
        </div>
    `;

    return card;
}

function hideResults() {
    resultsSection.style.display = 'none';
}

// UI helpers
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showToast(icon, message) {
    toastIcon.textContent = icon;
    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
