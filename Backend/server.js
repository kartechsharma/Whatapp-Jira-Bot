import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import multer from "multer";
import path from "path";
import { initWhatsapp, getQrCode } from "./Whatsapp Module/whatsapp.js";
// import {
//   createJiraIssue,
//   getJiraIssue,
//   updateJiraIssue,
//   deleteJiraIssue,
//   searchJiraIssues,
//   addJiraComment,
//   addJiraAttachment,
//   getJiraProject,
//   getJiraUsers
// } from "./jira_Module/jira.js";


// // Setup multer for attachments
// const upload = multer({ dest: 'uploads/' });

dotenv.config(); // Load .env variables

const app = express();
//app.use(cors());
app.use(cors({
  origin: 'http://localhost:3000', // or your frontend URL
  credentials: true
}));
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb'
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ========================
// 🔹 MongoDB Connection
// ========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ========================
// 🔹 Ticket Schema & Model
// ========================
const ticketSchema = new mongoose.Schema({
  from: { type: String, required: true },
  type: { type: String, default: "text" }, // "text", "image/png", "video/mp4", etc.
  message: { type: String, default: null }, // text or caption
  media: {
    mimetype: { type: String, default: null },
    data: { type: String, default: null }, // Base64
    filepath: { type: String, default: null } // Add this line
  },
  status: { type: String, default: "open" }, // "open", "closed"
  createdAt: { type: Date, default: Date.now },
});

const Ticket = mongoose.model("Ticket", ticketSchema);

// ========================
// 🔹 Start WhatsApp Session
// ========================
initWhatsapp()
  .then(() => console.log("📲 WhatsApp client initialized"))
  .catch((err) => console.error("❌ WhatsApp init error:", err));

// ========================
// 🔹 API Routes
// ========================

// Get QR code
// app.get("/qr", (req, res) => {
//   const qr = getQrCode();
//   console.log("📌 QR requested:", qr ? "Available" : "Not available");
//   res.json({ success: true, qr });
// });
// Get QR code
app.get("/qr", (req, res) => {
  // Prevent caching
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  const qr = getQrCode();
  console.log("📌 QR requested:", qr ? "Available" : "Not available");
  
  if (!qr) {
    return res.status(404).json({ 
      success: false, 
      message: "QR not available yet" 
    });
  }

  res.json({ success: true, qr });
});


// Create Ticket (POST)
app.post("/tickets", async (req, res) => {
  try {
    console.log('📨 Received ticket request:', {
      from: req.body.from,
      type: req.body.type,
      hasMedia: req.body.media ? 'Yes' : 'No',
      mediaType: req.body.media?.mimetype || 'None'
    });

    const { from, text, media, type } = req.body;
    
    if (!from) {
      return res.status(400).json({ success: false, error: "from is required" });
    }

    // Create ticket object with safe media handling
    const ticketData = {
      from,
      type: type || "text",
      message: text || null,
      media: null
    };

    // Handle media if present
    if (media && media.data && media.mimetype) {
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const ext = media.mimetype.split('/')[1];
      const filepath = path.join(uploadsDir, `${filename}.${ext}`);
      
      // Save file to disk
      fs.writeFileSync(filepath, Buffer.from(media.data, 'base64'));

      ticketData.media = {
        mimetype: media.mimetype,
        data: media.data,
        filepath: `/uploads/${filename}.${ext}`
      };
    }

    const newTicket = new Ticket(ticketData);
    await newTicket.save();

    // Modify the ticket creation response logging
    console.log("✅ Ticket created successfully:", {
      id: newTicket._id,
      from: newTicket.from,
      type: newTicket.type,
      hasMedia: !!newTicket.media,
      mediaPath: newTicket.media?.filepath || 'No media'
    });

    // Enhanced response object
    const responseTicket = {
      ...newTicket.toObject(),
      media: newTicket.media ? {
        mimetype: newTicket.media.mimetype,
        url: newTicket.media.filepath ? `/media/${newTicket._id}` : null,
        filepath: newTicket.media.filepath || null
      } : null
    };

    console.log('📎 Media details:', {
      hasMedia: !!newTicket.media,
      filepath: newTicket.media?.filepath || 'None',
      url: newTicket.media ? `/media/${newTicket._id}` : 'None'
    });

    res.json({ 
      success: true, 
      ticket: responseTicket
    });

  } catch (err) {
    console.error("❌ Error creating ticket:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message
    });
  }
});

// Add a test endpoint for media validation
app.post("/test-media", (req, res) => {
  const { media } = req.body;
  console.log('📝 Testing media:', {
    receivedFields: Object.keys(req.body),
    mediaPresent: !!media,
    mediaFields: media ? Object.keys(media) : [],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });
  
  res.json({
    success: true,
    mediaReceived: !!media,
    mediaDetails: media ? {
      mimetype: media.mimetype,
      dataLength: media.data?.length || 0
    } : null
  });
});

// Add a new endpoint to get media file path
app.get("/tickets/:id/media-path", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || !ticket.media) {
      return res.status(404).json({ success: false, error: "Media not found" });
    }
    res.json({
      success: true,
      filepath: ticket.media.filepath,
      url: `/media/${ticket._id}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// // -------------------- Jira Endpoints --------------------

// // Create Issue
// app.post("/create-issue", async (req, res) => {
//   const { summary, description, issueType, projectKey } = req.body;
//   if (!summary || !description || !issueType) {
//     return res.status(400).json({ success: false, error: 'summary, description, and issueType are required' });
//   }
//   try {
//     const issue = await createJiraIssue({ summary, description, issueType }, projectKey || 'KAN');
//     res.json({ success: true, issue });
//   } catch (err) {
//     console.error("Error creating Jira issue:", err.response?.data || err.message);
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Get Issue
// app.get("/issue/:id", async (req, res) => {
//   try {
//     const issue = await getJiraIssue(req.params.id);
//     res.json({ success: true, issue });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Update Issue
// app.put("/issue/:id", async (req, res) => {
//   try {
//     const issue = await updateJiraIssue(req.params.id, req.body);
//     res.json({ success: true, issue });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Delete Issue
// app.delete("/issue/:id", async (req, res) => {
//   try {
//     const result = await deleteJiraIssue(req.params.id);
//     res.json({ success: true, result });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Search Issues
// app.post("/search", async (req, res) => {
//   try {
//     const issues = await searchJiraIssues(req.body.jql, req.body.maxResults);
//     res.json({ success: true, issues });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Add Comment
// app.post("/issue/:id/comment", async (req, res) => {
//   const { comment } = req.body;
//   if (!comment) return res.status(400).json({ success: false, error: 'comment is required' });
//   try {
//     const result = await addJiraComment(req.params.id, comment);
//     res.json({ success: true, result });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Add Attachment
// app.post("/issue/:id/attachment", upload.single('file'), async (req, res) => {
//   if (!req.file) return res.status(400).json({ success: false, error: 'file is required' });
//   try {
//     const result = await addJiraAttachment(req.params.id, req.file.path);
//     res.json({ success: true, result });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Get Project Details
// app.get("/project/:key", async (req, res) => {
//   try {
//     const project = await getJiraProject(req.params.key);
//     res.json({ success: true, project });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// // Get Users
// app.get("/users", async (req, res) => {
//   const startAt = parseInt(req.query.startAt) || 0;
//   const maxResults = parseInt(req.query.maxResults) || 50;
//   try {
//     const users = await getJiraUsers(startAt, maxResults);
//     res.json({ success: true, users });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }
// });

// ========================
// 🔹 Start Express Server
// ========================
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
//     res.json({ success: true, users });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.response?.data || err.message });
//   }

// });

// ========================
// 🔹 Start Express Server
// ========================
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
