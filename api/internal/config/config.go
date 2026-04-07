package config

import "os"

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	ServerAddr       string
	MongoURI         string
	MongoDB          string
	TelegramBotToken string
	JWTSecret        string
	AdminSecret      string // protects /api/admin/* endpoints; leave empty to disable
	Env              string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		ServerAddr:       getEnv("SERVER_ADDR", ":8080"),
		MongoURI:         getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:          getEnv("MONGO_DB", "threematch"),
		TelegramBotToken: getEnv("TELEGRAM_BOT_TOKEN", ""),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production"),
		AdminSecret:      getEnv("ADMIN_SECRET", ""),
		Env:              getEnv("GIN_MODE", "development"),
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
