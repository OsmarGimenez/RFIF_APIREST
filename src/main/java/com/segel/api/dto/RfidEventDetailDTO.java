package com.segel.api.dto;

import java.time.LocalDateTime;

public class RfidEventDetailDTO {

    private Long id; // ID del registro en rfid_events
    private String epc;
    private LocalDateTime eventTime;
    private String rssi;
    private String antenna;
    private String ticket;
    private String estadoColor; // de rfid_events.estado_color
    private String descripcion;   // la descripción editable del evento individual, de rfid_events.descripcion

    private String nombreDelTipoDeEvento;     // de tipos_evento.nombre_evento
    private String descripcionDelTipoDeEvento; // de tipos_evento.descripcion_tipo

    // Constructor vacío
    public RfidEventDetailDTO() {
    }

    // Constructor con todos los campos (puedes generar getters y setters con tu IDE)
    public RfidEventDetailDTO(Long id, String epc, LocalDateTime eventTime, String rssi, String antenna, String ticket,
                              String estadoColor, String descripcion, String nombreDelTipoDeEvento, String descripcionDelTipoDeEvento) {
        this.id = id;
        this.epc = epc;
        this.eventTime = eventTime;
        this.rssi = rssi;
        this.antenna = antenna;
        this.ticket = ticket;
        this.estadoColor = estadoColor;
        this.descripcion = descripcion;
        this.nombreDelTipoDeEvento = nombreDelTipoDeEvento;
        this.descripcionDelTipoDeEvento = descripcionDelTipoDeEvento;
    }

    // --- GETTERS Y SETTERS ---
    // (Por brevedad, no los incluyo todos aquí, pero deberías tenerlos para todos los campos)

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

    public String getNombreDelTipoDeEvento() {
        return nombreDelTipoDeEvento;
    }

    public void setNombreDelTipoDeEvento(String nombreDelTipoDeEvento) {
        this.nombreDelTipoDeEvento = nombreDelTipoDeEvento;
    }

    public String getDescripcionDelTipoDeEvento() {
        return descripcionDelTipoDeEvento;
    }

    public void setDescripcionDelTipoDeEvento(String descripcionDelTipoDeEvento) {
        this.descripcionDelTipoDeEvento = descripcionDelTipoDeEvento;
    }
}