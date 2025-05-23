package com.segel.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.segel.api.dto.RfidEventDetailDTO;
import com.segel.api.model.LecturaListaSesionEntity;
import com.segel.api.model.RfidEventEntity;
import com.segel.api.model.TipoEventoEntity;
import com.segel.api.persistence.LecturaListaSesionRepository;
import com.segel.api.persistence.RfidEventRepository;
import com.segel.api.persistence.TipoEventoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter; // Para formatear fechas en CSV
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ListVerificationLogicService {

    private final RfidEventRepository rfidEventRepository;
    private final TipoEventoRepository tipoEventoRepository;
    private final LecturaListaSesionRepository lecturaListaSesionRepository;
    private final ObjectMapper objectMapper;

    private final Map<String, String> epcStatusMap = new ConcurrentHashMap<>();
    private final Set<String> expectedEpcSetInternal = Collections.synchronizedSet(new HashSet<>());
    private final Set<String> readAndVerifiedEpcSet = Collections.synchronizedSet(new HashSet<>());
    private LecturaListaSesionEntity currentSession;

    private static final String EVENT_NAME_LISTA_CONFIRMADO = "Lista - Confirmado";
    private static final String EVENT_NAME_LISTA_NO_ESPERADO = "Lista - No Esperado";
    private static final String EVENT_NAME_LISTA_PENDIENTE = "Lista - Pendiente";
    private static final DateTimeFormatter CSV_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");


    @Autowired
    public ListVerificationLogicService(RfidEventRepository rfidEventRepository,
                                        TipoEventoRepository tipoEventoRepository,
                                        LecturaListaSesionRepository lecturaListaSesionRepository,
                                        ObjectMapper objectMapper) {
        this.rfidEventRepository = rfidEventRepository;
        this.tipoEventoRepository = tipoEventoRepository;
        this.lecturaListaSesionRepository = lecturaListaSesionRepository;
        this.objectMapper = objectMapper;
    }

    public void prepareNewListSession(List<String> epcs) {
        clearStateForNewSession();
        if (epcs != null) {
            for (String epc : epcs) {
                if (epc != null && !epc.trim().isEmpty()) {
                    String normalizedEpc = epc.trim();
                    expectedEpcSetInternal.add(normalizedEpc);
                    epcStatusMap.put(normalizedEpc, "rojo");
                }
            }
        }
        System.out.println("INFO (List Logic): Preparada nueva sesión de lista con " + expectedEpcSetInternal.size() + " EPCs esperados. Estado inicial: ROJO.");
    }

    @Transactional
    public boolean startCurrentListSession() {
        if (expectedEpcSetInternal.isEmpty()) {
            System.err.println("ERROR (List Logic): No hay EPCs esperados para iniciar la sesión de lista.");
            return false;
        }
        if (this.currentSession != null && this.currentSession.getFechaHoraFin() == null) {
            System.err.println("WARN (List Logic): Ya hay una sesión de lista activa (ID: " + this.currentSession.getSesionId() + "). No se iniciará una nueva.");
            return true;
        }
        String epcsSerializados = "";
        try {
            epcsSerializados = objectMapper.writeValueAsString(new ArrayList<>(expectedEpcSetInternal));
        } catch (JsonProcessingException e) {
            System.err.println("ERROR (List Logic): No se pudo serializar la lista de EPCs esperados. " + e.getMessage());
        }
        this.currentSession = new LecturaListaSesionEntity(LocalDateTime.now(), expectedEpcSetInternal.size(), epcsSerializados);
        this.currentSession = lecturaListaSesionRepository.save(this.currentSession);
        System.out.println("INFO (List Logic): Nueva sesión de lista iniciada. ID Sesión: " + this.currentSession.getSesionId());
        return true;
    }

    @Transactional
    public void processTag(String epc, String rssi, String antenna) {
        // ... (código existente sin cambios)
        if (this.currentSession == null || this.currentSession.getSesionId() == null) {
            System.err.println("ERROR (List Logic): No hay una sesión de lista activa para procesar el tag EPC: " + epc);
            return;
        }
        if (epc == null || epc.trim().isEmpty()) {
            return;
        }
        String normalizedEpc = epc.trim();
        String currentEventColor;
        String eventDescription = null;
        String eventTypeName;
        Optional<TipoEventoEntity> optTipoEvento;

        if (expectedEpcSetInternal.contains(normalizedEpc)) {
            if (!readAndVerifiedEpcSet.contains(normalizedEpc)) {
                currentEventColor = "verde";
                eventTypeName = EVENT_NAME_LISTA_CONFIRMADO;
                optTipoEvento = tipoEventoRepository.findByNombreEvento(eventTypeName);

                if (optTipoEvento.isEmpty()) {
                    System.err.println("ERROR (List Logic): Tipo de evento '" + eventTypeName + "' no encontrado. EPC: " + normalizedEpc);
                    return;
                }
                epcStatusMap.put(normalizedEpc, currentEventColor);
                readAndVerifiedEpcSet.add(normalizedEpc);

                RfidEventEntity event = new RfidEventEntity(normalizedEpc, optTipoEvento.get(), LocalDateTime.now(), rssi, antenna, "No asignado", currentEventColor, eventDescription);
                event.setSesion(this.currentSession);
                rfidEventRepository.save(event);
                System.out.println("INFO (List Logic): Tag esperado EPC: " + normalizedEpc + ". Marcado como VERDE. Persistido con estadoColor: " + currentEventColor + " y SesionID: " + this.currentSession.getSesionId());
            }
        } else {
            currentEventColor = "amarillo";
            eventTypeName = EVENT_NAME_LISTA_NO_ESPERADO;

            if (!epcStatusMap.containsKey(normalizedEpc) || !"amarillo".equals(epcStatusMap.get(normalizedEpc))) {
                optTipoEvento = tipoEventoRepository.findByNombreEvento(eventTypeName);
                if (optTipoEvento.isEmpty()) {
                    System.err.println("ERROR (List Logic): Tipo de evento '" + eventTypeName + "' no encontrado. EPC: " + normalizedEpc);
                    return;
                }
                epcStatusMap.put(normalizedEpc, currentEventColor);
                RfidEventEntity event = new RfidEventEntity(normalizedEpc, optTipoEvento.get(), LocalDateTime.now(), rssi, antenna, "No asignado", currentEventColor, eventDescription);
                event.setSesion(this.currentSession);
                rfidEventRepository.save(event);
                System.out.println("INFO (List Logic): Tag NO esperado EPC: " + normalizedEpc + ". Marcado como AMARILLO. Persistido con estadoColor: " + currentEventColor + " y SesionID: " + this.currentSession.getSesionId());
            }
        }
    }

    @Transactional
    public void concludeCurrentListSession() {
        // ... (código existente sin cambios)
        if (this.currentSession != null && this.currentSession.getFechaHoraFin() == null) {
            this.currentSession.setFechaHoraFin(LocalDateTime.now());
            long coincidentes = readAndVerifiedEpcSet.size();
            long noCorresponden = getNotExpectedCount();
            long pendientes = expectedEpcSetInternal.size() - coincidentes;

            this.currentSession.setTotalCoincidentes((int) coincidentes);
            this.currentSession.setTotalPendientes((int) pendientes);
            this.currentSession.setTotalNoCorresponden((int) noCorresponden);
            lecturaListaSesionRepository.save(this.currentSession);
            System.out.println("INFO (List Logic): Sesión de lista ID: " + this.currentSession.getSesionId() + " concluida. Esperados: " + this.currentSession.getTotalEsperado() + ", Coincidentes: " + coincidentes + ", Pendientes: " + pendientes + ", No Corresponden: " + noCorresponden);
        } else {
            System.out.println("INFO (List Logic): No hay sesión de lista activa para concluir o ya fue concluida.");
        }
    }

    public void clearStateForNewSession() {
        // ... (código existente sin cambios)
        epcStatusMap.clear();
        expectedEpcSetInternal.clear();
        readAndVerifiedEpcSet.clear();
        this.currentSession = null;
        System.out.println("INFO (List Logic): Estados en memoria para nueva sesión limpiados.");
    }

    public List<RfidEventDetailDTO> getCurrentEventDetails() {
        // ... (código existente sin cambios)
        List<RfidEventDetailDTO> dtoList = new ArrayList<>();
        Map<String, RfidEventEntity> latestEventsForEpcInSessionMap = new HashMap<>();

        if (this.currentSession != null && this.currentSession.getSesionId() != null) {
            List<RfidEventEntity> eventsInSession = rfidEventRepository.findBySesion_SesionIdOrderByEventTimeDesc(this.currentSession.getSesionId());
            for (RfidEventEntity event : eventsInSession) {
                latestEventsForEpcInSessionMap.putIfAbsent(event.getEpc(), event);
            }
        }

        for (String epc : expectedEpcSetInternal) {
            epcStatusMap.putIfAbsent(epc, "rojo");
        }

        for (Map.Entry<String, String> entry : epcStatusMap.entrySet()) {
            String epc = entry.getKey();
            String colorStatus = entry.getValue();
            RfidEventEntity eventEntity = latestEventsForEpcInSessionMap.get(epc);

            if (eventEntity != null) {
                dtoList.add(new RfidEventDetailDTO(
                        eventEntity.getId(), epc, eventEntity.getEventTime(), eventEntity.getRssi(),
                        eventEntity.getAntenna(), eventEntity.getTicket(),
                        colorStatus,
                        eventEntity.getDescripcion(),
                        eventEntity.getTipoEvento() != null ? eventEntity.getTipoEvento().getNombreEvento() : "N/A",
                        eventEntity.getTipoEvento() != null ? eventEntity.getTipoEvento().getDescripcionTipo() : "N/A"
                ));
            } else {
                String tipoEventoNombre = "N/A";
                String tipoEventoDesc = "N/A";
                if ("rojo".equals(colorStatus)) {
                    tipoEventoNombre = EVENT_NAME_LISTA_PENDIENTE;
                    tipoEventoDesc = "EPC esperado, aún no leído en esta sesión.";
                } else if ("amarillo".equals(colorStatus) && !expectedEpcSetInternal.contains(epc)) {
                    tipoEventoNombre = EVENT_NAME_LISTA_NO_ESPERADO;
                    tipoEventoDesc = "EPC no esperado (estado en memoria).";
                }
                dtoList.add(new RfidEventDetailDTO(null, epc, null, null, null, null,
                        colorStatus, null, tipoEventoNombre, tipoEventoDesc));
            }
        }
        return dtoList;
    }

    public long getExpectedCount() { return expectedEpcSetInternal.size(); }
    public long getReadAndVerifiedCount() { return readAndVerifiedEpcSet.size(); }
    public long getNotExpectedCount() {
        // ... (código existente sin cambios)
        long count = 0;
        for(Map.Entry<String, String> entry : epcStatusMap.entrySet()){
            if("amarillo".equals(entry.getValue()) && !expectedEpcSetInternal.contains(entry.getKey())){
                count++;
            }
        }
        return count;
    }

    // --- NUEVO MÉTODO PARA GENERAR CSV ---
    public String generateCsvReportString() {
        List<RfidEventDetailDTO> eventsDetails = getCurrentEventDetails(); // Obtiene los datos detallados actuales
        StringBuilder csvBuilder = new StringBuilder();

        // Encabezado del CSV para el modo "A Partir de Lista"
        // ID Evento, EPC, Hora Evento, Tipo Evento, Estado Semáforo, RSSI, Antena, Ticket, Descripción
        csvBuilder.append("ID Evento,EPC,Hora Evento,Tipo Evento,Estado Semáforo,RSSI,Antena,Ticket,Descripción\n");

        for (RfidEventDetailDTO dto : eventsDetails) {
            csvBuilder.append(escapeCsvField(dto.getId() != null ? dto.getId().toString() : "")).append(",");
            csvBuilder.append(escapeCsvField(dto.getEpc())).append(",");
            csvBuilder.append(escapeCsvField(dto.getEventTime() != null ? dto.getEventTime().format(CSV_DATE_TIME_FORMATTER) : "")).append(",");
            csvBuilder.append(escapeCsvField(dto.getNombreDelTipoDeEvento())).append(",");
            csvBuilder.append(escapeCsvField(dto.getEstadoColor())).append(","); // "rojo", "verde", "amarillo"
            csvBuilder.append(escapeCsvField(dto.getRssi())).append(",");
            csvBuilder.append(escapeCsvField(dto.getAntenna())).append(",");
            csvBuilder.append(escapeCsvField(dto.getTicket())).append(",");
            csvBuilder.append(escapeCsvField(dto.getDescripcion()));
            csvBuilder.append("\n");
        }
        return csvBuilder.toString();
    }

    private String escapeCsvField(String data) {
        if (data == null) {
            return "";
        }
        String escapedData = data.replace("\"", "\"\"");
        if (data.contains(",") || data.contains("\"") || data.contains("\n")) {
            escapedData = "\"" + escapedData + "\"";
        }
        return escapedData;
    }
}