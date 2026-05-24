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
#include "led_indicator.h"

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


    // Initialize mDNS so we can find this node via locustracer-XXXX.local
    init_mdns();

    // Initialize OTA update server
    ota_manager_init();

    // Initialize TSF UDP Broadcaster Task
    //tsf_sender_init();

    // Initialize audio payload transmitter
    //audio_transmitter_init();

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

    // Initialize API client and start task
    api_client_init();
    xTaskCreate(api_client_task, "api_client_task", 8192, NULL, 5, NULL);

    // Start the heartbeat LED
    led_indicator_start();

}