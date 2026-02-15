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
            return '<li><a href="beers.html">' + escapeHtml(m.BeerName) + '</a></li>';
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
            return '<tr><td>' + (i + 1) + '</td><td><a href="beers.html">' + escapeHtml(m.BeerName) + '</a></td><td>' + (m.HallRating != null ? m.HallRating : '') + '</td></tr>';
          }).join('');
        })
        .catch(function () {
          tbodyEl.innerHTML = '<tr><td colspan="3" class="error">Could not load leaderboard.</td></tr>';
        });
    },

    loadBeers: function (tableEl, paginationEl, pageSize) {
      if (!tableEl) return;
      pageSize = pageSize || DEFAULT_PAGE_SIZE;
      tableEl.innerHTML = '<tr><td colspan="6" class="loading">Loading beers…</td></tr>';
      if (paginationEl) paginationEl.innerHTML = '';
      loadChunked(tableEl, paginationEl, 'beers', pageSize, 6, function (m) {
        return '<tr><td>' + escapeHtml(m.BeerName) + '</td><td>' + escapeHtml(m.BeerStyle || '') +
          '</td><td>' + escapeHtml(m.BreweryName || '') + '</td><td>' + (m.BeerAbv != null ? m.BeerAbv : '') +
          '</td><td>' + (m.BeerIbu != null ? m.BeerIbu : '') + '</td><td>' + (m.HallRating != null ? m.HallRating : '') + '</td></tr>';
      });
    },

    loadBreweries: function (tableEl, paginationEl, pageSize) {
      if (!tableEl) return;
      pageSize = pageSize || DEFAULT_PAGE_SIZE;
      tableEl.innerHTML = '<tr><td colspan="4" class="loading">Loading breweries…</td></tr>';
      if (paginationEl) paginationEl.innerHTML = '';
      loadChunked(tableEl, paginationEl, 'breweries', pageSize, 4, function (m) {
        return '<tr><td>' + escapeHtml(m.BreweryName || '') + '</td><td>' + escapeHtml(m.City || '') +
          '</td><td>' + escapeHtml(m.BreweryState || '') + '</td><td>' + escapeHtml(m.country || '') + '</td></tr>';
      });
    }
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
