cmake_minimum_required(VERSION 3.18)

project(libhorn VERSION 0.1.0 LANGUAGES CXX)

find_package(Celix REQUIRED)

add_library(horn_runtime_api INTERFACE)
target_include_directories(horn_runtime_api
    INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)
target_compile_features(horn_runtime_api INTERFACE cxx_std_17)

add_celix_bundle(HornContractBundle
    NAME "Horn Runtime Contract"
    SYMBOLIC_NAME "org.mcc0nnell.horn.runtime.contract"
    VERSION ${PROJECT_VERSION}
    SOURCES
        src/ContractBundleActivator.cc
)
target_link_libraries(HornContractBundle PRIVATE horn_runtime_api)
target_compile_features(HornContractBundle PRIVATE cxx_std_17)

add_celix_container(HornContractRuntime
    CXX
    BUNDLES
        HornContractBundle
)
