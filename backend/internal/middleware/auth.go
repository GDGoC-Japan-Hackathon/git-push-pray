package middleware

import (
	"context"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

type contextKey string

const UserIDKey contextKey = "userID"
const AuthInfoKey contextKey = "authInfo"

type AuthInfo struct {
	UID   string
	Name  string
	Email string
}

func Auth(app *firebase.App) func(http.Handler) http.Handler {
	client, err := app.Auth(context.Background())
	if err != nil {
		panic("failed to initialize Firebase Auth client: " + err.Error())
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			idToken := strings.TrimPrefix(authHeader, "Bearer ")

			decoded, err := client.VerifyIDToken(r.Context(), idToken)
			if err != nil {
				if auth.IsIDTokenExpired(err) {
					http.Error(w, "token expired", http.StatusUnauthorized)
				} else {
					http.Error(w, "unauthorized", http.StatusUnauthorized)
				}
				return
			}

			name, _ := decoded.Claims["name"].(string)
			email, _ := decoded.Claims["email"].(string)

			info := &AuthInfo{
				UID:   decoded.UID,
				Name:  name,
				Email: email,
			}

			ctx := context.WithValue(r.Context(), UserIDKey, decoded.UID)
			ctx = context.WithValue(ctx, AuthInfoKey, info)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
