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
            return '<li><a href="#">' + escapeHtml(m.BeerName) + '</a></li>';
          }).join('');
        })
        .catch(function () {
          listEl.innerHTML = '<li class="error">Could not load preview data.</li>';
        });
    },

    loadBeers: function (tableEl, paginationEl, pageSize) {
      if (!tableEl) return;
      pageSize = pageSize || DEFAULT_PAGE_SIZE;
      tableEl.innerHTML = '<tr><td colspan="6" class="loading">Loading beers…</td></tr>';
      if (paginationEl) paginationEl.innerHTML = '';
      fetch(DATA + '/beers.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load beers')); })
        .then(function (data) {
          renderPaginated(tableEl, paginationEl, data, pageSize, function (m) {
            return '<tr><td>' + escapeHtml(m.BeerName) + '</td><td>' + escapeHtml(m.BeerStyle || '') +
              '</td><td>' + escapeHtml(m.BreweryName || '') + '</td><td>' + (m.BeerAbv != null ? m.BeerAbv : '') +
              '</td><td>' + (m.BeerIbu != null ? m.BeerIbu : '') + '</td><td>' + (m.HallRating != null ? m.HallRating : '') + '</td></tr>';
          }, 6);
        })
        .catch(function () {
          tableEl.innerHTML = '<tr><td colspan="6" class="error">Could not load beers data.</td></tr>';
        });
    },

    loadBreweries: function (tableEl, paginationEl, pageSize) {
      if (!tableEl) return;
      pageSize = pageSize || DEFAULT_PAGE_SIZE;
      tableEl.innerHTML = '<tr><td colspan="4" class="loading">Loading breweries…</td></tr>';
      if (paginationEl) paginationEl.innerHTML = '';
      fetch(DATA + '/breweries.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Failed to load breweries')); })
        .then(function (data) {
          renderPaginated(tableEl, paginationEl, data, pageSize, function (m) {
            return '<tr><td>' + escapeHtml(m.BreweryName || '') + '</td><td>' + escapeHtml(m.City || '') +
              '</td><td>' + escapeHtml(m.BreweryState || '') + '</td><td>' + escapeHtml(m.country || '') + '</td></tr>';
          }, 4);
        })
        .catch(function () {
          tableEl.innerHTML = '<tr><td colspan="4" class="error">Could not load breweries data.</td></tr>';
        });
    }
  };

  function renderPaginated(tableEl, paginationEl, data, pageSize, rowFn, colspan) {
    var total = data.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var currentPage = 1;

    function renderPage(page) {
      currentPage = Math.max(1, Math.min(totalPages, page));
      var start = (currentPage - 1) * pageSize;
      var end = Math.min(start + pageSize, total);
      var slice = data.slice(start, end);
      tableEl.innerHTML = slice.map(rowFn).join('');

      if (!paginationEl) return;
      var prevDisabled = currentPage <= 1;
      var nextDisabled = currentPage >= totalPages;
      var from = total === 0 ? 0 : start + 1;
      paginationEl.innerHTML =
        '<div class="pagination">' +
        '<button type="button" class="pagination-btn" data-page="prev" ' + (prevDisabled ? 'disabled' : '') + '>Previous</button>' +
        '<span class="pagination-info">Page ' + currentPage + ' of ' + totalPages + ' <span class="pagination-range">(' + from + '–' + end + ' of ' + total + ')</span></span>' +
        '<button type="button" class="pagination-btn" data-page="next" ' + (nextDisabled ? 'disabled' : '') + '>Next</button>' +
        '</div>';

      paginationEl.querySelectorAll('.pagination-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (this.disabled) return;
          var p = this.getAttribute('data-page') === 'next' ? currentPage + 1 : currentPage - 1;
          renderPage(p);
        });
      });
    }

    renderPage(1);
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
})();
