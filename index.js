const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.girnwoz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewsCollection = client.db("bistroDb").collection("reviews");
    const cartsCollection = client.db("bistroDb").collection("carts");

    /************ CRUD **************/
    // add menu
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.json(result);
    });
    // add review
    app.get("/review", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.json(result);
    });
    // add carts
    app.post("/carts", async (req, res) => {
      const result = await cartsCollection.insertOne(req.body);
      res.json(result);
    });
    // all carts
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const result = await cartsCollection.find({ email: email }).toArray();
      res.json(result);
    });
    // delete carts
    app.delete("/carts/:id", async (req, res) => {
      const result = await cartsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.json(result);
    });
    // // update carts
    // app.put("/carts/:id", async (req, res) => {
    //   const result = await cartsCollection.updateOne(
    //     { _id: req.params.id },
    //     { $set: req.body }
    //   );
    //   res.json(result);
    // });
    /************ CRUD **************/

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("bistro boss server is listening");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
