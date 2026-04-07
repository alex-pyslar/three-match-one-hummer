package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"three-match-one-hummer/api/internal/database"
	"three-match-one-hummer/api/internal/models"
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

	// Only consider scores from users active within the last 90 days.
	// This filters out stale test data and inactive accounts automatically.
	activeAfter := time.Now().UTC().AddDate(0, 0, -90)

	// Aggregate: group scores by user, join with users collection, sort by best score.
	// The $unwind without preserveNullAndEmptyArrays acts as an inner join —
	// any score whose user_id has no matching user document is silently dropped.
	// This eliminates "ghost" entries left over from development/test sessions.
	pipeline := mongo.Pipeline{
		// Only include recent scores
		{{Key: "$match", Value: bson.D{
			{Key: "created_at", Value: bson.D{{Key: "$gte", Value: activeAfter}}},
		}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$user_id"},
			{Key: "best_score", Value: bson.D{{Key: "$max", Value: "$score"}}},
			{Key: "best_level", Value: bson.D{{Key: "$max", Value: "$level"}}},
			{Key: "games_played", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "best_score", Value: -1}}}},
		{{Key: "$limit", Value: limit}},
		// Inner join with users — excludes any entry with no matching Telegram user
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "users"},
			{Key: "localField", Value: "_id"},
			{Key: "foreignField", Value: "telegram_id"},
			{Key: "as", Value: "user_info"},
		}}},
		// $unwind without preserveNullAndEmptyArrays = inner join (drops non-matched)
		{{Key: "$unwind", Value: "$user_info"}},
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
