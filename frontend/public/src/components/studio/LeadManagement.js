// Studio Owner Lead Management Component
class LeadManagement {
    constructor() {
        this.leads = [];
        this.filteredLeads = [];
        this.stats = {};
        this.filters = {
            search: '',
            status: '',
            source: '',
            from_date: '',
            to_date: ''
        };
        this.pagination = {
            page: 1,
            limit: 25,
            total: 0
        };
        this.selectedLead = null;
        this.isLoading = false;
        this.studioId = null;
    }

    // Initialize the component
    async init(studioId) {
        this.studioId = studioId;
        console.log('Initializing Lead Management for studio:', studioId);
        
        // Verify studio owner role
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'studio_owner') {
            console.warn('Access denied: Studio owner role required');
            return;
        }

        this.render();
        await this.loadLeads();
        await this.loadStats();
        this.setupEventListeners();
    }

    // Render the main component
    render() {
        const container = document.getElementById('lead-management-content') || document.getElementById('app');
        container.innerHTML = `
            <div class="lead-management">
                <!-- Header -->
                <div class="row mb-4">
                    <div class="col">
                        <h2 class="h3 mb-0">
                            <i class="bi bi-people text-primary me-2"></i>
                            Lead Management
                        </h2>
                        <p class="text-muted mb-0">Manage imported and manual leads for your studio</p>
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-primary" onclick="leadManagement.showAddLeadModal()">
                            <i class="bi bi-person-plus me-2"></i>
                            Add Manual Lead
                        </button>
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
                                            <i class="bi bi-people text-primary"></i>
                                        </div>
                                    </div>
                                    <div class="flex-grow-1 ms-3">
                                        <div class="fw-bold text-primary fs-4" id="total-leads">
                                            ${this.isLoading ? '...' : (this.stats.total || 0)}
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
                                        <div class="icon-circle bg-success bg-opacity-10">
                                            <i class="bi bi-star text-success"></i>
                                        </div>
                                    </div>
                                    <div class="flex-grow-1 ms-3">
                                        <div class="fw-bold text-success fs-4" id="new-leads">
                                            ${this.isLoading ? '...' : (this.stats.new || 0)}
                                        </div>
                                        <div class="text-muted small">New Leads</div>
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
                                            <i class="bi bi-telephone text-warning"></i>
                                        </div>
                                    </div>
                                    <div class="flex-grow-1 ms-3">
                                        <div class="fw-bold text-warning fs-4" id="contacted-leads">
                                            ${this.isLoading ? '...' : (this.stats.contacted || 0)}
                                        </div>
                                        <div class="text-muted small">Contacted</div>
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
                                            <i class="bi bi-check-circle text-info"></i>
                                        </div>
                                    </div>
                                    <div class="flex-grow-1 ms-3">
                                        <div class="fw-bold text-info fs-4" id="converted-leads">
                                            ${this.isLoading ? '...' : (this.stats.converted || 0)}
                                        </div>
                                        <div class="text-muted small">Converted</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Filters and Search -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-lg-4">
                                <label for="search-leads" class="form-label fw-bold">Search</label>
                                <input type="text" 
                                       class="form-control" 
                                       id="search-leads" 
                                       placeholder="Search by name, phone, or email..."
                                       value="${this.filters.search}">
                            </div>
                            <div class="col-lg-2">
                                <label for="filter-status" class="form-label fw-bold">Status</label>
                                <select class="form-select" id="filter-status">
                                    <option value="">All Statuses</option>
                                    ${window.leadsAPI.getAvailableStatuses().map(status => `
                                        <option value="${status.value}" ${this.filters.status === status.value ? 'selected' : ''}>
                                            ${status.label}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="col-lg-2">
                                <label for="filter-source" class="form-label fw-bold">Source</label>
                                <select class="form-select" id="filter-source">
                                    <option value="">All Sources</option>
                                    <option value="google_sheets" ${this.filters.source === 'google_sheets' ? 'selected' : ''}>Google Sheets</option>
                                    <option value="manual" ${this.filters.source === 'manual' ? 'selected' : ''}>Manual Entry</option>
                                </select>
                            </div>
                            <div class="col-lg-2">
                                <label for="filter-from-date" class="form-label fw-bold">From Date</label>
                                <input type="date" 
                                       class="form-control" 
                                       id="filter-from-date"
                                       value="${this.filters.from_date}">
                            </div>
                            <div class="col-lg-2">
                                <label for="filter-to-date" class="form-label fw-bold">To Date</label>
                                <input type="date" 
                                       class="form-control" 
                                       id="filter-to-date"
                                       value="${this.filters.to_date}">
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col">
                                <button class="btn btn-outline-primary me-2" onclick="leadManagement.applyFilters()">
                                    <i class="bi bi-funnel me-1"></i>
                                    Apply Filters
                                </button>
                                <button class="btn btn-outline-secondary" onclick="leadManagement.clearFilters()">
                                    <i class="bi bi-x-circle me-1"></i>
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Leads Table -->
                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-transparent border-0">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0">
                                <i class="bi bi-table me-2"></i>
                                Leads
                            </h5>
                            <div class="d-flex align-items-center">
                                <span class="text-muted me-3">
                                    Showing ${this.filteredLeads.length} leads
                                </span>
                                <button class="btn btn-outline-secondary btn-sm" onclick="leadManagement.loadLeads()">
                                    <i class="bi bi-arrow-clockwise"></i>
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="leads-table-container">
                            ${this.renderLeadsTable()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Lead Modal -->
            ${this.renderAddLeadModal()}

            <!-- Lead Detail Modal -->
            ${this.renderLeadDetailModal()}
        `;
    }

    // Load leads from API
    async loadLeads() {
        this.isLoading = true;
        this.updateLoadingState();

        try {
            const response = await window.leadsAPI.getStudioLeads(this.studioId, {
                ...this.filters,
                limit: this.pagination.limit,
                offset: (this.pagination.page - 1) * this.pagination.limit
            });

            this.leads = response.leads || [];
            this.filteredLeads = this.leads;
            this.pagination.total = response.total || 0;

            this.updateLeadsTable();
        } catch (error) {
            console.error('Error loading leads:', error);
            this.showError('Failed to load leads: ' + error.message);
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    // Load statistics
    async loadStats() {
        try {
            const response = await window.leadsAPI.getLeadStats(this.studioId);
            this.stats = response.stats || {};
            this.updateStatsCards();
        } catch (error) {
            console.error('Error loading stats:', error);
            // Don't show error for stats, just log it
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-leads');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.debounce(() => this.applyFilters(), 500)();
            });
        }

        // Filter selects
        ['status', 'source', 'from_date', 'to_date'].forEach(filter => {
            const element = document.getElementById(`filter-${filter.replace('_', '-')}`);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.filters[filter] = e.target.value;
                });
            }
        });
    }

    // Render leads table
    renderLeadsTable() {
        if (this.isLoading) {
            return `
                <div class="text-center py-5">
                    <div class="spinner-border" role="status"></div>
                    <p class="text-muted mt-2">Loading leads...</p>
                </div>
            `;
        }

        if (this.filteredLeads.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="bi bi-people display-4 text-muted mb-3"></i>
                    <h5 class="text-muted">No Leads Found</h5>
                    <p class="text-muted">
                        ${this.hasActiveFilters() ? 
                            'No leads match your current filters. Try adjusting your search criteria.' : 
                            'You haven\'t received any leads yet. Connect a Google Sheet or add manual leads to get started.'}
                    </p>
                    ${!this.hasActiveFilters() ? `
                        <button class="btn btn-primary" onclick="leadManagement.showAddLeadModal()">
                            <i class="bi bi-person-plus me-2"></i>
                            Add Your First Lead
                        </button>
                    ` : ''}
                </div>
            `;
        }

        return `
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
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredLeads.map(lead => this.renderLeadRow(lead)).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            ${this.renderPagination()}
        `;
    }

    // Render individual lead row
    renderLeadRow(lead) {
        return `
            <tr data-lead-id="${lead.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2">
                            <i class="bi bi-person"></i>
                        </div>
                        <div>
                            <strong>${lead.name || 'Unknown'}</strong>
                            ${lead.notes ? `<br><small class="text-muted">${lead.notes.substring(0, 50)}${lead.notes.length > 50 ? '...' : ''}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <a href="tel:${lead.phone_number}" class="text-decoration-none">
                        ${window.leadsAPI.formatPhoneNumber(lead.phone_number)}
                    </a>
                </td>
                <td>
                    ${lead.email ? `<a href="mailto:${lead.email}" class="text-decoration-none">${lead.email}</a>` : '<span class="text-muted">—</span>'}
                </td>
                <td>
                    <span class="badge bg-light text-dark border">
                        <i class="bi bi-${lead.source === 'google_sheets' ? 'table' : 'person-plus'} me-1"></i>
                        ${window.leadsAPI.getSourceDisplayName(lead.source)}
                    </span>
                </td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm badge ${window.leadsAPI.getStatusBadgeClass(lead.status)} dropdown-toggle border-0" 
                                data-bs-toggle="dropdown">
                            ${window.leadsAPI.getStatusDisplayName(lead.status)}
                        </button>
                        <ul class="dropdown-menu">
                            ${window.leadsAPI.getAvailableStatuses().map(status => `
                                <li>
                                    <a class="dropdown-item ${lead.status === status.value ? 'active' : ''}" 
                                       href="#" 
                                       onclick="leadManagement.updateLeadStatus(${lead.id}, '${status.value}')">
                                        ${status.label}
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </td>
                <td>
                    <small class="text-muted">
                        ${new Date(lead.created_at).toLocaleDateString()}
                    </small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" 
                                onclick="leadManagement.showLeadDetail(${lead.id})"
                                title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-success" 
                                onclick="leadManagement.initiateCall(${lead.id})"
                                title="Call Lead"
                                ${lead.phone_number ? '' : 'disabled'}>
                            <i class="bi bi-telephone"></i>
                        </button>
                        ${lead.source === 'manual' ? `
                            <button class="btn btn-outline-secondary" 
                                    onclick="leadManagement.editLead(${lead.id})"
                                    title="Edit Lead">
                                <i class="bi bi-pencil"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    // Render pagination
    renderPagination() {
        const totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
        
        if (totalPages <= 1) return '';

        const currentPage = this.pagination.page;
        const maxVisiblePages = 5;
        
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        return `
            <nav aria-label="Leads pagination" class="mt-3">
                <ul class="pagination justify-content-center mb-0">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="leadManagement.goToPage(${currentPage - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </a>
                    </li>
                    
                    ${Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                        const page = startPage + i;
                        return `
                            <li class="page-item ${page === currentPage ? 'active' : ''}">
                                <a class="page-link" href="#" onclick="leadManagement.goToPage(${page})">${page}</a>
                            </li>
                        `;
                    }).join('')}
                    
                    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="leadManagement.goToPage(${currentPage + 1})">
                            <i class="bi bi-chevron-right"></i>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
    }

    // Render Add Lead Modal
    renderAddLeadModal() {
        return `
            <div class="modal fade" id="addLeadModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person-plus me-2"></i>
                                Add Manual Lead
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-lead-form">
                                <div class="mb-3">
                                    <label for="lead-name" class="form-label">
                                        Name <span class="text-danger">*</span>
                                    </label>
                                    <input type="text" class="form-control" id="lead-name" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="lead-phone" class="form-label">
                                        Phone Number <span class="text-danger">*</span>
                                    </label>
                                    <input type="tel" class="form-control" id="lead-phone" required>
                                    <div class="form-text">Include country code (e.g., +49 for Germany)</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="lead-email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="lead-email">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="lead-notes" class="form-label">Notes</label>
                                    <textarea class="form-control" id="lead-notes" rows="3"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="leadManagement.addLead()">
                                <i class="bi bi-plus-circle me-1"></i>
                                Add Lead
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Render Lead Detail Modal
    renderLeadDetailModal() {
        return `
            <div class="modal fade" id="leadDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person me-2"></i>
                                Lead Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="lead-detail-content">
                                <!-- Content will be loaded dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Apply filters
    async applyFilters() {
        this.pagination.page = 1; // Reset to first page
        await this.loadLeads();
    }

    // Clear filters
    async clearFilters() {
        this.filters = {
            search: '',
            status: '',
            source: '',
            from_date: '',
            to_date: ''
        };
        
        // Update UI
        document.getElementById('search-leads').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-source').value = '';
        document.getElementById('filter-from-date').value = '';
        document.getElementById('filter-to-date').value = '';
        
        await this.applyFilters();
    }

    // Check if filters are active
    hasActiveFilters() {
        return Object.values(this.filters).some(value => value !== '');
    }

    // Go to specific page
    async goToPage(page) {
        if (page < 1 || page > Math.ceil(this.pagination.total / this.pagination.limit)) {
            return;
        }
        
        this.pagination.page = page;
        await this.loadLeads();
    }

    // Show add lead modal
    showAddLeadModal() {
        const modal = new bootstrap.Modal(document.getElementById('addLeadModal'));
        modal.show();
    }

    // Add new lead
    async addLead() {
        const form = document.getElementById('add-lead-form');
        const formData = new FormData(form);
        
        const leadData = {
            name: document.getElementById('lead-name').value.trim(),
            phone_number: document.getElementById('lead-phone').value.trim(),
            email: document.getElementById('lead-email').value.trim() || null,
            notes: document.getElementById('lead-notes').value.trim() || null,
            studio_id: this.studioId
        };

        // Validate required fields
        if (!leadData.name || !leadData.phone_number) {
            this.showError('Name and phone number are required');
            return;
        }

        // Validate phone number
        if (!window.leadsAPI.validatePhoneNumber(leadData.phone_number)) {
            this.showError('Please enter a valid phone number with country code');
            return;
        }

        // Validate email if provided
        if (leadData.email && !window.leadsAPI.validateEmail(leadData.email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            await window.leadsAPI.addManualLead(leadData);
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addLeadModal'));
            modal.hide();
            form.reset();
            
            this.showSuccess('Lead added successfully');
            await this.loadLeads();
            await this.loadStats();
            
        } catch (error) {
            console.error('Error adding lead:', error);
            this.showError('Failed to add lead: ' + error.message);
        }
    }

    // Update lead status
    async updateLeadStatus(leadId, status) {
        try {
            await window.leadsAPI.updateLeadStatus(leadId, status);
            this.showSuccess('Lead status updated successfully');
            await this.loadLeads();
            await this.loadStats();
        } catch (error) {
            console.error('Error updating lead status:', error);
            this.showError('Failed to update lead status: ' + error.message);
        }
    }

    // Show lead detail modal
    async showLeadDetail(leadId) {
        try {
            const lead = await window.leadsAPI.getLeadDetails(leadId);
            this.selectedLead = lead.lead;
            
            const content = document.getElementById('lead-detail-content');
            content.innerHTML = this.renderLeadDetailContent(this.selectedLead);
            
            const modal = new bootstrap.Modal(document.getElementById('leadDetailModal'));
            modal.show();
            
        } catch (error) {
            console.error('Error loading lead details:', error);
            this.showError('Failed to load lead details: ' + error.message);
        }
    }

    // Render lead detail content
    renderLeadDetailContent(lead) {
        return `
            <div class="row g-4">
                <div class="col-md-6">
                    <div class="card border-0 bg-light">
                        <div class="card-header bg-transparent">
                            <h6 class="mb-0">Contact Information</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Name</label>
                                <div>${lead.name || 'N/A'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Phone</label>
                                <div>
                                    ${lead.phone_number ? `
                                        <a href="tel:${lead.phone_number}" class="text-decoration-none">
                                            ${window.leadsAPI.formatPhoneNumber(lead.phone_number)}
                                        </a>
                                    ` : 'N/A'}
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Email</label>
                                <div>
                                    ${lead.email ? `
                                        <a href="mailto:${lead.email}" class="text-decoration-none">
                                            ${lead.email}
                                        </a>
                                    ` : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card border-0 bg-light">
                        <div class="card-header bg-transparent">
                            <h6 class="mb-0">Lead Information</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Status</label>
                                <div>
                                    <span class="badge ${window.leadsAPI.getStatusBadgeClass(lead.status)}">
                                        ${window.leadsAPI.getStatusDisplayName(lead.status)}
                                    </span>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Source</label>
                                <div>
                                    <span class="badge bg-light text-dark border">
                                        <i class="bi bi-${lead.source === 'google_sheets' ? 'table' : 'person-plus'} me-1"></i>
                                        ${window.leadsAPI.getSourceDisplayName(lead.source)}
                                    </span>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Created</label>
                                <div>${new Date(lead.created_at).toLocaleString()}</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Last Updated</label>
                                <div>${new Date(lead.updated_at).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${lead.notes ? `
                    <div class="col-12">
                        <div class="card border-0 bg-light">
                            <div class="card-header bg-transparent">
                                <h6 class="mb-0">Notes</h6>
                            </div>
                            <div class="card-body">
                                <p class="mb-0">${lead.notes}</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="col-12">
                    <div class="d-flex gap-2">
                        <button class="btn btn-success" onclick="leadManagement.initiateCall(${lead.id})"
                                ${lead.phone_number ? '' : 'disabled'}>
                            <i class="bi bi-telephone me-1"></i>
                            Call Lead
                        </button>
                        ${lead.source === 'manual' ? `
                            <button class="btn btn-outline-secondary" onclick="leadManagement.editLead(${lead.id})">
                                <i class="bi bi-pencil me-1"></i>
                                Edit Lead
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Initiate call (placeholder for Twilio integration)
    async initiateCall(leadId) {
        try {
            // For now, just show a placeholder message
            this.showInfo('Call functionality will be available when Twilio integration is complete');
            
            // Update lead status to contacted if it's new
            const lead = this.leads.find(l => l.id === leadId);
            if (lead && lead.status === 'new') {
                await this.updateLeadStatus(leadId, 'contacted');
            }
            
        } catch (error) {
            console.error('Error initiating call:', error);
            this.showError('Failed to initiate call: ' + error.message);
        }
    }

    // Edit lead (placeholder)
    editLead(leadId) {
        this.showInfo('Edit lead functionality will be implemented in the next phase');
    }

    // Update loading state
    updateLoadingState() {
        const tableContainer = document.getElementById('leads-table-container');
        if (tableContainer) {
            tableContainer.innerHTML = this.renderLeadsTable();
        }
    }

    // Update leads table
    updateLeadsTable() {
        const tableContainer = document.getElementById('leads-table-container');
        if (tableContainer) {
            tableContainer.innerHTML = this.renderLeadsTable();
        }
    }

    // Update stats cards
    updateStatsCards() {
        const elements = {
            'total-leads': this.stats.total || 0,
            'new-leads': this.stats.new || 0,
            'contacted-leads': this.stats.contacted || 0,
            'converted-leads': this.stats.converted || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // Utility methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showSuccess(message) {
        console.log('Success:', message);
        // Implementation depends on notification system
    }

    showError(message) {
        console.error('Error:', message);
        // Implementation depends on notification system  
    }

    showInfo(message) {
        console.log('Info:', message);
        // Implementation depends on notification system
    }
}

// Global instance
window.leadManagement = new LeadManagement();