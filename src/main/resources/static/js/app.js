// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    window.API_BASE_URL = 'http://localhost:8080/api/tags'; // Ajusta si es necesario

    const sidebarContainer = document.getElementById('sidebar-container');
    const screenPlaceholder = document.getElementById('screen-placeholder');

    const lectorStateElement = document.getElementById('lectorState');
    const currentModeElement = document.getElementById('currentMode');
    const readingDurationElement = document.getElementById('readingDuration');

    window.globalIsReaderActive = false;
    window.globalCurrentMode = "Ninguno"; // Representa el nombre del modo para la UI
    let globalTimerInterval;
    let globalSecondsReading = 0;

    // --- Funciones Globales de UI y Estado ---
    window.updateGlobalStatusBar = function() {
        if(lectorStateElement) lectorStateElement.textContent = window.globalIsReaderActive ? 'Activa' : 'Inactiva';
        if(currentModeElement) currentModeElement.textContent = window.globalCurrentMode;
        if (!window.globalIsReaderActive && readingDurationElement) {
            readingDurationElement.textContent = '0s';
        }
    }

    window.setGlobalReaderActive = function(isActive) {
        if (window.globalIsReaderActive !== isActive) { // Solo actualiza si hay un cambio real
            window.globalIsReaderActive = isActive;
            if (!isActive) { // Si se detiene la lectura
                clearInterval(globalTimerInterval);
                globalSecondsReading = 0;
            }
            // La barra de estado se actualizará cuando se llame a updateGlobalStatusBar
        }
    }

    window.updateGlobalReadingDuration = function(seconds, startTimerIfNeeded) {
        globalSecondsReading = seconds;
        if(readingDurationElement) readingDurationElement.textContent = `${globalSecondsReading}s`;

        clearInterval(globalTimerInterval);
        if (startTimerIfNeeded && window.globalIsReaderActive) {
            globalTimerInterval = setInterval(() => {
                globalSecondsReading++;
                if(readingDurationElement) readingDurationElement.textContent = `${globalSecondsReading}s`;
            }, 1000);
        }
    }

    // Esta función es llamada por los botones de inicio de cada pantalla específica.
    // El backend es la fuente de verdad para el modo de operación.
    // Esta función de JS solo actualiza la UI.
    window.updateGlobalUIMode = function(uiModeName) {
        window.globalCurrentMode = uiModeName;
        window.updateGlobalStatusBar();
    };

    // --- Carga Dinámica de HTML y Scripts ---
    async function loadHTML(url, element) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error al cargar ${url}: ${response.status}`);
            element.innerHTML = await response.text();
        } catch (error) {
            element.innerHTML = `<p style="color:red;">${error.message}</p>`;
            console.error(error);
        }
    }

    function loadScreenScript(screenName) {
        const scriptId = `script-${screenName}`;
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
            existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `js/${screenName}.js`;
        script.onerror = () => console.error(`Error al cargar el script: js/${screenName}.js`);
        document.body.appendChild(script);
    }

    async function loadScreen(screenName) {
        // Detener timers/sondeos de la pantalla anterior (si los scripts específicos no lo hacen al ser removidos)
        clearInterval(globalTimerInterval); // Detiene el timer de duración global
        // Los intervalos de sondeo de estado son manejados por los scripts específicos de pantalla y
        // deberían detenerse cuando el modo global ya no coincide con su modo.

        await loadHTML(`partials/${screenName}.html`, screenPlaceholder);
        loadScreenScript(screenName); // Carga el JS después que el HTML esté en el DOM

        // El script de pantalla (ej. entrada_salida.js) ahora es responsable de
        // actualizar window.globalCurrentMode (a través de window.updateGlobalUIMode si es necesario)
        // y de llamar a updateGlobalStatusBar.
        // También son responsables de llamar a su propia función de updateButtonStates.
    }

    // --- Sincronización con el Estado del Backend ---
    async function syncUIWithBackendStatus() {
        console.log("DEBUG: Sincronizando UI con estado del backend...");
        try {
            const response = await fetch(`${window.API_BASE_URL}/reader-activity`);
            if (!response.ok) {
                console.error("Error al obtener estado de actividad del lector (sync):", response.status);
                window.setGlobalReaderActive(false); // Asumir inactivo si hay error
                window.updateGlobalUIMode("Error de Conexión");
                window.updateGlobalReadingDuration(0, false);
                return;
            }
            const activity = await response.json();

            window.setGlobalReaderActive(activity.isReading);

            let uiModeName = "Ninguno";
            if (activity.activeMode === "ENTRADA_SALIDA") uiModeName = "Entrada/Salida";
            else if (activity.activeMode === "LIST_VERIFICATION") uiModeName = "A Partir de Lista";
            else if (activity.activeMode === "QUANTITY_COUNTING") uiModeName = "Conteo";
            else if (activity.activeMode === "IDLE") uiModeName = "Inactivo (Backend)";

            window.updateGlobalUIMode(uiModeName);

            if (activity.isReading && activity.readingStartTimeMillis > 0) {
                const elapsedSeconds = Math.floor((Date.now() - activity.readingStartTimeMillis) / 1000);
                window.updateGlobalReadingDuration(elapsedSeconds, true);
            } else {
                window.updateGlobalReadingDuration(0, false);
            }

            console.log("DEBUG: Estado del backend sincronizado:", activity);

            // Forzar actualización de botones de la pantalla actual si está cargada
            // Esto es un poco un hack. Idealmente, los scripts de pantalla escucharían un evento global de cambio de estado.
            const currentScreenViewId = screenPlaceholder.querySelector('div[id$="ScreenView"]')?.id;
            if (currentScreenViewId) {
                if (currentScreenViewId === 'entradaSalidaScreenView' && typeof initializeEntradaSalidaLogic === 'function') {
                    // Re-llamar a la inicialización para que actualice sus botones y estado
                    // initializeEntradaSalidaLogic(); // Esto podría causar problemas si añade listeners duplicados
                    // Mejor es que cada script de pantalla exponga una función tipo 'refreshUI()'
                }
                // Similar para otros... por ahora, los scripts de pantalla se auto-actualizan
                // en su inicialización o a través de sus propios sondeos de estado.
            }


        } catch (error) {
            console.error("Error de red al sincronizar UI con estado del backend:", error);
            window.setGlobalReaderActive(false);
            window.updateGlobalUIMode("Error de Red");
            window.updateGlobalReadingDuration(0, false);
        }
    }


    // --- Inicialización de la Aplicación ---
    loadHTML('partials/sidebar.html', sidebarContainer).then(() => {
        if (!sidebarContainer.querySelector('.sidebar-content')) {
            console.error("Contenido del sidebar no encontrado tras la carga.");
            return;
        }
        const navLinks = sidebarContainer.querySelectorAll('.sidebar-content ul li a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const screenToLoad = link.getAttribute('data-screen');
                let targetUIMode = "Ninguno";
                if (screenToLoad === "entrada_salida") targetUIMode = "Entrada/Salida";
                else if (screenToLoad === "lista_esperada") targetUIMode = "A Partir de Lista";
                else if (screenToLoad === "conteo") targetUIMode = "Conteo";

                if (window.globalIsReaderActive && window.globalCurrentMode !== "Ninguno" && window.globalCurrentMode !== targetUIMode) {
                     alert("Por favor, detenga la lectura actual (" + window.globalCurrentMode + ") antes de cambiar de modo/pantalla.");
                     return;
                }
                // Actualiza el modo global de la UI inmediatamente al hacer clic,
                // antes de que el backend lo confirme o la pantalla cargue su lógica.
                window.updateGlobalUIMode(targetUIMode);
                loadScreen(screenToLoad);
            });
        });

        // Sincronizar con el estado del backend después de que el DOM esté listo y el sidebar cargado
        syncUIWithBackendStatus().then(() => {
            // Opcional: Cargar una pantalla por defecto después de sincronizar
            // Por ejemplo, si el backend dice que está en modo ENTRADA_SALIDA, cargar esa pantalla.
            // O simplemente dejar al usuario que elija.
            // if (window.globalCurrentMode === "Entrada/Salida") {
            //     loadScreen('entrada_salida');
            // } else {
            //      screenPlaceholder.innerHTML = "<p>Selecciona una opción del menú para comenzar.</p>";
            // }
        });

    }).catch(error => {
        sidebarContainer.innerHTML = `<p style="color:red;">Error crítico al cargar sidebar: ${error.message}</p>`;
    });

    // Actualización inicial de la barra de estado
    window.updateGlobalStatusBar();
});