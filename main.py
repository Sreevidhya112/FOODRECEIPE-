import os
import json
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI(title="Ultimate AI Recipe Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    raise RuntimeError("GROQ_API_KEY is missing from environment variables.")

client = Groq(api_key=groq_api_key)

# --- Extended Schemas ---

class ExpiryItem(BaseModel):
    name: str
    days_left: int = Field(..., description="Days until expiration")

class AdvancedRecipeRequest(BaseModel):
    ingredients: List[str]
    diet: str = Field("None", description="Vegetarian, Vegan, Keto, Gluten-Free, Halal, High-Protein, None")
    expiry_priorities: List[ExpiryItem] = []
    servings: int = Field(4, description="Target serving multiplier count")
    language: str = Field("English", description="Target execution language string")

class NutritionMetrics(BaseModel):
    calories: str
    protein: str
    carbohydrates: str
    fat: str
    vitamins: List[str]

class SubstitutionItem(BaseModel):
    original: str
    alternative: str

class MealPlanDay(BaseModel):
    day: str
    breakfast: str
    lunch: str
    dinner: str

class WeeklyMealPlanResponse(BaseModel):
    plan: List[MealPlanDay]

class AdvancedRecipeResponse(BaseModel):
    recipe_name: str
    cooking_time: str
    difficulty: str
    cost_estimation: str
    ingredients_used: List[str]
    scaled_quantities: List[str] = Field(..., description="Quantities fully matched to requested serving scale")
    substitutions: List[SubstitutionItem]
    nutrition: NutritionMetrics
    steps: List[str]
    shopping_list: List[str] = Field(..., description="Missing vital auxiliary items for list tracking")


# --- Endpoint 1: Advanced Multi-Feature Generation Engine ---
@app.post("/generate-advanced", response_model=AdvancedRecipeResponse)
async def generate_advanced_recipe(payload: AdvancedRecipeRequest):
    if not payload.ingredients:
        raise HTTPException(status_code=400, detail="Base inventory array cannot be empty.")
        
    system_instruction = (
        f"You are a master culinary systems compiler. Create a customized recipe honoring these criteria:\n"
        f"- Target Serving Size Count: {payload.servings} people.\n"
        f"- Strict Diet Parameter Constraint: {payload.diet}.\n"
        f"- Language Target: {payload.language}.\n\n"
        f"CRITICAL RULES:\n"
        f"1. Prioritize using these expiring items first to reduce waste: {', '.join([f'{i.name} ({i.days_left}d left)' for i in payload.expiry_priorities])}.\n"
        f"2. Scale all ingredient values directly to feed precisely {payload.servings} individuals.\n"
        f"3. Generate a dynamic cost estimation tier and a subset list of smart substitutions.\n"
        f"4. Provide detailed nutritional metrics including calories, macronutrients, and vitamins.\n"
        f"5. Return standard missing components in the shopping_list key.\n\n"
        f"Return strict raw JSON structural format mapping this signature payload configuration:\n"
        f"{{\n"
        f"  \"recipe_name\": \"String\", \"cooking_time\": \"String\", \"difficulty\": \"String\", \"cost_estimation\": \"String\",\n"
        f"  \"ingredients_used\": [\"String\"], \"scaled_quantities\": [\"String\"],\n"
        f"  \"substitutions\": [{{\n"
        f"    \"original\": \"String\", \"alternative\": \"String\"\n"
        f"  }}],\n"
        f"  \"nutrition\": {{\n"
        f"    \"calories\": \"String\", \"protein\": \"String\", \"carbohydrates\": \"String\", \"fat\": \"String\", \"vitamins\": [\"String\"]\n"
        f"  }},\n"
        f"  \"steps\": [\"String\"], \"shopping_list\": [\"String\"]\n"
        f"}}"
    )
    
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"Available inventory stack array: {', '.join(payload.ingredients)}"}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        return AdvancedRecipeResponse.model_validate_json(completion.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Endpoint 2: Weekly Meal Planner (Robust Version) ---
@app.post("/generate-meal-plan")
async def generate_meal_plan(payload: AdvancedRecipeRequest):
    system_instruction = (
        f"Generate a clean 7-day calendar meal plan (Monday through Sunday) matching diet track: {payload.diet}. "
        f"Incorporate or center it around these available items: {', '.join(payload.ingredients)}. "
        f"Return strict raw JSON format matching EXACTLY this structure:\n"
        f"{{\n"
        f"  \"plan\": [\n"
        f"    {{\"day\": \"Monday\", \"breakfast\": \"Meal description\", \"lunch\": \"Meal description\", \"dinner\": \"Meal description\"}}\n"
        f"  ]\n"
        f"}}"
    )
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system_instruction}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        raw_json = json.loads(completion.choices[0].message.content)
        return raw_json
    except Exception as e:
        print("Meal Plan Backend Error Log:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- Base Static File Hosting Mappings ---
@app.get("/")
async def get_index():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")