#include "AudioSynchronizer.h"
#include <iostream>

AudioSynchronizer::AudioSynchronizer(size_t frame_size, uint32_t sample_rate)
    : frame_size_(frame_size), sample_rate_(sample_rate) {
}

void AudioSynchronizer::setPipelineStages(std::vector<std::shared_ptr<IPipelineStage>> stages) {
    std::lock_guard<std::mutex> lock(pipeline_mutex_);
    pipeline_stages_ = std::move(stages);
}

void AudioSynchronizer::pushPacket(const std::string& ip_address, const AudioPacket* packet, size_t packet_size) {
    size_t header_size = sizeof(packet->sequence_id) + sizeof(packet->tsf_time);
    if (packet_size <= header_size) return;

    size_t num_samples = (packet_size - header_size) / sizeof(int32_t);
    if (num_samples > MAX_SAMPLES_PER_PACKET) {
        num_samples = MAX_SAMPLES_PER_PACKET;
    }

    auto& buf = node_buffers_[ip_address];

    uint64_t raw_idx = (packet->tsf_time * sample_rate_) / 1000000;
    if (!buf.has_first_packet) {
        buf.expected_next_idx = raw_idx;
        buf.has_first_packet = true;
    } else {
        int64_t drift = static_cast<int64_t>(raw_idx) - static_cast<int64_t>(buf.expected_next_idx);
        if (std::abs(drift) > 1000) {
            buf.expected_next_idx = raw_idx;
        }
    }

    uint64_t start_sample_idx = buf.expected_next_idx;
    buf.expected_next_idx += num_samples;

    // First time initialization to align frames
    if (!initialized_) {
        next_frame_start_idx_ = start_sample_idx;
        initialized_ = true;
    }

    for (size_t i = 0; i < num_samples; ++i) {
        // Convert to float, normalize if necessary. 
        // Assuming 24-bit I2S data in 32-bit int, standard int32 range
        buf.samples[start_sample_idx + i] = static_cast<float>(packet->audio_data[i]);
    }
    
    if (start_sample_idx + num_samples > buf.max_sample_index) {
        buf.max_sample_index = start_sample_idx + num_samples;
    }

    // Try to build a frame
    tryEmitFrame();
}

void AudioSynchronizer::tryEmitFrame() {
    if (node_buffers_.size() < 3) return; // Wait for all 3 nodes

    while (true) {
        bool frame_ready = true;
        uint64_t target_end_idx = next_frame_start_idx_ + frame_size_;

        // Check if all nodes have data past the target end index
        for (const auto& pair : node_buffers_) {
            if (pair.second.max_sample_index < target_end_idx) {
                frame_ready = false;
                break;
            }
        }

        if (!frame_ready) {
            break; // Not enough data yet
        }

        // We have enough data for a frame across all known nodes
        PipelineContext context;
        context.sample_rate = sample_rate_;
        context.frame_size = frame_size_;
        context.start_tsf = (next_frame_start_idx_ * 1000000) / sample_rate_;

        for (auto& pair : node_buffers_) {
            const std::string& ip = pair.first;
            auto& buf = pair.second;

            std::vector<float> frame_data(frame_size_, 0.0f);
            
            // Extract data and remove from map to free memory
            auto it = buf.samples.lower_bound(next_frame_start_idx_);
            while (it != buf.samples.end() && it->first < target_end_idx) {
                frame_data[it->first - next_frame_start_idx_] = it->second;
                it = buf.samples.erase(it); // Erase up to target end
            }

            // Also clean up any old stray samples before next_frame_start_idx_
            while (!buf.samples.empty() && buf.samples.begin()->first < next_frame_start_idx_) {
                buf.samples.erase(buf.samples.begin());
            }

            context.node_audio[ip] = std::move(frame_data);
        }

        // Advance to next frame
        next_frame_start_idx_ += frame_size_;

        static const bool verbose = (std::getenv("VERBOSE_LOGS") != nullptr && std::string(std::getenv("VERBOSE_LOGS")) == "1");
        if (verbose) {
            std::cout << "[Stage 1 - Sync] Yielding frame. Target TSF: " << context.start_tsf 
                      << " us. Node max sample indices: ";
        }
        if (verbose) {
            for (const auto& pair : node_buffers_) {
                std::cout << pair.first << ":" << pair.second.max_sample_index << " ";
            }
        }
        if (verbose) std::cout << std::endl;

        // Execute pipeline
        bool abort = false;
        {
            std::lock_guard<std::mutex> lock(pipeline_mutex_);
            for (auto& stage : pipeline_stages_) {
                if (!stage->process(context)) {
                    abort = true;
                    break;
                }
            }
        }
    }
}
