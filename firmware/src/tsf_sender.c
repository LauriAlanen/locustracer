#include "tsf_sender.h"
#include "wifi_config.h"
#include "esp_wifi.h"
#include "esp_log.h"
#include "lwip/sockets.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "TSF_SENDER";

#define TSF_UDP_PORT 5005
#define SEND_INTERVAL_MS 100 // 10Hz

// Structure for the UDP payload
typedef struct __attribute__((packed)) {
    uint32_t sequence_id;
    uint64_t tsf_time;
} tsf_payload_t;

static void tsf_sender_task(void *pvParameters)
{
    ESP_LOGI(TAG, "Starting TSF sender task pinned to Core 1.");

    int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    if (sock < 0) {
        ESP_LOGE(TAG, "Unable to create socket: errno %d", errno);
        vTaskDelete(NULL);
        return;
    }

    struct sockaddr_in dest_addr;
    dest_addr.sin_addr.s_addr = inet_addr(PC_IP_ADDRESS);
    dest_addr.sin_family = AF_INET;
    dest_addr.sin_port = htons(TSF_UDP_PORT);

    const uint64_t interval_us = SEND_INTERVAL_MS * 1000ULL;

    while (1) {
        uint64_t now = esp_wifi_get_tsf_time(WIFI_IF_STA);

        // Calculate the next global TSF boundary we want to hit
        uint64_t next_boundary = ((now / interval_us) + 1) * interval_us;
        uint64_t micros_to_wait = next_boundary - now;

        if (micros_to_wait > 2000) { 
            vTaskDelay(pdMS_TO_TICKS((micros_to_wait - 1500) / 1000));
        }

        now = esp_wifi_get_tsf_time(WIFI_IF_STA);
        if (next_boundary > now) {
            esp_rom_delay_us(next_boundary - now);
        }

        uint64_t final_tsf = esp_wifi_get_tsf_time(WIFI_IF_STA);

        tsf_payload_t payload;
        // Derive globally uniform sequence ID from the actual TSF time
        payload.sequence_id = (uint32_t)(final_tsf / interval_us);
        payload.tsf_time = final_tsf; // Sends as little-endian by default on ESP32

        int err = sendto(sock, &payload, sizeof(payload), 0, (struct sockaddr *)&dest_addr, sizeof(dest_addr));
        if (err < 0) {
            ESP_LOGW(TAG, "Error occurred during sending: errno %d", errno);
        }
    }

    ESP_LOGE(TAG, "Shutting down socket and task...");
    shutdown(sock, 0);
    close(sock);
    vTaskDelete(NULL);
}

void tsf_sender_init(void)
{
    xTaskCreatePinnedToCore(
        tsf_sender_task,
        "tsf_sender",
        4096,
        NULL,
        configMAX_PRIORITIES - 1, // High priority
        NULL,
        tskNO_AFFINITY // Let FreeRTOS decide
    );
}
