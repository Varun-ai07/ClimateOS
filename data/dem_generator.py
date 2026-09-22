"""Delta Elevation Model (DEM) generator for Tamil Nadu cities.

Generates deterministic, city-specific terrain using numpy only.
Each city gets a recognizable landscape character instead of generic noise.
"""

import json
import numpy as np
from pathlib import Path

PROCESSED_DIR = Path(__file__).parent / "processed"

# City-specific elevation profiles
CITY_PROFILES = {
    'chennai': {
        'base_elevation': 6,
        'variation': 12,
        'features': {'coastal': True, 'rivers': ['Cooum', 'Adyar', 'Buckingham']},
    },
    'coimbatore': {
        'base_elevation': 411,
        'variation': 45,
        'features': {'rivers': ['Noyyal', 'Kousika'], 'ghats': True, 'plateau': True},
    },
    'madurai': {
        'base_elevation': 101,
        'variation': 22,
        'features': {'rivers': ['Vaigai'], 'plain': True},
    },
    'dindigul': {
        'base_elevation': 268,
        'variation': 35,
        'features': {'rivers': ['Kodaikanal streams'], 'hills': True},
    },
    'salem': {
        'base_elevation': 278,
        'variation': 28,
        'features': {'rivers': ['Thirumanimuthar'], 'hills': True},
    },
    'tiruchirappalli': {
        'base_elevation': 88,
        'variation': 18,
        'features': {'rivers': ['Cauvery', 'Kollidam'], 'plain': True},
    },
    'erode': {
        'base_elevation': 183,
        'variation': 20,
        'features': {'rivers': ['Cauvery', 'Bhavani'], 'plain': True},
    },
    'vellore': {
        'base_elevation': 216,
        'variation': 24,
        'features': {'rivers': ['Palar'], 'hills': True},
    },
    'tirunelveli': {
        'base_elevation': 47,
        'variation': 16,
        'features': {'rivers': ['Thamirabarani'], 'plain': True},
    },
    'thoothukudi': {
        'base_elevation': 4,
        'variation': 5,
        'features': {'coastal': True, 'rivers': ['Tamiraparani'], 'plain': True},
    },
}

CITY_COORDS = {
    'chennai': {'lat': 13.0827, 'lon': 80.2707},
    'coimbatore': {'lat': 11.0168, 'lon': 76.9558},
    'madurai': {'lat': 9.9252, 'lon': 78.1198},
    'dindigul': {'lat': 10.3624, 'lon': 77.9695},
    'salem': {'lat': 11.6643, 'lon': 78.1460},
    'tiruchirappalli': {'lat': 10.7905, 'lon': 78.7047},
    'erode': {'lat': 11.3410, 'lon': 77.7172},
    'vellore': {'lat': 12.9165, 'lon': 79.1325},
    'tirunelveli': {'lat': 8.7139, 'lon': 77.7567},
    'thoothukudi': {'lat': 8.7642, 'lon': 78.1348},
}


def _make_river_mask(grid_size: int, river_indices: list[int]) -> np.ndarray:
    """Create boolean mask for river corridors."""
    mask = np.zeros((grid_size, grid_size), dtype=float)
    for ry in river_indices:
        y_start = max(0, ry - 3)
        y_end = min(grid_size, ry + 4)
        mask[y_start:y_end, :] += 1.0
        for x in range(grid_size):
            dy = min(abs(x - y) for y in range(y_start, y_end)) if (y_end - y_start) > 0 else 0
            mask[y_start:y_end, x] = np.maximum(mask[y_start:y_end, x], np.maximum(0, 3 - dy))
    return mask


def generate_dem(city_key: str, grid_size: int = 50) -> dict:
    profile = CITY_PROFILES.get(city_key, CITY_PROFILES['coimbatore'])
    coords = CITY_COORDS.get(city_key, CITY_COORDS['coimbatore'])

    base = float(profile['base_elevation'])
    variation = float(profile['variation'])
    features = profile['features']

    seed = hash(city_key) % 2**32
    rng = np.random.default_rng(seed)

    x = np.linspace(0, 1, grid_size)
    y = np.linspace(0, 1, grid_size)
    xx, yy = np.meshgrid(x, y)

    # deterministic low-frequency landscape
    s1 = np.sin(2 * np.pi * xx + rng.normal(0, 0.05)) * np.cos(2 * np.pi * yy + rng.normal(0, 0.05))
    s2 = np.sin(4 * np.pi * xx + rng.normal(0, 0.1)) * np.cos(3 * np.pi * yy + rng.normal(0, 0.1))
    s3 = np.sin(6 * np.pi * xx + rng.normal(0, 0.15)) * np.sin(6 * np.pi * yy + rng.normal(0, 0.15))
    elevation = base + variation * (0.45 * s1 + 0.25 * s2 + 0.15 * s3 + 0.15 * rng.standard_normal((grid_size, grid_size)))

    # city signature: ghats/plateau/hills/plain
    if features.get('plateau'):
        elevation += variation * 0.35 * (1 - yy)
    elif features.get('hills'):
        cx, cy = 0.5 + rng.normal(0, 0.05), 0.5 + rng.normal(0, 0.05)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        elevation += variation * 0.55 * np.exp(-d * 5)
    elif features.get('plain'):
        elevation = base + 0.25 * variation * rng.standard_normal((grid_size, grid_size))

    # river valleys: carve consistent wavy paths
    river_count = len(features.get('rivers', []))
    river_indices = [int(grid_size * (0.35 + 0.15 * i + 0.02 * ((seed >> (i * 7)) % 5))) for i in range(river_count)]
    river_mask = _make_river_mask(grid_size, river_indices)
    for i in range(grid_size):
        curve = 3.0 * np.sin(2 * np.pi * xx[i, :] + rng.normal(0, 0.2))
        river_mask[i, :] = np.maximum(river_mask[i, :], np.maximum(0, curve))
    elevation -= river_mask * variation * 0.28

    # coastal gradient
    if features.get('coastal'):
        coast_side = int((seed / 2**16) % 4)
        if coast_side == 0:
            dist_to_edge = np.minimum(x, 1 - x)
            coast = np.tile(dist_to_edge, (grid_size, 1))
        elif coast_side == 1:
            dist_to_edge = np.minimum(y, 1 - y)
            coast = np.tile(dist_to_edge.reshape(-1, 1), (1, grid_size))
        else:
            dist_to_edge = np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y))
            coast = np.broadcast_to(dist_to_edge, (grid_size, grid_size))
        elevation -= np.maximum(0, 5 - coast * 10) * variation * 0.25

    elevation = np.clip(elevation, max(0.0, base - variation * 2.0), base + variation * 2.0)

    lat_step = 0.05 / grid_size
    lon_step = 0.05 / grid_size

    features_list = []
    for gy in range(grid_size):
        for gx in range(grid_size):
            lat = coords['lat'] - 0.025 + gy * lat_step
            lon = coords['lon'] - 0.025 + gx * lon_step
            elev = float(elevation[gy, gx])
            if elev < base - variation * 0.45:
                risk = 'high'
            elif elev < base + variation * 0.25:
                risk = 'medium'
            else:
                risk = 'low'
            features_list.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [lon, lat],
                        [lon + lon_step, lat],
                        [lon + lon_step, lat + lat_step],
                        [lon, lat + lat_step],
                        [lon, lat],
                    ]]
                },
                'properties': {
                    'elevation': round(elev, 1),
                    'risk_level': risk,
                }
            })

    metadata = {
        'city': city_key,
        'center': coords,
        'base_elevation': base,
        'grid_size': grid_size,
        'bounds': {
            'south': coords['lat'] - 0.025,
            'north': coords['lat'] + 0.025,
            'west': coords['lon'] - 0.025,
            'east': coords['lon'] + 0.025,
        },
        'elevation_range': {
            'min': float(np.min(elevation)),
            'max': float(np.max(elevation)),
            'mean': float(np.mean(elevation)),
        },
        'features': features,
    }

    return {
        'metadata': metadata,
        'grid': elevation.tolist(),
        'geojson': {
            'type': 'FeatureCollection',
            'features': features_list,
        },
    }


def generate_all_dems():
    dem_dir = PROCESSED_DIR / "dem"
    dem_dir.mkdir(exist_ok=True)
    print('Generating Delta Elevation Models...')
    for city_key in CITY_PROFILES:
        print(f'  {city_key}...', end=' ')
        dem = generate_dem(city_key)
        with open(dem_dir / f'{city_key}_dem.json', 'w') as f:
            json.dump(dem, f)
        with open(dem_dir / f'{city_key}_dem.geojson', 'w') as f:
            json.dump(dem['geojson'], f)
        rng0, rng1 = dem['metadata']['elevation_range']['min'], dem['metadata']['elevation_range']['max']
        print(f'done ({rng0:.0f}-{rng1:.0f}m)')
    print('All DEMs generated!')


if __name__ == '__main__':
    generate_all_dems()
