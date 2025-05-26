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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id", nullable = true)
    private LecturaListaSesionEntity sesion;

    // --- NUEVA RELACIÓN CON LecturaConteoSesionEntity ---
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_conteo_id", nullable = true) // 'sesion_conteo_id' es la FK en la tabla rfid_events
    private LecturaConteoSesionEntity sesionConteo; // Referencia a la entidad de la sesión de conteo


    // Constructor vacío
    public RfidEventEntity() {
    }

    // Constructor que incluye la sesión de lista pero no la de conteo (y viceversa podría existir)
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
        this.sesion = sesion;
        this.sesionConteo = null; // Por defecto
    }

    // Constructor para cuando se crea un evento sin ninguna sesión específica (o solo sesión de conteo)
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
        this.sesion = null;
        this.sesionConteo = null;
    }

    // Constructor "más completo" (ejemplo, puedes tener varias sobrecargas o usar setters)
    public RfidEventEntity(String epc, TipoEventoEntity tipoEvento, LocalDateTime eventTime,
                           String rssi, String antenna, String ticket, String estadoColor,
                           String descripcion, LecturaListaSesionEntity sesion,
                           LecturaConteoSesionEntity sesionConteo) {
        this.epc = epc;
        this.tipoEvento = tipoEvento;
        this.eventTime = eventTime;
        this.rssi = rssi;
        this.antenna = antenna;
        this.ticket = ticket;
        this.estadoColor = estadoColor;
        this.descripcion = descripcion;
        this.sesion = sesion;
        this.sesionConteo = sesionConteo;
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

    // Getters y Setters para la nueva relación de sesión de conteo
    public LecturaConteoSesionEntity getSesionConteo() {
        return sesionConteo;
    }

    public void setSesionConteo(LecturaConteoSesionEntity sesionConteo) {
        this.sesionConteo = sesionConteo;
    }
}