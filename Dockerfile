# Etapa 1: Construir la aplicación con Gradle y JRE (JDK)
FROM gradle:8.5-jdk17 AS builder
WORKDIR /app
COPY build.gradle settings.gradle gradlew ./
COPY gradle ./gradle
RUN ./gradlew build --no-daemon -x test || return 0 # Construye y permite que los tests fallen sin detener el build de la imagen
COPY . .
RUN ./gradlew build --no-daemon -x test # Vuelve a construir con todo el código fuente

# Etapa 2: Crear la imagen final con solo el JRE y el JAR de la aplicación
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Copia el JAR de la etapa de construcción
COPY --from=builder /app/build/libs/*.jar app.jar

# Puerto que expone la aplicación Spring Boot (el que usa Tomcat incorporado)
EXPOSE 8080

# Comando para ejecutar la aplicación cuando el contenedor se inicie
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

# Opcional: Puedes pasar argumentos de JVM aquí si es necesario
# ENV JAVA_OPTS=""
# ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]