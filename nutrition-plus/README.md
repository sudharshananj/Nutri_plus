# Nutrition Plus: An AI-Based Personalised Nutrition and Fitness Recommendation System

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-green.svg)](https://flask.palletsprojects.com/)
[![License: Academic](https://img.shields.io/badge/License-Academic%20Mini--Project-teal.svg)](#)
[![WCAG 2.1 AA](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-emerald.svg)](#)

> **Academic Mini Project** | CSE Department | First Review Stage  
> **Scope:** General wellness ideas and physical activity suggestions for **adults aged 18+**. **Not medical advice.**

---

## 1. Project Overview

Generic diet apps prescribe one-size-fits-all meal plans that ignore personal allergies, cultural cuisine tastes, cooking time limits, and budget constraints. Furthermore, fitness and nutrition tools are usually isolated from one another.

**Nutrition Plus** bridges this gap by providing **ONE cohesive profile** and **ONE transparent, explainable, and fully editable daily planner**. It combines nourishing meal ideas with matched movement recommendations tailored for everyday adult living.

### What "AI" Means in this System
- **Deterministic Rule-Based Recommender:** A transparent multi-stage pipeline consisting of an **Input Validator**, a strict **Safety Exclusion Filter**, a **Weighted Ranker**, and an **Explainer Engine**.
- **100% Offline & Private:** Operates entirely offline without black-box neural networks, external third-party subscriptions, or paid cloud APIs.
- **Explainable by Design:** Every recommendation attaches a human-readable justification stating the exact reasons it was selected.

---

## 2. Hard Scope & Boundary Rules (Enforced in Code & UI)

1. **Adults 18+ Only:** Validated strictly at the API and client level; users under 18 receive an explicit refusal.
2. **Zero Medical History:** Does **not** collect medical history, diagnoses, diseases, medications, or lab values. Input containing medical keywords is rejected with HTTP 400.
3. **Safety Exclusion Before Ranking:** Allergy and dietary exclusions run **before** scoring and are **never** overridden by user feedback or ranking weights.
4. **Soft Preference Feedback Only:** User interactions (`like`, `dislike`, `skip`, `swap`) only adjust soft preference weights (cuisine, cost level, exercise style) clamped to `[-3.0, +3.0]`.
5. **Sample Baseline Nutrients:** Nutritional numbers (calories, macros) are sample home-cooking baseline estimates, not lab-verified measurements.
6. **Persistent Medical Disclaimer:** Displayed across all UI screens and API response bodies:
   > *"General wellness ideas, not medical advice. Check ingredient labels and cross-contact information."*

---

## 3. System Architecture

```
[ Browser: HTML5 / CSS3 / Vanilla ES6 JavaScript ]
   Profile Wizard -> Daily Planner -> Swap / Skip / Save -> Like/Dislike Feedback
            |                                         ^
            |  REST API (JSON over HTTP)              |
            v                                         |
[ Flask Application Factory (backend/app.py) ]
   1. Validator (validator.py)         --> Reject < 18 & medical fields
   2. Safety Filter (safety_filter.py) --> Strictly filter allergens & diet
   3. Ranker (ranker.py)               --> 0-10 deterministic scoring
   4. Workout Selector                 --> Duration, equipment, & intensity
   5. Explainer (explainer.py)         --> Attach transparent rationale text
   6. Camera Scanner (food_scanner.py) --> Offline visual heuristic estimation
            |                                         ^
            |  Read / Write Parameterised SQL         |
            v                                         |
[ Data Layer (SQLite via backend/database.py) ]
   - users (anonymous session tokens)
   - profiles (age, height, current/target weight, diet, allergens, budget, cook time)
   - meals (44 items with step-by-step recipes & ingredients checklists)
   - workouts (22 routines with duration, equipment & instructions)
   - recommendations (audit trail of generated ideas)
   - preference_weights (user_id, dimension, value, weight clamped [-3, +3])
   - saved_plans (user-saved plan library)
```

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| **Front End** | Semantic HTML5, CSS3 (Custom design system, Responsive, Dark/Light modes), Vanilla JavaScript (ES6 modules, `fetch`) |
| **Back End** | Python 3.10+, Flask, Flask-CORS, Flask-Limiter, python-dotenv |
| **Data (Catalog)** | JSON catalogs (`meals.json`, `workouts.json`) |
| **Data (Persistent)** | SQLite via Python `sqlite3` (`backend/schema.sql`, parameterised queries) |
| **Testing** | `pytest` |
| **Security Standards** | OWASP API Security Top 10 (BOLA defense, input allow-lists, rate limits) |

---

## 5. Repository Structure

```
nutrition-plus/
├── README.md
├── requirements.txt
├── .env.example
├── .env
├── backend/
│   ├── app.py                  # Flask app factory + route registration
│   ├── config.py               # settings (DB path, rate limits, CORS origins)
│   ├── database.py             # sqlite3 connection + init_db()
│   ├── schema.sql              # full SQL schema with indexes
│   ├── seed.py                 # loads JSON catalog into SQLite
│   ├── routes/
│   │   ├── auth_helper.py      # session token validation helper
│   │   ├── profile_routes.py   # /api/session, /api/profile
│   │   ├── recommend_routes.py # /api/recommendations, /api/recommendations/swap, recipes
│   │   ├── feedback_routes.py  # /api/feedback
│   │   ├── plan_routes.py      # /api/plans (CRUD with BOLA checks)
│   │   └── food_scanner_routes.py # /api/scan-food (camera & image analysis)
│   ├── services/
│   │   ├── validator.py        # input validation + medical field rejection
│   │   ├── safety_filter.py    # allergen & diet exclusion (runs FIRST)
│   │   ├── ranker.py           # deterministic 0-10 weighted scoring
│   │   ├── workout_selector.py # movement ideas matching equipment & duration
│   │   ├── explainer.py        # rationale sentence generation
│   │   ├── feedback_service.py # soft-preference weights (clamped [-3, +3])
│   │   └── food_scanner.py     # offline heuristic food & calorie detection
│   ├── data/
│   │   ├── meals.json          # 44 meals with full recipes and nutrition
│   │   └── workouts.json       # 22 workouts with step instructions
│   └── tests/
│       ├── test_validator.py   # age, medical field, enum tests
│       ├── test_safety_filter.py # allergen exclusion and keyword alias tests
│       ├── test_ranker.py      # score weights, variety, and swap tests
│       └── test_api.py         # full endpoint integration tests
└── frontend/
    ├── index.html              # landing hero, features, how-it-works, disclaimer
    ├── profile.html            # multi-step wizard, height/weight transformation preview
    ├── results.html            # daily recommendations, recipes, swaps, feedback
    ├── saved.html              # saved plans library & recipe view
    ├── scanner.html            # live webcam & image food scanner with calorie meter
    ├── about.html              # scope, safety, architecture diagram, references
    ├── css/
    │   ├── styles.css          # wellness design system, color tokens, dark mode
    │   └── responsive.css      # mobile-first breakpoints & navigation drawer
    └── js/
        ├── api.js              # fetch wrapper with X-Session-Token & error handling
        ├── profile.js          # wizard stepper, client validation, draft storage
        ├── results.js          # planner rendering, recipe modal, like/dislike/swap
        ├── saved.js            # saved plan viewer and recipe modal
        ├── scanner.js          # camera capture, canvas frame, portion adjuster
        └── utils.js            # toast, theme toggle, modal dismiss, XSS escaping
```

---

## 6. Installation & Run Instructions

### Step 1: Clone or navigate to the workspace
```bash
cd "c:\Users\sudha\Desktop\hi"
```

### Step 2: Set up Python Environment & Install Dependencies
```bash
# Using Python 3.10+ (or py launcher on Windows)
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
.\venv\Scripts\activate.bat
# Linux / macOS:
source venv/bin/activate

# Install required packages
pip install -r requirements.txt
```

### Step 3: Run the Application
```bash
python backend/app.py
# (or 'py backend/app.py' on Windows)
```
The server will start on **`http://localhost:5000`** and automatically initialize and seed the SQLite database if not already populated.

### Step 4: Open in Your Browser
Visit:
👉 **`http://localhost:5000`**

*(Note: The Flask application directly serves all static frontend files, enabling full offline operation with a single command!)*

---

## 7. Running Tests

Run the complete automated pytest suite:
```bash
pytest -v
# or: py -m pytest -v
```
All 21 comprehensive unit and integration tests will execute and pass:
- `test_validator.py`: Under-18 rejection, medical fields rejection, enum validation, string sanitization.
- `test_safety_filter.py`: Peanut allergy exclusion on full catalog, vegan exclusion of animal ingredients, keyword alias scanning.
- `test_ranker.py`: Cuisine bonuses, cooking time scaling, feedback adjustment bounds, plan slot selection, swap isolation.
- `test_api.py`: All REST endpoints, status codes, JSON response shapes, BOLA ownership authorization, and food scanner calorie detection.

---

## 8. REST API Documentation

| Method | Endpoint | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/health` | Health check & scope confirmation | None |
| `POST` | `/api/session` | Create anonymous user session | None |
| `POST` | `/api/profile` | Validate and store user profile | `X-Session-Token` |
| `GET` | `/api/profile` | Retrieve saved user profile | `X-Session-Token` |
| `POST` | `/api/recommendations` | Generate daily meals & workouts | `X-Session-Token` (optional) |
| `POST` | `/api/recommendations/swap` | Swap one meal or workout with alternative | `X-Session-Token` (optional) |
| `POST` | `/api/feedback` | Record `like`, `dislike`, `skip`, or `swap` | `X-Session-Token` |
| `GET` | `/api/catalog/meals` | Paginated catalog meals with filters | None |
| `GET` | `/api/meals/<id>/recipe` | Retrieve full recipe and cooking instructions | None |
| `POST` | `/api/plans` | Save current plan | `X-Session-Token` |
| `GET` | `/api/plans` | List user's saved plans | `X-Session-Token` |
| `DELETE` | `/api/plans/<id>` | Delete saved plan (BOLA protected) | `X-Session-Token` |
| `POST` | `/api/scan-food` | Offline camera/image food & calorie detection | `X-Session-Token` (optional) |

---

## 9. Academic Review Demo Script (5 Steps)

Follow this 5-step demonstration for the first-review presentation:

### Step 1: Demonstrate Hard Scope Rules & Under-18 Refusal
1. Open `http://localhost:5000` and click **"Build My Wellness Plan"**.
2. In Step 1, enter Age **17**. Click Continue. Notice the strict rejection toast: *"This tool is strictly for adults 18+ only."*
3. Change Age to **24**. Enter Height (172 cm), Current Weight (68 kg), Target Weight (64 kg). Notice the live wellness BMI reference and transformation target delta badge.
4. Note the absence of any medical history or clinical diagnosis questions.

### Step 2: Configure Safety Allergies & Preferences
1. Select **Vegetarian** eating pattern.
2. In Step 2, select **Peanut** allergy. Choose **South Indian** and **Mediterranean** cuisines.
3. In Step 3, choose **Low Budget** and a **25-minute** cooking time limit.
4. In Step 4, choose **Light Activity**, **Zero Equipment (None)**, and **20 minutes** workout.
5. In Step 5, review the choices and click **"Generate My Recommendations"**.

### Step 3: Inspect Recommendations, Rationale & Excluded Transparency
1. On `results.html`, observe the badge: **"14+ meals excluded for your safety & diet"**. Click it to show the modal detailing exactly which meals were filtered out and why.
2. Notice the meals recommended: e.g., *Vegetable Poha* is excluded because it contains peanuts, while *Ragi Dosa* or *Idli Sambar* is selected.
3. Expand **"Why this suggestion?"** on any card to show the transparent rationale text explaining the exact matching factors.

### Step 4: Explore Recipes & Interactive Swap
1. Click **"View Full Recipe & Instructions"** on any meal card to display the step-by-step cooking guide with interactive ingredients checklist and cooking tips.
2. Click the **"⇄ Swap"** button on the breakfast card. Watch the card animate and replace itself with the next-best safe alternative.
3. Click the **👍 Like** button on a South Indian dish to update soft-preference weights.
4. Click **"Save Plan"**, provide a name, and navigate to **"Saved Plans"** to confirm persistent storage.

### Step 5: Test the AI Camera Food Scanner & Calorie Estimator
1. Click **"📸 Food Scanner"** in the navigation bar.
2. Demonstrate live camera scanning or click one of the preset buttons (e.g., **"🍋 Poha"** or **"🥥 Idli Sambar"**).
3. Observe the offline visual recognition, confidence score, estimated calories (kcal), and macronutrient bars (protein, carbs, fats, fiber).
4. Click **Small (0.75x)** or **Large (1.5x)** portion size buttons to demonstrate real-time recalibration of calorie values.
5. Click **"View Healthy Recipe"** to link directly back to the cooking preparation guide!

---

## 10. Future Work

- **Smart Grocery Checklist Generation:** Aggregating ingredients from weekly saved plans into a consolidated shopping checklist.
- **Ingredient Alternatives Engine:** Suggesting substitute vegetables and spices based on seasonal availability.
- **Localized Regional Food Databases:** Expanding beyond 5 major culinary traditions to include hyper-local regional millets and pulses.
- **Dietitian-Reviewed Catalog Expansion:** Partnering with licensed nutritionists for formal biochemical catalog validation.

---

## 11. Ethical Disclaimer

> **Nutrition Plus provides general wellness lifestyle ideas and is NOT a medical device, clinical diagnostic tool, or personalized healthcare treatment service.** Always consult a qualified physician, registered dietitian, or certified healthcare professional regarding medical conditions, food allergies, or clinical dietary interventions.
