// Studio Owner Leads API Service - LOADED AT: 1753731733

class LeadsAPI {
    constructor() {
        // Dynamic API base URL based on environment
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api/v1'
            : 'https://ail-app-production.up.railway.app/api/v1';
    }

    // Get authentication headers
    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // ============= Lead Management =============

    // Get all leads for the studio owner's studio
    async getStudioLeads(studioId, filters = {}) {
        try {
            const params = new URLSearchParams();
            
            // Add filters
            if (filters.search) params.append('search', filters.search);
            if (filters.status) params.append('status', filters.status);
            if (filters.source) params.append('source', filters.source);
            if (filters.from_date) params.append('from_date', filters.from_date);
            if (filters.to_date) params.append('to_date', filters.to_date);
            if (filters.limit) params.append('limit', filters.limit);
            if (filters.offset) params.append('offset', filters.offset);

            const url = `${this.baseURL}/leads/studio/${studioId}${params.toString() ? '?' + params.toString() : ''}`;
            
            const response = await fetch(url, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch leads: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching studio leads:', error);
            throw error;
        }
    }

    // Add a manual lead
    async addManualLead(leadData) {
        try {
            const response = await fetch(`${this.baseURL}/leads`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(leadData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add lead: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error adding manual lead:', error);
            throw error;
        }
    }

    // Update a lead (manual leads only)
    async updateLead(leadId, updateData) {
        try {
            const response = await fetch(`${this.baseURL}/leads/${leadId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update lead: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating lead:', error);
            throw error;
        }
    }

    // Update lead status
    async updateLeadStatus(leadId, status, notes = '') {
        try {
            // Status values now match directly with database
            const dbStatus = status;

            const response = await fetch(`${this.baseURL}/leads/${leadId}/status`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ status: dbStatus, notes })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update lead status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating lead status:', error);
            throw error;
        }
    }

    // Get lead details
    async getLeadDetails(leadId) {
        try {
            const response = await fetch(`${this.baseURL}/leads/${leadId}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch lead details: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching lead details:', error);
            throw error;
        }
    }

    // ============= Call Management (when Twilio is ready) =============

    // Initiate call to lead
    async initiateCall(leadId) {
        try {
            const response = await fetch(`${this.baseURL}/leads/${leadId}/call`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to initiate call: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error initiating call:', error);
            throw error;
        }
    }

    // Get call history for a lead
    async getLeadCallHistory(leadId) {
        try {
            const response = await fetch(`${this.baseURL}/leads/${leadId}/calls`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch call history: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching call history:', error);
            throw error;
        }
    }

    // ============= Lead Statistics =============

    // Get lead statistics for studio
    async getLeadStats(studioId) {
        try {
            const response = await fetch(`${this.baseURL}/leads/studio/${studioId}/stats`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch lead stats: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching lead stats:', error);
            throw error;
        }
    }

    // ============= Utility Methods =============

    // Validate phone number format
    validatePhoneNumber(phoneNumber) {
        if (!phoneNumber) return false;
        
        // Basic validation for international format
        const phoneRegex = /^\+?[1-9]\d{7,14}$/;
        return phoneRegex.test(phoneNumber.replace(/[^\d+]/g, ''));
    }

    // Validate email format
    validateEmail(email) {
        if (!email) return true; // Email is optional
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Format phone number for display
    formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return '';
        
        // Simple formatting for German numbers
        const cleaned = phoneNumber.replace(/[^\d+]/g, '');
        if (cleaned.startsWith('+49')) {
            return `+49 ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
        }
        return phoneNumber;
    }

    // Get lead source display name
    getSourceDisplayName(source) {
        const sourceMap = {
            'google_sheets': 'Google Sheets',
            'manual': 'Manual Entry',
            'api': 'API Import',
            'csv': 'CSV Import'
        };
        
        return sourceMap[source] || source || 'Unknown';
    }

    // Get status badge class
    getStatusBadgeClass(status) {
        const statusClasses = {
            'neu': 'bg-primary',
            'kontaktiert': 'bg-warning text-dark',
            'konvertiert': 'bg-success'
        };
        return statusClasses[status] || 'bg-secondary';
    }

    // Get status display name
    getStatusDisplayName(status) {
        const statusNames = {
            'neu': 'Neu',
            'kontaktiert': 'Kontaktiert',
            'konvertiert': 'Konvertiert'
        };
        return statusNames[status] || status || 'Unbekannt';
    }

    // Get available status options
    getAvailableStatuses() {
        const options = [
            { value: 'neu', label: 'Neu' },
            { value: 'kontaktiert', label: 'Kontaktiert' },
            { value: 'konvertiert', label: 'Konvertiert' }
        ];
        return options;
    }
}

// Global instance
window.leadsAPI = new LeadsAPI();
