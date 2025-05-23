package com.segel.api.service;

import com.segel.api.dto.RfidEventDetailDTO;
import com.segel.api.dto.TagEventDTO;
import com.segel.api.model.LecturaListaSesionEntity;
import com.segel.api.model.RfidEventEntity;
import com.segel.api.model.TipoEventoEntity;
import com.segel.api.persistence.LecturaListaSesionRepository;
import com.segel.api.persistence.RfidEventRepository;
import com.segel.api.persistence.TipoEventoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rscja.deviceapi.RFIDWithUHFNetworkUR4;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter; // Importar para el formateador de CSV
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
public class TagEventService {

    private final EntradaSalidaLogicService entradaSalidaLogicService;
    private final ListVerificationLogicService listVerificationLogicService;
    private final QuantityCountingLogicService quantityCountingLogicService;
    private final RfidEventRepository rfidEventRepository;
    private final LecturaListaSesionRepository lecturaListaSesionRepository;

    private final RFIDWithUHFNetworkUR4 rfidReader;
    private final AtomicBoolean isReading = new AtomicBoolean(false);
    private ExecutorService readerExecutorService;
    private OperatingMode currentOperatingMode = OperatingMode.IDLE;
    private long readingStartTimeMillis = 0L;

    private static final DateTimeFormatter CSV_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");


    @Value("${reader.ip}")
    private String readerIp;

    @Value("${reader.port}")
    private int readerPort;

    @Autowired
    public TagEventService(EntradaSalidaLogicService entradaSalidaLogicService,
                           ListVerificationLogicService listVerificationLogicService,
                           QuantityCountingLogicService quantityCountingLogicService,
                           RfidEventRepository rfidEventRepository,
                           LecturaListaSesionRepository lecturaListaSesionRepository) {
        this.entradaSalidaLogicService = entradaSalidaLogicService;
        this.listVerificationLogicService = listVerificationLogicService;
        this.quantityCountingLogicService = quantityCountingLogicService;
        this.rfidEventRepository = rfidEventRepository;
        this.lecturaListaSesionRepository = lecturaListaSesionRepository;

        this.rfidReader = new RFIDWithUHFNetworkUR4();
        System.out.println("DEBUG: Instancia de RFIDWithUHFNetworkUR4 creada en TagEventService.");
    }

    public boolean setOperatingMode(OperatingMode newMode, Object params) {
        if (isReading.get()) {
            System.err.println("ERROR: No se puede cambiar el modo mientras la lectura está activa.");
            return false;
        }
        if (this.currentOperatingMode != newMode || newMode == OperatingMode.IDLE) {
            System.out.println("INFO: Cambiando de modo " + this.currentOperatingMode + " a " + newMode + ". Limpiando estados de lógicas anteriores.");
            clearAllLogicStates();
        } else {
            System.out.println("INFO: Re-estableciendo el mismo modo: " + newMode + ". No se limpian los estados en memoria de la lógica.");
        }
        this.currentOperatingMode = newMode;

        switch (newMode) {
            case LIST_VERIFICATION:
                if (params instanceof List) {
                    try {
                        @SuppressWarnings("unchecked")
                        List<String> epcs = (List<String>) params;
                        listVerificationLogicService.prepareNewListSession(epcs);
                    } catch (ClassCastException e) {
                        System.err.println("ERROR: Parámetro incorrecto para LIST_VERIFICATION. Se esperaba List<String>.");
                        this.currentOperatingMode = OperatingMode.IDLE;
                        return false;
                    }
                } else {
                    System.err.println("ERROR: Modo LIST_VERIFICATION requiere una lista de EPCs como parámetro al establecer el modo.");
                    this.currentOperatingMode = OperatingMode.IDLE;
                    return false;
                }
                break;
            case QUANTITY_COUNTING:
                if (params instanceof Integer) {
                    quantityCountingLogicService.setTargetCount((Integer) params);
                } else {
                    System.err.println("ERROR: Modo QUANTITY_COUNTING requiere un entero (target count) como parámetro.");
                    this.currentOperatingMode = OperatingMode.IDLE;
                    return false;
                }
                break;
            case ENTRADA_SALIDA:
            case IDLE:
                break;
        }
        System.out.println("INFO: Modo de operación establecido a: " + newMode);
        return true;
    }

    public void startReading() {
        if (this.rfidReader == null) {
            System.err.println("ERROR: El objeto lector RFID no está instanciado.");
            return;
        }
        if (this.currentOperatingMode == OperatingMode.IDLE) {
            System.err.println("ERROR: No se ha establecido un modo de operación.");
            return;
        }
        if (this.currentOperatingMode == OperatingMode.LIST_VERIFICATION) {
            boolean sessionStarted = listVerificationLogicService.startCurrentListSession();
            if (!sessionStarted) {
                System.err.println("ERROR: No se pudo iniciar la sesión de lista en ListVerificationLogicService.");
                isReading.set(false);
                return;
            }
        }
        if (isReading.compareAndSet(false, true)) {
            readingStartTimeMillis = System.currentTimeMillis();
            System.out.println("INFO: Iniciando lectura (Modo: " + currentOperatingMode + ") en IP: " + readerIp + ", Puerto: " + readerPort);
            try {
                boolean initSuccess = this.rfidReader.init(this.readerIp, this.readerPort);
                if (!initSuccess) {
                    System.err.println("ERROR: Fallo al conectar con el lector RFID (init devolvió false)");
                    isReading.set(false);
                    readingStartTimeMillis = 0L;
                    return;
                }
                System.out.println("INFO: Conectado al lector RFID.");
                this.rfidReader.startInventoryTag();
                System.out.println("INFO: Inventario RFID llamado.");
                readerExecutorService = Executors.newSingleThreadExecutor();
                readerExecutorService.submit(() -> {
                    System.out.println("DEBUG: Hilo de lectura iniciado (Modo: " + currentOperatingMode + ").");
                    while (isReading.get()) {
                        UHFTAGInfo tagInfo = this.rfidReader.readTagFromBuffer();
                        if (tagInfo != null) {
                            String epc = tagInfo.getEPC();
                            String rssi = tagInfo.getRssi();
                            String antenna = tagInfo.getAnt();
                            if (epc != null && !epc.isEmpty()) {
                                switch (currentOperatingMode) {
                                    case ENTRADA_SALIDA:
                                        entradaSalidaLogicService.processTag(epc, rssi, antenna);
                                        break;
                                    case LIST_VERIFICATION:
                                        listVerificationLogicService.processTag(epc, rssi, antenna);
                                        break;
                                    case QUANTITY_COUNTING:
                                        quantityCountingLogicService.processTag(epc, rssi, antenna);
                                        break;
                                    default:
                                        break;
                                }
                            }
                        }
                        try { Thread.sleep(100); } catch (InterruptedException e) {
                            Thread.currentThread().interrupt(); isReading.set(false);
                        }
                    }
                    System.out.println("INFO: Bucle de lectura terminado.");
                    this.rfidReader.stopInventory();
                    System.out.println("INFO: Inventario detenido.");
                    this.rfidReader.free();
                    System.out.println("INFO: Recursos del lector liberados.");
                    readingStartTimeMillis = 0L;
                    if (currentOperatingMode == OperatingMode.LIST_VERIFICATION) {
                        listVerificationLogicService.concludeCurrentListSession();
                    }
                });
            } catch (Exception e) {
                System.err.println("ERROR: Excepción al iniciar lector: " + e.getMessage());
                e.printStackTrace(); isReading.set(false); readingStartTimeMillis = 0L;
            }
        } else {
            if(isReading.get()){
                System.out.println("INFO: Lectura ya en progreso para modo: " + currentOperatingMode);
            }
        }
    }

    public void stopReading() {
        OperatingMode modeWhenStopping = this.currentOperatingMode;
        if (isReading.compareAndSet(true, false)) {
            System.out.println("INFO: Solicitud para detener lectura (Modo: " + modeWhenStopping + ").");
            if (readerExecutorService != null && !readerExecutorService.isShutdown()) {
                readerExecutorService.shutdown();
                try {
                    if (!readerExecutorService.awaitTermination(7, TimeUnit.SECONDS)) {
                        readerExecutorService.shutdownNow();
                        System.err.println("WARN: El servicio de lector no terminó tareas pendientes, forzando apagado del hilo.");
                    }
                } catch (InterruptedException ie) {
                    readerExecutorService.shutdownNow(); Thread.currentThread().interrupt();
                }
            }
        } else { System.out.println("INFO: Lectura no estaba en progreso."); }
    }

    @PreDestroy
    public void cleanUp() {
        System.out.println("INFO: Limpiando TagEventService...");
        stopReading();
    }

    private void clearAllLogicStates() {
        entradaSalidaLogicService.clearState();
        listVerificationLogicService.clearStateForNewSession();
        quantityCountingLogicService.clearState();
        System.out.println("INFO: Estados de todas las lógicas limpiados.");
    }

    public void clearCurrentModeState() {
        System.out.println("INFO: Limpiando estado para modo actual: " + currentOperatingMode);
        switch (currentOperatingMode) {
            case ENTRADA_SALIDA: entradaSalidaLogicService.clearState(); break;
            case LIST_VERIFICATION: listVerificationLogicService.clearStateForNewSession(); break;
            case QUANTITY_COUNTING: quantityCountingLogicService.clearState(); break;
            default: clearAllLogicStates(); break;
        }
    }

    public List<? extends Object> getStatuses() {
        switch (currentOperatingMode) {
            case ENTRADA_SALIDA:
                return entradaSalidaLogicService.getCurrentEventDetails();
            case LIST_VERIFICATION:
                return listVerificationLogicService.getCurrentEventDetails();
            case QUANTITY_COUNTING:
                List<TagEventDTO> countList = new ArrayList<>();
                countList.add(new TagEventDTO("TargetCount", String.valueOf(quantityCountingLogicService.getTargetCount())));
                countList.add(new TagEventDTO("CurrentReadCount", String.valueOf(quantityCountingLogicService.getCurrentReadCount())));
                countList.add(new TagEventDTO("RemainingOrExcess", String.valueOf(quantityCountingLogicService.getRemainingOrExcessCount())));
                return countList;
            default:
                System.out.println("WARN: getStatuses llamado en modo IDLE o desconocido.");
                return Collections.emptyList();
        }
    }

    public Map<String, Object> getReaderActivityStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("isReading", isReading.get());
        status.put("activeMode", currentOperatingMode);
        status.put("readingStartTimeMillis", this.isReading.get() ? this.readingStartTimeMillis : 0L);
        return status;
    }

    public String generateCsvReportForCurrentMode() {
        if (isReading.get()) {
            System.err.println("WARN: No se puede generar el reporte mientras la lectura está activa.");
            return "Error: Detenga la lectura antes de generar el reporte.";
        }
        switch (currentOperatingMode) {
            case ENTRADA_SALIDA:
                return entradaSalidaLogicService.generateCsvReportString();
            case LIST_VERIFICATION:
                return listVerificationLogicService.generateCsvReportString();
            case QUANTITY_COUNTING:
                System.out.println("WARN: Generación de CSV para Modo Conteo no implementada aún.");
                return "Reporte CSV para Modo Conteo no implementado.";
            default:
                System.out.println("WARN: No hay un modo activo o el modo no soporta reportes CSV.");
                return "Error: No hay datos para generar el reporte o el modo no es compatible.";
        }
    }

    @Transactional
    public boolean updateEventDescription(Long eventId, String newDescription) {
        if (eventId == null) {
            System.err.println("ERROR: eventId es nulo al intentar actualizar descripción.");
            return false;
        }
        Optional<RfidEventEntity> eventOptional = this.rfidEventRepository.findById(eventId);
        if (eventOptional.isPresent()) {
            RfidEventEntity event = eventOptional.get();
            event.setDescripcion(newDescription);
            this.rfidEventRepository.save(event);
            System.out.println("INFO: Descripción actualizada para evento ID " + eventId + " a: \"" + newDescription + "\"");
            return true;
        } else {
            System.err.println("WARN: Evento con ID " + eventId + " no encontrado para actualizar descripción.");
            return false;
        }
    }

    public List<LecturaListaSesionEntity> getAllListVerificationSessions() {
        return lecturaListaSesionRepository.findAllByOrderByFechaHoraInicioDesc();
    }

    public List<RfidEventDetailDTO> getListVerificationSessionDetails(Long sesionId) {
        if (sesionId == null) {
            System.err.println("ERROR: sesionId es nulo al intentar obtener detalles de sesión.");
            return Collections.emptyList();
        }
        List<RfidEventEntity> eventsInSession = rfidEventRepository.findBySesion_SesionIdOrderByEventTimeDesc(sesionId);
        if (eventsInSession.isEmpty()) {
            System.out.println("INFO: No se encontraron eventos para la sesión ID: " + sesionId);
            return Collections.emptyList();
        }
        return eventsInSession.stream()
                .map(eventEntity -> {
                    TipoEventoEntity tipoEvento = eventEntity.getTipoEvento();
                    return new RfidEventDetailDTO(
                            eventEntity.getId(), eventEntity.getEpc(), eventEntity.getEventTime(),
                            eventEntity.getRssi(), eventEntity.getAntenna(), eventEntity.getTicket(),
                            eventEntity.getEstadoColor(), eventEntity.getDescripcion(),
                            tipoEvento != null ? tipoEvento.getNombreEvento() : "Desconocido",
                            tipoEvento != null ? tipoEvento.getDescripcionTipo() : "Sin descripción de tipo"
                    );
                })
                .collect(Collectors.toList());
    }

    // --- NUEVO MÉTODO PARA GENERAR REPORTE CSV DE UNA SESIÓN HISTÓRICA ---
    public String generateCsvReportForHistoricalSession(Long sesionId) {
        if (sesionId == null) {
            return "Error: ID de sesión no proporcionado para el reporte.";
        }
        List<RfidEventDetailDTO> eventDetails = getListVerificationSessionDetails(sesionId);
        if (eventDetails.isEmpty()) {
            return "Error: No hay eventos detallados para la sesión ID " + sesionId + " para generar el reporte.";
        }

        StringBuilder csvBuilder = new StringBuilder();
        // Encabezado del CSV (igual al de la tabla del modal)
        csvBuilder.append("ID Evento,EPC,Hora Evento,Tipo Evento,Estado Semáforo,RSSI,Antena,Ticket,Descripción\n");

        for (RfidEventDetailDTO dto : eventDetails) {
            csvBuilder.append(escapeCsvField(dto.getId() != null ? dto.getId().toString() : "")).append(",");
            csvBuilder.append(escapeCsvField(dto.getEpc())).append(",");
            csvBuilder.append(escapeCsvField(dto.getEventTime() != null ? dto.getEventTime().format(CSV_DATE_TIME_FORMATTER) : "")).append(",");
            csvBuilder.append(escapeCsvField(dto.getNombreDelTipoDeEvento())).append(",");
            csvBuilder.append(escapeCsvField(dto.getEstadoColor())).append(",");
            csvBuilder.append(escapeCsvField(dto.getRssi())).append(",");
            csvBuilder.append(escapeCsvField(dto.getAntenna())).append(",");
            csvBuilder.append(escapeCsvField(dto.getTicket())).append(",");
            csvBuilder.append(escapeCsvField(dto.getDescripcion()));
            csvBuilder.append("\n");
        }
        return csvBuilder.toString();
    }

    // Método ayudante simple para escapar campos CSV (debe estar en la clase o ser accesible)
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

    public void simulateTagRead(String epc, OperatingMode modeToSimulate) {
        // ... (código existente)
        System.out.println("INFO: SIMULANDO LECTURA (Modo: " + modeToSimulate + ") PARA EPC: " + epc);
        String simulatedRssi = "-55dBm";
        String simulatedAntenna = "1";
        OperatingMode originalMode = this.currentOperatingMode;
        Object params = null;
        if (modeToSimulate == OperatingMode.QUANTITY_COUNTING) params = 0;
        else if (modeToSimulate == OperatingMode.LIST_VERIFICATION) params = Collections.emptyList();

        setOperatingMode(modeToSimulate, params);

        switch (modeToSimulate) {
            case ENTRADA_SALIDA: entradaSalidaLogicService.processTag(epc, simulatedRssi, simulatedAntenna); break;
            case LIST_VERIFICATION: listVerificationLogicService.processTag(epc, simulatedRssi, simulatedAntenna); break;
            case QUANTITY_COUNTING: quantityCountingLogicService.processTag(epc, simulatedRssi, simulatedAntenna); break;
            default: System.err.println("ERROR: Modo de simulación no soportado: " + modeToSimulate); break;
        }
    }
}