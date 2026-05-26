#include "JitterBuffer.h"
#include <iostream>
#include <cstring>

JitterBuffer::JitterBuffer(size_t buffer_size) 
    : target_buffer_size_(buffer_size), next_play_seq_(0), buffering_(true) {}

void JitterBuffer::reset() {
    buffer_.clear();
    buffering_ = true;
    next_play_seq_ = 0;
}

void JitterBuffer::push(const AudioPacket& packet) {
    if (buffering_ && buffer_.empty()) {
        next_play_seq_ = packet.sequence_id;
    }
    
    // Drop strictly old packets if we're past them
    if (!buffering_ && packet.sequence_id < next_play_seq_) {
        // Late packet, drop it.
        return;
    }
    
    buffer_[packet.sequence_id] = packet;
    
    if (buffering_) {
        // Find the sequence span
        auto it_first = buffer_.begin();
        auto it_last = buffer_.rbegin();
        if (it_first != buffer_.end() && it_last != buffer_.rend()) {
            uint32_t span = it_last->first - it_first->first + 1;
            if (span >= target_buffer_size_) {
                buffering_ = false;
                next_play_seq_ = it_first->first;
            }
        }
    }
}

bool JitterBuffer::pop(AudioPacket& out_packet) {
    if (buffering_) {
        return false;
    }
    
    if (buffer_.empty()) {
        // Buffer underrun, need to re-buffer
        buffering_ = true;
        return false;
    }
    
    // Check if the exact expected packet is available
    auto it = buffer_.find(next_play_seq_);
    if (it != buffer_.end()) {
        out_packet = it->second;
        buffer_.erase(it);
        next_play_seq_++;
        return true;
    }
    
    // Packet is missing. We must inject silence to maintain perfect time alignment.
    // Let's create a dummy packet.
    out_packet.sequence_id = next_play_seq_;
    
    // Interpolate the TSF time based on the previous packet or next packet
    // Since we don't have the previous packet's TSF saved, we can look forward.
    auto next_it = buffer_.upper_bound(next_play_seq_);
    if (next_it != buffer_.end()) {
        uint32_t seq_diff = next_it->first - next_play_seq_;
        // 256 samples @ 48000Hz = 5333 us per packet
        out_packet.tsf_time = next_it->second.tsf_time - (seq_diff * 5333ULL);
    } else {
        out_packet.tsf_time = 0; // Fallback
    }
    
    std::memset(out_packet.audio_data, 0, sizeof(out_packet.audio_data));
    next_play_seq_++;
    return true;
}
