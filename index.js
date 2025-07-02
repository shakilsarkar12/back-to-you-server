require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://backtoyou-0.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
  console.log("inside the logger");
  next();
};

const veryfyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const messagesCollection = database.collection("messages");

    // JWT token related API
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      const user = { email };
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
      res.send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });
      res.send({ success: true });
    });

    app.get("/items", async (req, res) => {
      try {
        const {
          search = "",
          category = "",
          location = "",
          sort = "newest",
          page = 1,
          limit = 12,
        } = req.query;

        const query = {};

        if (search) {
          const regex = new RegExp(search, "i");
          query.$or = [{ title: regex }, { location: regex }];
        }

        if (category && category !== "All") {
          query.category = category;
        }

        if (location && location !== "All") {
          query.location = location;
        }

        const sortOrder = sort === "oldest" ? 1 : -1;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalCount = await itemsCollections.countDocuments(query);
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        const items = await itemsCollections
          .find(query)
          .sort({ date: sortOrder })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({ items, totalPages });
      } catch (error) {
        console.error("Failed to fetch items:", error);
        res.status(500).send({ error: "Failed to fetch items" });
      }
    });

    app.get("/my-items", veryfyToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const items = await itemsCollections.find({ userEmail: email }).toArray();
      res.send(items);
    });

    app.get("/item/:id", veryfyToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

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

    app.patch("/item/:id", veryfyToken, async (req, res) => {
      const email = req?.query?.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

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

    app.delete("/item/:id", veryfyToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const id = req.params.id;
      const doc = { _id: new ObjectId(id) };
      const result = await itemsCollections.deleteOne(doc);
      res.send(result);
    });

    app.post("/addItems", veryfyToken, async (req, res) => {
      const cursor = req.body;

      if (cursor?.userEmail !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await itemsCollections.insertOne(cursor);
      res.send(result);
    });

    app.get("/latestItems", async (req, res) => {
      const short = { date: -1 };
      const result = await itemsCollections
        .find()
        .sort(short)
        .limit(8)
        .toArray();
      res.send(result);
    });

    // recovery API
    app.post("/recoveries", veryfyToken, async (req, res) => {
      const cursor = req.body;
      if (cursor?.recoveredBy?.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await recoveriesCollection.insertOne(cursor);
      res.send(result);
    });

    app.get("/allrecoveredItems", async (req, res) => {
      const query = { status: "recovered" };
      const items = await itemsCollections.find(query).toArray();
      res.send(items);
    });

    app.get("/recoveredItems", veryfyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ error: "Email query is required" });
      }

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
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

    // Site Statistics API
    app.get("/siteStats", async (req, res) => {
      const lostCount = await itemsCollections.countDocuments({ type: "Lost" });
      const foundCount = await itemsCollections.countDocuments({
        type: "Found",
      });
      const recoveredCount =
        await recoveriesCollection.estimatedDocumentCount();

      res.send({
        lostCount,
        foundCount,
        recoveredCount,
      });
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

    // contact api
    app.post("/messages", async (req, res) => {
      try {
        const messageData = req.body;
        const result = await messagesCollection.insertOne(messageData);
        res.send({
          success: true,
          message: "Message received!",
          insertedId: result.insertedId,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: "Failed to send message",
          error: err,
        });
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
