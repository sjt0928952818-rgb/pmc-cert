/**
 * PMC Official Google Apps Script Backend
 * Dedicated to Account: gws-n3@pmc.org.tw
 * 
 * Features:
 * 1. Public Search Endpoint (GET): Allows worldwide customers to query certificates.
 * 2. Authorized Registry Intake (POST): Requires ADMIN_SECRET_TOKEN verification.
 * 3. Google Drive Auto-Archiving: Automatically saves uploaded certificate PDF/images 
 *    into a designated Google Drive folder owned by gws-n3@pmc.org.tw.
 */

// 1. Set your secure staff authorization passcode here:
var ADMIN_SECRET_TOKEN = "PMC-ADMIN-2026"; // Change to your preferred secure team password

// 2. Target Google Drive folder name under gws-n3@pmc.org.tw
var DRIVE_FOLDER_NAME = "PMC_Official_Certificates_Archive";

/**
 * Public Query Endpoint (GET)
 * Anyone can verify certificate validity by Cert Number or Company Name.
 */
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Certificates");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  }

  var params = e.parameter || {};
  var query = (params.q || params.cert || '').trim().toLowerCase();

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return createJsonResponse({ status: 'success', total: 0, results: [] });
  }

  var headers = data[0];
  var rows = data.slice(1);
  var results = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cert = {
      id: row[0],
      certNumber: row[1],
      companyName: row[2],
      productName: row[3],
      modelNumber: row[4],
      standards: row[5],
      issueDate: formatDate(row[6]),
      expiryDate: formatDate(row[7]),
      status: row[8],
      issuer: row[9],
      fileDriveUrl: row[10] || '', // Google Drive PDF Link
      updatedAt: row[11] || '',
      updatedBy: row[12] || ''
    };

    if (!query) {
      results.push(cert);
    } else {
      var matchCert = String(cert.certNumber).toLowerCase().indexOf(query) !== -1;
      var matchComp = String(cert.companyName).toLowerCase().indexOf(query) !== -1;
      var matchProd = String(cert.productName).toLowerCase().indexOf(query) !== -1;
      var matchModel = String(cert.modelNumber).toLowerCase().indexOf(query) !== -1;
      if (matchCert || matchComp || matchProd || matchModel) {
        results.push(cert);
      }
    }
  }

  return createJsonResponse({
    status: 'success',
    total: results.length,
    results: results
  });
}

/**
 * Authorized Intake & Data Management Endpoint (POST)
 * Restricted strictly to staff who provide the valid ADMIN_SECRET_TOKEN.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var token = payload.authToken;

    // Security Check: Verify Staff Authorization Token
    if (token !== ADMIN_SECRET_TOKEN) {
      return createJsonResponse({ 
        status: 'unauthorized', 
        message: 'Access Denied: Invalid or missing PMC staff authorization credentials.' 
      });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Certificates");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }

    var action = payload.action;
    var cert = payload.certificate;

    if (!cert || !cert.certNumber) {
      return createJsonResponse({ status: 'error', message: 'Missing certificate information.' });
    }

    // Optional: Save uploaded electronic file directly into gws-n3@pmc.org.tw Google Drive
    var fileDriveUrl = cert.fileDriveUrl || '';
    if (payload.fileBase64 && payload.fileName) {
      fileDriveUrl = saveFileToGoogleDrive(payload.fileName, payload.fileBase64, payload.fileMimeType);
    }

    var data = sheet.getDataRange().getValues();
    var foundRowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase() === String(cert.certNumber).toLowerCase()) {
        foundRowIndex = i + 1; // 1-based index in sheet
        break;
      }
    }

    var rowValues = [
      cert.id || ('pmc_' + new Date().getTime()),
      cert.certNumber,
      cert.companyName,
      cert.productName,
      cert.modelNumber,
      cert.standards,
      cert.issueDate,
      cert.expiryDate,
      cert.status,
      cert.issuer || 'Precision Machinery Research & Development Center (PMC)',
      fileDriveUrl,
      new Date().toISOString(),
      payload.staffUser || 'gws-n3@pmc.org.tw'
    ];

    if (foundRowIndex > 0) {
      sheet.getRange(foundRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return createJsonResponse({ 
      status: 'success', 
      message: 'Certificate successfully registered into PMC central database.',
      driveUrl: fileDriveUrl 
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Saves uploaded electronic certificate to Google Drive under gws-n3@pmc.org.tw
 */
function saveFileToGoogleDrive(fileName, base64Content, mimeType) {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  var targetFolder;
  if (folders.hasNext()) {
    targetFolder = folders.next();
  } else {
    targetFolder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  }

  var rawBase64 = base64Content.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
  var decodedBytes = Utilities.base64Decode(rawBase64);
  var blob = Utilities.newBlob(decodedBytes, mimeType || 'application/pdf', fileName);
  var file = targetFolder.createFile(blob);

  // Set file permissions so authorized auditors or public link viewers can inspect
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
