#include "GCCPhat.h"
#include <cmath>
#include <iostream>
#include <algorithm>

GCCPhat::GCCPhat(size_t frame_size, const std::string& ref_node_ip)
    : frame_size_(frame_size), ref_node_ip_(ref_node_ip) {
    
    padded_size_ = frame_size_ * 2; // Zero-pad to avoid circular correlation
    
    in1_ = fftw_alloc_real(padded_size_);
    in2_ = fftw_alloc_real(padded_size_);
    
    size_t complex_size = padded_size_ / 2 + 1;
    out1_ = fftw_alloc_complex(complex_size);
    out2_ = fftw_alloc_complex(complex_size);
    cross_spectrum_ = fftw_alloc_complex(complex_size);
    result_ = fftw_alloc_real(padded_size_);

    plan_fwd1_ = fftw_plan_dft_r2c_1d(padded_size_, in1_, out1_, FFTW_MEASURE);
    plan_fwd2_ = fftw_plan_dft_r2c_1d(padded_size_, in2_, out2_, FFTW_MEASURE);
    plan_inv_ = fftw_plan_dft_c2r_1d(padded_size_, cross_spectrum_, result_, FFTW_MEASURE);
}

GCCPhat::~GCCPhat() {
    fftw_destroy_plan(plan_fwd1_);
    fftw_destroy_plan(plan_fwd2_);
    fftw_destroy_plan(plan_inv_);
    
    fftw_free(in1_);
    fftw_free(in2_);
    fftw_free(out1_);
    fftw_free(out2_);
    fftw_free(cross_spectrum_);
    fftw_free(result_);
}

bool GCCPhat::process(PipelineContext& context) {
    if (context.node_audio.size() < 2) return false;

    // Pick a reference node if not set or not found
    std::string ref_ip = ref_node_ip_;
    if (ref_ip.empty() || context.node_audio.find(ref_ip) == context.node_audio.end()) {
        ref_ip = context.node_audio.begin()->first;
    }

    const auto& ref_audio = context.node_audio.at(ref_ip);

    for (const auto& pair : context.node_audio) {
        if (pair.first == ref_ip) continue;
        
        double delay = computeTDOA(ref_audio, pair.second, context.sample_rate);
        context.tdoa_results[{pair.first, ref_ip}] = delay;
        // Also store reverse for convenience
        context.tdoa_results[{ref_ip, pair.first}] = -delay;
        
        double delay_in_ms = delay * 1000.0;
        double delay_in_samples = delay * context.sample_rate;
        static const bool verbose = (std::getenv("VERBOSE_LOGS") != nullptr && std::string(std::getenv("VERBOSE_LOGS")) == "1");
        if (verbose) {
            std::cout << "[GCC-PHAT] TDOA between " << pair.first << " and " << ref_ip 
                      << ": " << delay_in_samples << " samples, " << delay_in_ms << " ms" << std::endl;
        }
    }

    return true; // Continue pipeline
}

double GCCPhat::computeTDOA(const std::vector<float>& sig1, const std::vector<float>& sig2, uint32_t sample_rate) {
    // Zero pad inputs
    for (size_t i = 0; i < padded_size_; ++i) {
        if (i < frame_size_) {
            in1_[i] = static_cast<double>(sig1[i]);
            in2_[i] = static_cast<double>(sig2[i]);
        } else {
            in1_[i] = 0.0;
            in2_[i] = 0.0;
        }
    }

    // Forward FFT
    fftw_execute(plan_fwd1_);
    fftw_execute(plan_fwd2_);

    // Compute cross spectrum with Phase Transform
    size_t complex_size = padded_size_ / 2 + 1;
    for (size_t i = 0; i < complex_size; ++i) {
        double r1 = out1_[i][0];
        double i1 = out1_[i][1];
        
        // Complex conjugate of out2
        double r2 = out2_[i][0];
        double i2 = -out2_[i][1];
        
        // Multiply
        double cross_r = r1 * r2 - i1 * i2;
        double cross_i = r1 * i2 + i1 * r2;
        
        // Magnitude
        double mag = std::sqrt(cross_r * cross_r + cross_i * cross_i);
        
        // Phase transform (normalize by magnitude)
        if (mag > 1e-10) {
            cross_spectrum_[i][0] = cross_r / mag;
            cross_spectrum_[i][1] = cross_i / mag;
        } else {
            cross_spectrum_[i][0] = 0.0;
            cross_spectrum_[i][1] = 0.0;
        }
    }

    // Inverse FFT
    fftw_execute(plan_inv_);

    // Find peak in result
    double max_val = -1e9;
    int peak_idx = 0;
    
    // Result is circularly shifted. 
    // First half represents positive delay, second half represents negative delay.
    for (size_t i = 0; i < padded_size_; ++i) {
        if (result_[i] > max_val) {
            max_val = result_[i];
            peak_idx = i;
        }
    }
    
    double sample_delay = 0;
    if (peak_idx > static_cast<int>(padded_size_ / 2)) {
        sample_delay = peak_idx - static_cast<int>(padded_size_);
    } else {
        sample_delay = peak_idx;
    }

    // A positive sample_delay here means sig2 is DELAYED relative to sig1
    return sample_delay / static_cast<double>(sample_rate);
}
