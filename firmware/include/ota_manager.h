#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

/**
 * @brief Initialize the OTA manager.
 *        This starts an HTTP server listening for firmware updates on /update.
 */
void ota_manager_init(void);

#endif // OTA_MANAGER_H
