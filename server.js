const express = require('express');
const bcrypt = require('bcrypt'); // per criptare le password 
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware per parsing dei dati JSON e abilitazione CORS
app.use(express.json());
app.use(cors());

// Database temporaneo in memoria (in produzione usa PostgreSQL, MongoDB, ecc.)
const users = [];
const USER_ROLES = {
    cliente: 'cliente',
    ristoratore: 'ristoratore'
}
/ accesso utente
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
/**
 * Endpoint POST per la registrazione utenti
 */
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    // 1. Validazione input base
    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: 'Tutti i campi sono obbligatori.' }); // err 400 dati mancanti o formattazione errata 
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'La password deve contenere almeno 6 caratteri.' });
    }

    //controllo anche la variabile
    const validRoles = Object.values(USER_ROLES);
    if(!validRoles.includes(role)){
        return res.status(400).json({message: 'seleziona la tipologia '});
    }

    // 2. Verifica se l'utente esiste già
    const existingUser = users.find(u => u.email === email);// verfichi tramtie l'email 
    if (existingUser) {
      return res.status(409).json({ message: 'Email già registrata.' });// err 409 conflict 
    }

    // 3. Hashing della password (cost factor 10)
    const hashedPassword = await bcrypt.hash(password, 10); // cripta la password

    // 4. Salvataggio dell'utente
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date()
    };

    users.push(newUser);

    // 5. Risposta al client (senza restituire la password)
    res.status(201).json({ // status 201 utente registrato con successo
      message: 'Utente registrato con successo!',
      user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });

  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    res.status(500).json({ message: 'Errore interno del server.' });// errore inatteso nel codice 
  }
});

//ora è la funzione per cancellare 
app.delete('/api/delete-account', (req, res) => {
  try {
    const { email } = req.body;

    // 1. Validazione input
    if (!email) {
      return res.status(400).json({ message: 'L\'indirizzo email è obbligatorio.' });
    }

    // 2. Cerca l'indice dell'utente
    const userIndex = users.findIndex(u => u.email === email);

    // 3. Se non esiste, ritorna 404
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Nessun utente trovato con questa email.' });
    }

    // 4. Rimuovi l'utente dall'array
    const deletedUser = users.splice(userIndex, 1)[0];

    // 5. Conferma di avvenuta cancellazione
    res.status(200).json({
      message: `L'account associato all'email ${deletedUser.email} è stato cancellato con successo.`,
      deletedEmail: deletedUser.email
    });

  } catch (error) {
    console.error('Errore durante la cancellazione:', error);
    res.status(500).json({ message: 'Errore interno del server.' });
  }
});


// Avvio del server sulla porta locale
app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});

app.use(express.static(__dirname));

const path = require('path');

app.get('/ristoratore.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'ristoratore.html'));
});

app.post('/api/ristorante/dettagli', (req, res) => {
  const { email, role, ristorante } = req.body;

  // Cerca l'utente registrato tramite email
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ message: 'Utente non trovato' });
  }

  // Associa i dati del ristorante all'oggetto utente presente nell'array
  user.dettagliRistorante = ristorante;

  console.log('Utente aggiornato:', user);

  return res.status(200).json({ 
    message: 'Dettagli ristorante salvati con successo!', 
    user 
  });
});
