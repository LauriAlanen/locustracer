#!/bin/bash

# start_servers.sh
# A script to start all locustracer services together

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    # Kill all child processes of this script
    pkill -P $$
    wait
    echo "All services stopped."
    exit
}

# Register the cleanup function for EXIT, SIGINT, SIGTERM
trap cleanup EXIT SIGINT SIGTERM

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "Building and starting cpp_server..."
(
    cd application/cpp_server
    cmake .
    make
    if [ -f "locustracer_server" ]; then
        ./locustracer_server
    else
        echo "Failed to build cpp_server."
        exit 1
    fi
) &

echo "Starting python monitoring server..."
# Using the venv if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
python tools/monitor_server.py &

echo "Starting mock websocket server..."
python application/mock_server.py &

echo "All services started."
echo "Press Ctrl+C to stop all services."

# Wait for all background jobs to finish
wait
