// js/lista_esperada.js

function initializeListaEsperadaLogic() {
    console.log("DEBUG: Inicializando lógica y listeners para 'A Partir de Lista'.");

    const API_BASE_URL_LE = window.API_BASE_URL || 'http://localhost:8080/api/tags';

    const epcListTextareaLE = document.getElementById('epcListTextareaLE');
    const epcFileLE = document.getElementById('epcFileLE'); // Nuevo input de archivo
    const btnLoadAndPrepareLE = document.getElementById('btnLoadAndPrepareLE');
    const btnStartLE = document.getElementById('btnStartLE');
    const btnStopLE = document.getElementById('btnStopLE');
    const btnClearLE = document.getElementById('btnClearLE');
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
                colorDot = '<span class="status-dot dot-green" style="color: green; font-size: 1.5em; vertical-align: middle;">●</span>';
                statusText = ' Recibido';
                break;
            case 'rojo':
                colorDot = '<span class="status-dot dot-red" style="color: red; font-size: 1.5em; vertical-align: middle;">●</span>';
                statusText = ' Pendiente';
                break;
            case 'amarillo':
                colorDot = '<span class="status-dot dot-yellow" style="color: orange; font-size: 1.5em; vertical-align: middle;">●</span>';
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
            if(epcFileLE) epcFileLE.disabled = true; // Deshabilitar input de archivo también
            if(btnStartLE) btnStartLE.disabled = true;
            if(btnStopLE) btnStopLE.disabled = false;
            if(btnClearLE) btnClearLE.disabled = true;
            if(btnExportCsvLE) btnExportCsvLE.disabled = true;
        } else {
            if(btnLoadAndPrepareLE) btnLoadAndPrepareLE.disabled = false;
            if(epcListTextareaLE) epcListTextareaLE.disabled = false;
            if(epcFileLE) epcFileLE.disabled = false; // Habilitar input de archivo
            if(btnStartLE) btnStartLE.disabled = !listIsLoaded || window.globalIsReaderActive;
            if(btnStopLE) btnStopLE.disabled = true;
            const canClearOrReport = (window.globalCurrentMode === "A Partir de Lista" || window.globalCurrentMode === "Ninguno" || !window.globalIsReaderActive);
            if(btnClearLE) btnClearLE.disabled = !canClearOrReport;
            if(btnExportCsvLE) btnExportCsvLE.disabled = !listIsLoaded || !canClearOrReport || (tableBodyLEResults && tableBodyLEResults.rows.length === 0);
        }
    }

    function updateStatusBoxes(dataList) {
        let esperados = currentEpcListForSession.length;
        let coinciden = 0;
        let pendientes = 0;
        let noCorresponden = 0;

        if (dataList && Array.isArray(dataList)) {
            const uniqueEpcsForStatusCount = new Map();
            dataList.forEach(item => {
                if (item.epc) {
                    const existingStatus = uniqueEpcsForStatusCount.get(item.epc);
                    if (!existingStatus ||
                        (existingStatus === 'rojo' && (item.estadoColor === 'verde' || item.estadoColor === 'amarillo')) ||
                        (existingStatus === 'amarillo' && item.estadoColor === 'verde')) {
                        uniqueEpcsForStatusCount.set(item.epc, item.estadoColor);
                    }
                }
            });
            uniqueEpcsForStatusCount.forEach((statusColor, epc) => {
                if (statusColor === 'verde' && currentEpcListForSession.includes(epc)) {
                    coinciden++;
                } else if (statusColor === 'amarillo') {
                     if(!currentEpcListForSession.includes(epc)){
                        noCorresponden++;
                     }
                }
            });
            pendientes = esperados - coinciden;
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
                    editButton.className = 'btn-edit-desc action-button';
                    editButton.setAttribute('data-eventid', item.id);
                    editButton.disabled = false;
                    editButton.onclick = () => handleDescriptionEditToggle(editButton, descCell, item.id);
                    actionsCell.appendChild(editButton);
                });
                updateStatusBoxes(data);
            } else {
                updateStatusBoxes([]);
            }
            updateLEButtonStates();
        } catch (error) {
            console.error('Error de red al obtener estado (Lista):', error);
             if(tableBodyLEResults) tableBodyLEResults.innerHTML = `<tr><td colspan="10">Error de red al cargar datos.</td></tr>`;
            updateStatusBoxes([]);
        }
    }

    async function handleDescriptionEditToggle(button, descCell, eventId) {
        if (!eventId) {
            alert("Error: ID de evento no disponible para guardar.");
            return;
        }
        if (button.textContent === 'Editar') {
            originalDescriptionBeforeEdit = descCell.textContent;
            descCell.contentEditable = "true";
            descCell.style.backgroundColor = "#fffde7";
            descCell.focus();
            button.textContent = 'Guardar';
            button.style.backgroundColor = "#28a745";
        } else {
            const newDescription = descCell.textContent.trim();
            descCell.contentEditable = "false";
            descCell.style.backgroundColor = "";
            button.textContent = 'Editar';
            button.style.backgroundColor = "";
            console.log(`Intentando Guardar: Evento ID: ${eventId}, Nueva Descripción: ${newDescription}`);
            try {
                const response = await fetch(`${API_BASE_URL_LE}/events/${eventId}/description`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ descripcion: newDescription }),
                });
                if (response.ok) {
                    const result = await response.json();
                    console.log(result.message);
                } else {
                    console.error("Error al guardar descripción:", response.status, await response.text());
                    alert(`Error al guardar descripción: ${response.status}. Revirtiendo cambio.`);
                    descCell.textContent = originalDescriptionBeforeEdit;
                }
            } catch (error) {
                console.error("Error de red al guardar descripción:", error);
                alert("Error de red al guardar descripción. Revirtiendo cambio.");
                descCell.textContent = originalDescriptionBeforeEdit;
            }
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

    function processEpcList(epcsText) {
        if (!epcsText) {
            alert("No hay contenido para procesar.");
            currentEpcListForSession = [];
            updateLEButtonStates(false); updateStatusBoxes([]); return false;
        }
        currentEpcListForSession = epcsText.split(/[\s,;\n]+/).filter(epc => epc.trim() !== '').map(epc => epc.trim());
        if (currentEpcListForSession.length === 0) {
            alert("No se encontraron EPCs válidos en el contenido.");
            updateLEButtonStates(false); updateStatusBoxes([]); return false;
        }
        console.log("Lista de EPCs procesada:", currentEpcListForSession);
        alert(`Lista de ${currentEpcListForSession.length} EPCs preparada. Presione 'Empezar Lectura de Lista' para iniciar.`);
        updateLEButtonStates(true);
        if(esperadosCountEl) esperadosCountEl.textContent = currentEpcListForSession.length;
        if(leidosCoincidenCountEl) leidosCoincidenCountEl.textContent = 0;
        if(pendientesCountEl) pendientesCountEl.textContent = currentEpcListForSession.length;
        if(noCorrespondenCountEl) noCorrespondenCountEl.textContent = 0;
        if(tableBodyLEResults) tableBodyLEResults.innerHTML = '';
        return true;
    }

    // --- Event Listeners para botones principales ---
    if (btnLoadAndPrepareLE) {
        btnLoadAndPrepareLE.addEventListener('click', () => {
            if (!epcListTextareaLE) { alert("Textarea para EPCs no encontrada."); return; }
            const epcsText = epcListTextareaLE.value.trim();
            processEpcList(epcsText);
        });
    }

    // --- NUEVA LÓGICA PARA CARGA DE ARCHIVO ---
    if (epcFileLE) {
        epcFileLE.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type === "text/plain") {
                    const reader = new FileReader();
                    reader.onload = (e_reader) => {
                        const fileContent = e_reader.target.result;
                        if(epcListTextareaLE) epcListTextareaLE.value = fileContent; // Mostrar contenido en textarea
                        processEpcList(fileContent); // Procesar el contenido del archivo
                        epcFileLE.value = null; // Resetear el input de archivo para permitir cargar el mismo archivo de nuevo
                    };
                    reader.onerror = (e_reader) => {
                        alert("Error al leer el archivo.");
                        console.error("Error en FileReader:", e_reader.target.error);
                        epcFileLE.value = null;
                    };
                    reader.readAsText(file);
                } else {
                    alert("Por favor, seleccione un archivo .txt");
                    epcFileLE.value = null;
                }
            }
        });
    }

    if (btnStartLE) { /* ... lógica existente sin cambios ... */ }
    if (btnStopLE) { /* ... lógica existente sin cambios ... */ }
    if (btnClearLE) { /* ... lógica existente sin cambios ... */ }
    if (btnExportCsvLE) { /* ... lógica existente sin cambios ... */ }
    // (Para brevedad, he omitido el código de los listeners de btnStartLE, btnStopLE, btnClearLE, btnExportCsvLE que ya tenías y funcionaba)
    // Asegúrate de que este código esté presente como en la versión anterior del archivo.
    // La siguiente es una versión resumida de lo que ya tenías para esos botones:

    if (btnStartLE) {
        btnStartLE.addEventListener('click', async () => {
            if (currentEpcListForSession.length === 0) { alert("Cargue una lista de EPCs."); return; }
            if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("A Partir de Lista");
            try {
                const response = await fetch(`${API_BASE_URL_LE}/start/list-verification`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentEpcListForSession)
                });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(true);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, true);
                    updateLEButtonStates(true); startPollingStatusLE();
                } else {
                    alert(`Error al iniciar (Lista): ${response.status} ${await response.text()}`);
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    updateLEButtonStates(true); if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                }
            } catch (error) {
                alert(`Error de red al iniciar (Lista): ${error}`);
                if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                updateLEButtonStates(true); if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
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
                    stopPollingStatusLE(); fetchAndDisplayStatusLE();
                } else { alert(`Error al detener (Lista): ${response.status} ${await response.text()}`); }
            } catch (error) { alert(`Error de red al detener (Lista): ${error}`); }
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
                    updateLEButtonStates(false); updateStatusBoxes([]);
                } else { alert(`Error al limpiar (Lista): ${response.status} ${await response.text()}`);}
            } catch (error) { alert(`Error de red al limpiar (Lista): ${error}`); }
        });
    }

    if (btnExportCsvLE) {
        btnExportCsvLE.addEventListener('click', async () => {
            if (window.globalIsReaderActive) { alert("Detenga la lectura antes de exportar."); return; }
            if (tableBodyLEResults && tableBodyLEResults.rows.length === 0) { alert("No hay datos para generar reporte."); return; }
            const reportUrl = `${API_BASE_URL_LE}/report/list-verification/csv`;
            try {
                const response = await fetch(reportUrl);
                if (!response.ok) throw new Error(`Error servidor reporte (Lista): ${response.status} ${response.statusText}`);
                const disposition = response.headers.get('Content-Disposition');
                let filename = 'reporte_lista_esperada.csv';
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
                }
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl; a.download = filename; document.body.appendChild(a);
                a.click(); a.remove(); window.URL.revokeObjectURL(downloadUrl);
            } catch (error) {
                console.error("Error al exportar CSV (Lista):", error);
                alert(`Error al generar reporte CSV (Lista): ${error.message}.`);
            }
        });
    }


    // Inicialización
    if (document.getElementById('listaEsperadaScreenView')) {
        if (window.globalCurrentMode === "A Partir de Lista") {
            updateLEButtonStates(currentEpcListForSession.length > 0);
            if (!window.globalIsReaderActive) { fetchAndDisplayStatusLE(); }
            else { startPollingStatusLE(); }
        } else {
            updateLEButtonStates(false); updateStatusBoxes([]); stopPollingStatusLE();
        }
    }
}

if (document.getElementById('listaEsperadaScreenView')) {
    initializeListaEsperadaLogic();
}