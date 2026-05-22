#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the API client
 */
void api_client_init(void);

/**
 * @brief Main task for the API client
 *
 * Runs periodically to push telemetry and pull configuration.
 *
 * @param pvParameters Task parameters
 */
void api_client_task(void *pvParameters);

// --- Dummy Hardware Callbacks ---

/**
 * @brief Get dummy temperature from sensor
 * @return float Temperature value
 */
float get_sensor_temp(void);

/**
 * @brief Get dummy humidity from sensor
 * @return float Humidity value
 */
float get_sensor_humidity(void);

/**
 * @brief Get dummy CPU temperature
 * @return float CPU temperature value
 */
float get_cpu_temp(void);

/**
 * @brief Trigger the buzzer
 */
void trigger_buzzer(void);

#ifdef __cplusplus
}
#endif
