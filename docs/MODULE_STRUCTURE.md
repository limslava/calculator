# Module Structure

This document describes the current modular split after refactoring.

## Frontend

- `styles.css` — style entrypoint (imports partials only).
- `styles/base.css` — base layout, forms, tables, shared components.
- `styles/tariff-admin.css` — tariff/admin interfaces.
- `styles/history-uploaded.css` — upload history and uploaded rates UI.
- `styles/filters-scrollfix.css` — filter chips, excel-like filters, scroll fixes.

- `script.js` — main page orchestration (auth flow, navigation, calculations).
- `scripts/app-upload-tariff.js` — file upload, preview, tariff CRUD on main page.
- `scripts/app-margin-modal.js` — margin modal and copy actions on main page.

- `scripts/sales-script.js` — sales page orchestration and rate calculations.
- `scripts/sales-filters.js` — filters state, chips, excel-like dropdown filters.
- `scripts/sales-margin.js` — margin modal and copy/export for sales page.

## Backend

- `server.js` — app composition, middleware setup, router mounting, bootstrapping.
- `server/middleware/auth.js` — JWT auth + admin guard middleware.
- `server/services/database-init.js` — DB init + default admin + seed records.

- `server/routes/exchange-rate.js` — CBR proxy endpoint.
- `server/routes/data.js` — `/api/data` read/write endpoints + upload history write.
- `server/routes/email.js` — `/api/send-email`.
- `server/routes/auth.js` — `/api/auth/*`.
- `server/routes/users.js` — `/api/users/*`.
- `server/routes/upload-history.js` — upload history, stats, full-data endpoints.
- `server/routes/system.js` — `/health`, `/`, SPA fallback.

## Script Load Order (critical)

### Main page (`index.html`)
1. `scripts/server-auth.js`
2. `config/email-config.js`
3. `scripts/auth-ui.js`
4. `scripts/utils.js`
5. `modules/*.js`
6. `scripts/app-upload-tariff.js`
7. `scripts/app-margin-modal.js`
8. `script.js`

### Sales page (`interfaces/sales-interface.html`)
1. `scripts/server-auth.js`
2. `scripts/utils.js`
3. `modules/*.js`
4. `scripts/sales-filters.js`
5. `scripts/sales-margin.js`
6. `scripts/sales-script.js`
