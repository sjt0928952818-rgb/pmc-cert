/**
 * Dynamic AI Document Parser for PMC Certificates
 * Automatically queries Google Gemini API to discover active models for the user's key.
 * Supports auto-fallback and browser cache busting.
 */

class CertificateAiParser {
  constructor() {
    this.apiKey = localStorage.getItem('certiverify_gemini_key') || '';
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem('certiverify_gemini_key', this.apiKey);
    } else {
      localStorage.removeItem('certiverify_gemini_key');
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  async extractCertificate(file, onProgress = () => {}) {
    if (!file) {
      throw new Error('Please select or upload a certificate file first.');
    }

    if (this.hasApiKey()) {
      onProgress('Connecting to Google Gemini API...');
      return await this.extractWithGeminiApi(file, onProgress);
    } else {
      onProgress('No API key detected. Running interactive PMC Simulator...');
      return await this.simulateExtraction(file, onProgress);
    }
  }

  /**
   * Discovers which models are enabled for this specific API key
   */
  async findAvailableModel(onProgress) {
    onProgress('Detecting active Gemini models for your API key...');
    
    // Test both v1beta and v1 endpoints
    const endpoints = [
      'https://generativelanguage.googleapis.com/v1beta',
      'https://generativelanguage.googleapis.com/v1'
    ];

    let lastErrDetail = '';

    for (const base of endpoints) {
      try {
        const listUrl = `${base}/models?key=${this.apiKey}`;
        const res = await fetch(listUrl);
        
        if (res.ok) {
          const data = await res.json();
          const models = data.models || [];
          
          // Find first model supporting generateContent, preferring flash
          const supported = models.filter(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes('generateContent')
          );

          if (supported.length > 0) {
            // Priority order: flash > pro > any
            const flashModel = supported.find(m => m.name.includes('flash'));
            const chosen = flashModel ? flashModel.name : supported[0].name;
            // chosen is like "models/gemini-1.5-flash"
            return {
              endpointBase: base,
              modelName: chosen.replace(/^models\//, '')
            };
          }
        } else {
          lastErrDetail = await res.text();
        }
      } catch (e) {
        lastErrDetail = e.message;
      }
    }

    // If listing failed, fallback to hardcoded list
    return {
      endpointBase: 'https://generativelanguage.googleapis.com/v1beta',
      modelName: 'gemini-1.5-flash',
      discoveryError: lastErrDetail
    };
  }

  async extractWithGeminiApi(file, onProgress) {
    onProgress('Preparing certificate payload...');
    const base64Data = await this.fileToBase64(file);
    const mimeType = file.type || 'application/pdf';

    // 1. Dynamic Model Discovery
    const { endpointBase, modelName, discoveryError } = await this.findAvailableModel(onProgress);

    onProgress(`Using AI Model [${modelName}]. Analyzing document standards & fields...`);

    const promptText = `
You are a certified conformity assessment auditor for the Precision Machinery Research & Development Center (PMC).
PMC conducts conformity inspection across multi-industry scopes: Medical Devices, Battery Energy Storage, Machinery, Semiconductor, Electrical/Electronic, and Industrial Cybersecurity.
Analyze this official certificate document image or PDF.
Extract the following information accurately into pure JSON:
1. certNumber: Certificate Number (e.g. PMC-MED-XXXX, PMC-BESS-XXXX, PMC-CE-XXXX, PMC-SEMI-XXXX, etc.).
2. companyName: Certified manufacturer, applicant, or entity name.
3. productName: Certified product, medical device, energy storage unit, semiconductor equipment, or machinery system name.
4. modelNumber: Model specification or series identifier.
5. standards: Applicable regulations, directives and standards (e.g. ISO 13485, IEC 60601-1, EU MDR 2017/745, IEC 62619, UL 9540A, IEC 62443, SEMI S2, Machinery Directive 2006/42/EC, EN ISO 12100). Comma-separated.
6. issueDate: Issuing date in YYYY-MM-DD format.
7. expiryDate: Expiration date in YYYY-MM-DD format.
8. status: One of "Valid", "Expired", "Suspended", "Revoked".
9. issuer: The testing laboratory or issuing authority, typically "Precision Machinery Research & Development Center (PMC)".

Return ONLY the raw JSON object without markdown fences.
`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data.split(',')[1]
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.1
      }
    };

    // Candidate models to cycle through if needed
    const modelsToTry = [
      modelName,
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro'
    ];
    // Remove duplicates
    const uniqueModels = [...new Set(modelsToTry)];

    let lastErr = null;

    for (const m of uniqueModels) {
      try {
        const url = `${endpointBase}/models/${m}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const result = await response.json();
          const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedJson);
          }
        } else {
          const errDetail = await response.text();
          lastErr = `[${m}] HTTP ${response.status}: ${errDetail}`;
          if (response.status === 404) {
            // Try next model
            continue;
          } else {
            // 400 or 403 or other error
            throw new Error(lastErr);
          }
        }
      } catch (err) {
        lastErr = err.message;
        if (err.message && !err.message.includes('404')) {
          throw err;
        }
      }
    }

    // If all failed, produce actionable diagnosis
    let helpfulDiagnosis = "\n\n【診斷與解決指南】";
    if (discoveryError && discoveryError.includes("API_KEY_INVALID")) {
      helpfulDiagnosis += "\n您的 API Key 無效，請檢查複製時是否有漏掉字元。";
    } else if (discoveryError && discoveryError.includes("has not been used in project")) {
      helpfulDiagnosis += "\n該 Google Cloud 專案尚未啟用『Generative Language API』服務，請至 Google Cloud Console 啟用該 API。";
    } else {
      helpfulDiagnosis += `\n目前此金鑰無法存取 Gemini 模型。\n詳細訊息: ${discoveryError || lastErr}\n建議：請至 https://aistudio.google.com/app/apikey 使用個人 Google 帳號重新點擊「Create API Key」，複製最新金鑰貼上即可！`;
    }

    throw new Error(helpfulDiagnosis);
  }

  async simulateExtraction(file, onProgress) {
    const filename = file ? file.name.toLowerCase() : 'pmc_certificate.pdf';

    const steps = [
      { text: 'Scanning PMC emblem, security seals & report codes...', delay: 400 },
      { text: 'Identifying Directives & Standards (ISO / IEC / CE / SEMI)...', delay: 500 },
      { text: 'Validating certificate integrity against PMC registry...', delay: 400 },
      { text: 'Structuring JSON attributes...', delay: 300 }
    ];

    for (const step of steps) {
      onProgress(step.text);
      await new Promise(r => setTimeout(r, step.delay));
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);

    if (filename.includes('med') || filename.includes('bio') || filename.includes('health') || filename.includes('surg')) {
      return {
        certNumber: `PMC-MED-2026-${randomNum}`,
        companyName: 'Apex BioMed Surgical Technologies Corp.',
        productName: 'AI-Assisted Orthopedic Surgical Navigation Robot',
        modelNumber: 'SURG-NAV-PRO-X',
        standards: 'ISO 13485:2016, IEC 60601-1:2020, IEC 60601-1-2:2014, EU MDR 2017/745, ISO 14971:2019',
        issueDate: '2025-05-18',
        expiryDate: '2028-05-17',
        status: 'Valid',
        issuer: 'Precision Machinery Research & Development Center (PMC Medical Device Testing Lab)'
      };
    } else if (filename.includes('bess') || filename.includes('battery') || filename.includes('energy') || filename.includes('power')) {
      return {
        certNumber: `PMC-BESS-2026-${randomNum}`,
        companyName: 'Delta Energy & Power Systems Inc.',
        productName: 'Grid-Connected Industrial Energy Storage System (BESS)',
        modelNumber: 'BESS-MW-500KWH',
        standards: 'IEC 62619:2022, UL 9540A:2019, UN 38.3, IEC 62443-4-2 (Industrial Cybersecurity)',
        issueDate: '2025-02-10',
        expiryDate: '2028-02-09',
        status: 'Valid',
        issuer: 'Precision Machinery Research & Development Center (PMC New Energy & Cyber Lab)'
      };
    } else if (filename.includes('semi') || filename.includes('wafer')) {
      return {
        certNumber: `PMC-SEMI-2026-${randomNum}`,
        companyName: 'Contrel Technology Semiconductor Equipment Co.',
        productName: 'Automated IC Substrate Laser Processing System',
        modelNumber: 'CTS-LASER-3000',
        standards: 'SEMI S2-0720, SEMI S8-0218, IEC 60825-1:2014, SEMI S10',
        issueDate: '2025-01-10',
        expiryDate: '2028-01-09',
        status: 'Valid',
        issuer: 'PMC Semiconductor & High-Tech Equipment Safety Center'
      };
    } else {
      return {
        certNumber: `PMC-CE-2026-${randomNum}`,
        companyName: 'Victor Taichung Machinery Works Co., Ltd.',
        productName: '5-Axis High Precision CNC Vertical Machining Center',
        modelNumber: 'Vcenter-AX800-PRO',
        standards: 'Machinery Directive 2006/42/EC, Regulation (EU) 2023/1230 (MR), EN ISO 12100:2010, EN 60204-1:2018',
        issueDate: '2025-03-20',
        expiryDate: '2028-03-19',
        status: 'Valid',
        issuer: 'Precision Machinery Research & Development Center (PMC Machinery Safety Lab #1024)'
      };
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }
}

// Global Parser Instance
window.certAiParser = new CertificateAiParser();
