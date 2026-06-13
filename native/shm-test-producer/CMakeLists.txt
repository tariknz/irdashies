cmake_minimum_required(VERSION 3.22)
project(irdashies_shm_test_producer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(irdashies-shm-test-producer src/producer.cpp)
add_executable(irdashies-shm-probe src/probe.cpp)

foreach(t irdashies-shm-test-producer irdashies-shm-probe)
  target_include_directories(${t} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../shared)
endforeach()

target_link_libraries(irdashies-shm-test-producer PRIVATE d3d11 dxgi)
target_link_libraries(irdashies-shm-probe PRIVATE d3d11)
