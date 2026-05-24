#include "UDPServer.h"
#include "NodeManager.h"
#include "AudioSynchronizer.h"
#include "VADFilter.h"
#include "GCCPhat.h"
#include "PositionSolver.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <csignal>
#include <atomic>
#include <memory>
#include <vector>

std::atomic<bool> global_running(true);

void signalHandler(int signum) {
    std::cout << "\nInterrupt signal (" << signum << ") received. Shutting down...\n";
    global_running = false;
}

int main(int argc, char* argv[]) {
    // Register signal handler for clean shutdown
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    uint16_t port = 5006;
    
    std::cout << "Starting Locustracer C++ UDP Server...\n";

    // Configure pipeline
    size_t frame_size = 2048;
    uint32_t sample_rate = 48000;
    
    auto synchronizer = std::make_shared<AudioSynchronizer>(frame_size, sample_rate);
    
    std::vector<std::shared_ptr<IPipelineStage>> stages;
    stages.push_back(std::make_shared<VADFilter>(2000000.0f)); // Adjust energy threshold
    
    // Configurable Node Coordinates
    // VERY IMPORTANT: Update these IPs to match your actual nodes!
    std::vector<NodeConfig> nodes = {
        {"192.168.3.14", 0.0, 0.0},
        {"192.168.3.9", 2.0, 0.0},
        {"192.168.3.10", 1.0, 1.732} // Equilateral triangle
    };
    
    stages.push_back(std::make_shared<GCCPhat>(frame_size, nodes[0].ip_address));
    // Default speed of sound 343.0 m/s
    stages.push_back(std::make_shared<PositionSolver>(nodes, 343.0));

    synchronizer->setPipelineStages(stages);

    NodeManager node_manager(synchronizer);
    UDPServer udp_server(port, node_manager);

    if (!udp_server.start()) {
        std::cerr << "Failed to start UDP Server.\n";
        return 1;
    }

    // Main loop: Print statistics periodically
    while (global_running) {
        std::this_thread::sleep_for(std::chrono::seconds(10));
        
        node_manager.printAndResetStats();
    }

    std::cout << "Stopping UDP Server...\n";
    udp_server.stop();
    std::cout << "Shutdown complete.\n";

    return 0;
}
