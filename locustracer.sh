#!/bin/bash

# locustracer.sh
# A unified CLI script to manage the Locustracer software stack.

# Ensure we are in the project root
cd "$(dirname "$0")"

# Determine Docker Compose command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose --version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE=""
fi

print_usage() {
    echo "Usage: ./locustracer.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start               Start the system natively."
    echo "  start --docker      Start the system using Docker Compose."
    echo "  start --container   (Internal use) Start the system inside the Docker container."
    echo "  stop                Stop all native processes and Docker containers."
    echo ""
}

if [ -z "$1" ]; then
    print_usage
    exit 1
fi

COMMAND="$1"
OPTION="$2"

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping native services..."
    pkill -f "locustracer_server" || true
    pkill -f "node server.js" || true
    pkill -f "vite" || true
    echo "All services stopped."
    exit
}

if [ "$COMMAND" == "stop" ]; then
    echo "Stopping Docker services (if running)..."
    if [ -n "$DOCKER_COMPOSE" ]; then
        $DOCKER_COMPOSE down 2>/dev/null || true
    fi
    cleanup
fi

if [ "$COMMAND" == "start" ]; then
    if [ "$OPTION" == "--docker" ]; then
        echo "Starting via Docker Compose..."
        if [ -z "$DOCKER_COMPOSE" ]; then
            echo "Error: Neither 'docker compose' nor 'docker-compose' command found."
            exit 1
        fi
        $DOCKER_COMPOSE up --build
        exit 0
    fi

    # Register the cleanup function for EXIT, SIGINT, SIGTERM
    trap cleanup EXIT SIGINT SIGTERM

    echo "Starting Backend..."
    (
        cd application/monitor_app/backend
        if [ "$OPTION" != "--container" ]; then
            npm install --silent
        fi
        npm start
    ) &

    echo "Starting Frontend..."
    (
        cd application/monitor_app/frontend
        if [ "$OPTION" != "--container" ]; then
            npm install --silent
        fi
        NODE_ENV=development npm run dev -- --host 0.0.0.0
    ) &

    echo "Starting cpp_server..."
    (
        cd application/cpp_server
        if [ "$OPTION" != "--container" ]; then
            cmake .
            make
        fi
        if [ -f "locustracer_server" ]; then
            ./locustracer_server
        else
            echo "Failed to build cpp_server."
            exit 1
        fi
    ) &

    echo "All services started."
    echo "Press Ctrl+C to stop all services, or run './locustracer.sh stop' in another terminal."

    # Wait for all background jobs to finish
    wait
    exit 0
fi

echo "Unknown command: $COMMAND"
print_usage
exit 1
