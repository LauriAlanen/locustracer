#include "PositionSolver.h"
#include <iostream>
#include <cmath>
#include <limits>
#include <algorithm>
#include <cstring>

PositionSolver::PositionSolver(const std::vector<NodeConfig>& nodes, double speed_of_sound, const std::string& ref_node_ip)
    : speed_of_sound_(speed_of_sound),
      min_x_(std::numeric_limits<double>::max()), max_x_(std::numeric_limits<double>::lowest()),
      min_y_(std::numeric_limits<double>::max()), max_y_(std::numeric_limits<double>::lowest()),
      sock_fd_(-1) {
    for (const auto& n : nodes) {
        node_positions_[n.ip_address] = Eigen::Vector2d(n.x, n.y);
        min_x_ = std::min(min_x_, n.x);
        max_x_ = std::max(max_x_, n.x);
        min_y_ = std::min(min_y_, n.y);
        max_y_ = std::max(max_y_, n.y);
    }
    if (!ref_node_ip.empty()) {
        ref_node_ip_ = ref_node_ip;
    } else if (!nodes.empty()) {
        ref_node_ip_ = nodes.front().ip_address;
    }

    sock_fd_ = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock_fd_ >= 0) {
        memset(&dest_addr_, 0, sizeof(dest_addr_));
        dest_addr_.sin_family = AF_INET;
        dest_addr_.sin_port = htons(5010);
        inet_pton(AF_INET, "127.0.0.1", &dest_addr_.sin_addr);
    } else {
        std::cerr << "[PositionSolver] Failed to create UDP socket." << std::endl;
    }
}

PositionSolver::~PositionSolver() {
    if (sock_fd_ >= 0) {
        close(sock_fd_);
    }
}

bool PositionSolver::process(PipelineContext& context) {
    if (context.tdoa_results.empty() || node_positions_.size() < 3) {
        return false;
    }

    // Prepare measurements and positions
    std::vector<Eigen::Vector2d> other_nodes;
    std::vector<double> tdoa_measurements; // tau_{i,1}

    Eigen::Vector2d p1 = node_positions_[ref_node_ip_];

    for (const auto& pair : node_positions_) {
        if (pair.first == ref_node_ip_) continue;
        
        // Find TDOA result between pair.first and ref_node_ip
        auto it = context.tdoa_results.find({pair.first, ref_node_ip_});
        if (it != context.tdoa_results.end()) {
            other_nodes.push_back(pair.second);
            tdoa_measurements.push_back(it->second);
        }
    }

    if (other_nodes.size() < 2) {
        // Need at least 2 TDOA measurements (3 nodes total) for 2D positioning
        static int warn_count = 0;
        if (warn_count++ % 10 == 0) { // Don't spam
            std::cout << "[Position] Warning: Missing TDOA data. Did you set the correct IPs in main.cpp? Ref Node: " 
                      << ref_node_ip_ << " Found pairs: " << other_nodes.size() << std::endl;
        }
        return false;
    }

    // Initial guess for Gauss-Newton (center of all nodes)
    Eigen::Vector2d s(0, 0);
    for (const auto& pair : node_positions_) {
        s += pair.second;
    }
    s /= node_positions_.size();

    std::cout << "[Stage 4 - Solver] Initial guess s: (" << s.x() << ", " << s.y() << ")" << std::endl;

    int max_iters = 20;
    double tolerance = 1e-6;

    for (int iter = 0; iter < max_iters; ++iter) {
        double d1 = (s - p1).norm();
        if (d1 < 1e-6) d1 = 1e-6; // Avoid division by zero

        Eigen::VectorXd f(other_nodes.size());
        Eigen::MatrixXd J(other_nodes.size(), 2);

        for (size_t i = 0; i < other_nodes.size(); ++i) {
            Eigen::Vector2d pi = other_nodes[i];
            double di = (s - pi).norm();
            if (di < 1e-6) di = 1e-6;

            double expected_diff = di - d1;
            double measured_diff = speed_of_sound_ * tdoa_measurements[i];
            
            f(i) = expected_diff - measured_diff;

            // Jacobian terms
            J(i, 0) = (s.x() - pi.x()) / di - (s.x() - p1.x()) / d1;
            J(i, 1) = (s.y() - pi.y()) / di - (s.y() - p1.y()) / d1;
        }

        // Solve J * delta = -f
        // Using pseudo-inverse or robust solver for non-square J (if more than 3 nodes)
        Eigen::Vector2d delta = J.bdcSvd(Eigen::ComputeThinU | Eigen::ComputeThinV).solve(-f);

        s += delta;

        std::cout << "[Stage 4 - Solver] Iter " << iter << " delta.norm(): " << delta.norm() << std::endl;

        if (delta.norm() < tolerance) {
            break;
        }
        if (iter == max_iters - 1) {
            std::cout << "[Stage 4 - Solver] WARNING: Gauss-Newton hit max_iters (" << max_iters << ") without converging." << std::endl;
        }
    }

    context.source_x = s.x();
    context.source_y = s.y();

    // Filter values outside node position range
    if (s.x() >= min_x_ && s.x() <= max_x_ && s.y() >= min_y_ && s.y() <= max_y_) {
        context.location_valid = true;
        std::cout << "[Position] Estimated Location: (" << s.x() << ", " << s.y() << ")" << std::endl;
        
        if (sock_fd_ >= 0) {
            std::string msg = "{\"type\":\"tdoa\", \"x\": " + std::to_string(s.x()) + ", \"y\": " + std::to_string(s.y()) + "}";
            sendto(sock_fd_, msg.c_str(), msg.length(), 0, (struct sockaddr*)&dest_addr_, sizeof(dest_addr_));
        }
    } else {
        context.location_valid = false;
    }

    return true;
}
