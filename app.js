// ── Default stops (preserved from original HTML) ──────────────────────
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

// ── Storage helpers ───────────────────────────────────────────────────
const STORAGE_KEY = 'roadTripPlanner_stops';

function loadStops() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveStops(stops) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
}

// ── Render ────────────────────────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderStops(stops) {
    const container = document.getElementById('stops-container');
    if (stops.length === 0) {
        container.innerHTML = '<p class="empty-state">No hi ha parades. Afegeix-ne una! 🚗</p>';
        return;
    }
    container.innerHTML = stops.map(stop => `
        <div class="stop-card" data-id="${escapeHtml(stop.id)}">
            <h2>${escapeHtml(stop.date)} ${escapeHtml(stop.origin)} - ${escapeHtml(stop.destination)}</h2>
            <div class="route-info">
                <a target="_blank" href="${escapeHtml(stop.routeUrl)}">🗺️ Ruta / Väg</a>
                <span class="distance-badge">${escapeHtml(stop.distance)}</span>
            </div>
            <h3>Hotel:</h3>
            <div class="hotel-link">
                <a target="_blank" href="${escapeHtml(stop.hotelUrl)}">🏨 ${escapeHtml(stop.hotelName)}</a>
            </div>
            <button class="delete-btn" title="Eliminar parada" aria-label="Eliminar parada">✕</button>
        </div>
    `).join('');

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.stop-card');
            const id = card.dataset.id;
            deleteStop(id);
        });
    });
}

// ── CRUD ──────────────────────────────────────────────────────────────
let stops = loadStops() || DEFAULT_STOPS.slice();

function deleteStop(id) {
    stops = stops.filter(s => s.id !== id);
    saveStops(stops);
    renderStops(stops);
}

function addStop(stop) {
    stops.push(stop);
    saveStops(stops);
    renderStops(stops);
}

// ── Form submission ───────────────────────────────────────────────────
document.getElementById('add-stop-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const date       = document.getElementById('f-date').value.trim();
    const origin     = document.getElementById('f-origin').value.trim();
    const destination = document.getElementById('f-destination').value.trim();
    const routeUrl   = document.getElementById('f-route-url').value.trim();
    const distance   = document.getElementById('f-distance').value.trim();
    const hotelName  = document.getElementById('f-hotel-name').value.trim();
    const hotelUrl   = document.getElementById('f-hotel-url').value.trim();

    if (!date || !origin || !destination || !routeUrl || !distance || !hotelName) {
        alert('Si us plau, omple tots els camps obligatoris.');
        return;
    }

    const newStop = {
        id: 'stop-' + Date.now(),
        date,
        origin,
        destination,
        routeUrl,
        distance,
        hotelName,
        hotelUrl: hotelUrl || '#'
    };

    addStop(newStop);
    this.reset();
});

// ── Init ──────────────────────────────────────────────────────────────
renderStops(stops);
