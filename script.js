// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://bvcaupkcwveyuisxignj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Y2F1cGtjd3ZleXVpc3hpZ25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODMxODEsImV4cCI6MjA4ODA1OTE4MX0.xgQqTqmYDO64zrLC5hbJua1wIj2SY6u6unvoH5992Tk';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  Pushing: 'cat-push', Pulling: 'cat-pull', Legs: 'cat-legs',
  Core: 'cat-core', Skills: 'cat-skills', Cardio: 'cat-cardio'
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser   = null;
let pendingPhotos = []; // { file, previewUrl } — staged before save
let currentView   = 'day';

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().split('T')[0]; }

function showToast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent      = msg;
  t.style.background = error ? 'var(--danger)' : 'var(--accent)';
  t.style.color      = error ? '#fff'           : '#0a0a0a';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

function setSaveLoading(loading) {
  const btn = document.getElementById('save-btn');
  btn.disabled    = loading;
  btn.textContent = loading ? 'Saving...' : 'Save Workout';
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-login').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('auth-signup').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('auth-error').textContent = '';
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  showLoading(true);
  const { error } = await db.auth.signInWithPassword({ email, password });
  showLoading(false);

  if (error) { errEl.textContent = error.message; }
}

async function handleSignup() {
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

  showLoading(true);
  const { error } = await db.auth.signUp({ email, password });
  showLoading(false);

  if (error) {
    errEl.textContent = error.message;
  } else {
    errEl.style.color = 'var(--accent)';
    errEl.textContent = 'Account created! Check your email to confirm, then sign in.';
  }
}

async function handleSignout() {
  await db.auth.signOut();
  currentUser = null;
  document.getElementById('app').style.display         = 'none';
  document.getElementById('auth-screen').style.display = '';
}

// Listen for auth state changes
db.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await bootApp();
  } else {
    showLoading(false);
    document.getElementById('app').style.display         = 'none';
    document.getElementById('auth-screen').style.display = '';
  }
});

async function bootApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display         = '';
  document.getElementById('nav-email').textContent     = currentUser.email;

  const today = fmtDate(new Date());
  document.getElementById('workout-date').value  = today;
  document.getElementById('history-date').value  = today;

  if (document.getElementById('exercise-list').children.length === 0) {
    addExerciseRow();
  }

  await updateStats();
  await renderHistory();
  showLoading(false);
}

// ── EXERCISE OPTIONS ──────────────────────────────────────────────────────────
function buildExerciseOptions() {
  let html = '<option value="">Select exercise...</option>';
  for (const [cat, exs] of Object.entries(EXERCISES)) {
    html += `<optgroup label="${cat}">`;
    exs.forEach(ex => { html += `<option value="${ex}" data-cat="${cat}">${ex}</option>`; });
    html += '</optgroup>';
  }
  return html;
}

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
        <input type="number" class="ex-sets" min="1" max="99" value="${data.sets || ''}" placeholder="3">
      </div>
      <div class="form-group">
        <label>Reps</label>
        <input type="number" class="ex-reps" min="1" max="999" value="${data.reps || ''}" placeholder="10">
      </div>
    </div>
    <button class="btn-remove" onclick="this.closest('.exercise-row').remove()">✕</button>
  `;
  list.appendChild(row);
  if (data.exercise) row.querySelector('.ex-select').value = data.exercise;
}

// ── PHOTO HANDLING ────────────────────────────────────────────────────────────
function handlePhotoUpload(event) {
  const files   = Array.from(event.target.files);
  const preview = document.getElementById('photo-preview');
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    pendingPhotos.push({ file, previewUrl: url });
    const img   = document.createElement('img');
    img.src     = url;
    img.onclick = () => openLightbox(url);
    preview.appendChild(img);
  });
}

// Upload a single photo file to Supabase Storage, returns public URL
async function uploadPhoto(file, workoutDate) {
  const ext      = file.name.split('.').pop();
  const filename = `${currentUser.id}/${workoutDate}/${Date.now()}.${ext}`;
  const { data, error } = await db.storage.from('photos').upload(filename, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) { console.error('Photo upload error:', error); return null; }
  const { data: urlData } = db.storage.from('photos').getPublicUrl(filename);
  return urlData.publicUrl;
}

// ── SAVE WORKOUT ──────────────────────────────────────────────────────────────
async function saveWorkout() {
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
      for (const [c, exs] of Object.entries(EXERCISES)) { if (exs.includes(ex)) { cat = c; break; } }
      exercises.push({ exercise: ex, sets: sets || '—', reps: reps || '—', category: cat });
    }
  });

  if (exercises.length === 0) { showToast('Add at least one exercise!', true); return; }

  const notes = document.getElementById('workout-notes').value;
  setSaveLoading(true);

  try {
    // Check if workout for this date already exists
    const { data: existing } = await db
      .from('workouts')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('date', date)
      .maybeSingle();

    let workoutId;

    if (existing) {
      // Update existing workout
      workoutId = existing.id;
      await db.from('workouts').update({ notes }).eq('id', workoutId);
      // Delete old exercises and re-insert
      await db.from('exercises').delete().eq('workout_id', workoutId);
    } else {
      // Insert new workout
      const { data: newWorkout, error: wErr } = await db
        .from('workouts')
        .insert({ user_id: currentUser.id, date, notes })
        .select()
        .single();
      if (wErr) throw wErr;
      workoutId = newWorkout.id;
    }

    // Insert exercises
    const exRows = exercises.map(e => ({ ...e, workout_id: workoutId }));
    const { error: exErr } = await db.from('exercises').insert(exRows);
    if (exErr) throw exErr;

    // Upload photos to Supabase Storage
    if (pendingPhotos.length > 0) {
      // Delete old photos for this workout if updating
      if (existing) {
        const { data: oldPhotos } = await db
          .from('photos')
          .select('storage_path')
          .eq('workout_id', workoutId);
        if (oldPhotos && oldPhotos.length > 0) {
          const paths = oldPhotos.map(p => p.storage_path);
          await db.storage.from('photos').remove(paths);
          await db.from('photos').delete().eq('workout_id', workoutId);
        }
      }

      for (const { file } of pendingPhotos) {
        const ext      = file.name.split('.').pop();
        const storagePath = `${currentUser.id}/${workoutId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await db.storage.from('photos').upload(storagePath, file);
        if (upErr) { console.error('Photo upload error:', upErr); continue; }
        const { data: urlData } = db.storage.from('photos').getPublicUrl(storagePath);
        await db.from('photos').insert({
          workout_id:   workoutId,
          storage_path: storagePath,
          public_url:   urlData.publicUrl
        });
      }
    }

    showToast('Workout saved! 💪');
    clearForm();
    document.getElementById('history-date').value = date;
    await updateStats();
    await renderHistory();

  } catch (err) {
    console.error(err);
    showToast('Error saving workout. Try again.', true);
  }

  setSaveLoading(false);
}

function clearForm() {
  document.getElementById('workout-date').value      = fmtDate(new Date());
  document.getElementById('workout-notes').value     = '';
  document.getElementById('exercise-list').innerHTML = '';
  document.getElementById('photo-preview').innerHTML = '';
  document.getElementById('photo-input').value       = '';
  pendingPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
  pendingPhotos = [];
  addExerciseRow();
}

// ── STATS ─────────────────────────────────────────────────────────────────────
async function updateStats() {
  const { data: workouts } = await db
    .from('workouts')
    .select('id, date')
    .eq('user_id', currentUser.id);

  if (!workouts) return;

  document.getElementById('stat-total').textContent = workouts.length;

  const { count: exCount } = await db
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .in('workout_id', workouts.map(w => w.id));
  document.getElementById('stat-exercises').textContent = exCount || 0;

  const { count: photoCount } = await db
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .in('workout_id', workouts.map(w => w.id));
  document.getElementById('stat-photos').textContent = photoCount || 0;

  // Streak
  const dates = new Set(workouts.map(w => w.date));
  let streak = 0;
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

async function renderHistory() {
  const dateVal   = document.getElementById('history-date').value;
  const container = document.getElementById('history-content');
  container.innerHTML = '<div class="history-empty">Loading...</div>';

  let startDate, endDate;

  if (!dateVal) {
    // Show all
    startDate = '2000-01-01';
    endDate   = '2099-12-31';
  } else {
    const d = new Date(dateVal + 'T12:00:00');

    if (currentView === 'day') {
      startDate = endDate = dateVal;
    } else if (currentView === 'week') {
      const day    = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = fmtDate(monday);
      endDate   = fmtDate(sunday);
    } else if (currentView === 'month') {
      const year  = d.getFullYear();
      const month = d.getMonth();
      startDate = fmtDate(new Date(year, month, 1));
      endDate   = fmtDate(new Date(year, month + 1, 0));
    }
  }

  // Fetch workouts in range
  const { data: workouts, error } = await db
    .from('workouts')
    .select('id, date, notes')
    .eq('user_id', currentUser.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error || !workouts || workouts.length === 0) {
    container.innerHTML = '<div class="history-empty">NO WORKOUTS FOUND.</div>';
    return;
  }

  // Fetch exercises and photos for all these workouts
  const ids = workouts.map(w => w.id);

  const { data: exercises } = await db
    .from('exercises')
    .select('*')
    .in('workout_id', ids);

  const { data: photos } = await db
    .from('photos')
    .select('*')
    .in('workout_id', ids);

  // Group exercises and photos by workout_id
  const exByWorkout    = {};
  const photosByWorkout = {};
  (exercises || []).forEach(e => {
    if (!exByWorkout[e.workout_id]) exByWorkout[e.workout_id] = [];
    exByWorkout[e.workout_id].push(e);
  });
  (photos || []).forEach(p => {
    if (!photosByWorkout[p.workout_id]) photosByWorkout[p.workout_id] = [];
    photosByWorkout[p.workout_id].push(p);
  });

  // Build enriched workout objects
  const enriched = workouts.map(w => ({
    ...w,
    exercises: exByWorkout[w.id]    || [],
    photos:    photosByWorkout[w.id] || []
  }));

  container.innerHTML = '';

  if (currentView === 'month' && dateVal) {
    // Group by week for month view
    const weeks = {};
    enriched.forEach(w => {
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
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      const header = document.createElement('div');
      header.className   = 'week-header';
      header.textContent = `Week of ${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      container.appendChild(header);
      renderDays(wEntries, container, true);
    }
  } else if (currentView === 'week' && dateVal) {
    const d      = new Date(dateVal + 'T12:00:00');
    const day    = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    container.innerHTML = `<div class="week-header">Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>`;
    renderDays(enriched, container, true);
  } else {
    renderDays(enriched, container);
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
        `<img src="${p.public_url}" onclick="openLightbox('${p.public_url.replace(/'/g, "\\'")}')" loading="lazy">`
      ).join('');
      photosHtml = `
        <div class="day-photos">
          <div class="day-photos-label">Progress Photos</div>
          <div class="day-photos-grid">${imgs}</div>
        </div>`;
    }

    block.innerHTML = `
      <div class="day-header">
        <div>
          <div class="day-date">${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div class="day-meta">${entry.exercises.length} exercise${entry.exercises.length !== 1 ? 's' : ''}${entry.notes ? ' · ' + entry.notes : ''}</div>
        </div>
        <button class="btn-delete-workout" onclick="deleteWorkout('${entry.id}', this)">Delete</button>
      </div>
      <table class="exercises-table">
        <thead><tr><th>Category</th><th>Exercise</th><th>Sets</th><th>Reps</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${photosHtml}
    `;
    container.appendChild(block);
  });
}

// ── DELETE WORKOUT ────────────────────────────────────────────────────────────
async function deleteWorkout(workoutId, btn) {
  if (!confirm('Delete this workout? This cannot be undone.')) return;

  btn.disabled     = true;
  btn.textContent  = 'Deleting...';

  try {
    // Delete photos from storage first
    const { data: photos } = await db
      .from('photos')
      .select('storage_path')
      .eq('workout_id', workoutId);

    if (photos && photos.length > 0) {
      const paths = photos.map(p => p.storage_path);
      await db.storage.from('photos').remove(paths);
    }

    // Delete workout (exercises + photos rows cascade automatically)
    const { error } = await db
      .from('workouts')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    // Animate block out then re-render
    const block = btn.closest('.day-block');
    block.style.transition = 'opacity 0.3s, transform 0.3s';
    block.style.opacity    = '0';
    block.style.transform  = 'translateY(-8px)';
    setTimeout(async () => {
      await updateStats();
      await renderHistory();
    }, 300);

    showToast('Workout deleted.');
  } catch (err) {
    console.error(err);
    showToast('Error deleting workout.', true);
    btn.disabled    = false;
    btn.textContent = 'Delete';
  }
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────────────
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function setActive(link) {
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Loading overlay shows by default; bootApp() hides it after auth check
  // onAuthStateChange handles everything

  // Scroll-based nav highlighting
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
