package database

import (
	"context"
	"log"
	"time"

	"github.com/match3game/backend/internal/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

// DB wraps a MongoDB client and a specific database handle.
type DB struct {
	client   *mongo.Client
	database *mongo.Database
}

// Collection returns the named collection on the wrapped database.
func (db *DB) Collection(name string) *mongo.Collection {
	return db.database.Collection(name)
}

// Ping checks that the MongoDB primary is reachable.
func (db *DB) Ping(ctx context.Context) error {
	return db.client.Ping(ctx, readpref.Primary())
}

// Close disconnects from MongoDB gracefully.
func (db *DB) Close() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.client.Disconnect(ctx); err != nil {
		log.Printf("mongodb: disconnect error: %v", err)
	}
}

// Connect creates a MongoDB client, verifies connectivity, creates indexes, and
// seeds initial data.  It panics on failure — the application cannot run without
// a database.
func Connect(cfg *config.Config) *DB {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(cfg.MongoURI)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("mongodb: connect error: %v", err)
	}

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		log.Fatalf("mongodb: ping failed — is MongoDB running? URI=%s  error: %v", cfg.MongoURI, err)
	}

	mdb := client.Database(cfg.MongoDB)
	ensureIndexes(ctx, mdb)
	seedShopItems(ctx, mdb)

	log.Printf("mongodb: connected to database %q", cfg.MongoDB)
	return &DB{client: client, database: mdb}
}

// ensureIndexes creates necessary indexes if they do not already exist.
func ensureIndexes(ctx context.Context, db *mongo.Database) {
	// users — unique on telegram_id for fast lookups and conflict prevention
	db.Collection("users").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "telegram_id", Value: 1}},
		Options: options.Index().SetUnique(true).SetBackground(true),
	})

	// scores — index on user_id for per-user queries; index on score desc for leaderboard
	db.Collection("scores").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}}},
		{Keys: bson.D{{Key: "score", Value: -1}}},
	})

	// game_progress — unique on user_id (one progress record per user)
	db.Collection("game_progress").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "user_id", Value: 1}},
		Options: options.Index().SetUnique(true).SetBackground(true),
	})

	// shop_items — index on active for filtered queries
	db.Collection("shop_items").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "active", Value: 1}},
	})
}

// seedShopItems inserts default shop items when the collection is empty.
func seedShopItems(ctx context.Context, db *mongo.Database) {
	coll := db.Collection("shop_items")
	count, err := coll.CountDocuments(ctx, bson.M{})
	if err != nil || count > 0 {
		return
	}

	items := []interface{}{
		bson.M{"name": "Набор монет S", "description": "50 донат-монет", "item_type": "donation_pack", "price": 0, "value": 50, "icon": "/assets/donation.png", "active": true},
		bson.M{"name": "Набор монет M", "description": "150 донат-монет", "item_type": "donation_pack", "price": 0, "value": 150, "icon": "/assets/donation.png", "active": true},
		bson.M{"name": "Набор монет L", "description": "500 донат-монет", "item_type": "donation_pack", "price": 0, "value": 500, "icon": "/assets/donation.png", "active": true},
		bson.M{"name": "Доп. ходы +5", "description": "Добавить 5 ходов к текущему уровню", "item_type": "extra_moves", "price": 30, "value": 5, "icon": "/assets/valuta.png", "active": true},
		bson.M{"name": "Бустер очков ×2", "description": "Удвоить множитель на 1 уровень", "item_type": "score_boost", "price": 50, "value": 2, "icon": "/assets/valuta.png", "active": true},
	}

	if _, err := coll.InsertMany(ctx, items); err != nil {
		log.Printf("mongodb: seed shop items error: %v", err)
	} else {
		log.Printf("mongodb: seeded %d shop items", len(items))
	}
}
