#ifndef JITTERBUFFER_H
#define JITTERBUFFER_H

#include "AudioPacket.h"
#include <map>
#include <vector>
#include <cstdint>
#include <string>

class JitterBuffer {
public:
    // buffer_size is the number of packets to wait before playback begins
    JitterBuffer(size_t buffer_size = 5);

    // Push an incoming packet into the buffer
    void push(const AudioPacket& packet);

    // Attempt to pop the next ordered packet.
    // Returns true if a packet (real or dummy) is ready to be forwarded.
    bool pop(AudioPacket& out_packet);

    void reset();

private:
    size_t target_buffer_size_;
    std::map<uint32_t, AudioPacket> buffer_;
    uint32_t next_play_seq_;
    bool buffering_;
};

#endif // JITTERBUFFER_H
