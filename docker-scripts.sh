#!/bin/bash

# Docker management scripts for Petrolis webapp

case "$1" in
    "build")
        echo "Building Docker image..."
        docker build -t petrolis-webapp .
        ;;
    
    "run")
        echo "Running Docker container..."
        docker run -d \
            --name petrolis-webapp \
            -p 3000:3000 \
            --env-file .env.local \
            --restart unless-stopped \
            petrolis-webapp
        ;;
    
    "compose-up")
        echo "Starting with Docker Compose..."
        docker compose up -d
        ;;
    
    "compose-up-nginx")
        echo "Starting with Docker Compose (including NGINX)..."
        docker compose --profile with-nginx up -d
        ;;
    
    "compose-down")
        echo "Stopping Docker Compose..."
        docker compose down
        ;;
    
    "logs")
        echo "Showing logs..."
        docker compose logs -f petrolis-webapp
        ;;
    
    "rebuild")
        echo "Rebuilding and restarting..."
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        ;;
    
    "clean")
        echo "Cleaning up Docker resources..."
        docker compose down
        docker system prune -f
        docker image prune -f
        ;;
    
    "health")
        echo "Checking health status..."
        docker compose ps
        curl -f http://localhost:3000/api/health || echo "Health check failed"
        ;;
    
    *)
        echo "Usage: $0 {build|run|compose-up|compose-up-nginx|compose-down|logs|rebuild|clean|health}"
        echo ""
        echo "Commands:"
        echo "  build              - Build Docker image"
        echo "  run                - Run container directly"
        echo "  compose-up         - Start with Docker Compose"
        echo "  compose-up-nginx   - Start with Docker Compose + NGINX"
        echo "  compose-down       - Stop Docker Compose"
        echo "  logs               - Show container logs"
        echo "  rebuild            - Rebuild and restart"
        echo "  clean              - Clean up Docker resources"
        echo "  health             - Check health status"
        ;;
esac 