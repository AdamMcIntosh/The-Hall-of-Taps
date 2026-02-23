-- Verify TAP range population percentages
-- Requires a table with a TAP column (e.g. beers with BID, TAP, ...).
-- Compatible with SQLite; for SQL Server use -- instead of -- for comments and
-- ensure table/column names match your schema.

-- Expected percentages (descriptor reference)
-- TAP range      | % (approx) | Descriptor
-- 10+            | 0.10%     | Hall-of-Famer
-- 8 to 10        | 0.40%     | MVP
-- 6 to 8         | 1.10%     | All Star
-- 4 to 6         | 4.70%     | Very Good
-- 2 to 4         | 18.60%    | Above Average
-- 0 to 2         | 45.70%    | Useful to Average
-- Below 0        | 29.40%    | Not Good

WITH
expected AS (
  SELECT '10+'         AS TAP_range, 'Hall-of-Famer'   AS descriptor,  0.10 AS expected_pct
  UNION ALL SELECT '8 to 10',  'MVP',              0.40
  UNION ALL SELECT '6 to 8',   'All Star',         1.10
  UNION ALL SELECT '4 to 6',   'Very Good',        4.70
  UNION ALL SELECT '2 to 4',   'Above Average',   18.60
  UNION ALL SELECT '0 to 2',   'Useful to Average', 45.70
  UNION ALL SELECT 'Below 0',  'Not Good',        29.40
),
bucketed AS (
  SELECT
    CASE
      WHEN TAP >= 10              THEN '10+'
      WHEN TAP >= 8  AND TAP < 10 THEN '8 to 10'
      WHEN TAP >= 6  AND TAP < 8  THEN '6 to 8'
      WHEN TAP >= 4  AND TAP < 6  THEN '4 to 6'
      WHEN TAP >= 2  AND TAP < 4  THEN '2 to 4'
      WHEN TAP >= 0  AND TAP < 2  THEN '0 to 2'
      ELSE 'Below 0'
    END AS TAP_range
  FROM beers b
  left outer join BeerInfo i on i.BID = b.BID
  WHERE TAP IS NOT NULL
),
totals AS (
  SELECT COUNT(*) AS total FROM bucketed
),
actual AS (
  SELECT
    b.TAP_range,
    COUNT(*) AS n,
    ROUND(100.0 * COUNT(*) / (SELECT total FROM totals), 2) AS actual_pct
  FROM bucketed b
  GROUP BY b.TAP_range
)
SELECT
  e.TAP_range,
  e.descriptor,
  e.expected_pct AS expected_pct,
  COALESCE(a.actual_pct, 0) AS actual_pct,
  ROUND(COALESCE(a.actual_pct, 0) - e.expected_pct, 2) AS diff_pct,
  COALESCE(a.n, 0) AS count
FROM expected e
LEFT JOIN actual a ON a.TAP_range = e.TAP_range
ORDER BY
  CASE e.TAP_range
    WHEN '10+'     THEN 1
    WHEN '8 to 10' THEN 2
    WHEN '6 to 8'  THEN 3
    WHEN '4 to 6'  THEN 4
    WHEN '2 to 4'  THEN 5
    WHEN '0 to 2'  THEN 6
    WHEN 'Below 0' THEN 7
    ELSE 8
  END;

-- Average TAP score (same population as above: beers with non-null TAP)
SELECT
  COUNT(*) AS n,
  ROUND(AVG(TAP), 4) AS avg_tap_score,
  ROUND(MIN(TAP), 2) AS min_tap,
  ROUND(MAX(TAP), 2) AS max_tap
FROM beers b
LEFT OUTER JOIN BeerInfo i ON i.BID = b.BID
WHERE TAP IS NOT NULL;
