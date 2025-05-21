package com.segel.api.persistence;

import com.segel.api.model.RfidEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RfidEventRepository extends JpaRepository<RfidEventEntity, Long> {
    // Spring Data JPA generará automáticamente los métodos CRUD básicos:
    // save(), findById(), findAll(), deleteById(), etc.

    // Aquí puedes añadir métodos de consulta personalizados si los necesitas en el futuro.
    // Por ejemplo, para buscar todos los eventos de un EPC específico:
    // List<RfidEventEntity> findByEpc(String epc);
}