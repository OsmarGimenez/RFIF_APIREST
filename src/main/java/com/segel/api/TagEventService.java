package com.segel.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TagEventService {

    private final Map<String, String> epcStatusMap = new ConcurrentHashMap<>();
    private final Set<String> readTags = Collections.synchronizedSet(new HashSet<>());

    private final DatabaseManager databaseManager;

    @Autowired
    public TagEventService(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
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
            epcStatusMap.put(epc, "rojo");
        }
        System.out.println("EPCs cargados como pendientes: " + epcs.size());
    }

    public List<TagEventDTO> getStatuses() {
        List<TagEventDTO> list = new ArrayList<>();
        for (Map.Entry<String, String> entry : epcStatusMap.entrySet()) {
            list.add(new TagEventDTO(entry.getKey(), entry.getValue()));
        }
        return list;
    }

    public void simulateTagRead(String epc) {
        if (!epcStatusMap.containsKey(epc)) {
            epcStatusMap.put(epc, "amarillo");
        } else if (!readTags.contains(epc)) {
            epcStatusMap.put(epc, "verde");
            readTags.add(epc);
            databaseManager.insertTag(epc, "Entrada", "API", "Web", "No asignado");
        } else {
            epcStatusMap.put(epc, "amarillo");
        }
    }
}
