#include "VADFilter.h"
#include <cmath>
#include <iostream>

VADFilter::VADFilter(float energy_threshold) : energy_threshold_(energy_threshold) {}

bool VADFilter::process(PipelineContext& context) {
    if (context.node_audio.empty()) {
        return false;
    }

    // We calculate the average energy across all nodes in the context.
    // Alternatively, we could require at least one node to cross the threshold.
    float max_energy = 0.0f;

    for (const auto& pair : context.node_audio) {
        const auto& audio = pair.second;
        if (audio.empty()) continue;

        float energy = 0.0f;
        for (float sample : audio) {
            energy += std::abs(sample);
        }
        energy /= audio.size();

        if (energy > max_energy) {
            max_energy = energy;
        }
    }

    static int frame_count = 0;
    if (++frame_count % 10 == 0) {
        std::cout << "[Stage 2 - VAD] Calculated energy: " << max_energy 
                  << " | Threshold: " << energy_threshold_ << std::endl;
    }

    if (max_energy > energy_threshold_) {
        context.vad_active = true;
        // std::cout << "[VAD] Active (Energy: " << max_energy << ")" << std::endl;
        return true;
    }

    context.vad_active = false;
    // std::cout << "[VAD] Silence (Energy: " << max_energy << ")" << std::endl;
    return false; // Abort pipeline, it's silence
}
