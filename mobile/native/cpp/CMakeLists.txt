cmake_minimum_required(VERSION 3.22)
project(teacher_llama LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# CPU ARM64 portable; sin Vulkan, OpenMP, red, OpenSSL o binarios ejecutables.
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
set(GGML_CPU_KLEIDIAI OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp/CMakeLists.txt")
    message(FATAL_ERROR "Falta llama.cpp fijado por el workflow Android")
endif()

add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp" "${CMAKE_CURRENT_BINARY_DIR}/llama")
add_library(teacher_llama SHARED teacher_llama.cpp)
target_include_directories(teacher_llama PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp/include")
find_library(android_log log)
target_link_libraries(teacher_llama PRIVATE llama ${android_log})
