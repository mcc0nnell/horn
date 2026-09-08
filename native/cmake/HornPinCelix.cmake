# Pin Apache Celix at an exact commit and make it findable without a host install.
# Invoked only when HORN_WITH_CELIX=ON.

set(HORN_CELIX_PIN_FILE "${CMAKE_CURRENT_SOURCE_DIR}/celix-pin.json")
if(NOT EXISTS "${HORN_CELIX_PIN_FILE}")
    message(FATAL_ERROR "Missing Celix pin file: ${HORN_CELIX_PIN_FILE}")
endif()

file(READ "${HORN_CELIX_PIN_FILE}" HORN_CELIX_PIN_JSON)
string(JSON HORN_CELIX_COMMIT GET "${HORN_CELIX_PIN_JSON}" celix commit)
string(JSON HORN_CELIX_VERSION GET "${HORN_CELIX_PIN_JSON}" celix version)
string(JSON HORN_CELIX_REPOSITORY GET "${HORN_CELIX_PIN_JSON}" celix repository)

set(HORN_CELIX_ROOT "${CMAKE_BINARY_DIR}/celix-root")
set(HORN_CELIX_PREFIX "${HORN_CELIX_ROOT}/celix")
set(HORN_DEPS_PREFIX "${HORN_CELIX_ROOT}/deps")

message(STATUS "Bootstrapping pinned Celix ${HORN_CELIX_VERSION} @ ${HORN_CELIX_COMMIT}")
execute_process(
    COMMAND bash "${CMAKE_CURRENT_SOURCE_DIR}/scripts/bootstrap-celix.sh" "${HORN_CELIX_ROOT}"
    RESULT_VARIABLE HORN_CELIX_BOOTSTRAP_RESULT
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
)
if(NOT HORN_CELIX_BOOTSTRAP_RESULT EQUAL 0)
    message(FATAL_ERROR
        "Failed to bootstrap pinned Celix. Set -DHORN_WITH_CELIX=OFF to build analysis CLIs only.")
endif()

list(PREPEND CMAKE_PREFIX_PATH "${HORN_DEPS_PREFIX}" "${HORN_CELIX_PREFIX}")
if(EXISTS "${HORN_CELIX_PREFIX}/share/celix/cmake/Modules")
    list(PREPEND CMAKE_MODULE_PATH "${HORN_CELIX_PREFIX}/share/celix/cmake/Modules")
endif()
if(EXISTS "${HORN_DEPS_PREFIX}/include")
    include_directories(BEFORE "${HORN_DEPS_PREFIX}/include")
endif()

find_package(Celix REQUIRED)

message(STATUS "Using pinned Celix ${HORN_CELIX_VERSION} (${HORN_CELIX_COMMIT})")
