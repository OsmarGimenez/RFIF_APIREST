// js/entrada_salida.js

function initializeEntradaSalidaLogic() {
    console.log("DEBUG: Inicializando lógica y listeners para Entrada/Salida.");

    const API_BASE_URL_ES = window.API_BASE_URL || 'http://localhost:8080/api/tags';

    const btnStartES = document.getElementById('btnStartES');
    const btnStopES = document.getElementById('btnStopES');
    const btnClearES = document.getElementById('btnClearES');
    const btnExportCsvES = document.getElementById('btnExportCsvES'); // Botón para CSV
    const tableBodyES = document.getElementById('tableBodyES');

    let esStatusPollInterval;

    function updateESButtonStates() {
        if (window.globalIsReaderActive && window.globalCurrentMode === "Entrada/Salida") {
            if(btnStartES) btnStartES.disabled = true;
            if(btnStopES) btnStopES.disabled = false;
            if(btnClearES) btnClearES.disabled = true;
            if(btnExportCsvES) btnExportCsvES.disabled = true; // Deshabilitar exportar mientras lee
        } else {
            if(btnStartES) btnStartES.disabled = false;
            if(btnStopES) btnStopES.disabled = true;
            if(btnClearES) btnClearES.disabled = !(window.globalCurrentMode === "Entrada/Salida" && !window.globalIsReaderActive);
            if(btnExportCsvES) btnExportCsvES.disabled = !(window.globalCurrentMode === "Entrada/Salida" && !window.globalIsReaderActive); // Habilitar solo si no está leyendo y es el modo correcto
        }
    }

    async function fetchAndDisplayStatusES() {
        if (window.globalCurrentMode !== "Entrada/Salida") {
            stopPollingStatusES();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL_ES}/status`);
            if (!response.ok) {
                console.error('Error al obtener estado (E/S):', response.status);
                if(tableBodyES) tableBodyES.innerHTML = `<tr><td colspan="7">Error al cargar datos: ${response.status}</td></tr>`;
                return;
            }
            const data = await response.json();

            if (!tableBodyES) {
                console.error("tableBodyES no encontrado en el DOM para E/S.");
                return;
            }
            tableBodyES.innerHTML = '';
            data.forEach(item => {
                const row = tableBodyES.insertRow();
                row.insertCell().textContent = item.id || 'N/A';
                row.insertCell().textContent = item.epc;
                row.insertCell().textContent = item.nombreDelTipoDeEvento || 'N/A';
                row.insertCell().textContent = item.eventTime ? new Date(item.eventTime).toLocaleString() : 'N/A';
                row.insertCell().textContent = item.rssi || 'N/A';
                row.insertCell().textContent = item.antenna || 'N/A';
                row.insertCell().textContent = item.ticket || 'N/A';
            });
        } catch (error) {
            console.error('Error de red al obtener estado (E/S):', error);
             if(tableBodyES) tableBodyES.innerHTML = `<tr><td colspan="7">Error de red al cargar datos.</td></tr>`;
        }
    }

    function startPollingStatusES() {
        stopPollingStatusES();
        if (window.globalCurrentMode === "Entrada/Salida") {
             fetchAndDisplayStatusES();
             esStatusPollInterval = setInterval(fetchAndDisplayStatusES, 3000);
        }
    }

    function stopPollingStatusES() {
        clearInterval(esStatusPollInterval);
    }

    if (btnStartES) {
        btnStartES.addEventListener('click', async () => {
            if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("Entrada/Salida");

            try {
                const response = await fetch(`${API_BASE_URL_ES}/start/entrada-salida`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(true);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, true);

                    updateESButtonStates();
                    // updateGlobalStatusBar se llama dentro de setGlobalReaderActive y updateGlobalUIMode
                    startPollingStatusES();
                } else {
                    alert(`Error al iniciar lectura (E/S): ${response.status} ${await response.text()}`);
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    updateESButtonStates();
                    if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                }
            } catch (error) {
                alert(`Error de red al iniciar lectura (E/S): ${error}`);
                if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                updateESButtonStates();
                if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
            }
        });
    }

    if (btnStopES) {
        btnStopES.addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE_URL_ES}/stop`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    updateESButtonStates();
                    if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                    stopPollingStatusES();
                } else {
                    alert(`Error al detener lectura (E/S): ${response.status} ${await response.text()}`);
                }
            } catch (error) {
                alert(`Error de red al detener lectura (E/S): ${error}`);
            }
        });
    }

    if (btnClearES) {
        btnClearES.addEventListener('click', async () => {
            try {
                // Asegurarse que el modo es Entrada/Salida para la limpieza, TagEventService lo usa
                if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("Entrada/Salida");

                const response = await fetch(`${API_BASE_URL_ES}/clear`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if(tableBodyES) tableBodyES.innerHTML = '';
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    updateESButtonStates();
                } else {
                    alert(`Error al limpiar (E/S): ${response.status} ${await response.text()}`);
                }
            } catch (error) {
                alert(`Error de red al limpiar (E/S): ${error}`);
            }
        });
    }

    if (btnExportCsvES) {
        btnExportCsvES.addEventListener('click', async () => {
            if (window.globalIsReaderActive) {
                alert("Por favor, detenga la lectura antes de exportar.");
                return;
            }
            console.log("Intentando exportar CSV para modo Entrada/Salida...");
            // El endpoint del backend aún no existe, pero esta sería la llamada
            const reportUrl = `${API_BASE_URL_ES}/report/entrada-salida/csv`;
            try {
                const response = await fetch(reportUrl);
                if (!response.ok) {
                    throw new Error(`Error del servidor al generar el reporte: ${response.status} ${response.statusText}`);
                }

                // Obtener el nombre del archivo de la cabecera Content-Disposition
                const disposition = response.headers.get('Content-Disposition');
                let filename = 'reporte_entrada_salida.csv'; // Nombre por defecto
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
                window.URL.revokeObjectURL(downloadUrl); // Liberar el objeto URL
                console.log("Descarga de CSV solicitada.");

            } catch (error) {
                console.error("Error al exportar CSV (E/S):", error);
                alert(`Error al generar el reporte CSV: ${error.message}`);
            }
        });
    }
    // El botón de Exportar Excel fue eliminado del HTML, así que no se necesita su listener aquí.

    // Inicialización de estado y carga de datos
    if (document.getElementById('entradaSalidaScreenView')) {
        // Si la pantalla es cargada, y el modo global ya es este (ej. por un F5 o navegación directa)
        // o si es el modo por defecto al cargar la app.
        if (window.globalCurrentMode === "Entrada/Salida" || window.globalCurrentMode === "Ninguno" /* Podría ser el inicial */) {
            if (typeof window.updateGlobalUIMode === 'function') window.updateGlobalUIMode("Entrada/Salida"); // Asegurar modo en UI
            updateESButtonStates();
            if (!window.globalIsReaderActive) {
                fetchAndDisplayStatusES();
            } else {
                startPollingStatusES();
            }
        } else { // Si el HTML está pero no es el modo activo, solo configura botones y detiene sondeo.
            updateESButtonStates();
            stopPollingStatusES();
        }
    }
}

// Auto-ejecución cuando el script es cargado y el div principal de la pantalla existe.
// app.js se encarga de añadir este script al DOM después de cargar el HTML parcial.
if (document.getElementById('entradaSalidaScreenView')) {
    initializeEntradaSalidaLogic();
}