package com.segel.api.model;

import jakarta.persistence.*;

@Entity
@Table(name = "tipos_evento")
public class TipoEventoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Asumiendo SERIAL en PostgreSQL
    @Column(name = "id_tipo_evento")
    private Integer idTipoEvento;

    @Column(name = "nombre_evento", nullable = false, unique = true, length = 50)
    private String nombreEvento;

    @Column(name = "descripcion_tipo", columnDefinition = "TEXT")
    private String descripcionTipo;

    // Constructores
    public TipoEventoEntity() {
    }

    public TipoEventoEntity(String nombreEvento, String descripcionTipo) {
        this.nombreEvento = nombreEvento;
        this.descripcionTipo = descripcionTipo;
    }

    // Getters y Setters
    public Integer getIdTipoEvento() {
        return idTipoEvento;
    }

    public void setIdTipoEvento(Integer idTipoEvento) {
        this.idTipoEvento = idTipoEvento;
    }

    public String getNombreEvento() {
        return nombreEvento;
    }

    public void setNombreEvento(String nombreEvento) {
        this.nombreEvento = nombreEvento;
    }

    public String getDescripcionTipo() {
        return descripcionTipo;
    }

    public void setDescripcionTipo(String descripcionTipo) {
        this.descripcionTipo = descripcionTipo;
    }
}