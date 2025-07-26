// Manager Dashboard for Google Sheets Integration Management
class ManagerDashboard {
    constructor() {
        this.integrations = [];
        this.stats = {};
        this.studios = [];
        this.activeTab = 'overview';
        this.loadingStates = {
            integrations: false,
            stats: false,
            studios: false
        };
    }

    // Initialize the dashboard
    async init() {
        console.log('Initializing Manager Dashboard...');
        
        // Verify manager role
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'manager') {
            window.location.href = '/';
            return;
        }

        this.render();
        this.setupEventListeners();
        await this.loadDashboardData();
    }

    // Setup event listeners for dashboard interactions
    setupEventListeners() {
        // Manager logout button
        const logoutBtn = document.getElementById('manager-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Manager logout button clicked');
                if (window.app && window.app.logout) {
                    window.app.logout();
                } else {
                    console.error('App logout method not available');
                    // Fallback logout
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    window.location.href = '/';
                }
            });
        } else {
            console.warn('Manager logout button not found');
        }
    }

    // Load all dashboard data
    async loadDashboardData() {
        await Promise.all([
            this.loadIntegrations(),
            this.loadStats(),
            this.loadStudios()
        ]);
        this.updateDashboard();
    }

    // Load Google Sheets integrations
    async loadIntegrations() {
        this.loadingStates.integrations = true;
        this.updateLoadingState('integrations');

        try {
            const response = await window.managerAPI.getGoogleSheetsIntegrations();
            this.integrations = response.integrations || [];
        } catch (error) {
            console.error('Error loading integrations:', error);
            this.showError('Failed to load Google Sheets integrations');
        } finally {
            this.loadingStates.integrations = false;
            this.updateLoadingState('integrations');
        }
    }

    // Load lead statistics
    async loadStats() {
        this.loadingStates.stats = true;
        this.updateLoadingState('stats');

        try {
            const response = await window.managerAPI.getAllLeadStats();
            this.stats = response.stats || {};
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showError('Failed to load statistics');
        } finally {
            this.loadingStates.stats = false;
            this.updateLoadingState('stats');
        }
    }

    // Load studios
    async loadStudios() {
        this.loadingStates.studios = true;
        this.updateLoadingState('studios');

        try {
            const response = await window.managerAPI.getAllStudios();
            this.studios = response.studios || [];
        } catch (error) {
            console.error('Error loading studios:', error);
            this.showError('Failed to load studios');
        } finally {
            this.loadingStates.studios = false;
            this.updateLoadingState('studios');
        }
    }

    // Render the main dashboard structure
    render() {
        const container = document.getElementById('app');
        container.innerHTML = `
            <div class="manager-dashboard">
                <!-- Sidebar Navigation -->
                <div class="sidebar">
                    <div class="sidebar-header p-3">
                        <div class="d-flex align-items-center">
                            <img src="/assets/images/LOgo AIL.png" alt="AIL Logo" class="logo-img me-2" style="width: 40px; height: 40px;">
                            <div class="sidebar-brand">
                                <h5 class="mb-0 text-primary fw-bold">Manager Portal</h5>
                                <small class="text-muted">Google Sheets Integration</small>
                            </div>
                        </div>
                    </div>
                    
                    <nav class="sidebar-nav flex-grow-1 p-2">
                        <ul class="nav nav-pills flex-column">
                            <li class="nav-item mb-1">
                                <a class="nav-link ${this.activeTab === 'overview' ? 'active' : ''}" 
                                   href="#" onclick="managerDashboard.switchTab('overview')">
                                    <i class="bi bi-grid-3x3-gap me-2"></i>
                                    Overview
                                </a>
                            </li>
                            <li class="nav-item mb-1">
                                <a class="nav-link ${this.activeTab === 'integrations' ? 'active' : ''}" 
                                   href="#" onclick="managerDashboard.switchTab('integrations')">
                                    <i class="bi bi-table me-2"></i>
                                    Google Sheets
                                </a>
                            </li>
                            <li class="nav-item mb-1">
                                <a class="nav-link ${this.activeTab === 'studios' ? 'active' : ''}" 
                                   href="#" onclick="managerDashboard.switchTab('studios')">
                                    <i class="bi bi-building me-2"></i>
                                    Studios
                                </a>
                            </li>
                            <li class="nav-item mb-1">
                                <a class="nav-link ${this.activeTab === 'wizard' ? 'active' : ''}" 
                                   href="#" onclick="managerDashboard.switchTab('wizard')">
                                    <i class="bi bi-plus-circle me-2"></i>
                                    Connect New Sheet
                                </a>
                            </li>
                        </ul>
                    </nav>
                    
                    <div class="sidebar-footer p-3 border-top">
                        <div class="d-flex align-items-center">
                            <div class="me-2">
                                <i class="bi bi-person-circle text-primary" style="font-size: 2rem;"></i>
                            </div>
                            <div class="flex-grow-1">
                                <small class="text-muted d-block">Manager</small>
                                <small class="fw-bold">${JSON.parse(localStorage.getItem('user') || '{}').name || 'Manager'}</small>
                            </div>
                            <button class="btn btn-outline-danger btn-sm" id="manager-logout-btn">
                                <i class="bi bi-box-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="main-content">
                    <div class="container-fluid p-4">
                        <div id="dashboard-content">
                            <!-- Dynamic content will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderTabContent();
    }

    // Switch between tabs
    switchTab(tab) {
        this.activeTab = tab;
        
        // Update active nav links
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[onclick="managerDashboard.switchTab('${tab}')"]`).classList.add('active');

        this.renderTabContent();
    }

    // Render content based on active tab
    renderTabContent() {
        const contentContainer = document.getElementById('dashboard-content');
        
        switch (this.activeTab) {
            case 'overview':
                this.renderOverview();
                break;
            case 'integrations':
                this.renderIntegrations();
                break;
            case 'studios':
                this.renderStudios();
                break;
            case 'wizard':
                this.renderConnectionWizard();
                break;
            default:
                this.renderOverview();
        }
    }

    // Render overview tab
    renderOverview() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h3 mb-0">
                        <i class="bi bi-grid-3x3-gap text-primary me-2"></i>
                        Dashboard Overview
                    </h2>
                    <p class="text-muted mb-0">Google Sheets integration management</p>
                </div>
            </div>

            <!-- Statistics Cards -->
            <div class="row g-3 mb-4">
                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="icon-circle bg-primary bg-opacity-10">
                                        <i class="bi bi-table text-primary"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <div class="fw-bold text-primary fs-4" id="total-integrations">
                                        ${this.loadingStates.integrations ? '...' : this.integrations.length}
                                    </div>
                                    <div class="text-muted small">Active Integrations</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="icon-circle bg-success bg-opacity-10">
                                        <i class="bi bi-people text-success"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <div class="fw-bold text-success fs-4" id="total-leads">
                                        ${this.loadingStates.stats ? '...' : (this.stats.totalLeads || 0)}
                                    </div>
                                    <div class="text-muted small">Total Leads</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="icon-circle bg-warning bg-opacity-10">
                                        <i class="bi bi-calendar-week text-warning"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <div class="fw-bold text-warning fs-4" id="leads-this-week">
                                        ${this.loadingStates.stats ? '...' : (this.stats.leadsThisWeek || 0)}
                                    </div>
                                    <div class="text-muted small">This Week</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="flex-shrink-0">
                                    <div class="icon-circle bg-info bg-opacity-10">
                                        <i class="bi bi-building text-info"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                    <div class="fw-bold text-info fs-4" id="total-studios">
                                        ${this.loadingStates.studios ? '...' : this.studios.length}
                                    </div>
                                    <div class="text-muted small">Studios</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="row">
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-transparent border-0">
                            <h5 class="card-title mb-0">
                                <i class="bi bi-table me-2"></i>
                                Recent Integrations
                            </h5>
                        </div>
                        <div class="card-body">
                            <div id="recent-integrations">
                                ${this.renderRecentIntegrations()}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-transparent border-0">
                            <h5 class="card-title mb-0">
                                <i class="bi bi-lightning me-2"></i>
                                Quick Actions
                            </h5>
                        </div>
                        <div class="card-body">
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary" onclick="managerDashboard.switchTab('wizard')">
                                    <i class="bi bi-plus-circle me-2"></i>
                                    Connect New Sheet
                                </button>
                                <button class="btn btn-outline-primary" onclick="managerDashboard.syncAllIntegrations()">
                                    <i class="bi bi-arrow-clockwise me-2"></i>
                                    Sync All Sheets
                                </button>
                                <button class="btn btn-outline-secondary" onclick="managerDashboard.loadDashboardData()">
                                    <i class="bi bi-arrow-clockwise me-2"></i>
                                    Refresh Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Render integrations tab
    renderIntegrations() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h3 mb-0">
                        <i class="bi bi-table text-primary me-2"></i>
                        Google Sheets Integrations
                    </h2>
                    <p class="text-muted mb-0">Manage all Google Sheets connections</p>
                </div>
                <div class="col-auto">
                    <button class="btn btn-primary" onclick="managerDashboard.switchTab('wizard')">
                        <i class="bi bi-plus-circle me-2"></i>
                        Connect New Sheet
                    </button>
                </div>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div id="integrations-table">
                        ${this.renderIntegrationsTable()}
                    </div>
                </div>
            </div>
        `;
    }

    // Render studios tab
    renderStudios() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h3 mb-0">
                        <i class="bi bi-building text-primary me-2"></i>
                        Studios
                    </h2>
                    <p class="text-muted mb-0">Overview of all studios in the system</p>
                </div>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div id="studios-table">
                        ${this.renderStudiosTable()}
                    </div>
                </div>
            </div>
        `;
    }

    // Render connection wizard
    renderConnectionWizard() {
        // Initialize the Google Sheets Wizard
        window.googleSheetsWizard.init();
    }

    // Render recent integrations
    renderRecentIntegrations() {
        if (this.loadingStates.integrations) {
            return '<div class="text-center py-3"><div class="spinner-border spinner-border-sm" role="status"></div></div>';
        }

        if (this.integrations.length === 0) {
            return '<p class="text-muted text-center py-3">No integrations found. Connect your first Google Sheet to get started.</p>';
        }

        const recent = this.integrations.slice(0, 5);
        return recent.map(integration => `
            <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
                <div>
                    <strong>${integration.sheet_name || 'Untitled Sheet'}</strong>
                    <br>
                    <small class="text-muted">${integration.studio_name || 'Unknown Studio'}</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-${integration.sync_status === 'active' ? 'success' : 'warning'}">
                        ${integration.sync_status || 'Unknown'}
                    </span>
                    <br>
                    <small class="text-muted">
                        ${integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleDateString() : 'Never'}
                    </small>
                </div>
            </div>
        `).join('');
    }

    // Render integrations table
    renderIntegrationsTable() {
        if (this.loadingStates.integrations) {
            return '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';
        }

        if (this.integrations.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="bi bi-table display-4 text-muted mb-3"></i>
                    <h4 class="text-muted">No Google Sheets Connected</h4>
                    <p class="text-muted">Connect your first Google Sheet to start importing leads.</p>
                    <button class="btn btn-primary" onclick="managerDashboard.switchTab('wizard')">
                        <i class="bi bi-plus-circle me-2"></i>
                        Connect New Sheet
                    </button>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Sheet Name</th>
                            <th>Studio</th>
                            <th>Status</th>
                            <th>Last Sync</th>
                            <th>Auto Sync</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.integrations.map(integration => `
                            <tr>
                                <td>
                                    <strong>${integration.sheet_name || 'Untitled Sheet'}</strong>
                                    <br>
                                    <small class="text-muted">${integration.sheet_id}</small>
                                </td>
                                <td>${integration.studio_name || 'Unknown Studio'}</td>
                                <td>
                                    <span class="badge bg-${integration.sync_status === 'active' ? 'success' : 'warning'}">
                                        ${integration.sync_status || 'Unknown'}
                                    </span>
                                </td>
                                <td>
                                    ${integration.last_sync_at ? 
                                        new Date(integration.last_sync_at).toLocaleString() : 
                                        '<span class="text-muted">Never</span>'}
                                </td>
                                <td>
                                    <span class="badge bg-${integration.auto_sync_enabled ? 'success' : 'secondary'}">
                                        ${integration.auto_sync_enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" 
                                                onclick="managerDashboard.syncIntegration(${integration.id})"
                                                title="Manual Sync">
                                            <i class="bi bi-arrow-clockwise"></i>
                                        </button>
                                        <button class="btn btn-outline-secondary" 
                                                onclick="managerDashboard.editIntegration(${integration.id})"
                                                title="Edit">
                                            <i class="bi bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" 
                                                onclick="managerDashboard.deleteIntegration(${integration.id})"
                                                title="Delete">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Render studios table
    renderStudiosTable() {
        if (this.loadingStates.studios) {
            return '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';
        }

        if (this.studios.length === 0) {
            return '<p class="text-muted text-center py-4">No studios found.</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Studio Name</th>
                            <th>Address</th>
                            <th>Owner</th>
                            <th>Integrations</th>
                            <th>Total Leads</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.studios.map(studio => {
                            const studioIntegrations = this.integrations.filter(i => i.studio_id === studio.id);
                            return `
                                <tr>
                                    <td>
                                        <strong>${studio.name}</strong>
                                        <br>
                                        <small class="text-muted">ID: ${studio.id}</small>
                                    </td>
                                    <td>${studio.address || 'N/A'}</td>
                                    <td>${studio.owner_name || 'N/A'}</td>
                                    <td>
                                        <span class="badge bg-primary">${studioIntegrations.length}</span>
                                    </td>
                                    <td>
                                        <span class="badge bg-success">${studio.total_leads || 0}</span>
                                    </td>
                                    <td>
                                        <span class="badge bg-success">Active</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Update dashboard data
    updateDashboard() {
        this.renderTabContent();
    }

    // Update loading states
    updateLoadingState(type) {
        // This method can be expanded to show specific loading indicators
        console.log(`Loading state for ${type}:`, this.loadingStates[type]);
    }

    // Manual sync specific integration
    async syncIntegration(integrationId) {
        try {
            const button = event.target.closest('button');
            const originalContent = button.innerHTML;
            button.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
            button.disabled = true;

            await window.managerAPI.triggerManualSync(integrationId);
            this.showSuccess('Manual sync completed successfully');
            await this.loadIntegrations();
            this.updateDashboard();
        } catch (error) {
            console.error('Error syncing integration:', error);
            this.showError('Failed to sync integration: ' + error.message);
        } finally {
            const button = event.target.closest('button');
            button.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
            button.disabled = false;
        }
    }

    // Sync all integrations
    async syncAllIntegrations() {
        try {
            const button = event.target;
            const originalContent = button.innerHTML;
            button.innerHTML = '<i class="bi bi-arrow-clockwise spin me-2"></i>Syncing...';
            button.disabled = true;

            const syncPromises = this.integrations.map(integration => 
                window.managerAPI.triggerManualSync(integration.id)
            );

            await Promise.allSettled(syncPromises);
            this.showSuccess('All integrations synced successfully');
            await this.loadDashboardData();
        } catch (error) {
            console.error('Error syncing all integrations:', error);
            this.showError('Failed to sync all integrations');
        } finally {
            const button = event.target;
            button.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Sync All Sheets';
            button.disabled = false;
        }
    }

    // Edit integration (placeholder)
    editIntegration(integrationId) {
        this.showInfo('Edit integration feature will be implemented in the next phase');
    }

    // Delete integration
    async deleteIntegration(integrationId) {
        if (!confirm('Are you sure you want to delete this Google Sheets integration? This action cannot be undone.')) {
            return;
        }

        try {
            await window.managerAPI.deleteGoogleSheetsIntegration(integrationId);
            this.showSuccess('Integration deleted successfully');
            await this.loadIntegrations();
            this.updateDashboard();
        } catch (error) {
            console.error('Error deleting integration:', error);
            this.showError('Failed to delete integration: ' + error.message);
        }
    }

    // Utility methods for notifications
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'danger');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type) {
        // Create toast notification
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1100';
        document.body.appendChild(container);
        return container;
    }
}

// Global instance
window.managerDashboard = new ManagerDashboard();