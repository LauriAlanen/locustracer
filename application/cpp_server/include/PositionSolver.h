#ifndef POSITIONSOLVER_H
#define POSITIONSOLVER_H

#include "Pipeline.h"
#include <string>
#include <unordered_map>
#include <Eigen/Dense>

struct NodeConfig {
    std::string ip_address;
    double x;
    double y;
};

class PositionSolver : public IPipelineStage {
public:
    PositionSolver(const std::vector<NodeConfig>& nodes, double speed_of_sound = 343.0);

    bool process(PipelineContext& context) override;

    void setSpeedOfSound(double c) { speed_of_sound_ = c; }

private:
    std::unordered_map<std::string, Eigen::Vector2d> node_positions_;
    std::string ref_node_ip_;
    double speed_of_sound_;
    double min_x_;
    double max_x_;
    double min_y_;
    double max_y_;
};

#endif // POSITIONSOLVER_H
