import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = () => {
  const [ticketDraft, setTicketDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("pending"); // Changed default to pending
  const [pendingTickets, setPendingTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [isPushing, setIsPushing] = useState(false);
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [pushingTickets, setPushingTickets] = useState({}); // Add this state

  // Save template as pending
  const saveAsPending = async (draft) => {
    try {
      setIsSavingPending(true);
      const response = await fetch('http://localhost:4000/save-as-pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticketId: draft.ticketId,
          summary: draft.summary,
          description: draft.description,
          issueType: draft.issueType,
          priority: draft.priority
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save as pending');
      }

      // Refresh templates
      await fetchTemplates();
      
      // Switch to pending tab
      setActiveTab("pending");
      
      // Clear the latest draft
      setTicketDraft(null);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingPending(false);
    }
  };

  // Fetch latest draft ticket and its status
  const fetchLatestTicketDraft = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/latest-ticket-draft');
      //const response = fetchLatestTicketDraft();
      if (!response.ok) throw new Error('Failed to fetch ticket draft');
      const data = await response.json();
      
      if (data.ticket) {
        // The ticket already contains _id and ticketId from our server changes
        setTicketDraft(data.ticket);
      } else {
        setTicketDraft(null);
      }
    } catch (err) {
      setError(err.message);
      setTicketDraft(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all templates
  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:4000/jira-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      
      // Filter templates based on status
      setPendingTickets(data.templates.pending.filter(t => t.status === 0));
      setCompletedTickets(data.templates.completed.filter(t => t.status === 1));
    } catch (err) {
      setError(err.message);
    }
  };

  // Push template to Jira
  const pushToJira = async (templateId) => {
    if (!templateId) {
      setError("No template ID provided");
      return;
    }

    try {
      setPushingTickets(prev => ({ ...prev, [templateId]: true }));
      setError(null); // Clear any previous errors

      const response = await fetch(`http://localhost:4000/ticket/${templateId}/push-to-jira`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to push to Jira');
      }
      
      const result = await response.json();
      
      // Refresh all data
      await Promise.all([
        fetchTemplates(),
        fetchLatestTicketDraft()
      ]);

      // Show success message
      alert(`Successfully created Jira ticket: ${result.jiraIssue.key}`);
      
      // Clear the latest draft and switch to completed tab
      setTicketDraft(null);
      setActiveTab("completed");
    } catch (err) {
      setError(err.message);
      console.error('Error pushing to Jira:', err);
    } finally {
      setPushingTickets(prev => ({ ...prev, [templateId]: false }));
    }
  };

  // Add delete functionality
  const deleteTicket = async (templateId) => {
    if (!templateId) {
      setError("No template ID provided");
      return;
    }

    try {
      setPushingTickets(prev => ({ ...prev, [`delete_${templateId}`]: true }));
      setError(null);

      const response = await fetch(`http://localhost:4000/ticket/${templateId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete ticket');
      }

      // Refresh the templates after deletion
      await fetchTemplates();

    } catch (err) {
      setError(err.message);
      console.error('Error deleting ticket:', err);
    } finally {
      setPushingTickets(prev => ({ ...prev, [`delete_${templateId}`]: false }));
    }
  };

  useEffect(() => {
    fetchLatestTicketDraft();
    fetchTemplates();

    const eventSource = new EventSource('http://localhost:4000/ticket-updates');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTicketDraft(data.ticket);
      setIsGenerating(false);
      //window.location.reload();
      // Refresh templates when receiving updates
      fetchLatestTicketDraft();
    };

    eventSource.addEventListener('generating', () => setIsGenerating(true));
    eventSource.addEventListener('error', () => setIsGenerating(false));

    return () => eventSource.close();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loader"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (isGenerating) {
    fetchLatestTicketDraft();
    fetchTemplates();

    const eventSource = new EventSource('http://localhost:4000/ticket-updates');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTicketDraft(data.ticket);
      setIsGenerating(false);
      fetchLatestTicketDraft();
    };

    eventSource.addEventListener('generating', () => setIsGenerating(true));
    eventSource.addEventListener('error', () => setIsGenerating(false));

    return (
      <div className="dashboard-loading">
        <div className="loader"></div>
        <p>Generating ticket draft...</p>
      </div>
    );
  }

  if (error) return <div className="dashboard-error">Error: {error}</div>;

  // Helper: Render ticket list with push and delete buttons
  const renderTickets = (tickets, title, showActions = false) => (
    <div className="ticket-draft">
      <h2>{title}</h2>
      {tickets.length ? (
        <div className="ticket-list">
          {tickets.map(template => (
            <div key={template._id} className="ticket-item">
              <div className="ticket-summary">{template.summary}</div>
              <div className="ticket-details">
                <span className={`priority-badge priority-${template.priority?.toLowerCase()}`}>
                  {template.priority}
                </span>
                {showActions && (
                  <div className="ticket-actions">
                    <button 
                      className="push-to-jira-btn"
                      onClick={() => pushToJira(template._id)}
                      disabled={pushingTickets[template._id]}
                    >
                      {pushingTickets[template._id] ? 'Pushing...' : 'Push to Jira'}
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => deleteTicket(template._id)}
                      disabled={pushingTickets[`delete_${template._id}`]}
                    >
                      {pushingTickets[`delete_${template._id}`] ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
              <div className="ticket-description">
                {template.description}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-ticket">No tickets found</div>
      )}
    </div>
  );

  return (
    <div className="dashboard-container">
      <div className="tabs">
        <button
          className={activeTab === "pending" ? "active" : ""}
          onClick={() => setActiveTab("pending")}
        >
          Pending
        </button>
        <button
          className={activeTab === "completed" ? "active" : ""}
          onClick={() => setActiveTab("completed")}
        >
          Completed
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "pending" && renderTickets(pendingTickets, "Pending Tickets", true)}
      {activeTab === "completed" && renderTickets(completedTickets, "Completed Tickets", false)}
    </div>
  );
};

export default Dashboard;