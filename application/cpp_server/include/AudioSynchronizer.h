#ifndef AUDIOSYNCHRONIZER_H
#define AUDIOSYNCHRONIZER_H

#include "AudioPacket.h"
#include "Pipeline.h"
#include <string>
#include <vector>
#include <unordered_map>
#include <map>
#include <memory>
#include <mutex>

class AudioSynchronizer {
public:
    AudioSynchronizer(size_t frame_size, uint32_t sample_rate);

    // Feed a packet to the synchronizer
    void pushPacket(const std::string& ip_address, const AudioPacket* packet, size_t packet_size);

    // Set the pipeline to trigger when a frame is ready
    void setPipelineStages(std::vector<std::shared_ptr<IPipelineStage>> stages);

private:
    size_t frame_size_;
    uint32_t sample_rate_;

    std::mutex pipeline_mutex_;
    std::vector<std::shared_ptr<IPipelineStage>> pipeline_stages_;

    struct NodeBuffer {
        std::map<uint64_t, float> samples; // Absolute sample index -> value
        uint64_t max_sample_index = 0;
    };

    std::unordered_map<std::string, NodeBuffer> node_buffers_;
    uint64_t next_frame_start_idx_ = 0;
    bool initialized_ = false;
    
    std::vector<std::string> expected_nodes_;

    void tryEmitFrame();
};

#endif // AUDIOSYNCHRONIZER_H
