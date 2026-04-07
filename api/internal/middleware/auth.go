package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/match3game/backend/internal/config"
	"github.com/match3game/backend/internal/models"
)

const (
	ContextKeyTelegramUserID = "telegram_user_id"
	ContextKeyTelegramUser   = "telegram_user"
)

// TelegramAuth validates Telegram WebApp initData passed in the
// Authorization header as "tma <initData>" or in the X-Telegram-Init-Data header.
//
// Validation algorithm (per Telegram docs):
//  1. Parse initData as a URL query string.
//  2. Extract the `hash` field.
//  3. Sort remaining key=value pairs alphabetically by key and join with "\n".
//  4. Compute HMAC-SHA256(dataCheckString, SHA256("WebAppData" + botToken)).
//     Actually the correct key is HMAC-SHA256 where key = HMAC-SHA256("WebAppData", botToken).
//  5. Compare hex result with the extracted hash.
//
// On success the handler sets:
//   - "telegram_user_id" (int64) in the Gin context
//   - "telegram_user" (*models.TelegramUser) in the Gin context
func TelegramAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		initData := extractInitData(c)
		if initData == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Telegram initData"})
			return
		}

		telegramUser, err := validateInitData(initData, cfg.TelegramBotToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid Telegram initData: " + err.Error()})
			return
		}

		c.Set(ContextKeyTelegramUserID, telegramUser.ID)
		c.Set(ContextKeyTelegramUser, telegramUser)
		c.Next()
	}
}

// extractInitData retrieves the raw initData string from the request.
// It supports two delivery mechanisms:
//   - Authorization: tma <initData>
//   - X-Telegram-Init-Data: <initData>
func extractInitData(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "tma ") {
		return strings.TrimPrefix(authHeader, "tma ")
	}
	if strings.HasPrefix(authHeader, "TMA ") {
		return strings.TrimPrefix(authHeader, "TMA ")
	}
	return c.GetHeader("X-Telegram-Init-Data")
}

// validateInitData performs the full HMAC-SHA256 validation described in the
// Telegram Bot API documentation for WebApp initData.
func validateInitData(initData, botToken string) (*models.TelegramUser, error) {
	params, err := url.ParseQuery(initData)
	if err != nil {
		return nil, err
	}

	receivedHash := params.Get("hash")
	if receivedHash == "" {
		return nil, errMissingHash
	}

	// Build the data-check string: sorted key=value pairs (excluding "hash"), joined by "\n".
	var parts []string
	for key, values := range params {
		if key == "hash" {
			continue
		}
		parts = append(parts, key+"="+values[0])
	}
	sort.Strings(parts)
	dataCheckString := strings.Join(parts, "\n")

	// secret_key = HMAC-SHA256("WebAppData", bot_token)
	mac := hmac.New(sha256.New, []byte("WebAppData"))
	mac.Write([]byte(botToken))
	secretKey := mac.Sum(nil)

	// signature = HMAC-SHA256(data_check_string, secret_key)
	sig := hmac.New(sha256.New, secretKey)
	sig.Write([]byte(dataCheckString))
	expectedHash := hex.EncodeToString(sig.Sum(nil))

	if !hmac.Equal([]byte(expectedHash), []byte(receivedHash)) {
		return nil, errInvalidHash
	}

	// Parse the `user` JSON field.
	userJSON := params.Get("user")
	if userJSON == "" {
		return nil, errMissingUser
	}

	var tgUser models.TelegramUser
	if err := json.Unmarshal([]byte(userJSON), &tgUser); err != nil {
		return nil, err
	}

	return &tgUser, nil
}

// sentinel errors
type authError string

func (e authError) Error() string { return string(e) }

const (
	errMissingHash authError = "hash field is missing from initData"
	errInvalidHash authError = "hash mismatch — initData may have been tampered with"
	errMissingUser authError = "user field is missing from initData"
)
