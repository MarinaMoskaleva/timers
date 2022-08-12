require("dotenv").config();
const express = require("express");
const nunjucks = require("nunjucks");
const http = require("http");
const cookie = require("cookie");
const WebSocket = require("ws");

const { MongoClient } = require("mongodb");

const cookieParser = require("cookie-parser");

const { findUserByToken, findTimersByUserId, createUserTimer, stopTimer } = require("./db");

const app = express();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");
app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());
app.use("/", require("./router"));

const port = process.env.PORT || 3000;

const server = http.createServer(app);

const wss = new WebSocket.Server({ clientTracking: false, noServer: true });
const clients = new Map();

const clientPromise = MongoClient.connect(process.env.DB_URI, {
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

server.on("upgrade", async (req, socket, head) => {
  const cookies = cookie.parse(req.headers["cookie"]);
  const token = cookies && cookies["token"];
  try {
    const client = await clientPromise;
    req.db = client.db("users");
  } catch (err) {
    return;
  }
  const user = await findUserByToken(req.db, token);
  const userId = user._id;

  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  req.userId = userId;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  const { userId } = req;

  clients.set(userId, ws);
  ws.on("close", () => {
    clients.delete(userId);
  });

  const sendErrorMessage = async (error) => {
    const fullMessage = JSON.stringify({
      type: "error_message",
      text: error.message,
    });
    ws.send(fullMessage);
  };

  const sendAllTimers = async () => {
    try {
      const timers = await findTimersByUserId(req.db, userId);
      const fullMessage = JSON.stringify({
        type: "all_timers",
        userTimers: timers,
      });
      ws.send(fullMessage);
    } catch (err) {
      sendErrorMessage(err);
    }
  };

  sendAllTimers();

  ws.on("message", async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      sendErrorMessage(err);
      return;
    }

    if (data.type === "create_timer") {
      const timerId = await createUserTimer(req.db, userId, data.description);
      const fullMessage = JSON.stringify({
        type: "create_timer_success",
        timerId,
        description: data.description,
      });
      ws.send(fullMessage);
      sendAllTimers();
    }

    if (data.type === "stop_timer") {
      await stopTimer(req.db, data.timerId);
      const fullMessage = JSON.stringify({
        type: "stop_timer_success",
        timerId: data.timerId,
      });
      ws.send(fullMessage);
      sendAllTimers();
    }
  });

  setInterval(async () => {
    const timers = await findTimersByUserId(req.db, userId);
    const dataToRes = timers.filter((item) => item.isActive);
    dataToRes.forEach((item) => {
      item.progress = new Date() - new Date(item.start);
    });
    const fullMessage = JSON.stringify({
      type: "active_timers",
      userTimers: dataToRes,
    });
    ws.send(fullMessage);
  }, 1000);
});

server.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
