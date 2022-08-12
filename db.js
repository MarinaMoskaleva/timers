const { ObjectId } = require("mongodb");
const { nanoid } = require("nanoid");
const { createHash } = require("crypto");

const hash = (d) => createHash("sha256").update(d).digest("hex");

module.exports.hash = hash;

module.exports.findUserByUsername = async (db, username) => await db.collection("users").findOne({ username });

module.exports.createUser = async (db, username, password) => {
  const { insertedId } = await db.collection("users").insertOne({
    username,
    password: hash(password),
  });
  return insertedId;
};

module.exports.createUserTimer = async (db, userId, description) => {
  const timerId = nanoid();

  const { insertedId } = await db.collection("timers").insertOne({
    userId,
    timerId,
    start: new Date(),
    description,
    isActive: true,
  });

  return insertedId;
};

module.exports.findTimersByUserId = async (db, userId) => {
  const timers = await db.collection("timers").find({ userId }).toArray();
  return timers;
};

module.exports.stopTimer = async (db, timerId) => {
  const timerEnd = new Date();
  const timer = await db.collection("timers").findOne(
    { _id: ObjectId(timerId) },
    {
      projection: { start: 1 },
    }
  );
  const duration = timerEnd - timer.start;
  await db.collection("timers").updateOne(
    { _id: ObjectId(timerId) },
    {
      $set: {
        isActive: false,
        end: timerEnd,
        duration,
      },
    }
  );
};

module.exports.createToken = async (db, userId) => {
  const token = nanoid();
  await db.collection("tokens").insertOne({
    userId,
    token,
  });
  return token;
};

module.exports.deleteToken = async (db, token) => {
  await db.collection("tokens").deleteOne({ token });
};

module.exports.findUserByToken = async (db, token) => {
  const myToken = await db.collection("tokens").findOne(
    { token },
    {
      projection: { userId: 1 },
    }
  );
  if (!myToken) {
    return;
  }
  return db.collection("users").findOne({ _id: ObjectId(myToken.userId) });
};
