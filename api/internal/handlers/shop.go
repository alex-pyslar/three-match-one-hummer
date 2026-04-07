package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/match3game/backend/internal/database"
	"github.com/match3game/backend/internal/middleware"
	"github.com/match3game/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ShopHandler groups dependencies for shop endpoints.
type ShopHandler struct {
	db *database.DB
}

// NewShopHandler constructs a ShopHandler.
func NewShopHandler(db *database.DB) *ShopHandler {
	return &ShopHandler{db: db}
}

// GetItems returns all active shop items.
//
// GET /api/shop/items
// No authentication required.
func (h *ShopHandler) GetItems(c *gin.Context) {
	ctx := c.Request.Context()

	cursor, err := h.db.Collection("shop_items").Find(ctx, bson.M{"active": true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch shop items"})
		return
	}
	defer cursor.Close(ctx)

	var items []models.ShopItem
	if err := cursor.All(ctx, &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode shop items"})
		return
	}
	if items == nil {
		items = []models.ShopItem{}
	}

	c.JSON(http.StatusOK, items)
}

type purchaseRequest struct {
	ItemID string `json:"item_id" binding:"required"`
}

type purchaseResponse struct {
	Success bool             `json:"success"`
	User    *models.User     `json:"user"`
	Item    *models.ShopItem `json:"item"`
}

// Purchase processes a shop transaction for the authenticated user.
// For donation_pack items: adds currency.
// For spending items: atomically verifies balance and deducts in one operation.
//
// POST /api/shop/purchase
func (h *ShopHandler) Purchase(c *gin.Context) {
	userID := c.MustGet(middleware.ContextKeyTelegramUserID).(int64)

	var req purchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_id is required"})
		return
	}

	itemOID, err := primitive.ObjectIDFromHex(req.ItemID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item_id"})
		return
	}

	ctx := c.Request.Context()

	// Fetch the shop item.
	var item models.ShopItem
	if err := h.db.Collection("shop_items").
		FindOne(ctx, bson.M{"_id": itemOID, "active": true}).
		Decode(&item); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load item"})
		}
		return
	}

	// Update user balance atomically.
	var updatedUser models.User
	retDoc := options.FindOneAndUpdate().SetReturnDocument(options.After)

	if item.ItemType == "donation_pack" {
		// Donation pack — add currency unconditionally (real payment assumed out-of-band).
		err = h.db.Collection("users").FindOneAndUpdate(ctx,
			bson.M{"telegram_id": userID},
			bson.M{
				"$inc": bson.M{"donation_currency": item.Value},
				"$set": bson.M{"updated_at": time.Now()},
			},
			retDoc,
		).Decode(&updatedUser)
	} else {
		// Spending item — atomically check balance AND deduct in one operation.
		// If the filter doesn't match (balance < price), no document is modified.
		err = h.db.Collection("users").FindOneAndUpdate(ctx,
			bson.M{
				"telegram_id":       userID,
				"donation_currency": bson.M{"$gte": item.Price},
			},
			bson.M{
				"$inc": bson.M{"donation_currency": -item.Price},
				"$set": bson.M{"updated_at": time.Now()},
			},
			retDoc,
		).Decode(&updatedUser)
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error": "insufficient donation currency",
				"price": item.Price,
			})
			return
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "purchase failed"})
		return
	}

	// Record the purchase (best-effort — not fatal if it fails).
	h.db.Collection("purchases").InsertOne(ctx, bson.M{
		"user_id":     userID,
		"item_id":     itemOID,
		"quantity":    1,
		"total_price": item.Price,
		"created_at":  time.Now(),
	})

	c.JSON(http.StatusOK, purchaseResponse{Success: true, User: &updatedUser, Item: &item})
}
