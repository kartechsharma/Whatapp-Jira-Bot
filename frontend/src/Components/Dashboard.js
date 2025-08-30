import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = () => {
  const [ticketDraft, setTicketDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("latest");
  const [pendingTickets, setPendingTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [isPushing, setIsPushing] = useState(false);
  const [isSavingPending, setIsSavingPending] = useState(false);

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
      setIsPushing(true);
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
      setIsPushing(false);
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
    return (
      <div className="dashboard-loading">
        <div className="loader"></div>
        <p>Generating ticket draft...</p>
      </div>
    );
  }

  if (error) return <div className="dashboard-error">Error: {error}</div>;

  // Helper: Render ticket list
  const renderTickets = (tickets, title, showPushButton = false) => (
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
                {template.jiraKey && (
                  <span className="jira-key">{template.jiraKey}</span>
                )}
                {showPushButton && !template.jiraKey && (
                  <button 
                    className="push-to-jira-btn"
                    onClick={() => pushToJira(template._id)}
                    disabled={isPushing}
                  >
                    {isPushing ? 'Pushing...' : 'Push to Jira'}
                  </button>
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
      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === "latest" ? "active" : ""}
          onClick={() => setActiveTab("latest")}
        >
          Latest Draft
        </button>
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
      {activeTab === "latest" && (
        ticketDraft ? (
          <div className="ticket-draft">
            <h2>Latest Ticket Draft</h2>
            <div className="ticket-info">
              <div className="info-row">
                <span className="label">Summary:</span>
                <span className="value">{ticketDraft.summary}</span>
              </div>
              <div className="info-row">
                <span className="label">Issue Type:</span>
                <span className="value">{ticketDraft.issueType}</span>
              </div>
              <div className="info-row">
                <span className="label">Priority:</span>
                <span className="value">
                  <span className={`priority-badge priority-${ticketDraft.priority.toLowerCase()}`}>
                    {ticketDraft.priority}
                  </span>
                </span>
              </div>
              <div className="info-row description">
                <span className="label">Description:</span>
                <div className="value">{ticketDraft.description}</div>
              </div>
              <div className="info-row actions">
                {ticketDraft && (
                  <>
                    <button 
                      className="push-to-jira-btn"
                      onClick={() => pushToJira(ticketDraft._id)}
                      disabled={isPushing}
                    >
                      {isPushing ? 'Pushing to Jira...' : 'Push to Jira'}
                    </button>
                    <button 
                      className="move-to-pending-btn"
                      onClick={() => saveAsPending(ticketDraft)}
                      disabled={isPushing || isSavingPending}
                    >
                      {isSavingPending ? 'Saving...' : 'Move to Pending'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-ticket">No ticket draft available</div>
        )
      )}

      {activeTab === "pending" && renderTickets(pendingTickets, "Pending Tickets", true)}
      {activeTab === "completed" && renderTickets(completedTickets, "Completed Tickets", false)}
    </div>
  );
};

export default Dashboard;