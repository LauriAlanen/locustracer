#ifndef I2S_MIC_READER_H
#define I2S_MIC_READER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int bclk_pin;
    int ws_pin;
    int data_in_pin;
} i2s_mic_config_t;

void i2s_mic_reader_init(const i2s_mic_config_t *config);

#ifdef __cplusplus
}
#endif

#endif // I2S_MIC_READER_H
