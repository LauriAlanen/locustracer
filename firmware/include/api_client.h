#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Set the node type based on hardware detection.
 * @param is_master True if this is a master node, false if listener.
 */
void api_client_set_node_type(bool is_master);

/**
 * @brief Initialize the WebSocket API client.
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
