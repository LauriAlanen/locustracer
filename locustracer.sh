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
    echo "  start                      Start the system natively."
    echo "  start --docker             Start the system using Docker Compose."
    echo "  start --docker --only-frontend Start only the frontend in Docker."
    echo "  start --container          (Internal use) Start the system inside the Docker container."
    echo "  start --no-frontend        Start the system natively without the frontend."
    echo "  start --only-frontend      Start only the frontend natively."
    echo "  stop                       Stop all native processes and Docker containers."
    echo ""
}

if [ -z "$1" ]; then
    print_usage
    exit 1
fi

COMMAND="$1"
shift

DOCKER_MODE=0
CONTAINER_MODE=0
NO_FRONTEND_FLAG=0
ONLY_FRONTEND_FLAG=0

for arg in "$@"; do
    if [ "$arg" == "--docker" ]; then DOCKER_MODE=1; fi
    if [ "$arg" == "--container" ]; then CONTAINER_MODE=1; fi
    if [ "$arg" == "--no-frontend" ]; then NO_FRONTEND_FLAG=1; fi
    if [ "$arg" == "--only-frontend" ]; then ONLY_FRONTEND_FLAG=1; fi
done

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
    if [ "$DOCKER_MODE" == "1" ]; then
        if [ "$ONLY_FRONTEND_FLAG" == "1" ]; then
            echo "Starting only Frontend via Docker..."
            DOCKER_BIN="docker"
            if ! command -v docker &> /dev/null; then
                if [ -f "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
                    DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
                else
                    echo "Error: 'docker' command not found."
                    exit 1
                fi
            fi
            
            # Gracefully wait for Docker daemon to start (up to 60 seconds)
            echo "Waiting for Docker daemon to become responsive..."
            for i in {1..30}; do
                if $DOCKER_BIN ps &> /dev/null; then
                    break
                fi
                echo -n "."
                sleep 2
            done
            echo ""
            
            if ! $DOCKER_BIN ps &> /dev/null; then
                echo "Error: Docker daemon is not running."
                exit 1
            fi
            
            $DOCKER_BIN run -it --name locustracer-frontend \
              --rm \
              -p 5173:5173 \
              -v "$(pwd)/application/monitor_app/frontend:/app" \
              -w /app \
              -e VITE_API_SERVER_URL="${VITE_API_SERVER_URL}" \
              -e VITE_WS_URL="${VITE_WS_URL}" \
              node:20-alpine \
              sh -c "npm install && npm run dev -- --host 0.0.0.0"
            exit 0
        fi

        echo "Starting via Docker Compose..."
        if [ -z "$DOCKER_COMPOSE" ]; then
            echo "Error: Neither 'docker compose' nor 'docker-compose' command found."
            exit 1
        fi
        if [ "$NO_FRONTEND_FLAG" == "1" ]; then
            export NO_FRONTEND=true
        fi
        $DOCKER_COMPOSE up --build
        exit 0
    fi

    # Register the cleanup function for EXIT, SIGINT, SIGTERM
    trap cleanup EXIT SIGINT SIGTERM

    if [ "$ONLY_FRONTEND_FLAG" != "1" ]; then
        echo "Starting Backend..."
        (
            cd application/monitor_app/backend
            if [ "$CONTAINER_MODE" != "1" ]; then
                npm install --silent
            fi
            npm start
        ) &
    fi

    if [ "$NO_FRONTEND_FLAG" != "1" ] && [ "$NO_FRONTEND" != "true" ]; then
        echo "Starting Frontend..."
        (
            cd application/monitor_app/frontend
            if [ "$CONTAINER_MODE" != "1" ]; then
                npm install --silent
            fi
            NODE_ENV=development npm run dev -- --host 0.0.0.0
        ) &
    else
        echo "Skipping Frontend..."
    fi

    if [ "$ONLY_FRONTEND_FLAG" != "1" ]; then
        echo "Starting cpp_server..."
        (
            cd application/cpp_server
            if [ "$CONTAINER_MODE" != "1" ]; then
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
    fi

    echo "All services started."
    echo "Press Ctrl+C to stop all services, or run './locustracer.sh stop' in another terminal."

    # Wait for all background jobs to finish
    wait
    exit 0
fi

echo "Unknown command: $COMMAND"
print_usage
exit 1
