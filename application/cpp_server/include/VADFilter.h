#ifndef VADFILTER_H
#define VADFILTER_H

#include "Pipeline.h"

class VADFilter : public IPipelineStage {
public:
    VADFilter(float energy_threshold = 1000.0f);

    bool process(PipelineContext& context) override;

private:
    float energy_threshold_;
};

#endif // VADFILTER_H
