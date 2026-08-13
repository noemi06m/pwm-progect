const dns = require("dns"); 
dns.setServers(["1.1.1.1", "1.0.0.1"]);
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const mongoURL = "mongodb+srv://noemimazzali06_db_user:gyhKKjjmYhE0A4c3@cluster0.fchb56k.mongodb.net/";
const app = express();
const port = 3000; 

app.use(express.json());
app.use(cors());

// 1. REGISTRAZIONE UTENTE
app.post('/api/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Tutti i campi sono obbligatori.' });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db('fastfood').collection('users');

    // Cerca nel db se la mail è già presente
    const existingUser = await coll.findOne({ email: email });
    if (existingUser) {
      await client.close();
      return res.status(409).json({ message: 'Email già registrata.' });
    }

    const newUser = {
      username,
      email,
      password,
      role,
      ristorante: null
    };

    const result = await coll.insertOne(newUser);
    await client.close();

    console.log("Utente salvato su MongoDB con ID:", result.insertedId);

    res.status(201).json({
      message: 'Registrazione completata!',
      user: { _id: result.insertedId, username, email, role }
    });

  } catch (error) {
    if (client) await client.close();
    console.error("Errore durante la registrazione:", error);
    res.status(500).json({ message: "Errore interno al server." });
  }
});

// 2. SALVATAGGIO DETTAGLI RISTORANTE
app.post('/api/ristorante/dettagli', async (req, res) => {
  const { email, ristorante } = req.body;

  if (!email || !ristorante) {
    return res.status(400).json({ message: 'Dati mancanti.' });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db('fastfood').collection('users');

    const result = await coll.updateOne(
      { email: email },
      { $set: { ristorante: ristorante } }
    );
    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Utente non trovato.' });
    }
    res.status(200).json({ message: 'Dati ristorante salvati correttamente!' });

  } catch (error) {
    if (client) await client.close();
    console.error("Errore di salvataggio ristorante:", error);
    res.status(500).json({ message: "Errore interno al server." });
  }
});

// 3. RECUPERO DATI UTENTE
app.get('/api/utente', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email non specificata.' });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db('fastfood').collection('users');

    const user = await coll.findOne({ email: email });
    await client.close();

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato.' });
    }

    res.status(200).json({ user });
  } catch (error) {
    if (client) await client.close();
    console.error("Errore recupero utente:", error);
    res.status(500).json({ message: "Errore interno al server." });
  }
});

// 4. LOGIN UTENTE
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db('fastfood').collection('users');

    const user = await coll.findOne({ email: email, password: password });
    await client.close();

    if (!user) {
      return res.status(401).json({ success: false, message: "Email o password errate." });
    }

    if (user.role === 'ristoratore') {
      return res.json({ success: true, role: 'ristoratore', redirectUrl: '/ristoratore.html' });
    } else {
      return res.json({ success: true, role: 'cliente', redirectUrl: '/cliente.html' });
    }
  } catch (error) {
    if (client) await client.close();
    console.error('Errore durante accesso:', error);
    res.status(500).json({ success: false, message: 'Errore interno del server.' });
  }
});

// 5. CANCELLA UTENTE
app.delete('/api/delete-account', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'L\'indirizzo email è obbligatorio.' });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db('fastfood').collection('users');

    const result = await coll.deleteOne({ email: email });
    await client.close();

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Nessun utente trovato con questa email.' });
    }

    res.status(200).json({
      message: `L'account associato all'email ${email} è stato cancellato con successo.`,
      deletedEmail: email
    });

  } catch (error) {
    if (client) await client.close();
    console.error('Errore durante la cancellazione:', error);
    res.status(500).json({ message: 'Errore interno del server.' });
  }
});

app.listen(port, () => {
  console.log(`Server attivo su http://localhost:${port}`);
});
