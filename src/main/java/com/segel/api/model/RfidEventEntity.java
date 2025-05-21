package com.segel.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rfid_events") // Asegúrate que este sea el nombre exacto de tu tabla
public class RfidEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Asume ID autoincremental
    private Long id;

    private String epc;

    @Column(name = "event_type")
    private String eventType;

    @Column(name = "event_time")
    private LocalDateTime eventTime;

    private String rssi;
    private String antenna;
    private String ticket;

    // Constructor vacío (requerido por JPA)
    public RfidEventEntity() {
    }

    // Constructor para facilitar la creación de instancias
    public RfidEventEntity(String epc, String eventType, LocalDateTime eventTime, String rssi, String antenna, String ticket) {
        this.epc = epc;
        this.eventType = eventType;
        this.eventTime = eventTime;
        this.rssi = rssi;
        this.antenna = antenna;
        this.ticket = ticket;
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

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
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
}