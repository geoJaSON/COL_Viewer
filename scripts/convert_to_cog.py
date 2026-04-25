#!/usr/bin/env python3
"""Convert GeoTIFFs in Raw_Tifs/ to Cloud Optimized GeoTIFFs in COGs/.

Inputs are expected to be EPSG:32615 (UTM 15N) and will be reprojected to
EPSG:3857 (Web Mercator) for web display. Files in other CRSes are warned
about and still reprojected.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = ROOT / "Raw_Tifs"
OUTPUT_DIR = ROOT / "COGs"
TARGET_SRS = "EPSG:3857"
EXPECTED_SRS = "EPSG:32615"


def check_gdal():
    missing = [t for t in ("gdal_translate", "gdalwarp", "gdalinfo") if not shutil.which(t)]
    if not missing:
        return
    print("ERROR: GDAL CLI tools not found on PATH:", ", ".join(missing))
    print()
    print("Install on Windows:")
    print("  Option A (recommended): conda install -c conda-forge gdal")
    print("  Option B: OSGeo4W installer from https://trac.osgeo.org/osgeo4w/")
    print("           Then add C:\\OSGeo4W\\bin to PATH, or run from OSGeo4W Shell.")
    sys.exit(1)


def detect_epsg(path: Path) -> str:
    result = subprocess.run(
        ["gdalinfo", "-json", str(path)],
        capture_output=True, text=True, check=True,
    )
    info = json.loads(result.stdout)
    wkt = info.get("coordinateSystem", {}).get("wkt", "")
    # Find the last "ID[\"EPSG\", <code>]" occurrence (outer CRS id)
    tail = wkt.rsplit('ID["EPSG",', 1)
    if len(tail) == 2:
        code = tail[1].split("]", 1)[0].strip()
        return f"EPSG:{code}"
    return "UNKNOWN"


def convert_one(src: Path, dst: Path) -> None:
    tmp = dst.with_suffix(".tmp.tif")
    subprocess.run([
        "gdalwarp",
        "-t_srs", TARGET_SRS,
        "-r", "bilinear",
        "-overwrite",
        "-of", "GTiff",
        str(src), str(tmp),
    ], check=True, stdout=subprocess.DEVNULL)

    subprocess.run([
        "gdal_translate",
        "-of", "COG",
        "-co", "COMPRESS=DEFLATE",
        "-co", "BLOCKSIZE=512",
        "-co", "OVERVIEW_RESAMPLING=AVERAGE",
        str(tmp), str(dst),
    ], check=True, stdout=subprocess.DEVNULL)

    tmp.unlink(missing_ok=True)


def main():
    check_gdal()

    if not INPUT_DIR.exists():
        print(f"ERROR: {INPUT_DIR} does not exist. Place .tif files there and retry.")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    tifs = sorted({*INPUT_DIR.glob("*.tif"), *INPUT_DIR.glob("*.tiff"),
                   *INPUT_DIR.glob("*.TIF"), *INPUT_DIR.glob("*.TIFF")})
    if not tifs:
        print(f"No .tif files found in {INPUT_DIR}")
        return

    print(f"Found {len(tifs)} source file(s). Target CRS: {TARGET_SRS}\n")

    results = []
    for i, src in enumerate(tifs, 1):
        dst = OUTPUT_DIR / (src.stem + ".tif")
        print(f"[{i}/{len(tifs)}] {src.name}")
        try:
            epsg = detect_epsg(src)
            if epsg == "UNKNOWN":
                print(f"  WARN: could not detect CRS; proceeding with reprojection")
            elif epsg != EXPECTED_SRS:
                print(f"  WARN: CRS is {epsg}, expected {EXPECTED_SRS}")
            convert_one(src, dst)
            size_mb = dst.stat().st_size / (1024 * 1024)
            results.append((src.name, "OK", f"{size_mb:.1f} MB"))
            print(f"  -> COGs/{dst.name}  ({size_mb:.1f} MB)")
        except subprocess.CalledProcessError as e:
            results.append((src.name, "FAIL", f"exit {e.returncode}"))
            print(f"  FAILED: {e}")
        except Exception as e:
            results.append((src.name, "FAIL", str(e)))
            print(f"  FAILED: {e}")

    print("\nSummary:")
    for name, status, info in results:
        print(f"  {status:4}  {name:50}  {info}")


if __name__ == "__main__":
    main()
