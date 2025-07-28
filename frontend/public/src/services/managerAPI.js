// Manager API Service for Google Sheets integration and lead management
class ManagerAPI {
    constructor() {
        // Dynamic API base URL based on environment
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api/v1'
            : 'https://ail-app-production.up.railway.app/api/v1';
    }

    // Get authentication headers with manager role validation
    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Validate manager role
        if (user.role !== 'manager') {
            throw new Error('Access denied: Manager role required');
        }
        
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // ============= Google Sheets Integration Management =============

    // Preview Google Sheet data before connecting
    async previewGoogleSheet(sheetUrl) {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets/preview`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ sheet_url: sheetUrl })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to preview sheet: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error previewing Google Sheet:', error);
            throw error;
        }
    }

    // Connect Google Sheet to a studio
    async connectGoogleSheet(studioId, sheetUrl, columnMapping, autoSyncEnabled = true) {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets/connect`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    studio_id: studioId,
                    sheet_url: sheetUrl,
                    column_mapping: columnMapping,
                    auto_sync_enabled: autoSyncEnabled
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to connect sheet: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error connecting Google Sheet:', error);
            throw error;
        }
    }

    // Get all Google Sheets integrations
    async getGoogleSheetsIntegrations() {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch integrations: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching Google Sheets integrations:', error);
            throw error;
        }
    }

    // Get specific Google Sheets integration
    async getGoogleSheetsIntegration(integrationId) {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets/${integrationId}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch integration: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching Google Sheets integration:', error);
            throw error;
        }
    }

    // Update Google Sheets integration
    async updateGoogleSheetsIntegration(integrationId, updateData) {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets/${integrationId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update integration: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating Google Sheets integration:', error);
            throw error;
        }
    }

    // Delete Google Sheets integration
    async deleteGoogleSheetsIntegration(integrationId) {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets/${integrationId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to delete integration: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting Google Sheets integration:', error);
            throw error;
        }
    }

    // Trigger manual sync for a Google Sheets integration
    async triggerManualSync(integrationId) {
        try {
            const response = await fetch(`${this.baseURL}/manager/google-sheets/${integrationId}/sync`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to trigger sync: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error triggering manual sync:', error);
            throw error;
        }
    }

    // ============= Lead Management Statistics =============

    // Get overall lead statistics across all studios
    async getAllLeadStats() {
        try {
            const response = await fetch(`${this.baseURL}/manager/leads/stats`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch lead statistics: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching lead statistics:', error);
            throw error;
        }
    }

    // ============= Studio Management =============

    // Get all studios (for manager oversight)
    async getAllStudios() {
        try {
            console.log('Fetching all studios from:', `${this.baseURL}/manager/studios`);
            console.log('Auth headers:', this.getAuthHeaders());
            
            const response = await fetch(`${this.baseURL}/manager/studios`, {
                headers: this.getAuthHeaders()
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response text:', errorText);
                throw new Error(`Failed to fetch studios: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Studios API result:', result);
            return result;
        } catch (error) {
            console.error('Error fetching studios:', error);
            throw error;
        }
    }

    // Get specific studio details
    async getStudio(studioId) {
        try {
            const response = await fetch(`${this.baseURL}/manager/studios/${studioId}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch studio: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching studio:', error);
            throw error;
        }
    }

    // ============= Utility Methods =============

    // Validate Google Sheets URL format
    validateGoogleSheetsUrl(url) {
        const patterns = [
            /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
            /spreadsheets\/d\/([a-zA-Z0-9-_]+)/
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    // Extract sheet ID from Google Sheets URL
    extractSheetId(url) {
        const patterns = [
            /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
            /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
            /^([a-zA-Z0-9-_]+)$/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        throw new Error('Invalid Google Sheets URL format');
    }
}

// Global instance for manager operations
window.managerAPI = new ManagerAPI();