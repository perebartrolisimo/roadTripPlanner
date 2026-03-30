// ── Default stops ─────────────────────────────────────────────────────
const DEFAULT_STOPS = [
    {
        id: 'default-1',
        date: '29 de juny',
        origin: 'Uppsala (SE)',
        destination: 'Lund (SE)',
        routeUrl: 'https://www.google.com/maps/dir/Kronparksv%C3%A4gen+15,+757+52+Uppsala/Motel+L+Lund,+Telefongatan+14,+224+81+Lund/@57.770648,12.7658852,710140m/data=!3m2!1e3!4b1!4m14!4m13!1m5!1m1!1s0x465fc910f98e112f:0x94bb25986a02327c!2m2!1d17.6946894!2d59.823451!1m5!1m1!1s0x465397562aeaa465:0xa0510b0158027651!2m2!1d13.2294099!2d55.7174207!3e0?entry=ttu&g_ep=EgoyMDI2MDMyNC4wIKXMDSoASAFQAw%3D%3D',
        distance: '670 km',
        hotelName: 'Hotel L',
        hotelUrl: 'https://ligula.se/sv/motel-l/motel-l-lund/'
    },
    {
        id: 'default-2',
        date: '30 de juny',
        origin: 'Lund (SE)',
        destination: 'Oldenburg (DE)',
        routeUrl: 'https://www.google.com/maps/dir/Kronparksv%C3%A4gen+15,+757+52+Uppsala/Motel+L+Lund,+Telefongatan+14,+224+81+Lund/@57.770648,12.7658852,710140m/data=!3m2!1e3!4b1!4m14!4m13!1m5!1m1!1s0x465fc910f98e112f:0x94bb25986a02327c!2m2!1d17.6946894!2d59.823451!1m5!1m1!1s0x465397562aeaa465:0xa0510b0158027651!2m2!1d13.2294099!2d55.7174207!3e0?entry=ttu&g_ep=EgoyMDI2MDMyNC4wIKXMDSoASAFQAw%3D%3D',
        distance: '670 km',
        hotelName: 'Casa Mike',
        hotelUrl: 'https://www.google.se/maps/place/Klockarev%C3%A4gen+123,+233+41+Svedala/@55.5155568,13.2224448,687m/data=!3m2!1e3!4b1!4m6!3m5!1s0x46539ddc1b228b53:0x4d26d07fac694fba!8m2!3d55.5155538!4d13.2250197!16s%2Fg%2F11crsx3z7j?entry=ttu'
    }
];

// ── Storage ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'roadTripPlanner_stops';

function loadStops() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
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
let stops = loadStops() || DEFAULT_STOPS.slice();
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
renderStops();
