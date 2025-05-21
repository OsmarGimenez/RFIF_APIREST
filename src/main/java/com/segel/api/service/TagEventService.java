package com.segel.api.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.segel.api.dto.TagEventDTO;
import com.segel.api.model.RfidEventEntity;
import com.segel.api.persistence.RfidEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TagEventService {

    private final RfidEventRepository rfidEventRepository; // Inyecta el nuevo repositorio

    private final Map<String, String> epcStatusMap = new ConcurrentHashMap<>();
    private final Set<String> readTags = Collections.synchronizedSet(new HashSet<>());

    // Constructor para la inyección de dependencias
    @Autowired
    public TagEventService(RfidEventRepository rfidEventRepository) {
        this.rfidEventRepository = rfidEventRepository;
    }

    public void startReading() {
        System.out.println("Lectura iniciada (simulada).");
    }

    public void stopReading() {
        System.out.println("Lectura detenida.");
    }

    public void clear() {
        epcStatusMap.clear();
        readTags.clear();
        System.out.println("Estados limpiados.");
    }

    public void setExpectedEPCs(List<String> epcs) {
        for (String epc : epcs) {
            epcStatusMap.put(epc, "rojo"); // [cite: 33]
        }
        System.out.println("EPCs cargados como pendientes: " + epcs.size());
    }

    public List<TagEventDTO> getStatuses() {
        List<TagEventDTO> list = new ArrayList<>(); // [cite: 34]
        for (Map.Entry<String, String> entry : epcStatusMap.entrySet()) { // [cite: 34]
            list.add(new TagEventDTO(entry.getKey(), entry.getValue())); // [cite: 34]
        }
        return list; // [cite: 35]
    }

    @Transactional // Buena práctica para métodos que modifican datos
    public void simulateTagRead(String epc) {
        if (!epcStatusMap.containsKey(epc)) { // [cite: 37]
            epcStatusMap.put(epc, "amarillo"); // [cite: 37]
            // Opcional: Considera si quieres registrar este evento "inesperado" también
            // RfidEventEntity event = new RfidEventEntity(epc, "Inesperado", LocalDateTime.now(), "N/A", "N/A", "N/A");
            // rfidEventRepository.save(event);
        } else if (!readTags.contains(epc)) { // [cite: 38]
            epcStatusMap.put(epc, "verde"); // [cite: 38]
            readTags.add(epc); // [cite: 38]

            // Usar el repositorio para insertar
            RfidEventEntity event = new RfidEventEntity(epc, "Entrada", LocalDateTime.now(), "API", "Web", "No asignado"); // [cite: 38]
            rfidEventRepository.save(event); // Guardar usando JPA

        } else {
            // Tag ya leído previamente y estaba en la lista de esperados (duplicado)
            epcStatusMap.put(epc, "amarillo"); // [cite: 39]
            // Opcional: Considera si quieres registrar este evento "duplicado" también
            // RfidEventEntity event = new RfidEventEntity(epc, "Duplicado", LocalDateTime.now(), "API", "Web", "No asignado");
            // rfidEventRepository.save(event);
        }
    }
}