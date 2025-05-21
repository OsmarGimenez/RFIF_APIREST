package com.segel.api;

public class TagEventDTO {
    private String epc;
    private String status;

    public TagEventDTO() {
    }

    public TagEventDTO(String epc, String status) {
        this.epc = epc;
        this.status = status;
    }

    public String getEpc() {
        return epc;
    }

    public void setEpc(String epc) {
        this.epc = epc;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
