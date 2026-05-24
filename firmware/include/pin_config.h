#ifndef PIN_CONFIG_H
#define PIN_CONFIG_H

// Define GPIO pins for the LocustTracer project

#ifdef BOARD_LOLIN_S2_MINI

// WEMOS LOLIN S2 MINI pins
#define ICS43434_SCK_PIN  33
#define ICS43434_WS_PIN   35
#define ICS43434_SD_PIN   37

#define BUZZER_PIN        10

#define I2C_MASTER_SDA_PIN 8
#define I2C_MASTER_SCL_PIN 9

#else

// Default (Seeed XIAO ESP32S3) pins
// Using D7, D8, D9 as these are 100% safe and not strapping pins
#define ICS43434_SCK_PIN  8  // D9
#define ICS43434_SD_PIN   7 // D8
#define ICS43434_WS_PIN   44  // D7

#define BUZZER_PIN       9  // D10 pin on Seeed XIAO ESP32S3

#define I2C_MASTER_SDA_PIN 5 // D4
#define I2C_MASTER_SCL_PIN 6 // D5

#endif

#endif // PIN_CONFIG_H