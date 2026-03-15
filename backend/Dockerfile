# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO disabled for scratch image
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./main.go

# Production stage
FROM alpine:latest

# Install CA certificates to enable HTTPS calls to Vertex AI
RUN apk --no-cache add ca-certificates

WORKDIR /root/
COPY --from=builder /app/server .

# Default port
ENV PORT=8081
EXPOSE ${PORT}

CMD ["./server"]
