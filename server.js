const dns = require("dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);
const express = require("express");
const cors = require("cors");
const path = require("path"); // Aggiunto per gestire i percorsi
const { MongoClient, ObjectId } = require("mongodb");

const mongoURL = "mongodb+srv://noemimazzali06_db_user:gyhKKjjmYhE0A4c3@cluster0.fchb56k.mongodb.net/"; 

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// Servizio file statici
app.use(express.static(__dirname));

//registrazione 
app.post("/api/register", async (req, res) => {

  const { username, email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({
      message: "Tutti i campi obbligatori devono essere compilati."
    });
  }
  let client;
  try {

    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    const existingUser = await coll.findOne({
      email: email
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email già registrata."
      });
    }
    //crea di default il ristorante
    const newUser = {
      username: username || "",
      email: email,
      password: password,
      role: role,

      ristorante: {
        menu: []
      }
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
    console.error("Errore durante la registrazione:",error);
    res.status(500).json({
      message: "Errore interno al server."
    });

  } finally {

    if (client) {
      await client.close();
    }
  }
});

//salvataggio dettagli ristorante
app.post("/api/ristorante/dettagli", async (req, res) => {

  const { email, ristorante } = req.body;
  if (!email || !ristorante) {
    return res.status(400).json({
      message: "Dati mancanti."
    });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);

    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({
      email: email
    });

    if (!user) {
      return res.status(404).json({
        message: "Utente non trovato."
      });
    }

    // Se l'utente aveva ristorante: null allora viene trasformato in un oggetto.
    if (!user.ristorante) {
      await coll.updateOne(
        { email: email },
        {
          $set: {
            ristorante: {
              ...ristorante,
              menu: []
            }
          }
        }
      );

    } else {
      await coll.updateOne(
        { email: email },
        {
          $set: {
            "ristorante": {
              ...ristorante,
              menu: user.ristorante.menu || []
            }
          }
        }
      );

    }

    res.status(200).json({
      message: "Dati ristorante salvati correttamente!"
    });

  } catch (error) {
    console.error("Errore di salvataggio ristorante:",error);
    res.status(500).json({
      message: "Errore interno al server."
    });

  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.get("/api/utente", async (req, res) => {

  const { email } = req.query;
  if (!email) {
    return res.status(400).json({
      message: "Email non specificata."
    });
  }

  let client;
  try {

    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    const user = await coll.findOne({
      email: email
    });

    if (!user) {
      return res.status(404).json({
        message: "Utente non trovato."
      });
    }

    res.status(200).json({user: user});
  } catch (error) {

    console.error("Errore recupero utente:",error
    );

    res.status(500).json({message: "Errore interno al server."});

  } finally {
    if (client) {
      await client.close();
    }
  }
});

// LOGIN UTENTE
app.post("/api/login", async (req, res) => {

  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ success: false,message: "Email e password sono obbligatorie."});
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);

    const coll = client.db("fastfood").collection("users");
    const user = await coll.findOne({email: email,password: password});

    if (!user) {
      return res.status(401).json({success: false,message: "Email o password errate."});
    }


    //Se un vecchio utente ha ancora ristorante null lo sistema.
    if (!user.ristorante) {

      await coll.updateOne({ email: email },
        {
          $set: {
            ristorante: {
              menu: []
            }
          }
        }
      );

    } else if (!Array.isArray(user.ristorante.menu)) {
      await coll.updateOne({ email: email },
        {
          $set: {
            "ristorante.menu": []
          }
        }
      );

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
    console.error("Errore durante accesso:",error);
    res.status(500).json({success: false,message: "Errore interno al server."});

  } finally {
    if (client) {
      await client.close();
    }
  }
});

//CANCELLA UTENTE
app.delete("/api/delete-account", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({message: "L'indirizzo email è obbligatorio."});
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    const result = await coll.deleteOne({email: email});

    if (result.deletedCount === 0) {
      return res.status(404).json({message: "Nessun utente trovato con questa email."});
    }
    res.status(200).json({message:`L'account associato all'email ${email} è stato cancellato con successo.`,deletedEmail: email});

  } catch (error) {
    console.error("Errore durante la cancellazione:",error);
    res.status(500).json({message: "Errore interno del server."});
  } finally {
    if (client) {
      await client.close();
    }
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
    console.error("Errore nel recupero dei piatti:",error);
    res.status(500).json({
      message:"Errore interno al server durante la lettura dei piatti."});
  } finally {
    if (client) {
      await client.close();
    }
  }
});


// AGGIUNGI PIATTO DAL CATALOGO AL MENU DEL RISTORATORE (COPIA COMPLETA)
app.post("/api/menu/aggiungi", async (req, res) => {
  const { email, idPiatto, price } = req.body;

  if (!email || !idPiatto) {
    return res.status(400).json({
      message: "Email e ID del piatto sono obbligatori."
    });
  }
  let idQuery = new ObjectId(idPiatto);

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");

    const piattoOriginale = await db.collection("meals").findOne({_id: idQuery});

    if (!piattoOriginale) {
      return res.status(404).json({ message: "Piatto non trovato nel catalogo." });
    }

    // 2. Costruisci l'oggetto completo da salvare nel menu del ristoratore
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


// aggiunta di un nuovo piatto inserito dal ristoratore
app.post("/api/meals/crea", async (req, res) => {
  const { email, strMeal, strCategory, price, strMealThumb, ingredients } = req.body;

  if (!email || !strMeal || !strCategory || price === undefined) {
    return res.status(400).json({
      message: "I campi Nome, Categoria, Prezzo ed Email sono obbligatori."
    });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const db = client.db("fastfood");

    const user = await db.collection("users").findOne({ email: email });

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

    res.status(201).json({
      message: "Piatto creato e aggiunto al menù con successo!",
    });

  } catch (error) {
    console.error("Errore durante la creazione del piatto:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// prende il menu del ristoratore per controllare
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
    //assegna l'array di menù e nel caso non esiste gli attribuisce un array vuoto
    const menu = user.ristorante?.menu || [];
    res.status(200).json(menu);

  } catch (error) {
    console.error("Errore nel recupero del menù:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});


//aggiorna e salva l'intero menù del ristoratore nel caso di modifiche
app.put("/api/menu", async (req, res) => {
  const { email, menu } = req.body;

  //controllo sull'email e sull'array
  if (!email) {
    return res.status(400).json({ message: "Email obbligatoria." });
  }

  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    // salva direttamente l'array ricevuto dal frontend
    const result = await coll.updateOne(
      { email: email },
      { $set: { "ristorante.menu": menu } }
    );

    res.status(200).json({ message: "Menù aggiornato con successo!", menu: menu });

  } catch (error) {
    console.error("Errore durante l'aggiornamento del menù:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

//elimina un piatto dal menù
app.delete("/api/menu/:mealId", async (req, res) => {
    const { mealId } = req.params;
    const { email } = req.query;

    if (!email || !mealId) {
        return res.status(400).json({
            message: "Email e mealId del piatto sono obbligatori."
        });
    }

    let client;

    try {
        client = await MongoClient.connect(mongoURL);
        const coll = client.db("fastfood").collection("users");

        const result = await coll.updateOne(
            { email: email },
            { 
              $pull: { 
                "ristorante.menu": { 
                  $or: [{ mealId: mealId }, { _id: mealId }] 
                } 
              } 
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "Piatto non trovato nel menù.", mealId });
        }

        res.status(200).json({ message: "Piatto eliminato con successo." });

    } catch (error) {
        console.error("Errore DELETE:", error);
        res.status(500).json({ message: "Errore interno del server." });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

// prende i ristoranti da presentare ai clienti
app.get("/api/ristoranti", async (req, res) => {
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    // Trova i ristoratori senza limitare i campi (senza projection)
    const ristoratori = await coll.find({ 
      role: "ristoratore", 
      "ristorante.nome": { $exists: true, $ne: "" } 
    }).toArray();

    // Restituisce l'array originale di utenti/ristoratori
    res.status(200).json(ristoratori);
  } catch (error) {
    console.error("Errore nel recupero dei ristoranti:", error);
    res.status(500).json({ message: "Errore interno al server durante il recupero dei ristoranti." });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.get("/api/ristorante/:id", async (req, res) => {
  const { id } = req.params;

  // VERIFICA SE L'ID È VALIDO PRIMA DI INTERROGARE MONGO
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
      menu: user.ristorante.menu || []
    });

  } catch (error) {
    console.error("Errore nel recupero del ristorante:", error);
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

//ricerca piatto per ingrediente, nome e tipologia
// Ricerca su un'unica barra per ingrediente, nome e tipologia
app.get("/api/meals/search", async (req, res) => {
  const { q } = req.query;

  // Se la query è vuota, restituisce un array vuoto
  if (!q || !q.trim()) {
    return res.status(200).json([]);
  }

  const queryPulita = q.trim();
  let client;

  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("meals");

    // $or restituisce i piatti che soddisfano ALMENO UNO dei tre criteri
    const piattiFiltrati = await coll.find({
      $or: [
        { ingredients: { $regex: queryPulita, $options: "i" } },
        { strMeal: { $regex: queryPulita, $options: "i" } },
        { strCategory: { $regex: queryPulita, $options: "i" } }
        
      ]
    }).toArray();

    res.status(200).json(piattiFiltrati);
  } catch (error) {
    console.error("Errore durante la ricerca:", error);
    res.status(500).json({ message: "Errore interno al server." });
  } finally {
    if (client) await client.close();
  }
});

//ricerca ristoranti sulla base di nome e luogo
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


app.listen(port, () => {

  console.log(
    `Server attivo su http://localhost:${port}`
  );

});
