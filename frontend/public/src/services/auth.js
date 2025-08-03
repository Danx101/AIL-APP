// Dynamic API base URL based on environment
if (typeof API_BASE_URL === 'undefined') {
  window.API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001'
    : 'https://ail-app-production.up.railway.app';
}

class AuthService {
  constructor() {
    this.token = localStorage.getItem('authToken') || localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  // Register new user
  async register(userData) {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store token and user data
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('authToken', this.token);
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token and user data
      this.token = data.token;
      this.user = data.user;
      console.log('Login successful, user role:', this.user.role);
      console.log('Full user data:', this.user);
      
      localStorage.setItem('authToken', this.token);
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Logout user
  async logout() {
    try {
      if (this.token) {
        await fetch(`${window.API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local storage regardless of server response
      this.token = null;
      this.user = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  // Get current user profile
  async getProfile() {
    try {
      if (!this.token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.logout(); // Token expired or invalid
          throw new Error('Session expired');
        }
        throw new Error(data.message || 'Failed to get profile');
      }

      this.user = data.user;
      localStorage.setItem('user', JSON.stringify(this.user));

      return data.user;
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  async updateProfile(profileData) {
    try {
      if (!this.token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          throw new Error('Session expired');
        }
        throw new Error(data.message || 'Failed to update profile');
      }

      // Refresh profile data
      await this.getProfile();

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Get user role
  getUserRole() {
    return this.user?.role || null;
  }

  // Check if user has specific role
  hasRole(role) {
    return this.user?.role === role;
  }

  // Get auth token
  getToken() {
    return this.token;
  }

  // Create authenticated fetch request
  async authenticatedFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.logout();
      throw new Error('Session expired');
    }

    return response;
  }

  // Validate token on app start
  async validateToken() {
    if (!this.token) {
      return false;
    }

    try {
      await this.getProfile();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const authService = new AuthService();

// For browser compatibility without module bundler
if (typeof module !== 'undefined' && module.exports) {
  module.exports = authService;
} else {
  window.authService = authService;
  console.log('AuthService loaded and attached to window');
}