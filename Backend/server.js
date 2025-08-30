import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import multer from "multer";
import path from "path";
import { initWhatsapp, getQrCode, sendMessage } from "./Whatsapp Module/whatsapp.js";
import { generateTicketDraft } from "./AI integration/jiradraft.js";
import {
  createJiraIssue,
  addJiraAttachment
} from "./jira_Module/jira.js";


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
// 🔹 Jira Template Schema & Model
// ========================
const jiraTemplateSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  summary: { type: String, required: true },
  description: { type: String, required: true },
  issueType: { type: String, required: true },
  priority: { type: String },
  jiraKey: { type: String },
  status: { type: Number, default: 0 }, // 0: template only, 1: pushed to Jira
  createdAt: { type: Date, default: Date.now },
});

const JiraTemplate = mongoose.model("JiraTemplate", jiraTemplateSchema);

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

    // Forward to generate-ticket endpoint for Jira ticket creation
    try {
      const generateTicketResponse = await fetch('http://localhost:4000/generate-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          from: from,
          type: type,
          media: ticketData.media,
          ticketId: newTicket._id
        })
      });

      if (!generateTicketResponse.ok) {
        console.error('⚠️ Warning: Failed to generate Jira ticket:', await generateTicketResponse.text());
      } else {
        console.log('✅ Jira ticket generation initiated');
      }
    } catch (genError) {
      console.error('⚠️ Error forwarding to ticket generation:', genError);
    }

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


 // -------------------- LLM Endpoints --------------------

// POST /generate-ticket → Generate Jira ticket template and create issue
// Store the latest ticket draft
let latestTicketDraft = null;
const ticketUpdateClients = new Set();

// SSE endpoint for real-time ticket updates
app.get('/ticket-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  ticketUpdateClients.add(res);
  
  req.on('close', () => {
    ticketUpdateClients.delete(res);
  });
});

// Get latest ticket draft
app.get('/latest-ticket-draft', (req, res) => {
  if (latestTicketDraft) {
    res.json({ success: true, ticket: latestTicketDraft });
  } else {
    res.status(404).json({ success: false, error: 'No ticket draft available' });
  }
});

// Get Jira template for a specific ticket
app.get('/ticket/:ticketId/jira-template', async (req, res) => {
  try {
    const template = await JiraTemplate.findOne({ ticketId: req.params.ticketId })
      .sort({ createdAt: -1 }); // Get the most recent template if multiple exist
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        error: 'No Jira template found for this ticket' 
      });
    }
    
    res.json({ success: true, template });
  } catch (err) {
    console.error('❌ Error fetching Jira template:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Save template as pending
app.post('/save-as-pending', async (req, res) => {
  try {
    const { summary, description, issueType, priority, ticketId } = req.body;
    
    if (!ticketId || !summary || !description || !issueType) {
      return res.status(400).json({
        success: false,
        error: 'Required fields missing'
      });
    }

    // Create new template
    const jiraTemplate = new JiraTemplate({
      ticketId,
      summary,
      description,
      issueType,
      priority,
      status: 0 // Set as pending
    });
    
    await jiraTemplate.save();
    console.log('✅ Template saved as pending:', jiraTemplate._id);

    res.json({
      success: true,
      template: jiraTemplate
    });
  } catch (err) {
    console.error('❌ Error saving template as pending:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get all templates with status
app.get('/jira-templates', async (req, res) => {
  try {
    const templates = await JiraTemplate.find()
      .sort({ createdAt: -1 })
      .populate('ticketId', 'from message media'); // Include ticket details we need
    
    // Group templates by status
    const pendingTemplates = templates.filter(t => t.status === 0);
    const completedTemplates = templates.filter(t => t.status === 1);
    
    res.json({
      success: true,
      templates: {
        pending: pendingTemplates,
        completed: completedTemplates
      }
    });
  } catch (err) {
    console.error('❌ Error fetching templates:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Push template to Jira
app.post('/ticket/:templateId/push-to-jira', async (req, res) => {
  try {
    // Find the template
    const template = await JiraTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Check if already pushed to Jira
    if (template.status === 1) {
      return res.status(400).json({
        success: false,
        error: 'Template already pushed to Jira',
        jiraKey: template.jiraKey
      });
    }

    // Find the associated ticket for media info
    const ticket = await Ticket.findById(template.ticketId);

    // Create Jira issue
    const jiraIssue = await createJiraIssue({
      summary: template.summary,
      description: template.description,
      issueType: template.issueType,
      priority: template.priority
    });

    // If there's media, attach it to the Jira issue
    if (ticket?.media?.filepath) {
      try {
        await addJiraAttachment(jiraIssue.key, ticket.media.filepath);
        console.log('✅ Media attached to Jira issue');
      } catch (attachError) {
        console.error('⚠️ Failed to attach media:', attachError);
      }
    }

    // Update template with Jira key and status
    template.jiraKey = jiraIssue.key;
    template.status = 1;
    await template.save();

    // Send confirmation message back to WhatsApp
    if (ticket) {
      try {
        await sendMessage(ticket.from, 
          `✅ Ticket created in Jira!\nKey: ${jiraIssue.key}\nSummary: ${template.summary}`
        );
      } catch (whatsappError) {
        console.error('⚠️ Failed to send WhatsApp confirmation:', whatsappError);
      }
    }

    res.json({
      success: true,
      template,
      jiraIssue
    });

  } catch (err) {
    console.error('❌ Error pushing to Jira:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/generate-ticket", async (req, res) => {
  try {
    const { message, from, type, media, ticketId } = req.body;
    console.log('📝 Generating ticket for message:', { from, type, hasMedia: !!media, ticketId });

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Notify clients that generation has started
    ticketUpdateClients.forEach(client => {
      client.write(`event: generating\ndata: true\n\n`);
    });

    // Generate Jira ticket draft using AI
    const ticketDraft = await generateTicketDraft({
      message,
      from,
      type,
      hasAttachment: !!media,
      ticketId
    });
    
    // Store the ticket draft in MongoDB
    const jiraTemplate = new JiraTemplate({
      ticketId,
      summary: ticketDraft.summary,
      description: ticketDraft.description,
      issueType: ticketDraft.issueType,
      priority: ticketDraft.priority
    });
    await jiraTemplate.save();
    console.log('✅ Jira template saved to MongoDB:', jiraTemplate._id);
    
    // Store the latest ticket draft in memory for real-time updates with template ID
    latestTicketDraft = {
      ...ticketDraft,
      _id: jiraTemplate._id,
      ticketId: ticketId
    };
    
    // Notify all connected clients about the new ticket draft
    ticketUpdateClients.forEach(client => {
      client.write(`data: ${JSON.stringify({ ticket: latestTicketDraft })}\n\n`);
    });
    
    console.log('✅ AI generated ticket draft:', ticketDraft);

    // Return the generated template without creating Jira issue
    res.json({
      success: true,
      ticket: ticketDraft,
      template: jiraTemplate
    });

  } catch (err) {
    console.error("❌ Error generating ticket:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
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
