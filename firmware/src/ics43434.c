#include "ics43434.h"
#include "i2s_mic_reader.h"
#include "pin_config.h"

void ics43434_init(void) {
    i2s_mic_config_t config = {
        .bclk_pin = ICS43434_SCK_PIN,
        .ws_pin = ICS43434_WS_PIN,
        .data_in_pin = ICS43434_SD_PIN
    };

    i2s_mic_reader_init(&config);
}
