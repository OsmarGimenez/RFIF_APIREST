// js/conteo.js

function initializeConteoLogic() {
    console.log("DEBUG: Inicializando lógica y listeners para 'Conteo por Cantidad'.");

    const API_BASE_URL_CT = window.API_BASE_URL || 'http://localhost:8080/api/tags';

    // Elementos de la UI
    const targetCountInputCT = document.getElementById('targetCountInputCT');
    const btnStartConteo = document.getElementById('btnStartConteo');
    const btnStopConteo = document.getElementById('btnStopConteo');
    const btnClearConteo = document.getElementById('btnClearConteo');

    // Recuadros de estado
    const conteoCurrentReadEl = document.getElementById('conteoCurrentRead');
    const conteoRemainingEl = document.getElementById('conteoRemaining');
    const conteoExcessEl = document.getElementById('conteoExcess');
    const conteoTargetDisplayEl = document.getElementById('conteoTargetDisplayCT');

    // Tabla de historial de sesiones de conteo
    const tableBodyConteoSessionHistory = document.getElementById('tableBodyConteoSessionHistory');

    let ctStatusPollInterval;
    let currentTargetForSession = 0;
    let originalDescriptionBeforeEdit = ""; // Para la edición inline en el modal de detalle

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

    // Función para generar la visualización del estado con color (reutilizada del modal de lista)
    function getStatusColorVisualInModal(statusColor) {
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
                return statusColor || '-';
        }
        return `${colorDot}${statusText}`;
    }


    function updateConteoButtonStates() {
        if (window.globalIsReaderActive && window.globalCurrentMode === "Conteo") {
            if(targetCountInputCT) targetCountInputCT.disabled = true;
            if(btnStartConteo) btnStartConteo.disabled = true;
            if(btnStopConteo) btnStopConteo.disabled = false;
            if(btnClearConteo) btnClearConteo.disabled = true;
        } else {
            if(targetCountInputCT) targetCountInputCT.disabled = false;
            if(btnStartConteo) btnStartConteo.disabled = false;
            if(btnStopConteo) btnStopConteo.disabled = true;
            const canClear = (window.globalCurrentMode === "Conteo" || window.globalCurrentMode === "Ninguno") && !window.globalIsReaderActive;
            if(btnClearConteo) btnClearConteo.disabled = !canClear;
        }
    }

    function updateConteoStatusBoxes(target, currentRead) {
        let faltantes = 0;
        let excedentes = 0;

        if (target > 0) {
            if (currentRead <= target) {
                faltantes = target - currentRead;
            } else {
                excedentes = currentRead - target;
            }
        }

        if(conteoTargetDisplayEl) conteoTargetDisplayEl.textContent = target;
        if(conteoCurrentReadEl) conteoCurrentReadEl.textContent = currentRead;
        if(conteoRemainingEl) conteoRemainingEl.textContent = faltantes;
        if(conteoExcessEl) conteoExcessEl.textContent = excedentes;
    }

    async function fetchAndDisplayStatusConteo() {
        if (window.globalCurrentMode !== "Conteo") {
            stopPollingStatusConteo();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL_CT}/status`);
            if (!response.ok) {
                console.error('Error al obtener estado (Conteo):', response.status);
                updateConteoStatusBoxes(currentTargetForSession, 0);
                return;
            }
            const data = await response.json();

            let target = currentTargetForSession;
            let current = 0;

            data.forEach(item => {
                if (item.epc === "CurrentReadCount") current = parseInt(item.status) || 0;
            });
            updateConteoStatusBoxes(target, current);
        } catch (error) {
            console.error('Error de red al obtener estado (Conteo):', error);
            updateConteoStatusBoxes(currentTargetForSession, 0);
        }
    }

    function startPollingStatusConteo() {
        stopPollingStatusConteo();
        if (window.globalCurrentMode === "Conteo") {
             fetchAndDisplayStatusConteo();
             ctStatusPollInterval = setInterval(fetchAndDisplayStatusConteo, 2000);
        }
    }

    function stopPollingStatusConteo() {
        clearInterval(ctStatusPollInterval);
    }

    async function fetchAndDisplayConteoSessionHistory() {
        if (!tableBodyConteoSessionHistory) {
            console.error("Elemento tableBodyConteoSessionHistory no encontrado.");
            return;
        }
        const historyUrl = `${API_BASE_URL_CT}/quantity-counting/sessions`;
        console.log("DEBUG: Obteniendo historial de sesiones de conteo desde:", historyUrl);
        try {
            const response = await fetch(historyUrl);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error al obtener historial (Conteo):', response.status, errorText);
                tableBodyConteoSessionHistory.innerHTML = `<tr><td colspan="6">Error al cargar historial: ${response.status}.</td></tr>`;
                return;
            }
            const sessions = await response.json();
            console.log("DEBUG: Sesiones de conteo recibidas:", sessions);

            tableBodyConteoSessionHistory.innerHTML = '';
            if (sessions && Array.isArray(sessions) && sessions.length > 0) {
                sessions.forEach(session => {
                    const row = tableBodyConteoSessionHistory.insertRow();
                    row.insertCell().textContent = session.fechaHoraInicio ? new Date(session.fechaHoraInicio).toLocaleString() : 'N/A';
                    row.insertCell().textContent = session.cantidadObjetivo !== null ? session.cantidadObjetivo : 0;
                    row.insertCell().textContent = session.cantidadLeidosUnicos !== null ? session.cantidadLeidosUnicos : 0;

                    let faltantes = 0;
                    let excedentes = 0;
                    if (session.cantidadObjetivo > 0) {
                        if ((session.cantidadLeidosUnicos || 0) < session.cantidadObjetivo) {
                            faltantes = session.cantidadObjetivo - (session.cantidadLeidosUnicos || 0);
                        } else if ((session.cantidadLeidosUnicos || 0) > session.cantidadObjetivo) {
                            excedentes = (session.cantidadLeidosUnicos || 0) - session.cantidadObjetivo;
                        }
                    }
                    row.insertCell().textContent = faltantes;
                    row.insertCell().textContent = excedentes;

                    const actionsCell = row.insertCell();
                    const viewMoreButton = document.createElement('button');
                    viewMoreButton.textContent = 'Ver más...';
                    viewMoreButton.className = 'btn-view-conteo-session-details action-button';
                    viewMoreButton.setAttribute('data-sessionconteoid', session.sesionConteoId);
                    viewMoreButton.onclick = () => handleViewConteoSessionDetails(session.sesionConteoId, session);
                    actionsCell.appendChild(viewMoreButton);
                });
            } else {
                tableBodyConteoSessionHistory.innerHTML = `<tr><td colspan="6">No hay historial de sesiones de conteo.</td></tr>`;
            }
        } catch (error) {
            console.error('Error de red al obtener historial (Conteo):', error);
            if (tableBodyConteoSessionHistory) {
                tableBodyConteoSessionHistory.innerHTML = `<tr><td colspan="6">Error de red al cargar historial de conteo.</td></tr>`;
            }
        }
    }

    async function handleViewConteoSessionDetails(sesionConteoId, sessionSummaryData) {
        console.log(`DEBUG: "Ver más..." para Sesión de Conteo ID: ${sesionConteoId}, Data Resumen:`, sessionSummaryData);
        const modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) {
            console.error("Contenedor del modal 'modalContainer' no encontrado.");
            return;
        }

        const modalLoaded = await loadPartialHTML('partials/DetalleLecturaEsperada.html', modalContainer);
        if (!modalLoaded) {
            alert("Error al cargar la vista de detalle de sesión.");
            modalContainer.style.display = 'none'; // Asegurar que el contenedor se oculte si falla la carga del parcial
            return;
        }

        // PASO 1: Hacer visible el CONTENEDOR del modal (el div en index.html)
        modalContainer.style.display = 'flex';

        // PASO 2: Obtener la referencia al elemento raíz del modal (el overlay que se cargó)
        const modalOverlay = modalContainer.querySelector('#modalDetalleSesion');

        if (modalOverlay) {
            // Y asegurarse que el overlay también esté visible (si su CSS lo oculta por defecto)
            modalOverlay.style.display = 'flex';
            console.log("DEBUG: modalOverlay (#modalDetalleSesion) display establecido a 'flex'.");
        } else {
            console.error("Elemento raíz del modal #modalDetalleSesion no encontrado en el HTML cargado.");
            modalContainer.style.display = 'none'; // Ocultar el contenedor si el contenido del modal no se encontró
            return;
        }

        // Poblar resumen del modal con datos de sesión de conteo
        if (sessionSummaryData) {
            // IDs del modal (de DetalleLecturaEsperada.html)
            modalContainer.querySelector('#modalSesionId').textContent = sessionSummaryData.sesionConteoId || 'N/A';
            modalContainer.querySelector('#modalFechaInicio').textContent = sessionSummaryData.fechaHoraInicio ? new Date(sessionSummaryData.fechaHoraInicio).toLocaleString() : 'N/A';
            modalContainer.querySelector('#modalFechaFin').textContent = sessionSummaryData.fechaHoraFin ? new Date(sessionSummaryData.fechaHoraFin).toLocaleString() : 'N/A';
            modalContainer.querySelector('#modalTotalEsperado').textContent = sessionSummaryData.cantidadObjetivo !== null ? sessionSummaryData.cantidadObjetivo : 0;
            modalContainer.querySelector('#modalTotalCoincidentes').textContent = sessionSummaryData.cantidadLeidosUnicos !== null ? sessionSummaryData.cantidadLeidosUnicos : 0;

            let faltantes = 0; let excedentes = 0;
            if(sessionSummaryData.cantidadObjetivo > 0) {
                const leidos = sessionSummaryData.cantidadLeidosUnicos || 0;
                if(leidos < sessionSummaryData.cantidadObjetivo) faltantes = sessionSummaryData.cantidadObjetivo - leidos;
                else if (leidos > sessionSummaryData.cantidadObjetivo) excedentes = leidos - sessionSummaryData.cantidadObjetivo;
            }
            modalContainer.querySelector('#modalTotalPendientes').textContent = faltantes;
            modalContainer.querySelector('#modalTotalNoCorresponden').textContent = excedentes;
        }

        // Configurar el botón de cerrar del modal
        const closeButton = modalContainer.querySelector('.modal-close-button');
        if (closeButton) {
            closeButton.onclick = () => {
                modalContainer.style.display = 'none'; // Oculta el contenedor principal
                modalContainer.innerHTML = ''; // Limpia el contenido para la próxima vez
            };
        }
        // Cerrar al hacer clic fuera del modal-content (en el modalContainer)
        modalContainer.onclick = (event) => {
            if (event.target === modalContainer) {
                modalContainer.style.display = 'none';
                modalContainer.innerHTML = '';
            }
        };
        const modalContentDiv = modalContainer.querySelector('.modal-content');
        if(modalContentDiv) modalContentDiv.onclick = (event) => event.stopPropagation(); // Evita que el clic en el contenido cierre el modal

        // Botón Exportar CSV del Modal
        const btnExportCsvModal = modalContainer.querySelector('#btnExportCsvModalDetalle');
        if (btnExportCsvModal) {
            btnExportCsvModal.onclick = async () => {
                console.log(`Intentando exportar CSV para sesión histórica de conteo ID: ${sesionConteoId}`);
                const reportUrl = `${API_BASE_URL_CT}/quantity-counting/sessions/${sesionConteoId}/report/csv`;
                try {
                    const response = await fetch(reportUrl);
                    if (!response.ok) {
                        throw new Error(`Error del servidor al generar el reporte para sesión conteo ${sesionConteoId}: ${response.status} ${response.statusText}`);
                    }
                    const disposition = response.headers.get('Content-Disposition');
                    let filename = `reporte_conteo_sesion_${sesionConteoId}.csv`;
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
                    alert(`Error al generar reporte CSV para sesión de conteo: ${error.message}. (Endpoint backend pendiente?)`);
                }
            };
        } else { console.warn("Botón '#btnExportCsvModalDetalle' no encontrado en el modal."); }

        // Cargar y mostrar los EPCs leídos en esa sesión de conteo
        const tableBodyModal = modalContainer.querySelector('#tableBodyModalDetalleSesion');
        if (!tableBodyModal) { console.error("Tabla de detalle en modal no encontrada."); return; }
        tableBodyModal.innerHTML = `<tr><td colspan="10">Cargando EPCs leídos...</td></tr>`;

        try {
            const detailsUrl = `${API_BASE_URL_CT}/quantity-counting/sessions/${sesionConteoId}/details`;
            console.log("DEBUG: Obteniendo detalles de sesión de conteo desde:", detailsUrl);
            const response = await fetch(detailsUrl);
            if (!response.ok) {
                const errorText = await response.text();
                tableBodyModal.innerHTML = `<tr><td colspan="10">Error al cargar EPCs: ${response.status}.</td></tr>`;
                return;
            }
            const eventDetails = await response.json();
            tableBodyModal.innerHTML = '';
            if (eventDetails && Array.isArray(eventDetails) && eventDetails.length > 0) {
                eventDetails.forEach(item => {
                    const row = tableBodyModal.insertRow();
                    row.insertCell().textContent = item.id || 'N/A';
                    row.insertCell().textContent = item.epc;
                    row.insertCell().textContent = item.eventTime ? new Date(item.eventTime).toLocaleString() : 'N/A';
                    row.insertCell().textContent = item.nombreDelTipoDeEvento || 'N/A';
                    row.insertCell().textContent = item.estadoColor || '-';
                    row.insertCell().textContent = item.rssi || 'N/A';
                    row.insertCell().textContent = item.antenna || 'N/A';
                    row.insertCell().textContent = item.ticket || 'N/A';
                    const descCell = row.insertCell();
                    descCell.textContent = item.descripcion || '';
                    const actionsCell = row.insertCell();
                    const editButton = document.createElement('button');
                    editButton.textContent = 'Editar';
                    editButton.className = 'btn-edit-desc action-button';
                    editButton.setAttribute('data-eventid', item.id); // Guardar eventId para la edición
                    editButton.disabled = false; // HABILITAR EL BOTÓN
                    // Llamar a handleDescriptionEditToggle (necesitará estar definida o ser global)
                    // Si la función no existe en este scope, dará error.
                    // Asumimos que handleDescriptionEditToggle está definida globalmente o en este script.
                    editButton.onclick = () => handleDescriptionEditToggle(editButton, descCell, item.id, true);
                    actionsCell.appendChild(editButton);
                });
            } else {
                tableBodyModal.innerHTML = `<tr><td colspan="10">No hay EPCs detallados para esta sesión de conteo.</td></tr>`;
            }
        } catch (error) {
            if(tableBodyModal) tableBodyModal.innerHTML = `<tr><td colspan="10">Error de red al cargar EPCs de la sesión.</td></tr>`;
        }
    }

    // --- Función para manejar la edición de descripción (COPIADA DE LISTA_ESPERADA.JS Y ADAPTADA) ---
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

            // Solo deshabilitar otros botones de edición DENTRO DEL MISMO CONTEXTO (modal o tabla principal)
            const selector = isModalContext ? '#tableModalDetalleSesion .btn-edit-desc' : '#tableLEResults .btn-edit-desc'; // Ajustar si la tabla principal de conteo es diferente
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

            console.log(`Intentando Guardar (Conteo): Evento ID: ${eventId}, Nueva Descripción: ${newDescription}`);
            try {
                const response = await fetch(`${API_BASE_URL_CT}/events/${eventId}/description`, { // Usar API_BASE_URL_CT
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ descripcion: newDescription }),
                });
                if (response.ok) {
                    const result = await response.json();
                    console.log(result.message);
                } else {
                    console.error("Error al guardar descripción (Conteo):", response.status, await response.text());
                    alert(`Error al guardar descripción (Conteo): ${response.status}. Revirtiendo cambio.`);
                    descCell.textContent = originalDescriptionBeforeEdit;
                }
            } catch (error) {
                console.error("Error de red al guardar descripción (Conteo):", error);
                alert("Error de red al guardar descripción (Conteo). Revirtiendo cambio.");
                descCell.textContent = originalDescriptionBeforeEdit;
            }
        }
    }


    // --- Event Listeners para botones (Start, Stop, Clear) ---
    if (btnStartConteo) {
        btnStartConteo.addEventListener('click', async () => {
            if (!targetCountInputCT) { alert("Input para conteo no encontrado."); return; }
            currentTargetForSession = parseInt(targetCountInputCT.value);
            if (isNaN(currentTargetForSession) || currentTargetForSession < 0) {
                alert("Ingrese un conteo objetivo válido (0 o mayor).");
                return;
            }
            if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("Conteo");

            try {
                const response = await fetch(`${API_BASE_URL_CT}/start/quantity-counting?targetCount=${currentTargetForSession}`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(true);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, true);
                    updateConteoButtonStates();
                    if(conteoTargetDisplayEl) conteoTargetDisplayEl.textContent = currentTargetForSession;
                    startPollingStatusConteo();
                } else {
                    alert(`Error al iniciar (Conteo): ${response.status} ${await response.text()}`);
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    updateConteoButtonStates(); if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                }
            } catch (error) {
                alert(`Error de red al iniciar (Conteo): ${error}`);
                if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                updateConteoButtonStates(); if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
            }
        });
    }

    if (btnStopConteo) {
        btnStopConteo.addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE_URL_CT}/stop`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    stopPollingStatusConteo();
                    await fetchAndDisplayStatusConteo();
                    await fetchAndDisplayConteoSessionHistory();
                    updateConteoButtonStates();
                    if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                } else {
                    alert(`Error al detener (Conteo): ${response.status} ${await response.text()}`);
                    await fetchAndDisplayConteoSessionHistory();
                }
            } catch (error) {
                alert(`Error de red al detener (Conteo): ${error}`);
                await fetchAndDisplayConteoSessionHistory();
            }
        });
    }

    if (btnClearConteo) {
        btnClearConteo.addEventListener('click', async () => {
            if (window.globalIsReaderActive) {
                alert("Detenga la lectura antes de limpiar.");
                return;
            }
            if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("Conteo");
             try {
                const response = await fetch(`${API_BASE_URL_CT}/clear`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if(targetCountInputCT) targetCountInputCT.value = "0";
                    currentTargetForSession = 0;
                    updateConteoStatusBoxes(0,0);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    updateConteoButtonStates();
                } else { alert(`Error al limpiar (Conteo): ${response.status} ${await response.text()}`);}
            } catch (error) { alert(`Error de red al limpiar (Conteo): ${error}`); }
        });
    }

    // Inicialización de la pantalla
    if (document.getElementById('conteoScreenView')) {
        if (window.globalCurrentMode === "Conteo") {
            updateConteoButtonStates();
            if(targetCountInputCT) currentTargetForSession = parseInt(targetCountInputCT.value) || 0;
            if(conteoTargetDisplayEl) conteoTargetDisplayEl.textContent = currentTargetForSession;

            if (!window.globalIsReaderActive) {
                fetchAndDisplayStatusConteo();
            } else {
                startPollingStatusConteo();
            }
        } else {
            updateConteoButtonStates();
            updateConteoStatusBoxes(0,0);
            stopPollingStatusConteo();
        }
        fetchAndDisplayConteoSessionHistory();
    }
}

if (document.getElementById('conteoScreenView')) {
    if (!document.getElementById('conteoScreenView').getAttribute('data-logic-initialized')) {
        document.getElementById('conteoScreenView').setAttribute('data-logic-initialized', 'true');
        initializeConteoLogic();
    }
}