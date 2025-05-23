package com.segel.api.persistence;

import com.segel.api.model.RfidEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List; // Asegúrate de que este import esté
import java.util.Optional;

@Repository
public interface RfidEventRepository extends JpaRepository<RfidEventEntity, Long> {

    Optional<RfidEventEntity> findFirstByEpcOrderByEventTimeDesc(String epc);

    // ASEGÚRATE DE QUE ESTE MÉTODO EXISTA EXACTAMENTE ASÍ:
    List<RfidEventEntity> findBySesion_SesionIdOrderByEventTimeDesc(Long sesionId);
}