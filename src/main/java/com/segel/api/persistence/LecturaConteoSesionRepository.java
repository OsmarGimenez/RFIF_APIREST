package com.segel.api.persistence;

import com.segel.api.model.LecturaConteoSesionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LecturaConteoSesionRepository extends JpaRepository<LecturaConteoSesionEntity, Long> {

    // Método para buscar todas las sesiones de conteo ordenadas por fecha de inicio descendente
    List<LecturaConteoSesionEntity> findAllByOrderByFechaHoraInicioDesc();

    // Aquí podrías añadir otros métodos de búsqueda específicos para las sesiones de conteo si los necesitas en el futuro.
}