// js/lista_esperada.js

function initializeListaEsperadaLogic() {
    console.log("DEBUG: Inicializando lógica y listeners para 'A Partir de Lista'.");

    const API_BASE_URL_LE = window.API_BASE_URL || 'http://localhost:8080/api/tags';

    const epcListTextareaLE = document.getElementById('epcListTextareaLE');
    const btnLoadAndPrepareLE = document.getElementById('btnLoadAndPrepareLE');
    const btnStartLE = document.getElementById('btnStartLE');
    const btnStopLE = document.getElementById('btnStopLE');
    const btnClearLE = document.getElementById('btnClearLE');
    // La variable ya usa el ID correcto btnExportCsvLE
    const btnExportCsvLE = document.getElementById('btnExportCsvLE');

    const tableBodyLEResults = document.getElementById('tableBodyLEResults');

    const esperadosCountEl = document.getElementById('leEsperadosCount');
    const leidosCoincidenCountEl = document.getElementById('leLeidosCoincidenCount');
    const pendientesCountEl = document.getElementById('lePendientesCount');
    const noCorrespondenCountEl = document.getElementById('leNoCorrespondenCount');

    let leStatusPollInterval;
    let currentEpcListForSession = [];

    function getStatusColorVisual(statusColor) {
        let colorDot = '';
        let statusText = '';

        switch (statusColor ? statusColor.toLowerCase() : '') {
            case 'verde':
                colorDot = '<span style="color: green; font-size: 1.5em; vertical-align: middle;">●</span>';
                statusText = ' Recibido';
                break;
            case 'rojo':
                colorDot = '<span style="color: red; font-size: 1.5em; vertical-align: middle;">●</span>';
                statusText = ' Pendiente';
                break;
            case 'amarillo':
                colorDot = '<span style="color: orange; font-size: 1.5em; vertical-align: middle;">●</span>';
                statusText = ' No Corresponde';
                break;
            default:
                return statusColor || 'N/A';
        }
        return `${colorDot}${statusText}`;
    }

    function updateLEButtonStates() {
        const listIsLoaded = currentEpcListForSession.length > 0;

        if (window.globalIsReaderActive && window.globalCurrentMode === "A Partir de Lista") {
            if(btnLoadAndPrepareLE) btnLoadAndPrepareLE.disabled = true;
            if(epcListTextareaLE) epcListTextareaLE.disabled = true;
            if(btnStartLE) btnStartLE.disabled = true;
            if(btnStopLE) btnStopLE.disabled = false;
            if(btnClearLE) btnClearLE.disabled = true;
            if(btnExportCsvLE) btnExportCsvLE.disabled = true;
        } else {
            if(btnLoadAndPrepareLE) btnLoadAndPrepareLE.disabled = false;
            if(epcListTextareaLE) epcListTextareaLE.disabled = false;
            if(btnStartLE) btnStartLE.disabled = !listIsLoaded || window.globalIsReaderActive;
            if(btnStopLE) btnStopLE.disabled = true;
            const canClearOrReport = (window.globalCurrentMode === "A Partir de Lista" || window.globalCurrentMode === "Ninguno" || !window.globalIsReaderActive);
            if(btnClearLE) btnClearLE.disabled = !canClearOrReport;
            if(btnExportCsvLE) btnExportCsvLE.disabled = !listIsLoaded || !canClearOrReport;
        }
    }

    function updateStatusBoxes(dataList) {
        let esperados = currentEpcListForSession.length;
        let coinciden = 0;
        let pendientes = 0;
        let noCorresponden = 0;

        if (dataList && Array.isArray(dataList)) {
            const processedForCounts = new Set();
            dataList.forEach(item => {
                if (item.epc && !processedForCounts.has(item.epc)) {
                     if (item.estadoColor === 'verde') {
                        coinciden++;
                        processedForCounts.add(item.epc);
                    } else if (item.estadoColor === 'amarillo') {
                        if(!currentEpcListForSession.includes(item.epc)) {
                           noCorresponden++;
                           processedForCounts.add(item.epc);
                        }
                    }
                }
            });
            pendientes = esperados - dataList.filter(item => item.estadoColor === 'verde' && currentEpcListForSession.includes(item.epc)).length;
        }

        if(esperadosCountEl) esperadosCountEl.textContent = esperados;
        if(leidosCoincidenCountEl) leidosCoincidenCountEl.textContent = coinciden;
        if(pendientesCountEl) pendientesCountEl.textContent = pendientes < 0 ? 0 : pendientes;
        if(noCorrespondenCountEl) noCorrespondenCountEl.textContent = noCorresponden;
    }

    async function fetchAndDisplayStatusLE() {
        if (window.globalCurrentMode !== "A Partir de Lista") {
            stopPollingStatusLE();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL_LE}/status`);
            if (!response.ok) {
                console.error('Error al obtener estado (Lista):', response.status);
                if(tableBodyLEResults) tableBodyLEResults.innerHTML = `<tr><td colspan="10">Error al cargar datos: ${response.status}</td></tr>`;
                updateStatusBoxes([]);
                return;
            }
            const data = await response.json();

            if (!tableBodyLEResults) {
                console.error("tableBodyLEResults no encontrado.");
                return;
            }
            tableBodyLEResults.innerHTML = '';
            if (data && Array.isArray(data)) {
                data.forEach(item => {
                    const row = tableBodyLEResults.insertRow();
                    row.insertCell().textContent = item.id || 'N/A';
                    row.insertCell().textContent = item.epc;
                    row.insertCell().textContent = item.eventTime ? new Date(item.eventTime).toLocaleString() : 'N/A';
                    row.insertCell().textContent = item.nombreDelTipoDeEvento || 'N/A';

                    const statusCell = row.insertCell();
                    statusCell.innerHTML = getStatusColorVisual(item.estadoColor);

                    row.insertCell().textContent = item.rssi || 'N/A';
                    row.insertCell().textContent = item.antenna || 'N/A';
                    row.insertCell().textContent = item.ticket || 'N/A';

                    const descCell = row.insertCell();
                    descCell.textContent = item.descripcion || '';

                    const actionsCell = row.insertCell();
                    const editButton = document.createElement('button');
                    editButton.textContent = 'Editar';
                    editButton.className = 'btn-edit-desc';
                    editButton.setAttribute('data-eventid', item.id);
                    editButton.disabled = true;
                    actionsCell.appendChild(editButton);
                });
                updateStatusBoxes(data);
            } else {
                updateStatusBoxes([]);
            }
        } catch (error) {
            console.error('Error de red al obtener estado (Lista):', error);
             if(tableBodyLEResults) tableBodyLEResults.innerHTML = `<tr><td colspan="10">Error de red al cargar datos.</td></tr>`;
            updateStatusBoxes([]);
        }
    }

    function startPollingStatusLE() {
        stopPollingStatusLE();
        if (window.globalCurrentMode === "A Partir de Lista") {
             fetchAndDisplayStatusLE();
             leStatusPollInterval = setInterval(fetchAndDisplayStatusLE, 2000);
        }
    }

    function stopPollingStatusLE() {
        clearInterval(leStatusPollInterval);
    }

    if (btnLoadAndPrepareLE) {
        btnLoadAndPrepareLE.addEventListener('click', () => {
            if (!epcListTextareaLE) {
                alert("Textarea para EPCs no encontrada.");
                return;
            }
            const epcsText = epcListTextareaLE.value.trim();
            if (!epcsText) {
                alert("Por favor, ingrese una lista de EPCs.");
                currentEpcListForSession = [];
                updateLEButtonStates(false);
                updateStatusBoxes([]);
                return;
            }
            currentEpcListForSession = epcsText.split(/[\s,;\n]+/).filter(epc => epc.trim() !== '').map(epc => epc.trim());
            if (currentEpcListForSession.length === 0) {
                alert("No se encontraron EPCs válidos en la lista.");
                updateLEButtonStates(false);
                updateStatusBoxes([]);
                return;
            }
            console.log("Lista de EPCs preparada:", currentEpcListForSession);
            alert(`Lista de ${currentEpcListForSession.length} EPCs preparada. Presione 'Empezar Lectura de Lista' para iniciar.`);
            updateLEButtonStates(true);

            if(esperadosCountEl) esperadosCountEl.textContent = currentEpcListForSession.length;
            if(leidosCoincidenCountEl) leidosCoincidenCountEl.textContent = 0;
            if(pendientesCountEl) pendientesCountEl.textContent = currentEpcListForSession.length;
            if(noCorrespondenCountEl) noCorrespondenCountEl.textContent = 0;
            if(tableBodyLEResults) tableBodyLEResults.innerHTML = '';
        });
    }

    if (btnStartLE) {
        btnStartLE.addEventListener('click', async () => {
            if (currentEpcListForSession.length === 0) {
                alert("Primero debe cargar y preparar una lista de EPCs.");
                return;
            }
            if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("A Partir de Lista");

            try {
                const response = await fetch(`${API_BASE_URL_LE}/start/list-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentEpcListForSession)
                });

                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(true);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, true);
                    updateLEButtonStates(true);
                    startPollingStatusLE();
                } else {
                    alert(`Error al iniciar lectura (Lista): ${response.status} ${await response.text()}`);
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    updateLEButtonStates(true);
                    if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                }
            } catch (error) {
                alert(`Error de red al iniciar lectura (Lista): ${error}`);
                if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                updateLEButtonStates(true);
                if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
            }
        });
    }

    if (btnStopLE) {
        btnStopLE.addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE_URL_LE}/stop`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    updateLEButtonStates(currentEpcListForSession.length > 0);
                    stopPollingStatusLE();
                    fetchAndDisplayStatusLE();
                } else {
                    alert(`Error al detener lectura (Lista): ${response.status} ${await response.text()}`);
                }
            } catch (error) {
                alert(`Error de red al detener lectura (Lista): ${error}`);
            }
        });
    }

    if (btnClearLE) {
        btnClearLE.addEventListener('click', async () => {
            try {
                if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("A Partir de Lista");

                const response = await fetch(`${API_BASE_URL_LE}/clear`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if(tableBodyLEResults) tableBodyLEResults.innerHTML = '';
                    if(epcListTextareaLE) epcListTextareaLE.value = '';
                    currentEpcListForSession = [];
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    updateLEButtonStates(false);
                    updateStatusBoxes([]);
                } else {
                    alert(`Error al limpiar (Lista): ${response.status} ${await response.text()}`);
                }
            } catch (error) {
                alert(`Error de red al limpiar (Lista): ${error}`);
            }
        });
    }

    if (btnExportCsvLE) {
        btnExportCsvLE.addEventListener('click', async () => {
            if (window.globalIsReaderActive) {
                alert("Por favor, detenga la lectura antes de generar el reporte.");
                return;
            }
            if (tableBodyLEResults && tableBodyLEResults.rows.length === 0) {
                 alert("No hay datos en la grilla actual para generar el reporte.");
                 return;
            }
            console.log("Intentando exportar CSV para modo Lista...");
            // Este endpoint necesita ser creado en el backend:
            const reportUrl = `${API_BASE_URL_LE}/report/list-verification/csv`;

            try {
                const response = await fetch(reportUrl);
                if (!response.ok) {
                    throw new Error(`Error del servidor al generar el reporte (Lista): ${response.status} ${response.statusText}`);
                }

                const disposition = response.headers.get('Content-Disposition');
                let filename = 'reporte_lista_esperada.csv';
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
                console.log("Descarga de CSV (Lista) solicitada.");

            } catch (error) {
                console.error("Error al exportar CSV (Lista):", error);
                alert(`Error al generar el reporte CSV (Lista): ${error.message}. (Asegúrese que el endpoint de backend exista)`);
            }
        });
    }

    // Lógica de inicialización de la pantalla
    if (document.getElementById('listaEsperadaScreenView')) {
        if (window.globalCurrentMode === "A Partir de Lista") {
            updateLEButtonStates(currentEpcListForSession.length > 0);
            if (!window.globalIsReaderActive) {
                fetchAndDisplayStatusLE();
            } else {
                startPollingStatusLE();
            }
        } else {
            updateLEButtonStates(false);
            updateStatusBoxes([]);
            stopPollingStatusLE();
        }
    }
}

// Auto-ejecución cuando el script es cargado
if (document.getElementById('listaEsperadaScreenView')) {
    initializeListaEsperadaLogic();
}