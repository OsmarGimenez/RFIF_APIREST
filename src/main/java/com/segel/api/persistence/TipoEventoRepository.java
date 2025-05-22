package com.segel.api.persistence;

import com.segel.api.model.TipoEventoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TipoEventoRepository extends JpaRepository<TipoEventoEntity, Integer> {

    // Método para buscar un tipo de evento por su nombre
    // Esto será útil para obtener la entidad a partir de un string como "Entrada" o "Salida"
    Optional<TipoEventoEntity> findByNombreEvento(String nombreEvento);
}