#include "NodeManager.h"
#include "AudioSynchronizer.h"
#include <iostream>
#include <iomanip>

NodeManager::NodeManager(std::shared_ptr<AudioSynchronizer> synchronizer)
    : synchronizer_(synchronizer) {}

void NodeManager::processPacket(const std::string& ip_address, const AudioPacket* packet, size_t packet_size) {
    std::lock_guard<std::mutex> lock(mutex_);

    auto& stats = nodes_[ip_address];
    if (stats.ip_address.empty()) {
        stats.ip_address = ip_address;
        stats.last_seq_id = packet->sequence_id - 1; // Initialize to avoid instant loss detection
        std::cout << "[NodeManager] Discovered new node: " << ip_address << std::endl;
    }

    // Check sequence
    if (packet->sequence_id != stats.last_seq_id + 1) {
        if (packet->sequence_id > stats.last_seq_id) {
            stats.packets_lost += (packet->sequence_id - stats.last_seq_id - 1);
        }
    }

    stats.last_seq_id = packet->sequence_id;
    stats.last_tsf_time = packet->tsf_time;
    stats.packets_received++;
    stats.packets_since_last_check++;
    
    // Calculate how many samples were actually in the packet
    size_t header_size = sizeof(packet->sequence_id) + sizeof(packet->tsf_time);
    if (packet_size > header_size) {
        size_t samples_bytes = packet_size - header_size;
        stats.total_samples += (samples_bytes / sizeof(int32_t));
    }

    if (synchronizer_) {
        synchronizer_->pushPacket(ip_address, packet, packet_size);
    }
}

void NodeManager::printAndResetStats() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (nodes_.empty()) {
        std::cout << "Waiting for nodes..." << std::endl;
        return;
    }

    std::cout << "--- Node Statistics ---" << std::endl;
    for (auto& pair : nodes_) {
        auto& stats = pair.second;
        std::cout << "Node [" << stats.ip_address << "]: "
                  << std::setw(6) << stats.packets_since_last_check << " pkt/s | "
                  << "Total Pkt: " << stats.packets_received << " | "
                  << "Loss: " << stats.packets_lost << " | "
                  << "TSF: " << stats.last_tsf_time << std::endl;
        
        // Reset the periodic counter
        stats.packets_since_last_check = 0;
    }
    std::cout << "-----------------------" << std::endl;
}
