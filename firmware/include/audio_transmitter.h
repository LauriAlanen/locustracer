#ifndef AUDIO_TRANSMITTER_H
#define AUDIO_TRANSMITTER_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

void audio_transmitter_init(void);

// Send audio samples wrapped with a TSF timestamp and sequence ID over UDP
void audio_transmitter_send(int32_t *data, size_t num_samples, uint64_t tsf_time);

#ifdef __cplusplus
}
#endif

#endif // AUDIO_TRANSMITTER_H
