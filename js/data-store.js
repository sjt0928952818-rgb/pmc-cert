/**
 * Data Management & Store for PMC Certificate Verification
 * Multi-Industry Scope: Medical Devices, Energy Storage, Industrial Cybersecurity, 
 * Semiconductor Systems, Advanced Machinery, and Electrical/Electronic Devices.
 */

const STORAGE_KEY = 'pmc_cert_records_v3';
const API_KEY_STORAGE = 'certiverify_gemini_key';
const GAS_ENDPOINT_STORAGE = 'certiverify_gas_url';

// User's active Google Apps Script API Endpoint bound to gws-n3@pmc.org.tw
const DEFAULT_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxTk0NZsNACw3NpIE9sOmcz_YzzbzDYaYsRvIBdBvLx8z29kdZPNRtq4PzM7V8Pf01Nnw/exec';

// Multi-Industry sample certificates representing PMC's comprehensive conformity scopes
const INITIAL_CERTIFICATES = [
  {
    id: 'pmc_med_1',
    certNumber: 'PMC-MED-2026-6105',
    companyName: 'Apex BioMed Surgical Technologies Corp.',
    productName: 'AI-Assisted Orthopedic Surgical Navigation Robot',
    modelNumber: 'SURG-NAV-PRO-X',
    standards: 'ISO 13485:2016, IEC 60601-1:2020 (Ed. 3.2), IEC 60601-1-2:2014, EU MDR 2017/745, ISO 14971:2019',
    issueDate: '2024-05-18',
    expiryDate: '2027-05-17',
    status: 'Valid',
    issuer: 'Precision Machinery Research & Development Center (PMC Medical Device Testing Lab)',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pmc_bess_2',
    certNumber: 'PMC-BESS-2026-8830',
    companyName: 'Delta Energy & Power Systems Inc.',
    productName: 'Grid-Connected Industrial Energy Storage System (BESS)',
    modelNumber: 'BESS-MW-500KWH',
    standards: 'IEC 62619:2022, UL 9540A:2019, UN 38.3, IEC 62443-4-2 (Industrial Cybersecurity), CNS 62933-5-2',
    issueDate: '2024-02-10',
    expiryDate: '2027-02-09',
    status: 'Valid',
    issuer: 'Precision Machinery Research & Development Center (PMC New Energy & Cyber Lab)',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pmc_mach_3',
    certNumber: 'PMC-CE-2026-9081',
    companyName: 'Victor Taichung Machinery Works Co., Ltd.',
    productName: '5-Axis High Precision CNC Vertical Machining Center',
    modelNumber: 'Vcenter-AX800-PRO',
    standards: 'Machinery Directive 2006/42/EC, Regulation (EU) 2023/1230 (MR), EN ISO 12100:2010, EN 60204-1:2018',
    issueDate: '2024-04-10',
    expiryDate: '2027-04-09',
    status: 'Valid',
    issuer: 'Precision Machinery Research & Development Center (PMC Machinery Safety Lab #1024)',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pmc_semi_4',
    certNumber: 'PMC-SEMI-2026-1188',
    companyName: 'Apex Semiconductor Automation Systems Corp.',
    productName: 'EFEM Dual-Arm Wafer Handling Vacuum Transfer Robot',
    modelNumber: 'VAC-ROBO-EFEM-300',
    standards: 'SEMI S2-0720, SEMI S8-0218, SEMI S14, SEMI S22, IEC 61010-1:2010',
    issueDate: '2023-09-01',
    expiryDate: '2026-08-31',
    status: 'Valid',
    issuer: 'PMC Semiconductor & High-Tech Equipment Safety Center',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pmc_emc_5',
    certNumber: 'PMC-EMC-2025-3301',
    companyName: 'Advantech Industrial IoT Connectivity Ltd.',
    productName: 'Intelligent Rugged Industrial Wireless Edge Gateway',
    modelNumber: 'WISE-EDGE-710',
    standards: 'EMC Directive 2014/30/EU, Radio Equipment Directive (RED) 2014/53/EU, IEC 62368-1:2018, EN 55032',
    issueDate: '2022-03-15',
    expiryDate: '2025-03-14',
    status: 'Expired',
    issuer: 'Precision Machinery Research & Development Center (PMC EMC Testing Lab)',
    updatedAt: new Date().toISOString()
  }
];

class CertificateStore {
  constructor() {
    this.records = this.loadRecords();
  }

  loadRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load from local storage, loading defaults:', e);
    }
    this.saveToStorage(INITIAL_CERTIFICATES);
    return [...INITIAL_CERTIFICATES];
  }

  saveToStorage(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save to local storage:', e);
    }
  }

  getAll() {
    return [...this.records];
  }

  getById(id) {
    return this.records.find(item => item.id === id);
  }

  search(keyword) {
    if (!keyword) return [];
    const term = keyword.trim().toLowerCase();

    return this.records.filter(cert => {
      const matchCertNo = cert.certNumber.toLowerCase().includes(term);
      const matchCompany = cert.companyName.toLowerCase().includes(term);
      const matchProduct = cert.productName.toLowerCase().includes(term);
      const matchModel = cert.modelNumber.toLowerCase().includes(term);
      const matchStandards = cert.standards.toLowerCase().includes(term);
      return matchCertNo || matchCompany || matchProduct || matchModel || matchStandards;
    });
  }

  upsert(certData) {
    const existingIndex = this.records.findIndex(c => 
      (certData.id && c.id === certData.id) || 
      c.certNumber.toLowerCase() === certData.certNumber.toLowerCase()
    );

    const now = new Date().toISOString();
    let updatedRecord;

    if (existingIndex >= 0) {
      updatedRecord = {
        ...this.records[existingIndex],
        ...certData,
        updatedAt: now
      };
      this.records[existingIndex] = updatedRecord;
    } else {
      updatedRecord = {
        id: certData.id || 'pmc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        ...certData,
        updatedAt: now
      };
      this.records.unshift(updatedRecord);
    }

    this.saveToStorage(this.records);
    this.syncToGoogleSheets(updatedRecord);

    return updatedRecord;
  }

  remove(id) {
    this.records = this.records.filter(c => c.id !== id);
    this.saveToStorage(this.records);
  }

  resetDefaults() {
    this.records = [...INITIAL_CERTIFICATES];
    this.saveToStorage(this.records);
    return this.records;
  }

  async syncToGoogleSheets(record, filePayload = null) {
    const gasUrl = localStorage.getItem(GAS_ENDPOINT_STORAGE) || DEFAULT_GAS_ENDPOINT;
    if (!gasUrl) return;

    try {
      const payload = {
        action: 'upsert',
        authToken: localStorage.getItem('pmc_staff_authorized_token') || 'PMC-ADMIN-2026',
        staffUser: 'gws-n3@pmc.org.tw',
        certificate: record
      };

      if (filePayload) {
        payload.fileName = filePayload.fileName;
        payload.fileBase64 = filePayload.fileBase64;
        payload.fileMimeType = filePayload.fileMimeType;
      }

      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Background sync to PMC Google Sheets triggered for:', record.certNumber);
    } catch (err) {
      console.warn('Failed to background sync to Google Sheets:', err);
    }
  }
}

// Global Store Instance
window.certStore = new CertificateStore();
