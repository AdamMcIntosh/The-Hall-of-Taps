/**
 * Hall of Taps – load JSON data and render tables/lists with pagination
 * Paths are relative to the page (works on GitHub Pages from repo root).
 */

(function () {
  const DATA = 'data';
  const DEFAULT_PAGE_SIZE = 25;

  window.HallOfTaps = {
    loadPreview: function (listEl) {
      if (!listEl) return;
      fetch(DATA + '/preview.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load preview')); })
        .then(function (data) {
          listEl.innerHTML = data.map(function (m) {
            var href = (m.BID != null) ? 'beer.html#' + encodeURIComponent(m.BID) : 'beers.html';
            return '<li><a href="' + href + '">' + escapeHtml(m.BeerName) + '</a></li>';
          }).join('');
        })
        .catch(function () {
          listEl.innerHTML = '<li class="error">Could not load preview data.</li>';
        });
    },

    loadLeaderboard: function (tbodyEl, limit) {
      if (!tbodyEl) return;
      limit = limit || 12;
      fetch(DATA + '/preview.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load preview')); })
        .then(function (data) {
          var slice = data.slice(0, limit);
          tbodyEl.innerHTML = slice.map(function (m, i) {
            var href = (m.BID != null) ? 'beer.html#' + encodeURIComponent(m.BID) : 'beers.html';
            return '<tr><td>' + (i + 1) + '</td><td><a href="' + href + '">' + escapeHtml(m.BeerName) + '</a></td><td>' + (m.HallRating != null ? m.HallRating : '') + '</td></tr>';
          }).join('');
        })
        .catch(function () {
          tbodyEl.innerHTML = '<tr><td colspan="3" class="error">Could not load leaderboard.</td></tr>';
        });
    },

    loadBeers: function (tableEl, paginationEl, pageSize) {
      if (!tableEl) return;
      pageSize = pageSize || DEFAULT_PAGE_SIZE;
      var colspan = 8;
      tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">Loading beers…</td></tr>';
      if (paginationEl) paginationEl.innerHTML = '';
      var currentChunk = [];
      var currentStart = 0;
      var currentPage = 1;
      var totalPages = 1;
      var total = 0;
      var sortKey = null;
      var sortDir = 1;
      var filters = { q: '', breweries: '', styles: '', abvMin: '0', abvMax: '25', barMin: '-15', barMax: '19' };
      var sortAndFilterBound = false;
      var allBeersCache = null;
      var filteredFullList = null;
      var metaTotalPages = 1;
      var metaTotal = 0;

      function hasActiveFilter() {
        return (filters.q && filters.q.length > 0) ||
          (filters.breweries && filters.breweries.length > 0) ||
          (filters.styles && filters.styles.length > 0) ||
          filters.abvMin !== '0' || filters.abvMax !== '25' ||
          filters.barMin !== '-15' || filters.barMax !== '19';
      }

      function loadAllBeers() {
        if (allBeersCache) return Promise.resolve(allBeersCache);
        return fetch(DATA + '/beers/all.json')
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load all beers')); })
          .then(function (list) {
            allBeersCache = list;
            return list;
          });
      }

      function readFiltersFromDOM() {
        var quickSearch = document.getElementById('quick-search');
        var fb = document.getElementById('filter-breweries');
        var fs = document.getElementById('filter-styles');
        var abvMinEl = document.getElementById('abv-min');
        var abvMaxEl = document.getElementById('abv-max');
        var barMinEl = document.getElementById('bar-min');
        var barMaxEl = document.getElementById('bar-max');
        filters.q = quickSearch ? quickSearch.value.trim() : '';
        filters.breweries = fb && fb.value ? fb.value.trim() : '';
        filters.styles = fs ? fs.value.trim() : '';
        filters.abvMin = abvMinEl ? abvMinEl.value : '';
        filters.abvMax = abvMaxEl ? abvMaxEl.value : '';
        filters.barMin = barMinEl ? barMinEl.value : '';
        filters.barMax = barMaxEl ? barMaxEl.value : '';
      }

      function loadBreweryDropdown() {
        var sel = document.getElementById('filter-breweries');
        if (!sel || sel.tagName !== 'SELECT') return;
        fetch(DATA + '/breweries/names.json')
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load brewery names')); })
          .then(function (names) {
            while (sel.options.length > 1) sel.remove(1);
            names.forEach(function (name) {
              var opt = document.createElement('option');
              opt.value = name;
              opt.textContent = name;
              sel.appendChild(opt);
            });
          })
          .catch(function () { /* ignore: dropdown stays with "All breweries" only */ });
      }
      loadBreweryDropdown();

      function beerRow(m, rowNum) {
        var beerLink = (m.BID != null) ? 'beer.html#' + encodeURIComponent(m.BID) : 'beers.html';
        var styleText = escapeHtml(m.BeerStyle || '');
        var breweryText = escapeHtml(m.BreweryName || '');
        var originText = escapeHtml(m.Origin || m.BreweryLocation || '');
        return '<tr><td class="beers-col-num">' + rowNum + '</td><td><a href="' + beerLink + '">' + escapeHtml(m.BeerName || '') + '</a></td><td><a href="beers.html">' + styleText + '</a></td><td><a href="breweries.html">' + breweryText + '</a></td><td><a href="beers.html">' + originText + '</a></td><td>' + (m.BeerAbv != null && m.BeerAbv !== '' ? m.BeerAbv : '—') + '</td><td>—</td><td>' + (m.HallRating != null && m.HallRating !== '' ? m.HallRating : '—') + '</td></tr>';
      }

      function applyFilters(chunk) {
        var q = (filters.q || '').toLowerCase();
        var breweryTerms = filters.breweries ? [filters.breweries.toLowerCase()] : [];
        var styleTerms = (filters.styles || '').toLowerCase().split(/,\s*/).filter(Boolean).slice(0, 20);
        var abvMin = filters.abvMin === '' ? -Infinity : parseFloat(filters.abvMin, 10);
        var abvMax = filters.abvMax === '' ? Infinity : parseFloat(filters.abvMax, 10);
        var barMin = filters.barMin === '' ? -Infinity : parseFloat(filters.barMin, 10);
        var barMax = filters.barMax === '' ? Infinity : parseFloat(filters.barMax, 10);
        if (Number.isNaN(abvMin)) abvMin = -Infinity;
        if (Number.isNaN(abvMax)) abvMax = Infinity;
        if (Number.isNaN(barMin)) barMin = -Infinity;
        if (Number.isNaN(barMax)) barMax = Infinity;
        return chunk.filter(function (m) {
          if (q) {
            var name = (m.BeerName || '').toLowerCase();
            var brewery = (m.BreweryName || '').toLowerCase();
            var style = (m.BeerStyle || '').toLowerCase();
            if (name.indexOf(q) === -1 && brewery.indexOf(q) === -1 && style.indexOf(q) === -1) return false;
          }
          if (breweryTerms.length) {
            var br = (m.BreweryName || '').toLowerCase();
            if (!breweryTerms.some(function (t) { return br === t; })) return false;
          }
          if (styleTerms.length) {
            var st = (m.BeerStyle || '').toLowerCase();
            if (!styleTerms.some(function (t) { return st.indexOf(t) !== -1; })) return false;
          }
          var abv = m.BeerAbv != null && m.BeerAbv !== '' ? parseFloat(m.BeerAbv, 10) : null;
          if (abv != null && (abv < abvMin || abv > abvMax)) return false;
          var bar = m.HallRating != null && m.HallRating !== '' ? parseFloat(m.HallRating, 10) : null;
          if (bar != null && (bar < barMin || bar > barMax)) return false;
          return true;
        });
      }

      function compare(a, b) {
        var va = a[sortKey];
        var vb = b[sortKey];
        if (sortKey === 'HallRating' || sortKey === 'BeerAbv') {
          va = va != null && va !== '' ? parseFloat(va, 10) : -Infinity;
          vb = vb != null && vb !== '' ? parseFloat(vb, 10) : -Infinity;
        } else {
          va = (va != null ? String(va) : '').toLowerCase();
          vb = (vb != null ? String(vb) : '').toLowerCase();
        }
        if (va < vb) return -sortDir;
        if (va > vb) return sortDir;
        return 0;
      }

      function renderChunk(chunk, start) {
        var filtered = applyFilters(chunk);
        if (sortKey) filtered = filtered.slice().sort(compare);
        if (filtered.length === 0) {
          tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">No beers match the current filters.</td></tr>';
        } else {
          tableEl.innerHTML = filtered.map(function (m, i) { return beerRow(m, start + i + 1); }).join('');
        }
      }

      function renderFilteredPage() {
        if (!filteredFullList) return;
        var start = (currentPage - 1) * pageSize;
        var chunk = filteredFullList.slice(start, start + pageSize);
        currentStart = start;
        if (chunk.length === 0) {
          tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">No beers match the current filters.</td></tr>';
        } else {
          tableEl.innerHTML = chunk.map(function (m, i) { return beerRow(m, start + i + 1); }).join('');
        }
      }

      function updatePagination() {
        if (!paginationEl) return;
        var end = Math.min(currentStart + pageSize, total);
        var prevDisabled = currentPage <= 1;
        var nextDisabled = currentPage >= totalPages;
        paginationEl.innerHTML =
          '<div class="pagination">' +
          '<button type="button" class="pagination-btn" data-page="prev" ' + (prevDisabled ? 'disabled' : '') + '>Previous</button>' +
          '<span class="pagination-info">Page ' + currentPage + ' of ' + totalPages + ' <span class="pagination-range">(' + (total === 0 ? 0 : currentStart + 1) + '–' + end + ' of ' + total + ')</span></span>' +
          '<button type="button" class="pagination-btn" data-page="next" ' + (nextDisabled ? 'disabled' : '') + '>Next</button>' +
          '</div>';
        paginationEl.querySelectorAll('.pagination-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (this.disabled) return;
            var next = this.getAttribute('data-page') === 'next' ? currentPage + 1 : currentPage - 1;
            if (filteredFullList) {
              currentPage = next;
              renderFilteredPage();
              updatePagination();
            } else {
              fetchAndRender(next);
            }
          });
        });
      }

      function applyFiltersAndRender() {
        readFiltersFromDOM();
        if (hasActiveFilter()) {
          tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">Loading…</td></tr>';
          loadAllBeers()
            .then(function (all) {
              filteredFullList = applyFilters(all);
              if (sortKey) filteredFullList = filteredFullList.slice().sort(compare);
              total = filteredFullList.length;
              totalPages = Math.max(1, Math.ceil(total / pageSize));
              currentPage = 1;
              renderFilteredPage();
              if (!sortAndFilterBound) {
                sortAndFilterBound = true;
                bindSortAndFilter();
              }
              updatePagination();
            })
            .catch(function () {
              tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="error">Could not load beers. Run <code>npm run build:data</code> to generate data/beers/all.json.</td></tr>';
            });
        } else {
          filteredFullList = null;
          total = metaTotal;
          totalPages = metaTotalPages;
          fetchAndRender(1);
        }
      }

      function fetchAndRender(page) {
        var pageIndex = page - 1;
        if (pageIndex < 0 || pageIndex >= totalPages) return;
        currentPage = page;
        currentStart = (page - 1) * pageSize;
        tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">Loading…</td></tr>';
        fetch(DATA + '/beers/page-' + pageIndex + '.json')
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load page')); })
          .then(function (chunk) {
            currentChunk = chunk;
            readFiltersFromDOM();
            renderChunk(chunk, currentStart);
            if (!sortAndFilterBound) {
              sortAndFilterBound = true;
              bindSortAndFilter();
            }
            if (!paginationEl) return;
            var end = Math.min(currentStart + chunk.length, total);
            var prevDisabled = currentPage <= 1;
            var nextDisabled = currentPage >= totalPages;
            paginationEl.innerHTML =
              '<div class="pagination">' +
              '<button type="button" class="pagination-btn" data-page="prev" ' + (prevDisabled ? 'disabled' : '') + '>Previous</button>' +
              '<span class="pagination-info">Page ' + currentPage + ' of ' + totalPages + ' <span class="pagination-range">(' + (total === 0 ? 0 : currentStart + 1) + '–' + end + ' of ' + total + ')</span></span>' +
              '<button type="button" class="pagination-btn" data-page="next" ' + (nextDisabled ? 'disabled' : '') + '>Next</button>' +
              '</div>';
            paginationEl.querySelectorAll('.pagination-btn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                if (this.disabled) return;
                var next = this.getAttribute('data-page') === 'next' ? currentPage + 1 : currentPage - 1;
                fetchAndRender(next);
              });
            });
          })
          .catch(function () {
            tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="error">Could not load beers data.</td></tr>';
          });
      }

      function bindSortAndFilter() {
        var sortHeaders = tableEl.closest('table') && tableEl.closest('table').querySelectorAll('.beers-col-sort');
        if (sortHeaders && sortHeaders.length) {
          sortHeaders.forEach(function (th) {
            th.addEventListener('click', function () {
              var key = this.getAttribute('data-sort');
              if (key === 'StylePlus') return;
              sortDir = sortKey === key ? -sortDir : 1;
              sortKey = key;
              if (filteredFullList) {
                filteredFullList = filteredFullList.slice().sort(compare);
                currentPage = 1;
                renderFilteredPage();
                updatePagination();
              } else {
                renderChunk(currentChunk, currentStart);
              }
            });
          });
        }
        var quickSearch = document.getElementById('quick-search');
        var abvMin = document.getElementById('abv-min');
        var abvMax = document.getElementById('abv-max');
        var barMin = document.getElementById('bar-min');
        var barMax = document.getElementById('bar-max');
        var btnApply = document.getElementById('filter-apply');
        var btnReset = document.getElementById('filter-reset');
        function readFilters() {
          readFiltersFromDOM();
        }
        if (btnApply) btnApply.addEventListener('click', function () { applyFiltersAndRender(); });
        if (btnReset) btnReset.addEventListener('click', function () {
          if (quickSearch) quickSearch.value = '';
          var fb = document.getElementById('filter-breweries'); if (fb) fb.value = '';
          var fs = document.getElementById('filter-styles'); if (fs) fs.value = '';
          if (abvMin) abvMin.value = '0';
          if (abvMax) abvMax.value = '25';
          if (barMin) barMin.value = '-15';
          if (barMax) barMax.value = '19';
          readFilters();
          applyFiltersAndRender();
        });
        if (quickSearch) quickSearch.addEventListener('input', function () { applyFiltersAndRender(); });
        var filterBreweries = document.getElementById('filter-breweries');
        if (filterBreweries) filterBreweries.addEventListener('change', function () { applyFiltersAndRender(); });
        if (abvMin) abvMin.addEventListener('change', function () { applyFiltersAndRender(); });
        if (abvMax) abvMax.addEventListener('change', function () { applyFiltersAndRender(); });
        if (barMin) barMin.addEventListener('change', function () { applyFiltersAndRender(); });
        if (barMax) barMax.addEventListener('change', function () { applyFiltersAndRender(); });
      }

      fetch(DATA + '/beers/meta.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load beers meta')); })
        .then(function (meta) {
          metaTotalPages = meta.totalPages || 1;
          metaTotal = meta.total || 0;
          totalPages = metaTotalPages;
          total = metaTotal;
          readFiltersFromDOM();
          applyFiltersAndRender();
        })
        .catch(function () {
          tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="error">Could not load beers data.</td></tr>';
        });
    },

    loadBeerDetail: function (containerEl, beerId) {
      if (!containerEl || !beerId) return;
      var DATA = 'data';
      containerEl.innerHTML = '<p class="loading">Loading beer…</p>';
      fetch(DATA + '/beers/beer-index.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('No index')); })
        .then(function (index) {
          var loc = index[beerId];
          if (!loc) return Promise.reject(new Error('Beer not found'));
          return fetch(DATA + '/beers/page-' + loc.pageIndex + '.json')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load page')); })
            .then(function (chunk) {
              var beer = chunk[loc.indexInPage];
              if (!beer) return Promise.reject(new Error('Beer not found'));
              return beer;
            });
        })
        .then(function (beer) {
          document.title = escapeHtml(beer.BeerName) + ' – Hall of Taps';
          containerEl.innerHTML = renderBeerDetail(beer);
        })
        .catch(function () {
          containerEl.innerHTML = '<p class="error">Beer not found or data not available. <a href="beers.html">Browse beers</a>.</p>';
        });
    }
  };

  function renderBeerDetail(beer) {
    var name = escapeHtml(beer.BeerName || '');
    var brewery = escapeHtml(beer.BreweryName || '');
    var breweryUrl = 'breweries.html';
    var labelUrl = beer.BeerLabelUrl || beer.beer_label || '';
    var labelImg = labelUrl
      ? '<img class="beer-label-img" src="' + escapeHtml(labelUrl) + '" alt="" width="80" height="80">'
      : '<span class="beer-label-placeholder" aria-hidden="true"></span>';
    var bar = beer.HallRating != null && beer.HallRating !== '' ? Number(beer.HallRating) : null;
    var barDesc = bar != null ? (bar >= 18 ? 'This is one of the best beers available' : 'Hall rating') : '—';
    var styleText = escapeHtml(beer.BeerStyle || '');
    var stylePlusDesc = styleText ? 'Style' : '—';
    var abv = beer.BeerAbv != null && beer.BeerAbv !== '' ? beer.BeerAbv : '—';
    var abvDesc = (beer.BeerAbv != null && beer.BeerAbv !== '') ? 'ABV' : '—';
    return (
      '<header class="beer-header">' +
        '<div class="beer-label-triage">' + labelImg + '</div>' +
        '<div class="beer-title-block">' +
          '<h1 class="beer-name">' + name + '</h1>' +
          '<p class="beer-by">by <a href="' + breweryUrl + '">' + brewery + '</a></p>' +
        '</div>' +
      '</header>' +
      '<div class="beer-stats">' +
        '<div class="beer-stat"><span class="beer-stat-label">BAR</span><span class="beer-stat-value">' + (bar != null ? bar : '—') + '</span><span class="beer-stat-desc">' + barDesc + '</span></div>' +
        '<div class="beer-stat"><span class="beer-stat-label">Style+</span><span class="beer-stat-value">' + (styleText || '—') + '</span><span class="beer-stat-desc">' + stylePlusDesc + '</span></div>' +
        '<div class="beer-stat"><span class="beer-stat-label">In-Brewery Ranking</span><span class="beer-stat-value">—</span><span class="beer-stat-desc">Rank within brewery (coming soon)</span></div>' +
        '<div class="beer-stat"><span class="beer-stat-label">ABV</span><span class="beer-stat-value">' + abv + '</span><span class="beer-stat-desc">' + abvDesc + '</span></div>' +
      '</div>' +
      '<section class="beer-section">' +
        '<h2 class="beer-section-title">Distribution data unavailable</h2>' +
        '<p class="beer-section-desc">We\'re still gathering data for this beer\'s distribution.</p>' +
      '</section>' +
      '<section class="beer-section">' +
        '<h2 class="beer-section-title">What Do You Think About This Beer?</h2>' +
        '<p class="beer-section-desc">Comments and ratings coming soon.</p>' +
      '</section>'
    );
  }

  window.HallOfTaps.loadBreweries = function (tableEl, paginationEl, pageSize) {
    if (!tableEl) return;
    pageSize = pageSize || DEFAULT_PAGE_SIZE;
    tableEl.innerHTML = '<tr><td colspan="4" class="loading">Loading breweries…</td></tr>';
    if (paginationEl) paginationEl.innerHTML = '';
    loadChunked(tableEl, paginationEl, 'breweries', pageSize, 4, function (m) {
      return '<tr><td>' + escapeHtml(m.BreweryName || '') + '</td><td>' + escapeHtml(m.City || '') +
        '</td><td>' + escapeHtml(m.BreweryState || '') + '</td><td>' + escapeHtml(m.country || '') + '</td></tr>';
    });
  };

  /**
   * Load chunked data: fetch meta, then fetch one page at a time. Pagination loads only the requested page.
   */
  function loadChunked(tableEl, paginationEl, dir, pageSize, colspan, rowFn) {
    fetch(DATA + '/' + dir + '/meta.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load ' + dir + ' meta')); })
      .then(function (meta) {
        var totalPages = meta.totalPages || 1;
        var total = meta.total || 0;
        var currentPage = 1;

        function fetchAndRender(page) {
          var pageIndex = page - 1;
          if (pageIndex < 0 || pageIndex >= totalPages) return;
          currentPage = page;
          tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">Loading…</td></tr>';
          fetch(DATA + '/' + dir + '/page-' + pageIndex + '.json')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load page')); })
            .then(function (chunk) {
              tableEl.innerHTML = chunk.map(rowFn).join('');
              if (!paginationEl) return;
              var start = (currentPage - 1) * pageSize;
              var end = Math.min(start + chunk.length, total);
              var prevDisabled = currentPage <= 1;
              var nextDisabled = currentPage >= totalPages;
              paginationEl.innerHTML =
                '<div class="pagination">' +
                '<button type="button" class="pagination-btn" data-page="prev" ' + (prevDisabled ? 'disabled' : '') + '>Previous</button>' +
                '<span class="pagination-info">Page ' + currentPage + ' of ' + totalPages + ' <span class="pagination-range">(' + (total === 0 ? 0 : start + 1) + '–' + end + ' of ' + total + ')</span></span>' +
                '<button type="button" class="pagination-btn" data-page="next" ' + (nextDisabled ? 'disabled' : '') + '>Next</button>' +
                '</div>';
              paginationEl.querySelectorAll('.pagination-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                  if (this.disabled) return;
                  var next = this.getAttribute('data-page') === 'next' ? currentPage + 1 : currentPage - 1;
                  fetchAndRender(next);
                });
              });
            })
            .catch(function () {
              tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="error">Could not load ' + dir + ' data.</td></tr>';
            });
        }

        fetchAndRender(1);
      })
      .catch(function () {
        tableEl.innerHTML = '<tr><td colspan="' + colspan + '" class="error">Could not load ' + dir + ' data.</td></tr>';
      });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
})();
