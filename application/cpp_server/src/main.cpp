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
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include "json.hpp"

using json = nlohmann::json;

std::atomic<bool> global_running(true);

void signalHandler(int signum) {
    std::cout << "\nInterrupt signal (" << signum << ") received. Shutting down...\n";
    global_running = false;
}

void updatePipeline(std::shared_ptr<AudioSynchronizer> synchronizer, size_t frame_size, const std::vector<NodeConfig>& nodes, const std::string& ref_node = "") {
    std::vector<std::shared_ptr<IPipelineStage>> stages;
    stages.push_back(std::make_shared<VADFilter>(2000000.0f)); // Adjust energy threshold
    
    if (!nodes.empty()) {
        std::string target_ref = ref_node.empty() ? nodes[0].ip_address : ref_node;
        stages.push_back(std::make_shared<GCCPhat>(frame_size, target_ref));
        // Default speed of sound 343.0 m/s
        stages.push_back(std::make_shared<PositionSolver>(nodes, 343.0, target_ref));
    }
    
    synchronizer->setPipelineStages(stages);
}

void configListenerTask(std::shared_ptr<AudioSynchronizer> synchronizer, size_t frame_size) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        std::cerr << "Failed to create config socket.\n";
        return;
    }
    
    struct timeval tv;
    tv.tv_sec = 1;
    tv.tv_usec = 0;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    struct sockaddr_in addr;
    std::memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(5011);
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");

    if (bind(sock, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        std::cerr << "Failed to bind config socket on port 5011.\n";
        close(sock);
        return;
    }
    
    std::cout << "Config listener started on 127.0.0.1:5011...\n";

    char buffer[4096];
    while (global_running) {
        int n = recvfrom(sock, buffer, sizeof(buffer) - 1, 0, nullptr, nullptr);
        if (n > 0) {
            buffer[n] = '\0';
            try {
                auto j = json::parse(buffer);
                if (j.contains("nodes") && j["nodes"].is_array()) {
                    std::vector<NodeConfig> nodes;
                    for (const auto& item : j["nodes"]) {
                        NodeConfig cfg;
                        cfg.ip_address = item["ip"].get<std::string>();
                        cfg.x = item["x"].get<double>();
                        cfg.y = item["y"].get<double>();
                        nodes.push_back(cfg);
                    }
                    
                    std::string ref_node = "";
                    if (j.contains("reference_node") && j["reference_node"].is_string()) {
                        ref_node = j["reference_node"].get<std::string>();
                    }
                    
                    std::cout << "[Config] Received new node configuration (" << nodes.size() << " nodes, ref: " << (ref_node.empty() ? "default" : ref_node) << ")\n";
                    updatePipeline(synchronizer, frame_size, nodes, ref_node);
                }
            } catch (const std::exception& e) {
                std::cerr << "[Config] Failed to parse config JSON: " << e.what() << "\n";
            }
        }
    }
    close(sock);
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
    
    // Start with an empty list
    std::vector<NodeConfig> initial_nodes;
    updatePipeline(synchronizer, frame_size, initial_nodes);

    NodeManager node_manager(synchronizer);
    UDPServer udp_server(port, node_manager);

    if (!udp_server.start()) {
        std::cerr << "Failed to start UDP Server.\n";
        return 1;
    }

    std::thread config_thread(configListenerTask, synchronizer, frame_size);

    // Main loop: Print statistics periodically (reduced to 60s to reduce log spam)
    while (global_running) {
        std::this_thread::sleep_for(std::chrono::seconds(60));
        
        node_manager.printAndResetStats();
    }

    std::cout << "Stopping UDP Server...\n";
    udp_server.stop();
    if (config_thread.joinable()) {
        config_thread.join();
    }
    std::cout << "Shutdown complete.\n";

    return 0;
}
