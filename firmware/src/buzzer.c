#include "buzzer.h"
#include "pin_config.h"
#include "driver/ledc.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "buzzer";

#define BUZZER_LEDC_TIMER       LEDC_TIMER_0
#define BUZZER_LEDC_MODE        LEDC_LOW_SPEED_MODE
#define BUZZER_LEDC_CHANNEL     LEDC_CHANNEL_0
#define BUZZER_LEDC_DUTY_RES    LEDC_TIMER_13_BIT
#define BUZZER_DEFAULT_FREQ     (4000) 

static bool is_on = false;
static uint32_t current_duty = 40; // Default 1% volume (4095 * 1 / 100)

void buzzer_init(void)
{
    ESP_LOGI(TAG, "Initializing buzzer on GPIO %d", BUZZER_PIN);

    // Prepare and then apply the LEDC PWM timer configuration
    ledc_timer_config_t ledc_timer = {
        .speed_mode       = BUZZER_LEDC_MODE,
        .timer_num        = BUZZER_LEDC_TIMER,
        .duty_resolution  = BUZZER_LEDC_DUTY_RES,
        .freq_hz          = BUZZER_DEFAULT_FREQ,
        .clk_cfg          = LEDC_AUTO_CLK
    };
    ESP_ERROR_CHECK(ledc_timer_config(&ledc_timer));

    // Prepare and then apply the LEDC PWM channel configuration
    ledc_channel_config_t ledc_channel = {
        .speed_mode     = BUZZER_LEDC_MODE,
        .channel        = BUZZER_LEDC_CHANNEL,
        .timer_sel      = BUZZER_LEDC_TIMER,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = BUZZER_PIN,
        .duty           = 0, // Set duty to 0 initially
        .hpoint         = 0
    };
    ESP_ERROR_CHECK(ledc_channel_config(&ledc_channel));
}

void buzzer_set_state(bool on)
{
    is_on = on;
    if (on) {
        ESP_ERROR_CHECK(ledc_set_duty(BUZZER_LEDC_MODE, BUZZER_LEDC_CHANNEL, current_duty));
        ESP_ERROR_CHECK(ledc_update_duty(BUZZER_LEDC_MODE, BUZZER_LEDC_CHANNEL));
    } else {
        ESP_ERROR_CHECK(ledc_set_duty(BUZZER_LEDC_MODE, BUZZER_LEDC_CHANNEL, 0));
        ESP_ERROR_CHECK(ledc_update_duty(BUZZER_LEDC_MODE, BUZZER_LEDC_CHANNEL));
    }
}

void buzzer_set_volume(uint8_t volume_percent)
{
    if (volume_percent > 100) volume_percent = 100;
    
    // Map 0-100% to 0-4095 duty cycle.
    current_duty = (4095 * volume_percent) / 100;
    
    // Apply immediately if buzzer is currently on
    if (is_on) {
        ESP_ERROR_CHECK(ledc_set_duty(BUZZER_LEDC_MODE, BUZZER_LEDC_CHANNEL, current_duty));
        ESP_ERROR_CHECK(ledc_update_duty(BUZZER_LEDC_MODE, BUZZER_LEDC_CHANNEL));
    }
}

void buzzer_set_frequency(uint32_t freq_hz)
{
    ESP_ERROR_CHECK(ledc_set_freq(BUZZER_LEDC_MODE, BUZZER_LEDC_TIMER, freq_hz));
}

void buzzer_play_pitch_effect(void)
{
    ESP_LOGI(TAG, "Playing pitch effect");
    buzzer_set_state(true);
    
    // Sweep up
    for (uint32_t freq = 500; freq <= 4000; freq += 100) {
        buzzer_set_frequency(freq);
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    // Sweep down
    for (uint32_t freq = 4000; freq >= 500; freq -= 100) {
        buzzer_set_frequency(freq);
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    
    buzzer_set_state(false);
}

void buzzer_play_chirp_effect(void)
{
    ESP_LOGI(TAG, "Playing chirp effect (beep beep beep)");
    
    buzzer_set_frequency(4000);
    
    // Play 3 fast beeps
    for (int i = 0; i < 3; i++) {
        buzzer_set_state(true);
        vTaskDelay(pdMS_TO_TICKS(50));
        buzzer_set_state(false);
        if (i < 2) {
            vTaskDelay(pdMS_TO_TICKS(50));
        }
    }
}
