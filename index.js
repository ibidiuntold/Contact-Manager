require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Please set MONGO_URI in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => { console.error('Mongo connect error:', err); process.exit(1); });

// Contact schema/model
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, trim: true },
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);

// -------- CRUD ----------
app.get('/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

app.post('/contacts', async (req, res) => {
  try {
    const { name, number } = req.body;
    if (!name || !number) return res.status(400).json({ error: 'name & number required' });
    const c = await Contact.create({ name, number });
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: 'Create failed' });
  }
});

app.put('/contacts/:id', async (req, res) => {
  try {
    const updated = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/contacts/:id', async (req, res) => {
  try {
    const removed = await Contact.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// -------- CSV/VCF import/export ----------
const upload = multer({ storage: multer.memoryStorage() });

// Import contacts via CSV (expects headers: name,number)
app.post('/contacts/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const rows = [];
    parse(req.file.buffer, { columns: true, trim: true }, (err, records) => {
      if (err) return res.status(400).json({ error: 'CSV parse error' });
      // records is array of objects with keys from headers
      const toInsert = records.map(r => ({ name: r.name || r.Name || r.NAME, number: r.number || r.Number || r.PHONE || r.phone }));
      // filter valid
      const valid = toInsert.filter(c => c.name && c.number);
      Contact.insertMany(valid)
        .then(result => res.json({ imported: result.length }))
        .catch(e => res.status(500).json({ error: 'DB insert failed', details: e.message }));
    });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
});

// Export CSV
app.get('/contacts/export/csv', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    let csv = 'name,number,createdAt\n';
    contacts.forEach(c => {
      const name = `"${String(c.name).replace(/"/g, '""')}"`;
      const num = `"${String(c.number).replace(/"/g, '""')}"`;
      csv += `${name},${num},${c.createdAt.toISOString()}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Export VCF (vCard)
app.get('/contacts/export/vcf', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    let vcf = '';
    contacts.forEach(c => {
      const name = c.name || '';
      const number = c.number || '';
      vcf += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${number}\nEND:VCARD\n`;
    });
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.vcf"');
    res.send(vcf);
  } catch (err) {
    res.status(500).json({ error: 'VCF export failed' });
  }
});

// ---------- Email sending (optional) ----------
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

app.post('/send-email', async (req, res) => {
  const { to, subject, text, contactIds } = req.body;
  if (!to || (!text && !contactIds)) return res.status(400).json({ error: 'to and text or contactIds required' });
  try {
    // build message body including contact details if contactIds provided
    let body = text || '';
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      const contacts = await Contact.find({ _id: { $in: contactIds }});
      body += '\n\nContacts:\n' + contacts.map(c => `${c.name} — ${c.number}`).join('\n');
    }
    if (!transporter) return res.status(500).json({ error: 'SMTP not configured' });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: subject || 'Contacts from Contact Manager',
      text: body
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('send-mail err', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

// Start
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
