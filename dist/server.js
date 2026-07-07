// server.js
import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
dotenv.config();
if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes("user:pass@cluster.mongodb.net")) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.example"), override: true });
}
var PORT = 3e3;
var JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
var MongoUserModel = null;
var MongoChatModel = null;
var MongoCourseModel = null;
var MongoLessonModel = null;
var isConnectedToMongo = false;
async function initDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("\n======================================================================");
    console.error("\u26A0\uFE0F  CRITICAL DATABASE ERROR: No MONGODB_URI environment variable set.");
    console.error("\u{1F449}  Please configure your MongoDB Connection String in your settings.");
    console.error("======================================================================\n");
    isConnectedToMongo = false;
    return;
  }
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5e3
      // Fail fast (5 seconds) if IP is not whitelisted or DB is offline
    });
    isConnectedToMongo = true;
    console.log("MongoDB connected successfully!");
    const UserSchema = new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["user", "admin"], default: "user" },
      enrolledCourses: { type: [String], default: [] },
      completedLessons: { type: [String], default: [] },
      studyNotes: { type: Map, of: String, default: {} },
      createdAt: { type: Date, default: Date.now }
    });
    const ChatSchema = new mongoose.Schema({
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      sender: { type: String, enum: ["user", "admin"], required: true },
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    });
    const CourseSchema = new mongoose.Schema({
      title: { type: String, required: true, unique: true },
      slug: { type: String, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      duration: { type: String, required: true },
      weeks: { type: String, required: true },
      certificates: { type: String, required: true },
      desc1: { type: String, required: true },
      desc2: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    });
    const LessonSchema = new mongoose.Schema({
      courseTitle: { type: String, required: true },
      title: { type: String, required: true },
      youtubeUrl: { type: String, required: true },
      desc: { type: String, default: "" },
      createdAt: { type: Date, default: Date.now }
    });
    MongoUserModel = mongoose.models.User || mongoose.model("User", UserSchema);
    MongoChatModel = mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatSchema);
    MongoCourseModel = mongoose.models.Course || mongoose.model("Course", CourseSchema);
    MongoLessonModel = mongoose.models.Lesson || mongoose.model("Lesson", LessonSchema);
    await ensureDefaultAdmin();
    await ensureDefaultCoursesAndLessons();
  } catch (err) {
    console.error("\n======================================================================");
    console.error("\u26A0\uFE0F  MONGODB CONNECTION ERROR: Could not connect to MongoDB Atlas cluster.");
    console.error("\u{1F449}  COMMON FIX: Make sure your IP address is whitelisted on MongoDB Atlas.");
    console.error("    In Atlas, go to Network Access -> Add IP Address -> Allow Access From Anywhere (0.0.0.0/0).");
    console.error("    Details:", err.message || err);
    console.error("======================================================================\n");
    isConnectedToMongo = false;
  }
}
function assertDbConnected() {
  if (!isConnectedToMongo || !MongoUserModel || !MongoChatModel || !MongoCourseModel || !MongoLessonModel) {
    throw new Error("MongoDB database is not connected. Please ensure MONGODB_URI environment variable is configured correctly and your IP address is whitelisted in MongoDB Atlas.");
  }
}
async function ensureDefaultAdmin() {
  if (!isConnectedToMongo || !MongoUserModel) return;
  const adminEmail = "admin@eduwell.com";
  const adminPassword = "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  try {
    const existingAdmin = await MongoUserModel.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await MongoUserModel.create({
        name: "System Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
        enrolledCourses: [],
        completedLessons: [],
        studyNotes: {},
        createdAt: /* @__PURE__ */ new Date()
      });
      console.log(`Successfully seeded default Admin [${adminEmail}] in MongoDB!`);
    }
  } catch (err) {
    console.error("Error checking/seeding default admin in MongoDB:", err);
  }
}
async function ensureDefaultCoursesAndLessons() {
  if (!isConnectedToMongo || !MongoCourseModel || !MongoLessonModel) return;
  const defaultCourses = [
    {
      title: "Web Development",
      slug: "web-development",
      image: "https://images.unsplash.com/photo-1547082299-de196ea013d6?q=80&w=600&auto=format&fit=crop",
      price: 128,
      duration: "36 Hours",
      weeks: "4 Weeks",
      certificates: "3 Certificates",
      desc1: "Did you know that you can master professional responsive layouts, custom interactive interfaces, and clean component architecture here at EduWell?",
      desc2: "Our web development course provides structured training from HTML/CSS to advanced React applications, helping you build high-performance, beautiful, and accessible web solutions."
    },
    {
      title: "Graphic Design",
      slug: "graphic-design",
      image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?q=80&w=600&auto=format&fit=crop",
      price: 156,
      duration: "40 Hours",
      weeks: "5 Weeks",
      certificates: "2 Certificates",
      desc1: "Learn the core theories of visual communication, balanced grid systems, color psychology, and modern corporate branding paradigms.",
      desc2: "This course is packed with hands-on labs where you design digital logos, professional advertising campaigns, and responsive web visual mockups under expert mentorship."
    },
    {
      title: "Web Design",
      slug: "web-design",
      image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=600&auto=format&fit=crop",
      price: 142,
      duration: "30 Hours",
      weeks: "4 Weeks",
      certificates: "2 Certificates",
      desc1: "Bridge the gap between pure artistic inspiration and high-usability interface designs using industry-standard tools like Figma and Adobe Creative Suite.",
      desc2: "You will study advanced micro-interactions, responsive fluid grids, accessible text hierarchies, and user journey wireframing for digital mobile and desktop products."
    },
    {
      title: "WordPress",
      slug: "wordpress",
      image: "https://images.unsplash.com/photo-1616469829581-73993eb86b02?q=80&w=600&auto=format&fit=crop",
      price: 94,
      duration: "24 Hours",
      weeks: "3 Weeks",
      certificates: "1 Certificate",
      desc1: "Deploy, manage, and scale professional business websites, blog portals, and WooCommerce digital storefronts with complete confidence.",
      desc2: "Perfect for entrepreneurs and creators. Learn theme customization, modern Gutenberg block editing systems, essential speed optimizations, and reliable search engine indexing."
    }
  ];
  const defaultLessons = [
    {
      courseTitle: "Web Development",
      title: "React JS Crash Course for Beginners 2026",
      youtubeUrl: "https://www.youtube.com/watch?v=w7ejDZ8SWv8",
      desc: "An essential absolute beginner guide to building dynamic applications in React."
    },
    {
      courseTitle: "Graphic Design",
      title: "Graphic Design Theory - Core Elements of Composition",
      youtubeUrl: "https://www.youtube.com/watch?v=9EGI-S4ZscE",
      desc: "Understand alignment, layout contrast, balance, and color harmony theories."
    },
    {
      courseTitle: "Web Design",
      title: "Figma Complete Tutorial Course",
      youtubeUrl: "https://www.youtube.com/watch?v=c9Wg6gOS5S4",
      desc: "Step-by-step masterclass on prototyping and micro-interactions in Figma."
    },
    {
      courseTitle: "WordPress",
      title: "WordPress Full Course - Custom Site Setup in 30 Mins",
      youtubeUrl: "https://www.youtube.com/watch?v=8O3V9S-F-vY",
      desc: "Deploy custom blogs, install high-performance widgets, and index on Google fast."
    }
  ];
  try {
    const count = await MongoCourseModel.countDocuments();
    if (count === 0) {
      console.log("Seeding default courses to MongoDB...");
      await MongoCourseModel.insertMany(defaultCourses);
      console.log("Seeding default lessons to MongoDB...");
      await MongoLessonModel.insertMany(defaultLessons);
    }
  } catch (err) {
    console.error("Error seeding default courses/lessons to MongoDB:", err);
  }
}
async function findUserByEmail(email) {
  assertDbConnected();
  const normalizedEmail = email.toLowerCase().trim();
  const doc = await MongoUserModel.findOne({ email: normalizedEmail });
  if (!doc) return null;
  return {
    _id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role,
    enrolledCourses: doc.enrolledCourses || [],
    completedLessons: doc.completedLessons || [],
    studyNotes: doc.studyNotes ? Object.fromEntries(doc.studyNotes) : {},
    createdAt: doc.createdAt
  };
}
async function findUserById(userId) {
  assertDbConnected();
  const doc = await MongoUserModel.findById(userId);
  if (!doc) return null;
  return {
    _id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    enrolledCourses: doc.enrolledCourses || [],
    completedLessons: doc.completedLessons || [],
    studyNotes: doc.studyNotes ? Object.fromEntries(doc.studyNotes) : {},
    createdAt: doc.createdAt
  };
}
async function createUser(name, email, passwordPlain, role = "user") {
  assertDbConnected();
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const doc = await MongoUserModel.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role,
    enrolledCourses: [],
    completedLessons: [],
    studyNotes: {},
    createdAt: /* @__PURE__ */ new Date()
  });
  return {
    _id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role,
    enrolledCourses: doc.enrolledCourses || [],
    completedLessons: doc.completedLessons || [],
    studyNotes: {},
    createdAt: doc.createdAt
  };
}
async function getAllUsers() {
  assertDbConnected();
  const docs = await MongoUserModel.find().sort({ createdAt: -1 });
  return docs.map((doc) => ({
    _id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role,
    enrolledCourses: doc.enrolledCourses || [],
    completedLessons: doc.completedLessons || [],
    studyNotes: doc.studyNotes ? Object.fromEntries(doc.studyNotes) : {},
    createdAt: doc.createdAt
  }));
}
async function updateUserProgress(userId, { enrolledCourses, completedLessons, studyNotes }) {
  assertDbConnected();
  const updateData = {};
  if (enrolledCourses !== void 0) updateData.enrolledCourses = enrolledCourses;
  if (completedLessons !== void 0) updateData.completedLessons = completedLessons;
  if (studyNotes !== void 0) updateData.studyNotes = studyNotes;
  const doc = await MongoUserModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
  if (!doc) return null;
  return {
    enrolledCourses: doc.enrolledCourses || [],
    completedLessons: doc.completedLessons || [],
    studyNotes: doc.studyNotes ? Object.fromEntries(doc.studyNotes) : {}
  };
}
async function saveChatMessage(userId, userName, sender, message) {
  assertDbConnected();
  const doc = await MongoChatModel.create({
    userId,
    userName,
    sender,
    message,
    timestamp: /* @__PURE__ */ new Date()
  });
  return {
    _id: doc._id.toString(),
    userId: doc.userId,
    userName: doc.userName,
    sender: doc.sender,
    message: doc.message,
    timestamp: doc.timestamp
  };
}
async function getChatMessagesForUser(userId) {
  assertDbConnected();
  const docs = await MongoChatModel.find({ userId }).sort({ timestamp: 1 });
  return docs.map((doc) => ({
    _id: doc._id.toString(),
    userId: doc.userId,
    userName: doc.userName,
    sender: doc.sender,
    message: doc.message,
    timestamp: doc.timestamp
  }));
}
async function getActiveConversations() {
  assertDbConnected();
  const docs = await MongoChatModel.find().sort({ timestamp: 1 });
  const convMap = /* @__PURE__ */ new Map();
  docs.forEach((msg) => {
    convMap.set(msg.userId, {
      userId: msg.userId,
      userName: msg.userName,
      lastMessage: msg.message,
      lastTimestamp: msg.timestamp,
      unreadCount: 0
    });
  });
  return Array.from(convMap.values()).sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime());
}
async function deleteUserById(userId) {
  assertDbConnected();
  await MongoUserModel.deleteOne({ _id: userId });
  return true;
}
async function deleteChatConversation(userId) {
  assertDbConnected();
  await MongoChatModel.deleteMany({ userId });
  return true;
}
async function getAllCourses() {
  assertDbConnected();
  const docs = await MongoCourseModel.find().sort({ createdAt: 1 });
  return docs.map((d) => ({
    _id: d._id.toString(),
    title: d.title,
    slug: d.slug,
    image: d.image,
    price: d.price,
    duration: d.duration,
    weeks: d.weeks,
    certificates: d.certificates,
    desc1: d.desc1,
    desc2: d.desc2,
    createdAt: d.createdAt
  }));
}
async function addCourse(course) {
  assertDbConnected();
  const doc = await MongoCourseModel.create(course);
  return {
    _id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    image: doc.image,
    price: doc.price,
    duration: doc.duration,
    weeks: doc.weeks,
    certificates: doc.certificates,
    desc1: doc.desc1,
    desc2: doc.desc2,
    createdAt: doc.createdAt
  };
}
async function deleteCourse(courseId) {
  assertDbConnected();
  await MongoCourseModel.deleteOne({ _id: courseId });
  return true;
}
async function getAllLessons() {
  assertDbConnected();
  const docs = await MongoLessonModel.find().sort({ createdAt: 1 });
  return docs.map((d) => ({
    _id: d._id.toString(),
    courseTitle: d.courseTitle,
    title: d.title,
    youtubeUrl: d.youtubeUrl,
    desc: d.desc,
    createdAt: d.createdAt
  }));
}
async function getLessonsByCourse(courseTitle) {
  assertDbConnected();
  const docs = await MongoLessonModel.find({ courseTitle }).sort({ createdAt: 1 });
  return docs.map((d) => ({
    _id: d._id.toString(),
    courseTitle: d.courseTitle,
    title: d.title,
    youtubeUrl: d.youtubeUrl,
    desc: d.desc,
    createdAt: d.createdAt
  }));
}
async function addLesson(lesson) {
  assertDbConnected();
  const doc = await MongoLessonModel.create(lesson);
  return {
    _id: doc._id.toString(),
    courseTitle: doc.courseTitle,
    title: doc.title,
    youtubeUrl: doc.youtubeUrl,
    desc: doc.desc,
    createdAt: doc.createdAt
  };
}
async function deleteLesson(lessonId) {
  assertDbConnected();
  await MongoLessonModel.deleteOne({ _id: lessonId });
  return true;
}
async function startServer() {
  await initDatabase();
  const app = express();
  app.use(express.json());
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ error: "Access token missing" });
      return;
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        res.status(403).json({ error: "Invalid or expired token" });
        return;
      }
      req.user = decoded;
      next();
    });
  };
  const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  };
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        res.status(400).json({ error: "Name, email, and password are required" });
        return;
      }
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: "Email is already registered" });
        return;
      }
      const user = await createUser(name, email, password, "user");
      const token = jwt.sign(
        { _id: user._id, name: user.name, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.status(201).json({
        success: true,
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrolledCourses: user.enrolledCourses || [],
          completedLessons: user.completedLessons || [],
          studyNotes: user.studyNotes || {}
        }
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      const user = await findUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const token = jwt.sign(
        { _id: user._id, name: user.name, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({
        success: true,
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrolledCourses: user.enrolledCourses || [],
          completedLessons: user.completedLessons || [],
          studyNotes: user.studyNotes || {}
        }
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const fullUser = await findUserById(req.user._id);
      if (!fullUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user: fullUser });
    } catch (err) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/users/me/progress", authenticateToken, async (req, res) => {
    try {
      const fullUser = await findUserById(req.user._id);
      if (!fullUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({
        enrolledCourses: fullUser.enrolledCourses || [],
        completedLessons: fullUser.completedLessons || [],
        studyNotes: fullUser.studyNotes || {}
      });
    } catch (err) {
      console.error("Get progress error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/users/me/progress", authenticateToken, async (req, res) => {
    try {
      const { enrolledCourses, completedLessons, studyNotes } = req.body;
      const updatedProgress = await updateUserProgress(req.user._id, {
        enrolledCourses,
        completedLessons,
        studyNotes
      });
      if (!updatedProgress) {
        res.status(404).json({ error: "User progress could not be updated" });
        return;
      }
      res.json({ success: true, progress: updatedProgress });
    } catch (err) {
      console.error("Update progress error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const users = await getAllUsers();
      const sanitized = users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
      }));
      res.json({ users: sanitized });
    } catch (err) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      if (!name || !email || !message) {
        res.status(400).json({ error: "Name, email and message are required" });
        return;
      }
      let user = await findUserByEmail(email);
      let accountCreated = false;
      const defaultPassword = "eduwell123";
      if (!user) {
        user = await createUser(name, email, defaultPassword, "user");
        accountCreated = true;
        console.log(`Auto-created account for Contact form submitter: ${email}`);
      }
      res.status(200).json({
        success: true,
        message: "Your inquiry has been successfully received!",
        accountCreated,
        credentials: accountCreated ? { email, password: defaultPassword } : null
      });
    } catch (err) {
      console.error("Contact Form submit error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/chat/messages", async (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) {
        res.status(400).json({ error: "userId parameter is required" });
        return;
      }
      const messages = await getChatMessagesForUser(userId);
      res.json({ messages });
    } catch (err) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/chat/send", async (req, res) => {
    try {
      const { userId, userName, sender, message } = req.body;
      if (!userId || !userName || !sender || !message) {
        res.status(400).json({ error: "userId, userName, sender and message are required" });
        return;
      }
      const savedMsg = await saveChatMessage(userId, userName, sender, message);
      res.status(201).json({ message: savedMsg });
    } catch (err) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/admin/conversations", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const conversations = await getActiveConversations();
      res.json({ conversations });
    } catch (err) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/admin/conversations/:userId/reply", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { message, userName } = req.body;
      if (!message) {
        res.status(400).json({ error: "Message content is required" });
        return;
      }
      const savedMsg = await saveChatMessage(userId, userName || "User", "admin", message);
      res.status(201).json({ message: savedMsg });
    } catch (err) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.delete("/api/users/:userId", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.user && req.user._id === userId) {
        res.status(400).json({ error: "Self-deletion is forbidden" });
        return;
      }
      const success = await deleteUserById(userId);
      if (success) {
        res.json({ success: true, message: "User deleted successfully" });
      } else {
        res.status(404).json({ error: "User not found or could not be deleted" });
      }
    } catch (err) {
      console.error("Delete user error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.delete("/api/admin/conversations/:userId", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const success = await deleteChatConversation(userId);
      if (success) {
        res.json({ success: true, message: "Chat conversation deleted successfully" });
      } else {
        res.status(404).json({ error: "Conversation not found or could not be deleted" });
      }
    } catch (err) {
      console.error("Delete conversation error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await getAllCourses();
      res.json({ courses });
    } catch (err) {
      console.error("Get courses error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/courses", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { title, slug, image, price, duration, weeks, certificates, desc1, desc2 } = req.body;
      if (!title || !slug || !image || !price || !duration || !weeks || !certificates || !desc1 || !desc2) {
        res.status(400).json({ error: "All course fields are required" });
        return;
      }
      const newCourse = await addCourse({
        title,
        slug,
        image,
        price: Number(price),
        duration,
        weeks,
        certificates,
        desc1,
        desc2
      });
      res.status(201).json({ success: true, course: newCourse });
    } catch (err) {
      console.error("Add course error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.delete("/api/courses/:courseId", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const success = await deleteCourse(courseId);
      if (success) {
        res.json({ success: true, message: "Course deleted successfully" });
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (err) {
      console.error("Delete course error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/lessons", authenticateToken, async (req, res) => {
    try {
      const lessons = await getAllLessons();
      res.json({ lessons });
    } catch (err) {
      console.error("Get lessons error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/lessons/course/:courseTitle", authenticateToken, async (req, res) => {
    try {
      const { courseTitle } = req.params;
      const lessons = await getLessonsByCourse(courseTitle);
      res.json({ lessons });
    } catch (err) {
      console.error("Get course lessons error:", err);
      res.status(5e3).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/lessons", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { courseTitle, title, youtubeUrl, desc } = req.body;
      if (!courseTitle || !title || !youtubeUrl) {
        res.status(400).json({ error: "courseTitle, title, and youtubeUrl are required" });
        return;
      }
      const newLesson = await addLesson({
        courseTitle,
        title,
        youtubeUrl,
        desc: desc || ""
      });
      res.status(201).json({ success: true, lesson: newLesson });
    } catch (err) {
      console.error("Add lesson error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.delete("/api/lessons/:lessonId", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { lessonId } = req.params;
      const success = await deleteLesson(lessonId);
      if (success) {
        res.json({ success: true, message: "Lesson deleted successfully" });
      } else {
        res.status(404).json({ error: "Lesson not found" });
      }
    } catch (err) {
      console.error("Delete lesson error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite development server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production assets from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EduWell application listening on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Critical server failure:", err);
});
//# sourceMappingURL=server.js.map
