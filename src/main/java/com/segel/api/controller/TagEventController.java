package com.segel.api.controller;

import com.segel.api.dto.RfidEventDetailDTO;
import com.segel.api.dto.TagEventDTO;
import com.segel.api.dto.UpdateDescriptionRequestDTO;
import com.segel.api.model.LecturaConteoSesionEntity; // Importar la entidad de sesión de conteo
import com.segel.api.model.LecturaListaSesionEntity;
import com.segel.api.service.OperatingMode;
import com.segel.api.service.TagEventService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
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

    @PutMapping("/events/{eventId}/description")
    public ResponseEntity<?> updateEventDescription(
            @PathVariable Long eventId,
            @RequestBody UpdateDescriptionRequestDTO request) {
        try {
            boolean updated = tagEventService.updateEventDescription(eventId, request.getDescripcion());
            if (updated) {
                return ResponseEntity.ok().body(Map.of("message", "Descripción actualizada correctamente."));
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            System.err.println("Error al actualizar descripción para evento ID " + eventId + ": " + e.getMessage());
            return ResponseEntity.internalServerError().body("Error al actualizar la descripción.");
        }
    }

    // --- Endpoints para Historial de Sesiones de Lista ---
    @GetMapping("/list-verification/sessions")
    public ResponseEntity<List<LecturaListaSesionEntity>> getListVerificationSessions() {
        List<LecturaListaSesionEntity> sessions = tagEventService.getAllListVerificationSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/list-verification/sessions/{sesionId}/details")
    public ResponseEntity<List<RfidEventDetailDTO>> getListVerificationSessionDetails(@PathVariable Long sesionId) {
        List<RfidEventDetailDTO> eventDetails = tagEventService.getListVerificationSessionDetails(sesionId);
        if (eventDetails == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(eventDetails);
    }

    // --- Endpoints para Historial de Sesiones de Conteo ---
    @GetMapping("/quantity-counting/sessions")
    public ResponseEntity<List<LecturaConteoSesionEntity>> getQuantityCountingSessions() {
        List<LecturaConteoSesionEntity> sessions = tagEventService.getAllQuantityCountingSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/quantity-counting/sessions/{sesionConteoId}/details")
    public ResponseEntity<List<RfidEventDetailDTO>> getQuantityCountingSessionDetails(@PathVariable Long sesionConteoId) {
        List<RfidEventDetailDTO> eventDetails = tagEventService.getQuantityCountingSessionDetails(sesionConteoId);
        if (eventDetails == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(eventDetails);
    }


    // --- Endpoints de Reporte ---
    @GetMapping(value = "/report/entrada-salida/csv", produces = "text/csv")
    public ResponseEntity<String> getCsvReportEntradaSalida() {
        String csvData = tagEventService.generateCsvReportForCurrentMode();
        if (csvData.startsWith("Error:") || !csvData.contains("EPC")) {
            return ResponseEntity.badRequest().body("Error al generar el reporte CSV para Entrada/Salida: " + csvData);
        }
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
        String fileName = "reporte_entrada_salida_" + now.format(formatter) + ".csv";
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
        headers.add(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE + "; charset=utf-8");
        return ResponseEntity.ok().headers(headers).body(csvData);
    }

    @GetMapping(value = "/report/list-verification/csv", produces = "text/csv")
    public ResponseEntity<String> getCsvReportListVerification() {
        String csvData = tagEventService.generateCsvReportForCurrentMode();
        if (csvData.startsWith("Error:") || csvData.contains("no implementado") || !csvData.contains("EPC")) {
            return ResponseEntity.badRequest().body("Error al generar el reporte CSV para la sesión actual de Verificación de Lista: " + csvData);
        }
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
        String fileName = "reporte_sesion_actual_lista_" + now.format(formatter) + ".csv";
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
        headers.add(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE + "; charset=utf-8");
        return ResponseEntity.ok().headers(headers).body(csvData);
    }

    @GetMapping(value = "/list-verification/sessions/{sesionId}/report/csv", produces = "text/csv")
    public ResponseEntity<String> getCsvReportForHistoricalSession(@PathVariable Long sesionId) {
        String csvData = tagEventService.generateCsvReportForHistoricalSession(sesionId);
        if (csvData == null || csvData.startsWith("Error:") || !csvData.contains("EPC")) {
            return ResponseEntity.badRequest().body("Error al generar el reporte CSV para la sesión histórica ID " + sesionId + ": " + (csvData != null ? csvData : "Datos no encontrados."));
        }
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
        String fileName = "reporte_sesion_historica_lista_" + sesionId + "_" + now.format(formatter) + ".csv"; // Ajustado nombre
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
        headers.add(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE + "; charset=utf-8");
        return ResponseEntity.ok().headers(headers).body(csvData);
    }

    // --- Podríamos añadir aquí los endpoints para reportes de sesiones de conteo si son necesarios ---
}