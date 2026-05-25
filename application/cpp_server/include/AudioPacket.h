#ifndef AUDIOPACKET_H
#define AUDIOPACKET_H

#include <cstdint>

#define MAX_SAMPLES_PER_PACKET 256

#pragma pack(push, 1)
struct AudioPacket {
    uint32_t sequence_id;
    uint64_t tsf_time;
    int32_t audio_data[MAX_SAMPLES_PER_PACKET];
};
#pragma pack(pop)

#endif // AUDIOPACKET_H
