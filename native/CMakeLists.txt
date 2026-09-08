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

# Deterministic semantic traversal core. This library deliberately has no Celix
# dependency; Celix is the host/composition layer, not the semantics owner.
add_library(horn_engine STATIC
    src/Sha256.cc
    src/TraversalRuntime.cc
)
target_include_directories(horn_engine
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(horn_engine
    PUBLIC
        horn_runtime_api
    PRIVATE
        horn_nlohmann_json
)
target_compile_features(horn_engine PUBLIC cxx_std_17)
set_target_properties(horn_engine PROPERTIES POSITION_INDEPENDENT_CODE ON)

# Standalone CLIs do not require Celix.
add_executable(horn_validate src/horn_validate_main.cc)
target_link_libraries(horn_validate PRIVATE horn_validation)
target_compile_features(horn_validate PRIVATE cxx_std_17)

add_executable(horn_traverse src/horn_traverse_main.cc)
target_link_libraries(horn_traverse PRIVATE horn_engine)
target_compile_features(horn_traverse PRIVATE cxx_std_17)

include(CTest)
if(BUILD_TESTING)
    add_executable(horn_traversal_runtime_test
        tests/TraversalRuntimeTest.cc
    )
    target_link_libraries(horn_traversal_runtime_test
        PRIVATE
            horn_engine
            horn_nlohmann_json
    )
    target_compile_features(horn_traversal_runtime_test PRIVATE cxx_std_17)
    add_test(NAME horn_traversal_runtime COMMAND horn_traversal_runtime_test)
endif()

# Celix packaging is optional so the pure native libraries and CLIs still build
# on hosts without Apache Celix installed.
find_package(Celix QUIET)
if(Celix_FOUND)
    message(STATUS "Celix found — building Horn contract and engine bundles")

    add_celix_bundle(HornContractBundle
        NAME "Horn Runtime Contract"
        SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.contract"
        VERSION ${PROJECT_VERSION}
        SOURCES
            src/ContractBundleActivator.cc
    )
    target_link_libraries(HornContractBundle PRIVATE horn_runtime_api horn_validation)
    target_compile_features(HornContractBundle PRIVATE cxx_std_17)

    add_celix_bundle(HornEngineBundle
        NAME "Horn Semantic Traversal Engine"
        SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.engine"
        VERSION ${PROJECT_VERSION}
        SOURCES
            src/EngineBundleActivator.cc
    )
    target_link_libraries(HornEngineBundle PRIVATE horn_runtime_api horn_engine)
    target_compile_features(HornEngineBundle PRIVATE cxx_std_17)

    # Preserve the Phase 1 contract-only container.
    add_celix_container(HornContractRuntime
        CXX
        BUNDLES
            HornContractBundle
    )

    # Full native Horn runtime: contract services + deterministic traversal.
    add_celix_container(HornEngineRuntime
        CXX
        BUNDLES
            HornContractBundle
            HornEngineBundle
    )
else()
    message(STATUS "Celix not found — building native libraries and CLIs only")
    message(STATUS "Install Apache Celix and reconfigure to build Horn bundles")
endif()
