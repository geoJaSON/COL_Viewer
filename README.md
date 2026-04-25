# COL Viewer

Web map that displays Cloud Optimized GeoTIFFs hosted on Supabase Storage, plus
GeoJSON overlays, gated by a client-side password.

## Pipeline

```
Raw_Tifs/           -> scripts/convert_to_cog.py -> COGs/
Raw_GeoJSON/        ----+
COGs/                   |
                        v
               scripts/upload_to_supabase.py  ->  Supabase bucket `cogs/`
                                                        |
                                           index.html + app.js  (Vercel)
```

## Prerequisites

- **Python 3.9+** with pip
- **GDAL** CLI tools on PATH (`gdal_translate`, `gdalwarp`, `gdalinfo`)
  - Recommended on Windows: `conda install -c conda-forge gdal`
  - Alternative: [OSGeo4W](https://trac.osgeo.org/osgeo4w/) and run scripts from the OSGeo4W Shell
- **Supabase** project (Pro tier if your COGs total >1 GB)
- **Node** (optional, only for `npx serve` local preview)

## First-time setup

```bash
pip install -r requirements.txt
cp .env.example .env
# then edit .env with your Supabase URL + service role key
```

Create (or note) your Supabase Storage bucket — the scripts and app default to
`cogs`. The upload script will create it as public if it doesn't exist.

## Step 1 — Convert GeoTIFFs to COGs

Drop your source `.tif` files into `Raw_Tifs/`, then:

```bash
python scripts/convert_to_cog.py
```

The script reprojects from EPSG:32615 (UTM 15N) to EPSG:3857 (Web Mercator) and
writes COGs to `COGs/` with DEFLATE compression, 512 px block size, and internal
overviews. It warns if any file has an unexpected CRS.

## Step 2 — Upload to Supabase

Put your `.geojson` files into `Raw_GeoJSON/`, then:

```bash
python scripts/upload_to_supabase.py
```

This uploads:

- `COGs/*.tif` → `cogs/rasters/`
- `Raw_GeoJSON/*.{geojson,json}` → `cogs/vectors/`

Re-runs are safe (`upsert`). The script prints each public URL and ends with
the CORS JSON you need to paste into the Supabase dashboard.

### CORS — required, one-time

Supabase Dashboard → Storage → (your bucket) → **Policies / CORS**:

```json
[
  {
    "origin": "*",
    "method": ["GET", "HEAD"],
    "header": ["range", "content-type"],
    "exposeHeader": ["Content-Length", "Content-Range", "Accept-Ranges"],
    "maxAge": 3600
  }
]
```

Without `Range` support and the exposed `Content-*` headers, COG streaming in
the browser will fail.

## Step 3 — Configure the web app

Edit `config.js` and set:

- `SUPABASE_URL` — your project URL
- `SUPABASE_ANON_KEY` — from Supabase Dashboard → Settings → API (the
  *anon / public* key, not the service role key)
- `PASSWORD_SHA256` — generate with:

  ```bash
  python scripts/hash_password.py 'your-password'
  ```

  Paste the hex digest into `config.js`. The password gate is a soft control
  only — anyone who obtains the password can still fetch the public Supabase
  URLs directly. Don't put sensitive data in the bucket.

## Step 4 — Run locally

```bash
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080` (or whichever port). The password gate appears
first; after entering the correct password, the map loads and the sidebar
populates from the bucket.

## Step 5 — Deploy to Vercel

```bash
npm i -g vercel   # first time only
vercel            # link project
vercel --prod     # deploy
```

Vercel serves `index.html` from the repo root. `.vercelignore` excludes
scripts/ and input folders so deploys stay small.

## Adding more rasters later

1. Drop new `.tif`s into `Raw_Tifs/`
2. Run `python scripts/convert_to_cog.py` (re-processes everything; output is overwritten)
3. Run `python scripts/upload_to_supabase.py`

The web app lists the bucket at page load, so new files appear automatically —
no redeploy required.

## Gotchas

- **COGs only.** Regular GeoTIFFs don't stream. The convert script uses
  `-of COG` to guarantee validity.
- **Range requests must work.** That's what CORS is enabling. Hosting from a
  server that strips `Range` headers will break streaming.
- **Overviews matter.** Without them, zoomed-out views have to read the full
  resolution and rendering crawls. The COG driver adds them by default.
- **Password gate is client-side.** Good for keeping casual visitors out, not
  for access control.
- **Supabase egress.** Free tier is 5 GB/month. Busy dashboards with large
  COGs will burn through it; Pro adds 200 GB.

## Project layout

```
COL_Viewer/
├── Raw_Tifs/                  # your source .tif files (gitignored)
├── Raw_GeoJSON/               # your source .geojson files (gitignored)
├── COGs/                      # conversion output (gitignored)
├── scripts/
│   ├── convert_to_cog.py
│   ├── upload_to_supabase.py
│   └── hash_password.py
├── index.html
├── app.js
├── styles.css
├── config.js                  # edit this with your Supabase creds + pw hash
├── vercel.json
├── .env.example
└── README.md
```
