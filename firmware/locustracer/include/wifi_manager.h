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

#endif // WIFI_MANAGER_H
