#!/bin/bash

# Define project path and services
PROJECT_PATH="/Users/bhanurathore/projects/off-chain-orderbook"
SERVICES=("api-layer" "rust_matching_engine" "web" "websocket")
SESSION_NAME="orderbook"

# --- Redis Setup ---
REDIS_CONTAINER="off-chain-orderbook-redis-1"
REDIS_RUN_COMMAND="docker run -d --name $REDIS_CONTAINER -p 6379:6379 redis"

echo "Checking Redis container '$REDIS_CONTAINER'..."

if ! docker info > /dev/null 2>&1; then
    echo "Docker daemon is not running. Skipping Redis setup."
else
    if [ "$(docker ps -q -f name=^/${REDIS_CONTAINER}$)" ]; then
        echo "Redis container is running. Clearing cache..."
        docker exec $REDIS_CONTAINER redis-cli FLUSHALL
        echo "Redis cache cleared successfully."
    elif [ "$(docker ps -aq -f name=^/${REDIS_CONTAINER}$)" ]; then
        echo "Redis container is stopped. Starting it..."
        docker start $REDIS_CONTAINER > /dev/null
        echo "Waiting for Redis to initialize..."
        sleep 3
        echo "Clearing cache..."
        docker exec $REDIS_CONTAINER redis-cli FLUSHALL
        echo "Redis cache cleared successfully."
    else
        echo "Redis container does not exist. Creating and starting a new one..."
        eval $REDIS_RUN_COMMAND > /dev/null
        echo "Waiting for new Redis container to initialize..."
        sleep 5
        echo "New Redis container started. Cache is clean."
    fi
fi

echo "" # newline for readability

# --- Tmux Setup ---
tmux kill-session -t $SESSION_NAME 2>/dev/null

tmux new-session -d -s $SESSION_NAME -c "$PROJECT_PATH/${SERVICES[0]}" "bun run dev"

tmux split-window -h -t $SESSION_NAME:0.0 -c "$PROJECT_PATH/${SERVICES[1]}" "cargo run"
tmux split-window -v -t $SESSION_NAME:0.0 -c "$PROJECT_PATH/${SERVICES[2]}" "bun run dev"
tmux split-window -v -t $SESSION_NAME:0.1 -c "$PROJECT_PATH/${SERVICES[3]}" "bun run prev"

tmux select-pane -t $SESSION_NAME:0

tmux attach-session -t $SESSION_NAME
