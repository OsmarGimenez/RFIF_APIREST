package com.segel.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
public class TagEventController {

    @Autowired
    private TagEventService tagEventService;

    @PostMapping("/start")
    public String startReading() {
        tagEventService.startReading();
        return "Lectura iniciada";
    }

    @PostMapping("/stop")
    public String stopReading() {
        tagEventService.stopReading();
        return "Lectura detenida";
    }

    @PostMapping("/clear")
    public String clear() {
        tagEventService.clear();
        return "Estado limpiado";
    }

    @PostMapping("/submit")
    public String submitTags(@RequestBody List<String> epcs) {
        tagEventService.setExpectedEPCs(epcs);
        return "EPCs recibidos: " + epcs.size();
    }

    @GetMapping("/status")
    public List<TagEventDTO> getTagStatuses() {
        return tagEventService.getStatuses();
    }

    // Endpoint opcional para simular una lectura
    @PostMapping("/simulate")
    public String simulateRead(@RequestParam String epc) {
        tagEventService.simulateTagRead(epc);
        return "Lectura simulada para EPC: " + epc;
    }
}
