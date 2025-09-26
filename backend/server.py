from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Dict, List, Optional
import os
import uuid
from datetime import datetime, timedelta
import asyncio

# Models
class GameState(BaseModel):
    player_id: str
    money: float = 0.0
    last_update: datetime
    houses_built: int = 0
    current_material: str = "basic"
    
class Material(BaseModel):
    id: str
    name: str
    cost_multiplier: float
    unlock_cost: float
    planet_source: str
    
class Upgrade(BaseModel):
    id: str
    name: str
    description: str
    cost: float
    effect_type: str  # "production_rate", "material_efficiency", etc.
    effect_value: float
    level: int = 0
    
class Planet(BaseModel):
    id: str
    name: str
    distance: float
    materials: List[str]
    extraction_station_level: int = 0
    unlock_cost: float

class PlayerUpgrade(BaseModel):
    upgrade_id: str
    level: int = 0

class GameStateResponse(BaseModel):
    player_id: str
    money: float
    houses_built: int
    current_material: str
    last_update: datetime
    upgrades: List[PlayerUpgrade]
    unlocked_planets: List[str]
    materials: Dict[str, float]  # material_id -> quantity

app = FastAPI(title="Idle House Production Game")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.idle_game

# Game data
MATERIALS_DATA = {
    "basic": {"name": "Basic Concrete", "cost_multiplier": 1.0, "unlock_cost": 0, "planet_source": "Earth"},
    "steel": {"name": "Steel Frame", "cost_multiplier": 2.5, "unlock_cost": 10000, "planet_source": "Mars"},
    "crystal": {"name": "Crystal Composite", "cost_multiplier": 10.0, "unlock_cost": 100000, "planet_source": "Europa"},
    "quantum": {"name": "Quantum Material", "cost_multiplier": 50.0, "unlock_cost": 1000000, "planet_source": "Kepler-442b"},
}

UPGRADES_DATA = {
    "prod_speed_1": {
        "name": "Assembly Line Optimization",
        "description": "Increases production speed by 50%",
        "base_cost": 100,
        "effect_type": "production_rate",
        "effect_value": 1.5
    },
    "material_efficiency_1": {
        "name": "Material Efficiency",
        "description": "Reduces material cost by 20%",
        "base_cost": 500,
        "effect_type": "material_efficiency", 
        "effect_value": 0.8
    },
    "auto_producer": {
        "name": "Automated Producer",
        "description": "Produces houses automatically",
        "base_cost": 1000,
        "effect_type": "auto_production",
        "effect_value": 1.0
    }
}

PLANETS_DATA = {
    "earth": {"name": "Earth", "distance": 0, "materials": ["basic"], "unlock_cost": 0},
    "mars": {"name": "Mars", "distance": 225000000, "materials": ["steel"], "unlock_cost": 50000},
    "europa": {"name": "Europa", "distance": 628000000, "materials": ["crystal"], "unlock_cost": 500000},
    "kepler": {"name": "Kepler-442b", "distance": 1200, "materials": ["quantum"], "unlock_cost": 5000000}
}

@app.get("/")
async def root():
    return {"message": "Idle House Production Game API"}

@app.post("/api/player/create")
async def create_player():
    """Create a new player"""
    player_id = str(uuid.uuid4())
    
    game_state = {
        "player_id": player_id,
        "money": 100.0,  # Starting money
        "houses_built": 0,
        "current_material": "basic",
        "last_update": datetime.utcnow(),
        "upgrades": [],
        "unlocked_planets": ["earth"],
        "materials": {"basic": 10.0}  # Starting materials
    }
    
    await db.game_states.insert_one(game_state)
    return {"player_id": player_id}

@app.get("/api/player/{player_id}/state")
async def get_game_state(player_id: str):
    """Get current game state for a player"""
    game_state = await db.game_states.find_one({"player_id": player_id})
    if not game_state:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Calculate idle progress
    now = datetime.utcnow()
    last_update = game_state["last_update"]
    time_diff = (now - last_update).total_seconds()
    
    # Calculate idle earnings (if player has auto-production)
    auto_prod_level = 0
    for upgrade in game_state.get("upgrades", []):
        if upgrade["upgrade_id"] == "auto_producer":
            auto_prod_level = upgrade["level"]
    
    if auto_prod_level > 0:
        houses_per_second = auto_prod_level * 0.1  # Base rate
        idle_houses = int(time_diff * houses_per_second)
        house_value = 10 * MATERIALS_DATA[game_state["current_material"]]["cost_multiplier"]
        idle_money = idle_houses * house_value
        
        game_state["money"] += idle_money
        game_state["houses_built"] += idle_houses
    
    game_state["last_update"] = now
    
    # Update in database
    await db.game_states.update_one(
        {"player_id": player_id},
        {"$set": {"money": game_state["money"], "houses_built": game_state["houses_built"], "last_update": now}}
    )
    
    # Remove MongoDB _id field
    game_state.pop("_id", None)
    return game_state

@app.post("/api/player/{player_id}/build-house")
async def build_house(player_id: str):
    """Build a house manually"""
    game_state = await db.game_states.find_one({"player_id": player_id})
    if not game_state:
        raise HTTPException(status_code=404, detail="Player not found")
    
    material = game_state["current_material"]
    material_cost = 1.0  # Base material cost
    house_value = 10 * MATERIALS_DATA[material]["cost_multiplier"]
    
    # Check if player has enough materials
    materials = game_state.get("materials", {})
    if materials.get(material, 0) < material_cost:
        raise HTTPException(status_code=400, detail="Not enough materials")
    
    # Build house
    materials[material] -= material_cost
    game_state["money"] += house_value
    game_state["houses_built"] += 1
    
    await db.game_states.update_one(
        {"player_id": player_id},
        {
            "$set": {
                "money": game_state["money"],
                "houses_built": game_state["houses_built"],
                "materials": materials
            }
        }
    )
    
    return {"success": True, "money_earned": house_value, "total_money": game_state["money"]}

@app.post("/api/player/{player_id}/buy-upgrade")
async def buy_upgrade(player_id: str, upgrade_id: str):
    """Buy or upgrade an enhancement"""
    game_state = await db.game_states.find_one({"player_id": player_id})
    if not game_state:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if upgrade_id not in UPGRADES_DATA:
        raise HTTPException(status_code=400, detail="Invalid upgrade")
    
    upgrade_data = UPGRADES_DATA[upgrade_id]
    
    # Find existing upgrade level
    current_level = 0
    upgrades = game_state.get("upgrades", [])
    for i, upgrade in enumerate(upgrades):
        if upgrade["upgrade_id"] == upgrade_id:
            current_level = upgrade["level"]
            break
    
    # Calculate cost (increases exponentially)
    cost = upgrade_data["base_cost"] * (1.5 ** current_level)
    
    if game_state["money"] < cost:
        raise HTTPException(status_code=400, detail="Not enough money")
    
    # Purchase upgrade
    game_state["money"] -= cost
    
    # Update upgrade level
    upgrade_found = False
    for upgrade in upgrades:
        if upgrade["upgrade_id"] == upgrade_id:
            upgrade["level"] += 1
            upgrade_found = True
            break
    
    if not upgrade_found:
        upgrades.append({"upgrade_id": upgrade_id, "level": 1})
    
    await db.game_states.update_one(
        {"player_id": player_id},
        {"$set": {"money": game_state["money"], "upgrades": upgrades}}
    )
    
    return {"success": True, "remaining_money": game_state["money"]}

@app.get("/api/materials")
async def get_materials():
    """Get all available materials"""
    return MATERIALS_DATA

@app.get("/api/upgrades")
async def get_upgrades():
    """Get all available upgrades"""
    return UPGRADES_DATA

@app.get("/api/planets")
async def get_planets():
    """Get all available planets"""
    return PLANETS_DATA

@app.post("/api/player/{player_id}/unlock-planet")
async def unlock_planet(player_id: str, planet_id: str):
    """Unlock a new planet for material extraction"""
    game_state = await db.game_states.find_one({"player_id": player_id})
    if not game_state:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if planet_id not in PLANETS_DATA:
        raise HTTPException(status_code=400, detail="Invalid planet")
    
    planet_data = PLANETS_DATA[planet_id]
    
    if planet_id in game_state.get("unlocked_planets", []):
        raise HTTPException(status_code=400, detail="Planet already unlocked")
    
    if game_state["money"] < planet_data["unlock_cost"]:
        raise HTTPException(status_code=400, detail="Not enough money")
    
    # Unlock planet
    game_state["money"] -= planet_data["unlock_cost"]
    unlocked_planets = game_state.get("unlocked_planets", [])
    unlocked_planets.append(planet_id)
    
    # Add materials from planet
    materials = game_state.get("materials", {})
    for material in planet_data["materials"]:
        materials[material] = materials.get(material, 0) + 5  # Starting materials
    
    await db.game_states.update_one(
        {"player_id": player_id},
        {
            "$set": {
                "money": game_state["money"],
                "unlocked_planets": unlocked_planets,
                "materials": materials
            }
        }
    )
    
    return {"success": True, "unlocked_planet": planet_data["name"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)