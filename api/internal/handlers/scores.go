package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/match3game/backend/internal/database"
	"github.com/match3game/backend/internal/middleware"
	"github.com/match3game/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ScoreHandler groups dependencies for score and progress endpoints.
type ScoreHandler struct {
	db *database.DB
}

// NewScoreHandler constructs a ScoreHandler.
func NewScoreHandler(db *database.DB) *ScoreHandler {
	return &ScoreHandler{db: db}
}

type submitScoreRequest struct {
	Score int `json:"score" binding:"min=0"`
	Level int `json:"level" binding:"min=1"`
}

// SubmitScore records a game session result for the authenticated user.
//
// POST /api/scores
func (h *ScoreHandler) SubmitScore(c *gin.Context) {
	userID := c.MustGet(middleware.ContextKeyTelegramUserID).(int64)

	var req submitScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Level < 1 {
		req.Level = 1
	}

	score := models.Score{
		UserID:    userID,
		Score:     req.Score,
		Level:     req.Level,
		CreatedAt: time.Now(),
	}

	result, err := h.db.Collection("scores").InsertOne(c.Request.Context(), score)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save score"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":    result.InsertedID,
		"score": req.Score,
		"level": req.Level,
	})
}

// GetMe returns the authenticated user's profile.
//
// GET /api/user/me
func (h *ScoreHandler) GetMe(c *gin.Context) {
	userID := c.MustGet(middleware.ContextKeyTelegramUserID).(int64)

	var user models.User
	err := h.db.Collection("users").
		FindOne(c.Request.Context(), bson.M{"telegram_id": userID}).
		Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found — authenticate first"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
		}
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetProgress returns the saved game progress for the authenticated user.
// Returns 204 No Content if no progress has been saved yet.
//
// GET /api/user/progress
func (h *ScoreHandler) GetProgress(c *gin.Context) {
	userID := c.MustGet(middleware.ContextKeyTelegramUserID).(int64)

	var progress models.GameProgress
	err := h.db.Collection("game_progress").
		FindOne(c.Request.Context(), bson.M{"user_id": userID}).
		Decode(&progress)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.Status(http.StatusNoContent)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load progress"})
		}
		return
	}

	c.JSON(http.StatusOK, progress)
}

// saveProgressRequest mirrors GameProgress fields sent from the client
// (user_id and updated_at are set server-side).
type saveProgressRequest struct {
	Level            int     `json:"level"`
	Score            int     `json:"score"`
	ScoreMultiplier  float64 `json:"score_multiplier"`
	PassiveIncome    int     `json:"passive_income"`
	DonationCurrency int     `json:"donation_currency"`
	MovesLeft        int     `json:"moves_left"`
	ScoreTarget      int     `json:"score_target"`
}

// SaveProgress upserts (creates or replaces) game progress for the authenticated user.
//
// POST /api/user/progress
func (h *ScoreHandler) SaveProgress(c *gin.Context) {
	userID := c.MustGet(middleware.ContextKeyTelegramUserID).(int64)

	var req saveProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	progress := models.GameProgress{
		UserID:           userID,
		Level:            req.Level,
		Score:            req.Score,
		ScoreMultiplier:  req.ScoreMultiplier,
		PassiveIncome:    req.PassiveIncome,
		DonationCurrency: req.DonationCurrency,
		MovesLeft:        req.MovesLeft,
		ScoreTarget:      req.ScoreTarget,
		UpdatedAt:        time.Now(),
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var result models.GameProgress
	err := h.db.Collection("game_progress").FindOneAndUpdate(
		c.Request.Context(),
		bson.M{"user_id": userID},
		bson.M{"$set": progress},
		opts,
	).Decode(&result)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save progress"})
		return
	}

	c.JSON(http.StatusOK, result)
}
