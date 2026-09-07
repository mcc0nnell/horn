cmake_minimum_required(VERSION 3.20)
project(HornCelixRules VERSION 0.1.0 LANGUAGES CXX)

find_package(Celix REQUIRED)
find_package(RapidJSON REQUIRED)

add_library(HornRulesApi INTERFACE)
add_library(horn::rules_api ALIAS HornRulesApi)
target_include_directories(HornRulesApi INTERFACE
    $<BUILD_INTERFACE:${CMAKE_CURRENT_LIST_DIR}/include>
)
target_compile_features(HornRulesApi INTERFACE cxx_std_17)

function(add_horn_rule_bundle target source_dir symbolic_name display_name)
    add_celix_bundle(${target}
        SOURCES
            ${source_dir}/Activator.cc
            ${ARGN}
        SYMBOLIC_NAME "${symbolic_name}"
        NAME "${display_name}"
        FILENAME "${target}"
        VERSION "0.1.0"
        GROUP "horn/rules"
    )
    target_link_libraries(${target} PRIVATE horn::rules_api)
endfunction()

add_horn_rule_bundle(
    Horn1998FocusBoxBundle
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_1998_focus_box"
    "Horn_1998_FocusBox"
    "Horn 1998 Focus Box Rule"
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_1998_focus_box/FocusBoxRule.cc"
)

add_horn_rule_bundle(
    Horn1998ReadingDirectionBundle
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_1998_reading_direction"
    "Horn_1998_ArgumentReadingDirection"
    "Horn 1998 Argument Reading Direction Rule"
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_1998_reading_direction/ArgumentReadingDirectionRule.cc"
)

add_horn_rule_bundle(
    Horn2003ClaimAtomicityBundle
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_2003_claim_atomicity"
    "Horn_2003_ClaimAtomicity"
    "Horn 2003 Claim Atomicity Rule"
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_2003_claim_atomicity/ClaimAtomicityRule.cc"
)

add_horn_rule_bundle(
    Horn2003FocusClaimBundle
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_2003_focus_claim"
    "Horn_2003_FocusClaimFormulation"
    "Horn 2003 Focus Claim Formulation Rule"
    "${CMAKE_CURRENT_LIST_DIR}/bundles/handbook_2003_focus_claim/FocusClaimFormulationRule.cc"
)

add_celix_bundle(HornRuleInventoryBundle
    SOURCES "${CMAKE_CURRENT_LIST_DIR}/bundles/rule_inventory/Activator.cc"
    SYMBOLIC_NAME "Horn_RuleInventory"
    NAME "Horn Rule Inventory"
    FILENAME "HornRuleInventoryBundle"
    VERSION "0.1.0"
    GROUP "horn/rules"
)
target_link_libraries(HornRuleInventoryBundle PRIVATE horn::rules_api Celix::shell_api)

add_celix_bundle(HornAnalyzerBundle
    SOURCES
        "${CMAKE_CURRENT_LIST_DIR}/bundles/analyzer/Activator.cc"
        "${CMAKE_CURRENT_LIST_DIR}/src/HornDocumentAdapter.cc"
    SYMBOLIC_NAME "Horn_Analyzer"
    NAME "Horn Methodology Analyzer"
    FILENAME "HornAnalyzerBundle"
    VERSION "0.1.0"
    GROUP "horn/rules"
)
target_include_directories(HornAnalyzerBundle PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/src"
    ${RapidJSON_INCLUDE_DIRS}
)
target_link_libraries(HornAnalyzerBundle PRIVATE horn::rules_api Celix::shell_api)

add_celix_container(HornRulesContainer
    CXX
    BUNDLES
        Celix::ShellCxx
        Celix::shell_tui
        Horn1998FocusBoxBundle
        Horn1998ReadingDirectionBundle
        Horn2003ClaimAtomicityBundle
        Horn2003FocusClaimBundle
        HornRuleInventoryBundle
        HornAnalyzerBundle
)
