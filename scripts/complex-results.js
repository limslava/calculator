(function () {
    const safeNormalize = value => {
        if (typeof window.normalizeCityName === 'function') {
            return window.normalizeCityName(value);
        }
        return String(value || '').trim();
    };

    const safeEscape = value => {
        if (typeof window.escapeHtml === 'function') {
            return window.escapeHtml(value);
        }
        return String(value ?? '');
    };

    function formatRateValue(rate, currency) {
        if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return '—';
        const numeric = Math.round(Number(rate));
        if (currency === 'RUB' || currency === '₽') {
            return `${numeric.toLocaleString('ru-RU')} ₽`;
        }
        return `$${numeric.toLocaleString('ru-RU')}`;
    }

    function matchSelectFilter(result, filterType, value) {
        if (!value) return true;
        const compare = value.toString().toLowerCase().trim();
        if (!compare) return true;
        const getter = typeof window.getResultFilterValues === 'function'
            ? window.getResultFilterValues
            : null;
        const values = getter ? getter(result, filterType) : [];
        if (!values || values.length === 0) return false;
        if (['line', 'agent', 'terminal'].includes(filterType)) {
            return values.some(item => item && item.toString().toLowerCase().trim() === compare);
        }
        return values.some(item => item && item.toString().toLowerCase().includes(compare));
    }

    function getDisplayAgent(result) {
        const data = result?.data || {};
        return (data.sea?.agent || data.agent || data.rail?.agent || '').toString().trim();
    }

    function getSelectedValues(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return [];
        if (el.dataset && el.dataset.selected) {
            try {
                const parsed = JSON.parse(el.dataset.selected);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        if (el.tagName === 'SELECT') {
            return Array.from(el.selectedOptions || [])
                .map(opt => opt.value)
                .filter(value => value && value.trim() !== '');
        }
        return [];
    }



    function applyComplexUiFilters(results) {
        const rateType = document.getElementById('complex-rate-type')?.value || 'all';
        const lineFilters = getSelectedValues('complex-line');
        const agentFilters = getSelectedValues('complex-agent');
        const terminalFilters = getSelectedValues('complex-terminal');

        return results.filter(result => {
            if (rateType !== 'all' && result.transportType !== rateType) return false;
            if (lineFilters.length && !lineFilters.some(value => matchSelectFilter(result, 'line', value))) return false;
            if (agentFilters.length) {
                const displayAgent = getDisplayAgent(result).toLowerCase();
                const matchesAgent = agentFilters.some(value => value.toString().toLowerCase().trim() === displayAgent);
                if (!matchesAgent) return false;
            }
            if (terminalFilters.length && !terminalFilters.some(value => matchSelectFilter(result, 'terminal', value))) return false;
            return true;
        });
    }

    function buildComplexRow(result, fallbackFrom, fallbackTo) {
        const data = result?.data || {};
        const typeLabel = result.transportName || result.transportType || '—';

        const carrier = data.sea?.carrier || data.carrier || data.line || data.shippingLine || '—';
        const agent = data.sea?.agent || data.agent || data.rail?.agent || '—';
        const etd = data.sea?.etd || data.etd || '—';
        const dateOfValidity = data.sea?.dateOfValidity || data.dateOfValidity || '—';

        const borderCrossing = data.borderCrossing || data.rail?.borderCrossing || data.sea?.borderCrossing || '—';
        let departureStation = data.rail?.departureStation || data.departureStation || data.rail?.city || data.city || '—';
        if (result.transportType === 'rail' || result.transportType === 'sea_rail') {
            departureStation = data.rail?.agent || data.agent || data.rail?.departureStation || data.departureStation || data.rail?.city || data.city || '—';
        }
        if (result.transportType === 'direct_rail') {
            departureStation = data.rail?.departureStation || data.departureStation || data.rail?.city || data.city || '—';
        }

        let seaRate = '—';
        let railRate = '—';
        let totalRate = '—';
        let numericTotal = null;
        let additionalInfo = '—';

        if (result.transportType === 'direct_rail') {
            seaRate = '—';
            railRate = `$${result.rate}`;
            numericTotal = usdToRubRate ? Math.round(result.rate * usdToRubRate) : Number(result.rate);
            totalRate = usdToRubRate ? `${numericTotal} ₽` : `$${result.rate}`;
            additionalInfo = '—';
        } else if (result.transportType === 'direct_sea') {
            seaRate = `$${result.rate}`;
            railRate = '—';
            numericTotal = usdToRubRate ? Math.round(result.rate * usdToRubRate) : Number(result.rate);
            totalRate = usdToRubRate ? `${numericTotal} ₽` : `$${result.rate}`;
            additionalInfo = '—';
        } else if (result.transportType === 'sea') {
            seaRate = `$${result.rate}`;
            railRate = '—';
            numericTotal = usdToRubRate ? Math.round(result.rate * usdToRubRate) : Number(result.rate);
            totalRate = usdToRubRate ? `${numericTotal} ₽` : `$${result.rate}`;
            additionalInfo = '—';
        } else if (result.transportType === 'rail') {
            seaRate = '—';
            railRate = `${result.rate} ₽`;
            numericTotal = Number(result.rate);
            totalRate = `${result.rate} ₽`;
            additionalInfo = '—';
        } else if (result.transportType === 'sea_rail') {
            const seaRateUSD = data.seaRate || 0;
            const railRateRUB = data.railRate || 0;
            seaRate = `$${seaRateUSD}`;
            railRate = `${railRateRUB} ₽`;
            numericTotal = Number(result.rate);
            totalRate = `${result.rate} ₽`;
            additionalInfo = '—';
        }

        return {
            typeLabel,
            seaRate,
            agent,
            carrier,
            etd,
            dateOfValidity,
            railRate,
            departureStation,
            borderCrossing,
            totalRate,
            numericTotal,
            additionalInfo,
            from: fallbackFrom || data.from || data.origin || '—',
            to: fallbackTo || data.to || data.destination || '—',
            rate: result?.rate,
            currency: result?.currency,
            raw: result
        };
    }

    function displayComplexResults(results, departure, destination) {
        const resultsSection = document.getElementById('results');
        const ratesTable = document.getElementById('rates-table');

        const filteredResults = applyComplexUiFilters(results || []);
        window.displayedResults = filteredResults;

        const rows = filteredResults.map(result => buildComplexRow(result, departure, destination));
        const sortedRows = [...rows].sort((a, b) => {
            const aVal = typeof a.numericTotal === 'number' ? a.numericTotal : Number.POSITIVE_INFINITY;
            const bVal = typeof b.numericTotal === 'number' ? b.numericTotal : Number.POSITIVE_INFINITY;
            return aVal - bVal;
        });

        let tableHTML = `
                <table class="trd-rates-table trd-variant-a">
                    <thead>
                        <tr>
                            <th>Тип перевозки</th>
                            <th>Ставка море</th>
                            <th>Агент</th>
                            <th>Перевозчик</th>
                            <th>Ставка ЖД</th>
                            <th>Станция отправления</th>
                            <th>Общая ставка</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (!sortedRows.length) {
            tableHTML += `<tr><td colspan="7" class="muted">Нет данных для выбранных параметров</td></tr>`;
        } else {
            sortedRows.forEach((row, index) => {
                tableHTML += `
                    <tr class="row-main" data-index="${index}">
                        <td><span class="tag">${safeEscape(row.typeLabel)}</span></td>
                        <td>${safeEscape(row.seaRate || '—')}</td>
                        <td>${safeEscape(row.agent || '—')}</td>
                        <td>${safeEscape(row.carrier || '—')}</td>
                        <td>${safeEscape(row.railRate || '—')}</td>
                        <td>${safeEscape(row.departureStation || '—')}</td>
                        <td class="rate">${safeEscape(row.totalRate || '—')}</td>
                    </tr>
                    <tr class="row-details" data-index="${index}" style="display:none;">
                        <td colspan="7">
                            ETD: ${safeEscape(row.etd || '—')} ·
                            Дата действия: ${safeEscape(row.dateOfValidity || '—')} ·
                            Станция: ${safeEscape(row.departureStation || '—')} ·
                            Погран переход: ${safeEscape(row.borderCrossing || '—')} ·
                            Примечание: ${safeEscape(row.additionalInfo || '—')}
                        </td>
                    </tr>
                `;
            });
        }

        tableHTML += `
                    </tbody>
                </table>
        `;

        if (ratesTable) {
            ratesTable.innerHTML = tableHTML;
        }

        if (resultsSection) {
            resultsSection.classList.remove('hidden');
        }

        if (ratesTable) {
            const mainRows = ratesTable.querySelectorAll('tbody tr.row-main');
            mainRows.forEach(row => {
                row.addEventListener('click', () => {
                    ratesTable.querySelectorAll('tbody tr.row-main').forEach(item => item.classList.remove('is-active'));
                    row.classList.add('is-active');
                    const idx = row.dataset.index;
                    const detailsRow = ratesTable.querySelector(`tbody tr.row-details[data-index="${idx}"]`);
                    if (detailsRow) {
                        detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
                    }

                    const selected = sortedRows[Number(idx)];
                    const noteEl = document.getElementById('rb-summary-note');
                    if (noteEl && selected) {
                        noteEl.textContent = `${selected.typeLabel}: ${selected.from || '—'} → ${selected.to || '—'} · ${selected.agent || 'без агента'} · ${formatRateValue(selected.rate, selected.currency)}`;
                    }
                });
            });
        }

        if (window.__debugGrid === true) {
            const header = ratesTable?.querySelector('.trd-rates-table thead tr');
            const firstRow = ratesTable?.querySelector('.trd-rates-table tbody tr.row-main');
            if (header && firstRow) {
                const headerCells = Array.from(header.children).map((cell, idx) => {
                    const rect = cell.getBoundingClientRect();
                    return { idx, left: Math.round(rect.left), width: Math.round(rect.width) };
                });
                const rowCells = Array.from(firstRow.children).map((cell, idx) => {
                    const rect = cell.getBoundingClientRect();
                    return { idx, left: Math.round(rect.left), width: Math.round(rect.width) };
                });
                console.table({ header: headerCells, row: rowCells });
            } else {
                console.warn('Grid debug: header or first row not found');
            }
        }

        if (typeof window.updateComplexSummary === 'function') {
            window.updateComplexSummary(filteredResults);
        }
    }

    window.formatRateValue = formatRateValue;
    window.applyComplexUiFilters = applyComplexUiFilters;
    window.buildComplexRow = buildComplexRow;
    window.displayComplexResults = displayComplexResults;
})();
