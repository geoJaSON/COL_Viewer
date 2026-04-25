# Task: Build a web map that displays GeoTIFFs hosted on Supabase Storage

I have a collection of GeoTIFF files that I want to display on a web map. I'll host them in a Supabase Storage bucket (not Esri, not Google Drive). Help me set this up end-to-end.

## Before you start, ask me these questions:

1. **Source files**: Where are my GeoTIFFs located locally, and roughly how many / how large are they?
2. **Data type**: Are these single-band (e.g., elevation, NDVI, thermal) or multi-band RGB imagery? Do they need a color ramp, or are they already styled?
3. **Projection**: Do I know the CRS/EPSG of the files? (Web maps need EPSG:3857 or data readable as such — COGs can handle reprojection on the fly in some libraries, but it's cleaner to reproject up front.)
4. **Supabase setup**: Do I already have a Supabase project and a storage bucket created, or do I need guidance on that? Will the bucket be public or do I need signed URLs?
5. **Map library preference**: Leaflet (simplest), MapLibre GL (vector + raster, modern), or OpenLayers (most powerful)? If I don't have a preference, default to **Leaflet + georaster-layer-for-leaflet**.
6. **Deployment**: Is this just a local prototype, or do I need it deployed somewhere (Vercel, Netlify, etc.)?

## What I want you to build:

### Step 1: COG conversion script
- Create a bash or Python script that converts my GeoTIFFs into **Cloud Optimized GeoTIFFs** using GDAL.
- Use `gdal_translate ... -of COG -co COMPRESS=DEFLATE -co BLOCKSIZE=512` or the `rio cogeo` equivalent.
- Validate the output with `rio cogeo validate` or `gdalinfo` and report whether each file is a valid COG.
- If any file isn't in EPSG:3857 or EPSG:4326, warn me and optionally reproject with `gdalwarp`.
- Check GDAL is installed first; if not, give me install instructions for my OS.

### Step 2: Supabase upload script
- Write a Node.js or Python script that uploads the COGs to a Supabase Storage bucket using the Supabase client library.
- Read credentials from a `.env` file (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUCKET_NAME`). Create a `.env.example`.
- Set correct `contentType: 'image/tiff'` and `cacheControl` on upload.
- Print the public URL for each file after upload.
- **Important**: Remind me to configure CORS on the bucket so the browser can read the files. Provide the exact CORS JSON I need to paste into the Supabase dashboard (allow GET + HEAD, expose `Content-Length` and `Content-Range` headers, allow range requests).

### Step 3: The web map
- Build a minimal single-page app (plain HTML + JS is fine unless I asked for a framework) that:
  - Loads a basemap (OpenStreetMap tiles is fine for the prototype)
  - Loads each COG from its Supabase public URL using the chosen library
  - Fits the map view to the bounds of the loaded rasters
  - Includes a simple layer toggle / opacity slider per raster
- For single-band rasters, include a sensible default color ramp (e.g., viridis) and expose it so I can tweak.
- For RGB rasters, render as true-color.
- The web map should be password protected before any data loads
- I have a few geojson layers that should be available as static data. These can live either server side or in a supabase bucket.
- Additional tif files should be able to be added over time

### Step 4: README
- Document the full pipeline: convert → upload → view.
- Include the CORS config, `.env` setup, and how to run locally (a simple `python -m http.server` or `npx serve` is fine).
- Note the gotchas: COGs are required (not regular GeoTIFFs), range requests must work, CORS must be configured, large files benefit from overviews.

## Constraints / preferences:
- Keep dependencies minimal. No build step unless necessary.
- Don't use Mapbox (requires a token and has a cost model I'd rather avoid for this). MapLibre GL is the open fork and is fine.
- Don't suggest Esri / ArcGIS anything.
- Prefer well-maintained libraries. For Leaflet: `georaster` + `georaster-layer-for-leaflet`. For MapLibre: `@geomatico/maplibre-cog-protocol`. For OpenLayers: the built-in `GeoTIFF` source.

## Start by asking me the questions above before writing any code.