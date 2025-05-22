package com.segel.api.service;

// No usaremos TagEventDTO aquí directamente, pero lo mantenemos por si se extiende en el futuro.
// import com.segel.api.dto.TagEventDTO;
import com.segel.api.model.RfidEventEntity;
import com.segel.api.model.TipoEventoEntity; // Importar
import com.segel.api.persistence.RfidEventRepository;
import com.segel.api.persistence.TipoEventoRepository; // Importar
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional; // Importar
import java.util.Set;

@Service
public class QuantityCountingLogicService {

    private final RfidEventRepository rfidEventRepository;
    private final TipoEventoRepository tipoEventoRepository; // Inyectar

    private int targetCount = 0;
    private final Set<String> uniqueEpcsReadThisSession = Collections.synchronizedSet(new HashSet<>());
    // currentReadCount se deriva ahora de uniqueEpcsReadThisSession.size() directamente

    // Nombres de los tipos de evento para esta lógica
    private static final String EVENT_NAME_CONTEO_LEIDO = "Conteo - Leído";
    private static final String EVENT_NAME_CONTEO_EXCESO = "Conteo - Exceso";


    @Autowired
    public QuantityCountingLogicService(RfidEventRepository rfidEventRepository,
                                        TipoEventoRepository tipoEventoRepository) { // Añadir al constructor
        this.rfidEventRepository = rfidEventRepository;
        this.tipoEventoRepository = tipoEventoRepository; // Asignar
    }

    public void setTargetCount(int target) {
        clearState();
        this.targetCount = Math.max(0, target); // Asegura que el objetivo no sea negativo
        System.out.println("INFO (Counting Logic): Conteo objetivo establecido en: " + this.targetCount);
    }

    @Transactional
    public void processTag(String epc, String rssi, String antenna) {
        if (epc == null || epc.trim().isEmpty()) {
            return;
        }
        String normalizedEpc = epc.trim();
        String eventTypeName;
        Optional<TipoEventoEntity> optTipoEvento;

        if (uniqueEpcsReadThisSession.add(normalizedEpc)) {
            long currentUniqueCount = uniqueEpcsReadThisSession.size();

            if (targetCount > 0 && currentUniqueCount > targetCount) {
                eventTypeName = EVENT_NAME_CONTEO_EXCESO;
            } else {
                eventTypeName = EVENT_NAME_CONTEO_LEIDO;
            }

            optTipoEvento = tipoEventoRepository.findByNombreEvento(eventTypeName);
            if (optTipoEvento.isEmpty()) {
                System.err.println("ERROR (Counting Logic): Tipo de evento '" + eventTypeName + "' no encontrado. EPC: " + normalizedEpc);
                // Considerar no agregar el EPC a uniqueEpcsReadThisSession si el tipo de evento no existe,
                // o manejar el error de otra manera. Por ahora, el EPC queda en el set.
                return;
            }

            RfidEventEntity event = new RfidEventEntity(
                    normalizedEpc,
                    optTipoEvento.get(),
                    LocalDateTime.now(),
                    rssi,
                    antenna,
                    "No asignado", // Ticket
                    null,         // estadoColor (no se gestiona en este modo directamente)
                    null          // descripcion (no se gestiona en este modo directamente)
            );
            rfidEventRepository.save(event);
            System.out.println("INFO (Counting Logic): Tag EPC: " + normalizedEpc + " contado. Total únicos: " + currentUniqueCount + ". Evento: " + eventTypeName);
        }
    }

    public void clearState() {
        targetCount = 0;
        uniqueEpcsReadThisSession.clear();
        System.out.println("INFO (Counting Logic): Estados en memoria limpiados.");
    }

    public long getCurrentReadCount() {
        return uniqueEpcsReadThisSession.size();
    }

    public int getTargetCount() {
        return targetCount;
    }

    public long getRemainingOrExcessCount() {
        if (targetCount > 0) {
            return targetCount - uniqueEpcsReadThisSession.size();
        }
        return 0;
    }
}