cmake_minimum_required(VERSION 3.18)

project(libhorn VERSION 0.1.0 LANGUAGES CXX)

add_library(horn_runtime_api INTERFACE)
target_include_directories(horn_runtime_api
    INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)
target_compile_features(horn_runtime_api INTERFACE cxx_std_17)

# Header-only JSON (vendored). Used by native contract providers.
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

# Phase 2.5 native deterministic query candidate. The algorithm is kept in a
# framework-free library so Celix can host it after equivalence is proven.
add_library(horn_query
    src/QueryService.cc
)
target_include_directories(horn_query
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(horn_query
    PUBLIC
        horn_runtime_api
        horn_nlohmann_json
)
target_compile_features(horn_query PUBLIC cxx_std_17)
set_target_properties(horn_query PROPERTIES POSITION_INDEPENDENT_CODE ON)

# Replayable proof candidate. This composes the deterministic query kernel and
# adds canonical hashing, dependency witnesses, proof creation, and replay
# verification. It remains framework-free; Celix registration is separately
# gated until golden proof equivalence is demonstrated.
add_library(horn_proof
    src/Sha256.cc
    src/ProofService.cc
)
target_include_directories(horn_proof
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(horn_proof
    PUBLIC
        horn_runtime_api
        horn_query
        horn_nlohmann_json
)
target_compile_features(horn_proof PUBLIC cxx_std_17)
set_target_properties(horn_proof PROPERTIES POSITION_INDEPENDENT_CODE ON)

# Standalone CLIs do not require Celix.
add_executable(horn_validate src/horn_validate_main.cc)
target_link_libraries(horn_validate PRIVATE horn_validation)
target_compile_features(horn_validate PRIVATE cxx_std_17)

add_executable(horn_query_cli src/horn_query_main.cc)
set_target_properties(horn_query_cli PROPERTIES OUTPUT_NAME horn_query)
target_link_libraries(horn_query_cli PRIVATE horn_query)
target_compile_features(horn_query_cli PRIVATE cxx_std_17)

add_executable(horn_proof_cli src/horn_proof_main.cc)
set_target_properties(horn_proof_cli PROPERTIES OUTPUT_NAME horn_proof)
target_link_libraries(horn_proof_cli PRIVATE horn_proof)
target_compile_features(horn_proof_cli PRIVATE cxx_std_17)

include(CTest)
if(BUILD_TESTING)
    add_executable(horn_query_test tests/QueryServiceTest.cc)
    target_link_libraries(horn_query_test PRIVATE horn_query horn_nlohmann_json)
    target_compile_features(horn_query_test PRIVATE cxx_std_17)
    add_test(NAME horn_native_query COMMAND horn_query_test)

    add_executable(horn_proof_test tests/ProofServiceTest.cc)
    target_link_libraries(horn_proof_test PRIVATE horn_proof horn_nlohmann_json)
    target_compile_features(horn_proof_test PRIVATE cxx_std_17)
    add_test(NAME horn_native_proof COMMAND horn_proof_test)
endif()

# ADR-0017 forbids normal query-provider registration before TypeScript/native
# golden equivalence. ADR-0018 applies the same rule to proof registration.
# Activators are present for lab composition, but both providers remain opt-in
# until conformance evidence is recorded and a later reviewed commit promotes
# them deliberately.
option(HORN_ENABLE_UNPROVEN_QUERY_PROVIDER "Build the pre-equivalence HornQueryBundle for lab use" OFF)
option(HORN_ENABLE_UNPROVEN_PROOF_PROVIDER "Build the pre-equivalence HornProofBundle for lab use" OFF)

if(HORN_ENABLE_UNPROVEN_PROOF_PROVIDER AND NOT HORN_ENABLE_UNPROVEN_QUERY_PROVIDER)
    message(FATAL_ERROR "HORN_ENABLE_UNPROVEN_PROOF_PROVIDER requires HORN_ENABLE_UNPROVEN_QUERY_PROVIDER")
endif()

find_package(Celix QUIET)
if(Celix_FOUND)
    message(STATUS "Celix found — building Horn contract bundle")

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

    if(HORN_ENABLE_UNPROVEN_QUERY_PROVIDER)
        message(WARNING "Building unproven HornQueryBundle for lab use; do not treat this as native authority")
        add_celix_bundle(HornQueryBundle
            NAME "Horn Deterministic Query Provider Candidate"
            SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.query"
            VERSION ${PROJECT_VERSION}
            SOURCES
                src/QueryBundleActivator.cc
        )
        target_link_libraries(HornQueryBundle PRIVATE horn_runtime_api horn_query)
        target_compile_features(HornQueryBundle PRIVATE cxx_std_17)

        add_celix_container(HornQueryRuntime
            CXX
            BUNDLES
                HornContractBundle
                HornQueryBundle
        )
    endif()

    if(HORN_ENABLE_UNPROVEN_PROOF_PROVIDER)
        message(WARNING "Building unproven HornProofBundle for lab use; do not treat this as native authority")
        add_celix_bundle(HornProofBundle
            NAME "Horn Replayable Proof Provider Candidate"
            SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.proof"
            VERSION ${PROJECT_VERSION}
            SOURCES
                src/ProofBundleActivator.cc
        )
        target_link_libraries(HornProofBundle PRIVATE horn_runtime_api horn_proof)
        target_compile_features(HornProofBundle PRIVATE cxx_std_17)

        add_celix_container(HornProofRuntime
            CXX
            BUNDLES
                HornContractBundle
                HornQueryBundle
                HornProofBundle
        )
    endif()
else()
    message(STATUS "Celix not found — building native libraries and CLIs only")
    message(STATUS "Install Apache Celix and reconfigure to build Horn bundles")
endif()
