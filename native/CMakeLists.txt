cmake_minimum_required(VERSION 3.18)

project(libhorn VERSION 0.1.0 LANGUAGES CXX)

add_library(horn_runtime_api INTERFACE)
target_include_directories(horn_runtime_api
    INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)
target_compile_features(horn_runtime_api INTERFACE cxx_std_17)

# Header-only JSON (vendored). Used by the Phase 1 document validator.
add_library(horn_nlohmann_json INTERFACE)
target_include_directories(horn_nlohmann_json
    INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/third_party>
)

add_library(horn_validation
    src/DocumentValidator.cc
)
target_include_directories(horn_validation
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(horn_validation
    PUBLIC
        horn_runtime_api
        horn_nlohmann_json
)
target_compile_features(horn_validation PUBLIC cxx_std_17)
set_target_properties(horn_validation PROPERTIES POSITION_INDEPENDENT_CODE ON)

# Standalone CLI for golden validation — does not require Celix.
add_executable(horn_validate src/horn_validate_main.cc)
target_link_libraries(horn_validate PRIVATE horn_validation)
target_compile_features(horn_validate PRIVATE cxx_std_17)

# Celix packaging is optional so the validator library + horn_validate CLI can
# still build on hosts without Apache Celix installed.
find_package(Celix QUIET)
if(Celix_FOUND)
    message(STATUS "Celix found — building HornContractBundle and container")
    add_celix_bundle(HornContractBundle
        NAME "Horn Runtime Contract"
        SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.contract"
        VERSION ${PROJECT_VERSION}
        SOURCES
            src/ContractBundleActivator.cc
    )
    target_link_libraries(HornContractBundle PRIVATE horn_runtime_api horn_validation)
    target_compile_features(HornContractBundle PRIVATE cxx_std_17)

    add_celix_container(HornContractRuntime
        CXX
        BUNDLES
            HornContractBundle
    )
else()
    message(STATUS "Celix not found — building validator library and horn_validate CLI only")
    message(STATUS "Install Apache Celix and reconfigure to build HornContractBundle")
endif()
