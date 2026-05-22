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
 * @brief Get dummy CPU temperature
 * @return float CPU temperature value
 */
float get_cpu_temp(void);

#ifdef __cplusplus
}
#endif
