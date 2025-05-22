// js/conteo.js

function initializeConteoLogic() {
    console.log("DEBUG: Inicializando lógica y listeners para Conteo por Cantidad.");

    const API_BASE_URL_CONTEO = window.API_BASE_URL || 'http://localhost:8080/api/tags';

    // Elementos específicos de esta pantalla (asegúrate que los IDs coincidan con tu conteo.html)
    const targetCountInput = document.getElementById('targetCountInput');
    const btnStartConteo = document.getElementById('btnStartConteo');
    const btnStopConteo = document.getElementById('btnStopConteo');

    const conteoCurrentReadDisplay = document.getElementById('conteoCurrentRead');
    const conteoRemainingOrExcessDisplay = document.getElementById('conteoRemainingOrExcess');
    const conteoTargetDisplay = document.getElementById('conteoTargetDisplay');
    // const tableBodyConteoEpcs = document.getElementById('tableBodyConteoEpcs'); // Si decides usar la tabla opcional

    let conteoStatusPollInterval;
    let conteoTimerInterval; // Timer específico para esta pantalla si es necesario, o usar el global
    let conteoSecondsReading = 0;
    let currentTargetCount = 0;

    function updateConteoButtonStates() {
        if (window.globalIsReaderActive && window.globalCurrentMode === "Conteo") {
            if(targetCountInput) targetCountInput.disabled = true;
            if(btnStartConteo) btnStartConteo.disabled = true;
            if(btnStopConteo) btnStopConteo.disabled = false;
        } else {
            if(targetCountInput) targetCountInput.disabled = false;
            if(btnStartConteo) btnStartConteo.disabled = false;
            if(btnStopConteo) btnStopConteo.disabled = true;
        }
    }

    async function fetchAndDisplayStatusConteo() {
        if (window.globalCurrentMode !== "Conteo") {
            stopPollingStatusConteo();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL_CONTEO}/status`);
            if (!response.ok) {
                console.error('Error al obtener estado (Conteo):', response.status);
                // Actualizar UI con mensaje de error si es necesario
                if(conteoCurrentReadDisplay) conteoCurrentReadDisplay.textContent = 'Error';
                if(conteoRemainingOrExcessDisplay) conteoRemainingOrExcessDisplay.textContent = 'Error';
                return;
            }
            const data = await response.json(); // Esperamos List<TagEventDTO> simples para conteo

            let target = 0;
            let current = 0;
            let remainingOrExcess = 0;

            data.forEach(item => {
                if (item.epc === "TargetCount") target = parseInt(item.status) || 0;
                if (item.epc === "CurrentReadCount") current = parseInt(item.status) || 0;
                if (item.epc === "RemainingOrExcess") remainingOrExcess = parseInt(item.status) || 0;
            });

            if(conteoTargetDisplay) conteoTargetDisplay.textContent = target;
            if(conteoCurrentReadDisplay) conteoCurrentReadDisplay.textContent = current;
            if(conteoRemainingOrExcessDisplay) conteoRemainingOrExcessDisplay.textContent = remainingOrExcess;

            // Lógica para la tabla opcional de EPCs leídos (requeriría que /status devuelva más detalle para este modo)
            // if (tableBodyConteoEpcs && data.epcs) { // Asumiendo que 'data.epcs' es un array de EPCs
            //     tableBodyConteoEpcs.innerHTML = '';
            //     data.epcs.forEach(epc => {
            //         const row = tableBodyConteoEpcs.insertRow();
            //         row.insertCell().textContent = epc;
            //     });
            // }

        } catch (error) {
            console.error('Error de red al obtener estado (Conteo):', error);
            if(conteoCurrentReadDisplay) conteoCurrentReadDisplay.textContent = 'Error Red';
            if(conteoRemainingOrExcessDisplay) conteoRemainingOrExcessDisplay.textContent = 'Error Red';
        }
    }

    function startPollingStatusConteo() {
        stopPollingStatusConteo();
        if (window.globalCurrentMode === "Conteo") {
             fetchAndDisplayStatusConteo();
             conteoStatusPollInterval = setInterval(fetchAndDisplayStatusConteo, 2000); // Actualiza cada 2 segundos
        }
    }

    function stopPollingStatusConteo() {
        clearInterval(conteoStatusPollInterval);
    }

    if (btnStartConteo) {
        btnStartConteo.addEventListener('click', async () => {
            if (!targetCountInput) {
                alert("Input para conteo objetivo no encontrado.");
                return;
            }
            currentTargetCount = parseInt(targetCountInput.value);
            if (isNaN(currentTargetCount) || currentTargetCount <= 0) {
                alert("Por favor, ingrese un conteo objetivo válido (mayor que 0).");
                return;
            }

            // if (typeof window.setCurrentGlobalMode === 'function') window.setCurrentGlobalMode("Conteo", currentTargetCount, false);

            try {
                const response = await fetch(`${API_BASE_URL_CONTEO}/start/quantity-counting?targetCount=${currentTargetCount}`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(true);
                    conteoSecondsReading = 0;
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(conteoSecondsReading, true);

                    updateConteoButtonStates();
                    if (typeof window.updateGlobalStatusBar === 'function') {
                        window.globalCurrentMode = "Conteo"; // Asegurar que el modo global se setea
                        window.updateGlobalStatusBar();
                    }
                    if(conteoTargetDisplay) conteoTargetDisplay.textContent = currentTargetCount; // Actualizar UI inmediatamente
                    startPollingStatusConteo();
                } else {
                    alert(`Error al iniciar lectura (Conteo): ${response.status} ${await response.text()}`);
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    updateConteoButtonStates();
                    if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                }
            } catch (error) {
                alert(`Error de red al iniciar lectura (Conteo): ${error}`);
                 if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                updateConteoButtonStates();
                if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
            }
        });
    }

    if (btnStopConteo) {
        btnStopConteo.addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE_URL_CONTEO}/stop`, { method: 'POST' });
                if (response.ok) {
                    console.log(await response.text());
                    if (typeof window.setGlobalReaderActive === 'function') window.setGlobalReaderActive(false);
                    if (typeof window.updateGlobalReadingDuration === 'function') window.updateGlobalReadingDuration(0, false);
                    updateConteoButtonStates();
                     if (typeof window.updateGlobalStatusBar === 'function') window.updateGlobalStatusBar();
                    stopPollingStatusConteo();
                    // Obtener el estado final una vez más después de detener
                    setTimeout(fetchAndDisplayStatusConteo, 100);
                } else {
                    alert(`Error al detener lectura (Conteo): ${response.status} ${await response.text()}`);
                }
            } catch (error) {
                alert(`Error de red al detener lectura (Conteo): ${error}`);
            }
        });
    }

    // Estado inicial
    if (window.globalCurrentMode === "Conteo") {
        updateConteoButtonStates();
        if (!window.globalIsReaderActive) {
            // Si el modo conteo estaba activo pero no leyendo, podría cargar el último estado de conteo
            fetchAndDisplayStatusConteo();
        } else {
            startPollingStatusConteo();
        }
    }
    updateConteoButtonStates();
}

// Auto-ejecución si el HTML está presente
if (document.getElementById('conteoScreenView')) { // Asegúrate que este ID exista en tu conteo.html
    initializeConteoLogic();
}