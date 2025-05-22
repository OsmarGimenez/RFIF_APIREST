package com.segel.api.controller;

import com.segel.api.dto.RfidEventDetailDTO;
import com.segel.api.dto.TagEventDTO;
import com.segel.api.dto.UpdateDescriptionRequestDTO; // Importar el nuevo DTO
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

    @GetMapping(value = "/report/entrada-salida/csv", produces = "text/csv")
    public ResponseEntity<String> getCsvReportEntradaSalida() {
        String csvData = tagEventService.generateCsvReportForCurrentMode();
        if (csvData.startsWith("Error:") || csvData.contains("no implementado")) {
            return ResponseEntity.badRequest().body("Error al generar el reporte CSV: " + csvData);
        }
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
        String fileName = "reporte_entrada_salida_" + now.format(formatter) + ".csv";
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
        headers.add(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE + "; charset=utf-8");
        return ResponseEntity.ok().headers(headers).body(csvData);
    }

    // --- NUEVO ENDPOINT PARA ACTUALIZAR DESCRIPCIÓN ---
    @PutMapping("/events/{eventId}/description")
    public ResponseEntity<?> updateEventDescription(
            @PathVariable Long eventId,
            @RequestBody UpdateDescriptionRequestDTO request) {
        try {
            boolean updated = tagEventService.updateEventDescription(eventId, request.getDescripcion());
            if (updated) {
                return ResponseEntity.ok().body(Map.of("message", "Descripción actualizada correctamente."));
            } else {
                return ResponseEntity.notFound().build(); // O un mensaje de error más específico
            }
        } catch (Exception e) {
            // Loguear la excepción e.printStackTrace(); o con un logger
            System.err.println("Error al actualizar descripción para evento ID " + eventId + ": " + e.getMessage());
            return ResponseEntity.internalServerError().body("Error al actualizar la descripción.");
        }
    }
}