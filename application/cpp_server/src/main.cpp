#include "UDPServer.h"
#include "NodeManager.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <csignal>
#include <atomic>

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

    NodeManager node_manager;
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
