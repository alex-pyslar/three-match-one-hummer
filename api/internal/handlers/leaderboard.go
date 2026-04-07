package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/match3game/backend/internal/database"
	"github.com/match3game/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// LeaderboardHandler groups dependencies for leaderboard endpoints.
type LeaderboardHandler struct {
	db *database.DB
}

// NewLeaderboardHandler constructs a LeaderboardHandler.
func NewLeaderboardHandler(db *database.DB) *LeaderboardHandler {
	return &LeaderboardHandler{db: db}
}

// GetLeaderboard returns top players ranked by their best score.
//
// GET /api/leaderboard?limit=50
// No authentication required.
func (h *LeaderboardHandler) GetLeaderboard(c *gin.Context) {
	limit := int64(50)
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.ParseInt(l, 10, 64); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	ctx := c.Request.Context()

	// Aggregate: group scores by user, join with users collection, sort by best score.
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$user_id"},
			{Key: "best_score", Value: bson.D{{Key: "$max", Value: "$score"}}},
			{Key: "best_level", Value: bson.D{{Key: "$max", Value: "$level"}}},
			{Key: "games_played", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "best_score", Value: -1}}}},
		{{Key: "$limit", Value: limit}},
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "users"},
			{Key: "localField", Value: "_id"},
			{Key: "foreignField", Value: "telegram_id"},
			{Key: "as", Value: "user_info"},
		}}},
		{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$user_info"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
		{{Key: "$project", Value: bson.D{
			{Key: "telegram_id", Value: "$_id"},
			{Key: "best_score", Value: 1},
			{Key: "best_level", Value: 1},
			{Key: "games_played", Value: 1},
			{Key: "username", Value: "$user_info.username"},
			{Key: "first_name", Value: "$user_info.first_name"},
			{Key: "avatar_url", Value: "$user_info.avatar_url"},
		}}},
	}

	cursor, err := h.db.Collection("scores").Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch leaderboard"})
		return
	}
	defer cursor.Close(ctx)

	entries := make([]models.LeaderboardEntry, 0, limit)
	rank := 1
	for cursor.Next(ctx) {
		var raw struct {
			TelegramID  int64  `bson:"telegram_id"`
			BestScore   int    `bson:"best_score"`
			BestLevel   int    `bson:"best_level"`
			GamesPlayed int    `bson:"games_played"`
			Username    string `bson:"username"`
			FirstName   string `bson:"first_name"`
			AvatarURL   string `bson:"avatar_url"`
		}
		if err := cursor.Decode(&raw); err != nil {
			continue
		}
		entries = append(entries, models.LeaderboardEntry{
			Rank:        rank,
			TelegramID:  raw.TelegramID,
			Username:    raw.Username,
			FirstName:   raw.FirstName,
			AvatarURL:   raw.AvatarURL,
			BestScore:   raw.BestScore,
			BestLevel:   raw.BestLevel,
			GamesPlayed: raw.GamesPlayed,
		})
		rank++
	}

	if err := cursor.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "leaderboard cursor error"})
		return
	}

	c.JSON(http.StatusOK, entries)
}
