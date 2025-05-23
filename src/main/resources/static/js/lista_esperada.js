// js/lista_esperada.js

function initializeListaEsperadaLogic() {
    console.log("DEBUG: Inicializando lógica y listeners para 'A Partir de Lista'.");

    const API_BASE_URL_LE = window.API_BASE_URL || 'http://localhost:8080/api/tags';

    // Elementos UI principales
    const epcListTextareaLE = document.getElementById('epcListTextareaLE');
    const epcFileLE = document.getElementById('epcFileLE');
    const btnLoadAndPrepareLE = document.getElementById('btnLoadAndPrepareLE');
    const btnStartLE = document.getElementById('btnStartLE');
    const btnStopLE = document.getElementById('btnStopLE');
    const btnClearLE = document.getElementById('btnClearLE');
    const btnExportCsvLE = document.getElementById('btnExportCsvLE');

    const tableBodyLEResults = document.getElementById('tableBodyLEResults');
    const tableBodyLESessionHistory = document.getElementById('tableBodyLESessionHistory');

    // Elementos de los recuadros de estado
    const esperadosCountEl = document.getElementById('leEsperadosCount');
    const leidosCoincidenCountEl = document.getElementById('leLeidosCoincidenCount');
    const pendientesCountEl = document.getElementById('lePendientesCount');
    const noCorrespondenCountEl = document.getElementById('leNoCorrespondenCount');

    let leStatusPollInterval;
    let currentEpcListForSession = [];
    let originalDescriptionBeforeEdit = "";

    // Función para cargar HTML dinámicamente
    async function loadPartialHTML(url, element) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Error al cargar parcial ${url}: ${response.status} ${response.statusText}`);
            }
            element.innerHTML = await response.text();
            return true;
        } catch (error) {
            element.innerHTML = `<p style="color:red;">${error.message}</p>`;
            console.error(error);
            return false;
        }
    }

    // Función para generar la visualización del estado con color
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

    // Función para actualizar el estado de los botones principales de la pantalla
    function updateLEButtonStates() {
        const listIsLoaded = currentEpcListForSession.length > 0;
        if (window.globalIsReaderActive && window.globalCurrentMode === "A Partir de Lista") {
            if(btnLoadAndPrepareLE) btnLoadAndPrepareLE.disabled = true;
            if(epcListTextareaLE) epcListTextareaLE.disabled = true;
            if(epcFileLE) epcFileLE.disabled = true;
            if(btnStartLE) btnStartLE.disabled = true;
            if(btnStopLE) btnStopLE.disabled = false;
            if(btnClearLE) btnClearLE.disabled = true;
            if(btnExportCsvLE) btnExportCsvLE.disabled = true;
        } else {
            if(btnLoadAndPrepareLE) btnLoadAndPrepareLE.disabled = false;
            if(epcListTextareaLE) epcListTextareaLE.disabled = false;
            if(epcFileLE) epcFileLE.disabled = false;
            if(btnStartLE) btnStartLE.disabled = !listIsLoaded || window.globalIsReaderActive;
            if(btnStopLE) btnStopLE.disabled = true;
            const canClearOrReport = (window.globalCurrentMode === "A Partir de Lista" || window.globalCurrentMode === "Ninguno" || !window.globalIsReaderActive);
            if(btnClearLE) btnClearLE.disabled = !canClearOrReport;
            if(btnExportCsvLE) btnExportCsvLE.disabled = !(canClearOrReport && tableBodyLEResults && tableBodyLEResults.rows.length > 0);
        }
    }

    // Función para actualizar los recuadros de estado
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

    // Función para obtener y mostrar el estado de la sesión de lectura actual
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
                    descCell.setAttribute('data-epc', item.epc);
                    const actionsCell = row.insertCell();
                    const editButton = document.createElement('button');
                    editButton.textContent = 'Editar';
                    editButton.className = 'btn-edit-desc action-button';
                    editButton.setAttribute('data-eventid', item.id);
                    editButton.disabled = false;
                    editButton.onclick = () => handleDescriptionEditToggle(editButton, descCell, item.id, false);
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

    // Función para manejar la edición de descripción (en tabla principal o modal)
    async function handleDescriptionEditToggle(button, descCell, eventId, isModalContext) {
        if (!eventId && eventId !== 0) {
            alert("Error: ID de evento no disponible para guardar.");
            return;
        }
        const originalBgColor = button.style.backgroundColor;

        if (button.textContent === 'Editar') {
            originalDescriptionBeforeEdit = descCell.textContent;
            descCell.contentEditable = "true";
            descCell.style.backgroundColor = "#fffde7";
            descCell.focus();
            button.textContent = 'Guardar';
            button.style.backgroundColor = "#28a745";

            const selector = isModalContext ? '#tableModalDetalleSesion .btn-edit-desc' : '#tableLEResults .btn-edit-desc';
            document.querySelectorAll(selector).forEach(btn => {
                if (btn !== button) btn.disabled = true;
            });
        } else {
            const newDescription = descCell.textContent.trim();
            descCell.contentEditable = "false";
            descCell.style.backgroundColor = "";
            button.textContent = 'Editar';
            button.style.backgroundColor = originalBgColor;

            const selector = isModalContext ? '#tableModalDetalleSesion .btn-edit-desc' : '#tableLEResults .btn-edit-desc';
            document.querySelectorAll(selector).forEach(btn => {
                btn.disabled = false;
            });

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
                    // Si se guardó desde el modal, y si `refreshModalDetails` existiera y fuera necesaria:
                    // if (isModalContext && typeof refreshModalDetails === 'function') {
                    //     refreshModalDetails(button.closest('table').dataset.sessionId); // Ejemplo de cómo obtener sessionId
                    // }
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

    // Funciones de polling para la sesión actual
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

    // Función para procesar la lista de EPCs (desde textarea o archivo)
    function processEpcList(epcsText) {
        if (!epcsText) {
            currentEpcListForSession = [];
            updateLEButtonStates(false); updateStatusBoxes([]); return false;
        }
        currentEpcListForSession = epcsText.split(/[\s,;\n]+/).filter(epc => epc.trim() !== '').map(epc => epc.trim());
        if (currentEpcListForSession.length === 0 && epcsText.trim() !== "") {
            alert("No se encontraron EPCs válidos en el contenido proporcionado.");
            updateLEButtonStates(false); updateStatusBoxes([]); return false;
        } else if (currentEpcListForSession.length === 0 && epcsText.trim() === "") {
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

    // --- Función para Cargar y Mostrar Historial de Sesiones ---
    async function fetchAndDisplaySessionHistoryLE() {
        if (!tableBodyLESessionHistory) {
            console.error("Elemento tableBodyLESessionHistory no encontrado en el DOM.");
            return;
        }
        const historyUrl = `${API_BASE_URL_LE}/list-verification/sessions`;
        console.log("DEBUG: Obteniendo historial de sesiones desde:", historyUrl);
        try {
            const response = await fetch(historyUrl);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error al obtener historial (Lista):', response.status, errorText);
                tableBodyLESessionHistory.innerHTML = `<tr><td colspan="6">Error al cargar historial: ${response.status}.</td></tr>`;
                return;
            }
            const sessions = await response.json();
            console.log("DEBUG: Sesiones recibidas del backend:", sessions);

            tableBodyLESessionHistory.innerHTML = '';
            if (sessions && Array.isArray(sessions) && sessions.length > 0) {
                sessions.forEach(session => {
                    const row = tableBodyLESessionHistory.insertRow();
                    row.insertCell().textContent = session.fechaHoraInicio ? new Date(session.fechaHoraInicio).toLocaleString() : 'N/A';
                    row.insertCell().textContent = session.totalEsperado !== null ? session.totalEsperado : 0;
                    row.insertCell().textContent = session.totalCoincidentes !== null ? session.totalCoincidentes : 0;
                    row.insertCell().textContent = session.totalPendientes !== null ? session.totalPendientes : 0;
                    row.insertCell().textContent = session.totalNoCorresponden !== null ? session.totalNoCorresponden : 0;

                    const actionsCell = row.insertCell();
                    const viewMoreButton = document.createElement('button');
                    viewMoreButton.textContent = 'Ver más...';
                    viewMoreButton.className = 'btn-view-session-details action-button';
                    viewMoreButton.setAttribute('data-sessionid', session.sesionId);
                    viewMoreButton.onclick = () => handleViewSessionDetails(session.sesionId, session);
                    actionsCell.appendChild(viewMoreButton);
                });
            } else {
                tableBodyLESessionHistory.innerHTML = `<tr><td colspan="6">No hay historial de sesiones disponible.</td></tr>`;
            }
        } catch (error) {
            console.error('Error de red al obtener historial (Lista):', error);
            if (tableBodyLESessionHistory) {
                tableBodyLESessionHistory.innerHTML = `<tr><td colspan="6">Error de red al cargar historial.</td></tr>`;
            }
        }
    }

    // --- Función para "Ver más..." y Manejar el Modal ---
    async function handleViewSessionDetails(sessionId, sessionSummaryData) {
        console.log(`DEBUG: "Ver más..." para Sesión ID: ${sessionId}, Data Resumen:`, sessionSummaryData);
        const modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) {
            console.error("Contenedor del modal 'modalContainer' no encontrado en index.html");
            alert("Error: No se puede mostrar el detalle de la sesión (contenedor no encontrado).");
            return;
        }

        const modalLoaded = await loadPartialHTML('partials/DetalleLecturaEsperada.html', modalContainer);
        if (!modalLoaded) {
            alert("Error al cargar la vista de detalle de sesión.");
            return;
        }

        modalContainer.style.display = 'flex'; // Mostrar el contenedor principal del modal
        const modalOverlay = modalContainer.querySelector('#modalDetalleSesion'); // El overlay está DENTRO del container ahora

        if (modalOverlay) {
            // No es necesario cambiar el display del modalOverlay si el CSS ya lo tiene como 'flex'
            // y el modalContainer es el que se muestra/oculta.
            // Si .modal-overlay en CSS tiene display:none, entonces sí:
             modalOverlay.style.display = 'flex';
        } else {
            console.error("Elemento raíz del modal #modalDetalleSesion no encontrado en el HTML cargado.");
            modalContainer.style.display = 'none'; // Ocultar si no se encontró el contenido
            return;
        }

        if (sessionSummaryData) {
            modalContainer.querySelector('#modalSesionId').textContent = sessionSummaryData.sesionId || 'N/A';
            modalContainer.querySelector('#modalFechaInicio').textContent = sessionSummaryData.fechaHoraInicio ? new Date(sessionSummaryData.fechaHoraInicio).toLocaleString() : 'N/A';
            modalContainer.querySelector('#modalFechaFin').textContent = sessionSummaryData.fechaHoraFin ? new Date(sessionSummaryData.fechaHoraFin).toLocaleString() : 'N/A';
            modalContainer.querySelector('#modalTotalEsperado').textContent = sessionSummaryData.totalEsperado !== null ? sessionSummaryData.totalEsperado : 0;
            modalContainer.querySelector('#modalTotalCoincidentes').textContent = sessionSummaryData.totalCoincidentes !== null ? sessionSummaryData.totalCoincidentes : 0;
            modalContainer.querySelector('#modalTotalPendientes').textContent = sessionSummaryData.totalPendientes !== null ? sessionSummaryData.totalPendientes : 0;
            modalContainer.querySelector('#modalTotalNoCorresponden').textContent = sessionSummaryData.totalNoCorresponden !== null ? sessionSummaryData.totalNoCorresponden : 0;
        }

        const closeButton = modalContainer.querySelector('.modal-close-button');
        if (closeButton) {
            closeButton.onclick = () => {
                modalContainer.style.display = 'none';
                modalContainer.innerHTML = '';
            };
        }
        // El modalContainer es el overlay ahora, así que el clic en él (fuera del modal-content) cierra.
        modalContainer.onclick = (event) => {
            if (event.target === modalContainer) {
                 modalContainer.style.display = 'none';
                 modalContainer.innerHTML = '';
            }
        };
        const modalContentDiv = modalContainer.querySelector('.modal-content');
        if(modalContentDiv) modalContentDiv.onclick = (event) => event.stopPropagation();


        // --- LÓGICA PARA EL BOTÓN EXPORTAR CSV DENTRO DEL MODAL ---
        const btnExportCsvModal = modalContainer.querySelector('#btnExportCsvModalDetalle');
        if (btnExportCsvModal) {
            btnExportCsvModal.onclick = async () => {
                if (window.globalIsReaderActive) { // Aunque no debería estar leyendo al ver detalles históricos
                    alert("La lectura está activa. Deténgala para exportar.");
                    return;
                }
                console.log(`Intentando exportar CSV para sesión histórica ID: ${sessionId}`);
                // Endpoint específico para exportar detalles de UNA sesión
                const reportUrl = `${API_BASE_URL_LE}/list-verification/sessions/${sessionId}/report/csv`;

                try {
                    const response = await fetch(reportUrl);
                    if (!response.ok) {
                        throw new Error(`Error del servidor al generar el reporte para sesión ${sessionId}: ${response.status} ${response.statusText}`);
                    }

                    const disposition = response.headers.get('Content-Disposition');
                    let filename = `reporte_sesion_${sessionId}.csv`; // Nombre de archivo específico de la sesión
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
                    console.log(`Descarga de CSV para sesión ${sessionId} solicitada.`);

                } catch (error) {
                    console.error(`Error al exportar CSV para sesión ${sessionId}:`, error);
                    alert(`Error al generar el reporte CSV para la sesión: ${error.message}. (Asegúrese que el endpoint de backend exista)`);
                }
            };
        } else {
            console.warn("Botón 'btnExportCsvModalDetalle' no encontrado en el modal.");
        }


        const tableBodyModal = modalContainer.querySelector('#tableBodyModalDetalleSesion');
        if (!tableBodyModal) {
            console.error("Tabla de detalle '#tableBodyModalDetalleSesion' no encontrada en el modal.");
            return;
        }
        tableBodyModal.innerHTML = `<tr><td colspan="10">Cargando detalles de eventos...</td></tr>`;

        try {
            const detailsUrl = `${API_BASE_URL_LE}/list-verification/sessions/${sessionId}/details`;
            console.log("DEBUG: Obteniendo detalles de eventos de sesión desde:", detailsUrl);
            const response = await fetch(detailsUrl);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error al obtener detalles para sesión ${sessionId}:`, response.status, errorText);
                tableBodyModal.innerHTML = `<tr><td colspan="10">Error al cargar detalles: ${response.status}.</td></tr>`;
                return;
            }
            const eventDetails = await response.json();
            console.log(`DEBUG: Detalles para sesión ${sessionId}:`, eventDetails);

            tableBodyModal.innerHTML = '';
            if (eventDetails && Array.isArray(eventDetails) && eventDetails.length > 0) {
                eventDetails.forEach(item => {
                    const row = tableBodyModal.insertRow();
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
                    editButton.onclick = () => handleDescriptionEditToggle(editButton, descCell, item.id, true);
                    actionsCell.appendChild(editButton);
                });
            } else {
                tableBodyModal.innerHTML = `<tr><td colspan="10">No hay eventos detallados para esta sesión.</td></tr>`;
            }
        } catch (error) {
            console.error(`Error de red al obtener detalles para sesión ${sessionId}:`, error);
            if(tableBodyModal) tableBodyModal.innerHTML = `<tr><td colspan="10">Error de red al cargar detalles.</td></tr>`;
        }
    }

    // Event Listeners para botones principales (btnLoadAndPrepareLE, epcFileLE, btnStartLE, btnStopLE, btnClearLE, btnExportCsvLE)
    // Asegúrate que estén aquí completos como en tu versión funcional anterior.
    // Los copio de la versión que me pasaste:
    if (btnLoadAndPrepareLE) {
        btnLoadAndPrepareLE.addEventListener('click', () => {
            if (!epcListTextareaLE) { alert("Textarea para EPCs no encontrada."); return; }
            const epcsText = epcListTextareaLE.value.trim();
            processEpcList(epcsText);
        });
    }

    if (epcFileLE) {
        epcFileLE.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type === "text/plain" || file.name.endsWith(".txt")) {
                    const reader = new FileReader();
                    reader.onload = (e_reader) => {
                        const fileContent = e_reader.target.result;
                        if(epcListTextareaLE) epcListTextareaLE.value = fileContent;
                        processEpcList(fileContent);
                        if(epcFileLE) epcFileLE.value = null;
                    };
                    reader.onerror = (e_reader) => {
                        alert("Error al leer el archivo.");
                        console.error("Error en FileReader:", e_reader.target.error);
                        if(epcFileLE) epcFileLE.value = null;
                    };
                    reader.readAsText(file);
                } else {
                    alert("Por favor, seleccione un archivo .txt válido.");
                    if(epcFileLE) epcFileLE.value = null;
                }
            }
        });
    }

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
                    stopPollingStatusLE();
                    await fetchAndDisplayStatusLE();
                    await fetchAndDisplaySessionHistoryLE();
                    updateLEButtonStates(currentEpcListForSession.length > 0);
                    if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                } else {
                    alert(`Error al detener (Lista): ${response.status} ${await response.text()}`);
                    await fetchAndDisplaySessionHistoryLE();
                }
            } catch (error) {
                alert(`Error de red al detener (Lista): ${error}`);
                await fetchAndDisplaySessionHistoryLE();
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
                let filename = 'reporte_lista_esperada_sesion_actual.csv';
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

    // INICIALIZACIÓN DE LA PANTALLA
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
        fetchAndDisplaySessionHistoryLE();
    }
} // Fin de initializeListaEsperadaLogic

if (document.getElementById('listaEsperadaScreenView')) {
    if (!document.getElementById('listaEsperadaScreenView').getAttribute('data-logic-initialized')) {
        document.getElementById('listaEsperadaScreenView').setAttribute('data-logic-initialized', 'true');
        initializeListaEsperadaLogic();
    }
}