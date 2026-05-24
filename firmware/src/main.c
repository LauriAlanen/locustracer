#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_ota_ops.h"
#include "wifi_manager.h"
#include "tsf_sender.h"
#include "ics43434.h"
#include "audio_transmitter.h"
#include "ota_manager.h"
#include "mdns.h"
#include "esp_mac.h"
#include "api_client.h"
#include "buzzer.h"
#include "shtc3.h"
<<<<<<< Updated upstream
#include "led_indicator.h"
=======
#include "driver/uart.h"

#define BLINK_GPIO 21
#define MONITOR_UART_NUM UART_NUM_1
#define MONITOR_UART_RX_PIN 44 // D7 on XIAO ESP32S3
#define MONITOR_UART_TX_PIN UART_PIN_NO_CHANGE

static void uart_monitor_task(void *arg)
{
    uart_config_t uart_config = {
        .baud_rate = 115200,
        .data_bits = UART_DATA_8_BITS,
        .parity    = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };

    ESP_ERROR_CHECK(uart_param_config(MONITOR_UART_NUM, &uart_config));
    ESP_ERROR_CHECK(uart_set_pin(MONITOR_UART_NUM, MONITOR_UART_TX_PIN, MONITOR_UART_RX_PIN, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(uart_driver_install(MONITOR_UART_NUM, 1024 * 2, 0, 0, NULL, 0));

    uint8_t *data = (uint8_t *) malloc(1024);
    char line_buf[256];
    int line_pos = 0;

    while (1) {
        int length = uart_read_bytes(MONITOR_UART_NUM, data, 1024, 20 / portTICK_PERIOD_MS);
        for (int i = 0; i < length; i++) {
            if (data[i] == '\n') {
                line_buf[line_pos] = '\0';
                printf("\033[1;35m[REMOTE NODE]\033[0m %s\n", line_buf);
                line_pos = 0;
            } else if (data[i] != '\r') {
                if (line_pos < sizeof(line_buf) - 1) {
                    line_buf[line_pos++] = data[i];
                }
            }
        }
    }
    free(data);
    vTaskDelete(NULL);
}

>>>>>>> Stashed changes

static void init_mdns(void)
{
    ESP_ERROR_CHECK(mdns_init());
    
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char hostname[32];
    snprintf(hostname, sizeof(hostname), "locustracer-%02x%02x", mac[4], mac[5]);
    
    ESP_ERROR_CHECK(mdns_hostname_set(hostname));
    ESP_ERROR_CHECK(mdns_instance_name_set("Locustracer Node"));

    mdns_service_add(NULL, "_http", "_tcp", 80, NULL, 0);

    ESP_LOGI("mDNS", "mDNS initialized. Hostname: %s.local", hostname);
}

void app_main(void)
{
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
      ESP_ERROR_CHECK(nvs_flash_erase());
      ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // --- DEDICATED MONITOR MODE ---
    // Commented out all other initializations to keep logs clean

    // // Initialize WiFi
    // wifi_manager_init();
    
    // // Wait for WiFi connection to establish
    // printf("Waiting for Wi-Fi connection...\n");
    // wifi_wait_for_connection();
    // printf("Wi-Fi Connected!\n");

<<<<<<< Updated upstream
=======
    // // We successfully booted and connected to Wi-Fi. Mark this firmware as valid so it won't roll back.
    // esp_ota_mark_app_valid_cancel_rollback();
>>>>>>> Stashed changes

    // // Initialize mDNS so we can find this node via locustracer-XXXX.local
    // init_mdns();

    // // Initialize OTA update server
    // ota_manager_init();

    // // Initialize TSF UDP Broadcaster Task
    // //tsf_sender_init();

    // // Initialize audio payload transmitter
    // //audio_transmitter_init();

<<<<<<< Updated upstream
#if NODE_IS_MASTER
    // Master Node (e.g. S2 Mini): Temp/Hum, Buzzer, NO Microphone
    shtc3_init();
    api_client_set_node_type(true);
    
    buzzer_init();
    buzzer_play_chirp_effect();
#else
    // Listener Node (e.g. XIAO ESP32S3): Microphone, NO Temp/Hum, NO Buzzer
    ics43434_init();
    api_client_set_node_type(false);
#endif
=======
    // // Initialize microphone reader
    // // mic_reader_init();
>>>>>>> Stashed changes

    // // Initialize API client and start task
    // api_client_init();
    // xTaskCreate(api_client_task, "api_client_task", 8192, NULL, 5, NULL);

<<<<<<< Updated upstream
    // Start the heartbeat LED
    led_indicator_start();
=======
    // // Initialize buzzer and play a startup sound
    // buzzer_init();
    // buzzer_play_pitch_effect();
    
    // // Initialize SHTC3 sensor
    // shtc3_init();

    // Start UART monitor task
    xTaskCreate(uart_monitor_task, "uart_monitor_task", 4096, NULL, 5, NULL);
>>>>>>> Stashed changes

}