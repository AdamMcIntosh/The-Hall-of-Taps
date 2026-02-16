/**
 * Export JSON data from the Hall of Taps SQLite DB.
 * Run after DB updates: npm run build:data
 *
 * Output: data/preview.json (single file) and chunked data in data/beers/
 * and data/breweries/ (page-0.json, page-1.json, ... + meta.json). The frontend
 * fetches one page at a time to avoid loading huge JSON files.
 *
 * Expects a SQLite DB in data/ (e.g. data/hall-of-taps.db). Edit the queries
 * below to match your schema. Output keys must match the site: BeerName,
 * BeerStyle, BreweryName, BeerAbv, BeerIbu, HallRating; BreweryName, City,
 * BreweryState, country; BID, BeerName, HallRating, BeerID.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_DB = path.join(DATA_DIR, 'hall-of-taps.db');
const PREVIEW_LIMIT = 15;
/** Chunk size for beers and breweries (must match frontend DEFAULT_PAGE_SIZE). */
const PAGE_SIZE = 25;

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

/**
 * Write an array as chunked JSON: dir/page-0.json, dir/page-1.json, ... and dir/meta.json.
 */
function writeChunked(dirName, rows) {
  const dir = path.join(DATA_DIR, dirName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const meta = { total, pageSize: PAGE_SIZE, totalPages };
  const jsonOpts = { encoding: 'utf8' };

  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 0) + '\n', jsonOpts);

  for (let p = 0; p < totalPages; p++) {
    const start = p * PAGE_SIZE;
    const chunk = rows.slice(start, start + PAGE_SIZE);
    fs.writeFileSync(
      path.join(dir, 'page-' + p + '.json'),
      JSON.stringify(chunk, null, 2) + '\n',
      jsonOpts
    );
  }
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
      b.BID,
      b.BeerName,
      b.BeerStyle AS BeerStyle,
      br.BreweryName,
      br.Location AS Origin,
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

    // Single file for preview (small)
    fs.writeFileSync(path.join(DATA_DIR, 'preview.json'), JSON.stringify(preview, null, 0) + '\n', jsonOpts);

    // Chunked output: beers/page-0.json, beers/page-1.json, ... + beers/meta.json
    writeChunked('beers', beers);
    writeChunked('breweries', breweries);

    // Full beers list for client-side filtering (one file for filter-by-brewery etc.)
    const beersDir = path.join(DATA_DIR, 'beers');
    fs.writeFileSync(
      path.join(beersDir, 'all.json'),
      JSON.stringify(beers, null, 0) + '\n',
      { encoding: 'utf8' }
    );

    // Brewery names list for filter dropdown (sorted, unique, non-empty)
    const breweryNames = [...new Set(
      breweries
        .map((r) => r.BreweryName)
        .filter((n) => n != null && String(n).trim() !== '')
    )].sort((a, b) => String(a).localeCompare(String(b), 'en', { sensitivity: 'base' }));
    fs.writeFileSync(
      path.join(DATA_DIR, 'breweries', 'names.json'),
      JSON.stringify(breweryNames, null, 0) + '\n',
      { encoding: 'utf8' }
    );

    // Beer index for detail page lookups: BID -> { pageIndex, indexInPage }
    const beerIndex = {};
    const pageSize = PAGE_SIZE;
    beers.forEach((row, i) => {
      const id = row.BID;
      if (id != null) {
        const pageIndex = Math.floor(i / pageSize);
        const indexInPage = i % pageSize;
        beerIndex[id] = { pageIndex, indexInPage };
      }
    });
    fs.writeFileSync(
      path.join(DATA_DIR, 'beers', 'beer-index.json'),
      JSON.stringify(beerIndex, null, 0) + '\n',
      { encoding: 'utf8' }
    );

    console.log('Exported: preview.json (%d), beers (%d in %d pages + all.json), breweries (%d in %d pages), brewery names (%d)',
      preview.length,
      beers.length,
      Math.ceil(beers.length / PAGE_SIZE),
      breweries.length,
      Math.ceil(breweries.length / PAGE_SIZE),
      breweryNames.length);
  } catch (err) {
    console.error('Export failed:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

run();
