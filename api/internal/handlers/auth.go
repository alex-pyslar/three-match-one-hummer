package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/match3game/backend/internal/config"
	"github.com/match3game/backend/internal/database"
	"github.com/match3game/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AuthHandler groups dependencies for authentication endpoints.
type AuthHandler struct {
	db  *database.DB
	cfg *config.Config
}

// NewAuthHandler constructs an AuthHandler.
func NewAuthHandler(db *database.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

type telegramAuthRequest struct {
	InitData string `json:"initData" binding:"required"`
}

type authResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// TelegramLogin validates Telegram WebApp initData, upserts the user, and
// returns a signed JWT.
//
// POST /api/auth/telegram
func (h *AuthHandler) TelegramLogin(c *gin.Context) {
	var req telegramAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "initData is required"})
		return
	}

	tgUser, err := validateTelegramInitData(req.InitData, h.cfg.TelegramBotToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid initData: " + err.Error()})
		return
	}

	user, err := upsertUser(c.Request.Context(), h.db, tgUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save user"})
		return
	}

	token, err := generateJWT(tgUser.ID, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, authResponse{Token: token, User: user})
}

// upsertUser inserts or updates the user document identified by telegram_id.
func upsertUser(ctx context.Context, db *database.DB, tgUser *models.TelegramUser) (*models.User, error) {
	now := time.Now()
	filter := bson.M{"telegram_id": tgUser.ID}
	update := bson.M{
		"$set": bson.M{
			"username":   tgUser.Username,
			"first_name": tgUser.FirstName,
			"last_name":  tgUser.LastName,
			"avatar_url": tgUser.PhotoURL,
			"updated_at": now,
		},
		"$setOnInsert": bson.M{
			"telegram_id":       tgUser.ID,
			"donation_currency": 0,
			"created_at":        now,
		},
	}
	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var user models.User
	if err := db.Collection("users").FindOneAndUpdate(ctx, filter, update, opts).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

// validateTelegramInitData performs the HMAC-SHA256 Telegram initData check.
func validateTelegramInitData(initData, botToken string) (*models.TelegramUser, error) {
	params, err := url.ParseQuery(initData)
	if err != nil {
		return nil, err
	}

	receivedHash := params.Get("hash")
	if receivedHash == "" {
		return nil, authErr("hash field is missing")
	}

	var parts []string
	for key, values := range params {
		if key == "hash" {
			continue
		}
		parts = append(parts, key+"="+values[0])
	}
	sort.Strings(parts)
	dataCheckString := strings.Join(parts, "\n")

	mac := hmac.New(sha256.New, []byte("WebAppData"))
	mac.Write([]byte(botToken))
	secretKey := mac.Sum(nil)

	sig := hmac.New(sha256.New, secretKey)
	sig.Write([]byte(dataCheckString))
	expectedHash := hex.EncodeToString(sig.Sum(nil))

	if !hmac.Equal([]byte(expectedHash), []byte(receivedHash)) {
		return nil, authErr("hash mismatch")
	}

	userJSON := params.Get("user")
	if userJSON == "" {
		return nil, authErr("user field is missing")
	}

	var tgUser models.TelegramUser
	if err := json.Unmarshal([]byte(userJSON), &tgUser); err != nil {
		return nil, err
	}
	return &tgUser, nil
}

// generateJWT creates a signed HS256 JWT valid for 24 hours.
func generateJWT(telegramID int64, secret string) (string, error) {
	claims := jwt.MapClaims{
		"sub": telegramID,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

type authErr string

func (e authErr) Error() string { return string(e) }
