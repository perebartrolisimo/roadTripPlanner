// ── GitHub Settings ──────────────────────────────────────────────────
const SETTINGS_KEY = 'roadTripPlanner_settings';
const GITHUB_SAVE_DEBOUNCE_MS = 1000;
// Approximate factor to convert straight-line distance to road distance
const ROAD_DISTANCE_FACTOR = 1.3;

function loadSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (_) {
        return {};
    }
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

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

function saveStops(list, skipGitHub) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (!skipGitHub) persistToGitHub();
}

// ── GitHub Persistence ───────────────────────────────────────────────
let githubSaveTimeout = null;

function persistToGitHub() {
    if (githubSaveTimeout) clearTimeout(githubSaveTimeout);
    githubSaveTimeout = setTimeout(doGitHubSave, GITHUB_SAVE_DEBOUNCE_MS);
}

function utf8ToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
        return String.fromCharCode(parseInt(p1, 16));
    }));
}

async function doGitHubSave() {
    const settings = loadSettings();
    if (!settings.token || !settings.owner || !settings.repo) {
        updateSyncStatus('no-config');
        return;
    }

    updateSyncStatus('saving');

    try {
        const branch = settings.branch || 'main';
        const apiBase = 'https://api.github.com/repos/'
            + encodeURIComponent(settings.owner) + '/'
            + encodeURIComponent(settings.repo);

        const getRes = await fetch(
            apiBase + '/contents/stops.json?ref=' + encodeURIComponent(branch),
            { headers: { 'Authorization': 'token ' + settings.token } }
        );

        let sha = null;
        if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
        }

        const jsonContent = JSON.stringify(stops, null, 4) + '\n';
        const content = utf8ToBase64(jsonContent);
        const body = {
            message: 'Update stops data',
            content: content,
            branch: branch
        };
        if (sha) body.sha = sha;

        const putRes = await fetch(apiBase + '/contents/stops.json', {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + settings.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (putRes.ok) {
            updateSyncStatus('saved');
        } else {
            updateSyncStatus('error');
        }
    } catch (_) {
        updateSyncStatus('error');
    }
}

function updateSyncStatus(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;

    const labels = {
        'no-config': '⚙️ Configura GitHub',
        'saving': '🔄 Desant…',
        'saved': '✅ Desat a GitHub',
        'error': '❌ Error al desar'
    };

    el.textContent = labels[status] || '';
    el.className = 'sync-status ' + status;
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

function extractWaypointCoords(url) {
    if (!url) return [];
    const coords = [];
    const regex = /!1d(-?[\d.]+)!2d(-?[\d.]+)/g;
    let match;
    while ((match = regex.exec(url)) !== null) {
        coords.push({ lat: parseFloat(match[2]), lng: parseFloat(match[1]) });
    }
    return coords;
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

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function deriveStopInfo(routeUrl) {
    const places = extractPlacesFromUrl(routeUrl);
    const waypoints = extractWaypointCoords(routeUrl);

    const origin = places.length > 0 ? places[0] : '';
    const destination = places.length > 1 ? places[places.length - 1] : '';

    let distance = '';
    if (waypoints.length >= 2) {
        const first = waypoints[0];
        const last = waypoints[waypoints.length - 1];
        const km = haversineDistance(first.lat, first.lng, last.lat, last.lng);
        distance = '~' + (Math.round(km * ROAD_DISTANCE_FACTOR / 10) * 10) + ' km';
    }

    return { origin: origin, destination: destination, distance: distance };
}

// ── State ────────────────────────────────────────────────────────────
let stops = [];
let editingId = null;
const leafletMaps = {};

// ── CRUD ─────────────────────────────────────────────────────────────
function deleteStop(id) {
    stops = stops.filter(s => s.id !== id);
    if (leafletMaps[id]) { leafletMaps[id].remove(); delete leafletMaps[id]; }
    saveStops(stops);
    renderStops();
}

function addStop(stop) {
    const derived = deriveStopInfo(stop.routeUrl);
    stop.origin = derived.origin;
    stop.destination = derived.destination;
    stop.distance = derived.distance;
    stops.push(stop);
    saveStops(stops);
    renderStops();
}

function updateStop(id, data) {
    const idx = stops.findIndex(s => s.id === id);
    if (idx === -1) return;
    if (data.routeUrl) {
        const derived = deriveStopInfo(data.routeUrl);
        data.origin = derived.origin;
        data.destination = derived.destination;
        data.distance = derived.distance;
    }
    stops[idx] = { ...stops[idx], ...data };
    if (leafletMaps[id]) { leafletMaps[id].remove(); delete leafletMaps[id]; }
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
            + '<div class="route-preview-frame" data-stop-id="'
            + escapeHtml(stop.id) + '" data-route-url="'
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
            const stopId = frame.dataset.stopId;

            if (isOpen && !frame.dataset.loaded) {
                frame.dataset.loaded = 'true';
                const routeUrl = frame.dataset.routeUrl;
                const waypoints = extractWaypointCoords(routeUrl);

                if (waypoints.length >= 2) {
                    const mapDiv = document.createElement('div');
                    mapDiv.id = 'map-' + stopId;
                    mapDiv.style.width = '100%';
                    mapDiv.style.height = '100%';
                    frame.appendChild(mapDiv);

                    const map = L.map(mapDiv.id);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    }).addTo(map);

                    waypoints.forEach(function (w) {
                        L.marker([w.lat, w.lng]).addTo(map);
                    });

                    const line = L.polyline(
                        waypoints.map(function (w) { return [w.lat, w.lng]; }),
                        { color: '#5b5ea6', weight: 3 }
                    ).addTo(map);

                    map.fitBounds(line.getBounds().pad(0.15));
                    leafletMaps[stopId] = map;
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
    const routeUrl = document.getElementById('f-route-url').value.trim();
    const hotelName = document.getElementById('f-hotel-name').value.trim();
    const hotelUrl = document.getElementById('f-hotel-url').value.trim();

    if (!date || !routeUrl || !hotelName) {
        alert('Si us plau, omple tots els camps obligatoris.');
        return;
    }

    addStop({
        id: 'stop-' + Date.now(),
        date: date,
        routeUrl: routeUrl,
        hotelName: hotelName,
        hotelUrl: hotelUrl || '#'
    });

    this.reset();
});

// ── Settings ─────────────────────────────────────────────────────────
document.getElementById('settings-toggle').addEventListener('click', function () {
    const body = document.getElementById('settings-body');
    const icon = document.getElementById('settings-toggle-icon');
    body.classList.toggle('open');
    icon.classList.toggle('open');
});

document.getElementById('save-settings-btn').addEventListener('click', function () {
    const settings = {
        owner: document.getElementById('s-owner').value.trim(),
        repo: document.getElementById('s-repo').value.trim(),
        branch: document.getElementById('s-branch').value.trim() || 'main',
        token: document.getElementById('s-token').value.trim()
    };
    saveSettings(settings);
    persistToGitHub();
});

function populateSettings() {
    const settings = loadSettings();
    document.getElementById('s-owner').value = settings.owner || '';
    document.getElementById('s-repo').value = settings.repo || '';
    document.getElementById('s-branch').value = settings.branch || '';
    document.getElementById('s-token').value = settings.token || '';
}

// ── Init ─────────────────────────────────────────────────────────────
function initApp() {
    populateSettings();

    const cached = loadStopsFromStorage();
    if (cached) {
        stops = cached;
        renderStops();
    }
    loadStopsFromFile().then(function (fileStops) {
        if (!cached) {
            stops = fileStops;
            saveStops(stops, true);
            renderStops();
        }
    }).catch(function () {
        if (!cached) {
            renderStops();
        }
    });

    const settings = loadSettings();
    if (!settings.token || !settings.owner || !settings.repo) {
        updateSyncStatus('no-config');
    }
}

initApp();
