# Hall of Taps

An alternative craft beer hall of fame.

## Running locally

Opening `index.html` directly in the browser (`file://`) causes CORS errors when loading the JSON data. Use a local web server instead:

```bash
npm run serve
```

Then open **http://localhost:3000** in your browser. The data will load from the same origin and CORS will not apply.

(No need to run `npm install`—`npm run serve` uses `npx serve` to run the server.)

## Data: exporting from SQLite

The site reads static JSON from `data/`: **preview.json** (single file) and **chunked** data under `data/beers/` and `data/breweries/` (e.g. `page-0.json`, `page-1.json`, … plus `meta.json` for total/page count). The frontend fetches one page at a time. All of this is generated from a SQLite database in the **data** folder.

- **Database:** Put your `.db` file in `data/` (e.g. `data/hall-of-taps.db`). The repo ignores `data/*.db`.
- **Preview:** Not a fixed list—it’s the join of **beers** and **beer_info** sorted **desc by TAP**, exported as the top N (e.g. 15) so the leaderboard updates when ratings change.
- **After you update the DB**, regenerate the JSON:

  ```bash
  npm install
  npm run build:data
  ```

The export script is `scripts/export-from-db.js`. It expects tables such as `beers`, `beer_info`, and `breweries`; if your schema uses different table or column names, edit the SQL in that file (and use `AS` so the output keys stay `BeerName`, `HallRating`, `BID`, etc.).
