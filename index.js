const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const usersCollection = client.db("bistroDb").collection("users");
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewsCollection = client.db("bistroDb").collection("reviews");
    const cartsCollection = client.db("bistroDb").collection("carts");
    const paymentCollection = client.db("bistroDb").collection("payments");

    /************ MIDDLEWARE API **************/
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decode) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decode;
        next();
      });
    };
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(401).send({ message: "forbidden access" });
      }
      next();
    };
    /************ MIDDLEWARE API **************/

    /************ JWT API **************/
    // create token
    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.json({ token: token });
    });

    /************ JWT API **************/

    /************ USER API **************/
    // get role
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const user = await usersCollection.findOne({ email: email });
      let admin = false;
      if (user) {
        admin = user?.role === "admin" ? true : false;
      }
      res.send({ admin });
    });
    // all user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // add user
    app.post("/users", async (req, res) => {
      const exitsUser = await usersCollection.findOne({
        email: req.body.email,
      });
      if (exitsUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(req.body);
      res.send(result);
    });
    // delete user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    // update user
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { role: "admin" } }
        );
        res.json(result);
      }
    );
    /************ USER API **************/

    /************ MENU API **************/
    // add menu
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const result = await menuCollection.insertOne(req.body);
      res.send(result);
    });
    // delete menu
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const result = await menuCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    //update menu
    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const result = await menuCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.json(result);
    });

    // get menu
    app.get("/menu/:id", async (req, res) => {
      const result = await menuCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // get menu
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    // add review
    app.get("/review", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    // add carts
    app.post("/carts", async (req, res) => {
      const result = await cartsCollection.insertOne(req.body);
      res.send(result);
    });
    // all carts
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const result = await cartsCollection.find({ email: email }).toArray();
      res.send(result);
    });
    // delete carts
    app.delete("/carts/:id", async (req, res) => {
      const result = await cartsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    // payment
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // add payment
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // delete add cart item
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });
    // get payment
    app.get("/payment/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const result = await paymentCollection
        .find({ email: req.params.email })
        .toArray();
      res.send(result);
    });
    /************ MENU API **************/

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
