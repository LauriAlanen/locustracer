#ifndef NODEMANAGER_H
#define NODEMANAGER_H

#include "AudioPacket.h"
#include <string>
#include <unordered_map>
#include <mutex>
#include <vector>

struct NodeStats {
    std::string ip_address;
    uint32_t packets_received = 0;
    uint32_t packets_lost = 0;
    uint32_t last_seq_id = 0;
    uint64_t last_tsf_time = 0;
    uint64_t total_samples = 0;
    
    // For periodic rate calculation
    uint32_t packets_since_last_check = 0;
};

class NodeManager {
public:
    NodeManager() = default;

    // Process an incoming packet
    void processPacket(const std::string& ip_address, const AudioPacket* packet, size_t packet_size);

    // Print and reset periodic statistics
    void printAndResetStats();

private:
    std::unordered_map<std::string, NodeStats> nodes_;
    std::mutex mutex_;
};

#endif // NODEMANAGER_H
