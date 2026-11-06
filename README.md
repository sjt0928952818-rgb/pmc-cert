# PMC Certificate Verification & AI Intake Portal

Official compliance certificate verification and administration system developed for **Precision Machinery Research & Development Center (PMC / 財團法人精密機械研究發展中心)**.

Target Production Google Account: **`gws-n3@pmc.org.tw`**

---

## 🌟 Security & Access Architecture for Production

When deployed to production, the system strictly separates public inquiry from restricted internal administration:

```
[ Public Customer (Worldwide) ]
        │
        ▼ (Free & Open Access)
┌──────────────────────────────────────────────┐
│  GitHub Pages: Public Certificate Search     │
│  • Verify by Cert Number or Company Name     │
│  • View Validity, Scope, Standards, Expiry   │
└──────────────────────────────────────────────┘

                       ▲
                       │ Read-only API queries
                       ▼
┌──────────────────────────────────────────────┐
│  Google Cloud / Google Workspace Backend     │
│  Account: gws-n3@pmc.org.tw                  │
│                                              │
│  1. Google Drive: Certificate File Archive   │
│  2. Google Sheets: Central Master Database   │
│  3. Google Apps Script: API & Auth Engine    │
└──────────────────────────────────────────────┘
                       ▲
                       │ Protected Write/Intake
                       │ (Passcode / Token Verified)
┌──────────────────────────────────────────────┐
│  Staff Portal (Authorized Personnel Only)    │
│  • Restricted Access via Staff Passcode      │
│  • Gemini Multimodal AI OCR Intake           │
│  • Human-in-the-Loop Review & Drive Backup   │
└──────────────────────────────────────────────┘
```

---

## 🔐 1. How Staff Login & Authorization Works

1. **Front-end Access Gate**:
   * When visitors click **"Staff Portal (Authorized)"**, the system checks if the browser holds an authorized session.
   * If unauthorized, a **"Staff Security Check"** modal appears.
   * The staff member must enter the authorization passcode (Default demo: `PMC-ADMIN-2026`).
2. **Back-end API Defense (Google Apps Script)**:
   * Even if someone bypasses the front-end UI, the Google Apps Script endpoint (`doPost`) strictly validates `authToken: ADMIN_SECRET_TOKEN`.
   * Unauthorized write requests are instantly rejected (`401 Unauthorized`).
   * You can change the passcode at any time in `backend/Code.gs` line 14:
     ```javascript
     var ADMIN_SECRET_TOKEN = "Your_New_Secret_Passcode_Here";
     ```

---

## ☁️ 2. How to Setup Google Drive & Sheets with `gws-n3@pmc.org.tw`

Follow these 5 simple steps under your official account:

1. **Log in to Google**:
   * Open your browser and log into Google Drive with **`gws-n3@pmc.org.tw`**.
2. **Create Database Spreadsheet**:
   * Create a new Google Spreadsheet named `PMC_Certificate_Master_Database`.
   * Name the first tab `Certificates`.
   * Set up the header row (Row 1):
     `ID | CertNumber | CompanyName | ProductName | ModelNumber | Standards | IssueDate | ExpiryDate | Status | Issuer | DriveUrl | UpdatedAt | UpdatedBy`
3. **Install the Backend Script**:
   * In the spreadsheet menu, go to **Extensions (擴充功能)** > **Apps Script**.
   * Paste the entire contents of [`backend/Code.gs`](backend/Code.gs) into the editor.
   * Customize your `ADMIN_SECRET_TOKEN` if desired.
4. **Deploy Web App**:
   * Click **Deploy (部署)** > **New deployment (新增部署)**.
   * Select type: **Web app (網頁應用程式)**.
   * Description: `PMC Certificate API v1`.
   * Execute as: **Me (gws-n3@pmc.org.tw)**.
   * Who has access: **Anyone (任何人)** *(Note: allows the public frontend to run search queries; write operations remain locked behind your token)*.
   * Click **Deploy** and authorize permissions.
5. **Auto-Created Drive Folder**:
   * The script will automatically create a dedicated folder named **`PMC_Official_Certificates_Archive`** in `gws-n3@pmc.org.tw`'s Google Drive to store all uploaded PDF/Image files.

---

## 🚀 3. How to Deploy Frontend to GitHub Pages (100% Free)

1. Create a GitHub repository under your organization account (e.g. `pmc-cert-verifier`).
2. Push all project files to `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Deploy PMC Certificate Portal"
   git branch -M main
   git remote add origin https://github.com/<your-org>/pmc-cert-verifier.git
   git push -u origin main
   ```
3. Enable GitHub Pages:
   * Go to **Settings** > **Pages**.
   * Under **Branch**, select `main` and root `/`, then click **Save**.
   * Your site will be live at: `https://<your-org>.github.io/pmc-cert-verifier/`

---

## 📄 Multi-Industry Scopes Covered
* **Medical Devices**: ISO 13485, IEC 60601-1/2, EU MDR 2017/745
* **Energy Storage & Cybersecurity**: IEC 62619, UL 9540A, IEC 62443-4-2, CNS 62933-5-2
* **Advanced Machinery & Robotics**: CE 2006/42/EC, EU 2023/1230 MR, EN ISO 12100, ISO 3691-4
* **Semiconductor Systems**: SEMI S2, SEMI S8, SEMI S14, SEMI S22
* **Electrical & Electronics**: EMC 2014/30/EU, LVD 2014/35/EU, RED 2014/53/EU
