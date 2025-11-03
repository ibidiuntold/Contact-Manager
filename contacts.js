const API = "http://localhost:3000"; 
<<<<<<< HEAD

=======
// DOM elements
const contactForm = document.getElementById("contact-form");
const nameInput = document.getElementById("contact-name");
const numberInput = document.getElementById("contact-number");
const contactList = document.getElementById("contact-list");
>>>>>>> f66368ec16ea037b11772706b38ccd9b06a68344

const contactForm = document.getElementById('contact-form');
const nameInput = document.getElementById('contact-name');
const numberInput = document.getElementById('contact-number');
const contactList = document.getElementById('contact-list');

const fileInput = document.getElementById('csv-file');
const importBtn = document.getElementById('import-btn');
const exportCsvBtn = document.getElementById('export-csv');
const exportVcfBtn = document.getElementById('export-vcf');

const searchInput = document.getElementById('search');
const filterSelect = document.getElementById('filter');
const sendSelectedBtn = document.getElementById('send-selected');
const downloadLink = document.getElementById('download-link');

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modal-form');
const modalName = document.getElementById('modal-name');
const modalNumber = document.getElementById('modal-number');
const modalCancel = document.getElementById('modal-cancel');

let contactsCache = [];
let selectedIds = new Set();
let editingId = null;

// helper to create elements
function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k === 'text') e.textContent = props[k];
    else e.setAttribute(k, props[k]);
  }
  for (const c of (Array.isArray(children) ? children : [children])) {
    if (!c) continue;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

async function fetchContacts() {
  try {
    const res = await fetch(`${API}/contacts`);
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    contactsCache = data;
    renderContacts(applyFiltersAndSearch(data));
  } catch (err) {
    console.error(err);
    contactList.innerHTML = `<div class="error">Failed to load contacts.</div>`;
  }
}

function applyFiltersAndSearch(list) {
  const q = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;
  const now = Date.now();
  return list.filter(c => {
    if (q) {
      const matches = (c.name || '').toLowerCase().includes(q) || (c.number || '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (filter === 'recent') {
      return (now - new Date(c.createdAt).getTime()) <= (7 * 24 * 60 * 60 * 1000);
    }
    if (filter === 'old') {
      return (now - new Date(c.createdAt).getTime()) > (7 * 24 * 60 * 60 * 1000);
    }
    return true;
  });
}

function renderContacts(list) {
  contactList.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    contactList.innerHTML = `<div class="contact-card"><div class="contact-left"><div class="contact-text"><div class="contact-name">No contacts</div><div class="contact-number">Add one above.</div></div></div></div>`;
    return;
  }

  list.forEach(ct => {
    const id = ct._id || ct.id;
    const initials = (ct.name || '').split(' ').filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0,2).join('') || '?';
    const avatar = el('div', { class: 'avatar' }, initials);
    const name = el('div', { class: 'contact-name', text: ct.name || '' });
    const number = el('div', { class: 'contact-number', text: ct.number || '' });
    const textBlock = el('div', { class: 'contact-text' }, [name, number]);
    const left = el('div', { class: 'contact-left' }, [avatar, textBlock]);

    // checkbox for multi-select
    const checkbox = el('input', { type: 'checkbox', class: 'sel-chk', 'data-id': id, style: 'width:16px; height:16px; cursor:pointer; accent-color:#007bff;'});
    checkbox.checked = selectedIds.has(String(id));
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(String(id));
      else selectedIds.delete(String(id));
    });

    const editBtn = el('button', { class: 'icon-btn edit', type: 'button' }, 'Edit');
    const delBtn = el('button', { class: 'icon-btn del', type: 'button' }, 'Delete');
    const shareBtn = el('button', { class: 'icon-btn', type: 'button' }, 'Share');

    // share: mailto + qr popover
    shareBtn.addEventListener('click', () => {
      const mailto = `mailto:?subject=${encodeURIComponent('Contact: ' + ct.name)}&body=${encodeURIComponent(ct.name + ' - ' + ct.number)}`;
      // show a small window with QR and mailto
      openShareDialog(ct, mailto);
    });

    editBtn.addEventListener('click', () => openEditModal(ct));
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${ct.name}"?`)) return;
      try {
        const resp = await fetch(`${API}/contacts/${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Delete failed');
        await fetchContacts();
      } catch (err) {
        console.error(err);
        alert('Failed to delete.');
      }
    });

    const actions = el('div', { class: 'contact-actions' }, [shareBtn, editBtn, delBtn]);

    const card = el('div', { class: 'contact-card' }, [
      el('div', { style: 'display:flex;gap:12px;align-items:center;flex:1' }, [checkbox, left]),
      actions
    ]);
    contactList.appendChild(card);
  });
}

// create/add contact
contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim(), number = numberInput.value.trim();
  if (!name || !number) return;
  try {
    const res = await fetch(`${API}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, number })
    });
    if (!res.ok) throw new Error('Create failed');
    nameInput.value = ''; numberInput.value = '';
    await fetchContacts();
  } catch (err) {
    console.error(err); alert('Failed to add contact.');
  }
});

// Import CSV
importBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return alert('Choose a CSV file first.');
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`${API}/contacts/import`, { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Import failed');
    alert(`Imported ${body.imported} contacts`);
    await fetchContacts();
  } catch (err) {
    console.error(err); alert('Import failed.');
  }
});

// Export CSV
exportCsvBtn.addEventListener('click', () => {
  window.location = `${API}/contacts/export/csv`;
});

// Export VCF
exportVcfBtn.addEventListener('click', () => {
  window.location = `${API}/contacts/export/vcf`;
});

// Search & filter
searchInput.addEventListener('input', () => renderContacts(applyFiltersAndSearch(contactsCache)));
filterSelect.addEventListener('change', () => renderContacts(applyFiltersAndSearch(contactsCache)));

// Email selected
sendSelectedBtn.addEventListener('click', async () => {
  if (!selectedIds.size) return alert('Select contacts first (use checkboxes).');
  const to = prompt('Send email to (recipient address):');
  if (!to) return;
  const ids = Array.from(selectedIds);
  try {
    const res = await fetch(`${API}/send-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, contactIds: ids, text: 'Here are the selected contacts' })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Send failed');
    alert('Email sent (check server logs).');
  } catch (err) {
    console.error(err); alert('Failed to send email.');
  }
});

// Modal edit
function openEditModal(contact) {
  editingId = contact._id || contact.id;
  modalName.value = contact.name || '';
  modalNumber.value = contact.number || '';
  modal.removeAttribute('hidden');
  modalName.focus();
  document.addEventListener('keydown', escHandler);
}
function closeModal() {
  editingId = null;
  modalForm.reset();
  modal.setAttribute('hidden', '');
  document.removeEventListener('keydown', escHandler);
}
function escHandler(e) { if (e.key === 'Escape') closeModal(); }

modalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingId) return closeModal();
  const name = modalName.value.trim(), number = modalNumber.value.trim();
  if (!name || !number) return alert('Both fields required.');
  try {
    const res = await fetch(`${API}/contacts/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, number })
    });
    if (!res.ok) throw new Error('Update failed');
    await fetchContacts();
    closeModal();
  } catch (err) {
    console.error(err); alert('Update failed.');
  }
});
modalCancel.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
modal.addEventListener('click', (e) => { if (e.target && e.target.matches('[data-dismiss="backdrop"]')) closeModal(); });
document.querySelectorAll('.modal-panel').forEach(p => p.addEventListener('click', e => e.stopPropagation()));

// Share dialog (small popup showing mailto and QR)
function openShareDialog(ct, mailto) {
  const w = window.open('', '_blank', 'width=420,height=520');
  const text = encodeURIComponent(`${ct.name} — ${ct.number}`);
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(ct.name + ' ' + ct.number)}`;
  w.document.write(`<html><head><title>Share ${ct.name}</title></head><body style="font-family:Arial;padding:16px">
    <h3>Share ${ct.name}</h3>
    <p><strong>${ct.name}</strong><br>${ct.number}</p>
    <p><a href="${mailto}">Send via email</a></p>
    <p><img src="${qrUrl}" alt="QR" /></p>
    <p><a href="${mailto}">Open mail client</a></p>
    </body></html>`);
}

// Kick off initial load
fetchContacts();
