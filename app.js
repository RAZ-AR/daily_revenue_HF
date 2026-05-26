const STORAGE_KEY = "cash-report-draft";
const config = window.CASH_REPORT_CONFIG || {};

const form = document.querySelector("#cashForm");
const screens = [...document.querySelectorAll(".screen")];
const progressDots = [...document.querySelectorAll(".progress-dot")];
const currentStep = document.querySelector("#currentStep");
const backBtn = document.querySelector("#backBtn");
const nextBtn = document.querySelector("#nextBtn");
const submitBtn = document.querySelector("#submitBtn");
const statusPanel = document.querySelector("#statusPanel");
const addExpenseBtn = document.querySelector("#addExpense");
const expensesList = document.querySelector("#expensesList");
const emptyExpenses = document.querySelector("#emptyExpenses");
const expenseTemplate = document.querySelector("#expenseTemplate");

const fields = {
  date: document.querySelector("#date"),
  employee: document.querySelector("#employee"),
  cardSales: document.querySelector("#cardSales"),
  deliverySales: document.querySelector("#deliverySales"),
  cashSales: document.querySelector("#cashSales"),
  cashAdjustment: document.querySelector("#cashAdjustment"),
  comment: document.querySelector("#comment")
};

const summary = {
  morningBalance: document.querySelector("#morningBalanceText"),
  cashToday: document.querySelector("#cashTodayText"),
  expenseTotal: document.querySelector("#expenseTotalText"),
  expectedCash: document.querySelector("#expectedCashText"),
  finalCash: document.querySelector("#finalCashText")
};

let step = 1;
let morningBalance = 0;
let balanceLoadedFor = "";

init();

function init() {
  fields.date.value = new Date().toISOString().slice(0, 10);
  restoreDraft();
  updateScreen();
  updateSummary();
  refreshBalance();

  form.addEventListener("input", () => {
    updateSummary();
    saveDraft();
  });

  fields.date.addEventListener("change", refreshBalance);
  addExpenseBtn.addEventListener("click", () => addExpense());
  backBtn.addEventListener("click", goBack);
  nextBtn.addEventListener("click", goNext);
  form.addEventListener("submit", submitReport);
}

function goBack() {
  step = Math.max(1, step - 1);
  updateScreen();
}

function goNext() {
  if (!validateStep()) return;
  step = Math.min(4, step + 1);
  updateScreen();
  updateSummary();
}

function validateStep() {
  const activeInputs = screens[step - 1].querySelectorAll("input, select, textarea");
  for (const input of activeInputs) {
    if (!input.reportValidity()) return false;
  }
  return true;
}

function updateScreen() {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", Number(screen.dataset.screen) === step);
  });

  progressDots.forEach((dot, index) => {
    dot.classList.toggle("is-active", index < step);
  });

  currentStep.textContent = step;
  backBtn.disabled = step === 1;
  nextBtn.classList.toggle("is-hidden", step === 4);
  submitBtn.classList.toggle("is-hidden", step !== 4);
}

function addExpense(expense = {}) {
  const row = expenseTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".expense-amount").value = expense.amount ?? "";
  row.querySelector(".expense-type").value = expense.type || "Покупка";
  row.querySelector(".expense-description").value = expense.description || "";
  row.querySelector(".remove-expense").addEventListener("click", () => {
    row.remove();
    updateExpenseVisibility();
    updateSummary();
    saveDraft();
  });
  expensesList.append(row);
  updateExpenseVisibility();
  updateSummary();
  saveDraft();
}

function updateExpenseVisibility() {
  emptyExpenses.classList.toggle("is-hidden", expensesList.children.length > 0);
}

function numberValue(value) {
  return Number(String(value || "0").replace(",", ".")) || 0;
}

function money(value) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function getExpenses() {
  return [...expensesList.querySelectorAll(".expense-row")].map((row) => ({
    amount: numberValue(row.querySelector(".expense-amount").value),
    type: row.querySelector(".expense-type").value,
    description: row.querySelector(".expense-description").value.trim()
  }));
}

function getTotals() {
  const expenses = getExpenses();
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const cashToday = numberValue(fields.cashSales.value);
  const expectedCash = morningBalance + cashToday - expenseTotal;
  const adjustment = numberValue(fields.cashAdjustment.value);

  return {
    expenseTotal,
    cashToday,
    expectedCash,
    adjustment,
    finalCash: expectedCash + adjustment
  };
}

function updateSummary() {
  const totals = getTotals();
  summary.morningBalance.textContent = money(morningBalance);
  summary.cashToday.textContent = money(totals.cashToday);
  summary.expenseTotal.textContent = money(totals.expenseTotal);
  summary.expectedCash.textContent = money(totals.expectedCash);
  summary.finalCash.textContent = money(totals.finalCash);
}

function getPayload() {
  const totals = getTotals();

  return {
    date: fields.date.value,
    employee: fields.employee.value.trim(),
    sales: {
      card: numberValue(fields.cardSales.value),
      delivery: numberValue(fields.deliverySales.value),
      cash: totals.cashToday
    },
    expenses: getExpenses().filter((expense) => expense.amount || expense.description),
    cash: {
      morningBalance,
      expenseTotal: totals.expenseTotal,
      expectedCash: totals.expectedCash,
      adjustment: totals.adjustment,
      finalCash: totals.finalCash
    },
    comment: fields.comment.value.trim(),
    submittedAt: new Date().toISOString()
  };
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getPayload()));
}

function restoreDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    fields.date.value = draft.date || fields.date.value;
    fields.employee.value = draft.employee || "";
    fields.cardSales.value = draft.sales?.card || "";
    fields.deliverySales.value = draft.sales?.delivery || "";
    fields.cashSales.value = draft.sales?.cash || "";
    fields.cashAdjustment.value = draft.cash?.adjustment || "";
    fields.comment.value = draft.comment || "";
    morningBalance = numberValue(draft.cash?.morningBalance);
    (draft.expenses || []).forEach(addExpense);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function refreshBalance() {
  const scriptUrl = config.googleScriptUrl;
  const date = fields.date.value;

  if (!scriptUrl || !date || balanceLoadedFor === date) {
    updateSummary();
    return;
  }

  try {
    setStatus("Загружаю остаток на утро...");
    const data = config.useCors
      ? await fetchJson(`${scriptUrl}?action=balance&date=${encodeURIComponent(date)}`)
      : await fetchJsonp(scriptUrl, { action: "balance", date });
    morningBalance = numberValue(data.morningBalance);
    balanceLoadedFor = date;
    setStatus("");
  } catch {
    setStatus("Не удалось загрузить остаток. Можно продолжить, остаток будет 0.", "error");
  } finally {
    updateSummary();
    saveDraft();
  }
}

async function submitReport(event) {
  event.preventDefault();
  if (!validateStep()) return;

  const scriptUrl = config.googleScriptUrl;
  if (!scriptUrl) {
    setStatus("Добавьте URL Google Apps Script в config.js, чтобы отправлять данные.", "error");
    saveDraft();
    return;
  }

  submitBtn.disabled = true;
  setStatus("Отправляю отчет...");
  const payload = getPayload();

  try {
    if (config.useCors) {
      const response = await fetch(scriptUrl, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Ошибка отправки");
    } else {
      await fetch(scriptUrl, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload)
      });
    }

    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    expensesList.innerHTML = "";
    morningBalance = payload.cash.finalCash || 0;
    fields.date.value = new Date().toISOString().slice(0, 10);
    step = 1;
    updateExpenseVisibility();
    updateScreen();
    updateSummary();
    setStatus("Отчет отправлен в Google Таблицу.", "success");
  } catch (error) {
    setStatus(`Не получилось отправить отчет: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

function setStatus(message, type = "") {
  statusPanel.textContent = message;
  statusPanel.className = "status-panel";
  if (type) statusPanel.classList.add(`is-${type}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

function fetchJsonp(scriptUrl, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `cashReportCallback_${Date.now()}_${Math.round(Math.random() * 10000)}`;
    const query = new URLSearchParams({
      ...params,
      callback: callbackName
    });
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Истекло время ожидания"));
    }, 10000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Скрипт Google не ответил"));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = `${scriptUrl}?${query.toString()}`;
    document.body.append(script);
  });
}
