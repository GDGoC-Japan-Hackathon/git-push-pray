.PHONY: back front database

back:
	cd backend && go run ./cmd/server

front:
	cd frontend && npm run dev

database:
	./cloud-sql-proxy git-push-pray:asia-northeast1:git-push-pray-db

