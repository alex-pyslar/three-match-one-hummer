package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a Telegram user stored in MongoDB.
type User struct {
	ID               primitive.ObjectID `bson:"_id,omitempty"      json:"id,omitempty"`
	TelegramID       int64              `bson:"telegram_id"        json:"telegram_id"`
	Username         string             `bson:"username"           json:"username"`
	FirstName        string             `bson:"first_name"         json:"first_name"`
	LastName         string             `bson:"last_name"          json:"last_name"`
	AvatarURL        string             `bson:"avatar_url"         json:"avatar_url"`
	DonationCurrency int                `bson:"donation_currency"  json:"donation_currency"`
	CreatedAt        time.Time          `bson:"created_at"         json:"created_at"`
	UpdatedAt        time.Time          `bson:"updated_at"         json:"updated_at"`
}

// Score records the result of a single game session.
type Score struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID    int64              `bson:"user_id"       json:"user_id"`
	Score     int                `bson:"score"         json:"score"`
	Level     int                `bson:"level"         json:"level"`
	CreatedAt time.Time          `bson:"created_at"    json:"created_at"`
}

// ShopItem describes a purchasable item in the in-game shop.
type ShopItem struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name"          json:"name"`
	Description string             `bson:"description"   json:"description"`
	ItemType    string             `bson:"item_type"     json:"item_type"` // donation_pack | extra_moves | score_boost
	Price       int                `bson:"price"         json:"price"`
	Value       int                `bson:"value"         json:"value"`
	Icon        string             `bson:"icon"          json:"icon"`
	Active      bool               `bson:"active"        json:"active"`
}

// GameProgress holds the full persistent game state for a user between sessions.
type GameProgress struct {
	UserID           int64     `bson:"user_id"           json:"user_id"`
	Level            int       `bson:"level"             json:"level"`
	Score            int       `bson:"score"             json:"score"`
	ScoreMultiplier  float64   `bson:"score_multiplier"  json:"score_multiplier"`
	PassiveIncome    int       `bson:"passive_income"    json:"passive_income"`
	DonationCurrency int       `bson:"donation_currency" json:"donation_currency"`
	MovesLeft        int       `bson:"moves_left"        json:"moves_left"`
	ScoreTarget      int       `bson:"score_target"      json:"score_target"`
	UpdatedAt        time.Time `bson:"updated_at"        json:"updated_at"`
}

// LeaderboardEntry is a projected result from the scores aggregation pipeline.
type LeaderboardEntry struct {
	Rank        int    `json:"rank"`
	TelegramID  int64  `json:"telegram_id"`
	Username    string `json:"username"`
	FirstName   string `json:"first_name"`
	AvatarURL   string `json:"avatar_url"`
	BestScore   int    `json:"best_score"`
	BestLevel   int    `json:"best_level"`
	GamesPlayed int    `json:"games_played"`
}

// TelegramUser is parsed from the `user` JSON field inside WebApp initData.
type TelegramUser struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	PhotoURL  string `json:"photo_url"`
}
