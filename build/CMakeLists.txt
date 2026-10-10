cmake_minimum_required(VERSION 3.14...3.28)
project(moe-gguf-server C CXX)

# Keep the imported engine layout together and its public targets unchanged.
add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/../backend" "${CMAKE_CURRENT_BINARY_DIR}/backend")
