#ifndef UDPSERVER_H
#define UDPSERVER_H

#include "NodeManager.h"
#include <thread>
#include <atomic>
#include <string>
#include <netinet/in.h>

#include "JitterBuffer.h"
#include <map>
#include <mutex>

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
    void processAndForwardJitterBuffers();

    uint16_t port_;
    int socket_fd_;
    int forward_socket_fd_;
    struct sockaddr_in forward_addr_;
    NodeManager& node_manager_;

    std::map<std::string, JitterBuffer> jitter_buffers_;
    std::mutex jb_mutex_;

    std::atomic<bool> running_;
    std::thread recv_thread_;
    std::thread jb_thread_;
};

#endif // UDPSERVER_H
