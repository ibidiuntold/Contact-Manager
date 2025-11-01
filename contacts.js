const API = "http://localhost:3000"; // change if your server is on a different host/port

// DOM elements
const contactForm = document.getElementById("contact-form");
const nameInput = document.getElementById("contact-name");
const numberInput = document.getElementById("contact-number");
const contactList = document.getElementById("contact-list");

const modal = document.getElementById("modal");
const modalForm = document.getElementById("modal-form");
const modalName = document.getElementById("modal-name");
const modalNumber = document.getElementById("modal-number");
const modalCancel = document.getElementById("modal-cancel");

let editingId = null;

// small helper to build elements
function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === "class") e.className = props[k];
    else if (k === "text") e.textContent = props[k];
    else e.setAttribute(k, props[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (!c) return;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

// fetch contacts from server
async function fetchContacts() {
  try {
    const res = await fetch(`${API}/contacts`);
    console.log('GET /contacts', res.status);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const contacts = await res.json();
    renderContacts(contacts);
  } catch (err) {
    console.error("Failed to load contacts:", err);
    contactList.innerHTML = `<div class="error">Unable to load contacts. Check console for details.</div>`;
  }
}

function renderContacts(contacts = []) {
  contactList.innerHTML = "";
  if (!Array.isArray(contacts) || contacts.length === 0) {
    contactList.innerHTML = `<div class="contact-card"><div class="contact-left"><div class="contact-text"><div class="contact-name">No contacts</div><div class="contact-number">Add one above</div></div></div></div>`;
    return;
  }

  contacts.forEach(ct => {
    // use either _id or id depending on server response
    const id = ct._id || ct.id;
    const initials = (ct.name || "").split(' ').filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0,2).join('') || '?';

    const avatar = el('div', { class: 'avatar', 'aria-hidden': 'true' }, initials);
    const name = el('div', { class: 'contact-name', text: ct.name || '' });
    const number = el('div', { class: 'contact-number', text: ct.number || '' });

    const textBlock = el('div', { class: 'contact-text' }, [name, number]);
    const left = el('div', { class: 'contact-left' }, [avatar, textBlock]);

    const editBtn = el('button', { class: 'icon-btn edit', type: 'button', 'aria-label': `Edit ${ct.name}` }, 'Edit');
    const delBtn = el('button', { class: 'icon-btn del', type: 'button', 'aria-label': `Delete ${ct.name}` }, 'Delete');

    editBtn.addEventListener('click', () => openEditModal(ct));
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${ct.name}"?`)) return;
      try {
        const resp = await fetch(`${API}/contacts/${id}`, { method: 'DELETE' });
        console.log('DELETE', resp.status);
        if (!resp.ok) throw new Error(`Delete failed (${resp.status})`);
        await fetchContacts();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete contact.');
      }
    });

    const actions = el('div', { class: 'contact-actions' }, [editBtn, delBtn]);
    const card = el('div', { class: 'contact-card' }, [left, actions]);
    contactList.appendChild(card);
  });
}

// Add contact
contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const number = numberInput.value.trim();
  if (!name || !number) return;

  try {
    const res = await fetch(`${API}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, number })
    });
    console.log('POST /contacts', res.status);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(`Create failed (${res.status}) ${body && body.error ? body.error : ''}`);
    }
    nameInput.value = '';
    numberInput.value = '';
    await fetchContacts();
  } catch (err) {
    console.error('Create error:', err);
    alert('Failed to add contact. See console.');
  }
});

// Open modal for edit
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

// Save edited contact
modalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingId) return closeModal();
  const name = modalName.value.trim();
  const number = modalNumber.value.trim();
  if (!name || !number) return alert('Both fields required.');

  try {
    const res = await fetch(`${API}/contacts/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, number })
    });
    console.log('PUT /contacts/:id', res.status);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(`Update failed (${res.status}) ${body && body.error ? body.error : ''}`);
    }
    await fetchContacts();
    closeModal();
  } catch (err) {
    console.error('Update error:', err);
    alert('Failed to update contact.');
  }
});

modalCancel.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

// Close on backdrop click
modal.addEventListener('click', (e) => {
  if (e.target && e.target.matches('[data-dismiss="backdrop"]')) closeModal();
});

// prevent modal-panel clicks from closing
document.querySelectorAll('.modal-panel').forEach(p => p.addEventListener('click', e => e.stopPropagation()));

// initial load
fetchContacts();
