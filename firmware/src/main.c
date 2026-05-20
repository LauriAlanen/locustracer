#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "wifi_manager.h"
#include "tsf_sender.h"
#include "mic_reader.h"
#include "audio_transmitter.h"

#define BLINK_GPIO 38

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

    // Initialize TSF UDP Broadcaster Task
    //tsf_sender_init();

    // Initialize audio payload transmitter
    audio_transmitter_init();

    // Initialize microphone reader
    mic_reader_init();

    gpio_reset_pin(BLINK_GPIO);
    gpio_set_direction(BLINK_GPIO, GPIO_MODE_OUTPUT);

    while (1) {
        gpio_set_level(BLINK_GPIO, 1);
        vTaskDelay(500 / portTICK_PERIOD_MS);

        gpio_set_level(BLINK_GPIO, 0);
        vTaskDelay(500 / portTICK_PERIOD_MS);
    }
}