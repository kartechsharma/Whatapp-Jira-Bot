import express from 'express';
import Template from '../models/ticketModel.js';

const router = express.Router();

// ...existing routes...

// Delete a ticket
router.delete('/:id/delete', async (req, res) => {
  try {
    const ticketId = req.params.id;
    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Find and delete the ticket from MongoDB
    const deletedTicket = await Template.findByIdAndDelete(ticketId);
    
    if (!deletedTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ message: 'Ticket deleted successfully', ticketId });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

export default router;