//Este objeto se usará para enviar la nueva descripción desde el frontend al backend. desde lista_esperada
package com.segel.api.dto;

public class UpdateDescriptionRequestDTO {

    private String descripcion;

    // Constructor vacío (necesario para la deserialización JSON)
    public UpdateDescriptionRequestDTO() {
    }

    // Constructor con argumentos
    public UpdateDescriptionRequestDTO(String descripcion) {
        this.descripcion = descripcion;
    }

    // Getter
    public String getDescripcion() {
        return descripcion;
    }

    // Setter
    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }
}