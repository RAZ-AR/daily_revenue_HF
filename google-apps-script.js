const SPREADSHEET_ID = "13Cz2uUGh2l86X3il5zGYnd4Th_hcDewaxSz2p2RjSOQ";
const SHEET_NAME_REPORTS = "Отчеты";
const SHEET_NAME_EXPENSES = "Расходы";

function doGet(event) {
  const action = event.parameter.action;
  if (action === "balance") {
    return jsonResponse({
      ok: true,
      morningBalance: getMorningBalance(event.parameter.date)
    }, event.parameter.callback);
  }

  return jsonResponse({ ok: true }, event.parameter.callback);
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const reportsSheet = getSheet(spreadsheet, SHEET_NAME_REPORTS, [
      "Дата отправки",
      "Дата",
      "Сотрудник",
      "Карта",
      "Доставка",
      "Наличные за день",
      "Остаток на утро",
      "Расходы всего",
      "Ожидаемые наличные",
      "Корректировка",
      "Итог в кассе",
      "Комментарий"
    ]);
    const expensesSheet = getSheet(spreadsheet, SHEET_NAME_EXPENSES, [
      "Дата отправки",
      "Дата",
      "Сотрудник",
      "Сумма",
      "Тип",
      "Описание"
    ]);

    reportsSheet.appendRow([
      new Date(payload.submittedAt || new Date()),
      payload.date,
      payload.employee,
      payload.sales.card,
      payload.sales.delivery,
      payload.sales.cash,
      payload.cash.morningBalance,
      payload.cash.expenseTotal,
      payload.cash.expectedCash,
      payload.cash.adjustment,
      payload.cash.finalCash,
      payload.comment
    ]);

    (payload.expenses || []).forEach((expense) => {
      expensesSheet.appendRow([
        new Date(payload.submittedAt || new Date()),
        payload.date,
        payload.employee,
        expense.amount,
        expense.type,
        expense.description
      ]);
    });

    return jsonResponse({ ok: true, finalCash: payload.cash.finalCash });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function getSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function getMorningBalance(date) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME_REPORTS);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  const targetDate = new Date(`${date}T00:00:00`);
  let latestDate = null;
  let latestBalance = 0;

  rows.forEach((row) => {
    const reportDate = normalizeDate(row[1]);
    const finalCash = Number(row[10]) || 0;
    if (!reportDate || reportDate >= targetDate) return;
    if (!latestDate || reportDate > latestDate) {
      latestDate = reportDate;
      latestBalance = finalCash;
    }
  });

  return latestBalance;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function jsonResponse(data, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
