package com.segel.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lectura_lista_sesion")
public class LecturaListaSesionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Asumiendo BIGSERIAL o SERIAL
    @Column(name = "sesion_id")
    private Long sesionId;

    @Column(name = "fecha_hora_inicio", nullable = false)
    private LocalDateTime fechaHoraInicio;

    @Column(name = "fecha_hora_fin")
    private LocalDateTime fechaHoraFin;

    @Column(name = "total_esperado")
    private Integer totalEsperado = 0;

    @Column(name = "total_coincidentes")
    private Integer totalCoincidentes = 0;

    @Column(name = "total_pendientes")
    private Integer totalPendientes = 0;

    @Column(name = "total_no_corresponden")
    private Integer totalNoCorresponden = 0;

    @Column(name = "lista_epcs_esperados_serializada", columnDefinition = "TEXT")
    private String listaEpcsEsperadosSerializada;

    // Opcional: Relación inversa si quieres navegar desde la sesión a sus eventos.
    // Puede impactar el rendimiento si no se maneja con cuidado (LAZY fetching es bueno).
    // @OneToMany(mappedBy = "sesion", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    // private List<RfidEventEntity> rfidEvents;

    // Constructores
    public LecturaListaSesionEntity() {
    }

    // Constructor útil para la creación inicial de la sesión
    public LecturaListaSesionEntity(LocalDateTime fechaHoraInicio, Integer totalEsperado, String listaEpcsEsperadosSerializada) {
        this.fechaHoraInicio = fechaHoraInicio;
        this.totalEsperado = totalEsperado;
        this.listaEpcsEsperadosSerializada = listaEpcsEsperadosSerializada;
        // Los otros contadores se inicializan en 0 por defecto o se actualizan después.
    }

    // Getters y Setters
    public Long getSesionId() {
        return sesionId;
    }

    public void setSesionId(Long sesionId) {
        this.sesionId = sesionId;
    }

    public LocalDateTime getFechaHoraInicio() {
        return fechaHoraInicio;
    }

    public void setFechaHoraInicio(LocalDateTime fechaHoraInicio) {
        this.fechaHoraInicio = fechaHoraInicio;
    }

    public LocalDateTime getFechaHoraFin() {
        return fechaHoraFin;
    }

    public void setFechaHoraFin(LocalDateTime fechaHoraFin) {
        this.fechaHoraFin = fechaHoraFin;
    }

    public Integer getTotalEsperado() {
        return totalEsperado;
    }

    public void setTotalEsperado(Integer totalEsperado) {
        this.totalEsperado = totalEsperado;
    }

    public Integer getTotalCoincidentes() {
        return totalCoincidentes;
    }

    public void setTotalCoincidentes(Integer totalCoincidentes) {
        this.totalCoincidentes = totalCoincidentes;
    }

    public Integer getTotalPendientes() {
        return totalPendientes;
    }

    public void setTotalPendientes(Integer totalPendientes) {
        this.totalPendientes = totalPendientes;
    }

    public Integer getTotalNoCorresponden() {
        return totalNoCorresponden;
    }

    public void setTotalNoCorresponden(Integer totalNoCorresponden) {
        this.totalNoCorresponden = totalNoCorresponden;
    }

    public String getListaEpcsEsperadosSerializada() {
        return listaEpcsEsperadosSerializada;
    }

    public void setListaEpcsEsperadosSerializada(String listaEpcsEsperadosSerializada) {
        this.listaEpcsEsperadosSerializada = listaEpcsEsperadosSerializada;
    }

}