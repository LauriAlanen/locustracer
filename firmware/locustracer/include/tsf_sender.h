#ifndef TSF_SENDER_H
#define TSF_SENDER_H

/**
 * @brief Initialize and start the TSF (Time Synchronization Function) sender task.
 * 
 * This function creates a FreeRTOS task pinned to Core 1 that reads the 64-bit
 * TSF timestamp from the Wi-Fi interface and broadcasts it via UDP.
 */
void tsf_sender_init(void);

#endif // TSF_SENDER_H
