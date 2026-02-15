/**
 * Export JSON data from the Hall of Taps SQLite DB.
 * Run after DB updates: npm run build:data
 *
 * Expects a SQLite DB in data/ (e.g. data/hall-of-taps.db). Edit the queries
 * below to match your schema (table/column names). Output keys must match
 * the site: BeerName, BeerStyle, BreweryName, BeerAbv, BeerIbu, HallRating;
 * BreweryName, City, BreweryState, country; BID, BeerName, HallRating, BeerID.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_DB = path.join(DATA_DIR, 'hall-of-taps.db');
const PREVIEW_LIMIT = 15;

// Use DB path from env or default
const dbPath = process.env.DB_PATH || process.env.HALL_OF_TAPS_DB || DEFAULT_DB;

function getDbPath() {
  if (fs.existsSync(dbPath)) return dbPath;
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.db'));
  if (files.length === 0) {
    console.error('No SQLite DB found in data/. Put a .db file in data/ or set DB_PATH.');
    process.exit(1);
  }
  return path.join(DATA_DIR, files[0]);
}

function run() {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.error('better-sqlite3 not installed. Run: npm install');
    process.exit(1);
  }

  const dbFile = getDbPath();
  console.log('Using DB:', dbFile);
  const db = new Database(dbFile, { readonly: true });

  // --- Edit these queries to match your schema ---
  // Preview: JOIN beers + beer_info, ORDER BY TAP DESC, top N
  const previewSql = `
  SELECT
      b.BID,
      b.BeerName,
      bi.TAP AS HallRating,
      b.Bid
    FROM beers b
    JOIN BeerInfo bi ON bi.Bid = b.Bid
    ORDER BY bi.TAP DESC
    LIMIT ?
  `;

  // Beers: full list with style, brewery, ABV, IBU, Hall rating (alias TAP as HallRating if needed)
  const beersSql = `
   SELECT
      b.BeerName,
      b.BeerStyle AS BeerStyle,
      br.BreweryName,
      b.BeerAbv AS BeerAbv,
      b.BeerIbu AS BeerIbu,
      bi.TAP AS HallRating
    FROM beers b
    JOIN BeerInfo bi ON bi.BID = b.BID
    JOIN breweries br ON b.BreweryId = br.ID
    ORDER BY bi.TAP DESC
  `;

  // Breweries: distinct list for site
  const breweriesSql = `
    SELECT DISTINCT
      BreweryName,
      Location
    FROM breweries
    ORDER BY BreweryName
  `;

  try {
    const previewStmt = db.prepare(previewSql);
    const beersStmt = db.prepare(beersSql);
    const breweriesStmt = db.prepare(breweriesSql);

    const preview = previewStmt.all(PREVIEW_LIMIT);
    const beers = beersStmt.all();
    const breweries = breweriesStmt.all();

    const jsonOpts = { encoding: 'utf8' };
    fs.writeFileSync(path.join(DATA_DIR, 'preview.json'), JSON.stringify(preview, null, 0) + '\n', jsonOpts);
    fs.writeFileSync(path.join(DATA_DIR, 'beers.json'), JSON.stringify(beers, null, 2) + '\n', jsonOpts);
    fs.writeFileSync(path.join(DATA_DIR, 'breweries.json'), JSON.stringify(breweries, null, 2) + '\n', jsonOpts);

    console.log('Exported: preview.json (%d), beers.json (%d), breweries.json (%d)',
      preview.length, beers.length, breweries.length);
  } catch (err) {
    console.error('Export failed:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

run();
