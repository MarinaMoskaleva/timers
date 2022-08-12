const express = require("express");

const bodyParser = require("body-parser");

const { MongoClient } = require("mongodb");

const { findUserByUsername, deleteToken, createUser, createToken, hash } = require("./db");

const { auth } = require("./auth");

const clientPromise = MongoClient.connect(process.env.DB_URI, {
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("users");
    next();
  } catch (err) {
    next(err);
  }
});

router.use(bodyParser.urlencoded({ extended: false }));

router.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

router.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const userId = await createUser(req.db, username, password);
  const token = await createToken(req.db, userId);
  res.cookie("token", token).redirect("/");
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await findUserByUsername(req.db, username);
  if (!user || user.password !== hash(password)) {
    return res.redirect("/?authError=true");
  }
  const token = await createToken(req.db, user._id);
  res.cookie("token", token).redirect("/");
});

router.get("/logout", auth(), async (req, res) => {
  if (!req.user) {
    return res.redirect("/");
  }
  await deleteToken(req.db, req.token);
  res.clearCookie("token").redirect("/");
});

module.exports = router;
