#!/usr/bin/env python3
"""Upload COGs and GeoJSON files to a Supabase Storage bucket.

Rasters go to <bucket>/rasters/, vectors go to <bucket>/vectors/.
Re-running is safe (upsert). Prints a CORS config to paste into the dashboard.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = os.getenv("BUCKET_NAME", "cogs")

COG_DIR = ROOT / "COGs"
GEOJSON_DIR = ROOT / "Raw_GeoJSON"

RASTER_PREFIX = "rasters"
VECTOR_PREFIX = "vectors"

CORS_JSON = """[
  {
    "origin": "*",
    "method": ["GET", "HEAD"],
    "header": ["range", "content-type"],
    "exposeHeader": ["Content-Length", "Content-Range", "Accept-Ranges"],
    "maxAge": 3600
  }
]"""


def upload(client, local_path: Path, remote_path: str, content_type: str):
    size_mb = local_path.stat().st_size / (1024 * 1024)
    print(f"  {local_path.name} ({size_mb:.1f} MB) -> {remote_path}")
    with open(local_path, "rb") as f:
        data = f.read()
    client.storage.from_(BUCKET).upload(
        path=remote_path,
        file=data,
        file_options={
            "content-type": content_type,
            "cache-control": "public, max-age=3600",
            "upsert": "true",
        },
    )
    url = client.storage.from_(BUCKET).get_public_url(remote_path)
    print(f"    {url}")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Ensure bucket exists and is public. Safe to retry.
    try:
        client.storage.create_bucket(BUCKET, options={"public": True})
        print(f"Created bucket '{BUCKET}' (public).")
    except Exception:
        pass  # exists already

    total = 0

    if COG_DIR.exists():
        cogs = sorted(COG_DIR.glob("*.tif"))
        if cogs:
            print(f"\nRasters -> {BUCKET}/{RASTER_PREFIX}/  ({len(cogs)} file(s))")
            for p in cogs:
                upload(client, p, f"{RASTER_PREFIX}/{p.name}", "image/tiff")
                total += 1
    else:
        print(f"\n(skipping rasters: {COG_DIR} not found)")

    if GEOJSON_DIR.exists():
        geojsons = sorted({*GEOJSON_DIR.glob("*.geojson"), *GEOJSON_DIR.glob("*.json")})
        if geojsons:
            print(f"\nVectors -> {BUCKET}/{VECTOR_PREFIX}/  ({len(geojsons)} file(s))")
            for p in geojsons:
                upload(client, p, f"{VECTOR_PREFIX}/{p.name}", "application/geo+json")
                total += 1
    else:
        print(f"\n(skipping vectors: {GEOJSON_DIR} not found)")

    print(f"\nUploaded {total} file(s).")
    print()
    print("=" * 68)
    print("CORS CONFIG — required so the browser can fetch COGs via range requests")
    print("=" * 68)
    print("Supabase Dashboard -> Storage -> (bucket) -> Policies / CORS")
    print("Paste this JSON:")
    print()
    print(CORS_JSON)


if __name__ == "__main__":
    main()
