import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';

dotenv.config({ path: '../.env' });

const JIRA_URL = process.env.jira_URL;
const AUTH = Buffer.from(`${process.env.jira_Email}:${process.env.jira_key}`).toString('base64');

const headers = {
    'Authorization': `Basic ${AUTH}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

const projectKey = 'KAN'; // Default project key

// -------------------- Issues --------------------

// Create a Jira issue
export async function createJiraIssue(issueData) {
    const url = `${JIRA_URL}/rest/api/3/issue`;
    const payload = {
        fields: {
            project: { key: projectKey },
            summary: issueData.summary,
            description: {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: issueData.description }]
                    }
                ]
            },
            issuetype: { name: issueData.issueType }
        }
    };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// Get an issue by ID or key
export async function getJiraIssue(issueIdOrKey) {
    const url = `${JIRA_URL}/rest/api/3/issue/${issueIdOrKey}`;
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// Update an issue
export async function updateJiraIssue(issueIdOrKey, updateData) {
    const url = `${JIRA_URL}/rest/api/3/issue/${issueIdOrKey}`;
    const payload = { fields: updateData };
    try {
        const response = await axios.put(url, payload, { headers });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// Delete an issue
export async function deleteJiraIssue(issueIdOrKey) {
    const url = `${JIRA_URL}/rest/api/3/issue/${issueIdOrKey}`;
    try {
        const response = await axios.delete(url, { headers });
        return response.data || { message: 'Issue deleted successfully' };
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// -------------------- Search --------------------

// Search issues using JQL
export async function searchJiraIssues(jql, maxResults = 50) {
    const url = `${JIRA_URL}/rest/api/3/search`;
    try {
        const response = await axios.post(url, { jql, maxResults }, { headers });
        return response.data.issues;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// -------------------- Comments --------------------

// Add a comment to an issue
export async function addJiraComment(issueIdOrKey, comment) {
    const url = `${JIRA_URL}/rest/api/3/issue/${issueIdOrKey}/comment`;
    const payload = { body: comment };
    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// -------------------- Attachments --------------------

// Add an attachment to an issue
export async function addJiraAttachment(issueIdOrKey, filePath) {
    const url = `${JIRA_URL}/rest/api/3/issue/${issueIdOrKey}/attachments`;
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(url, formData, {
            headers: {
                ...headers,
                'X-Atlassian-Token': 'no-check',
                ...formData.getHeaders()
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// -------------------- Projects --------------------

// Get project details
export async function getJiraProject(projectKey) {
    const url = `${JIRA_URL}/rest/api/3/project/${projectKey}`;
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}

// -------------------- Users --------------------

// Get all users
export async function getJiraUsers(startAt = 0, maxResults = 50) {
    const url = `${JIRA_URL}/rest/api/3/users/search?startAt=${startAt}&maxResults=${maxResults}`;
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
    }
}
// Get user details by accountId