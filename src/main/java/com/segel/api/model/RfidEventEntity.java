package com.segel.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rfid_events")
public class RfidEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 128)
    private String epc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_tipo_evento", nullable = true)
    private TipoEventoEntity tipoEvento;

    @Column(name = "event_time")
    private LocalDateTime eventTime;

    @Column(length = 15)
    private String rssi;

    @Column(length = 10)
    private String antenna;

    @Column(length = 50)
    private String ticket;

    @Column(name = "estado_color", length = 15)
    private String estadoColor;

    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String descripcion;

    // --- NUEVA RELACIÓN CON LecturaListaSesionEntity ---
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id", nullable = true) // 'sesion_id' es la FK en la tabla rfid_events
    private LecturaListaSesionEntity sesion; // Referencia a la entidad de la sesión

    // Constructor vacío
    public RfidEventEntity() {
    }

    // Constructor para cuando se crea un evento sin una sesión de lista específica
    public RfidEventEntity(String epc, TipoEventoEntity tipoEvento, LocalDateTime eventTime,
                           String rssi, String antenna, String ticket,
                           String estadoColor, String descripcion) {
        this.epc = epc;
        this.tipoEvento = tipoEvento;
        this.eventTime = eventTime;
        this.rssi = rssi;
        this.antenna = antenna;
        this.ticket = ticket;
        this.estadoColor = estadoColor;
        this.descripcion = descripcion;
        this.sesion = null; // Por defecto, no pertenece a una sesión de lista específica
    }

    // Constructor completo (opcional, o usar setters)
    public RfidEventEntity(String epc, TipoEventoEntity tipoEvento, LocalDateTime eventTime,
                           String rssi, String antenna, String ticket,
                           String estadoColor, String descripcion, LecturaListaSesionEntity sesion) {
        this.epc = epc;
        this.tipoEvento = tipoEvento;
        this.eventTime = eventTime;
        this.rssi = rssi;
        this.antenna = antenna;
        this.ticket = ticket;
        this.estadoColor = estadoColor;
        this.descripcion = descripcion;
        this.sesion = sesion; // Asignar la sesión
    }


    // --- GETTERS Y SETTERS ---
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEpc() {
        return epc;
    }

    public void setEpc(String epc) {
        this.epc = epc;
    }

    public TipoEventoEntity getTipoEvento() {
        return tipoEvento;
    }

    public void setTipoEvento(TipoEventoEntity tipoEvento) {
        this.tipoEvento = tipoEvento;
    }

    public LocalDateTime getEventTime() {
        return eventTime;
    }

    public void setEventTime(LocalDateTime eventTime) {
        this.eventTime = eventTime;
    }

    public String getRssi() {
        return rssi;
    }

    public void setRssi(String rssi) {
        this.rssi = rssi;
    }

    public String getAntenna() {
        return antenna;
    }

    public void setAntenna(String antenna) {
        this.antenna = antenna;
    }

    public String getTicket() {
        return ticket;
    }

    public void setTicket(String ticket) {
        this.ticket = ticket;
    }

    public String getEstadoColor() {
        return estadoColor;
    }

    public void setEstadoColor(String estadoColor) {
        this.estadoColor = estadoColor;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public LecturaListaSesionEntity getSesion() {
        return sesion;
    }

    public void setSesion(LecturaListaSesionEntity sesion) {
        this.sesion = sesion;
    }
}