"""Preprocessing pipeline — generates processed datasets from BBBike GeoJSON.

Run once: python data/preprocess.py /path/to/tamilnadu.osm.geojson
Output: data/processed/*.geojson
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

PROCESSED_DIR = Path(__file__).parent / "processed"


def get_center(geom):
    """Extract center coordinates from geometry."""
    coords = geom.get("coordinates", [])
    gtype = geom.get("type", "")
    if gtype == "Polygon" and coords:
        ring = coords[0]
        return ring[0] if ring else [0, 0]
    elif gtype == "MultiPolygon" and coords and coords[0]:
        ring = coords[0][0]
        return ring[0] if ring else [0, 0]
    elif gtype in ("Point",):
        return coords[:2] if len(coords) >= 2 else [0, 0]
    return [0, 0]


def extract_features(input_path: Path):
    """Stream-parse GeoJSON features."""
    with open(input_path) as f:
        for line in f:
            line = line.strip().rstrip(",")
            if not line.startswith('{"type":"Feature"'):
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def process(input_path: Path):
    """Main preprocessing pipeline."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    roads = []
    buildings = []
    water = []
    hospitals = []
    schools = []
    all_features = []
    total_count = 0

    print(f"Processing {input_path}...")

    for feat in extract_features(input_path):
        total_count += 1
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        center = get_center(geom)
        feature_type = None

        if props.get("amenity") == "hospital":
            hospitals.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "name": props.get("name", "Unknown Hospital"),
                    "amenity": "hospital",
                    "lon": center[0], "lat": center[1],
                    "emergency": props.get("emergency", "no"),
                    "healthcare": props.get("healthcare", ""),
                }
            })
            feature_type = "hospital"

        elif props.get("amenity") in ("school", "kindergarten", "university", "college"):
            schools.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "name": props.get("name", "Unknown School"),
                    "amenity": props["amenity"],
                    "lon": center[0], "lat": center[1],
                }
            })
            feature_type = "school"

        elif props.get("waterway") or props.get("natural") == "water" or props.get("water"):
            water.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "name": props.get("name", ""),
                    "type": props.get("waterway", props.get("natural", "water")),
                    "lon": center[0], "lat": center[1],
                }
            })
            feature_type = "water"

        elif props.get("highway"):
            roads.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "name": props.get("name", ""),
                    "highway": props["highway"],
                    "lon": center[0], "lat": center[1],
                }
            })
            feature_type = "road"

        elif props.get("building"):
            buildings.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "name": props.get("name", ""),
                    "building": props["building"],
                    "lon": center[0], "lat": center[1],
                }
            })
            feature_type = "building"

        all_features.append((feature_type, center))

    # Select top infrastructure by region (Coimbatore focus)
    # Coimbatore bounds: ~10.95-11.15 lat, 76.85-77.15 lon
    COIMBATORE_BOUNDS = {"south": 10.95, "north": 11.15, "west": 76.85, "east": 77.15}

    def in_coimbatore(feat):
        p = feat.get("properties", {})
        lat, lon = p.get("lat", 0), p.get("lon", 0)
        return (COIMBATORE_BOUNDS["south"] <= lat <= COIMBATORE_BOUNDS["north"] and
                COIMBATORE_BOUNDS["west"] <= lon <= COIMBATORE_BOUNDS["east"])

    coimbatore_hospitals = [h for h in hospitals if in_coimbatore(h)]
    coimbatore_schools = [s for s in schools if in_coimbatore(s)]

    # Generate risk zones via grid partitioning
    risk_zones = generate_risk_zones(water, buildings)

    # Save processed files
    save_geojson("roads.geojson", roads[:5000])  # Top 5000 roads
    save_geojson("buildings.geojson", buildings[:10000])
    save_geojson("water.geojson", water[:2000])
    save_geojson("selected_hospitals.geojson", coimbatore_hospitals[:200] if coimbatore_hospitals else hospitals[:200])
    save_geojson("selected_schools.geojson", coimbatore_schools[:200] if coimbatore_schools else schools[:200])
    save_geojson("risk_zones.geojson", risk_zones)
    save_geojson("all_hospitals.geojson", hospitals[:1000])
    save_geojson("all_schools.geojson", schools[:1000])

    # Generate building centroids for risk scoring
    centroids = []
    for b in buildings[:5000]:
        p = b["properties"]
        centroids.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
            "properties": {"name": p.get("name", ""), "building": p.get("building", "")}
        })
    save_geojson("building_centroids.geojson", centroids)

    # Summary
    summary = {
        "input_file": str(input_path),
        "total_features": total_count,
        "processed": {
            "roads": len(roads),
            "buildings": len(buildings),
            "water": len(water),
            "hospitals": len(hospitals),
            "schools": len(schools),
            "coimbatore_hospitals": len(coimbatore_hospitals),
            "coimbatore_schools": len(coimbatore_schools),
            "risk_zones": len(risk_zones),
        }
    }
    save_json("preprocessing_summary.json", summary)

    print(f"Done! Processed files in {PROCESSED_DIR}")
    print(f"  Hospitals: {len(hospitals)} total, {len(coimbatore_hospitals)} in Coimbatore")
    print(f"  Schools: {len(schools)} total, {len(coimbatore_schools)} in Coimbatore")
    print(f"  Water: {len(water)}")
    print(f"  Roads: {len(roads)}")
    print(f"  Buildings: {len(buildings)}")
    print(f"  Risk zones: {len(risk_zones)}")

    return summary


def generate_risk_zones(water_features, buildings):
    """Generate risk zones by spatial clustering near water."""
    risk_zones = []

    # Grid-based approach: divide into 0.05 degree cells
    water_points = [(w["properties"]["lon"], w["properties"]["lat"]) for w in water_features[:500]]

    if not water_points:
        return risk_zones

    # Find bounding box
    lons = [p[0] for p in water_points]
    lats = [p[1] for p in water_points]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    # Create grid cells and count water proximity
    cell_size = 0.05
    grid = defaultdict(int)

    for lon, lat in water_points:
        cell_lon = int((lon - min_lon) / cell_size)
        cell_lat = int((lat - min_lat) / cell_size)
        grid[(cell_lon, cell_lat)] += 1

    # High-risk cells (near water)
    for (cell_lon, cell_lat), count in grid.items():
        if count >= 3:  # Multiple water features nearby
            center_lon = min_lon + (cell_lon + 0.5) * cell_size
            center_lat = min_lat + (cell_lat + 0.5) * cell_size
            risk_level = "high" if count >= 8 else "medium" if count >= 5 else "low"

            risk_zones.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [center_lon - cell_size/2, center_lat - cell_size/2],
                        [center_lon + cell_size/2, center_lat - cell_size/2],
                        [center_lon + cell_size/2, center_lat + cell_size/2],
                        [center_lon - cell_size/2, center_lat + cell_size/2],
                        [center_lon - cell_size/2, center_lat - cell_size/2],
                    ]]
                },
                "properties": {
                    "risk_level": risk_level,
                    "water_proximity": count,
                    "zone_id": f"zone_{cell_lon}_{cell_lat}",
                }
            })

    return risk_zones


def save_geojson(filename, features):
    """Save features as GeoJSON."""
    path = PROCESSED_DIR / filename
    with open(path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)
    print(f"  Saved {filename}: {len(features)} features")


def save_json(filename, data):
    """Save JSON."""
    path = PROCESSED_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python preprocess.py <input.geojson>")
        sys.exit(1)
    process(Path(sys.argv[1]))
