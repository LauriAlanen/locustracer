#include "UDPServer.h"
#include "AudioPacket.h"

#include <iostream>
#include <cstring>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

UDPServer::UDPServer(uint16_t port, NodeManager& node_manager)
    : port_(port), socket_fd_(-1), forward_socket_fd_(-1), node_manager_(node_manager), running_(false) {}

UDPServer::~UDPServer() {
    stop();
}

bool UDPServer::start() {
    socket_fd_ = socket(AF_INET, SOCK_DGRAM, 0);
    if (socket_fd_ < 0) {
        std::cerr << "Failed to create socket." << std::endl;
        return false;
    }

    // Set socket buffer size large to prevent dropping packets under heavy load
    int rcvbuf_size = 1024 * 1024 * 8; // 8MB
    if (setsockopt(socket_fd_, SOL_SOCKET, SO_RCVBUF, &rcvbuf_size, sizeof(rcvbuf_size)) < 0) {
        std::cerr << "Warning: Failed to set SO_RCVBUF size." << std::endl;
    }

    int opt = 1;
    if (setsockopt(socket_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        std::cerr << "Warning: Failed to set SO_REUSEADDR." << std::endl;
    }
#ifdef SO_REUSEPORT
    if (setsockopt(socket_fd_, SOL_SOCKET, SO_REUSEPORT, &opt, sizeof(opt)) < 0) {
        std::cerr << "Warning: Failed to set SO_REUSEPORT." << std::endl;
    }
#endif

    struct sockaddr_in server_addr;
    std::memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(port_);

    if (bind(socket_fd_, (const struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        std::cerr << "Failed to bind to port " << port_ << std::endl;
        close(socket_fd_);
        socket_fd_ = -1;
        return false;
    }

    forward_socket_fd_ = socket(AF_INET, SOCK_DGRAM, 0);
    std::memset(&forward_addr_, 0, sizeof(forward_addr_));
    forward_addr_.sin_family = AF_INET;
    forward_addr_.sin_addr.s_addr = inet_addr("127.0.0.1");
    forward_addr_.sin_port = htons(5008);

    running_ = true;
    recv_thread_ = std::thread(&UDPServer::receiveLoop, this);
    jb_thread_ = std::thread(&UDPServer::processAndForwardJitterBuffers, this);

    std::cout << "UDP Server listening on port " << port_ << std::endl;
    return true;
}

void UDPServer::stop() {
    if (running_) {
        running_ = false;
        if (socket_fd_ >= 0) {
            // Close the socket to break the blocking recvfrom
            close(socket_fd_);
            socket_fd_ = -1;
        }
        if (forward_socket_fd_ >= 0) {
            close(forward_socket_fd_);
            forward_socket_fd_ = -1;
        }
        if (recv_thread_.joinable()) {
            recv_thread_.join();
        }
        if (jb_thread_.joinable()) {
            jb_thread_.join();
        }
    }
}

void UDPServer::receiveLoop() {
    // We allocate a buffer slightly larger than expected to catch weird packets
    char buffer[2048];
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);

    while (running_) {
        int n = recvfrom(socket_fd_, buffer, sizeof(buffer), 0,
                         (struct sockaddr *)&client_addr, &client_len);
        
        if (n < 0) {
            if (running_) {
                std::cerr << "recvfrom error." << std::endl;
            }
            break;
        }

        if (n >= (int)(sizeof(uint32_t) + sizeof(uint64_t))) { // Must have at least headers
            std::string ip_address = inet_ntoa(client_addr.sin_addr);
            const AudioPacket* packet = reinterpret_cast<const AudioPacket*>(buffer);
            
            // Push to JitterBuffer
            {
                std::lock_guard<std::mutex> lock(jb_mutex_);
                jitter_buffers_[ip_address].push(*packet);
            }
        }
    }
}

void UDPServer::processAndForwardJitterBuffers() {
    while (running_) {
        std::this_thread::sleep_for(std::chrono::milliseconds(2));
        
        if (forward_socket_fd_ >= 0) {
                std::vector<std::pair<std::string, AudioPacket>> packets_to_process;
                
                {
                    std::lock_guard<std::mutex> lock(jb_mutex_);
                    for (auto& pair : jitter_buffers_) {
                        const std::string& ip_address = pair.first;
                        JitterBuffer& jb = pair.second;
                        
                        AudioPacket out_packet;
                        // Pop as many packets as are ready
                        while (jb.pop(out_packet)) {
                            packets_to_process.push_back({ip_address, out_packet});
                        }
                    }
                }
                
                // Process packets without holding the mutex
                for (auto& item : packets_to_process) {
                    const std::string& ip_address = item.first;
                    AudioPacket& out_packet = item.second;
                    
                    node_manager_.processPacket(ip_address, &out_packet, sizeof(AudioPacket));

                    char forward_buf[2048];
                    std::memset(forward_buf, 0, 16);
                    std::strncpy(forward_buf, ip_address.c_str(), 15);
                    
                    // We forward exactly one full packet size
                    size_t packet_size = sizeof(AudioPacket);
                    std::memcpy(forward_buf + 16, &out_packet, packet_size);
                    sendto(forward_socket_fd_, forward_buf, 16 + packet_size, 0,
                           (struct sockaddr *)&forward_addr_, sizeof(forward_addr_));
                }
        }
    }
}
