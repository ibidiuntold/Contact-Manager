const dotenv = require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());           // allow browser to call server
app.use(express.json());   // parse JSON bodies

const PORT = process.env.PORT || 3000;

// Build connection string (either full MONGO_URI or components)
let mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  const { MONGO_USER, MONGO_PASS, MONGO_HOST, MONGO_DB } = process.env;
  if (!MONGO_USER || !MONGO_PASS || !MONGO_HOST || !MONGO_DB) {
    console.error("Missing one of required env vars: MONGO_URI or (MONGO_USER, MONGO_PASS, MONGO_HOST, MONGO_DB)");
    process.exit(1);
  }
  // encode password safely
  const encPass = encodeURIComponent(MONGO_PASS);
  mongoUri = `mongodb+srv://${MONGO_USER}:${encPass}@${MONGO_HOST}/${MONGO_DB}?retryWrites=true&w=majority`;
}

mongoose.connect(process.env.MONGO_URI) // connect to MongoDB Atlas

.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message || err);
  process.exit(1);
});

// Schema & Model
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, trim: true }
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);

// --- API routes ---

// GET /contacts  -> returns array of contacts
app.get('/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// POST /contacts  -> create contact { name, number }
app.post('/contacts', async (req, res) => {
  try {
    const { name, number } = req.body;
    if (!name || !number) return res.status(400).json({ error: 'name and number required' });
    const c = new Contact({ name, number });
    await c.save();
    res.status(201).json(c);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /contacts/:id -> update contact
app.put('/contacts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, number } = req.body;
    if (!name || !number) return res.status(400).json({ error: 'name and number required' });
    const updated = await Contact.findByIdAndUpdate(id, { name, number }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /contacts/:id -> delete contact
app.delete('/contacts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await Contact.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ error: 'Contact not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Optional: serve static front-end if you want the server to also host the UI
// Uncomment these lines if you want to serve index.html & other static files from the same server
// const path = require('path');
// app.use(express.static(path.join(__dirname, './'))); // serve project root
// app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await mongoose.disconnect();
  server.close(() => process.exit(0));
});
