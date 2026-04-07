package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"three-match-one-hummer/api/internal/config"
	"three-match-one-hummer/api/internal/database"
	"three-match-one-hummer/api/internal/handlers"
	"three-match-one-hummer/api/internal/middleware"
)

func main() {
	// Load .env file if present (non-fatal in production where env vars are injected).
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		log.Printf("warning: could not load .env: %v", err)
	}

	cfg := config.Load()

	if cfg.Env == "release" || cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	db := database.Connect(cfg)
	defer db.Close()

	// ── Handler construction ──────────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(db, cfg)
	scoreHandler := handlers.NewScoreHandler(db)
	leaderboardHandler := handlers.NewLeaderboardHandler(db)
	shopHandler := handlers.NewShopHandler(db)

	// ── Router ────────────────────────────────────────────────────────────────
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())

	// Health-check used by Docker HEALTHCHECK and load balancers.
	r.GET("/health", func(c *gin.Context) {
		if err := db.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ── API routes ────────────────────────────────────────────────────────────
	api := r.Group("/api")

	// Public
	api.POST("/auth/telegram", authHandler.TelegramLogin)
	api.GET("/shop/items", shopHandler.GetItems)
	api.GET("/leaderboard", leaderboardHandler.GetLeaderboard)

	// Protected — require valid Telegram initData in Authorization header
	protected := api.Group("/")
	protected.Use(middleware.TelegramAuth(cfg))
	{
		protected.POST("/scores", scoreHandler.SubmitScore)
		protected.GET("/user/me", scoreHandler.GetMe)
		protected.GET("/user/progress", scoreHandler.GetProgress)
		protected.POST("/user/progress", scoreHandler.SaveProgress)
		protected.POST("/shop/purchase", shopHandler.Purchase)
	}

	// ── Static frontend (SPA) ────────────────────────────────────────────────
	// Serve the pre-built React app from ./static when it exists.
	// In development the Vite dev server runs separately.
	staticDir := "./static"
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		r.NoRoute(spaHandler(staticDir))
	} else {
		r.NoRoute(func(c *gin.Context) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		})
	}

	log.Printf("starting server on %s (mode=%s)", cfg.ServerAddr, cfg.Env)
	if err := r.Run(cfg.ServerAddr); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}

// spaHandler serves static files from dir and falls back to index.html for
// any path that doesn't correspond to an existing file (React Router support).
// API routes (starting with /api/) return a JSON 404 instead.
func spaHandler(dir string) gin.HandlerFunc {
	return func(c *gin.Context) {
		urlPath := c.Request.URL.Path

		// API miss — JSON error, do not serve index.html
		if strings.HasPrefix(urlPath, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "endpoint not found"})
			return
		}

		// Prevent path traversal
		cleanPath := filepath.Clean(urlPath)
		fullPath := filepath.Join(dir, cleanPath)

		// If the file exists and is not a directory, serve it directly
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			c.File(fullPath)
			return
		}

		// SPA fallback — let the React app handle routing
		c.File(filepath.Join(dir, "index.html"))
	}
}
