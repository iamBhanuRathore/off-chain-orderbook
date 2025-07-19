#!/bin/bash

# Define project path and services
# The original script had 5 services, but based on the project structure, 4 are listed here.
# Add more services to this array if needed.
PROJECT_PATH="/Users/bhanurathore/projects/off-chain-orderbook"
SERVICES=("api-layer" "rust_matching_engine" "web" "websocket")
SESSION_NAME="orderbook"
 
# --- Redis Setup ---
# This section ensures the Redis container is running and its cache is cleared.
REDIS_CONTAINER="off-chain-orderbook-redis-1"
# Command to create the Redis container if it doesn't exist.
# You can add more options here, like volume mounts for persistence.
REDIS_RUN_COMMAND="docker run -d --name $REDIS_CONTAINER -p 6379:6379 redis"
 
echo "Checking Redis container '$REDIS_CONTAINER'..."
 
# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker daemon is not running. Skipping Redis setup."
else
    # 1. Check if container is running
    if [ "$(docker ps -q -f name=^/${REDIS_CONTAINER}$)" ]; then
        echo "Redis container is running. Clearing cache..."
        docker exec $REDIS_CONTAINER redis-cli FLUSHALL
        echo "Redis cache cleared successfully."
    # 2. Check if container exists but is stopped
    elif [ "$(docker ps -aq -f name=^/${REDIS_CONTAINER}$)" ]; then
        echo "Redis container is stopped. Starting it..."
        docker start $REDIS_CONTAINER > /dev/null
        echo "Waiting for Redis to initialize..."
        sleep 3 # Give it a few seconds
        echo "Clearing cache..."
        docker exec $REDIS_CONTAINER redis-cli FLUSHALL
        echo "Redis cache cleared successfully."
    # 3. If container does not exist at all
    else
        echo "Redis container does not exist. Creating and starting a new one..."
        eval $REDIS_RUN_COMMAND > /dev/null
        echo "Waiting for new Redis container to initialize..."
        sleep 5 # Give it a bit more time for the first run
        echo "New Redis container started. Cache is clean."
    fi
fi
echo "" # newline for readability

# --- Tmux Setup ---
# Kill existing tmux session if it exists to ensure a clean start
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Create a new detached tmux session and start the first service
# The -c flag sets the working directory for the new pane/window
tmux new-session -d -s $SESSION_NAME -c "$PROJECT_PATH/${SERVICES[0]}" "bun run dev"

# Create a 2x2 grid for 4 services
# Pane 0: ${SERVICES[0]} (already started)

# Pane 1: ${SERVICES[1]} (split right)
tmux split-window -h -t $SESSION_NAME:0.0 -c "$PROJECT_PATH/${SERVICES[1]}" "cargo run"

# Pane 2: ${SERVICES[2]} (split down from pane 0)
tmux split-window -v -t $SESSION_NAME:0.0 -c "$PROJECT_PATH/${SERVICES[2]}" "bun run dev"

# Pane 3: ${SERVICES[3]} (split down from pane 1)
tmux split-window -v -t $SESSION_NAME:0.1 -c "$PROJECT_PATH/${SERVICES[3]}" "bun run prev"

# Set pane titles for better identification
tmux select-pane -t $SESSION_NAME:0

# Attach to the session to view the running services
tmux attach-session -t $SESSION_NAME
