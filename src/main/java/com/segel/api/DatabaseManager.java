package com.segel.api;

import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.util.Properties;

@Component
public class DatabaseManager {

    private static String dbUrl;
    private static String dbUser;
    private static String dbPassword;

    static {
        loadDatabaseConfig();
    }

    private static void loadDatabaseConfig() {
        try (InputStream input = DatabaseManager.class.getClassLoader().getResourceAsStream("application.properties")) {
            Properties prop = new Properties();
            if (input != null) {
                prop.load(input);
                dbUrl = prop.getProperty("spring.datasource.url");
                dbUser = prop.getProperty("spring.datasource.username");
                dbPassword = prop.getProperty("spring.datasource.password");
            } else {
                throw new RuntimeException("No se encontró application.properties.");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void insertTag(String epc, String eventType, String rssi, String antenna, String ticket) {
        String sql = "INSERT INTO public.rfid_events (epc, event_type, event_time, rssi, antenna, ticket) VALUES (?, ?, NOW(), ?, ?, ?)";
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword);
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, epc);
            stmt.setString(2, eventType);
            stmt.setString(3, rssi);
            stmt.setString(4, antenna);
            stmt.setString(5, ticket);

            stmt.executeUpdate();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
