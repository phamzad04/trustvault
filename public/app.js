let currentAuthMode = 'login';
let token = sessionStorage.getItem('trustvault_token') || null;
let user = JSON.parse(sessionStorage.getItem('trustvault_user') || 'null');

document.addEventListener('DOMContentLoaded', () => {
  if (token && user) {
    showWorkspace();
  }
});

/**
 * Toggles password input type between text and password + switches eye icon
 */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  const eyeOpen = btn.querySelector('.eye-open');
  const eyeClosed = btn.querySelector('.eye-closed');

  if (eyeOpen && eyeClosed) {
    if (isPassword) {
      eyeOpen.classList.add('hidden');
      eyeClosed.classList.remove('hidden');
    } else {
      eyeOpen.classList.remove('hidden');
      eyeClosed.classList.add('hidden');
    }
  }
}

/**
 * Smooth toggle between Login and Sign Up tabs
 */
function switchAuthTab(mode) {
  currentAuthMode = mode;
  const isLogin = mode === 'login';

  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const authBtnText = document.getElementById('authBtnText');
  const fieldFullName = document.getElementById('fieldFullName');
  const fieldConfirmPassword = document.getElementById('fieldConfirmPassword');
  const confirmInput = document.getElementById('confirmPassword');

  if (tabLogin && tabSignup) {
    if (isLogin) {
      tabLogin.className = 'py-2 text-xs font-semibold rounded-full pill-tab-active transition-all cursor-pointer';
      tabSignup.className = 'py-2 text-xs font-semibold rounded-full pill-tab-inactive transition-all cursor-pointer';
      if (authBtnText) authBtnText.textContent = 'Sign In to SecureVault';
    } else {
      tabLogin.className = 'py-2 text-xs font-semibold rounded-full pill-tab-inactive transition-all cursor-pointer';
      tabSignup.className = 'py-2 text-xs font-semibold rounded-full pill-tab-active transition-all cursor-pointer';
      if (authBtnText) authBtnText.textContent = 'Create Fortified Account';
    }
  }

  if (fieldFullName) fieldFullName.classList.toggle('hidden', isLogin);
  if (fieldConfirmPassword) fieldConfirmPassword.classList.toggle('hidden', isLogin);

  if (confirmInput) {
    if (isLogin) {
      confirmInput.removeAttribute('required');
      confirmInput.value = '';
    } else {
      confirmInput.setAttribute('required', 'true');
    }
  }

  hideAlert();
}

/**
 * Handles Form Submission for Login and Signup
 */
async function handleAuthSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value.trim() : '';

  if (currentAuthMode === 'signup') {
    const confirmInput = document.getElementById('confirmPassword');
    const confirmPassword = confirmInput ? confirmInput.value.trim() : '';
    if (password !== confirmPassword) {
      showAuthAlert('Passwords do not match. Please verify.', 'error');
      return;
    }
    if (password.length < 6) {
      showAuthAlert('Password must be at least 6 characters long.', 'error');
      return;
    }
  }

  const btn = document.getElementById('authBtn');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-not-allowed');
  }

  try {
    if (currentAuthMode === 'login') {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        token = data.token;
        user = data.user;
        sessionStorage.setItem('trustvault_token', token);
        sessionStorage.setItem('trustvault_user', JSON.stringify(user));
        showWorkspace();
      } else {
        showAuthAlert(data.error || 'Invalid email or password.', 'error');
      }
    } else {
      const nameInput = document.getElementById('fullName');
      const name = nameInput ? nameInput.value.trim() : 'User';

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || 'User', email, password })
      });
      const data = await res.json();

      if (res.ok) {
        showAuthAlert('Account created successfully! Please sign in.', 'success');
        const form = document.getElementById('authForm');
        if (form) form.reset();
        setTimeout(() => switchAuthTab('login'), 1200);
      } else {
        showAuthAlert(data.error || 'Registration failed.', 'error');
      }
    }
  } catch (err) {
    showAuthAlert('Network error connecting to backend gateway.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }
}

/**
 * Transitions view into the workspace
 */
function showWorkspace() {
  const authScreen = document.getElementById('authScreen');
  const workspaceScreen = document.getElementById('workspaceScreen');
  const navSession = document.getElementById('navSession');
  const navUser = document.getElementById('navUser');
  const navRole = document.getElementById('navRole');

  if (authScreen) authScreen.classList.add('hidden');
  if (workspaceScreen) workspaceScreen.classList.remove('hidden');
  if (navSession) navSession.classList.remove('hidden');

  if (navUser && user) navUser.textContent = user.name;
  if (navRole && user) navRole.textContent = user.role;

  loadDocuments();

  const auditSection = document.getElementById('auditSection');
  if (auditSection) {
    if (user && user.role === 'admin') {
      auditSection.classList.remove('hidden');
      loadAuditLogs();
    } else {
      auditSection.classList.add('hidden');
    }
  }
}

/**
 * Loads accessible documents (only files belonging to this user)
 */
async function loadDocuments() {
  const container = document.getElementById('documentsList');
  if (!container) return;

  try {
    const res = await fetch('/api/documents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok || !data.documents || data.documents.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center border border-dashed border-slate-700/80 rounded-2xl p-6 bg-[#070d1d]/60">
          <p class="text-xs text-slate-400">No documents found in your private enclave.</p>
          <button onclick="openUploadModal()" class="mt-3 text-xs text-cyan-400 hover:underline cursor-pointer">Upload your first private file</button>
        </div>`;
      return;
    }

    container.innerHTML = data.documents.map(d => {
      const isOwnerOrAdmin = (user && (user.role === 'admin' || user.id === d.ownerId));

      return `
        <div class="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-cyan-500/50 transition shadow-lg">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-cyan-300 border border-blue-800/80">${d.id}</span>
              <span class="text-[10px] font-mono text-slate-400">${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Active'}</span>
            </div>
            <h4 class="text-sm font-semibold text-white tracking-tight line-clamp-1">${d.title}</h4>
            <div class="flex items-center gap-2 mt-2 text-xs text-slate-300">
              <span>Owner: <strong class="text-cyan-200 font-medium">${d.ownerName}</strong></span>
            </div>
          </div>

          <div class="flex justify-between items-center pt-3 border-t border-slate-700/80">
            ${d.filename && d.filename !== 'none' 
              ? `<button onclick="downloadDocument('${d.id}')" class="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer">
                   <span>Download</span>
                 </button>` 
              : '<span class="text-xs text-slate-500 font-mono">No Attachment</span>'}
            
            ${isOwnerOrAdmin 
              ? `<button onclick="deleteDocument('${d.id}')" class="px-3 py-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 text-xs font-medium flex items-center gap-1 transition cursor-pointer">
                   <span>Delete</span>
                 </button>`
              : '<span class="text-xs text-slate-600 font-mono">Read Only</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="col-span-full text-rose-400 text-xs text-center py-6">Failed to retrieve workspace files.</div>`;
  }
}

/**
 * Securely download document through authenticated API route
 */
async function downloadDocument(docId) {
  try {
    const res = await fetch(`/api/documents/${docId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`[${res.status} Forbidden] ${err.error || 'Download failed'}`);
      return;
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = `document_${docId}`;
    if (disposition && disposition.indexOf('filename=') !== -1) {
      filename = disposition.split('filename=')[1].replace(/["']/g, '');
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Network error attempting secure download.');
  }
}

function openUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) modal.classList.remove('hidden');
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) modal.classList.add('hidden');
}

async function handleUpload(e) {
  if (e && e.preventDefault) e.preventDefault();
  const titleInput = document.getElementById('uploadTitle');
  const fileInput = document.getElementById('uploadFile');
  const uploadBtn = document.getElementById('uploadBtn');

  const title = titleInput ? titleInput.value.trim() : '';
  const formData = new FormData();
  formData.append('title', title);
  if (fileInput && fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.classList.add('opacity-70');
  }

  try {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();

    if (res.ok) {
      if (titleInput) titleInput.value = '';
      if (fileInput) fileInput.value = '';
      closeUploadModal();
      loadDocuments();
      if (user && user.role === 'admin') loadAuditLogs();
    } else {
      alert(data.error || 'Upload failed');
    }
  } catch (err) {
    alert('Network error during file upload.');
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('opacity-70');
    }
  }
}

async function deleteDocument(docId) {
  if (!confirm(`Are you sure you want to delete document (${docId})?`)) return;

  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      loadDocuments();
      if (user && user.role === 'admin') loadAuditLogs();
    } else {
      alert(`[${res.status} Forbidden] ${data.error || 'Failed to delete'}`);
    }
  } catch (err) {
    alert('Network error attempting document deletion.');
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('auditContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/audit', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      if (!data.logs || data.logs.length === 0) {
        container.innerHTML = `<div class="text-slate-500 py-3 text-center">No forensic records logged yet.</div>`;
        return;
      }

      container.innerHTML = data.logs.slice().reverse().map(l => {
        const isSuccess = l.status === 'SUCCESS';
        const badgeClass = isSuccess 
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30';

        return `
          <div class="py-2 px-3 rounded-lg bg-[#070e22] border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${badgeClass}">[${l.status}]</span>
              <span class="text-slate-100 font-semibold">${l.action}</span>
              <span class="text-slate-400 text-[10px]">actor: <strong class="text-cyan-300">${l.actorName}</strong> (doc: ${l.docId})</span>
            </div>
            <span class="text-slate-500 text-[10px]">${new Date(l.timestamp).toLocaleTimeString()}</span>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="text-rose-400 py-2">Unable to load audit logs.</div>`;
  }
}

function logout() {
  sessionStorage.clear();
  token = null;
  user = null;
  const workspaceScreen = document.getElementById('workspaceScreen');
  const navSession = document.getElementById('navSession');
  const authScreen = document.getElementById('authScreen');

  if (workspaceScreen) workspaceScreen.classList.add('hidden');
  if (navSession) navSession.classList.add('hidden');
  if (authScreen) authScreen.classList.remove('hidden');
}

function showAuthAlert(msg, type) {
  const box = document.getElementById('authAlert');
  if (!box) return;
  box.classList.remove('hidden');
  box.className = type === 'success'
    ? 'mt-4 p-3 rounded-xl border border-cyan-500/40 bg-cyan-950/60 text-cyan-300 text-xs font-mono'
    : 'mt-4 p-3 rounded-xl border border-rose-500/40 bg-rose-950/60 text-rose-300 text-xs font-mono';
  box.textContent = msg;
}

function hideAlert() {
  const box = document.getElementById('authAlert');
  if (box) {
    box.classList.add('hidden');
    box.textContent = '';
  }
}

function openFooterModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeFooterModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}