package com.segel.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lectura_conteo_sesion")
public class LecturaConteoSesionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Asumiendo BIGSERIAL o SERIAL en PostgreSQL
    @Column(name = "sesion_conteo_id")
    private Long sesionConteoId;

    @Column(name = "fecha_hora_inicio", nullable = false)
    private LocalDateTime fechaHoraInicio;

    @Column(name = "fecha_hora_fin")
    private LocalDateTime fechaHoraFin;

    @Column(name = "cantidad_objetivo")
    private Integer cantidadObjetivo = 0;

    @Column(name = "cantidad_leidos_unicos")
    private Integer cantidadLeidosUnicos = 0;

    // Los campos cantidad_faltantes y cantidad_excedentes se calcularán
    // y no se persistirán directamente aquí, según lo acordado.
    // Si decides persistirlos, puedes añadirlos aquí.

    // Constructores
    public LecturaConteoSesionEntity() {
    }

    // Constructor útil para la creación inicial de la sesión de conteo
    public LecturaConteoSesionEntity(LocalDateTime fechaHoraInicio, Integer cantidadObjetivo) {
        this.fechaHoraInicio = fechaHoraInicio;
        this.cantidadObjetivo = cantidadObjetivo;
        this.cantidadLeidosUnicos = 0; // Se inicializa en 0
    }

    // Getters y Setters
    public Long getSesionConteoId() {
        return sesionConteoId;
    }

    public void setSesionConteoId(Long sesionConteoId) {
        this.sesionConteoId = sesionConteoId;
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

    public Integer getCantidadObjetivo() {
        return cantidadObjetivo;
    }

    public void setCantidadObjetivo(Integer cantidadObjetivo) {
        this.cantidadObjetivo = cantidadObjetivo;
    }

    public Integer getCantidadLeidosUnicos() {
        return cantidadLeidosUnicos;
    }

    public void setCantidadLeidosUnicos(Integer cantidadLeidosUnicos) {
        this.cantidadLeidosUnicos = cantidadLeidosUnicos;
    }
}