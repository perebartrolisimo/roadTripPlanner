// ── Storage ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'roadTripPlanner_stops';

function loadStopsFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function loadStopsFromFile() {
    return fetch('stops.json')
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load stops.json');
            return res.json();
        });
}

function exportStops() {
    const json = JSON.stringify(stops, null, 4);
    const blob = new Blob([json + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stops.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function saveStops(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Helpers ──────────────────────────────────────────────────────────
function escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
}

function extractCoordsFromUrl(url) {
    if (!url) return null;
    const match = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
}

function extractPlacesFromUrl(url) {
    if (!url) return [];
    try {
        const decoded = decodeURIComponent(url);
        const dirMatch = decoded.match(/\/dir\/([^?]+)/);
        if (!dirMatch) return [];
        return dirMatch[1]
            .split('/')
            .filter(p => p && !p.startsWith('@') && !p.startsWith('data='))
            .map(p => p.replace(/\+/g, ' '));
    } catch (_) {
        return [];
    }
}

function buildEmbedUrl(routeUrl) {
    const places = extractPlacesFromUrl(routeUrl);
    if (places.length >= 2) {
        const origin = encodeURIComponent(places[0]);
        const destination = encodeURIComponent(places[places.length - 1]);
        return 'https://www.google.com/maps/embed/v1/directions?key=&origin='
            + origin + '&destination=' + destination + '&mode=driving';
    }
    const coords = extractCoordsFromUrl(routeUrl);
    if (coords) {
        return 'https://www.google.com/maps/embed/v1/view?key=&center='
            + coords.lat + ',' + coords.lng + '&zoom=7';
    }
    return null;
}

// ── State ────────────────────────────────────────────────────────────
let stops = [];
let editingId = null;

// ── CRUD ─────────────────────────────────────────────────────────────
function deleteStop(id) {
    stops = stops.filter(s => s.id !== id);
    saveStops(stops);
    renderStops();
}

function addStop(stop) {
    stops.push(stop);
    saveStops(stops);
    renderStops();
}

function updateStop(id, data) {
    const idx = stops.findIndex(s => s.id === id);
    if (idx === -1) return;
    stops[idx] = { ...stops[idx], ...data };
    saveStops(stops);
    editingId = null;
    renderStops();
}

function moveStop(id, direction) {
    const idx = stops.findIndex(s => s.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= stops.length) return;
    const temp = stops[idx];
    stops[idx] = stops[target];
    stops[target] = temp;
    saveStops(stops);
    renderStops();
}

// ── Render ───────────────────────────────────────────────────────────
function renderStops() {
    const container = document.getElementById('stops-container');

    if (stops.length === 0) {
        container.innerHTML = '<p class="empty-state">No hi ha parades. Afegeix-ne una! 🚗</p>';
        return;
    }

    container.innerHTML = stops.map((stop, i) => {
        const coords = extractCoordsFromUrl(stop.routeUrl);
        const places = extractPlacesFromUrl(stop.routeUrl);
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const isEditing = editingId === stop.id;

        let extraChips = '';
        if (coords) {
            extraChips += '<span class="detail-chip coords">📍 '
                + escapeHtml(coords.lat.toFixed(2) + ', ' + coords.lng.toFixed(2))
                + '</span>';
        }
        if (places.length > 0) {
            extraChips += '<span class="detail-chip">🛣️ '
                + escapeHtml(places.join(' → ')) + '</span>';
        }

        let editFormHtml = '';
        if (isEditing) {
            editFormHtml = '<div class="stop-edit-form">'
                + '<div class="form-grid">'
                + '<div class="form-group">'
                + '<label>Data</label>'
                + '<input type="text" class="edit-date" value="' + escapeHtml(stop.date) + '">'
                + '</div>'
                + '<div class="form-group">'
                + '<label>Distància</label>'
                + '<input type="text" class="edit-distance" value="' + escapeHtml(stop.distance) + '">'
                + '</div>'
                + '<div class="form-group">'
                + '<label>Origen</label>'
                + '<input type="text" class="edit-origin" value="' + escapeHtml(stop.origin) + '">'
                + '</div>'
                + '<div class="form-group">'
                + '<label>Destinació</label>'
                + '<input type="text" class="edit-destination" value="' + escapeHtml(stop.destination) + '">'
                + '</div>'
                + '<div class="form-group full-width">'
                + '<label>URL de la ruta</label>'
                + '<input type="url" class="edit-routeUrl" value="' + escapeHtml(stop.routeUrl) + '">'
                + '</div>'
                + '<div class="form-group">'
                + '<label>Hotel</label>'
                + '<input type="text" class="edit-hotelName" value="' + escapeHtml(stop.hotelName) + '">'
                + '</div>'
                + '<div class="form-group">'
                + '<label>URL Hotel</label>'
                + '<input type="url" class="edit-hotelUrl" value="' + escapeHtml(stop.hotelUrl) + '">'
                + '</div>'
                + '</div>'
                + '<div class="edit-actions">'
                + '<button type="button" class="btn-save save-edit-btn">💾 Desar</button>'
                + '<button type="button" class="btn-cancel cancel-edit-btn">Cancel·lar</button>'
                + '</div>'
                + '</div>';
        }

        return '<div class="stop-card" data-id="' + escapeHtml(stop.id) + '">'
            + '<span class="stop-number">' + (i + 1) + '</span>'
            + '<div class="stop-card-body">'
            + '<div class="stop-card-header">'
            + '<h2><span class="stop-date">' + escapeHtml(stop.date) + '</span> '
            + escapeHtml(stop.origin) + ' → ' + escapeHtml(stop.destination) + '</h2>'
            + '<div class="stop-card-actions">'
            + '<button class="move-up-btn" title="Moure amunt"'
            + (isFirst ? ' disabled' : '') + '>▲</button>'
            + '<button class="move-down-btn" title="Moure avall"'
            + (isLast ? ' disabled' : '') + '>▼</button>'
            + '<button class="edit-btn" title="Editar parada">✎</button>'
            + '<button class="delete-btn" title="Eliminar parada">✕</button>'
            + '</div>'
            + '</div>'
            + '<div class="stop-details">'
            + '<span class="detail-chip distance">📏 ' + escapeHtml(stop.distance) + '</span>'
            + extraChips
            + '</div>'
            + '<div class="stop-links">'
            + '<a class="route-link" target="_blank" rel="noopener" href="'
            + escapeHtml(stop.routeUrl) + '">🗺️ Veure ruta</a>'
            + '<a class="hotel-link" target="_blank" rel="noopener" href="'
            + escapeHtml(stop.hotelUrl) + '">🏨 ' + escapeHtml(stop.hotelName) + '</a>'
            + '</div>'
            + '</div>'
            + editFormHtml
            + '<div class="route-preview">'
            + '<button type="button" class="route-preview-toggle">'
            + '<span class="toggle-arrow">▼</span> Previsualització de la ruta'
            + '</button>'
            + '<div class="route-preview-frame" data-route-url="'
            + escapeHtml(stop.routeUrl) + '"></div>'
            + '</div>'
            + '</div>';
    }).join('');

    bindCardEvents();
}

// ── Card event binding ───────────────────────────────────────────────
function bindCardEvents() {
    const container = document.getElementById('stops-container');

    container.querySelectorAll('.delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const id = btn.closest('.stop-card').dataset.id;
            deleteStop(id);
        });
    });

    container.querySelectorAll('.edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const id = btn.closest('.stop-card').dataset.id;
            editingId = editingId === id ? null : id;
            renderStops();
        });
    });

    container.querySelectorAll('.move-up-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const id = btn.closest('.stop-card').dataset.id;
            moveStop(id, -1);
        });
    });

    container.querySelectorAll('.move-down-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const id = btn.closest('.stop-card').dataset.id;
            moveStop(id, 1);
        });
    });

    container.querySelectorAll('.save-edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const card = btn.closest('.stop-card');
            const id = card.dataset.id;
            updateStop(id, {
                date: card.querySelector('.edit-date').value.trim(),
                distance: card.querySelector('.edit-distance').value.trim(),
                origin: card.querySelector('.edit-origin').value.trim(),
                destination: card.querySelector('.edit-destination').value.trim(),
                routeUrl: card.querySelector('.edit-routeUrl').value.trim(),
                hotelName: card.querySelector('.edit-hotelName').value.trim(),
                hotelUrl: card.querySelector('.edit-hotelUrl').value.trim() || '#'
            });
        });
    });

    container.querySelectorAll('.cancel-edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            editingId = null;
            renderStops();
        });
    });

    container.querySelectorAll('.route-preview-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            btn.classList.toggle('open');
            const frame = btn.nextElementSibling;
            const isOpen = frame.classList.toggle('open');
            if (isOpen && !frame.dataset.loaded) {
                frame.dataset.loaded = 'true';
                const routeUrl = frame.dataset.routeUrl;
                const places = extractPlacesFromUrl(routeUrl);
                if (places.length >= 2) {
                    const origin = encodeURIComponent(places[0]);
                    const dest = encodeURIComponent(places[places.length - 1]);
                    const src = 'https://www.google.com/maps?q='
                        + origin + '+to+' + dest
                        + '&output=embed';
                    frame.innerHTML = '<iframe src="' + escapeHtml(src)
                        + '" allowfullscreen loading="lazy"'
                        + ' referrerpolicy="no-referrer-when-downgrade"></iframe>';
                } else {
                    frame.innerHTML = '<p style="padding:1rem;text-align:center;'
                        + 'color:#999;font-size:0.85rem;">'
                        + 'No es pot generar la previsualització.</p>';
                }
            }
        });
    });
}

// ── Collapsible add-form ─────────────────────────────────────────────
document.getElementById('form-toggle').addEventListener('click', function () {
    const body = document.getElementById('form-body');
    const icon = document.getElementById('form-toggle-icon');
    body.classList.toggle('open');
    icon.classList.toggle('open');
});

// ── Form submission ──────────────────────────────────────────────────
document.getElementById('add-stop-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const date = document.getElementById('f-date').value.trim();
    const origin = document.getElementById('f-origin').value.trim();
    const destination = document.getElementById('f-destination').value.trim();
    const routeUrl = document.getElementById('f-route-url').value.trim();
    const distance = document.getElementById('f-distance').value.trim();
    const hotelName = document.getElementById('f-hotel-name').value.trim();
    const hotelUrl = document.getElementById('f-hotel-url').value.trim();

    if (!date || !origin || !destination || !routeUrl || !distance || !hotelName) {
        alert('Si us plau, omple tots els camps obligatoris.');
        return;
    }

    addStop({
        id: 'stop-' + Date.now(),
        date: date,
        origin: origin,
        destination: destination,
        routeUrl: routeUrl,
        distance: distance,
        hotelName: hotelName,
        hotelUrl: hotelUrl || '#'
    });

    this.reset();
});

// ── Init ─────────────────────────────────────────────────────────────
function initApp() {
    const cached = loadStopsFromStorage();
    if (cached) {
        stops = cached;
        renderStops();
    }
    loadStopsFromFile().then(function (fileStops) {
        if (!cached) {
            stops = fileStops;
            saveStops(stops);
            renderStops();
        }
    }).catch(function () {
        if (!cached) {
            renderStops();
        }
    });
}

document.getElementById('export-btn').addEventListener('click', exportStops);

initApp();
