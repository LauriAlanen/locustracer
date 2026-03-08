#include "audio_transmitter.h"
#include "wifi_config.h"
#include "esp_log.h"
#include "lwip/sockets.h"
#include <string.h>

static const char *TAG = "AudioTx";

#define AUDIO_UDP_PORT 5006
#define MAX_SAMPLES_PER_PACKET 256

// Shared socket and address
static int audio_sock = -1;
static struct sockaddr_in dest_addr;
static uint32_t current_seq_id = 0;

typedef struct __attribute__((packed)) {
    uint32_t sequence_id;
    uint64_t tsf_time;
    int32_t audio_data[MAX_SAMPLES_PER_PACKET];
} audio_packet_t;

void audio_transmitter_init(void) {
    ESP_LOGI(TAG, "Initializing Audio UDP Transmitter...");

    audio_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    if (audio_sock < 0) {
        ESP_LOGE(TAG, "Unable to create socket: errno %d", errno);
        return;
    }

    dest_addr.sin_addr.s_addr = inet_addr(PC_IP_ADDRESS);
    dest_addr.sin_family = AF_INET;
    dest_addr.sin_port = htons(AUDIO_UDP_PORT);
    
    ESP_LOGI(TAG, "Audio transmitter ready. Target: %s:%d", PC_IP_ADDRESS, AUDIO_UDP_PORT);
}

void audio_transmitter_send(int32_t *data, size_t num_samples, uint64_t tsf_time) {
    if (audio_sock < 0) return;
    if (num_samples > MAX_SAMPLES_PER_PACKET) {
        ESP_LOGW(TAG, "Too many samples for packet: %d", num_samples);
        num_samples = MAX_SAMPLES_PER_PACKET;
    }

    audio_packet_t packet;
    packet.sequence_id = current_seq_id++;
    packet.tsf_time = tsf_time;

    // We can use memcpy for raw bit preservation of the 32-bit (24-bit real) I2S samples
    memcpy(packet.audio_data, data, num_samples * sizeof(int32_t));

    // Calculate actual payload size
    size_t payload_size = sizeof(uint32_t) + sizeof(uint64_t) + (num_samples * sizeof(int32_t));

    int err = sendto(audio_sock, &packet, payload_size, 0, (struct sockaddr *)&dest_addr, sizeof(dest_addr));
    if (err < 0) {
        // ESP_LOGW(TAG, "Error occurred during sending audio: errno %d", errno); // Commented out to prevent log spam on failure
    }
}
