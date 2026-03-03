// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://bvcaupkcwveyuisxignj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Y2F1cGtjd3ZleXVpc3hpZ25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODMxODEsImV4cCI6MjA4ODA1OTE4MX0.xgQqTqmYDO64zrLC5hbJua1wIj2SY6u6unvoH5992Tk';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── EXERCISES DATA ────────────────────────────────────────────────────────────
const EXERCISES = {
  'Pushing': ['Push-ups (regular)','Push-ups (diamond)','Push-ups (archer)','Dips (bar)','Dips (ring)','Pike push-ups','Handstand push-ups','Planche'],
  'Pulling': ['Pull-ups (wide)','Pull-ups (narrow)','Chin-ups','Inverted rows','Muscle-ups','Front levers'],
  'Legs':    ['Bodyweight squats','Lunges','Pistol squats','Calf raises','Glute bridges','Jump squats'],
  'Core':    ['Planks','Hanging leg raises','Hollow holds','L-sits','Crunches','V-ups'],
  'Skills':  ['Handstands','Human flag','Front levers','Back levers','Planche','L-sit hold'],
  'Cardio':  ['Burpees','Jumping jacks','Mountain climbers','Running']
};
const CAT_CLASS = { Pushing:'cat-push', Pulling:'cat-pull', Legs:'cat-legs', Core:'cat-core', Skills:'cat-skills', Cardio:'cat-cardio' };

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser   = null;
let pendingPhotos = [];
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

// ── MOBILE MENU ───────────────────────────────────────────────────────────────
function toggleMobileMenu() {
  const menu    = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const burger  = document.getElementById('hamburger');
  const isOpen  = menu.classList.contains('open');
  menu.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  burger.classList.toggle('open', !isOpen);
}
function closeMobileMenu() {
  document.getElementById('mobile-menu').classList.remove('open');
  document.getElementById('mobile-menu-overlay').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── VIEW SWITCHING ────────────────────────────────────────────────────────────
function showMyProfile() {
  document.getElementById('my-profile-view').style.display     = '';
  document.getElementById('community-view').style.display      = 'none';
  document.getElementById('public-profile-view').style.display = 'none';
}

function showCommunity() {
  document.getElementById('my-profile-view').style.display     = 'none';
  document.getElementById('community-view').style.display      = '';
  document.getElementById('public-profile-view').style.display = 'none';
  loadCommunity();
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPublicProfile(userId, username) {
  document.getElementById('my-profile-view').style.display     = 'none';
  document.getElementById('community-view').style.display      = 'none';
  document.getElementById('public-profile-view').style.display = '';
  loadPublicProfile(userId, username);
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (error) { showLoading(false); errEl.textContent = error.message; }
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';
  if (!username || !email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  showLoading(true);
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { username } }
  });
  showLoading(false);
  if (error) {
    errEl.textContent = error.message;
  } else {
    // Insert into profiles table
    if (data.user) {
      await db.from('profiles').upsert({ id: data.user.id, username, email });
    }
    errEl.style.color  = 'var(--accent)';
    errEl.textContent  = 'Account created! You can now sign in.';
  }
}

async function handleSignout() {
  try {
    await db.auth.signOut();
  } catch (err) {
    console.warn('Signout error:', err);
  }
  // Force clear regardless of whether signOut succeeded
  currentUser = null;
  closeMobileMenu();
  document.getElementById('app').style.display         = 'none';
  document.getElementById('auth-screen').style.display = '';
  // Clear any cached auth from localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sb-')) localStorage.removeItem(key);
  });
  // Clear login fields
  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
  document.getElementById('auth-error').textContent = '';
}

db.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await bootApp();
  } else {
    currentUser = null;
    showLoading(false);
    document.getElementById('app').style.display         = 'none';
    document.getElementById('auth-screen').style.display = '';
  }
});

// Fallback: if Supabase never fires onAuthStateChange (e.g. network issues),
// hide the loader after 5s so the user isn't stuck on a blank screen
setTimeout(() => {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay.classList.contains('hidden')) {
    showLoading(false);
    document.getElementById('auth-screen').style.display = '';
  }
}, 5000);

async function bootApp() {
  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];

  // Show the app immediately
  document.getElementById('auth-screen').style.display      = 'none';
  document.getElementById('app').style.display              = '';
  document.getElementById('nav-username').textContent       = username;
  document.getElementById('mobile-menu-user').textContent   = username;
  showLoading(false);

  const today = fmtDate(new Date());
  document.getElementById('workout-date').value = today;
  document.getElementById('history-date').value = today;

  if (document.getElementById('exercise-list').children.length === 0) addExerciseRow();
  showMyProfile();

  // Upsert profile in background
  db.from('profiles').upsert({
    id: currentUser.id,
    username,
    email: currentUser.email
  }, { onConflict: 'id' }).then(({ error }) => {
    if (error) console.warn('Profile upsert error:', error.message);
  });

  // Load data
  await updateStats();
  await renderHistory();
}

// ── EXERCISE OPTIONS ──────────────────────────────────────────────────────────
function buildExerciseOptions() {
  let html = '<option value="">Select exercise...</option>';
  for (const [cat, exs] of Object.entries(EXERCISES)) {
    html += `<optgroup label="${cat}">`;
    exs.forEach(ex => { html += `<option value="${ex}">${ex}</option>`; });
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
        <input type="number" class="ex-sets" min="1" max="99" value="${data.sets||''}" placeholder="3">
      </div>
      <div class="form-group">
        <label>Reps</label>
        <input type="number" class="ex-reps" min="1" max="999" value="${data.reps||''}" placeholder="10">
      </div>
    </div>
    <button class="btn-remove" onclick="this.closest('.exercise-row').remove()">✕</button>
  `;
  list.appendChild(row);
  if (data.exercise) row.querySelector('.ex-select').value = data.exercise;
}

// ── PHOTOS ────────────────────────────────────────────────────────────────────
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
    const { data: existing } = await db.from('workouts').select('id').eq('user_id', currentUser.id).eq('date', date).maybeSingle();
    let workoutId;

    if (existing) {
      workoutId = existing.id;
      await db.from('workouts').update({ notes }).eq('id', workoutId);
      await db.from('exercises').delete().eq('workout_id', workoutId);
    } else {
      const { data: newW, error: wErr } = await db.from('workouts').insert({ user_id: currentUser.id, date, notes }).select().single();
      if (wErr) throw wErr;
      workoutId = newW.id;
    }

    await db.from('exercises').insert(exercises.map(e => ({ ...e, workout_id: workoutId })));

    if (pendingPhotos.length > 0) {
      if (existing) {
        const { data: oldPhotos } = await db.from('photos').select('storage_path').eq('workout_id', workoutId);
        if (oldPhotos?.length) {
          await db.storage.from('photos').remove(oldPhotos.map(p => p.storage_path));
          await db.from('photos').delete().eq('workout_id', workoutId);
        }
      }
      for (const { file } of pendingPhotos) {
        const ext  = file.name.split('.').pop();
        const path = `${currentUser.id}/${workoutId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await db.storage.from('photos').upload(path, file);
        if (upErr) { console.error('Photo upload error:', upErr); continue; }
        const { data: urlData } = db.storage.from('photos').getPublicUrl(path);
        await db.from('photos').insert({ workout_id: workoutId, storage_path: path, public_url: urlData.publicUrl });
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

// ── DELETE WORKOUT ────────────────────────────────────────────────────────────
async function deleteWorkout(workoutId, btn) {
  if (!confirm('Delete this workout? This cannot be undone.')) return;
  btn.disabled = true; btn.textContent = 'Deleting...';
  try {
    const { data: photos } = await db.from('photos').select('storage_path').eq('workout_id', workoutId);
    if (photos?.length) await db.storage.from('photos').remove(photos.map(p => p.storage_path));
    const { error } = await db.from('workouts').delete().eq('id', workoutId).eq('user_id', currentUser.id);
    if (error) throw error;
    const block = btn.closest('.day-block');
    block.style.transition = 'opacity 0.3s, transform 0.3s';
    block.style.opacity    = '0';
    block.style.transform  = 'translateY(-8px)';
    setTimeout(async () => { await updateStats(); await renderHistory(); }, 300);
    showToast('Workout deleted.');
  } catch (err) {
    console.error(err);
    showToast('Error deleting workout.', true);
    btn.disabled = false; btn.textContent = 'Delete';
  }
}

// ── STATS ─────────────────────────────────────────────────────────────────────
async function updateStats() {
  await renderStatsForUser(currentUser.id, 'stat-total', 'stat-exercises', 'stat-photos', 'stat-streak');
}

async function renderStatsForUser(userId, totalId, exId, photoId, streakId) {
  const { data: workouts } = await db.from('workouts').select('id, date').eq('user_id', userId);
  if (!workouts) return;

  document.getElementById(totalId).textContent = workouts.length;

  if (workouts.length > 0) {
    const ids = workouts.map(w => w.id);
    const { count: exCount }    = await db.from('exercises').select('id', { count: 'exact', head: true }).in('workout_id', ids);
    const { count: photoCount } = await db.from('photos').select('id', { count: 'exact', head: true }).in('workout_id', ids);
    document.getElementById(exId).textContent    = exCount    || 0;
    document.getElementById(photoId).textContent = photoCount || 0;

    const dates = new Set(workouts.map(w => w.date));
    let streak = 0;
    const check = new Date();
    while (dates.has(fmtDate(check))) { streak++; check.setDate(check.getDate() - 1); }
    document.getElementById(streakId).textContent = streak;
  } else {
    document.getElementById(exId).textContent    = 0;
    document.getElementById(photoId).textContent = 0;
    document.getElementById(streakId).textContent = 0;
  }
}

// ── MY HISTORY ────────────────────────────────────────────────────────────────
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

  const { startDate, endDate } = getDateRange(dateVal, currentView);
  const { workouts, exByWorkout, photosByWorkout } = await fetchWorkoutsInRange(currentUser.id, startDate, endDate);

  if (!workouts || workouts.length === 0) {
    container.innerHTML = '<div class="history-empty">NO WORKOUTS FOUND.</div>';
    return;
  }

  const enriched = workouts.map(w => ({ ...w, exercises: exByWorkout[w.id] || [], photos: photosByWorkout[w.id] || [] }));
  container.innerHTML = '';
  renderDays(enriched, container, false, true /* showDelete */);

  if (currentView === 'week' && dateVal) {
    const d = new Date(dateVal + 'T12:00:00');
    const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const header = document.createElement('div');
    header.className   = 'week-header';
    header.textContent = `Week of ${monday.toLocaleDateString('en-US',{month:'long',day:'numeric'})} — ${sunday.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`;
    container.prepend(header);
  } else if (currentView === 'month' && dateVal) {
    renderByWeekGroups(enriched, container);
    return;
  }
}

// ── COMMUNITY ─────────────────────────────────────────────────────────────────
async function loadCommunity() {
  const container = document.getElementById('community-content');
  container.innerHTML = '<div class="history-empty">Loading athletes...</div>';

  // Fetch all profiles except current user
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, username, email, created_at')
    .neq('id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error || !profiles || profiles.length === 0) {
    container.innerHTML = '<div class="history-empty">NO OTHER ATHLETES YET.<br>INVITE SOME FRIENDS.</div>';
    return;
  }

  // Get workout counts per user
  const userIds = profiles.map(p => p.id);
  const { data: workoutCounts } = await db
    .from('workouts')
    .select('user_id')
    .in('user_id', userIds);

  const countMap = {};
  (workoutCounts || []).forEach(w => { countMap[w.user_id] = (countMap[w.user_id] || 0) + 1; });

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'athletes-grid';

  profiles.forEach(profile => {
    const name    = profile.username || profile.email.split('@')[0];
    const initial = name.charAt(0).toUpperCase();
    const sessions = countMap[profile.id] || 0;
    const card = document.createElement('div');
    card.className = 'athlete-card';
    card.onclick   = () => showPublicProfile(profile.id, name);
    card.innerHTML = `
      <div class="athlete-avatar">${initial}</div>
      <div class="athlete-info">
        <div class="athlete-name">${name}</div>
        <div class="athlete-meta">${sessions} session${sessions !== 1 ? 's' : ''} logged</div>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ── PUBLIC PROFILE ────────────────────────────────────────────────────────────
async function loadPublicProfile(userId, username) {
  // Set header
  const initial = username.charAt(0).toUpperCase();
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('profile-name').textContent   = username;
  document.getElementById('profile-joined').textContent = 'Loading...';
  document.getElementById('profile-history').innerHTML  = '<div class="history-empty">Loading...</div>';

  // Fetch profile
  const { data: profile } = await db.from('profiles').select('created_at').eq('id', userId).maybeSingle();
  if (profile?.created_at) {
    const joined = new Date(profile.created_at);
    document.getElementById('profile-joined').textContent = `// Joined ${joined.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }

  // Stats
  await renderStatsForUser(userId, 'profile-stat-total', 'profile-stat-exercises', 'profile-stat-photos', 'profile-stat-streak');

  // Recent workouts (last 10)
  const { data: workouts } = await db
    .from('workouts')
    .select('id, date, notes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(10);

  const container = document.getElementById('profile-history');
  if (!workouts || workouts.length === 0) {
    container.innerHTML = '<div class="history-empty">NO WORKOUTS YET.</div>';
    return;
  }

  const ids = workouts.map(w => w.id);
  const { data: exercises } = await db.from('exercises').select('*').in('workout_id', ids);
  const { data: photos }    = await db.from('photos').select('*').in('workout_id', ids);

  const exByWorkout    = {};
  const photosByWorkout = {};
  (exercises || []).forEach(e => { if (!exByWorkout[e.workout_id]) exByWorkout[e.workout_id] = []; exByWorkout[e.workout_id].push(e); });
  (photos    || []).forEach(p => { if (!photosByWorkout[p.workout_id]) photosByWorkout[p.workout_id] = []; photosByWorkout[p.workout_id].push(p); });

  const enriched = workouts.map(w => ({ ...w, exercises: exByWorkout[w.id] || [], photos: photosByWorkout[w.id] || [] }));
  container.innerHTML = '';
  renderDays(enriched, container, false, false /* no delete for other users */);
}

// ── RENDER HELPERS ────────────────────────────────────────────────────────────
function getDateRange(dateVal, view) {
  if (!dateVal) return { startDate: '2000-01-01', endDate: '2099-12-31' };
  const d = new Date(dateVal + 'T12:00:00');
  if (view === 'day') return { startDate: dateVal, endDate: dateVal };
  if (view === 'week') {
    const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { startDate: fmtDate(monday), endDate: fmtDate(sunday) };
  }
  if (view === 'month') {
    return {
      startDate: fmtDate(new Date(d.getFullYear(), d.getMonth(), 1)),
      endDate:   fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    };
  }
  return { startDate: '2000-01-01', endDate: '2099-12-31' };
}

async function fetchWorkoutsInRange(userId, startDate, endDate) {
  const { data: workouts } = await db.from('workouts').select('id,date,notes').eq('user_id', userId).gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
  if (!workouts || workouts.length === 0) return { workouts: [], exByWorkout: {}, photosByWorkout: {} };

  const ids = workouts.map(w => w.id);
  const { data: exercises } = await db.from('exercises').select('*').in('workout_id', ids);
  const { data: photos }    = await db.from('photos').select('*').in('workout_id', ids);

  const exByWorkout     = {};
  const photosByWorkout = {};
  (exercises || []).forEach(e => { if (!exByWorkout[e.workout_id]) exByWorkout[e.workout_id] = []; exByWorkout[e.workout_id].push(e); });
  (photos    || []).forEach(p => { if (!photosByWorkout[p.workout_id]) photosByWorkout[p.workout_id] = []; photosByWorkout[p.workout_id].push(p); });

  return { workouts, exByWorkout, photosByWorkout };
}

function renderByWeekGroups(enriched, container) {
  container.innerHTML = '';
  const weeks = {};
  enriched.forEach(w => {
    const wd = new Date(w.date + 'T12:00:00');
    const day = wd.getDay();
    const mon = new Date(wd); mon.setDate(wd.getDate() - (day === 0 ? 6 : day - 1));
    const key = fmtDate(mon);
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(w);
  });
  for (const [weekStart, wEntries] of Object.entries(weeks)) {
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    const header = document.createElement('div');
    header.className   = 'week-header';
    header.textContent = `Week of ${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
    container.appendChild(header);
    renderDays(wEntries, container, true, true);
  }
}

function renderDays(entries, container, append = false, showDelete = false) {
  if (!append) container.innerHTML = '';
  entries.forEach(entry => {
    const d     = new Date(entry.date + 'T12:00:00');
    const block = document.createElement('div');
    block.className = 'day-block';

    const tableRows = entry.exercises.map(e => `
      <tr>
        <td><span class="cat-badge ${CAT_CLASS[e.category]||''}">${e.category}</span></td>
        <td>${e.exercise}</td>
        <td class="td-sets">${e.sets}</td>
        <td class="td-reps">${e.reps}</td>
      </tr>`).join('');

    let photosHtml = '';
    if (entry.photos?.length > 0) {
      const imgs = entry.photos.map(p => `<img src="${p.public_url}" onclick="openLightbox('${p.public_url.replace(/'/g,"\\'")}')" loading="lazy">`).join('');
      photosHtml = `<div class="day-photos"><div class="day-photos-label">Progress Photos</div><div class="day-photos-grid">${imgs}</div></div>`;
    }

    const deleteBtn = showDelete
      ? `<button class="btn-delete-workout" onclick="deleteWorkout('${entry.id}', this)">Delete</button>`
      : '';

    block.innerHTML = `
      <div class="day-header">
        <div>
          <div class="day-date">${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>
          <div class="day-meta">${entry.exercises.length} exercise${entry.exercises.length!==1?'s':''}${entry.notes?' · '+entry.notes:''}</div>
        </div>
        ${deleteBtn}
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

// ── LIGHTBOX ──────────────────────────────────────────────────────────────────
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

// ── NAV ───────────────────────────────────────────────────────────────────────
function setActive(link) {
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.nav-links a').forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));
});