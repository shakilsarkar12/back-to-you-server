require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
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
      const itemsCollections = database.collection("items")
      
      app.get('/items', async (req, res) => {
          const result = await itemsCollections.find().toArray()
          res.send(result)
      })
      
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
