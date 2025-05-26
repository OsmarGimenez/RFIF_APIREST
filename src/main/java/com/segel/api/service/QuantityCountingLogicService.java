package com.segel.api.service;

import com.segel.api.model.LecturaConteoSesionEntity; // Importar nueva entidad
import com.segel.api.model.RfidEventEntity;
import com.segel.api.model.TipoEventoEntity;
import com.segel.api.persistence.LecturaConteoSesionRepository; // Importar nuevo repositorio
import com.segel.api.persistence.RfidEventRepository;
import com.segel.api.persistence.TipoEventoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Service
public class QuantityCountingLogicService {

    private final RfidEventRepository rfidEventRepository;
    private final TipoEventoRepository tipoEventoRepository;
    private final LecturaConteoSesionRepository lecturaConteoSesionRepository; // Nuevo repositorio

    private int targetCount = 0;
    private final Set<String> uniqueEpcsReadThisSession = Collections.synchronizedSet(new HashSet<>());

    private LecturaConteoSesionEntity currentCountSession; // Sesión de conteo activa

    private static final String EVENT_NAME_CONTEO_LEIDO = "Conteo - Leído";
    private static final String EVENT_NAME_CONTEO_EXCESO = "Conteo - Exceso";

    @Autowired
    public QuantityCountingLogicService(RfidEventRepository rfidEventRepository,
                                        TipoEventoRepository tipoEventoRepository,
                                        LecturaConteoSesionRepository lecturaConteoSesionRepository) { // Añadir al constructor
        this.rfidEventRepository = rfidEventRepository;
        this.tipoEventoRepository = tipoEventoRepository;
        this.lecturaConteoSesionRepository = lecturaConteoSesionRepository; // Asignar
    }

    // Llamado por TagEventService.setOperatingMode()
    public void prepareNewCountSession(int target) {
        clearState();
        this.targetCount = Math.max(0, target); // Asegura que el objetivo no sea negativo
        // La entidad de sesión se crea cuando realmente se inicia la lectura.
        System.out.println("INFO (Counting Logic): Preparada nueva sesión de conteo. Objetivo: " + this.targetCount);
    }

    // Llamado por TagEventService.startReading() cuando el modo es QUANTITY_COUNTING
    @Transactional
    public boolean startCurrentCountSession() {
        if (this.currentCountSession != null && this.currentCountSession.getFechaHoraFin() == null) {
            System.err.println("WARN (Counting Logic): Ya hay una sesión de conteo activa (ID: " + this.currentCountSession.getSesionConteoId() + "). No se iniciará una nueva.");
            return true;
        }

        this.currentCountSession = new LecturaConteoSesionEntity(
                LocalDateTime.now(),
                this.targetCount
        );
        this.currentCountSession = lecturaConteoSesionRepository.save(this.currentCountSession);
        System.out.println("INFO (Counting Logic): Nueva sesión de conteo iniciada. ID Sesión: " + this.currentCountSession.getSesionConteoId() + ", Objetivo: " + this.targetCount);
        return true;
    }

    @Transactional
    public void processTag(String epc, String rssi, String antenna) {
        if (this.currentCountSession == null || this.currentCountSession.getSesionConteoId() == null) {
            System.err.println("ERROR (Counting Logic): No hay una sesión de conteo activa para procesar el tag EPC: " + epc);
            return;
        }
        if (epc == null || epc.trim().isEmpty()) {
            return;
        }
        String normalizedEpc = epc.trim();
        String eventTypeName;
        Optional<TipoEventoEntity> optTipoEvento;

        if (uniqueEpcsReadThisSession.add(normalizedEpc)) { // Solo procesa si es un EPC nuevo para esta sesión
            long currentUniqueReadInSession = uniqueEpcsReadThisSession.size();

            if (targetCount > 0 && currentUniqueReadInSession > targetCount) {
                eventTypeName = EVENT_NAME_CONTEO_EXCESO;
            } else {
                eventTypeName = EVENT_NAME_CONTEO_LEIDO;
            }

            optTipoEvento = tipoEventoRepository.findByNombreEvento(eventTypeName);
            if (optTipoEvento.isEmpty()) {
                System.err.println("ERROR (Counting Logic): Tipo de evento '" + eventTypeName + "' no encontrado. EPC: " + normalizedEpc);
                return;
            }

            RfidEventEntity event = new RfidEventEntity(
                    normalizedEpc,
                    optTipoEvento.get(),
                    LocalDateTime.now(),
                    rssi,
                    antenna,
                    "No asignado",
                    null,
                    null
            );
            event.setSesionConteo(this.currentCountSession); // *** Asignar la sesión de conteo actual al evento ***
            rfidEventRepository.save(event);
            System.out.println("INFO (Counting Logic): Tag EPC: " + normalizedEpc + " contado. Total únicos en sesión: " + currentUniqueReadInSession + ". Evento: " + eventTypeName + ". SesionID: " + this.currentCountSession.getSesionConteoId());

            // Actualizar el contador en la entidad de sesión en memoria (se guardará al concluir)
            this.currentCountSession.setCantidadLeidosUnicos((int)currentUniqueReadInSession);
        }
    }

    // Llamado por TagEventService.stopReading() o al limpiar el modo.
    @Transactional
    public void concludeCurrentCountSession() {
        if (this.currentCountSession != null && this.currentCountSession.getFechaHoraFin() == null) {
            this.currentCountSession.setFechaHoraFin(LocalDateTime.now());
            // La cantidadLeidosUnicos ya se fue actualizando en processTag
            // this.currentCountSession.setCantidadLeidosUnicos(uniqueEpcsReadThisSession.size());

            lecturaConteoSesionRepository.save(this.currentCountSession);
            System.out.println("INFO (Counting Logic): Sesión de conteo ID: " + this.currentCountSession.getSesionConteoId() + " concluida. Objetivo: " + this.currentCountSession.getCantidadObjetivo() + ", Leídos Únicos: " + this.currentCountSession.getCantidadLeidosUnicos());
        } else {
            System.out.println("INFO (Counting Logic): No hay sesión de conteo activa para concluir o ya fue concluida.");
        }
    }

    public void clearState() {
        targetCount = 0;
        uniqueEpcsReadThisSession.clear();
        this.currentCountSession = null; // Importante resetear la sesión actual
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
            long currentCount = uniqueEpcsReadThisSession.size();
            return targetCount - currentCount;
        }
        return 0;
    }
}