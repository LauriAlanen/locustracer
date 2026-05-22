#ifndef ESP_NOW_PROV_H
#define ESP_NOW_PROV_H

#include <stdbool.h>

/**
 * @brief Initialize and start ESP-NOW in Master mode (broadcasting/provisioning others).
 *        Should be called after Wi-Fi is connected and initialized.
 */
void esp_now_prov_master_start(void);

/**
 * @brief Initialize and start ESP-NOW in Slave mode (waiting for provisioning).
 *        Should be called after Wi-Fi is initialized in STA mode (not connected).
 */
void esp_now_prov_slave_start(void);

/**
 * @brief Callback type for when credentials are received in Slave mode.
 */
typedef void (*esp_now_prov_creds_cb_t)(const char* ssid, const char* pass);

/**
 * @brief Register callback to receive credentials.
 */
void esp_now_prov_set_creds_cb(esp_now_prov_creds_cb_t cb);

/**
 * @brief Callback type for when Slave provisioning sweeps timeout.
 */
typedef void (*esp_now_prov_timeout_cb_t)(void);

/**
 * @brief Register callback for Slave provisioning timeout.
 */
void esp_now_prov_set_timeout_cb(esp_now_prov_timeout_cb_t cb);

/**
 * @brief Initialize ESP-NOW and start monitoring for Master heartbeats.
 *        Should be called after Slave successfully connects to Wi-Fi.
 */
void esp_now_prov_slave_monitor_start(void);

#endif // ESP_NOW_PROV_H
