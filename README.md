# Кассовая форма для телефона

Готовые файлы:

- `index.html` — сама форма.
- `styles.css` — внешний вид под смартфон.
- `app.js` — расчеты, расходы, черновик и отправка.
- `config.js` — сюда вставляется URL Google Apps Script.
- `google-apps-script.js` — код для Google Таблицы.

## Как подключить Google Таблицу

1. Создайте Google Таблицу.
2. Откройте `Расширения` → `Apps Script`.
3. Вставьте код из `google-apps-script.js`.
4. Нажмите `Deploy` → `New deployment`.
5. Тип выберите `Web app`.
6. `Execute as`: `Me`.
7. `Who has access`: `Anyone`.
8. Скопируйте URL веб-приложения.
9. Вставьте URL в `config.js`:

```js
window.CASH_REPORT_CONFIG = {
  googleScriptUrl: "https://script.google.com/macros/s/ВАШ_ID/exec",
  useCors: false
};
```

После первой отправки в таблице появятся листы `Отчеты` и `Расходы`.

## Как работает расчет

`Наличные в кассе = остаток на утро + наличные за день - расходы`

Поле `Корректировка` добавляется к итогу, если фактическая касса не совпала.
