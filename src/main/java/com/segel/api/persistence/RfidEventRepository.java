package com.segel.api.persistence;

import com.segel.api.model.RfidEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional; // Asegúrate de que este import esté si no estaba.

@Repository
public interface RfidEventRepository extends JpaRepository<RfidEventEntity, Long> {

    // Método para buscar el último evento registrado para un EPC específico
    Optional<RfidEventEntity> findFirstByEpcOrderByEventTimeDesc(String epc);

    // Si en el futuro necesitas buscar TODOS los eventos de un EPC (no solo el último), podrías añadir:
    // import java.util.List;
    // List<RfidEventEntity> findByEpcOrderByEventTimeDesc(String epc);
}