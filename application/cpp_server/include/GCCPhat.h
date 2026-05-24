#ifndef GCCPHAT_H
#define GCCPHAT_H

#include "Pipeline.h"
#include <fftw3.h>
#include <vector>
#include <string>

class GCCPhat : public IPipelineStage {
public:
    GCCPhat(size_t frame_size, const std::string& ref_node_ip = "");
    ~GCCPhat();

    bool process(PipelineContext& context) override;

private:
    size_t frame_size_;
    size_t padded_size_;
    std::string ref_node_ip_;
    
    // FFTW plan and arrays
    double* in1_;
    double* in2_;
    fftw_complex* out1_;
    fftw_complex* out2_;
    fftw_complex* cross_spectrum_;
    double* result_;
    
    fftw_plan plan_fwd1_;
    fftw_plan plan_fwd2_;
    fftw_plan plan_inv_;

    double computeTDOA(const std::vector<float>& sig1, const std::vector<float>& sig2, uint32_t sample_rate);
};

#endif // GCCPHAT_H
