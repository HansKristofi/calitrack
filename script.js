// ── EXERCISES DATA ────────────────────────────────────────────────────────────
const EXERCISES = {
  'Pushing': [
    'Push-ups (regular)', 'Push-ups (diamond)', 'Push-ups (archer)',
    'Dips (bar)', 'Dips (ring)', 'Pike push-ups', 'Handstand push-ups', 'Planche'
  ],
  'Pulling': [
    'Pull-ups (wide)', 'Pull-ups (narrow)', 'Chin-ups',
    'Inverted rows', 'Muscle-ups', 'Front levers'
  ],
  'Legs': [
    'Bodyweight squats', 'Lunges', 'Pistol squats',
    'Calf raises', 'Glute bridges', 'Jump squats'
  ],
  'Core': [
    'Planks', 'Hanging leg raises', 'Hollow holds',
    'L-sits', 'Crunches', 'V-ups'
  ],
  'Skills': [
    'Handstands', 'Human flag', 'Front levers',
    'Back levers', 'Planche', 'L-sit hold'
  ],
  'Cardio': [
    'Burpees', 'Jumping jacks', 'Mountain climbers', 'Running'
  ]
};

const CAT_CLASS = {
  Pushing: 'cat-push',
  Pulling: 'cat-pull',
  Legs:    'cat-legs',
  Core:    'cat-core',
  Skills:  'cat-skills',
  Cardio:  'cat-cardio'
};

let pendingPhotos = [];   // base64 strings staged for current session
let currentView   = 'day';

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

function getWorkouts() {
  try { return JSON.parse(localStorage.getItem('cali_workouts') || '[]'); }
  catch { return []; }
}

function saveWorkouts(w) {
  localStorage.setItem('cali_workouts', JSON.stringify(w));
}

function showToast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = error ? 'var(--danger)' : 'var(--accent)';
  t.style.color      = error ? '#fff'           : '#0a0a0a';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── EXERCISE OPTIONS ──────────────────────────────────────────────────────────

function buildExerciseOptions() {
  let html = '<option value="">Select exercise...</option>';
  for (const [cat, exs] of Object.entries(EXERCISES)) {
    html += `<optgroup label="${cat}">`;
    exs.forEach(ex => {
      html += `<option value="${ex}" data-cat="${cat}">${ex}</option>`;
    });
    html += '</optgroup>';
  }
  return html;
}

// ── POST / FORM ───────────────────────────────────────────────────────────────

function addExerciseRow(data = {}) {
  const list = document.getElementById('exercise-list');
  const row  = document.createElement('div');
  row.className = 'exercise-row';
  row.innerHTML = `
    <div class="ex-fields">
      <div class="form-group">
        <label>Exercise</label>
        <select class="ex-select">${buildExerciseOptions()}</select>
      </div>
      <div class="form-group">
        <label>Sets</label>
        <input type="number" class="ex-sets" min="1" max="99"
               value="${data.sets || ''}" placeholder="3">
      </div>
      <div class="form-group">
        <label>Reps</label>
        <input type="number" class="ex-reps" min="1" max="999"
               value="${data.reps || ''}" placeholder="10">
      </div>
    </div>
    <button class="btn-remove" onclick="this.closest('.exercise-row').remove()">✕</button>
  `;
  list.appendChild(row);
  if (data.exercise) {
    row.querySelector('.ex-select').value = data.exercise;
  }
}

function handlePhotoUpload(event) {
  const files   = Array.from(event.target.files);
  const preview = document.getElementById('photo-preview');
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      pendingPhotos.push(e.target.result);
      const img   = document.createElement('img');
      img.src     = e.target.result;
      img.onclick = () => openLightbox(e.target.result);
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function saveWorkout() {
  const date = document.getElementById('workout-date').value;
  if (!date) { showToast('Please select a date!', true); return; }

  const rows      = document.querySelectorAll('.exercise-row');
  const exercises = [];

  rows.forEach(row => {
    const ex   = row.querySelector('.ex-select').value;
    const sets = row.querySelector('.ex-sets').value;
    const reps = row.querySelector('.ex-reps').value;
    if (ex) {
      let cat = '';
      for (const [c, exs] of Object.entries(EXERCISES)) {
        if (exs.includes(ex)) { cat = c; break; }
      }
      exercises.push({ exercise: ex, sets: sets || '—', reps: reps || '—', category: cat });
    }
  });

  if (exercises.length === 0) {
    showToast('Add at least one exercise!', true);
    return;
  }

  const notes    = document.getElementById('workout-notes').value;
  const workouts = getWorkouts();
  const existing = workouts.findIndex(w => w.date === date);
  const entry    = { date, notes, exercises, photos: [...pendingPhotos] };

  if (existing >= 0) {
    workouts[existing] = entry;
  } else {
    workouts.push(entry);
    workouts.sort((a, b) => b.date.localeCompare(a.date));
  }

  saveWorkouts(workouts);
  updateStats();
  showToast('Workout saved! 💪');
  clearForm();

  // Jump to history view for the saved date
  document.getElementById('history-date').value = date;
  renderHistory();
}

function clearForm() {
  document.getElementById('workout-date').value   = '';
  document.getElementById('workout-notes').value  = '';
  document.getElementById('exercise-list').innerHTML = '';
  document.getElementById('photo-preview').innerHTML = '';
  document.getElementById('photo-input').value       = '';
  pendingPhotos = [];
  addExerciseRow();
}

// ── STATS ─────────────────────────────────────────────────────────────────────

function updateStats() {
  const w = getWorkouts();

  document.getElementById('stat-total').textContent     = w.length;
  document.getElementById('stat-exercises').textContent =
    w.reduce((s, e) => s + e.exercises.length, 0);
  document.getElementById('stat-photos').textContent    =
    w.reduce((s, e) => s + (e.photos ? e.photos.length : 0), 0);

  // Day streak
  let streak = 0;
  const dates = new Set(w.map(e => e.date));
  const check = new Date();
  while (dates.has(fmtDate(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  document.getElementById('stat-streak').textContent = streak;
}

// ── HISTORY ───────────────────────────────────────────────────────────────────

function setView(v, btn) {
  currentView = v;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory();
}

function jumpToToday() {
  document.getElementById('history-date').value = fmtDate(new Date());
  renderHistory();
}

function renderHistory() {
  const dateVal  = document.getElementById('history-date').value;
  const workouts = getWorkouts();
  const container = document.getElementById('history-content');

  // No date selected — show everything
  if (!dateVal) {
    if (workouts.length === 0) {
      container.innerHTML = '<div class="history-empty">NO WORKOUTS LOGGED YET.<br>START TRAINING.</div>';
      return;
    }
    renderDays(workouts, container);
    return;
  }

  const d = new Date(dateVal + 'T12:00:00');

  if (currentView === 'day') {
    const entries = workouts.filter(w => w.date === dateVal);
    if (entries.length === 0) {
      container.innerHTML = '<div class="history-empty">NO WORKOUT ON THIS DAY.</div>';
      return;
    }
    renderDays(entries, container);

  } else if (currentView === 'week') {
    const day    = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const entries = workouts.filter(w =>
      w.date >= fmtDate(monday) && w.date <= fmtDate(sunday)
    );
    if (entries.length === 0) {
      container.innerHTML = '<div class="history-empty">NO WORKOUTS THIS WEEK.</div>';
      return;
    }
    const label = `Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    container.innerHTML = `<div class="week-header">${label}</div>`;
    renderDays(entries, container, true);

  } else if (currentView === 'month') {
    const year  = d.getFullYear();
    const month = d.getMonth();
    const entries = workouts.filter(w => {
      const wd = new Date(w.date + 'T12:00:00');
      return wd.getFullYear() === year && wd.getMonth() === month;
    });
    if (entries.length === 0) {
      container.innerHTML = '<div class="history-empty">NO WORKOUTS THIS MONTH.</div>';
      return;
    }

    // Group by week
    container.innerHTML = '';
    const weeks = {};
    entries.forEach(w => {
      const wd  = new Date(w.date + 'T12:00:00');
      const day = wd.getDay();
      const mon = new Date(wd);
      mon.setDate(wd.getDate() - (day === 0 ? 6 : day - 1));
      const key = fmtDate(mon);
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(w);
    });

    for (const [weekStart, wEntries] of Object.entries(weeks)) {
      const ws = new Date(weekStart + 'T12:00:00');
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);

      const header = document.createElement('div');
      header.className   = 'week-header';
      header.textContent = `Week of ${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      container.appendChild(header);
      renderDays(wEntries, container, true);
    }
  }
}

function renderDays(entries, container, append = false) {
  if (!append) container.innerHTML = '';

  entries.forEach(entry => {
    const d     = new Date(entry.date + 'T12:00:00');
    const block = document.createElement('div');
    block.className = 'day-block';

    const tableRows = entry.exercises.map(e => `
      <tr>
        <td><span class="cat-badge ${CAT_CLASS[e.category] || ''}">${e.category}</span></td>
        <td>${e.exercise}</td>
        <td class="td-sets">${e.sets}</td>
        <td class="td-reps">${e.reps}</td>
      </tr>
    `).join('');

    let photosHtml = '';
    if (entry.photos && entry.photos.length > 0) {
      const imgs = entry.photos.map(p =>
        `<img src="${p}" onclick="openLightbox('${p.replace(/'/g, "\\'")}')">`
      ).join('');
      photosHtml = `
        <div class="day-photos">
          <div class="day-photos-label">Progress Photos</div>
          <div class="day-photos-grid">${imgs}</div>
        </div>`;
    }

    block.innerHTML = `
      <div class="day-header">
        <div class="day-date">${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div class="day-meta">${entry.exercises.length} exercise${entry.exercises.length !== 1 ? 's' : ''}${entry.notes ? ' · ' + entry.notes : ''}</div>
      </div>
      <table class="exercises-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Exercise</th>
            <th>Sets</th>
            <th>Reps</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${photosHtml}
    `;
    container.appendChild(block);
  });
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────────────

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

// ── NAV ACTIVE ────────────────────────────────────────────────────────────────

function setActive(link) {
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const today = fmtDate(new Date());
  document.getElementById('workout-date').value  = today;
  document.getElementById('history-date').value  = today;

  addExerciseRow();
  updateStats();
  renderHistory();

  // Highlight nav link based on scroll position
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        document.querySelectorAll('.nav-links a').forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));
});
