#!/bin/bash

# start.sh
# A hybrid script to run backend/frontend in Docker, and cpp_server natively.

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping cpp_server..."
    pkill -f "locustracer_server" || true
    wait
    echo "Stopping Node.js services..."
    pkill -f "node server.js" || true
    pkill -f "vite" || true
    echo "All services stopped."
    exit
}

# Register the cleanup function for EXIT, SIGINT, SIGTERM
trap cleanup EXIT SIGINT SIGTERM

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "Starting Backend natively..."
(
    cd application/monitor_app/backend
    npm install --silent
    npm start
) &

echo "Starting Frontend natively..."
(
    cd application/monitor_app/frontend
    npm install --silent
    npm run dev -- --host 0.0.0.0
) &

echo "Building and starting cpp_server natively..."
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

echo "All services started."
echo "Press Ctrl+C to stop all services."

# Wait for all background jobs to finish
wait
