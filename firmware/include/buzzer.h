#ifndef BUZZER_H
#define BUZZER_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the buzzer module.
 */
void buzzer_init(void);

/**
 * @brief Turn the buzzer on or off.
 * 
 * @param on true to turn on, false to turn off.
 */
void buzzer_set_state(bool on);

/**
 * @brief Set the frequency of the buzzer.
 * 
 * @param freq_hz Frequency in Hertz.
 */
void buzzer_set_frequency(uint32_t freq_hz);

/**
 * @brief Set the volume of the buzzer.
 * 
 * @param volume_percent Volume from 0 to 100.
 */
void buzzer_set_volume(uint8_t volume_percent);

/**
 * @brief Play a pitching effect (sweep up and down).
 * Blocks the current task while playing.
 */
void buzzer_play_pitch_effect(void);

/**
 * @brief Play a short chirp effect.
 * Blocks the current task while playing.
 */
void buzzer_play_chirp_effect(void);

/**
 * @brief Play fast consecutive beeps.
 * Non-blocking (runs in its own task like pitch_effect).
 */
void buzzer_play_fast_beeps(void);

/**
 * @brief Play a single fast beep.
 * Non-blocking.
 */
void buzzer_play_single_beep(void);

/**
 * @brief Play a siren effect.
 * Non-blocking.
 */
void buzzer_play_siren(void);

/**
 * @brief Play a low frequency rumble effect.
 * Non-blocking.
 */
void buzzer_play_rumble(void);

#ifdef __cplusplus
}
#endif

#endif // BUZZER_H
