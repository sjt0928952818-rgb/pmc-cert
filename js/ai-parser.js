/**
 * Dynamic AI Document Parser for PMC Certificates
 * Uses Google Gemini 2.5 Flash Multimodal Vision API to parse certificates from PDF & Image files.
 */

class CertificateAiParser {
  constructor() {
    this.apiKey = localStorage.getItem('certiverify_gemini_key') || 'AIzaSyDaD5JhSgQunIsekjUwcY8bw6W6Ro9l9Sw';
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

    // Always attempt live Gemini API call first if key exists
    if (this.hasApiKey()) {
      onProgress('Connecting to Google Gemini 2.5 AI Vision Engine...');
      return await this.extractWithGeminiApi(file, onProgress);
    } else {
      onProgress('No API key detected. Running interactive PMC Simulator...');
      return await this.simulateExtraction(file, onProgress);
    }
  }

  async extractWithGeminiApi(file, onProgress) {
    onProgress('Reading document binary stream...');
    const base64Data = await this.fileToBase64(file);
    const mimeType = file.type || 'application/pdf';

    onProgress('Analyzing certificate contents, company, model and test standards...');

    const promptText = `
You are a professional compliance auditor for the Precision Machinery Research & Development Center (PMC).
Carefully inspect this certificate document (image or PDF).
Extract the following information accurately into a strict JSON object:
1. certNumber: The official Certificate Number or Report Number on the document (e.g. N3CT-115R1914-203, PMC-..., etc.).
2. companyName: The applicant, manufacturer, or certified company name (Chinese or English, as printed on certificate).
3. productName: Certified product or equipment name (e.g., Electric Wheelchair, CNC Machine, etc.).
4. modelNumber: Model specification or series identifier.
5. standards: All applied test standards, directives, regulations, and norms mentioned (e.g., ISO 7176, IEC 60601, ISO 13485, CE directives, etc.). Comma-separated.
6. issueDate: Issuing date in YYYY-MM-DD format (convert Republic of China year or English date to Gregorian calendar if needed).
7. expiryDate: Expiration or valid-until date in YYYY-MM-DD format (if none mentioned, calculate 3 years after issueDate).
8. status: One of "Valid", "Expired", "Suspended", "Revoked". Default to "Valid" if active.
9. issuer: The certification authority or testing lab, e.g., "Precision Machinery Research & Development Center (PMC)".

Return ONLY the raw JSON object. Do not include markdown code blocks or backticks.
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

    // Use gemini-2.5-flash as primary supported model, with auto-fallbacks
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-2.5-flash-lite'
    ];

    let lastError = null;

    for (const model of candidateModels) {
      try {
        onProgress(`Processing with AI model [${model}]...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
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
            const parsed = JSON.parse(cleanedJson);
            onProgress('Certificate extracted successfully!');
            return parsed;
          }
        } else {
          const errDetail = await response.text();
          lastError = new Error(`Model ${model} Error (${response.status}): ${errDetail}`);
          console.warn(`Failed with model ${model}:`, errDetail);
          if (response.status === 404) {
            continue; // Try next model
          } else {
            throw lastError;
          }
        }
      } catch (err) {
        lastError = err;
        if (err.message && err.message.includes('404')) {
          continue;
        } else {
          throw err;
        }
      }
    }

    throw lastError || new Error('Unable to parse certificate with Gemini AI.');
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

    return {
      certNumber: `PMC-CE-2026-${randomNum}`,
      companyName: 'Victor Taichung Machinery Works Co., Ltd.',
      productName: '5-Axis High Precision CNC Vertical Machining Center',
      modelNumber: 'Vcenter-AX800-PRO',
      standards: 'Machinery Directive 2006/42/EC, Regulation (EU) 2023/1230 (MR), EN ISO 12100:2010, EN 60204-1:2018',
      issueDate: '2025-03-20',
      expiryDate: '2028-03-19',
      status: 'Valid',
      issuer: 'Precision Machinery Research & Development Center (PMC Lab #1024)'
    };
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
