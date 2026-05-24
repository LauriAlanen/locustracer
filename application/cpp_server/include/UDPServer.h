#ifndef UDPSERVER_H
#define UDPSERVER_H

#include "NodeManager.h"
#include <thread>
#include <atomic>
#include <string>

class UDPServer {
public:
    UDPServer(uint16_t port, NodeManager& node_manager);
    ~UDPServer();

    // Start the background receiving thread
    bool start();

    // Stop the receiving thread
    void stop();

private:
    void receiveLoop();

    uint16_t port_;
    int socket_fd_;
    NodeManager& node_manager_;

    std::atomic<bool> running_;
    std::thread recv_thread_;
};

#endif // UDPSERVER_H
