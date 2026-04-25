// COL Viewer config. Everything here is client-visible.
// The anon key is safe to expose for public buckets; the password hash
// is a soft gate, not real auth — do not rely on it for sensitive data.
window.CONFIG = {
  SUPABASE_URL: 'https://dsfiojtjwehyozrmnwcv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_O_IDngsu8-m6Xl686yKwpw_2AN3zU0U',
  BUCKET: 'cogs',
  RASTER_PREFIX: 'rasters',
  VECTOR_PREFIX: 'vectors',

  // SHA-256 of the access password. Default below is sha256("changeme").
  // Regenerate with: python scripts/hash_password.py 'your-new-password'
  PASSWORD_SHA256: '69b8055eb93335e3cea5ea032913c57b4b68ab69cb26ae10f80ac10741f0a940',

  // Raster rendering
  DEFAULT_OPACITY: 0.85,
  PIXEL_MIN: 0,
  PIXEL_MAX: 255,

  // Bathymetric ramp (NOAA/GEBCO style): dark navy = deep, pale = shallow.
  // Tuned for Garmin sonar/chartplotter exports where pixel value scales with
  // depth. If your encoding is reversed, flip the t values (1 - t) on each row.
  VIRIDIS_STOPS: [
    [0.00, [  8,  29,  88]],
    [0.15, [ 37,  52, 148]],
    [0.30, [ 34,  94, 168]],
    [0.45, [ 29, 145, 192]],
    [0.60, [ 65, 182, 196]],
    [0.75, [127, 205, 187]],
    [0.90, [199, 233, 180]],
    [1.00, [237, 248, 217]],
  ],

  // Treat this pixel value as transparent (set to null to disable).
  NODATA_VALUE: 0,
};
