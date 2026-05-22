#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <stdbool.h>

/**
 * @brief Initialize the Wi-Fi module in Station (STA) mode and connect to configured AP
 *
 * This function initializes the necessary ESP-IDF Wi-Fi capabilities, handles
 * event registration for connection/disconnection tracking, and begins connecting
 * via the SSID/Password defined in wifi_config.h.
 */
void wifi_manager_init(void);

/**
 * @brief Wait for the Wi-Fi connection to be established and IP assigned.
 */
void wifi_wait_for_connection(void);

/**
 * @brief Check if the Wi-Fi connection is currently established.
 *
 * @return true if connected, false otherwise.
 */
bool wifi_is_connected(void);

/**
 * @brief Clear saved credentials and force ESP-NOW provisioning mode.
 */
void wifi_manager_start_provisioning(void);

#endif // WIFI_MANAGER_H
