const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Serviamo i file statici HTML
app.use(express.static(__dirname));

let users = []; // Database in memoria

// 1. REGISTRAZIONE UTENTE
app.post('/api/register', (req, res) => {
  const { username, email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Tutti i campi sono obbligatori.' });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({ message: 'Email già registrata.' });
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password, // In produzione usare sempre bcrypt
    role,
    ristorante: null // Inizialmente vuoto
  };

  users.push(newUser);
  res.status(201).json({ message: 'Registrazione completata!', user: newUser });
});

// 2. SALVATAGGIO DETTAGLI RISTORANTE
app.post('/api/ristorante/dettagli', (req, res) => {
  const { email, ristorante } = req.body;

  if (!email || !ristorante) {
    return res.status(400).json({ message: 'Dati mancanti.' });
  }

  // Trova l'utente registrato tramite la sua email
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ message: 'Utente non trovato.' });
  }

  // Assegna l'oggetto ristorante all'utente
  user.ristorante = ristorante;

  console.log('Utente aggiornato nel server:', user);

  res.status(200).json({ 
    message: 'Dati ristorante salvati correttamente!', 
    user 
  });
});

// 3. RECUPERO DATI UTENTE
app.get('/api/utente', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email non specificata.' });
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ message: 'Utente non trovato.' });
  }

  res.status(200).json({ user });
});

app.listen(PORT, () => {
  console.log(`Server attivo su http://localhost:${PORT}`);
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // 1. Cerca l'utente nell'array users
    const user = users.find(u => u.email === email); 

    if (!user) {
      return res.status(404).json({ success: false, message: "Utente non trovato." });
    }

    // 2. Confronta la password (con await e negazione corretta)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Password errata." });
    }

    // 3. Risposta con success: true e virgolette su 'ristoratore'
    if (user.role === 'ristoratore') {
      return res.json({ success: true, role: 'ristoratore', redirectUrl: '/ristoratore.html' });
    } else {
      return res.json({ success: true, role: 'cliente', redirectUrl: '/cliente.html' });
    }
  }
  catch (error) {
    console.error('Errore durante accesso:', error);
    res.status(500).json({ success: false, message: 'Errore interno del server.' });
  }
});

app.delete('/api/delete-account', (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'L\'indirizzo email è obbligatorio.' });
    }

    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1) {
      return res.status(404).json({ message: 'Nessun utente trovato con questa email.' });
    }

    // Rimuove l'utente e tutti i suoi dati (inclusi quelli del ristorante)
    const deletedUser = users.splice(userIndex, 1)[0];

    res.status(200).json({
      message: `L'account associato all'email ${deletedUser.email} è stato cancellato con successo.`,
      deletedEmail: deletedUser.email
    });

  } catch (error) {
    console.error('Errore durante la cancellazione:', error);
    res.status(500).json({ message: 'Errore interno del server.' });
  }
});
