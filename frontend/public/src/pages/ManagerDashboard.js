// Manager Dashboard for Google Sheets Integration Management
class ManagerDashboard {
    constructor() {
        this.integrations = [];
        this.stats = {};
        this.studios = [];
        this.activeTab = 'studios'; // Studios is now the default tab
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
                                <small class="text-muted">Studio Management</small>
                            </div>
                        </div>
                    </div>
                    
                    <nav class="sidebar-nav flex-grow-1 p-2">
                        <ul class="nav nav-pills flex-column">
                            <li class="nav-item mb-1">
                                <a class="nav-link ${this.activeTab === 'studios' ? 'active' : ''}" 
                                   href="#" onclick="managerDashboard.switchTab('studios')">
                                    <i class="bi bi-building me-2"></i>
                                    Studios
                                </a>
                            </li>
                            <li class="nav-item mb-1">
                                <a class="nav-link ${this.activeTab === 'promocodes' ? 'active' : ''}" 
                                   href="#" onclick="managerDashboard.switchTab('promocodes')">
                                    <i class="bi bi-ticket-perforated me-2"></i>
                                    Promo Codes
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
            case 'studios':
                this.renderStudios();
                break;
            case 'promocodes':
                this.renderPromoCodes();
                break;
            case 'overview':
                this.renderOverview();
                break;
            case 'integrations':
                this.renderIntegrations();
                break;
            case 'leads':
                this.renderLeads();
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
                                <button class="btn btn-primary" onclick="managerDashboard.showInfo('Google Sheets connection feature coming soon!')">
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
                    <button class="btn btn-primary" onclick="managerDashboard.showInfo('Google Sheets connection feature coming soon!')">
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

    // Render enhanced studios tab with search and filters
    renderStudios() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h3 mb-0">
                        <i class="bi bi-building text-primary me-2"></i>
                        Studio Management
                    </h2>
                    <p class="text-muted mb-0">Manage studios and their Google Sheets integrations</p>
                </div>
            </div>

            <!-- Search and Filter Bar -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <label class="form-label small text-muted">Search</label>
                            <input 
                                type="text" 
                                id="studio-search" 
                                class="form-control" 
                                placeholder="Search by name, owner, or address..."
                                onkeyup="managerDashboard.debounceSearch()"
                            />
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small text-muted">Address</label>
                            <input 
                                type="text" 
                                id="address-search" 
                                class="form-control" 
                                placeholder="Filter by address..."
                                onkeyup="managerDashboard.debounceSearch()"
                            />
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small text-muted">City</label>
                            <select id="city-filter" class="form-select" onchange="managerDashboard.applyFilters()">
                                <option value="">All Cities</option>
                                ${this.getUniqueCities().map(city => 
                                    `<option value="${city}">${city}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small text-muted">Google Sheets</label>
                            <select id="sheet-filter" class="form-select" onchange="managerDashboard.applyFilters()">
                                <option value="">All Studios</option>
                                <option value="true">Connected</option>
                                <option value="false">Not Connected</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small text-muted">&nbsp;</label>
                            <button onclick="managerDashboard.applyFilters()" class="btn btn-primary w-100">
                                <i class="bi bi-search me-2"></i>
                                Search
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Studios List -->
            <div id="studios-container">
                ${this.renderStudiosList()}
            </div>
        `;
        
        // Set up debounce for search
        this.searchTimeout = null;
    }

    // Render codes tab
    renderCodes() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h3 mb-0">
                        <i class="bi bi-key text-primary me-2"></i>
                        Studio Owner Codes
                    </h2>
                    <p class="text-muted mb-0">Generate activation codes for new studio owners</p>
                </div>
                <div class="col-auto">
                    <button class="btn btn-primary" onclick="managerDashboard.showCodeGenerationModal()">
                        <i class="bi bi-plus-circle me-2"></i>
                        Generate New Code
                    </button>
                </div>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div id="codes-table">
                        <div class="text-center py-4">
                            <div class="spinner-border" role="status"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.loadCodes();
    }

    // Render leads tab
    renderLeads() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h3 mb-0">
                        <i class="bi bi-people text-primary me-2"></i>
                        Lead Management
                    </h2>
                    <p class="text-muted mb-0">View and manage leads from Google Sheets imports</p>
                </div>
            </div>

            <!-- Studio Selection -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                    <div class="row align-items-end">
                        <div class="col-md-4">
                            <label class="form-label">Select Studio</label>
                            <select id="studio-select" class="form-select" onchange="managerDashboard.loadStudioLeads()">
                                <option value="">Choose a studio...</option>
                                ${this.studios.map(studio => `
                                    <option value="${studio.id}">${studio.name} - ${studio.city}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Filter by Source</label>
                            <select id="source-filter" class="form-select" onchange="managerDashboard.loadStudioLeads()">
                                <option value="">All Sources</option>
                                <option value="imported">Google Sheets</option>
                                <option value="manual">Manual Entry</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Filter by Status</label>
                            <select id="status-filter" class="form-select" onchange="managerDashboard.loadStudioLeads()">
                                <option value="">All Status</option>
                                <option value="neu">New</option>
                                <option value="kontaktiert">Contacted</option>
                                <option value="konvertiert">Converted</option>
                                <option value="nicht_interessiert">Not Interested</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-primary w-100" onclick="managerDashboard.refreshLeads()">
                                <i class="bi bi-arrow-clockwise me-2"></i>
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Lead Statistics -->
            <div id="lead-stats" class="row g-3 mb-4" style="display: none;">
                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="icon-circle bg-primary bg-opacity-10">
                                    <i class="bi bi-people text-primary"></i>
                                </div>
                                <div class="ms-3">
                                    <div class="fw-bold fs-4" id="total-studio-leads">0</div>
                                    <div class="text-muted small">Total Leads</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="icon-circle bg-success bg-opacity-10">
                                    <i class="bi bi-table text-success"></i>
                                </div>
                                <div class="ms-3">
                                    <div class="fw-bold fs-4" id="imported-leads">0</div>
                                    <div class="text-muted small">From Google Sheets</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="icon-circle bg-warning bg-opacity-10">
                                    <i class="bi bi-pencil text-warning"></i>
                                </div>
                                <div class="ms-3">
                                    <div class="fw-bold fs-4" id="manual-leads">0</div>
                                    <div class="text-muted small">Manual Entry</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="icon-circle bg-info bg-opacity-10">
                                    <i class="bi bi-check-circle text-info"></i>
                                </div>
                                <div class="ms-3">
                                    <div class="fw-bold fs-4" id="converted-leads">0</div>
                                    <div class="text-muted small">Converted</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Leads Table -->
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-transparent border-0">
                    <h5 class="card-title mb-0">
                        <i class="bi bi-list-ul me-2"></i>
                        Lead List
                    </h5>
                </div>
                <div class="card-body">
                    <div id="leads-table">
                        <p class="text-muted text-center py-4">Select a studio to view leads</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Load leads for selected studio
    async loadStudioLeads() {
        const studioId = document.getElementById('studio-select').value;
        if (!studioId) {
            document.getElementById('lead-stats').style.display = 'none';
            document.getElementById('leads-table').innerHTML = '<p class="text-muted text-center py-4">Select a studio to view leads</p>';
            return;
        }

        const sourceFilter = document.getElementById('source-filter').value;
        const statusFilter = document.getElementById('status-filter').value;

        try {
            document.getElementById('leads-table').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

            const response = await window.managerAPI.getStudioLeads(studioId, {
                source_type: sourceFilter,
                status: statusFilter,
                page: 1,
                limit: 100
            });

            // Update statistics
            document.getElementById('lead-stats').style.display = 'flex';
            document.getElementById('total-studio-leads').textContent = response.stats.total_leads || 0;
            document.getElementById('imported-leads').textContent = response.stats.imported_leads || 0;
            document.getElementById('manual-leads').textContent = response.stats.manual_leads || 0;
            document.getElementById('converted-leads').textContent = response.stats.converted_leads || 0;

            // Render leads table
            this.renderLeadsTable(response.leads);

        } catch (error) {
            console.error('Error loading studio leads:', error);
            document.getElementById('leads-table').innerHTML = '<p class="text-danger text-center py-4">Failed to load leads</p>';
        }
    }

    // Render leads table
    renderLeadsTable(leads) {
        const container = document.getElementById('leads-table');
        
        if (!leads || leads.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-4">No leads found</p>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Email</th>
                            <th>Source</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${leads.map(lead => `
                            <tr>
                                <td>${lead.name || '-'}</td>
                                <td>${lead.phone_number || '-'}</td>
                                <td>${lead.email || '-'}</td>
                                <td>
                                    ${lead.source_type === 'imported' ? 
                                        '<span class="badge bg-success">Google Sheets</span>' : 
                                        '<span class="badge bg-secondary">Manual</span>'}
                                </td>
                                <td>
                                    ${this.getStatusBadge(lead.status)}
                                </td>
                                <td>${new Date(lead.created_at).toLocaleDateString()}</td>
                                <td>${lead.notes ? `<small>${lead.notes}</small>` : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Get status badge HTML
    getStatusBadge(status) {
        const statusMap = {
            'neu': '<span class="badge bg-primary">New</span>',
            'kontaktiert': '<span class="badge bg-info">Contacted</span>',
            'konvertiert': '<span class="badge bg-success">Converted</span>',
            'nicht_interessiert': '<span class="badge bg-danger">Not Interested</span>'
        };
        return statusMap[status] || '<span class="badge bg-secondary">Unknown</span>';
    }

    // Refresh leads
    refreshLeads() {
        this.loadStudioLeads();
    }
    
    // Show code generation modal
    showCodeGenerationModal() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="modal fade" id="codeGenerationModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Generate Studio Owner Code</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="codeGenerationForm">
                                <div class="mb-3">
                                    <label class="form-label">Intended Owner Name</label>
                                    <input type="text" class="form-control" name="intendedOwnerName" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">City</label>
                                    <input type="text" class="form-control" name="intendedCity" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Studio Name</label>
                                    <input type="text" class="form-control" name="intendedStudioName" required>
                                </div>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Code will expire in 3 days
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="managerDashboard.generateCode()">Generate Code</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const modalInstance = new bootstrap.Modal(document.getElementById('codeGenerationModal'));
        modalInstance.show();
        
        // Cleanup on close
        document.getElementById('codeGenerationModal').addEventListener('hidden.bs.modal', function () {
            modal.remove();
        });
    }
    
    // Generate code
    async generateCode() {
        const form = document.getElementById('codeGenerationForm');
        const formData = new FormData(form);
        const data = {
            intendedOwnerName: formData.get('intendedOwnerName'),
            intendedCity: formData.get('intendedCity'),
            intendedStudioName: formData.get('intendedStudioName')
        };
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/manager/studio-owner-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate code');
            }
            
            const result = await response.json();
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('codeGenerationModal')).hide();
            
            // Show success message
            this.showSuccess(`Code generated successfully: ${result.codes[0].code}`);
            
            // Reload codes
            this.loadCodes();
            
        } catch (error) {
            console.error('Error generating code:', error);
            this.showError('Failed to generate code');
        }
    }
    
    // Load codes
    async loadCodes() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/manager/studio-owner-codes`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load codes');
            }
            
            const data = await response.json();
            this.renderCodesTable(data.codes || []);
            
        } catch (error) {
            console.error('Error loading codes:', error);
            document.getElementById('codes-table').innerHTML = '<p class="text-muted text-center py-4">Failed to load codes</p>';
        }
    }
    
    // Render codes table
    renderCodesTable(codes) {
        const container = document.getElementById('codes-table');
        
        if (codes.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-4">No codes generated yet</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Intended For</th>
                            <th>City</th>
                            <th>Studio Name</th>
                            <th>Created</th>
                            <th>Expires</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${codes.map(code => `
                            <tr>
                                <td>
                                    <code class="bg-light px-2 py-1 rounded">${code.code}</code>
                                </td>
                                <td>${code.intended_owner_name || '-'}</td>
                                <td>${code.intended_city || '-'}</td>
                                <td>${code.intended_studio_name || '-'}</td>
                                <td>${new Date(code.created_at).toLocaleDateString()}</td>
                                <td>${new Date(code.expires_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary" onclick="navigator.clipboard.writeText('${code.code}')">
                                        <i class="bi bi-clipboard"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
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
                    <button class="btn btn-primary" onclick="managerDashboard.showInfo('Google Sheets connection feature coming soon!')">
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
                            <th>Owner Email</th>
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
                                    <td>${studio.owner_email || 'N/A'}</td>
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

    // New methods for enhanced studios functionality

    // Get unique cities from studios list
    getUniqueCities() {
        const cities = [...new Set(this.studios.map(s => s.city).filter(Boolean))];
        return cities.sort();
    }

    // Debounce search input
    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.applyFilters();
        }, 500);
    }

    // Apply filters and reload studios
    async applyFilters() {
        const search = document.getElementById('studio-search')?.value || '';
        const address = document.getElementById('address-search')?.value || '';
        const city = document.getElementById('city-filter')?.value || '';
        const hasSheet = document.getElementById('sheet-filter')?.value || '';

        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (address) params.append('address', address);
            if (city) params.append('city', city);
            if (hasSheet) params.append('hasSheet', hasSheet);

            const response = await window.managerAPI.getStudios(params.toString());
            this.studios = response.studios || [];
            
            // Update the studios container
            const container = document.getElementById('studios-container');
            if (container) {
                container.innerHTML = this.renderStudiosList();
            }
        } catch (error) {
            console.error('Error applying filters:', error);
            this.showError('Failed to filter studios');
        }
    }

    // Render studios list with cards
    renderStudiosList() {
        if (this.loadingStates.studios) {
            return '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';
        }

        if (this.studios.length === 0) {
            return `
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center py-5">
                        <i class="bi bi-building display-4 text-muted mb-3"></i>
                        <h4 class="text-muted">No Studios Found</h4>
                        <p class="text-muted">No studios match your search criteria.</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="row g-3">
                ${this.studios.map(studio => this.renderStudioCard(studio)).join('')}
            </div>
        `;
    }

    // Render individual studio card
    renderStudioCard(studio) {
        const hasSheet = studio.has_google_sheet || studio.google_sheets_integration?.connected;
        const sheetBadge = hasSheet 
            ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Google Sheets Connected</span>'
            : '<span class="badge bg-warning"><i class="bi bi-exclamation-circle me-1"></i>No Sheet Connected</span>';

        const leadCount = studio.total_leads || 0;
        const importedLeads = studio.google_sheets_integration?.total_leads_imported || studio.imported_leads || 0;

        // Get subscription badge
        const subscriptionBadge = this.getSubscriptionBadge(studio);
        const subscriptionStatus = this.getSubscriptionStatus(studio);

        return `
            <div class="col-lg-6">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h5 class="card-title mb-1">
                                    <i class="bi bi-building text-primary me-2"></i>
                                    ${studio.name}
                                </h5>
                                <p class="text-muted small mb-0">
                                    Owner: ${studio.owner_first_name || ''} ${studio.owner_last_name || ''}
                                </p>
                            </div>
                            <div class="d-flex flex-column gap-1">
                                ${subscriptionBadge}
                                ${sheetBadge}
                            </div>
                        </div>
                        
                        <!-- Subscription Status Bar -->
                        ${subscriptionStatus}
                        
                        <div class="mb-3">
                            <p class="mb-1">
                                <i class="bi bi-envelope text-muted me-2"></i>
                                <strong>Owner Email:</strong> ${studio.owner_email || 'Not specified'}
                            </p>
                            <p class="mb-1">
                                <i class="bi bi-pin-map text-muted me-2"></i>
                                <strong>City:</strong> ${studio.city}
                            </p>
                            <p class="mb-1">
                                <i class="bi bi-telephone text-muted me-2"></i>
                                <strong>Owner Phone:</strong> ${studio.owner_phone || 'Not specified'}
                            </p>
                        </div>

                        ${hasSheet ? `
                            <div class="bg-light rounded p-2 mb-3">
                                <div class="row g-2 text-center">
                                    <div class="col-6">
                                        <div class="fw-bold text-primary">${leadCount}</div>
                                        <div class="text-muted small">Total Leads</div>
                                    </div>
                                    <div class="col-6">
                                        <div class="fw-bold text-success">${importedLeads}</div>
                                        <div class="text-muted small">From Sheets</div>
                                    </div>
                                </div>
                                ${studio.google_sheets_integration?.last_sync ? `
                                    <div class="text-center mt-2">
                                        <small class="text-muted">
                                            Last sync: ${new Date(studio.google_sheets_integration.last_sync).toLocaleString()}
                                        </small>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class="alert alert-warning mb-3">
                                <i class="bi bi-info-circle me-2"></i>
                                No Google Sheet connected to this studio
                            </div>
                        `}

                        <div class="d-flex gap-2">
                            ${hasSheet ? `
                                <button onclick="managerDashboard.manageIntegration(${studio.id})" 
                                        class="btn btn-sm btn-outline-primary flex-fill">
                                    <i class="bi bi-gear me-1"></i>
                                    Manage Integration
                                </button>
                                <button onclick="managerDashboard.syncNow(${studio.id})" 
                                        class="btn btn-sm btn-outline-success flex-fill">
                                    <i class="bi bi-arrow-clockwise me-1"></i>
                                    Sync Now
                                </button>
                            ` : `
                                <button onclick="managerDashboard.connectSheet(${studio.id})" 
                                        class="btn btn-sm btn-primary flex-fill">
                                    <i class="bi bi-link-45deg me-1"></i>
                                    Connect Google Sheet
                                </button>
                            `}
                            <button onclick="managerDashboard.viewStudioDetails(${studio.id})" 
                                    class="btn btn-sm btn-outline-secondary">
                                <i class="bi bi-eye me-1"></i>
                                Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Connect Google Sheet to a studio
    async connectSheet(studioId) {
        const studio = this.studios.find(s => s.id === studioId);
        if (!studio) return;

        // Show the Google Sheets connection modal
        window.googleSheetsModal.show(studio);
    }

    // Manage existing integration
    async manageIntegration(studioId) {
        try {
            const response = await window.managerAPI.getStudioIntegration(studioId);
            // TODO: Show integration management modal
            console.log('Integration details:', response);
            this.showIntegrationModal(response.studio, response.integration);
        } catch (error) {
            console.error('Error loading integration:', error);
            this.showError('Failed to load integration details');
        }
    }

    // Trigger manual sync for a studio
    async syncNow(studioId) {
        try {
            const studio = this.studios.find(s => s.id === studioId);
            if (!studio || !studio.google_sheets_integration) {
                this.showError('No Google Sheet connected to this studio');
                return;
            }

            this.showInfo('Starting sync...');
            
            // Find the integration ID for this studio
            const integrations = await window.managerAPI.getGoogleSheetsIntegrations();
            const integration = integrations.integrations.find(i => i.studio_id === studioId);
            
            if (!integration) {
                this.showError('Integration not found');
                return;
            }

            await window.managerAPI.syncGoogleSheet(integration.id);
            this.showSuccess('Sync completed successfully');
            
            // Reload studios to show updated data
            await this.loadStudios();
            this.renderStudios();
        } catch (error) {
            console.error('Error syncing:', error);
            this.showError('Failed to sync Google Sheet');
        }
    }

    // View detailed studio information
    async viewStudioDetails(studioId) {
        try {
            const response = await window.managerAPI.getStudioIntegration(studioId);
            // TODO: Show detailed studio modal
            console.log('Studio details:', response);
            this.showInfo('Detailed view coming soon');
        } catch (error) {
            console.error('Error loading studio details:', error);
            this.showError('Failed to load studio details');
        }
    }

    // Show integration details modal
    showIntegrationModal(studio, integration) {
        const modalHtml = `
            <div class="modal fade" id="integration-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-table me-2"></i>
                                Google Sheets Integration - ${studio.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Integration Details</h6>
                                    <ul class="list-unstyled">
                                        <li><strong>Sheet Name:</strong> ${integration.sheet_name || 'N/A'}</li>
                                        <li><strong>Connected:</strong> ${integration.integration_id ? 'Yes' : 'No'}</li>
                                        <li><strong>Last Sync:</strong> ${integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}</li>
                                        <li><strong>Auto Sync:</strong> ${integration.auto_sync_enabled ? 'Enabled' : 'Disabled'}</li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <h6>Quick Actions</h6>
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-primary" onclick="managerDashboard.syncNow(${studio.id})">
                                            <i class="bi bi-arrow-clockwise me-2"></i>Sync Now
                                        </button>
                                        <button class="btn btn-outline-danger" onclick="managerDashboard.disconnectSheet(${studio.id})">
                                            <i class="bi bi-unlink me-2"></i>Disconnect Sheet
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('integration-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('integration-modal'));
        modal.show();
    }

    // Disconnect Google Sheet
    async disconnectSheet(studioId) {
        if (!confirm('Are you sure you want to disconnect the Google Sheet from this studio?')) {
            return;
        }

        try {
            const integrationResponse = await window.managerAPI.getStudioIntegration(studioId);
            const integrationId = integrationResponse.integration.integration_id;

            if (!integrationId) {
                this.showError('No integration found to disconnect');
                return;
            }

            await window.managerAPI.deleteIntegration(integrationId);
            this.showSuccess('Google Sheet disconnected successfully');
            
            // Close modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('integration-modal'));
            if (modal) modal.hide();
            
            this.loadStudios();
            this.renderStudios();

        } catch (error) {
            console.error('Error disconnecting sheet:', error);
            this.showError('Failed to disconnect sheet: ' + (error.message || 'Unknown error'));
        }
    }

    // Render promo codes tab
    renderPromoCodes() {
        const contentContainer = document.getElementById('dashboard-content');
        contentContainer.innerHTML = `
            <div class="row mb-4">
                <div class="col">
                    <h2 class="h4 fw-bold">Promo Code Management</h2>
                    <p class="text-muted">Create and manage promotional codes for trial extensions</p>
                </div>
                <div class="col-auto">
                    <button class="btn btn-primary" onclick="managerDashboard.showGeneratePromoModal()">
                        <i class="bi bi-plus-circle me-2"></i>Generate Promo Codes
                    </button>
                </div>
            </div>

            <div class="row mb-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Active Promo Codes</h5>
                            <button class="btn btn-outline-secondary btn-sm" onclick="managerDashboard.loadPromoCodes()">
                                <i class="bi bi-arrow-clockwise me-1"></i>Refresh
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="promo-codes-list">
                                <div class="text-center py-4">
                                    <div class="spinner-border" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load promo codes data
        this.loadPromoCodes();
    }

    // Load promo codes from API
    async loadPromoCodes() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/subscriptions/promocodes?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load promo codes');
            }

            const data = await response.json();
            this.renderPromoCodesList(data.promocodes || []);
        } catch (error) {
            console.error('Error loading promo codes:', error);
            document.getElementById('promo-codes-list').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Failed to load promo codes: ${error.message}
                </div>
            `;
        }
    }

    // Render promo codes list
    renderPromoCodesList(promoCodes) {
        const container = document.getElementById('promo-codes-list');
        
        if (!promoCodes || promoCodes.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-ticket-perforated" style="font-size: 3rem; opacity: 0.3;"></i>
                    <p class="mt-3">No promo codes created yet</p>
                    <button class="btn btn-primary" onclick="managerDashboard.showGeneratePromoModal()">
                        Create Your First Promo Code
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Extension</th>
                            <th>Usage</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Expires</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${promoCodes.map(code => `
                            <tr data-promo-id="${code.id}" data-promo-code="${code.code}">
                                <td>
                                    <code class="bg-light px-2 py-1">${code.code}</code>
                                </td>
                                <td>
                                    <span class="badge bg-info">${code.extension_months} months</span>
                                </td>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <span class="me-2">${code.used_count || 0}/${code.max_uses}</span>
                                        <div class="progress" style="width: 60px;">
                                            <div class="progress-bar" role="progressbar" 
                                                 style="width: ${((code.used_count || 0) / code.max_uses) * 100}%">
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    ${this.getPromoStatusBadge(code)}
                                </td>
                                <td>
                                    <small class="text-muted">
                                        ${new Date(code.created_at).toLocaleDateString()}
                                    </small>
                                </td>
                                <td>
                                    <small class="text-muted">
                                        ${code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}
                                    </small>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        ${code.is_active ? `
                                            <button class="btn btn-outline-danger" 
                                                    onclick="managerDashboard.deactivatePromoCode(${code.id})"
                                                    title="Deactivate">
                                                <i class="bi bi-x-circle"></i>
                                            </button>
                                        ` : ''}
                                        <button class="btn btn-outline-info" 
                                                onclick="managerDashboard.viewPromoUsage('${code.code}')"
                                                title="View Usage">
                                            <i class="bi bi-list-ul"></i>
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

    // Get status badge for promo code
    getPromoStatusBadge(code) {
        if (!code.is_active) {
            return '<span class="badge bg-secondary">Inactive</span>';
        }
        
        if (code.expires_at && new Date(code.expires_at) <= new Date()) {
            return '<span class="badge bg-warning">Expired</span>';
        }
        
        if (code.used_count >= code.max_uses) {
            return '<span class="badge bg-info">Used Up</span>';
        }
        
        return '<span class="badge bg-success">Active</span>';
    }

    // Show generate promo code modal
    showGeneratePromoModal() {
        const modalHtml = `
            <div class="modal fade" id="generatePromoModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Generate Promo Codes</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="generatePromoForm">
                                <div class="mb-3">
                                    <label for="extensionMonths" class="form-label">Trial Extension (months)</label>
                                    <input type="number" class="form-control" id="extensionMonths" name="extensionMonths"
                                           value="2" min="1" max="12" required>
                                    <div class="form-text">How many months to extend the trial period</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="maxUses" class="form-label">Maximum Uses per Code</label>
                                    <input type="number" class="form-control" id="maxUses" name="maxUses"
                                           value="1" min="1" max="100" required>
                                    <div class="form-text">How many times each code can be redeemed</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="codeCount" class="form-label">Number of Codes to Generate</label>
                                    <input type="number" class="form-control" id="codeCount" name="codeCount"
                                           value="1" min="1" max="50" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="codePrefix" class="form-label">Code Prefix (optional)</label>
                                    <input type="text" class="form-control" id="codePrefix" name="codePrefix"
                                           placeholder="e.g., SUMMER" maxlength="8">
                                    <div class="form-text">Prefix for the generated codes</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="expiresInDays" class="form-label">Expires in Days (optional)</label>
                                    <input type="number" class="form-control" id="expiresInDays" name="expiresInDays"
                                           placeholder="e.g., 30" min="1">
                                    <div class="form-text">Leave empty for codes that never expire</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="description" class="form-label">Description (optional)</label>
                                    <textarea class="form-control" id="description" name="description" rows="2" 
                                              placeholder="e.g., Summer promotion codes"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="managerDashboard.generatePromoCodes()">
                                <i class="bi bi-plus-circle me-2"></i>Generate Codes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('generatePromoModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('generatePromoModal'));
        modal.show();
    }

    // Generate promo codes
    async generatePromoCodes() {
        const form = document.getElementById('generatePromoForm');
        const formData = new FormData(form);
        
        const data = {
            extension_months: parseInt(formData.get('extensionMonths')),
            max_uses: parseInt(formData.get('maxUses')),
            count: parseInt(formData.get('codeCount')),
            prefix: formData.get('codePrefix') || undefined,
            expires_in_days: formData.get('expiresInDays') ? parseInt(formData.get('expiresInDays')) : undefined,
            description: formData.get('description') || undefined
        };
        
        console.log('Generating promo codes with data:', data);

        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/subscriptions/promocodes/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to generate promo codes');
            }

            const result = await response.json();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('generatePromoModal'));
            modal.hide();
            
            // Show success message with generated codes
            this.showGeneratedCodesSuccess(result.promocodes);
            
            // Reload promo codes list
            this.loadPromoCodes();
            
        } catch (error) {
            console.error('Error generating promo codes:', error);
            this.showError('Failed to generate promo codes: ' + error.message);
        }
    }

    // Show success message with generated codes
    showGeneratedCodesSuccess(codes) {
        const codesText = codes.map(code => code.code).join(', ');
        const message = `Successfully generated ${codes.length} promo code(s): <br><code>${codesText}</code>`;
        
        const alertHtml = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="bi bi-check-circle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const container = document.getElementById('dashboard-content');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 10000);
    }

    // Deactivate promo code
    async deactivatePromoCode(id) {
        // Find the code details for confirmation message
        const promocodes = document.querySelectorAll('[data-promo-id]');
        let codeName = 'this code';
        for (let elem of promocodes) {
            if (elem.dataset.promoId == id) {
                codeName = elem.dataset.promoCode;
                break;
            }
        }
        
        if (!confirm(`Are you sure you want to deactivate the promo code "${codeName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/subscriptions/promocodes/${id}/deactivate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to deactivate promo code');
            }

            this.showSuccess(`Promo code "${codeName}" has been deactivated`);
            this.loadPromoCodes();
        } catch (error) {
            console.error('Error deactivating promo code:', error);
            this.showError('Failed to deactivate promo code: ' + error.message);
        }
    }

    // View promo code usage (placeholder)
    viewPromoUsage(code) {
        this.showInfo(`Usage details for "${code}" will be implemented in the next phase`);
    }

    // Get subscription badge for studio
    getSubscriptionBadge(studio) {
        const status = studio.subscription_display_status || 'No Subscription';
        const planType = studio.plan_type || 'none';
        
        let badgeClass = 'bg-secondary';
        let icon = 'bi-question-circle';
        let text = 'No Subscription';
        
        if (status === 'Active Trial') {
            badgeClass = 'bg-info';
            icon = 'bi-clock-history';
            text = 'Trial';
        } else if (status === 'Expired Trial') {
            badgeClass = 'bg-warning';
            icon = 'bi-exclamation-triangle';
            text = 'Trial Expired';
        } else if (status === 'Paid Subscription') {
            badgeClass = 'bg-success';
            icon = 'bi-check-circle';
            if (planType === 'single_studio') text = 'Single Studio';
            else if (planType === 'dual_studio') text = 'Dual Studio';
            else if (planType === 'triple_studio') text = 'Triple Studio';
            else text = 'Paid';
        } else if (status === 'Cancelled') {
            badgeClass = 'bg-danger';
            icon = 'bi-x-circle';
            text = 'Cancelled';
        }
        
        return `<span class="badge ${badgeClass}"><i class="bi ${icon} me-1"></i>${text}</span>`;
    }
    
    // Get subscription status bar
    getSubscriptionStatus(studio) {
        const status = studio.subscription_display_status || 'No Subscription';
        const trialEnds = studio.trial_ends_at;
        const periodEnd = studio.current_period_end;
        
        if (status === 'No Subscription') {
            return '';
        }
        
        let endDate = null;
        let label = '';
        let progressClass = 'bg-info';
        let daysRemaining = 0;
        
        if (status === 'Active Trial' && trialEnds) {
            endDate = new Date(trialEnds);
            label = 'Trial ends';
            daysRemaining = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            if (daysRemaining <= 7) progressClass = 'bg-warning';
            if (daysRemaining <= 3) progressClass = 'bg-danger';
        } else if (status === 'Paid Subscription' && periodEnd) {
            endDate = new Date(periodEnd);
            label = 'Renews';
            progressClass = 'bg-success';
            daysRemaining = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
        } else if (status === 'Expired Trial') {
            return `
                <div class="alert alert-warning py-2 px-3 mb-3">
                    <small><i class="bi bi-exclamation-triangle me-1"></i>Trial expired - Upgrade required</small>
                </div>
            `;
        }
        
        if (!endDate) return '';
        
        const totalDays = 30; // Assume 30-day periods
        const progressPercent = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100));
        
        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-muted">${label}</small>
                    <small class="fw-bold">${daysRemaining} days</small>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar ${progressClass}" style="width: ${progressPercent}%"></div>
                </div>
            </div>
        `;
    }
    
    // View detailed studio information
    async viewStudioDetails(studioId) {
        try {
            // Show loading state
            this.showStudioDetailsModal(null, true);
            
            // Fetch detailed data
            const response = await fetch(`${window.API_BASE_URL}/api/v1/manager/studios/${studioId}/details`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load studio details');
            }
            
            const studioDetails = await response.json();
            
            // Show modal with data
            this.showStudioDetailsModal(studioDetails, false);
            
        } catch (error) {
            console.error('Error loading studio details:', error);
            this.showError('Failed to load studio details');
        }
    }
    
    // Show studio details modal
    showStudioDetailsModal(data, loading = false) {
        // Remove existing modal if present
        const existingModal = document.getElementById('studioDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHtml = `
            <div class="modal fade" id="studioDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-building me-2"></i>
                                ${data ? data.studio.name : 'Studio Details'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${loading ? this.renderLoadingState() : this.renderStudioDetails(data)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('studioDetailsModal'));
        modal.show();
    }
    
    // Render loading state
    renderLoadingState() {
        return `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading studio details...</p>
            </div>
        `;
    }
    
    // Render studio details
    renderStudioDetails(data) {
        if (!data) return '';
        
        return `
            <!-- Nav tabs -->
            <ul class="nav nav-tabs mb-4" role="tablist">
                <li class="nav-item">
                    <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#overview-tab">
                        <i class="bi bi-info-circle me-1"></i>Overview
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#subscription-tab">
                        <i class="bi bi-credit-card me-1"></i>Subscription
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#payments-tab">
                        <i class="bi bi-cash-stack me-1"></i>Payments
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#promocodes-tab">
                        <i class="bi bi-ticket-perforated me-1"></i>Promo Codes
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#statistics-tab">
                        <i class="bi bi-graph-up me-1"></i>Statistics
                    </button>
                </li>
            </ul>
            
            <!-- Tab content -->
            <div class="tab-content">
                ${this.renderOverviewTab(data)}
                ${this.renderSubscriptionTab(data)}
                ${this.renderPaymentsTab(data)}
                ${this.renderPromoCodesTab(data)}
                ${this.renderStatisticsTab(data)}
            </div>
        `;
    }
    
    // Render overview tab
    renderOverviewTab(data) {
        return `
            <div class="tab-pane fade show active" id="overview-tab">
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-muted mb-3">Studio Information</h6>
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <p class="mb-2"><strong>Name:</strong> ${data.studio.name}</p>
                                <p class="mb-2"><strong>City:</strong> ${data.studio.city || 'N/A'}</p>
                                <p class="mb-2"><strong>Address:</strong> ${data.studio.address || 'N/A'}</p>
                                <p class="mb-2"><strong>Phone:</strong> ${data.studio.phone || 'N/A'}</p>
                                <p class="mb-0"><strong>Created:</strong> ${new Date(data.studio.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-muted mb-3">Owner Information</h6>
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <p class="mb-2"><strong>Name:</strong> ${data.owner.name || 'N/A'}</p>
                                <p class="mb-2"><strong>Email:</strong> ${data.owner.email}</p>
                                <p class="mb-2"><strong>Phone:</strong> ${data.owner.phone || 'N/A'}</p>
                                <p class="mb-0"><strong>Member Since:</strong> ${new Date(data.owner.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-4">
                    <h6 class="text-muted mb-3">Google Sheets Integration</h6>
                    ${data.google_sheets_integration.connected ? `
                        <div class="alert alert-success">
                            <i class="bi bi-check-circle me-2"></i>
                            Connected to Google Sheets
                            <div class="mt-2">
                                <small>
                                    <strong>Sheet ID:</strong> ${data.google_sheets_integration.sheet_id}<br>
                                    <strong>Last Sync:</strong> ${data.google_sheets_integration.last_sync_at ? new Date(data.google_sheets_integration.last_sync_at).toLocaleString() : 'Never'}
                                </small>
                            </div>
                        </div>
                    ` : `
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            No Google Sheets integration configured
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    
    // Render subscription tab
    renderSubscriptionTab(data) {
        const sub = data.subscription;
        const statusColor = sub.status === 'active' ? 'success' : sub.status === 'trial' ? 'info' : 'warning';
        
        return `
            <div class="tab-pane fade" id="subscription-tab">
                <div class="row">
                    <div class="col-md-8">
                        <div class="card border-0">
                            <div class="card-body">
                                <h6 class="card-title">Current Subscription</h6>
                                <div class="mb-3">
                                    <span class="badge bg-${statusColor} fs-6">${sub.display_status}</span>
                                </div>
                                
                                <div class="row g-3">
                                    <div class="col-6">
                                        <small class="text-muted d-block">Plan Type</small>
                                        <strong>${this.formatPlanType(sub.plan_type)}</strong>
                                    </div>
                                    <div class="col-6">
                                        <small class="text-muted d-block">Max Studios</small>
                                        <strong>${sub.max_studios_allowed}</strong>
                                    </div>
                                    ${sub.trial_started_at ? `
                                        <div class="col-6">
                                            <small class="text-muted d-block">Trial Started</small>
                                            <strong>${new Date(sub.trial_started_at).toLocaleDateString()}</strong>
                                        </div>
                                    ` : ''}
                                    ${sub.trial_ends_at ? `
                                        <div class="col-6">
                                            <small class="text-muted d-block">Trial Ends</small>
                                            <strong>${new Date(sub.trial_ends_at).toLocaleDateString()}</strong>
                                        </div>
                                    ` : ''}
                                    ${sub.current_period_start ? `
                                        <div class="col-6">
                                            <small class="text-muted d-block">Current Period Start</small>
                                            <strong>${new Date(sub.current_period_start).toLocaleDateString()}</strong>
                                        </div>
                                    ` : ''}
                                    ${sub.current_period_end ? `
                                        <div class="col-6">
                                            <small class="text-muted d-block">Current Period End</small>
                                            <strong>${new Date(sub.current_period_end).toLocaleDateString()}</strong>
                                        </div>
                                    ` : ''}
                                </div>
                                
                                ${sub.days_remaining > 0 ? `
                                    <div class="mt-4">
                                        <div class="d-flex justify-content-between mb-2">
                                            <span>Days Remaining</span>
                                            <strong>${sub.days_remaining} days</strong>
                                        </div>
                                        <div class="progress" style="height: 10px;">
                                            <div class="progress-bar bg-${statusColor}" style="width: ${(30 - sub.days_remaining) / 30 * 100}%"></div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <h6 class="card-title">Stripe Integration</h6>
                                ${sub.stripe_customer_id ? `
                                    <p class="mb-2">
                                        <small class="text-muted d-block">Customer ID</small>
                                        <code class="small">${sub.stripe_customer_id}</code>
                                    </p>
                                ` : ''}
                                ${sub.stripe_subscription_id ? `
                                    <p class="mb-0">
                                        <small class="text-muted d-block">Subscription ID</small>
                                        <code class="small">${sub.stripe_subscription_id}</code>
                                    </p>
                                ` : ''}
                                ${!sub.stripe_customer_id && !sub.stripe_subscription_id ? `
                                    <p class="text-muted mb-0">No Stripe integration</p>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render payments tab
    renderPaymentsTab(data) {
        const payments = data.payment_history || [];
        
        return `
            <div class="tab-pane fade" id="payments-tab">
                <h6 class="mb-3">Payment History</h6>
                ${payments.length > 0 ? `
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Period</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments.map(payment => `
                                    <tr>
                                        <td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}</td>
                                        <td>€${payment.amount_euros}</td>
                                        <td>${this.getPaymentStatusBadge(payment.status)}</td>
                                        <td>
                                            ${payment.period_start && payment.period_end ? `
                                                <small>${new Date(payment.period_start).toLocaleDateString()} - ${new Date(payment.period_end).toLocaleDateString()}</small>
                                            ` : 'N/A'}
                                        </td>
                                        <td>
                                            ${payment.failure_reason ? `
                                                <span class="text-danger" title="${payment.failure_reason}">
                                                    <i class="bi bi-exclamation-circle"></i>
                                                </span>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        No payment history available
                    </div>
                `}
            </div>
        `;
    }
    
    // Render promo codes tab
    renderPromoCodesTab(data) {
        const promoUsage = data.promo_code_usage || [];
        
        return `
            <div class="tab-pane fade" id="promocodes-tab">
                <h6 class="mb-3">Promo Code Usage</h6>
                ${promoUsage.length > 0 ? `
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Used On</th>
                                    <th>Months Added</th>
                                    <th>Extension Period</th>
                                    <th>Created By</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${promoUsage.map(usage => `
                                    <tr>
                                        <td><code>${usage.promo_code}</code></td>
                                        <td>${new Date(usage.used_at).toLocaleDateString()}</td>
                                        <td>+${usage.months_added} months</td>
                                        <td>
                                            <small>
                                                ${new Date(usage.previous_trial_end).toLocaleDateString()} → 
                                                ${new Date(usage.new_trial_end).toLocaleDateString()}
                                            </small>
                                        </td>
                                        <td>${usage.created_by_manager}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        No promo codes have been used
                    </div>
                `}
            </div>
        `;
    }
    
    // Render statistics tab
    renderStatisticsTab(data) {
        const stats = data.statistics;
        
        return `
            <div class="tab-pane fade" id="statistics-tab">
                <div class="row g-3">
                    <div class="col-md-6">
                        <h6 class="text-muted mb-3">Lead Statistics</h6>
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="fs-3 fw-bold text-primary">${stats.leads.total}</div>
                                            <small class="text-muted">Total Leads</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="fs-3 fw-bold text-success">${stats.leads.converted}</div>
                                            <small class="text-muted">Converted</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="fs-5 fw-bold">${stats.leads.imported}</div>
                                            <small class="text-muted">From Sheets</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="fs-5 fw-bold">${stats.leads.manual}</div>
                                            <small class="text-muted">Manual Entry</small>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <hr>
                                        <div class="d-flex justify-content-between">
                                            <span>New (Last 30 days)</span>
                                            <strong>${stats.leads.last_30_days}</strong>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <span>Contacted</span>
                                            <strong>${stats.leads.contacted}</strong>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <span>Pending</span>
                                            <strong>${stats.leads.new}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <h6 class="text-muted mb-3">Customer Statistics</h6>
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="fs-3 fw-bold text-primary">${stats.customers.total}</div>
                                            <small class="text-muted">Total Customers</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="text-center">
                                            <div class="fs-3 fw-bold text-success">${stats.customers.new_last_30_days}</div>
                                            <small class="text-muted">New (30 days)</small>
                                        </div>
                                    </div>
                                </div>
                                
                                ${stats.leads.total > 0 ? `
                                    <div class="mt-4">
                                        <div class="d-flex justify-content-between mb-2">
                                            <span>Conversion Rate</span>
                                            <strong>${((stats.leads.converted / stats.leads.total) * 100).toFixed(1)}%</strong>
                                        </div>
                                        <div class="progress" style="height: 10px;">
                                            <div class="progress-bar bg-success" style="width: ${(stats.leads.converted / stats.leads.total) * 100}%"></div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Format plan type
    formatPlanType(planType) {
        const types = {
            'trial': 'Trial',
            'single_studio': 'Single Studio',
            'dual_studio': 'Dual Studio',
            'triple_studio': 'Triple Studio',
            'none': 'No Plan'
        };
        return types[planType] || planType;
    }
    
    // Get payment status badge
    getPaymentStatusBadge(status) {
        const badges = {
            'succeeded': '<span class="badge bg-success">Success</span>',
            'pending': '<span class="badge bg-warning">Pending</span>',
            'failed': '<span class="badge bg-danger">Failed</span>',
            'cancelled': '<span class="badge bg-secondary">Cancelled</span>',
            'refunded': '<span class="badge bg-info">Refunded</span>'
        };
        return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
    }
}

// Global instance
window.managerDashboard = new ManagerDashboard();