#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "led_indicator.h"

#ifdef BOARD_ESP32_S3_DEVKITC_1
#include "led_strip.h"
#define BLINK_GPIO 48 // Use 38 for Rev 1.1 boards!
#else
#define BLINK_GPIO 21
#endif

static void led_indicator_task(void *pvParameters) {
#ifdef BOARD_ESP32_S3_DEVKITC_1
    // Configure the NeoPixel RGB LED on DevKitC-1
    led_strip_handle_t led_strip;
    led_strip_config_t strip_config = {
        .strip_gpio_num = BLINK_GPIO,
        .max_leds = 1, 
    };
    led_strip_rmt_config_t rmt_config = {
        .resolution_hz = 10 * 1000 * 1000, // 10MHz
    };
    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip));
    led_strip_clear(led_strip);

    uint8_t led_state = 0;
    while (1) {
        if (led_state) {
            // Heartbeat: Faint blue color
            led_strip_set_pixel(led_strip, 0, 0, 0, 16);
            led_strip_refresh(led_strip);
        } else {
            led_strip_clear(led_strip);
        }
        led_state = !led_state;
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
#else
    gpio_reset_pin(BLINK_GPIO);
    gpio_set_direction(BLINK_GPIO, GPIO_MODE_OUTPUT);

    while (1) {
        gpio_set_level(BLINK_GPIO, 1);
        vTaskDelay(1000 / portTICK_PERIOD_MS);

        gpio_set_level(BLINK_GPIO, 0);
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
#endif
}

void led_indicator_start(void) {
    xTaskCreate(led_indicator_task, "led_task", 2048, NULL, 1, NULL);
}
