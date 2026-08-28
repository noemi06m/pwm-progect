const dns = require("dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);
const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { MongoClient, ObjectId } = require("mongodb");

const mongoURL = "mongodb+srv://noemimazzali06_db_user:gyhKKjjmYhE0A4c3@cluster0.fchb56k.mongodb.net/"; 

const app = express();
const port = 3000;
// Configurazione di Swagger JSDoc
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FastFood API Documentation",
      version: "1.0.0",
      description: "Documentazione API per il sistema FastFood (Utenti, Ristoranti, Ordini)",
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Server Locale",
      },
    ],
  },
  // Percorso ai file dove inserire le annotazioni JSDoc (in questo caso il file stesso o tutte le rotte)
  apis: ["./*.js"], 
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Endpoint della Dashboard Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// REGISTRAZIONE
app.post("/api/register", async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: "Tutti i campi obbligatori devono essere compilati." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    const existingUser = await coll.findOne({ email: email });
    if (existingUser) {
      return res.status(409).json({ message: "Email già registrata." });
    }

    const newUser = {
      username: username || "",
      email: email,
      password: password,
      role: role,
      ristorante: { menu: [] },
      carrello: { menu: [] }
    };

    const result = await coll.insertOne(newUser);
    res.status(201).json({
      message: "Registrazione completata!",
      user: {
        _id: result.insertedId,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// SALVATAGGIO DETTAGLI RISTORANTE
app.post("/api/ristorante/dettagli", async (req, res) => {
  const { email, ristorante } = req.body;
  if (!email || !ristorante) {
    return res.status(400).json({ message: "Dati mancanti." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    if (!user.ristorante) {
      await coll.updateOne(
        { email: email },
        { $set: { ristorante: { ...ristorante, menu: [] } } }
      );
    } else {
      await coll.updateOne(
        { email: email },
        { $set: { ristorante: { ...ristorante, menu: user.ristorante.menu || [] } } }
      );
    }

    res.status(200).json({ message: "Dati ristorante salvati correttamente!" });
  } catch (error) {
    console.error("Errore di salvataggio ristorante:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// GET UTENTE
app.get("/api/utente", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "Email non specificata." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }
    res.status(200).json({ user: user });
  } catch (error) {
    console.error("Errore recupero utente:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// LOGIN UTENTE
app.post("/api/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email e password sono obbligatorie." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email, password: password });

    if (!user) {
      return res.status(401).json({ success: false, message: "Email o password errate." });
    }

    if (!user.ristorante) {
      await coll.updateOne({ email: email }, { $set: { ristorante: { menu: [] } } });
    } else if (!Array.isArray(user.ristorante.menu)) {
      await coll.updateOne({ email: email }, { $set: { "ristorante.menu": [] } });
    }

    if (user.role === "ristoratore") {
      return res.json({
        success: true,
        role: "ristoratore",
        email: user.email,
        username: user.username,
        redirectUrl: "/piatti.html"
      });
    } else {
      return res.json({
        success: true,
        role: "cliente",
        email: user.email,
        username: user.username,
        redirectUrl: "/cliente.html"
      });
    }
  } catch (error) {
    console.error("Errore durante accesso:", error);
    res.status(500).json({ success: false, message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// CANCELLA UTENTE
app.delete("/api/delete-account", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "L'indirizzo email è obbligatorio." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const result = await coll.deleteOne({ email: email });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Nessun utente trovato con questa email." });
    }
    res.status(200).json({ message: `L'account associato all'email ${email} è stato cancellato con successo.`, deletedEmail: email });
  } catch (error) {
    console.error("Errore durante la cancellazione:", error);
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (client) await client.close();
  }
});

// RECUPERA TUTTI I PIATTI
app.get("/api/meals", async (req, res) => {
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("meals");
    const meals = await coll.find({}).toArray();
    res.status(200).json(meals);
  } catch (error) {
    console.error("Errore nel recupero dei piatti:", error);
    res.status(500).json({ message: "Errore interno al server durante la lettura dei piatti." });
  } finally {
    if (client) await client.close();
  }
});

// AGGIUNGI PIATTO DAL CATALOGO AL MENU DEL RISTORATORE
app.post("/api/menu/aggiungi", async (req, res) => {
  const { email, idPiatto, price } = req.body;
  if (!email || !idPiatto) {
    return res.status(400).json({ message: "Email e ID del piatto sono obbligatori." });
  }
  let idQuery = new ObjectId(idPiatto);
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");
    const piattoOriginale = await db.collection("meals").findOne({ _id: idQuery });

    if (!piattoOriginale) {
      return res.status(404).json({ message: "Piatto non trovato nel catalogo." });
    }

    const piattoCompleto = {
      mealId: piattoOriginale._id.toString(),
      strMeal: piattoOriginale.strMeal,
      strCategory: piattoOriginale.strCategory,
      strMealThumb: piattoOriginale.strMealThumb,
      ingredients: piattoOriginale.ingredients || [],
      price: price || "prezzo da inserire"
    };

    await db.collection("users").updateOne(
      { email: email },
      { $push: { "ristorante.menu": piattoCompleto } }
    );

    res.status(200).json({ message: "Piatto aggiunto al tuo menù con successo!" });
  } catch (error) {
    console.error("ERRORE AGGIUNTA PIATTO:", error);
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (client) await client.close();
  }
});

// CREAZIONE NUOVO PIATTO DA PARTE DEL RISTORATORE
app.post("/api/meals/crea", async (req, res) => {
  const { email, strMeal, strCategory, price, strMealThumb, ingredients } = req.body;
  if (!email || !strMeal || !strCategory || price === undefined) {
    return res.status(400).json({ message: "I campi Nome, Categoria, Prezzo ed Email sono obbligatori." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");

    const nuovoPiatto = {
      mealId: new ObjectId().toString(),
      strMeal: strMeal,
      strCategory: strCategory,
      price: price,
      strMealThumb: strMealThumb,
      ingredients: Array.isArray(ingredients) ? ingredients : []
    };

    await db.collection("users").updateOne(
      { email: email },
      { $push: { "ristorante.menu": nuovoPiatto } }
    );

    res.status(201).json({ message: "Piatto creato e aggiunto al menù con successo!" });
  } catch (error) {
    console.error("Errore durante la creazione del piatto:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// GET MENU RISTORATORE
app.get("/api/menu", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "L'email dell'utente è obbligatoria." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }
    const menu = user.ristorante?.menu || [];
    res.status(200).json(menu);
  } catch (error) {
    console.error("Errore nel recupero del menù:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// DELETE PIATTO DAL MENU
app.delete("/api/menu/:mealId", async (req, res) => {
  const { mealId } = req.params;
  const { email } = req.query;
  if (!email || !mealId) {
    return res.status(400).json({ message: "Email e mealId del piatto sono obbligatori." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const result = await coll.updateOne(
      { email: email },
      { $pull: { "ristorante.menu": { $or: [{ mealId: mealId }, { _id: mealId }] } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Piatto non trovato nel menù.", mealId });
    }
    res.status(200).json({ message: "Piatto eliminato con successo." });
  } catch (error) {
    console.error("Errore DELETE:", error);
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (client) await client.close();
  }
});

// GET RISTORANTI
app.get("/api/ristoranti", async (req, res) => {
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const ristoratori = await coll.find({ 
      role: "ristoratore", 
      "ristorante.nome": { $exists: true, $ne: "" } 
    }).toArray();
    res.status(200).json(ristoratori);
  } catch (error) {
    console.error("Errore nel recupero dei ristoranti:", error);
    res.status(500).json({ message: "Errore interno al server durante il recupero dei ristoranti." });
  } finally {
    if (client) await client.close();
  }
});

// GET SINGOLO RISTORANTE
app.get("/api/ristorante/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID ristorante non valido." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne(
      { _id: new ObjectId(id), role: "ristoratore" },
      { projection: { "password": 0 } }
    );

    if (!user || !user.ristorante) {
      return res.status(404).json({ message: "Ristorante non trovato." });
    }

    res.status(200).json({
      nome: user.ristorante.nome || "Ristorante senza nome",
      indirizzo: user.ristorante.indirizzo || "-",
      telefono: user.ristorante.telefono || "-",
      partitaIva: user.ristorante.partitaIva || "-",
      modalitaConsegna: user.ristorante.modalitaConsegna || "Non specificata", // Campo aggiunto
      menu: user.ristorante.menu || []
    });
  } catch (error) {
    console.error("Errore nel recupero del ristorante:", error);
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (client) await client.close();
  }
});

// SEARCH MEALS
app.get("/api/meals/search", async (req, res) => {
  const { q } = req.query;
  let client;

  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("meals");

    if (!q || !q.trim()) {
      const allMeals = await coll.find({}).toArray();
      return res.status(200).json(allMeals);
    }

    const queryPulita = q.trim();
    const piattiFiltrati = await coll.find({
      $or: [
        { ingredients: { $regex: queryPulita, $options: "i" } },
        { strMeal: { $regex: queryPulita, $options: "i" } },
        { strCategory: { $regex: queryPulita, $options: "i" } }
      ]
    }).toArray();

    res.status(200).json(piattiFiltrati);
  } catch (error) {
    console.error("Errore durante la ricerca piatti:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// SEARCH RISTORANTI (Nome/Luogo, Piatto nel menù, Prezzo Max, Allergie)
app.get("/api/ristoranti/search", async (req, res) => {
  const { q, piatto, maxPrice, allergy } = req.query;
  let client;

  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    let queryConditions = [{ role: "ristoratore" }];

    // 1. Ricerca per nome ristorante o indirizzo
    if (q && q.trim()) {
      const queryPulita = q.trim();
      queryConditions.push({
        $or: [
          { "ristorante.nome": { $regex: queryPulita, $options: "i" } },
          { "ristorante.indirizzo": { $regex: queryPulita, $options: "i" } }
        ]
      });
    }

    // Costruzione filtro avanzato sui piatti all'interno del menù del ristorante
    let elemMatchQuery = {};

    // 2. Filtro per Piatto
    if (piatto && piatto.trim()) {
      elemMatchQuery.strMeal = { $regex: piatto.trim(), $options: "i" };
    }

    // 3. Filtro per Prezzo Massimo
    if (maxPrice && !isNaN(parseFloat(maxPrice))) {
      elemMatchQuery.price = { $lte: parseFloat(maxPrice) };
    }

    // 4. Filtro Esclusione Allergie (esclude i piatti con l'ingrediente indicato)
    if (allergy && allergy.trim()) {
      elemMatchQuery.ingredients = { $not: { $regex: allergy.trim(), $options: "i" } };
    }

    // Se c'est almeno un filtro sul menù, applichiamo $elemMatch
    if (Object.keys(elemMatchQuery).length > 0) {
      queryConditions.push({
        "ristorante.menu": { $elemMatch: elemMatchQuery }
      });
    }

    const finalQuery = { $and: queryConditions };
    const ristorantiFiltrati = await coll.find(finalQuery).toArray();

    res.status(200).json(ristorantiFiltrati);
  } catch (error) {
    console.error("Errore durante la ricerca ristoranti:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// SEARCH RISTORANTI
app.get("/api/ristoranti/search", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(200).json([]);
  }
  const queryPulita = q.trim();
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const ristorantiFiltrati = await coll.find({
      role: "ristoratore",
      $or: [
        { "ristorante.nome": { $regex: queryPulita, $options: "i" } },
        { "ristorante.indirizzo": { $regex: queryPulita, $options: "i" } }
      ]
    }).toArray();
    res.status(200).json(ristorantiFiltrati);
  } catch (error) {
    console.error("Errore durante la ricerca dei ristoranti:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// GET CARRELLO CLIENTE DA MONGOBD
app.get("/api/carrello", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "L'email dell'utente è obbligatoria." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    const carrello = user.carrello?.menu || [];
    res.status(200).json(carrello);
  } catch (error) {
    console.error("Errore nel recupero del carrello:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// AGGIUNGE PIATTO AL CARRELLO SU MONGODB
app.post("/api/carrello/aggiungi", async (req, res) => {
  const { email, idPiatto, price, nomeRistorante } = req.body;
  if (!email || !idPiatto) {
    return res.status(400).json({ message: "Email e ID del piatto sono obbligatori." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");

    let piatto = await db.collection("meals").findOne({ 
      _id: ObjectId.isValid(idPiatto) ? new ObjectId(idPiatto) : null 
    });

    if (!piatto) {
      const ristoratore = await db.collection("users").findOne(
        { "ristorante.menu.mealId": idPiatto },
        { projection: { "ristorante.menu.$": 1 } }
      );
      if (ristoratore?.ristorante?.menu?.length > 0) {
        piatto = ristoratore.ristorante.menu[0];
      }
    }

    if (!piatto) {
      return res.status(404).json({ message: "Piatto non trovato." });
    }

    const piattoCarrello = {
      mealId: piatto._id ? piatto._id.toString() : piatto.mealId,
      strMeal: piatto.strMeal,
      strCategory: piatto.strCategory || "",
      strMealThumb: piatto.strMealThumb || "",
      price: price !== undefined ? Number(price) : (piatto.price || 0),
      ristorante: nomeRistorante || "Non specificato"
    };

    await db.collection("users").updateOne(
      { email: email },
      { $push: { "carrello.menu": piattoCarrello } }
    );

    res.status(200).json({ message: "Piatto aggiunto al carrello con successo!" });
  } catch (error) {
    console.error("ERRORE AGGIUNTA PIATTO AL CARRELLO:", error);
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (client) await client.close();
  }
});

// RIMUOVE SINGOLO PIATTO DAL CARRELLO
app.delete("/api/carrello/rimuovi", async (req, res) => {
  const { email, index } = req.body;
  if (!email || index === undefined) {
    return res.status(400).json({ message: "Email ed indice sono obbligatori." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email });

    if (!user || !user.carrello || !user.carrello.menu) {
      return res.status(404).json({ message: "Carrello non trovato." });
    }

    let menu = user.carrello.menu;
    menu.splice(index, 1);

    await coll.updateOne(
      { email: email },
      { $set: { "carrello.menu": menu } }
    );

    res.status(200).json({ message: "Piatto rimosso con successo." });
  } catch (error) {
    console.error("Errore rimozione da carrello:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// SVUOTA INTERO CARRELLO SU MONGODB
app.delete("/api/carrello/svuota", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "L'email è obbligatoria." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    await coll.updateOne(
      { email: email },
      { $set: { "carrello.menu": [] } }
    );
    res.status(200).json({ message: "Carrello svuotato con successo." });
  } catch (error) {
    console.error("Errore svuotamento carrello:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// CREA ORDINE, SALVA IN 'ORDINI' E DENTRO 'USERS' (E SVUOTA CARRELLO ATTI V O)
app.post("/api/ordini/crea", async (req, res) => {
  const { emailCliente, ristorante, piatti, totale } = req.body;
  if (!emailCliente || !piatti || !Array.isArray(piatti) || piatti.length === 0) {
    return res.status(400).json({ message: "Dati mancanti per la creazione dell'ordine." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");

    const nomiPiatti = piatti.map(p => p.strMeal || p.nome || p);

    const nuovoOrdine = {
      emailCliente: emailCliente,
      ristorante: ristorante || "Non specificato",
      nomiPiatti: nomiPiatti,
      totale: totale || 0,
      stato: "inviato",
      dataOrdine: new Date()
    };

    // 1. Salva l'ordine nella collezione separata "ordini"
    const result = await db.collection("ordini").insertOne(nuovoOrdine);

    // 2. Salva lo stesso ordine nello storico 'ordini' del documento utente e svuota 'carrello.menu'
    await db.collection("users").updateOne(
      { email: emailCliente },
      { 
        $push: { ordini: { _id: result.insertedId, ...nuovoOrdine } },
        $set: { "carrello.menu": [] } 
      }
    );

    res.status(201).json({
      message: "Ordine inviato con successo!",
      ordineId: result.insertedId
    });
  } catch (error) {
    console.error("Errore durante la creazione dell'ordine:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// GET ORDINI RICEVUTI DA UN RISTORANTE
app.get("/api/ordini/ristorante", async (req, res) => {
  const { ristorante } = req.query;
  if (!ristorante) {
    return res.status(400).json({ message: "Nome del ristorante obbligatorio." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("ordini");
    
    // Cerca tutti gli ordini destinati al nome del ristorante passato in query
    const ordini = await coll.find({ ristorante: ristorante }).sort({ dataOrdine: -1 }).toArray();
    
    res.status(200).json(ordini);
  } catch (error) {
    console.error("Errore nel recupero degli ordini:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
})

// AGGIORNA STATO E TEMPO DI PREPARAZIONE DELL'ORDINE
app.put("/api/ordini/aggiorna-stato", async (req, res) => {
  const { ordineId, stato, tempoPreparazione } = req.body;

  if (!ordineId || !stato) {
    return res.status(400).json({ message: "ID ordine e stato sono obbligatori." });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");
    const filter = { _id: new ObjectId(ordineId) };
    const update = {
      $set: {
        stato: stato,
        tempoPreparazione: tempoPreparazione || "Non specificato"
      }
    };

    // 1. Aggiorna l'ordine nella collezione principale "ordini"
    const result = await db.collection("ordini").updateOne(filter, update);

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Ordine non trovato." });
    }

    // 2. Aggiorna lo stato anche all'interno dello storico 'ordini' nel documento dell'utente cliente
    await db.collection("users").updateOne(
      { "ordini._id": new ObjectId(ordineId) },
      { 
        $set: { 
          "ordini.$.stato": stato,
          "ordini.$.tempoPreparazione": tempoPreparazione || "Non specificato"
        } 
      }
    );

    res.status(200).json({ message: "Ordine aggiornato con successo!" });
  } catch (error) {
    console.error("Errore aggiornamento ordine:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// get tutti ordini cliente
app.get("/api/ordini/cliente", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "L'email del cliente è obbligatoria." });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    
    const user = await coll.findOne(
      { email: email },
      { projection: { ordini: 1 } }
    );

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    const ordini = user.ordini || [];
    res.status(200).json(ordini);
  } catch (error) {
    console.error("Errore recupero ordini cliente:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

app.post("/api/ristorante/dettagli", async (req, res) => {
  const { email, ristorante } = req.body;
  if (!email || !ristorante) {
    return res.status(400).json({ message: "Dati mancanti." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    const menuAttuale = user.ristorante?.menu || [];

    await coll.updateOne(
      { email: email },
      { 
        $set: { 
          ristorante: { 
            ...user.ristorante,
            ...ristorante, 
            menu: menuAttuale 
          } 
        } 
      }
    );

    res.status(200).json({ message: "Dati ristorante salvati correttamente!" });
  } catch (error) {
    console.error("Errore di salvataggio ristorante:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// PUT MENU RISTORATORE
app.put("/api/menu", async (req, res) => {
  const { email, menu, modalitaConsegna } = req.body;

  if (!email) {
    return res.status(400).json({ 
      message: "Email obbligatoria." 
    });
  }

  let client;

  try {
    client = await MongoClient.connect(mongoURL);

    const coll = client
      .db("fastfood")
      .collection("users");

    const result = await coll.updateOne(
      { email: email },
      {
        $set: {
          "ristorante.menu": menu,
          "ristorante.modalitaConsegna": modalitaConsegna
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Utente non trovato."
      });
    }

    res.status(200).json({
      message: "Menù e modalità di consegna aggiornati con successo!",
      menu: menu,
      modalitaConsegna: modalitaConsegna
    });

  } catch (error) {
    console.error(
      "Errore durante l'aggiornamento del menù:",
      error
    );

    res.status(500).json({
      message: "Errore interno al server."
    });

  } finally {
    if (client) await client.close();
  }
});

// Recupera i metodi di pagamento salvati per l'utente
app.get("/api/metodi-pagamento", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "Email obbligatoria." });
  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");
    
    // Recupero il documento utente completo senza projection
    const user = await coll.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    res.status(200).json(user.metodiPagamento || []);
  } catch (error) {
    console.error("Errore recupero metodi di pagamento:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

// Aggiunge un nuovo metodo di pagamento nell'array dell'utente
app.post("/api/metodi-pagamento/aggiungi", async (req, res) => {
  const { email, metodo } = req.body;
  if (!email || !metodo || !metodo.tipo) {
    return res.status(400).json({ message: "Dati di pagamento incompleti." });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    const nuovoMetodo = {
      _id: new ObjectId(),
      tipo: metodo.tipo,
      intestatario: metodo.intestatario || "",
      numeroMascherato: metodo.numero ? `**** **** **** ${metodo.numero.slice(-4)}` : "N/D",
      scadenza: metodo.scadenza || ""
    };

    const result = await coll.updateOne(
      { email: email },
      { $push: { metodiPagamento: nuovoMetodo } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    res.status(201).json({ message: "Metodo di pagamento aggiunto!", metodo: nuovoMetodo });
  } catch (error) {
    console.error("Errore salvataggio metodo di pagamento:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});


app.listen(port, () => {
  console.log(`Server attivo su http://localhost:${port}`);
});
