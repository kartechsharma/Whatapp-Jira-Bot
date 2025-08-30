import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

dotenv.config();

// Types
/**
 * @typedef {Object} Ticket
 * @property {string} id - Unique identifier
 * @property {string} from - Source of the ticket
 * @property {string} message - Original message
 * @property {'open' | 'in_progress' | 'closed'} status - Ticket status
 * @property {string} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} JiraTicket
 * @property {string} summary - Brief title of the ticket
 * @property {string} description - Detailed description with acceptance criteria
 * @property {'High' | 'Medium' | 'Low'} priority - Ticket priority
 * @property {'Feature' | 'Bug' | 'Enhancement' | 'Task' | 'Technical Debt'} issueType - Type of the issue
 */

class TicketManager {
  constructor(storagePath = "./tickets.json") {
    this.storagePath = path.resolve(storagePath);
    this.ensureStorageExists();
  }

  ensureStorageExists() {
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify([], null, 2));
    }
  }

  /**
   * Save a new ticket
   * @param {string} from - Source of the ticket
   * @param {string} text - Ticket message
   * @returns {Ticket} Created ticket
   */
  saveTicket(from, text) {
    try {
      const newTicket = {
        id: Date.now().toString(),
        from,
        message: text,
        status: 'open',
        createdAt: new Date().toISOString()
      };

      const tickets = this.getAllTickets();
      tickets.push(newTicket);
      
      fs.writeFileSync(this.storagePath, JSON.stringify(tickets, null, 2));
      console.log("🎟️ Ticket created:", newTicket);
      
      return newTicket;
    } catch (error) {
      throw new Error(`Failed to save ticket: ${error.message}`);
    }
  }

  /**
   * Get all tickets
   * @returns {Ticket[]} Array of tickets
   */
  getAllTickets() {
    try {
      if (!fs.existsSync(this.storagePath)) return [];
      return JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
    } catch (error) {
      throw new Error(`Failed to get tickets: ${error.message}`);
    }
  }
}

class JiraTicketGenerator {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) throw new Error("Gemini API key is required");
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  }

  /**
   * Generate a Jira ticket draft from requirements
   * @param {Object} requirement - Raw requirement data
   * @returns {Promise<JiraTicket>} Generated ticket draft
   */
  async generateTicketDraft(requirement) {
    try {
      const prompt = this.buildPrompt(requirement);
      console.log("📝 Generated prompt:", prompt);

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      console.log("📝 Generated response:", responseText);

      return this.parseResponse(responseText);
    } catch (error) {
      throw new Error(`Failed to generate ticket: ${error.message}`);
    }
  }

  /**
   * Build the prompt for the AI model
   * @private
   * @param {Object} requirement - Raw requirement data
   * @returns {string} Formatted prompt
   */
  buildPrompt(requirement) {
    return `You are a Jira ticket creation assistant. Convert the following requirement into a structured Jira ticket.

Input: ${JSON.stringify(requirement, null, 2)}

Instructions: Analyze the requirement and generate a structured Jira ticket with:

1. Summary: Short, specific title that captures the core requirement
2. Description: Comprehensive explanation including:
   - Purpose and context
   - Functional expectations
   - Acceptance criteria (bullet points)
3. Priority: Based on urgency and impact (High/Medium/Low)
4. Issue Type: Feature, Bug, Enhancement, Task, or Technical Debt

Output Format:
{
  "summary": "<brief, specific title>",
  "description": "<detailed description with acceptance criteria>",
  "priority": "High|Medium|Low",
  "issueType": "<issue_type>"
}

Rules:
- No markdown formatting
- No code blocks or backticks
- No explanations outside the JSON
- No trailing commas
- Clean, actionable content suitable for sprint planning`;
  }

  /**
   * Parse and validate the AI response
   * @private
   * @param {string} response - Raw AI response
   * @returns {JiraTicket} Parsed and validated ticket
   */
  /**
   * Clean the response text by removing markdown and JSON formatting
   * @private
   * @param {string} text - Raw response text
   * @returns {string} Cleaned text
   */
  cleanResponseText(text) {
    // Remove ```json or ``` from start and end
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/, '');  // Remove ```json from start
    cleaned = cleaned.replace(/^```\s*/, '');      // Remove ``` from start
    cleaned = cleaned.replace(/\s*```$/, '');      // Remove ``` from end
    return cleaned;
  }

  /**
   * Parse and validate the AI response
   * @private
   * @param {string} response - Raw AI response
   * @returns {JiraTicket} Parsed and validated ticket
   */
  parseResponse(response) {
    try {
      // Clean the response text first
      const cleanedResponse = this.cleanResponseText(response);
      console.log("🧹 Cleaned response:", cleanedResponse);
      
      // Parse the cleaned JSON
      const ticket = JSON.parse(cleanedResponse);
      
      // Validate required fields
      const requiredFields = ['summary', 'description', 'priority', 'issueType'];
      for (const field of requiredFields) {
        if (!ticket[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return ticket;
    } catch (error) {
      throw new Error(`Invalid ticket format: ${error.message}`);
    }
  }
}

// Create instances
const ticketManager = new TicketManager();
const jiraGenerator = new JiraTicketGenerator();

// Export functionality
export const generateTicketDraft = (requirement) => jiraGenerator.generateTicketDraft(requirement);
export const saveTicket = (from, text) => ticketManager.saveTicket(from, text);
export const getAllTickets = () => ticketManager.getAllTickets();
