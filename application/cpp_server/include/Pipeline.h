#ifndef PIPELINE_H
#define PIPELINE_H

#include <vector>
#include <string>
#include <memory>
#include <unordered_map>

// Represents a chunk of synchronized audio from all nodes
struct PipelineContext {
    uint32_t sample_rate = 48000;
    size_t frame_size = 0;
    uint64_t start_tsf = 0;
    
    // Map of IP Address -> Audio data frame
    std::unordered_map<std::string, std::vector<float>> node_audio;

    // Results of processing
    bool vad_active = false;
    
    // TDOA results (e.g. "NodeB" relative to "NodeA" in seconds)
    struct pair_hash {
        template <class T1, class T2>
        std::size_t operator () (const std::pair<T1,T2> &p) const {
            auto h1 = std::hash<T1>{}(p.first);
            auto h2 = std::hash<T2>{}(p.second);
            return h1 ^ (h2 << 1);
        }
    };
    std::unordered_map<std::pair<std::string, std::string>, double, pair_hash> tdoa_results;

    // Final coordinates (x, y)
    double source_x = 0.0;
    double source_y = 0.0;
    bool location_valid = false;
};

// Interface for a pipeline stage
class IPipelineStage {
public:
    virtual ~IPipelineStage() = default;
    
    // Process the context. Return false to abort the pipeline early.
    virtual bool process(PipelineContext& context) = 0;
};

#endif // PIPELINE_H
