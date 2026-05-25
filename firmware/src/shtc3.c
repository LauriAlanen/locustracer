#include "shtc3.h"
#include "pin_config.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "SHTC3";

#define I2C_MASTER_NUM              0
#define I2C_MASTER_FREQ_HZ          100000
#define I2C_MASTER_TIMEOUT_MS       1000

#define SHTC3_SENSOR_ADDR           0x70

static i2c_master_dev_handle_t shtc3_handle = NULL;

// SHTC3 Commands
#define SHTC3_CMD_WAKEUP            0x3517
#define SHTC3_CMD_SLEEP             0xB098
#define SHTC3_CMD_MEAS_POLLING      0x7866

static esp_err_t shtc3_send_cmd(uint16_t cmd) {
    uint8_t data[2] = { cmd >> 8, cmd & 0xFF };
    return i2c_master_transmit(shtc3_handle, data, 2, I2C_MASTER_TIMEOUT_MS);
}

bool shtc3_init(void) {
    ESP_LOGI(TAG, "Initializing I2C Master for SHTC3 on SDA=%d SCL=%d", I2C_MASTER_SDA_PIN, I2C_MASTER_SCL_PIN);

    i2c_master_bus_config_t i2c_mst_config = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_MASTER_NUM,
        .scl_io_num = I2C_MASTER_SCL_PIN,
        .sda_io_num = I2C_MASTER_SDA_PIN,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    i2c_master_bus_handle_t bus_handle;
    ESP_ERROR_CHECK(i2c_new_master_bus(&i2c_mst_config, &bus_handle));

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = SHTC3_SENSOR_ADDR,
        .scl_speed_hz = I2C_MASTER_FREQ_HZ,
    };
    ESP_ERROR_CHECK(i2c_master_bus_add_device(bus_handle, &dev_cfg, &shtc3_handle));
    
    // Wake up to test communication, then sleep
    if (shtc3_send_cmd(SHTC3_CMD_WAKEUP) == ESP_OK) {
        ESP_LOGI(TAG, "SHTC3 Sensor detected successfully!");
        vTaskDelay(pdMS_TO_TICKS(20)); // Wait for wakeup
        shtc3_send_cmd(SHTC3_CMD_SLEEP);
        return true;
    } else {
        ESP_LOGE(TAG, "Failed to detect SHTC3 Sensor!");
        return false;
    }
}

esp_err_t shtc3_read(float *temperature, float *humidity) {
    esp_err_t ret;
    
    // Wakeup sensor
    ret = shtc3_send_cmd(SHTC3_CMD_WAKEUP);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Wakeup command failed: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Use a larger delay to account for potential 100Hz FreeRTOS tick rates (1 tick = 10ms)
    // pdMS_TO_TICKS(5) evaluates to 0 if tick rate is 100Hz, causing instant execution and a NACK!
    // Using 20ms guarantees at least 2 ticks.
    vTaskDelay(pdMS_TO_TICKS(20)); 
    
    // Send Measurement Command (T first, Normal Mode)
    ret = shtc3_send_cmd(SHTC3_CMD_MEAS_POLLING);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Measurement command failed: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Wait for measurement to complete (max 12.1 ms for normal mode). 
    // We wait 25ms to be absolutely safe across all tick rates.
    vTaskDelay(pdMS_TO_TICKS(25));
    
    // Read 6 bytes
    uint8_t data[6];
    ret = i2c_master_receive(shtc3_handle, data, sizeof(data), I2C_MASTER_TIMEOUT_MS);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2C read failed: %s", esp_err_to_name(ret));
    }
    
    // Go back to sleep
    shtc3_send_cmd(SHTC3_CMD_SLEEP);
    
    if (ret == ESP_OK) {
        uint16_t temp_raw = (data[0] << 8) | data[1];
        // data[2] is CRC (skipped for simplicity)
        uint16_t hum_raw = (data[3] << 8) | data[4];
        // data[5] is CRC
        
        if (temperature) {
            *temperature = -45.0f + 175.0f * ((float)temp_raw / 65536.0f);
        }
        if (humidity) {
            *humidity = 100.0f * ((float)hum_raw / 65536.0f);
        }
    }
    
    return ret;
}
