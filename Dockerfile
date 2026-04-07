# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1 — Build the React / Vite frontend
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install dependencies first (layer-cached unless package files change)
COPY frontend/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY frontend/ .
# VITE_API_URL is empty so the app uses a relative path (/api/...) —
# it will be served from the same origin as the Go server.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
# Output is in /app/dist

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2 — Build the Go backend
# ═══════════════════════════════════════════════════════════════════════════════
FROM golang:1.23-alpine AS backend-builder

WORKDIR /app

# git is needed by go mod tidy / go get for VCS metadata
RUN apk add --no-cache git

# Copy Go module manifest (without go.sum so tidy regenerates it cleanly)
COPY backend/go.mod ./

# Copy remaining backend source
COPY backend/ .

# Place the compiled frontend inside the backend working tree so the binary can
# find ./static at runtime.
COPY --from=frontend-builder /app/dist ./static

# Regenerate go.sum and build a fully-static binary
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o server ./cmd/server

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 3 — Minimal production image
# ═══════════════════════════════════════════════════════════════════════════════
FROM alpine:3.20

# CA certificates for outbound HTTPS; tzdata for time-zone support
RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

# Copy the binary and the pre-built frontend
COPY --from=backend-builder /app/server  ./server
COPY --from=backend-builder /app/static  ./static

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["./server"]
