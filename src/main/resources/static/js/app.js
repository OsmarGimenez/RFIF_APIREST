// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    window.API_BASE_URL = 'http://localhost:8080/api/tags';

    const sidebarContainer = document.getElementById('sidebar-container');
    const screenPlaceholder = document.getElementById('screen-placeholder');

    const lectorStateElement = document.getElementById('lectorState');
    const currentModeElement = document.getElementById('currentMode');
    const readingDurationElement = document.getElementById('readingDuration');

    window.globalIsReaderActive = false;
    window.globalCurrentMode = "Ninguno";
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
        // Solo actualiza y llama a los demás si hay un cambio real
        if (window.globalIsReaderActive !== isActive) {
            window.globalIsReaderActive = isActive;
            if (!isActive) {
                clearInterval(globalTimerInterval);
                globalSecondsReading = 0;
                // Actualizamos la duración a 0s inmediatamente en la UI si se detiene
                if(readingDurationElement) readingDurationElement.textContent = '0s';
            }
            window.updateGlobalStatusBar(); // Actualiza la barra de estado después de cambiar el estado activo
        } else if (!isActive && globalSecondsReading !== 0) {
            // Si se llama con isActive = false pero ya estaba false, asegurarse que el timer esté limpio y en 0s.
            clearInterval(globalTimerInterval);
            globalSecondsReading = 0;
            if(readingDurationElement) readingDurationElement.textContent = '0s';
            window.updateGlobalStatusBar();
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

    window.updateGlobalUIMode = function(uiModeName) {
        // Esta función es principalmente para que los scripts de pantalla actualicen el modo en la UI.
        // El modo real en el backend se establece a través de los endpoints de inicio.
        if (window.globalCurrentMode !== uiModeName) {
            window.globalCurrentMode = uiModeName;
            console.log(`INFO: Modo UI global cambiado a: ${uiModeName}`);
        }
        window.updateGlobalStatusBar();
    };

    // --- Carga Dinámica de HTML y Scripts ---
    async function loadHTML(filePath, element) { // Renombrado para claridad
        try {
            const response = await fetch(filePath); // Usar filePath directamente
            if (!response.ok) throw new Error(`Error al cargar ${filePath}: ${response.status}`);
            element.innerHTML = await response.text();
            return true; // Indicar éxito
        } catch (error) {
            element.innerHTML = `<p style="color:red;">Error al cargar ${filePath}: ${error.message}</p>`;
            console.error(error);
            return false; // Indicar fallo
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
        // script.onload = () => { // Opcional: llamar a una función init del script cargado
        //     if (screenName === 'lista_esperada' && typeof initializeListaEsperadaLogic === 'function') {
        //         // initializeListaEsperadaLogic(); // El script ya se auto-ejecuta si encuentra su div
        //     }
        // };
        document.body.appendChild(script);
    }

    async function loadScreen(screenName) {
        // Al cambiar de pantalla, es buena idea detener el timer de duración global si estaba activo
        clearInterval(globalTimerInterval);
        globalSecondsReading = 0;
        // El estado globalIsReaderActive y globalCurrentMode se actualizarán mediante syncUIWithBackendStatus
        // o por las acciones del usuario en la nueva pantalla.

        const htmlLoaded = await loadHTML(`partials/${screenName}.html`, screenPlaceholder);
        if (htmlLoaded) {
            loadScreenScript(screenName);
        }
        // Después de cargar la pantalla, sincronizar con el estado del backend
        // para asegurar que la barra de estado y los botones de la nueva pantalla estén correctos.
        await syncUIWithBackendStatus();
    }

    // --- Sincronización con el Estado del Backend ---
    async function syncUIWithBackendStatus() {
        console.log("DEBUG: Sincronizando UI con estado del backend...");
        try {
            const response = await fetch(`${window.API_BASE_URL}/reader-activity`);
            if (!response.ok) {
                console.error("Error al obtener estado de actividad del lector (sync):", response.status);
                window.setGlobalReaderActive(false);
                window.updateGlobalUIMode("Error Conexión Backend"); // Modo UI
                window.updateGlobalReadingDuration(0, false);
                return;
            }
            const activity = await response.json();
            console.log("DEBUG: Estado del backend recibido:", activity);

            window.setGlobalReaderActive(activity.isReading);

            let uiModeName = "Ninguno"; // Modo para mostrar en la UI
            if (activity.activeMode === "ENTRADA_SALIDA") uiModeName = "Entrada/Salida";
            else if (activity.activeMode === "LIST_VERIFICATION") uiModeName = "A Partir de Lista";
            else if (activity.activeMode === "QUANTITY_COUNTING") uiModeName = "Conteo";
            else if (activity.activeMode === "IDLE") uiModeName = "Inactivo"; // Más amigable que "IDLE"

            window.updateGlobalUIMode(uiModeName);

            if (activity.isReading && activity.readingStartTimeMillis > 0) {
                const elapsedSeconds = Math.floor((Date.now() - activity.readingStartTimeMillis) / 1000);
                window.updateGlobalReadingDuration(elapsedSeconds, true);
            } else {
                window.updateGlobalReadingDuration(0, false);
            }

            // Llamar a la función de actualización de botones de la pantalla actual si existe
            // Esto es un poco un "efecto secundario deseado": los scripts de pantalla
            // tienen su propia inicialización que llama a su updateButtonStates.
            // Si la pantalla acaba de cargarse, su script se ejecutará y actualizará sus botones.
            // Si la pantalla ya estaba cargada, esta sincronización actualiza las variables globales,
            // y el polling de estado de esa pantalla (si lo tiene) o la próxima interacción del usuario
            // debería reflejar el estado correcto de los botones.
            // Para una actualización más directa de botones de una pantalla ya cargada, se podría
            // emitir un evento personalizado aquí, o que cada script de pantalla
            // exponga una función `refreshButtonStates()` que app.js pueda llamar.
            // Por ahora, confiaremos en que la inicialización del script de pantalla y sus sondeos
            // internos manejan la actualización de sus botones basados en el estado global.

        } catch (error) {
            console.error("Error de red al sincronizar UI con estado del backend:", error);
            window.setGlobalReaderActive(false);
            window.updateGlobalUIMode("Error de Red");
            window.updateGlobalReadingDuration(0, false);
        }
    }

    // --- Inicialización de la Aplicación ---
    loadHTML('partials/sidebar.html', sidebarContainer).then((sidebarLoaded) => {
        if (!sidebarLoaded || !sidebarContainer.querySelector('.sidebar-content')) {
            console.error("Contenido del sidebar no encontrado o error al cargar.");
            return;
        }
        const navLinks = sidebarContainer.querySelectorAll('.sidebar-content ul li a');
        navLinks.forEach(link => {
            link.addEventListener('click', async (e) => { // Hacemos el listener async
                e.preventDefault();
                const screenToLoad = link.getAttribute('data-screen');
                let targetUIMode = "Ninguno"; // El nombre que se mostrará en la UI
                if (screenToLoad === "entrada_salida") targetUIMode = "Entrada/Salida";
                else if (screenToLoad === "lista_esperada") targetUIMode = "A Partir de Lista";
                else if (screenToLoad === "conteo") targetUIMode = "Conteo";

                if (window.globalIsReaderActive && window.globalCurrentMode !== "Ninguno" && window.globalCurrentMode !== targetUIMode) {
                     alert("Por favor, detenga la lectura actual (" + window.globalCurrentMode + ") antes de cambiar de modo/pantalla.");
                     return;
                }
                // No establecemos el modo global aquí directamente, loadScreen lo hará después de sync.
                await loadScreen(screenToLoad); // Espera a que la pantalla cargue y se sincronice
            });
        });

        // Sincronizar con el estado del backend después de que el DOM esté listo y el sidebar cargado
        syncUIWithBackendStatus().then(() => {
            // Opcional: Cargar una pantalla por defecto
            // Por ejemplo, si window.globalCurrentMode (actualizado por sync) es un modo válido,
            // podríamos intentar cargar esa pantalla.
            // if (window.globalCurrentMode && window.globalCurrentMode !== "Ninguno" && window.globalCurrentMode !== "Inactivo") {
            //    let screenToLoadDefault = "";
            //    if (window.globalCurrentMode === "Entrada/Salida") screenToLoadDefault = "entrada_salida";
            //    // ... mapear otros modos ...
            //    if (screenToLoadDefault) loadScreen(screenToLoadDefault);
            // } else {
            //     if(screenPlaceholder) screenPlaceholder.innerHTML = "<p>Selecciona una opción del menú para comenzar.</p>";
            // }
        });

    }).catch(error => {
        sidebarContainer.innerHTML = `<p style="color:red;">Error crítico al cargar sidebar: ${error.message}</p>`;
    });

    window.updateGlobalStatusBar(); // Actualización inicial de la barra de estado
});