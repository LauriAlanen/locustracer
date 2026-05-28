cmake_minimum_required(VERSION 3.10)
project(LocustracerServer CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add thread support
find_package(Threads REQUIRED)

# Find FFTW3 and Eigen3
find_package(PkgConfig REQUIRED)
pkg_check_modules(FFTW3 REQUIRED fftw3)
if(EXISTS "/opt/homebrew/include/eigen3")
    include_directories(/opt/opt/homebrew/include/eigen3) # Fallback for some systems
    include_directories(/opt/homebrew/include/eigen3)
else()
    include_directories(/usr/include/eigen3)
endif()

# Include directories
include_directories(include ${FFTW3_INCLUDE_DIRS})
link_directories(${FFTW3_LIBRARY_DIRS})
if(EXISTS "/opt/homebrew/lib")
    link_directories(/opt/homebrew/lib)
endif()

# Source files
set(SOURCES
    src/main.cpp
    src/UDPServer.cpp
    src/NodeManager.cpp
    src/JitterBuffer.cpp
    src/AudioSynchronizer.cpp
    src/VADFilter.cpp
    src/GCCPhat.cpp
    src/PositionSolver.cpp
)

add_executable(locustracer_server ${SOURCES})

# Link libraries
target_link_libraries(locustracer_server PRIVATE Threads::Threads ${FFTW3_LIBRARIES})
