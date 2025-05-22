package com.segel.api.service;

import com.segel.api.dto.RfidEventDetailDTO; // Cambiar TagEventDTO por RfidEventDetailDTO
import com.segel.api.model.RfidEventEntity;
import com.segel.api.model.TipoEventoEntity;
import com.segel.api.persistence.RfidEventRepository;
import com.segel.api.persistence.TipoEventoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors; // Importar Collectors

@Service
public class ListVerificationLogicService {

    private final RfidEventRepository rfidEventRepository;
    private final TipoEventoRepository tipoEventoRepository;

    private final Map<String, String> epcStatusMap = new ConcurrentHashMap<>();
    private final Set<String> expectedEpcSet = Collections.synchronizedSet(new HashSet<>());
    private final Set<String> readAndVerifiedEpcSet = Collections.synchronizedSet(new HashSet<>());

    private static final String EVENT_NAME_LISTA_CONFIRMADO = "Lista - Confirmado";
    private static final String EVENT_NAME_LISTA_NO_ESPERADO = "Lista - No Esperado";
    // Podríamos añadir un tipo de evento para los "rojos" (pendientes) si queremos registrarlos en la BD al cargar la lista.
    // Por ahora, el estado "rojo" es solo en memoria.

    @Autowired
    public ListVerificationLogicService(RfidEventRepository rfidEventRepository,
                                        TipoEventoRepository tipoEventoRepository) {
        this.rfidEventRepository = rfidEventRepository;
        this.tipoEventoRepository = tipoEventoRepository;
    }

    public void setExpectedEPCs(List<String> epcs) {
        clearState();
        if (epcs != null) {
            for (String epc : epcs) {
                if (epc != null && !epc.trim().isEmpty()) {
                    String normalizedEpc = epc.trim();
                    expectedEpcSet.add(normalizedEpc);
                    epcStatusMap.put(normalizedEpc, "rojo");
                }
            }
        }
        System.out.println("INFO (List Logic): EPCs esperados cargados: " + expectedEpcSet.size() + ". Estado inicial: ROJO.");
    }

    @Transactional
    public void processTag(String epc, String rssi, String antenna) {
        if (epc == null || epc.trim().isEmpty()) {
            return;
        }
        String normalizedEpc = epc.trim();
        String currentEventColor;
        String eventDescription = null;
        String eventTypeName;
        Optional<TipoEventoEntity> optTipoEvento;

        if (expectedEpcSet.contains(normalizedEpc)) {
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
                rfidEventRepository.save(event);
                System.out.println("INFO (List Logic): Tag esperado EPC: " + normalizedEpc + ". Marcado como VERDE. Persistido con estadoColor: " + currentEventColor);
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
                rfidEventRepository.save(event);
                System.out.println("INFO (List Logic): Tag NO esperado EPC: " + normalizedEpc + ". Marcado como AMARILLO. Persistido con estadoColor: " + currentEventColor);
            }
        }
    }

    public void clearState() {
        epcStatusMap.clear();
        expectedEpcSet.clear();
        readAndVerifiedEpcSet.clear();
        System.out.println("INFO (List Logic): Estados en memoria limpiados.");
    }

    // Método actualizado para devolver List<RfidEventDetailDTO>
    public List<RfidEventDetailDTO> getCurrentEventDetails() {
        List<RfidEventDetailDTO> dtoList = new ArrayList<>();

        // Procesar EPCs que tienen un estado definido en epcStatusMap (verdes, amarillos, y rojos que se leyeron pero no cambiaron)
        for (Map.Entry<String, String> entry : epcStatusMap.entrySet()) {
            String epc = entry.getKey();
            String colorStatus = entry.getValue(); // "rojo", "verde", "amarillo"

            // Para los verdes y amarillos, un evento ya fue persistido. Buscamos el más reciente.
            // Para los rojos, no hay evento persistido asociado directamente con este estado de "pendiente".
            Optional<RfidEventEntity> optEventEntity = rfidEventRepository.findFirstByEpcOrderByEventTimeDesc(epc);

            if (optEventEntity.isPresent()) {
                RfidEventEntity eventEntity = optEventEntity.get();
                // Usar el color del mapa de estado en memoria para la UI, ya que es el más actualizado para el semáforo.
                dtoList.add(new RfidEventDetailDTO(
                        eventEntity.getId(), epc, eventEntity.getEventTime(), eventEntity.getRssi(),
                        eventEntity.getAntenna(), eventEntity.getTicket(),
                        colorStatus, // Color actual del semáforo en memoria
                        eventEntity.getDescripcion(), // Descripción del evento persistido
                        eventEntity.getTipoEvento() != null ? eventEntity.getTipoEvento().getNombreEvento() : "N/A",
                        eventEntity.getTipoEvento() != null ? eventEntity.getTipoEvento().getDescripcionTipo() : "N/A"
                ));
            } else if ("rojo".equals(colorStatus)) {
                // Si es rojo y no tiene evento (porque nunca se leyó), creamos un DTO placeholder
                dtoList.add(new RfidEventDetailDTO(null, epc, null, null, null, null, colorStatus, "Pendiente de lectura", "No Leído", "Este EPC está en la lista esperada pero no ha sido leído."));
            }
        }
        return dtoList;
    }

    // Se mantiene getCurrentStatuses por si se usa internamente, pero la UI usará getCurrentEventDetails
    public List<com.segel.api.dto.TagEventDTO> getCurrentStatuses() { // Referencia al DTO simple original
        List<com.segel.api.dto.TagEventDTO> list = new ArrayList<>();
        for (String expectedEpc : expectedEpcSet) {
            epcStatusMap.putIfAbsent(expectedEpc, "rojo");
        }
        for (Map.Entry<String, String> entry : epcStatusMap.entrySet()) {
            list.add(new com.segel.api.dto.TagEventDTO(entry.getKey(), entry.getValue()));
        }
        return list;
    }

    public long getExpectedCount() { return expectedEpcSet.size(); }
    public long getReadAndVerifiedCount() { return readAndVerifiedEpcSet.size(); }
    public long getNotExpectedCount() { return epcStatusMap.entrySet().stream().filter(entry -> "amarillo".equals(entry.getValue())).count(); }
}