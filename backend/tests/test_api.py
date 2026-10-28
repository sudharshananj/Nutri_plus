import json
import pytest
from backend.app import create_app
from backend.database import init_db


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db = tmp_path / "test_nutrition_plus.db"
    from backend.config import Config
    monkeypatch.setattr(Config, "DATABASE_PATH", test_db)
    
    app = create_app(Config)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_check_api(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "not medical advice" in data["scope"].lower()


def test_session_creation(client):
    res = client.post("/api/session")
    assert res.status_code == 201
    data = res.get_json()
    assert "session_token" in data
    assert len(data["session_token"]) >= 32


def test_profile_endpoints(client):
    # 1. Create session
    s_res = client.post("/api/session")
    token = s_res.get_json()["session_token"]
    headers = {"X-Session-Token": token}

    # 2. Save profile
    profile_payload = {
        "age": 24,
        "eating_pattern": "vegetarian",
        "allergens": ["peanut"],
        "cuisines": ["south_indian"],
        "budget_level": "low",
        "max_cook_time_min": 25,
        "goal": "more_energy",
        "activity_level": "light",
        "equipment": ["none"],
        "workout_minutes": 20,
        "height_cm": 172,
        "current_weight_kg": 68.0,
        "target_weight_kg": 64.0
    }
    p_res = client.post("/api/profile", json=profile_payload, headers=headers)
    assert p_res.status_code == 200
    p_data = p_res.get_json()
    assert p_data["status"] == "success"
    assert p_data["transformation_summary"]["bmi_reference"] > 0
    assert p_data["transformation_summary"]["transformation_delta_kg"] == -4.0

    # 3. Get profile
    g_res = client.get("/api/profile", headers=headers)
    assert g_res.status_code == 200
    saved = g_res.get_json()["profile"]
    assert saved["age"] == 24
    assert saved["eating_pattern"] == "vegetarian"


def test_recommendations_generation(client):
    s_res = client.post("/api/session")
    token = s_res.get_json()["session_token"]
    headers = {"X-Session-Token": token}

    profile_payload = {
        "age": 28,
        "eating_pattern": "vegetarian",
        "allergens": ["peanut"],
        "cuisines": ["south_indian", "mediterranean"],
        "budget_level": "medium",
        "max_cook_time_min": 30,
        "goal": "balanced",
        "activity_level": "moderate",
        "equipment": ["yoga_mat"],
        "workout_minutes": 20
    }
    # Save profile first
    client.post("/api/profile", json=profile_payload, headers=headers)

    # Get recommendations
    res = client.post("/api/recommendations", json={}, headers=headers)
    assert res.status_code == 200
    data = res.get_json()

    assert "disclaimer" in data
    assert "meals" in data
    assert "workouts" in data
    assert len(data["meals"]) >= 3
    assert len(data["workouts"]) == 3
    assert data["excluded_count"] > 0

    # Every meal and workout has an explainable reason
    for meal in data["meals"]:
        assert "reason" in meal
        assert len(meal["reason"]) > 10
        assert "recipe_steps" in meal

    for workout in data["workouts"]:
        assert "reason" in workout
        assert len(workout["reason"]) > 10


def test_feedback_endpoint(client):
    s_res = client.post("/api/session")
    token = s_res.get_json()["session_token"]
    headers = {"X-Session-Token": token}

    # Record like
    fb_res = client.post(
        "/api/feedback",
        json={"item_type": "meal", "item_id": "m001", "action": "like"},
        headers=headers
    )
    assert fb_res.status_code == 200
    data = fb_res.get_json()
    assert data["status"] == "success"
    assert "cuisine:south_indian" in data["updated_weights"]


def test_saved_plans_crud(client):
    s_res = client.post("/api/session")
    token = s_res.get_json()["session_token"]
    headers = {"X-Session-Token": token}

    # Save plan
    plan_data = {"meals": [{"id": "m001", "name": "Poha"}], "workouts": []}
    res = client.post("/api/plans", json={"title": "Monday Wellness", "plan": plan_data}, headers=headers)
    assert res.status_code == 201
    plan_id = res.get_json()["plan_id"]

    # List plans
    list_res = client.get("/api/plans", headers=headers)
    assert list_res.status_code == 200
    plans = list_res.get_json()["plans"]
    assert len(plans) == 1
    assert plans[0]["id"] == plan_id

    # Delete plan
    del_res = client.delete(f"/api/plans/{plan_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify deleted
    list_res_after = client.get("/api/plans", headers=headers)
    assert len(list_res_after.get_json()["plans"]) == 0


def test_recipe_endpoint(client):
    res = client.get("/api/meals/m001/recipe")
    assert res.status_code == 200
    data = res.get_json()
    assert data["id"] == "m001"
    assert "ingredients" in data
    assert "recipe_steps" in data
    assert len(data["recipe_steps"]) > 0


def test_food_scanner_endpoint(client):
    res = client.post("/api/scan-food", json={"client_hint": "poha"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert "Poha" in data["detected_food"]
    assert data["nutrition_estimate"]["calories"] > 0
    assert "portion_options" in data
    assert "disclaimer" in data


def test_catalog_workouts_endpoint(client):
    res = client.get("/api/catalog/workouts")
    assert res.status_code == 200
    data = res.get_json()
    assert "items" in data
    assert data["total"] > 0

    # Filter by chest
    res_chest = client.get("/api/catalog/workouts?body_part=chest")
    assert res_chest.status_code == 200
    items = res_chest.get_json()["items"]
    assert len(items) > 0
    assert all(w["target_body_part"] == "chest" for w in items)

    # Filter by home
    res_home = client.get("/api/catalog/workouts?workout_type=home")
    assert res_home.status_code == 200
    assert res_home.get_json()["total"] > 0


def test_weight_gain_recommendation_flow(client):
    session_res = client.post("/api/session")
    token = session_res.get_json()["session_token"]
    headers = {"X-Session-Token": token}

    payload = {
        "age": 24,
        "eating_pattern": "vegetarian",
        "allergens": [],
        "cuisines": ["north_indian", "continental"],
        "budget_level": "medium",
        "max_cook_time_min": 35,
        "goal": "weight_gain",
        "activity_level": "moderate",
        "equipment": ["dumbbells", "gym"],
        "workout_minutes": 30,
        "height_cm": 178,
        "current_weight_kg": 62.0,
        "target_weight_kg": 70.0
    }

    res = client.post("/api/recommendations", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["meals"]) > 0
    assert len(data["workouts"]) > 0
    assert data["transformation_summary"]["target_delta_kg"] == 8.0
