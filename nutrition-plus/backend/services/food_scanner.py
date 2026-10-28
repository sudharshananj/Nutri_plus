import base64
import re
from typing import Any, Dict, List, Optional
from pathlib import Path
import json

# Local food database for offline detection and nutritional estimation
OFFLINE_FOOD_DATABASE = [
    {
        "name": "Vegetable Poha",
        "keywords": ["poha", "flattened rice", "breakfast", "peas", "yellow", "lemon"],
        "color_profile": "yellow_green",
        "calories_per_serving": 250,
        "protein_g": 6.2,
        "carbs_g": 42.0,
        "fat_g": 7.0,
        "fiber_g": 3.8,
        "serving_size": "1 bowl (approx 180g)",
        "catalog_meal_id": "m001",
        "health_tip": "High in iron and carbohydrates; squeeze fresh lemon for enhanced vitamin C absorption."
    },
    {
        "name": "Steamed Idli with Sambar",
        "keywords": ["idli", "sambar", "steamed", "south indian", "white", "lentil"],
        "color_profile": "white_orange",
        "calories_per_serving": 280,
        "protein_g": 9.0,
        "carbs_g": 54.0,
        "fat_g": 2.5,
        "fiber_g": 5.0,
        "serving_size": "3 idlis + 1 cup sambar",
        "catalog_meal_id": "m002",
        "health_tip": "Naturally fermented and steamed; very gentle on the gastrointestinal tract."
    },
    {
        "name": "Fresh Green Salad Bowl",
        "keywords": ["salad", "greens", "lettuce", "cucumber", "spinach", "vegetable"],
        "color_profile": "vibrant_green",
        "calories_per_serving": 130,
        "protein_g": 4.0,
        "carbs_g": 14.0,
        "fat_g": 6.0,
        "fiber_g": 5.5,
        "serving_size": "1 large bowl (220g)",
        "catalog_meal_id": "m011",
        "health_tip": "Loaded with micronutrients, electrolytes, and dietary hydration."
    },
    {
        "name": "Moong Dal Cheela (Lentil Crepe)",
        "keywords": ["cheela", "chilla", "crepe", "dosa", "yellow", "moong"],
        "color_profile": "golden_yellow",
        "calories_per_serving": 260,
        "protein_g": 14.5,
        "carbs_g": 36.0,
        "fat_g": 5.0,
        "fiber_g": 6.2,
        "serving_size": "2 medium cheelas",
        "catalog_meal_id": "m003",
        "health_tip": "High bioavailable plant protein with low saturated fat."
    },
    {
        "name": "Grilled Lemon Herb Chicken",
        "keywords": ["chicken", "grilled", "meat", "poultry", "protein", "breast"],
        "color_profile": "golden_brown",
        "calories_per_serving": 380,
        "protein_g": 38.0,
        "carbs_g": 8.0,
        "fat_g": 12.0,
        "fiber_g": 2.0,
        "serving_size": "1 breast fillet (150g)",
        "catalog_meal_id": "m013",
        "health_tip": "Lean protein powerhouse supporting post-workout muscle protein synthesis."
    },
    {
        "name": "Dal Tadka with Steamed Rice",
        "keywords": ["dal", "rice", "curry", "yellow dal", "lentils", "bhat"],
        "color_profile": "yellow_white",
        "calories_per_serving": 410,
        "protein_g": 15.0,
        "carbs_g": 72.0,
        "fat_g": 6.5,
        "fiber_g": 8.5,
        "serving_size": "1 bowl dal + 1 cup rice",
        "catalog_meal_id": "m012",
        "health_tip": "Complete protein pairing when legumes and cereal grains are combined."
    },
    {
        "name": "Fruit & Oatmeal Chia Bowl",
        "keywords": ["oats", "oatmeal", "chia", "apple", "berries", "fruit", "porridge"],
        "color_profile": "creamy_red",
        "calories_per_serving": 310,
        "protein_g": 8.5,
        "carbs_g": 49.0,
        "fat_g": 9.5,
        "fiber_g": 8.0,
        "serving_size": "1 medium bowl (250g)",
        "catalog_meal_id": "m006",
        "health_tip": "Beta-glucan soluble fibers promote prolonged satiety and steady glucose levels."
    },
    {
        "name": "Paneer Tikka with Peppers",
        "keywords": ["paneer", "tikka", "cottage cheese", "capsicum", "tandoori"],
        "color_profile": "orange_red",
        "calories_per_serving": 320,
        "protein_g": 18.0,
        "carbs_g": 12.0,
        "fat_g": 18.0,
        "fiber_g": 3.5,
        "serving_size": "6 tandoori skewers/cubes",
        "catalog_meal_id": "m017",
        "health_tip": "Rich in calcium and slow-digesting casein protein."
    },
    {
        "name": "Crisp Apple with Peanut Butter",
        "keywords": ["apple", "peanut butter", "fruit", "red", "snack"],
        "color_profile": "red_brown",
        "calories_per_serving": 210,
        "protein_g": 6.0,
        "carbs_g": 26.0,
        "fat_g": 11.0,
        "fiber_g": 4.8,
        "serving_size": "1 apple + 1.5 tbsp nut butter",
        "catalog_meal_id": "m036",
        "health_tip": "Healthy monounsaturated fats paired with crisp pectin fibers."
    },
    {
        "name": "Mediterranean Hummus & Veggie Sticks",
        "keywords": ["hummus", "cucumber", "carrot", "chickpea", "dip"],
        "color_profile": "beige_orange",
        "calories_per_serving": 160,
        "protein_g": 6.0,
        "carbs_g": 18.0,
        "fat_g": 7.5,
        "fiber_g": 5.0,
        "serving_size": "3 tbsp hummus + raw veggies",
        "catalog_meal_id": "m037",
        "health_tip": "Rich in plant lignans and monounsaturated olive oil fats."
    }
]


def extract_visual_hue_heuristics(image_data: bytes) -> str:
    """
    Analyzes sample byte histogram of image data to estimate the dominant color family offline.
    """
    if len(image_data) < 200:
        return "neutral"

    # Sample a stride of bytes across the image payload
    sample = image_data[50:min(len(image_data), 15000)]
    
    # Calculate simple RGB frequency heuristics from byte distributions
    avg_val = sum(sample) / len(sample)
    green_count = sum(1 for b in sample if 50 < b < 120)
    warm_count = sum(1 for b in sample if 140 < b < 220)
    light_count = sum(1 for b in sample if b > 200)

    if green_count > len(sample) * 0.35:
        return "vibrant_green"
    elif warm_count > len(sample) * 0.40:
        return "golden_yellow"
    elif light_count > len(sample) * 0.35:
        return "white_orange"
    else:
        return "golden_brown"


def scan_and_detect_food(
    image_base64: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    client_hint: Optional[str] = None
) -> Dict[str, Any]:
    """
    Offline food and calorie recognition service.
    Analyzes image payload + optional client search hint/filename,
    returning top matched food item, calories, macros, and portion adjustments.
    """
    binary_data = b""
    if image_base64:
        # Strip header like data:image/jpeg;base64, if present
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        try:
            binary_data = base64.b64decode(image_base64)
        except Exception:
            binary_data = b""
    elif image_bytes:
        binary_data = image_bytes

    detected_color = extract_visual_hue_heuristics(binary_data) if binary_data else "neutral"

    # Match against database using keyword hints and visual profile
    hint_clean = (client_hint or "").lower().strip()
    
    scored_candidates = []
    for food in OFFLINE_FOOD_DATABASE:
        score = 50.0  # base likelihood
        
        # Check text hint / filename matching
        if hint_clean:
            for kw in food["keywords"]:
                if kw in hint_clean:
                    score += 45.0
                    break
            if food["name"].lower() in hint_clean:
                score += 50.0

        # Check color profile heuristic
        if detected_color != "neutral" and detected_color == food["color_profile"]:
            score += 25.0

        scored_candidates.append((food, min(98.0, score)))

    scored_candidates.sort(key=lambda x: -x[1])
    top_food, top_confidence = scored_candidates[0]
    alternate_candidates = [
        {"name": f["name"], "confidence": f"{round(c)}%", "sample_calories": f["calories_per_serving"]}
        for f, c in scored_candidates[1:4]
    ]

    base_cals = top_food["calories_per_serving"]
    base_protein = top_food["protein_g"]
    base_carbs = top_food["carbs_g"]
    base_fat = top_food["fat_g"]
    base_fiber = top_food["fiber_g"]

    return {
        "status": "success",
        "detected_food": top_food["name"],
        "confidence_score": f"{round(top_confidence)}%",
        "serving_size": top_food["serving_size"],
        "nutrition_estimate": {
            "calories": base_cals,
            "protein_g": base_protein,
            "carbs_g": base_carbs,
            "fat_g": base_fat,
            "fiber_g": base_fiber
        },
        "portion_options": {
            "small": {
                "label": "Small Portion (0.75x)",
                "calories": round(base_cals * 0.75),
                "protein_g": round(base_protein * 0.75, 1)
            },
            "medium": {
                "label": "Medium Standard (1.0x)",
                "calories": base_cals,
                "protein_g": base_protein
            },
            "large": {
                "label": "Large Portion (1.5x)",
                "calories": round(base_cals * 1.5),
                "protein_g": round(base_protein * 1.5, 1)
            }
        },
        "health_tip": top_food["health_tip"],
        "catalog_meal_id": top_food.get("catalog_meal_id"),
        "alternatives": alternate_candidates,
        "disclaimer": "Sample visual estimation for general wellness awareness, not clinical nutrition."
    }
