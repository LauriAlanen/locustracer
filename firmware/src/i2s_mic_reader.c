#include "i2s_mic_reader.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2s_std.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include <stdlib.h>
#include "audio_transmitter.h"

static const char *TAG = "I2SMicReader";
static i2s_chan_handle_t rx_chan;

static void i2s_mic_reader_task(void *pvParameters) {
    ESP_LOGI(TAG, "I2S Microphone reader task started");

    // We want our chunks to match the maximum packet size (256 frames = 1024 bytes)
    const size_t read_frames = 256;
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
            int samples_read = bytes_read / sizeof(int32_t);
            
            // Get the raw TSF time immediately after the blocking read completes.
            uint64_t current_tsf = esp_wifi_get_tsf_time(WIFI_IF_STA);
            
            // The ideal time advanced strictly by the number of samples at exactly 48000 Hz.
            static uint64_t total_samples_read = 0;
            static int64_t tsf_offset = 0;

            uint64_t ideal_audio_time = (total_samples_read * 1000000ULL) / 48000ULL;
            int64_t current_offset = (int64_t)current_tsf - (int64_t)ideal_audio_time;

            if (total_samples_read == 0) {
                tsf_offset = current_offset;
            } else {
                // Exponential Moving Average (Alpha = 1/64)
                // This eliminates OS scheduling jitter but perfectly tracks crystal oscillator drift.
                tsf_offset = tsf_offset + ((current_offset - tsf_offset) / 64);
            }

            uint64_t filtered_tsf = ideal_audio_time + tsf_offset;
            total_samples_read += samples_read;

            // Send to Python Backend
            audio_transmitter_send(raw_samples, samples_read, filtered_tsf);

            // Calculate a simple peak volume to verify data is arriving
            int32_t peak = 0;
            
            for (int i = 0; i < samples_read; i++) {
                // Shift down 8 to get a true 24-bit signed integer value
                int32_t sample = raw_samples[i] >> 8;
                
                if (sample < 0) {
                    sample = -sample;
                }
                
                if (sample > peak) {
                    peak = sample;
                }
            }

            // Print the peak volume every ~1000ms
            if (++loop_counter >= 187) {
                ESP_LOGI(TAG, "Audio Peak Vol: %ld | TSF: %llu (Raw: %llu)", (long)peak, filtered_tsf, current_tsf);
                loop_counter = 0;
            }
            
        } else {
            ESP_LOGE(TAG, "I2S read error: %s", esp_err_to_name(res));
        }
    }
}

void i2s_mic_reader_init(const i2s_mic_config_t *config) {
    ESP_LOGI(TAG, "Initializing I2S Standard for Microphone...");

    i2s_chan_config_t rx_chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    rx_chan_cfg.dma_desc_num = 12;
    rx_chan_cfg.dma_frame_num = 256;
    ESP_ERROR_CHECK(i2s_new_channel(&rx_chan_cfg, NULL, &rx_chan));

    i2s_std_config_t rx_std_cfg = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(48000), // 48KHz sample rate
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = config->bclk_pin,
            .ws   = config->ws_pin,
            .dout = I2S_GPIO_UNUSED,
            .din  = config->data_in_pin,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv   = false,
            },
        },
    };

    rx_std_cfg.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;

    ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx_chan, &rx_std_cfg));
    ESP_ERROR_CHECK(i2s_channel_enable(rx_chan));
    
    BaseType_t ret = xTaskCreatePinnedToCore(i2s_mic_reader_task, 
                                             "i2s_mic_task", 
                                             4096, 
                                             NULL, 
                                             10,
                                             NULL, 
                                             tskNO_AFFINITY);

    if (ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create microphone reader task");
    } else {
        ESP_LOGI(TAG, "Microphone reader initialization complete");
    }
}
