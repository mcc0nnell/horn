cmake_minimum_required(VERSION 3.19)

project(libhorn VERSION 0.1.0 LANGUAGES CXX)

option(HORN_WITH_CELIX
    "Build HornContractBundle against the pinned Apache Celix (fetched, not host-installed)"
    ON)

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

add_library(horn_reactor
    src/JsonUtil.cc
    src/Reactor.cc
)
target_include_directories(horn_reactor
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)
target_link_libraries(horn_reactor
    PUBLIC
        horn_validation
)
target_compile_features(horn_reactor PUBLIC cxx_std_17)
set_target_properties(horn_reactor PROPERTIES POSITION_INDEPENDENT_CODE ON)

# Standalone CLIs for golden analysis — do not require Celix.
add_executable(horn_validate src/horn_validate_main.cc)
target_link_libraries(horn_validate PRIVATE horn_validation)
target_compile_features(horn_validate PRIVATE cxx_std_17)

add_executable(horn_project src/horn_project_main.cc)
target_link_libraries(horn_project PRIVATE horn_reactor)
target_compile_features(horn_project PRIVATE cxx_std_17)

add_executable(horn_query src/horn_query_main.cc)
target_link_libraries(horn_query PRIVATE horn_reactor)
target_compile_features(horn_query PRIVATE cxx_std_17)

add_executable(horn_explain src/horn_explain_main.cc)
target_link_libraries(horn_explain PRIVATE horn_reactor)
target_compile_features(horn_explain PRIVATE cxx_std_17)

add_executable(horn_impact src/horn_impact_main.cc)
target_link_libraries(horn_impact PRIVATE horn_reactor)
target_compile_features(horn_impact PRIVATE cxx_std_17)

add_executable(horn_diff src/horn_diff_main.cc)
target_link_libraries(horn_diff PRIVATE horn_reactor)
target_compile_features(horn_diff PRIVATE cxx_std_17)

add_executable(horn_inspect src/horn_inspect_main.cc)
target_link_libraries(horn_inspect PRIVATE horn_reactor)
target_compile_features(horn_inspect PRIVATE cxx_std_17)

# Celix is pinned and fetched. Analysis CLIs still build when HORN_WITH_CELIX=OFF.
if(HORN_WITH_CELIX)
    include("${CMAKE_CURRENT_SOURCE_DIR}/cmake/HornPinCelix.cmake")
    message(STATUS "Celix pin ${HORN_CELIX_VERSION} @ ${HORN_CELIX_COMMIT}")
    add_celix_bundle(HornContractBundle
        NAME "Horn Runtime Contract"
        SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.contract"
        VERSION ${PROJECT_VERSION}
        SOURCES
            src/ContractBundleActivator.cc
    )
    target_link_libraries(HornContractBundle PRIVATE horn_runtime_api horn_reactor)
    target_compile_features(HornContractBundle PRIVATE cxx_std_17)

    add_executable(horn_celix src/horn_celix_main.cc)
    target_link_libraries(horn_celix PRIVATE horn_reactor Celix::framework)
    target_compile_features(horn_celix PRIVATE cxx_std_17)
    add_dependencies(horn_celix HornContractBundle)
    get_target_property(HORN_BUNDLE_FILE HornContractBundle BUNDLE_FILE)
    target_compile_definitions(horn_celix PRIVATE
        HORN_CONTRACT_BUNDLE_FILE="${HORN_BUNDLE_FILE}"
        HORN_CELIX_COMMIT="${HORN_CELIX_COMMIT}"
        HORN_CELIX_VERSION="${HORN_CELIX_VERSION}"
        HORN_CELIX_REPOSITORY="${HORN_CELIX_REPOSITORY}"
    )
    set_target_properties(horn_celix PROPERTIES
        BUILD_RPATH "${HORN_CELIX_PREFIX}/lib;${HORN_DEPS_PREFIX}/lib"
        INSTALL_RPATH "$ORIGIN/../lib;${HORN_CELIX_PREFIX}/lib;${HORN_DEPS_PREFIX}/lib"
    )

    add_celix_container(HornContractRuntime
        CXX
        BUNDLES
            HornContractBundle
    )
else()
    message(STATUS "HORN_WITH_CELIX=OFF — building analysis libraries and CLIs only")
endif()
