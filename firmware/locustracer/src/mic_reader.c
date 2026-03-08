#include "mic_reader.h"
#include "pin_config.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2s_std.h"
#include "esp_log.h"
#include <stdlib.h>

static const char *TAG = "MicReader";

static i2s_chan_handle_t rx_chan;

static void mic_reader_task(void *pvParameters) {
    ESP_LOGI(TAG, "Microphone reader task started");

    const size_t read_frames = 1024;
    const size_t alloc_bytes = read_frames * sizeof(int32_t);
    int32_t *raw_samples = malloc(alloc_bytes);
    if (!raw_samples) {
        ESP_LOGE(TAG, "Failed to allocate memory for samples");
        vTaskDelete(NULL);
        return;
    }

    size_t bytes_read = 0;
    uint32_t loop_counter = 0;

    while (1) {
        // Read raw data from I2S DMA buffer
        esp_err_t res = i2s_channel_read(rx_chan, raw_samples, alloc_bytes, &bytes_read, portMAX_DELAY);
        if (res == ESP_OK) {
            // Calculate a simple peak volume to verify data is arriving
            int32_t peak = 0;
            int samples_read = bytes_read / sizeof(int32_t);
            
            for (int i = 0; i < samples_read; i++) {
                // The INMP441 provides 24-bit data.
                // It is shifted to the MSB of the 32-bit slot, meaning the bottom 8 bits are 0.
                // We shift down by 8 to get a true 24-bit signed integer value.
                int32_t sample = raw_samples[i] >> 8;
                
                // Get absolute value
                if (sample < 0) {
                    sample = -sample;
                }
                
                if (sample > peak) {
                    peak = sample;
                }
            }

            // Print the peak volume every ~500ms (assuming 48kHz and 1024 frames per chunk)
            // 48000 / 1024 ~= 46 chunks per second
            if (++loop_counter >= 23) {
                ESP_LOGI(TAG, "Audio Peak Vol: %ld", (long)peak);
                loop_counter = 0;
            }
            
        } else {
            ESP_LOGE(TAG, "I2S read error: %s", esp_err_to_name(res));
        }
    }
}

void mic_reader_init(void) {
    ESP_LOGI(TAG, "Initializing I2S Standard for INMP441...");

    i2s_chan_config_t rx_chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    rx_chan_cfg.dma_desc_num = 6;
    rx_chan_cfg.dma_frame_num = 1024;
    ESP_ERROR_CHECK(i2s_new_channel(&rx_chan_cfg, NULL, &rx_chan));

    i2s_std_config_t rx_std_cfg = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(48000), // 48KHz sample rate
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = INMP441_SCK_PIN,
            .ws   = INMP441_WS_PIN,
            .dout = I2S_GPIO_UNUSED,
            .din  = INMP441_SD_PIN,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv   = false,
            },
        },
    };

    // By default, INMP441 configured for Mono (L/R grounded) outputs on the left channel
    rx_std_cfg.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;

    ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx_chan, &rx_std_cfg));
    ESP_ERROR_CHECK(i2s_channel_enable(rx_chan));
    
    BaseType_t ret = xTaskCreatePinnedToCore(mic_reader_task, 
                                             "mic_reader_task", 
                                             4096, 
                                             NULL, 
                                             10,
                                             NULL, 
                                             1);

    if (ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create microphone reader task");
    } else {
        ESP_LOGI(TAG, "Microphone reader initialization complete");
    }
}
