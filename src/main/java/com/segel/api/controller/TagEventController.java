package com.segel.api.controller;

import com.segel.api.dto.TagEventDTO;
import com.segel.api.dto.RfidEventDetailDTO;
import com.segel.api.service.OperatingMode;
import com.segel.api.service.TagEventService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tags")
public class TagEventController {

    private final TagEventService tagEventService;

    @Autowired
    public TagEventController(TagEventService tagEventService) {
        this.tagEventService = tagEventService;
    }

    // --- Endpoints para Modos de Lectura Específicos ---

    @PostMapping("/start/entrada-salida")
    public ResponseEntity<String> startEntradaSalidaMode() {
        boolean modeSet = tagEventService.setOperatingMode(OperatingMode.ENTRADA_SALIDA, null);
        if (!modeSet) {
            return ResponseEntity.badRequest().body("No se pudo establecer el modo Entrada/Salida.");
        }
        tagEventService.startReading();
        return ResponseEntity.ok("Lectura iniciada (Modo: Entrada/Salida)");
    }

    @PostMapping("/start/list-verification")
    public ResponseEntity<String> startListVerificationMode(@RequestBody List<String> epcs) {
        if (epcs == null || epcs.isEmpty()) {
            return ResponseEntity.badRequest().body("La lista de EPCs no puede estar vacía para el modo Verificación de Lista.");
        }
        boolean modeSet = tagEventService.setOperatingMode(OperatingMode.LIST_VERIFICATION, epcs);
        if (!modeSet) {
            return ResponseEntity.badRequest().body("No se pudo establecer el modo Verificación de Lista o la lista de EPCs es inválida.");
        }
        tagEventService.startReading();
        return ResponseEntity.ok("Lectura iniciada (Modo: Verificación de Lista). EPCs cargados: " + epcs.size());
    }

    @PostMapping("/start/quantity-counting")
    public ResponseEntity<String> startQuantityCountingMode(@RequestParam int targetCount) {
        if (targetCount <= 0) {
            return ResponseEntity.badRequest().body("El conteo objetivo debe ser mayor que cero.");
        }
        boolean modeSet = tagEventService.setOperatingMode(OperatingMode.QUANTITY_COUNTING, targetCount);
        if (!modeSet) {
            return ResponseEntity.badRequest().body("No se pudo establecer el modo Conteo por Cantidad.");
        }
        tagEventService.startReading();
        return ResponseEntity.ok("Lectura iniciada (Modo: Conteo por Cantidad). Objetivo: " + targetCount);
    }

    // --- Endpoints Generales ---

    @PostMapping("/stop")
    public ResponseEntity<String> stopReading() {
        tagEventService.stopReading();
        return ResponseEntity.ok("Lectura detenida");
    }

    @PostMapping("/clear")
    public ResponseEntity<String> clear() {
        tagEventService.clearCurrentModeState();
        return ResponseEntity.ok("Estado del modo actual limpiado");
    }

    @GetMapping("/status")
    public ResponseEntity<List<?>> getTagStatuses() {
        List<?> statuses = tagEventService.getStatuses();
        return ResponseEntity.ok(statuses);
    }

    @GetMapping("/reader-activity")
    public ResponseEntity<Map<String, Object>> getReaderActivity() {
        Map<String, Object> activityStatus = tagEventService.getReaderActivityStatus();
        return ResponseEntity.ok(activityStatus);
    }

    // --- ENDPOINT DE REPORTE CSV CORREGIDO ---
    @GetMapping(value = "/report/entrada-salida/csv", produces = "text/csv") // Ruta actualizada
    public ResponseEntity<String> getCsvReportEntradaSalida() { // Nombre del método puede ser más específico si tienes otros reportes
        // Llama al método del servicio que genera el CSV para el modo actual.
        // El servicio ya sabe cuál es el modo activo. Si quisiéramos un reporte específico
        // independientemente del modo activo, el servicio necesitaría un parámetro de modo.
        String csvData = tagEventService.generateCsvReportForCurrentMode();

        // Verifica si el modo actual es el correcto para este reporte específico.
        // Esto es una doble verificación, ya que el frontend llama a este endpoint específico.
        Map<String, Object> activityStatus = tagEventService.getReaderActivityStatus();
        if (activityStatus.get("activeMode") != OperatingMode.ENTRADA_SALIDA &&
                activityStatus.get("activeMode") != OperatingMode.IDLE && // Permitir si está IDLE pero el último modo FUE E/S
                (activityStatus.get("activeMode") == OperatingMode.IDLE && !csvData.startsWith("Reporte CSV para Modo Entrada/Salida"))) {
            // Si está IDLE pero el csvData no es el esperado para E/S (porque el último modo activo no fue E/S)
            // O si el modo activo no es E/S.
            // Esta lógica podría necesitar refinamiento basado en cómo se quiere que se comporte exactamente.
            // Por ahora, si el servicio devuelve un error, lo pasamos.
        }


        if (csvData.startsWith("Error:") || csvData.contains("no implementado")) {
            return ResponseEntity.badRequest().body("Error al generar el reporte CSV: " + csvData);
        }

        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
        String fileName = "reporte_entrada_salida_" + now.format(formatter) + ".csv";

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
        headers.add(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE + "; charset=utf-8");

        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }
}