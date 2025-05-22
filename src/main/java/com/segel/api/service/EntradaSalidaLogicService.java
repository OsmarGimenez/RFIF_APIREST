package com.segel.api.service;

import com.segel.api.dto.RfidEventDetailDTO;
import com.segel.api.model.RfidEventEntity;
import com.segel.api.model.TipoEventoEntity;
import com.segel.api.persistence.RfidEventRepository;
import com.segel.api.persistence.TipoEventoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter; // Para formatear fechas
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class EntradaSalidaLogicService {

    private final RfidEventRepository rfidEventRepository;
    private final TipoEventoRepository tipoEventoRepository;

    private final Map<String, String> epcLastEventTypeMap = new ConcurrentHashMap<>();
    private final Map<String, Long> epcLastProcessedTimeMap = new ConcurrentHashMap<>();

    private static final long READ_PROCESSING_DELAY_MS = 20000;
    private static final DateTimeFormatter CSV_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");


    @Autowired
    public EntradaSalidaLogicService(RfidEventRepository rfidEventRepository,
                                     TipoEventoRepository tipoEventoRepository) {
        this.rfidEventRepository = rfidEventRepository;
        this.tipoEventoRepository = tipoEventoRepository;
    }

    @Transactional
    public void processTag(String epc, String rssi, String antenna) {
        long currentTime = System.currentTimeMillis();
        long lastProcessed = epcLastProcessedTimeMap.getOrDefault(epc, 0L);

        if ((currentTime - lastProcessed) > READ_PROCESSING_DELAY_MS) {
            String previousEventName = epcLastEventTypeMap.getOrDefault(epc, "Salida");
            String newEventName = "Entrada".equals(previousEventName) ? "Salida" : "Entrada";

            Optional<TipoEventoEntity> optTipoEvento = tipoEventoRepository.findByNombreEvento(newEventName);

            if (optTipoEvento.isEmpty()) {
                System.err.println("ERROR (Entrada/Salida Logic): Tipo de evento '" + newEventName + "' no encontrado. EPC: " + epc);
                return;
            }
            TipoEventoEntity tipoEvento = optTipoEvento.get();

            epcLastEventTypeMap.put(epc, newEventName);
            epcLastProcessedTimeMap.put(epc, currentTime);

            String defaultDescription = "Evento de " + newEventName.toLowerCase();
            RfidEventEntity event = new RfidEventEntity(
                    epc,
                    tipoEvento,
                    LocalDateTime.now(),
                    rssi,
                    antenna,
                    "No asignado",   // Ticket
                    null,            // estadoColor
                    defaultDescription // descripcion
            );
            rfidEventRepository.save(event);
            System.out.println("INFO (Entrada/Salida Logic): Tag EPC: " + epc + ". Estado cambiado a: " + newEventName + ". Desc: \"" + defaultDescription + "\". Persistido.");
        }
    }

    public void clearState() {
        epcLastEventTypeMap.clear();
        epcLastProcessedTimeMap.clear();
        System.out.println("INFO (Entrada/Salida Logic): Estados en memoria limpiados.");
    }

    public List<RfidEventDetailDTO> getCurrentEventDetails() {
        return epcLastEventTypeMap.keySet().stream()
                .map(epc -> rfidEventRepository.findFirstByEpcOrderByEventTimeDesc(epc))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(eventEntity -> new RfidEventDetailDTO(
                        eventEntity.getId(),
                        eventEntity.getEpc(),
                        eventEntity.getEventTime(),
                        eventEntity.getRssi(),
                        eventEntity.getAntenna(),
                        eventEntity.getTicket(),
                        eventEntity.getEstadoColor(),
                        eventEntity.getDescripcion(),
                        eventEntity.getTipoEvento() != null ? eventEntity.getTipoEvento().getNombreEvento() : "Desconocido",
                        eventEntity.getTipoEvento() != null ? eventEntity.getTipoEvento().getDescripcionTipo() : "Sin descripción de tipo"
                ))
                .collect(Collectors.toList());
    }

    public Map<String, String> getCurrentStates() {
        return new ConcurrentHashMap<>(epcLastEventTypeMap);
    }

    // --- NUEVO MÉTODO PARA GENERAR CSV ---
    public String generateCsvReportString() {
        List<RfidEventDetailDTO> events = getCurrentEventDetails(); // Obtiene los datos actuales
        StringBuilder csvBuilder = new StringBuilder();

        // Encabezado del CSV (corresponde a las columnas que NO quitamos de la vista Entrada/Salida)
        csvBuilder.append("ID Evento,EPC,Tipo Evento,Hora Evento,RSSI,Antena,Ticket,Descripcion\n"); // Incluimos Descripcion que sí se guarda

        // Datos
        for (RfidEventDetailDTO dto : events) {
            csvBuilder.append(escapeCsvField(dto.getId() != null ? dto.getId().toString() : "")).append(",");
            csvBuilder.append(escapeCsvField(dto.getEpc())).append(",");
            csvBuilder.append(escapeCsvField(dto.getNombreDelTipoDeEvento())).append(",");
            csvBuilder.append(escapeCsvField(dto.getEventTime() != null ? dto.getEventTime().format(CSV_DATE_TIME_FORMATTER) : "")).append(",");
            csvBuilder.append(escapeCsvField(dto.getRssi())).append(",");
            csvBuilder.append(escapeCsvField(dto.getAntenna())).append(",");
            csvBuilder.append(escapeCsvField(dto.getTicket())).append(",");
            csvBuilder.append(escapeCsvField(dto.getDescripcion())); // Descripción del evento individual
            // No incluimos 'estadoColor' porque para este modo es null y no se muestra en la UI
            csvBuilder.append("\n");
        }
        return csvBuilder.toString();
    }

    // Ayudante simple para escapar campos CSV (maneja comas y comillas dobles)
    private String escapeCsvField(String data) {
        if (data == null) {
            return "";
        }
        String escapedData = data.replace("\"", "\"\""); // Escapa comillas dobles internas
        if (data.contains(",") || data.contains("\"") || data.contains("\n")) {
            escapedData = "\"" + escapedData + "\""; // Envuelve en comillas dobles si contiene comas, comillas o saltos de línea
        }
        return escapedData;
    }
}