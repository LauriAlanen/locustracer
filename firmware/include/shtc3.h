#ifndef SHTC3_H
#define SHTC3_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the SHTC3 sensor (configures I2C peripheral).
 */
void shtc3_init(void);

/**
 * @brief Read temperature and humidity from the SHTC3 sensor.
 * 
 * @param temperature Pointer to store the temperature in Celsius.
 * @param humidity Pointer to store the relative humidity in %.
 * @return esp_err_t ESP_OK on success.
 */
esp_err_t shtc3_read(float *temperature, float *humidity);

#ifdef __cplusplus
}
#endif

#endif // SHTC3_H
