require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("BackToYouDB");
    const itemsCollections = database.collection("items");
    const usersCollection = database.collection("users");
    const recoveriesCollection = database.collection("recoveries");

    app.get("/items", async (req, res) => {
      const result = await itemsCollections.find().toArray();
      res.send(result);
    });

    app.get("/my-items", async (req, res) => {
      const email = req.query.email;
      const items = await itemsCollections.find({ userEmail: email }).toArray();
      res.send(items);
    });

    app.get("/item/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollections.findOne(query);
      res.send(result);
    });

    app.patch("/updateitem/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      const result = await itemsCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    app.patch("/item/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await itemsCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status } }
      );

      if (result.modifiedCount > 0) {
        res.status(200).send({ message: "Status updated successfully" });
      } else {
        res.status(404).send({ message: "Item not found or already updated" });
      }
    });

    app.delete("/item/:id", async (req, res) => {
      console.log(id);
      const doc = { _id: new ObjectId(id) };
      const result = await itemsCollections.deleteOne(doc);
      res.send(result);
    });

    app.post("/addItems", async (req, res) => {
      const cursor = req.body;
      const result = await itemsCollections.insertOne(cursor);
      res.send(result);
    });

    // recovery API
    app.post("/recoveries", async (req, res) => {
      const cursor = req.body;
      const result = await recoveriesCollection.insertOne(cursor);
      res.send(result);
    });

    app.get("/recoveredItems", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ error: "Email query is required" });
      }
      const query = { "recoveredBy.email": email };
      const recoveredDocs = await recoveriesCollection.find(query).toArray();
      const recoveredItemsWithDetails = await Promise.all(
        recoveredDocs.map(async (recovery) => {
          const itemDoc = await itemsCollections.findOne({
            _id: new ObjectId(recovery.itemId),
          });
          return {
            recovery,
            item: itemDoc,
          };
        })
      );
      res.send(recoveredItemsWithDetails);
    });

    // user related API
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const cursor = req.body;
      const exitingUser = await usersCollection.findOne({
        email: cursor.email,
      });
      if (exitingUser) {
        res.send(exitingUser);
      } else {
        const result = await usersCollection.insertOne(cursor);
        res.send(result);
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BackToYouDB server is running");
});

app.listen(port, () => {
  console.log("server is running on poer", port);
});
