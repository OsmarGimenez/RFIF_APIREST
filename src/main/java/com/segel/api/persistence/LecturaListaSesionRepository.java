package com.segel.api.persistence;

import com.segel.api.model.LecturaListaSesionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LecturaListaSesionRepository extends JpaRepository<LecturaListaSesionEntity, Long> {

    // Método para buscar todas las sesiones ordenadas por fecha de inicio descendente (las más nuevas primero)
    List<LecturaListaSesionEntity> findAllByOrderByFechaHoraInicioDesc();

    // Podrías añadir otros métodos de búsqueda si los necesitas en el futuro, por ejemplo:
    // List<LecturaListaSesionEntity> findByFechaHoraInicioBetween(LocalDateTime inicio, LocalDateTime fin);
}