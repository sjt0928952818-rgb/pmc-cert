/**
 * Main Application Logic for CertiVerify
 * Controls UI view switching, search & query handling, table rendering, and AI parsing events.
 */

// Selected file state for AI intake
let selectedDocumentFile = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  renderLucideIcons();
  refreshRegistryTable();
  updateApiKeyStatusUI();
  updateStaffAdminUI();

  // Check URL parameters (e.g. ?cert=PMC-CE-2026-9081)
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('cert') || urlParams.get('q');
  if (queryParam) {
    document.getElementById('search-input').value = queryParam;
    executeSearch(queryParam);
  }
});

/**
 * Re-render dynamic Lucide icons
 */
function renderLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Authorized staff passcode key
const AUTH_STORAGE_KEY = 'pmc_staff_authorized_token';
const DEFAULT_STAFF_PASSCODE = 'PMC-ADMIN-2026';

function isStaffAuthorized() {
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  return Boolean(token && token === DEFAULT_STAFF_PASSCODE);
}

/**
 * Secret staff entrance triggered by clicking the Left-Bottom Footer PMC Logo
 */
function triggerSecretStaffLogin() {
  if (isStaffAuthorized()) {
    switchTab('admin');
    showToast('Welcome back, PMC Staff (gws-n3@pmc.org.tw)', 'info');
  } else {
    openAuthModal();
  }
}

/**
 * Toggle staff view when logged in
 */
function toggleStaffView() {
  const tabAdmin = document.getElementById('tab-admin');
  if (tabAdmin.classList.contains('hidden')) {
    switchTab('admin');
  } else {
    switchTab('public');
  }
}

function updateStaffAdminUI() {
  const pill = document.getElementById('staff-admin-pill');
  if (!pill) return;

  if (isStaffAuthorized()) {
    pill.classList.remove('hidden');
    pill.classList.add('flex');
  } else {
    pill.classList.add('hidden');
    pill.classList.remove('flex');
  }
}

/**
 * Switch Navigation Tab between Public Verification & Staff Admin Portal
 */
function switchTab(tabId) {
  if (tabId === 'admin') {
    if (!isStaffAuthorized()) {
      openAuthModal();
      return;
    }
  }

  const tabPublic = document.getElementById('tab-public');
  const tabAdmin = document.getElementById('tab-admin');
  const btnText = document.getElementById('staff-view-btn-text');

  if (tabId === 'public') {
    tabPublic.classList.remove('hidden');
    tabAdmin.classList.add('hidden');
    if (btnText) btnText.textContent = "Open Staff Portal";
  } else {
    tabPublic.classList.add('hidden');
    tabAdmin.classList.remove('hidden');
    if (btnText) btnText.textContent = "View Public Search";
    refreshRegistryTable();
  }

  updateStaffAdminUI();
  renderLucideIcons();
}

function openAuthModal() {
  document.getElementById('modal-staff-auth').classList.remove('hidden');
  document.getElementById('input-staff-passcode').value = '';
  document.getElementById('input-staff-passcode').focus();
  renderLucideIcons();
}

function closeAuthModal() {
  document.getElementById('modal-staff-auth').classList.add('hidden');
}

function handleStaffAuthSubmit(e) {
  e.preventDefault();
  const inputCode = document.getElementById('input-staff-passcode').value.trim();

  if (inputCode === DEFAULT_STAFF_PASSCODE) {
    localStorage.setItem(AUTH_STORAGE_KEY, inputCode);
    closeAuthModal();
    updateStaffAdminUI();
    showToast('Authorized as PMC Staff: gws-n3@pmc.org.tw', 'success');
    switchTab('admin');
  } else {
    showToast('Invalid passcode. Authorization denied.', 'error');
  }
}

function handleStaffLogout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  updateStaffAdminUI();
  showToast('Logged out of PMC Staff Portal', 'info');
  switchTab('public');
}

/* ==========================================================================
   PUBLIC VERIFICATION SEARCH LOGIC
   ========================================================================== */

function handleSearch(e) {
  e.preventDefault();
  const keyword = document.getElementById('search-input').value.trim();
  executeSearch(keyword);
}

function setQuickSearch(val) {
  document.getElementById('search-input').value = val;
  executeSearch(val);
}

function executeSearch(keyword) {
  if (!keyword) return;

  const resultsSection = document.getElementById('search-results-section');
  resultsSection.classList.remove('hidden');

  const matches = window.certStore.search(keyword);

  if (matches.length === 0) {
    resultsSection.innerHTML = `
      <div class="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-md animate-fade-in">
        <div class="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
          <i data-lucide="shield-x" class="w-8 h-8"></i>
        </div>
        <h3 class="text-xl font-bold text-slate-900">No Verified Certificate Found</h3>
        <p class="text-sm text-slate-600 mt-2 max-w-md mx-auto">
          We could not locate any active or historical certification records matching <span class="font-mono font-semibold text-slate-900">"${escapeHtml(keyword)}"</span>.
        </p>
        <div class="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 max-w-lg mx-auto text-left space-y-1.5">
          <p class="font-semibold text-slate-700">Verification Advice:</p>
          <p>• Please double-check for typographical errors in the Certificate Number or Company Name.</p>
          <p>• Verify that the issuer is officially registered under our compliance alliance.</p>
          <p>• If you suspect this certificate is fraudulent, please contact our Compliance Audit Bureau.</p>
        </div>
      </div>
    `;
  } else {
    const cardsHtml = matches.map(cert => renderCertificateCard(cert)).join('');
    resultsSection.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <div class="flex items-center justify-between px-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-sm font-semibold text-slate-700">Found ${matches.length} matching certificate record(s)</span>
          </div>
          <span class="text-xs text-slate-400">Official Database Match</span>
        </div>
        ${cardsHtml}
      </div>
    `;
  }

  renderLucideIcons();
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderCertificateCard(cert) {
  const isExpired = new Date(cert.expiryDate) < new Date();
  const effectiveStatus = isExpired && cert.status === 'Valid' ? 'Expired' : cert.status;

  let badgeClass = 'badge-valid';
  let badgeIcon = 'check-circle-2';

  if (effectiveStatus === 'Expired') {
    badgeClass = 'badge-expired';
    badgeIcon = 'alert-triangle';
  } else if (effectiveStatus === 'Revoked') {
    badgeClass = 'badge-revoked';
    badgeIcon = 'x-circle';
  } else if (effectiveStatus === 'Suspended') {
    badgeClass = 'badge-suspended';
    badgeIcon = 'pause-circle';
  }

  return `
    <div class="bg-white rounded-2xl border-2 border-slate-200 shadow-xl overflow-hidden cert-card-bg">
      <!-- Top banner header -->
      <div class="bg-gradient-to-r from-pmc-blue via-pmc-blueHover to-slate-900 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center text-white gap-2">
        <div>
          <span class="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">Official PMC Conformity Certificate</span>
          <h3 class="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            ${escapeHtml(cert.certNumber)}
          </h3>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-sm ${badgeClass}">
            <i data-lucide="${badgeIcon}" class="w-3.5 h-3.5"></i>
            ${escapeHtml(effectiveStatus)}
          </span>
        </div>
      </div>

      <!-- Certificate Body Details -->
      <div class="p-6 sm:p-8 space-y-6 relative z-10">
        <!-- Company Section -->
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Manufacturer / Certified Entity</span>
          <p class="text-lg sm:text-xl font-bold text-slate-900">${escapeHtml(cert.companyName)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <!-- Product Info -->
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Product / System / Equipment</span>
            <p class="text-sm font-semibold text-slate-800">${escapeHtml(cert.productName)}</p>
          </div>

          <!-- Model Identifier -->
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Model / Type Specification</span>
            <p class="text-sm font-mono font-medium text-slate-800 bg-slate-50 px-2.5 py-1 rounded inline-block border border-slate-200">
              ${escapeHtml(cert.modelNumber)}
            </p>
          </div>
        </div>

        <!-- Compliance Standards & Directives -->
        <div class="pt-4 border-t border-slate-100">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Applicable Regulations, Standards & Directives</span>
          <div class="flex flex-wrap gap-2">
            ${cert.standards.split(',').map(std => `
              <span class="px-3 py-1 rounded-md bg-blue-50 text-pmc-blue text-xs font-semibold border border-blue-200">
                ${escapeHtml(std.trim())}
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Dates & Validity Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 bg-slate-50/70 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-6">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Date of Issue</span>
            <p class="text-xs font-semibold text-slate-800 font-mono mt-0.5">${cert.issueDate}</p>
          </div>
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Valid Until</span>
            <p class="text-xs font-semibold ${isExpired ? 'text-red-600' : 'text-slate-800'} font-mono mt-0.5">${cert.expiryDate}</p>
          </div>
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Accredited Testing Authority</span>
            <p class="text-xs text-slate-600 truncate mt-0.5" title="${escapeHtml(cert.issuer || 'PMC Certification Bureau')}">${escapeHtml(cert.issuer || 'PMC Certification Bureau')}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   STAFF PORTAL: AI INTAKE & DOCUMENT UPLOAD
   ========================================================================== */

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.add('drag-active');
}

function handleDragLeave(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-active');
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-active');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    processSelectedFile(e.dataTransfer.files[0]);
  }
}

function handleFileSelect(e) {
  if (e.target.files && e.target.files.length > 0) {
    processSelectedFile(e.target.files[0]);
  }
}

function processSelectedFile(file) {
  selectedDocumentFile = file;

  // Show file preview card
  const previewCard = document.getElementById('file-preview-card');
  const filenameElem = document.getElementById('preview-filename');
  const filesizeElem = document.getElementById('preview-filesize');
  
  filenameElem.textContent = file.name;
  filesizeElem.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
  previewCard.classList.remove('hidden');

  // Visual preview if image
  const previewContainer = document.getElementById('document-preview-container');
  const imgPreview = document.getElementById('image-preview');
  const pdfFallback = document.getElementById('pdf-fallback-preview');

  previewContainer.classList.remove('hidden');
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      imgPreview.src = ev.target.result;
      imgPreview.classList.remove('hidden');
      pdfFallback.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    imgPreview.classList.add('hidden');
    pdfFallback.classList.remove('hidden');
  }

  showToast(`File "${file.name}" loaded ready for AI analysis`, 'info');
  renderLucideIcons();
}

function removeSelectedFile() {
  selectedDocumentFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('file-preview-card').classList.add('hidden');
  document.getElementById('document-preview-container').classList.add('hidden');
}

/**
 * Trigger AI Document Parsing
 */
async function runAiExtraction() {
  if (!selectedDocumentFile) {
    showToast('Please select or drag a document file first!', 'error');
    return;
  }

  const btnParse = document.getElementById('btn-parse-ai');
  const btnText = document.getElementById('btn-parse-text');
  const originalHtml = btnText.innerHTML;

  try {
    btnParse.disabled = true;
    btnParse.classList.add('opacity-75', 'cursor-not-allowed');

    const result = await window.certAiParser.extractCertificate(selectedDocumentFile, (statusText) => {
      btnText.textContent = statusText;
    });

    // Populate Right Form with Extracted Attributes
    fillFormFields(result);
    showToast('AI recognition successful! Please review before saving.', 'success');
  } catch (err) {
    console.error('AI Extraction failed:', err);
    showToast(err.message || 'AI Extraction failed', 'error');
  } finally {
    btnParse.disabled = false;
    btnParse.classList.remove('opacity-75', 'cursor-not-allowed');
    btnText.innerHTML = originalHtml;
  }
}

/**
 * One-click demo filler for seamless presentation without physical PDF
 */
function loadSamplePresetAndFill(type = 'med') {
  let sample;
  if (type === 'bess') {
    sample = {
      certNumber: 'PMC-BESS-2026-8830',
      companyName: 'Delta Energy & Power Systems Inc.',
      productName: 'Grid-Connected Industrial Energy Storage System (BESS)',
      modelNumber: 'BESS-MW-500KWH',
      standards: 'IEC 62619:2022, UL 9540A:2019, UN 38.3, IEC 62443-4-2 (Industrial Cybersecurity)',
      issueDate: '2024-02-10',
      expiryDate: '2027-02-09',
      status: 'Valid',
      issuer: 'Precision Machinery Research & Development Center (PMC New Energy Lab)'
    };
    showToast('Loaded Energy Storage & Cybersecurity demo certificate!', 'success');
  } else {
    sample = {
      certNumber: 'PMC-MED-2026-6105',
      companyName: 'Apex BioMed Surgical Technologies Corp.',
      productName: 'AI-Assisted Orthopedic Surgical Navigation Robot',
      modelNumber: 'SURG-NAV-PRO-X',
      standards: 'ISO 13485:2016, IEC 60601-1:2020, IEC 60601-1-2:2014, EU MDR 2017/745',
      issueDate: '2024-05-18',
      expiryDate: '2027-05-17',
      status: 'Valid',
      issuer: 'Precision Machinery Research & Development Center (PMC Medical Lab)'
    };
    showToast('Loaded Medical Device (ISO 13485/MDR) demo certificate!', 'success');
  }

  fillFormFields(sample);
}

/**
 * Populate form with data object
 */
function fillFormFields(data) {
  if (data.id) document.getElementById('entry-id').value = data.id;
  if (data.certNumber) document.getElementById('form-cert-number').value = data.certNumber;
  if (data.companyName) document.getElementById('form-company-name').value = data.companyName;
  if (data.productName) document.getElementById('form-product-name').value = data.productName;
  if (data.modelNumber) document.getElementById('form-model-number').value = data.modelNumber;
  if (data.standards) document.getElementById('form-standards').value = data.standards;
  if (data.issueDate) document.getElementById('form-issue-date').value = data.issueDate;
  if (data.expiryDate) document.getElementById('form-expiry-date').value = data.expiryDate;
  if (data.status) document.getElementById('form-status').value = data.status;
  if (data.issuer) document.getElementById('form-issuer').value = data.issuer;

  // Highlight form to indicate auto-fill
  const formCard = document.getElementById('certificate-form');
  formCard.classList.add('ring-2', 'ring-purple-400', 'transition');
  setTimeout(() => {
    formCard.classList.remove('ring-2', 'ring-purple-400');
  }, 1000);
}

/**
 * Handle form submit (Save to store)
 */
function handleSaveCertificate(e) {
  e.preventDefault();

  const certData = {
    id: document.getElementById('entry-id').value || null,
    certNumber: document.getElementById('form-cert-number').value.trim(),
    companyName: document.getElementById('form-company-name').value.trim(),
    productName: document.getElementById('form-product-name').value.trim(),
    modelNumber: document.getElementById('form-model-number').value.trim(),
    standards: document.getElementById('form-standards').value.trim(),
    issueDate: document.getElementById('form-issue-date').value,
    expiryDate: document.getElementById('form-expiry-date').value,
    status: document.getElementById('form-status').value,
    issuer: document.getElementById('form-issuer').value.trim()
  };

  const saved = window.certStore.upsert(certData);
  showToast(`Certificate "${saved.certNumber}" successfully saved to registry!`, 'success');

  clearCertificateForm();
  refreshRegistryTable();
}

function clearCertificateForm() {
  document.getElementById('certificate-form').reset();
  document.getElementById('entry-id').value = '';
  document.getElementById('form-mode-badge').textContent = 'New Entry';
  document.getElementById('btn-save-label').textContent = 'Confirm & Save to Registry';
}

function editCertificate(id) {
  const item = window.certStore.getById(id);
  if (!item) return;

  fillFormFields(item);
  document.getElementById('form-mode-badge').textContent = 'Editing: ' + item.certNumber;
  document.getElementById('btn-save-label').textContent = 'Update Registry Record';
  
  // Scroll to form
  document.getElementById('certificate-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteCertificate(id) {
  const item = window.certStore.getById(id);
  if (!item) return;

  if (confirm(`Are you sure you want to delete certificate ${item.certNumber}?`)) {
    window.certStore.remove(id);
    refreshRegistryTable();
    showToast(`Certificate ${item.certNumber} removed`, 'info');
  }
}

/* ==========================================================================
   REGISTRY TABLE & EXPORT
   ========================================================================== */

function refreshRegistryTable() {
  const tbody = document.getElementById('registry-table-body');
  const countElem = document.getElementById('total-count');
  const records = window.certStore.getAll();

  countElem.textContent = records.length;

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-slate-400">
          No certificates registered yet. Upload and parse a certificate above to get started.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(cert => {
    let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Valid</span>';
    if (cert.status === 'Expired') statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Expired</span>';
    if (cert.status === 'Revoked') statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">Revoked</span>';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="px-4 py-3 font-mono font-semibold text-slate-900">${escapeHtml(cert.certNumber)}</td>
        <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(cert.companyName)}</td>
        <td class="px-4 py-3">
          <p class="font-medium text-slate-800">${escapeHtml(cert.productName)}</p>
          <p class="text-[11px] text-slate-500 font-mono">${escapeHtml(cert.modelNumber)}</p>
        </td>
        <td class="px-4 py-3">
          <span class="truncate block max-w-xs" title="${escapeHtml(cert.standards)}">${escapeHtml(cert.standards)}</span>
        </td>
        <td class="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
          ${cert.issueDate} ~ ${cert.expiryDate}
        </td>
        <td class="px-4 py-3">${statusBadge}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
          <button onclick="editCertificate('${cert.id}')" class="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100" title="Edit">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="deleteCertificate('${cert.id}')" class="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderLucideIcons();
}

function filterRegistryTable() {
  const query = document.getElementById('table-filter-input').value.toLowerCase();
  const rows = document.querySelectorAll('#registry-table-body tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function exportToCsv() {
  const records = window.certStore.getAll();
  if (records.length === 0) {
    showToast('No records to export!', 'error');
    return;
  }

  const headers = ['Certificate Number', 'Company Name', 'Product Name', 'Model Number', 'Standards', 'Issue Date', 'Expiry Date', 'Status', 'Issuer'];
  const csvRows = [headers.join(',')];

  records.forEach(c => {
    const row = [
      `"${c.certNumber}"`,
      `"${c.companyName.replace(/"/g, '""')}"`,
      `"${c.productName.replace(/"/g, '""')}"`,
      `"${c.modelNumber.replace(/"/g, '""')}"`,
      `"${c.standards.replace(/"/g, '""')}"`,
      `"${c.issueDate}"`,
      `"${c.expiryDate}"`,
      `"${c.status}"`,
      `"${(c.issuer || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Certificates_Registry_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Registry CSV downloaded successfully', 'success');
}

function resetToSampleData() {
  if (confirm('Reset registry back to initial demo certificates?')) {
    window.certStore.resetDefaults();
    refreshRegistryTable();
    showToast('Registry reset to sample records', 'info');
  }
}

/* ==========================================================================
   GEMINI API KEY CONFIG MODAL & TOASTS
   ========================================================================== */

function toggleApiKeyModal() {
  const modal = document.getElementById('modal-api-key');
  const input = document.getElementById('input-gemini-key');
  if (modal.classList.contains('hidden')) {
    input.value = window.certAiParser.getApiKey();
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

function saveApiKey() {
  const input = document.getElementById('input-gemini-key').value.trim();
  
  if (input.startsWith('AQ.')) {
    alert("【金鑰格式提醒】\n您輸入的金鑰開頭為 'AQ.'，這通常是 Google Cloud / Code Assist 的內部金鑰，並非 Google AI Studio 的 Gemini API Key。\n\n請前往 https://aistudio.google.com/app/apikey 點擊「Create API key」取得開頭為 'AIzaSy...' 的免費金鑰！");
  }

  window.certAiParser.setApiKey(input);
  toggleApiKeyModal();
  updateApiKeyStatusUI();
  showToast('Gemini API Key saved in local browser storage', 'success');
}

function clearApiKey() {
  window.certAiParser.setApiKey('');
  toggleApiKeyModal();
  updateApiKeyStatusUI();
  showToast('Gemini API Key removed', 'info');
}

function updateApiKeyStatusUI() {
  const label = document.getElementById('api-key-status-label');
  if (window.certAiParser.hasApiKey()) {
    label.textContent = 'Gemini API: Connected (Live)';
    label.parentElement.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
  } else {
    label.textContent = 'Gemini API: Demo Mode';
    label.parentElement.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  let bgClass = 'bg-slate-900 text-white';
  let icon = 'info';

  if (type === 'success') {
    bgClass = 'bg-emerald-600 text-white';
    icon = 'check-circle';
  } else if (type === 'error') {
    bgClass = 'bg-red-600 text-white';
    icon = 'alert-triangle';
  }

  toast.className = `toast px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  renderLucideIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
