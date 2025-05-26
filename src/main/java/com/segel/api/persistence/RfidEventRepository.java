package com.segel.api.persistence;

import com.segel.api.model.RfidEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RfidEventRepository extends JpaRepository<RfidEventEntity, Long> {

    Optional<RfidEventEntity> findFirstByEpcOrderByEventTimeDesc(String epc);

    // Para la pantalla "A Partir de Lista" (sesiones de lista)
    List<RfidEventEntity> findBySesion_SesionIdOrderByEventTimeDesc(Long sesionId);

    // --- NUEVO MÉTODO para la pantalla "Conteo por Cantidad" (sesiones de conteo) ---
    List<RfidEventEntity> findBySesionConteo_SesionConteoIdOrderByEventTimeDesc(Long sesionConteoId);
}