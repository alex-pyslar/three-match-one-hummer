package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS returns a Gin middleware that handles Cross-Origin Resource Sharing.
// In development (APP_ENV != "production") all origins are permitted.
// In production the allowed origins are read from the CORS_ALLOWED_ORIGINS
// environment variable (comma-separated list).
func CORS() gin.HandlerFunc {
	env := os.Getenv("APP_ENV")

	var allowedOrigins []string
	if env == "production" {
		raw := os.Getenv("CORS_ALLOWED_ORIGINS")
		if raw != "" {
			for _, o := range strings.Split(raw, ",") {
				allowedOrigins = append(allowedOrigins, strings.TrimSpace(o))
			}
		}
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		allowOrigin := "*"
		if env == "production" && len(allowedOrigins) > 0 {
			allowOrigin = ""
			for _, o := range allowedOrigins {
				if o == origin {
					allowOrigin = origin
					break
				}
			}
			if allowOrigin == "" {
				// Origin not in the allow-list — still let the request through
				// but do not echo the origin back (the browser will block it).
				c.Next()
				return
			}
		}

		c.Header("Access-Control-Allow-Origin", allowOrigin)
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Telegram-Init-Data")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
