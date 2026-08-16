const dns = require("dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);
const express = require("express");
const cors = require("cors");
const path = require("path"); // Aggiunto per gestire i percorsi
const { MongoClient } = require("mongodb");

const mongoURL = "mongodb+srv://noemimazzali06_db_user:gyhKKjjmYhE0A4c3@cluster0.fchb56k.mongodb.net/"; 

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// Servizio file statici
app.use(express.static(__dirname));

// ROTTE ESPLICITE PER LE PAGINE HTML (Risolvono il Cannot GET)
app.get("/accesso.html", (req, res) => {
  res.sendFile(path.join(__dirname, "accesso.html"));
});

app.get("/piatti.html", (req, res) => {
  res.sendFile(path.join(__dirname, "piatti.html"));
});

app.get("/areaPersonale.html", (req, res) => {
  res.sendFile(path.join(__dirname, "areaPersonale.html"));
});

app.get("/cliente.html", (req, res) => {
  res.sendFile(path.join(__dirname, "cliente.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "accesso.html"));
});
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
// AGGIUNGI PIATTO AL MENU DEL RISTORATORE
app.post("/api/menu/aggiungi", async (req, res) => {
  const { email, idPiatto } = req.body;

  if (!email || !idPiatto) {
    return res.status(400).json({
      message: "Email e ID del piatto sono obbligatori."
    });

  }
  let client;
  try {
    client = await MongoClient.connect(mongoURL);
    const coll = client.db("fastfood").collection("users");

    const user = await coll.findOne({email: email});
    if (!user) {
      return res.status(404).json({
        message: "Ristoratore non trovato."
      });
    }
    if (user.role !== "ristoratore") {
      return res.status(403).json({message: "Solo un ristoratore può modificare il menu."});
    }

    if (!user.ristorante) {
      await coll.updateOne(
        { email: email },
        {
          $set: {
            ristorante: {
              menu: []
            }
          }
        }
      );

    }
    if (user.ristorante && !Array.isArray(user.ristorante.menu)) {
      await coll.updateOne({ email: email },
        {
          $set: {
            "ristorante.menu": []
          }
        }
      );

    }
    const result = await coll.updateOne({ email: email },
      {
        $addToSet: {
          "ristorante.menu": idPiatto
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(200).json({message: "Il piatto era già presente nel tuo menù."});
    }

    res.status(200).json({message: "Piatto aggiunto al menù con successo!"});
  } catch (error) {
    console.error("ERRORE AGGIUNTA PIATTO:",error);
    res.status(500).json({message: "Errore interno del server.",error: error.message});
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.listen(port, () => {

  console.log(
    `Server attivo su http://localhost:${port}`
  );

});
