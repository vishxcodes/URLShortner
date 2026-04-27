const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Url = require("./models/Url");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Generate random short code
function generateShortCode(length = 6) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

// Create short URL
app.post("/shorten", async (req, res) => {
  const { originalUrl, customAlias } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Validate URL
  try {
    new URL(originalUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  let shortCode;

  if (customAlias) {
    const validAlias = /^[a-zA-Z0-9_-]+$/;

    if (!validAlias.test(customAlias)) {
      return res.status(400).json({
        error: "Alias can only contain letters, numbers, - and _",
      });
    }

    const existing = await Url.findOne({ shortCode: customAlias });
    if (existing) {
      return res.status(400).json({ error: "Alias already taken" });
    }

    shortCode = customAlias;
  } else {
    do {
      shortCode = generateShortCode();
    } while (await Url.findOne({ shortCode }));
  }

  const newUrl = new Url({
    originalUrl,
    shortCode,
  });

  await newUrl.save();

  // 🔥 Dynamic host detection (works locally and on Render)
  const fullUrl = `${req.protocol}://${req.get("host")}/${shortCode}`;

  res.json({
    shortUrl: fullUrl,
  });
});

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// URL shortener page
app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});


// Redirect Route
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  const url = await Url.findOne({ shortCode: code });

  if (!url) {
    return res.status(404).send("URL not found");
  }

  url.clicks++;
  await url.save();

  res.redirect(url.originalUrl);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
