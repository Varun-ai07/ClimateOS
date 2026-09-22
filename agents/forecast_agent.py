"""Forecast Agent — loads city-specific climate forecast data."""

import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base import BaseAgent
from state.schema import MunicipalityClimateState, ForecastData

# City-specific climate data (realistic values for Tamil Nadu)
CITY_CLIMATE = {
    'chennai': {
        'precip': 350, 'temp': 35.0, 'river_m': 3.0, 'threshold': 5.5,
        'humidity': 75, 'wind': 25, 'monsoon': 'northeast',
    },
    'coimbatore': {
        'precip': 210, 'temp': 34.2, 'river_m': 412.5, 'threshold': 415.0,
        'humidity': 65, 'wind': 15, 'monsoon': 'southwest',
    },
    'madurai': {
        'precip': 180, 'temp': 37.0, 'river_m': 150.0, 'threshold': 152.5,
        'humidity': 55, 'wind': 12, 'monsoon': 'northeast',
    },
    'dindigul': {
        'precip': 160, 'temp': 35.5, 'river_m': 268.0, 'threshold': 270.5,
        'humidity': 60, 'wind': 10, 'monsoon': 'northeast',
    },
    'salem': {
        'precip': 190, 'temp': 35.8, 'river_m': 278.0, 'threshold': 280.5,
        'humidity': 62, 'wind': 12, 'monsoon': 'northeast',
    },
    'tiruchirappalli': {
        'precip': 220, 'temp': 36.5, 'river_m': 88.0, 'threshold': 90.5,
        'humidity': 68, 'wind': 18, 'monsoon': 'northeast',
    },
    'erode': {
        'precip': 170, 'temp': 35.0, 'river_m': 183.0, 'threshold': 185.5,
        'humidity': 60, 'wind': 12, 'monsoon': 'southwest',
    },
    'vellore': {
        'precip': 200, 'temp': 36.0, 'river_m': 216.0, 'threshold': 218.5,
        'humidity': 58, 'wind': 14, 'monsoon': 'northeast',
    },
    'tirunelveli': {
        'precip': 250, 'temp': 34.0, 'river_m': 47.0, 'threshold': 49.5,
        'humidity': 70, 'wind': 20, 'monsoon': 'northeast',
    },
    'thoothukudi': {
        'precip': 280, 'temp': 33.5, 'river_m': 4.0, 'threshold': 6.5,
        'humidity': 72, 'wind': 30, 'monsoon': 'northeast',
    },
}


def get_city_key(municipality_id: str) -> str:
    return municipality_id.replace('_in', '').lower()


class ForecastAgent(BaseAgent):
    name = "forecast_agent"
    description = "Loads city-specific climate forecast data"

    async def execute(self, state: MunicipalityClimateState) -> MunicipalityClimateState:
        self.add_timeline_event(state, "forecast_loading", f"Loading forecast for {state.municipality_name}...")

        city_key = get_city_key(state.municipality_id)
        climate = CITY_CLIMATE.get(city_key, CITY_CLIMATE['coimbatore'])

        # Get city info
        from agents.impact_agent import CITY_DATA
        city_info = CITY_DATA.get(city_key, CITY_DATA['coimbatore'])

        state.forecast = ForecastData(
            source="synthetic_tamil_nadu",
            scenario="ssp2-4.5",
            grid_cell={"lat": city_info['lat'], "lon": city_info['lon']},
            precipitation={
                "monthly_peak_mm": climate['precip'],
                "change_pct": 15.0,
                "annual_mm": climate['precip'] * 12,
            },
            temperature={
                "max_c": climate['temp'],
                "mean_c": climate['temp'] - 5,
                "change_c": 1.8,
            },
            river_level={
                "current_m": climate['river_m'],
                "flood_threshold_m": climate['threshold'],
                "status": "warning" if climate['river_m'] > climate['threshold'] - 2 else "normal",
            },
            humidity={
                "current_pct": climate['humidity'],
                "projected_pct": climate['humidity'] + 5,
            },
            wind={
                "speed_kmh": climate['wind'],
                "direction": "southwest" if climate['monsoon'] == 'southwest' else "northeast",
            },
            monsoon={
                "phase": "active" if climate['monsoon'] == 'northeast' else "withdrawal",
                "intensity": "above-normal" if climate['precip'] > 200 else "normal",
                "onset_date": "2025-10-15" if climate['monsoon'] == 'northeast' else "2025-06-01",
            },
            confidence_interval={
                "lower": climate['precip'] * 0.85,
                "upper": climate['precip'] * 1.25,
                "confidence_pct": 90,
            },
        )

        state.status = "forecast_received"

        self.add_timeline_event(state, "forecast_received",
            f"Forecast: {climate['precip']}mm precip, {climate['temp']}C, river at {climate['river_m']}m")

        # Map update
        self.add_map_update(state, "weather_layer", {
            "city": city_info['name'],
            "center": [city_info['lat'], city_info['lon']],
            "precipitation_mm": climate['precip'],
            "temperature_c": climate['temp'],
            "river_level_m": climate['river_m'],
            "flood_threshold_m": climate['threshold'],
            "humidity_pct": climate['humidity'],
            "wind_kmh": climate['wind'],
        })

        return state
