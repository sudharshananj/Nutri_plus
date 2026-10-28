-- Nutrition Plus Database Schema
-- Academic Mini Project: Rule-Based Nutrition and Fitness Recommendation System

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,       -- anonymous; no email/name required
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER NOT NULL CHECK (age >= 18 AND age <= 100),
  height_cm INTEGER CHECK (height_cm IS NULL OR (height_cm >= 100 AND height_cm <= 250)),
  current_weight_kg REAL CHECK (current_weight_kg IS NULL OR (current_weight_kg >= 30.0 AND current_weight_kg <= 300.0)),
  target_weight_kg REAL CHECK (target_weight_kg IS NULL OR (target_weight_kg >= 30.0 AND target_weight_kg <= 300.0)),
  eating_pattern TEXT NOT NULL,             -- vegan|vegetarian|eggetarian|non_veg|halal|jain
  allergens TEXT NOT NULL DEFAULT '[]',     -- JSON array: peanut, tree_nut, milk, egg, soy, wheat, fish, shellfish, sesame
  cuisines TEXT NOT NULL DEFAULT '[]',      -- JSON array
  budget_level TEXT NOT NULL,               -- low|medium|high
  max_cook_time_min INTEGER NOT NULL,
  goal TEXT NOT NULL,                       -- balanced|more_energy|light_meals|high_protein|stay_active
  activity_level TEXT NOT NULL,             -- sedentary|light|moderate|active
  equipment TEXT NOT NULL DEFAULT '[]',     -- none|dumbbells|resistance_band|yoga_mat|gym
  workout_minutes INTEGER NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  meal_type TEXT NOT NULL,                  -- breakfast|lunch|dinner|snack
  diet_tags TEXT NOT NULL,                  -- JSON array of compatible patterns
  allergens TEXT NOT NULL,                  -- JSON array
  ingredients TEXT NOT NULL,                -- JSON array
  prep_time_min INTEGER NOT NULL,
  cook_time_min INTEGER DEFAULT 0,
  cost_level TEXT NOT NULL,                 -- low|medium|high
  goal_tags TEXT NOT NULL,                  -- JSON array
  sample_calories INTEGER,                  -- sample, unverified
  sample_protein_g REAL,
  description TEXT,
  recipe_steps TEXT DEFAULT '[]',           -- JSON array of step-by-step instructions
  chef_tips TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,                   -- walk|strength|mobility|cardio|yoga
  intensity TEXT NOT NULL,                  -- low|moderate|high
  duration_min INTEGER NOT NULL,
  equipment TEXT NOT NULL,                  -- JSON array
  steps TEXT NOT NULL,                      -- JSON array of instructions
  description TEXT
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,                  -- meal|workout
  item_id TEXT NOT NULL,
  slot TEXT,
  score REAL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('like','dislike','skip','swap')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preference_weights (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,                  -- cuisine|meal_style|workout_category|cost_level
  value TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,           -- clamped to [-3, +3]
  PRIMARY KEY (user_id, dimension, value)
);

CREATE TABLE IF NOT EXISTS saved_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_reco_user ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_plans_user ON saved_plans(user_id);
