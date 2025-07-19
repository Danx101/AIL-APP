// Customer API Service for appointment management
class CustomerAPI {
    constructor() {
        this.baseURL = 'http://localhost:3001/api/v1';
    }

    // Get authentication headers
    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        console.log('CustomerAPI: Using token:', token ? 'Token exists' : 'No token found');
        
        // Check if user is actually a customer
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('CustomerAPI: Current user:', user);
        console.log('CustomerAPI: User role:', user.role);
        
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Get customer's appointments
    async getMyAppointments(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.from_date) params.append('from_date', filters.from_date);
            if (filters.to_date) params.append('to_date', filters.to_date);
            if (filters.status) params.append('status', filters.status);
            
            const url = `${this.baseURL}/appointments/customer/me${params.toString() ? '?' + params.toString() : ''}`;
            
            const response = await fetch(url, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch appointments: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching customer appointments:', error);
            throw error;
        }
    }

    // Get customer's associated studio
    async getMyStudio() {
        try {
            const response = await fetch(`${this.baseURL}/appointments/customer/me/studio`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch studio: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching customer studio:', error);
            throw error;
        }
    }

    // Get available studios (for appointment booking)
    async getAvailableStudios() {
        try {
            const response = await fetch(`${this.baseURL}/studios`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch studios: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching studios:', error);
            throw error;
        }
    }

    // Get appointment types for a studio
    async getStudioAppointmentTypes(studioId) {
        try {
            const response = await fetch(`${this.baseURL}/appointments/studio/${studioId}/appointment-types`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch appointment types: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching appointment types:', error);
            throw error;
        }
    }

    // Request new appointment
    async requestAppointment(appointmentData) {
        try {
            const response = await fetch(`${this.baseURL}/appointments`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(appointmentData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to create appointment: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating appointment:', error);
            throw error;
        }
    }

    // Update appointment (reschedule)
    async updateAppointment(appointmentId, updateData) {
        try {
            const response = await fetch(`${this.baseURL}/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update appointment: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating appointment:', error);
            throw error;
        }
    }

    // Cancel appointment
    async cancelAppointment(appointmentId) {
        try {
            const response = await fetch(`${this.baseURL}/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ status: 'cancelled' })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to cancel appointment: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            throw error;
        }
    }

    // Get studio availability for a specific date
    async getStudioAvailability(studioId, date) {
        try {
            const response = await fetch(`${this.baseURL}/appointments/studio/${studioId}?date=${date}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch availability: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching studio availability:', error);
            throw error;
        }
    }

    // Get customer profile
    async getProfile() {
        try {
            const response = await fetch(`${this.baseURL}/auth/profile`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch profile: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching profile:', error);
            throw error;
        }
    }
}

// Global instance
window.customerAPI = new CustomerAPI();