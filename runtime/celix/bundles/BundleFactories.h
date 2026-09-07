#pragma once

#include "horn/rules/IHornRule.h"

#include <memory>

namespace horn::rules {

std::shared_ptr<IHornRule> createClaimAtomicityRule();
std::shared_ptr<IHornRule> createFocusClaimFormulationRule();
std::shared_ptr<IHornRule> createFocusBoxRule();
std::shared_ptr<IHornRule> createArgumentReadingDirectionRule();

} // namespace horn::rules
