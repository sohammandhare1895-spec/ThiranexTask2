const API_BASE = '/api';

let token = localStorage.getItem('token') || null;
let user = JSON.parse(localStorage.getItem('user') || 'null');
let isLoginMode = true;
let currentFilter = 'all';
let tasks = [];

const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleBtn = document.getElementById('authToggleBtn');
const authTogglePrompt = document.getElementById('authTogglePrompt');
const authAlert = document.getElementById('authAlert');

const userEmailBadge = document.getElementById('userEmailBadge');
const logoutBtn = document.getElementById('logoutBtn');
const createTaskForm = document.getElementById('createTaskForm');
const taskTitleInput = document.getElementById('taskTitleInput');
const taskDescInput = document.getElementById('taskDescInput');
const taskList = document.getElementById('taskList');

document.addEventListener('DOMContentLoaded', () => {
  if (token && user) {
    showDashboard();
  } else {
    showAuth();
  }
});

authToggleBtn.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  authAlert.classList.add('hidden');
  if (isLoginMode) {
    authTitle.textContent = 'Welcome Back';
    authSubtitle.textContent = 'Log in to manage your tasks';
    authSubmitBtn.textContent = 'Log In';
    authTogglePrompt.textContent = "Don't have an account?";
    authToggleBtn.textContent = 'Sign Up';
  } else {
    authTitle.textContent = 'Create Account';
    authSubtitle.textContent = 'Register to start tracking tasks';
    authSubmitBtn.textContent = 'Sign Up';
    authTogglePrompt.textContent = 'Already have an account?';
    authToggleBtn.textContent = 'Log In';
  }
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    token = data.token;
    user = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    showDashboard();
  } catch (err) {
    authAlert.textContent = err.message;
    authAlert.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  user = null;
  showAuth();
});

function showAuth() {
  authContainer.classList.remove('hidden');
  appContainer.classList.add('hidden');
}

function showDashboard() {
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');
  userEmailBadge.textContent = user.email;
  fetchTasks();
}

async function fetchTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) return logoutBtn.click();
    tasks = await res.json();
    renderTasks();
  } catch (err) {
    console.error('Failed to fetch tasks', err);
  }
}

createTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();

  if (!title) return;

  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description })
    });

    if (res.ok) {
      taskTitleInput.value = '';
      taskDescInput.value = '';
      fetchTasks();
    }
  } catch (err) {
    console.error('Error creating task', err);
  }
});

async function toggleTaskStatus(id, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  try {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) fetchTasks();
  } catch (err) {
    console.error('Error updating task', err);
  }
}

async function deleteTask(id) {
  try {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchTasks();
  } catch (err) {
    console.error('Error deleting task', err);
  }
}

function renderTasks() {
  taskList.innerHTML = '';

  const filteredTasks = tasks.filter(t => {
    if (currentFilter === 'pending') return t.status === 'pending';
    if (currentFilter === 'completed') return t.status === 'completed';
    return true;
  });

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <div class="text-center py-10 bg-slate-800/40 border border-slate-800 rounded-xl text-slate-500">
        No tasks found.
      </div>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const isDone = task.status === 'completed';
    const card = document.createElement('div');
    card.className = `bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-start justify-between gap-4 transition ${isDone ? 'opacity-60' : ''}`;

    card.innerHTML = `
      <div class="flex items-start gap-3 flex-1">
        <input type="checkbox" ${isDone ? 'checked' : ''} class="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-900 accent-indigo-500 cursor-pointer">
        <div>
          <h3 class="font-medium text-slate-100 ${isDone ? 'line-through text-slate-400' : ''}">${escapeHtml(task.title)}</h3>
          ${task.description ? `<p class="text-sm text-slate-400 mt-1">${escapeHtml(task.description)}</p>` : ''}
        </div>
      </div>
      <button class="delete-btn text-slate-500 hover:text-red-400 p-1 rounded transition" title="Delete Task">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    `;

    card.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleTaskStatus(task.id, task.status));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    taskList.appendChild(card);
  });
}

document.getElementById('filterAll').addEventListener('click', (e) => setFilter('all', e.target));
document.getElementById('filterPending').addEventListener('click', (e) => setFilter('pending', e.target));
document.getElementById('filterCompleted').addEventListener('click', (e) => setFilter('completed', e.target));

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.className = 'filter-btn text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white';
  });
  btn.className = 'filter-btn text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-600 text-white';
  renderTasks();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
