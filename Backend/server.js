import express from "express";
import cors from "cors";
import { initWhatsapp, getQrCode } from "./Whatsapp Module/whatsapp.js";

const app = express();
app.use(cors());
const ticketsFile = "./tickets.json";

// Start WhatsApp when server starts
initWhatsapp();

// API to fetch QR
app.get("/qr", (req, res) => {
  res.json({ qr: getQrCode() });
});



// POST /tickets → save new ticket
app.post("/tickets", (req, res) => {
  const { from, text } = req.body;

  const newTicket = {
    id: Date.now().toString(),
    from,
    message: text,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  let tickets = [];
  if (fs.existsSync(ticketsFile)) {
    tickets = JSON.parse(fs.readFileSync(ticketsFile));
  }
  tickets.push(newTicket);
  fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));

  console.log("🎟️ Ticket created:", newTicket);
  res.json({ success: true, ticket: newTicket });
});

// GET /tickets → view all tickets
app.get("/tickets", (req, res) => {
  if (!fs.existsSync(ticketsFile)) return res.json([]);
  const tickets = JSON.parse(fs.readFileSync(ticketsFile));
  res.json(tickets);
});


app.listen(4000, () => {
  console.log("🚀 Server running at http://localhost:4000");
});
