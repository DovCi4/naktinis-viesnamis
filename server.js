const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const TOPICS_FILE = path.join(DATA_DIR, "topics.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

for (const directory of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Nepavyko perskaityti ${file}:`, error);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

let users = readJson(USERS_FILE, []);
let topics = readJson(TOPICS_FILE, []);
let settings = readJson(SETTINGS_FILE, {
  logo: "",
  siteName: "Naktinis Viešnamis"
});

if (!users.some(user => user.username.toLowerCase() === "admin")) {
  users.push({
    id: Date.now(),
    username: "admin",
    passwordHash: bcrypt.hashSync("admin123", 10),
    role: "admin",
    createdAt: new Date().toISOString()
  });

  writeJson(USERS_FILE, users);
}

if (topics.length === 0) {
  topics.push({
    id: Date.now(),
    title: "Sveiki atvykę į Naktinį Viešnamį!",
    content: "Čia galite kurti temas, komentuoti ir bendrauti su kitais nariais.",
    category: "Naujienos",
    author: "admin",
    createdAt: new Date().toISOString(),
    comments: []
  });

  writeJson(TOPICS_FILE, topics);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "naktinis-viesnamis-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax"
  }
}));

app.use(express.static(PUBLIC_DIR));

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Pirmiausia prisijunk." });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Šis veiksmas skirtas tik administratoriui." });
  }

  next();
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    callback(null, `logo-${Date.now()}.gif`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isGif = file.mimetype === "image/gif" && extension === ".gif";

    if (!isGif) {
      return callback(new Error("Leidžiami tik GIF failai."));
    }

    callback(null, true);
  }
});

app.get("/api/settings", (req, res) => {
  res.json(settings);
});

app.get("/api/me", (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({
      error: "Vartotojo vardas turi būti 3–24 simbolių."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Slaptažodis turi būti bent 6 simbolių."
    });
  }

  if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({
      error: "Toks vartotojo vardas jau užimtas."
    });
  }

  const user = {
    id: Date.now(),
    username,
    passwordHash: await bcrypt.hash(password, 10),
    role: "member",
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeJson(USERS_FILE, users);

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  res.status(201).json({
    user: req.session.user
  });
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const user = users.find(item =>
    item.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({
      error: "Neteisingas vartotojo vardas arba slaptažodis."
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  res.json({
    user: req.session.user
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/topics", (req, res) => {
  const safeTopics = topics
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(topic => ({
      ...topic,
      commentsCount: topic.comments.length
    }));

  res.json(safeTopics);
});

app.get("/api/topics/:id", (req, res) => {
  const topic = topics.find(item => String(item.id) === req.params.id);

  if (!topic) {
    return res.status(404).json({
      error: "Tema nerasta."
    });
  }

  res.json(topic);
});

app.post("/api/topics", requireLogin, (req, res) => {
  const title = String(req.body.title || "").trim();
  const category = String(req.body.category || "").trim();
  const content = String(req.body.content || "").trim();

  if (title.length < 4 || category.length < 2 || content.length < 5) {
    return res.status(400).json({
      error: "Užpildyk visus temos laukus."
    });
  }

  const topic = {
    id: Date.now(),
    title,
    category,
    content,
    author: req.session.user.username,
    createdAt: new Date().toISOString(),
    comments: []
  };

  topics.unshift(topic);
  writeJson(TOPICS_FILE, topics);

  res.status(201).json(topic);
});

app.post("/api/topics/:id/comments", requireLogin, (req, res) => {
  const topic = topics.find(item => String(item.id) === req.params.id);
  const content = String(req.body.content || "").trim();

  if (!topic) {
    return res.status(404).json({
      error: "Tema nerasta."
    });
  }

  if (content.length < 2) {
    return res.status(400).json({
      error: "Komentaras per trumpas."
    });
  }

  const comment = {
    id: Date.now(),
    author: req.session.user.username,
    content,
    createdAt: new Date().toISOString()
  };

  topic.comments.push(comment);
  writeJson(TOPICS_FILE, topics);

  res.status(201).json(comment);
});

app.post("/api/admin/logo", requireAdmin, (req, res) => {
  upload.single("logo")(req, res, error => {
    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Pasirink GIF failą."
      });
    }

    if (settings.logo && settings.logo.startsWith("/uploads/")) {
      const oldLogoPath = path.join(PUBLIC_DIR, settings.logo);

      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
        } catch {}
      }
    }

    settings.logo = `/uploads/${req.file.filename}`;
    writeJson(SETTINGS_FILE, settings);

    res.json({
      logo: settings.logo
    });
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: "Įvyko serverio klaida."
  });
});

app.listen(PORT, () => {
  console.log(`Naktinis Viešnamis veikia: http://localhost:${PORT}`);
  console.log("Admin prisijungimas: admin / admin123");
});
