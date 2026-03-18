.PHONY: back front database all

back:
	cd backend && go run ./cmd/server

front:
	cd frontend && npm ci && npm run dev

database:
	./backend/cloud-sql-proxy git-push-pray:asia-northeast1:git-push-pray-db

all:
	@$(MAKE) database & \
	echo "Waiting for database proxy to be ready..." && \
	while ! nc -z localhost 5432 2>/dev/null; do sleep 0.5; done && \
	echo "Starting backend and frontend..." && \
	$(MAKE) back & \
	$(MAKE) front & \
	wait

