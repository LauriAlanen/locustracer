#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_ota_ops.h"
#include "wifi_manager.h"
#include "tsf_sender.h"
#include "mic_reader.h"
#include "audio_transmitter.h"
#include "ota_manager.h"
#include "mdns.h"
#include "esp_mac.h"
#include "api_client.h"
#include "buzzer.h"
#include "shtc3.h"

#define BLINK_GPIO 21

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

    // Initialize WiFi
    wifi_manager_init();
    
    // Wait for WiFi connection to establish
    printf("Waiting for Wi-Fi connection...\n");
    wifi_wait_for_connection();
    printf("Wi-Fi Connected!\n");

    // We successfully booted and connected to Wi-Fi. Mark this firmware as valid so it won't roll back.
    esp_ota_mark_app_valid_cancel_rollback();

    // Initialize mDNS so we can find this node via locustracer-XXXX.local
    init_mdns();

    // Initialize OTA update server
    ota_manager_init();

    // Initialize TSF UDP Broadcaster Task
    //tsf_sender_init();

    // Initialize audio payload transmitter
    //audio_transmitter_init();

    // Initialize microphone reader
    // mic_reader_init();

    // Initialize SHTC3 sensor first to detect node type (master vs listener)
    bool is_master = shtc3_init();

    // Initialize API client, pass the detected node type, and start task
    api_client_set_node_type(is_master);
    api_client_init();
    xTaskCreate(api_client_task, "api_client_task", 8192, NULL, 5, NULL);

    // Initialize buzzer and play a startup sound only on master
    if (is_master) {
        buzzer_init();
        buzzer_play_pitch_effect();
    }

    gpio_reset_pin(BLINK_GPIO);
    gpio_set_direction(BLINK_GPIO, GPIO_MODE_OUTPUT);

    while (1) {
        gpio_set_level(BLINK_GPIO, 1);
        vTaskDelay(1000 / portTICK_PERIOD_MS);

        gpio_set_level(BLINK_GPIO, 0);
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}