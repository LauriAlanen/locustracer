cmake_minimum_required(VERSION 3.10)
project(LocustracerServer CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add thread support
find_package(Threads REQUIRED)

# Include directories
include_directories(include)

# Source files
set(SOURCES
    src/main.cpp
    src/UDPServer.cpp
    src/NodeManager.cpp
    src/JitterBuffer.cpp
)

add_executable(locustracer_server ${SOURCES})

# Link libraries
target_link_libraries(locustracer_server PRIVATE Threads::Threads)
