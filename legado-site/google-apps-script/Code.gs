const SPREADSHEET_ID = "1RPn_gZaKxmq4J52021gBsNXQlQFs3KP9SiA4R4YB78o";
const DRIVE_FOLDER_NAME = "Comprobantes El Legado";
const GOAL_AMOUNT = 30000000;
const BOND_AMOUNT = 50000;

const SHEETS = {
  donaciones: {
    name: "Donaciones",
    headers: ["Fecha", "Nombre", "WhatsApp", "Valor", "Medio", "Mensaje", "Comprobante"],
  },
  bonos: {
    name: "Bonos",
    headers: ["Fecha", "Nombre", "Cedula", "WhatsApp", "Vendedor", "Numero", "Comprobante"],
  },
  empresas: {
    name: "Empresas",
    headers: ["Fecha", "Empresa", "Contacto", "WhatsApp", "Aporte", "Descripcion", "Mensaje"],
  },
};

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const kind = payload.kind;
    if (!SHEETS[kind]) throw new Error("Tipo de registro no valido");

    const receiptUrl = saveReceipt(payload.comprobante);
    appendRecord(kind, payload.record || {}, receiptUrl);

    return jsonOutput({ ok: true, summary: getSummary() });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function doGet(e) {
  const summary = getSummary();
  const callback = e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(summary)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput(summary);
}

function appendRecord(kind, record, receiptUrl) {
  const sheet = ensureSheet(kind);
  const now = new Date();

  if (kind === "donaciones") {
    sheet.appendRow([
      now,
      record.nombre || "",
      record.whatsapp || "",
      parseMoney(record.valor),
      record.medio || "",
      record.mensaje || "",
      receiptUrl || "",
    ]);
    return;
  }

  if (kind === "bonos") {
    sheet.appendRow([
      now,
      record.nombre || "",
      record.cedula || "",
      record.whatsapp || "",
      record.vendedor || "",
      record.numero || "",
      receiptUrl || "",
    ]);
    return;
  }

  sheet.appendRow([
    now,
    record.empresa || "",
    record.contacto || "",
    record.whatsapp || "",
    record.aporte || "",
    record.descripcion || "",
    record.mensaje || "",
  ]);
}

function getSummary() {
  const donationSheet = ensureSheet("donaciones");
  const bondSheet = ensureSheet("bonos");
  const companySheet = ensureSheet("empresas");

  const donationRows = getRows(donationSheet);
  const donationTotal = donationRows.reduce((sum, row) => sum + parseMoney(row[3]), 0);
  const bonds = getRows(bondSheet).length;
  const companies = getRows(companySheet).length;
  const raised = donationTotal + bonds * BOND_AMOUNT;
  const remaining = Math.max(GOAL_AMOUNT - raised, 0);
  const percent = Math.min(100, Math.round((raised / GOAL_AMOUNT) * 100));

  return {
    raised,
    remaining,
    percent,
    donations: donationRows.length,
    bonds,
    companies,
  };
}

function getRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn < 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
}

function ensureSheet(kind) {
  const config = SHEETS[kind];
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(config.name);
  if (!sheet) sheet = spreadsheet.insertSheet(config.name);

  const range = sheet.getRange(1, 1, 1, config.headers.length);
  const current = range.getValues()[0];
  const hasExpectedHeaders = config.headers.every((header, index) => current[index] === header);
  if (!hasExpectedHeaders) range.setValues([config.headers]);
  range.setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function saveReceipt(file) {
  if (!file || !file.dataUrl) return "";

  const match = String(file.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return "";

  const folder = getReceiptFolder();
  const contentType = file.type || match[1] || "application/octet-stream";
  const name = sanitizeFileName(file.name || "comprobante");
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), contentType, name);
  return folder.createFile(blob).getUrl();
}

function getReceiptFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
}

function parseMoney(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return Number(digits || 0);
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
