const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("./passport");
const { SESSION_SECRET } = require("../config");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const pagesRoutes = require("./routes/pages");

const logger = require("../utils/logger");

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Debug Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(authRoutes);
app.use(apiRoutes);
app.use(pagesRoutes);

module.exports = app;
