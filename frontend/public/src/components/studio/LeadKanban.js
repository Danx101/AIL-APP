// Lead Kanban Board Component
class LeadKanban {
    constructor() {
        this.studioId = null;
        this.leads = {
            new: [],
            working: [],
            qualified: [],
            trial_scheduled: []
        };
        this.archived = {
            positive: { converted: [] },
            negative: { 
                unreachable: [], 
                wrong_number: [],
                not_interested: [], 
                lost: [] 
            }
        };
        this.metrics = {};
        this.draggedLead = null;
        this.showArchived = false;
        this.searchQuery = '';
        this.selectedLead = null;
        this.selectedArchivedLeads = new Set();
        this.archiveSearchQuery = '';
        this.archiveStatusFilter = 'all';
    }

    async init(studioId) {
        this.studioId = studioId;
        console.log('Initializing Lead Kanban for studio:', studioId);
        
        // Verify authorization
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'studio_owner') {
            console.warn('Access denied: Studio owner role required');
            return;
        }

        this.render();
        await this.loadKanbanData();
        this.setupDragAndDrop();
        this.setupEventListeners();
    }

    render() {
        const container = document.getElementById('lead-kanban-content') || document.getElementById('app');
        console.log('Rendering Lead Kanban, showArchived:', this.showArchived);
        container.innerHTML = `
            <div class="lead-kanban">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <h2 class="h3 mb-0">
                            <i class="bi bi-kanban text-primary me-2"></i>
                            Lead Management Kanban
                        </h2>
                        <p class="text-muted mb-0">Drag and drop to move leads through stages</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap" style="min-width: 250px;">
                        <button class="btn ${this.showArchived ? 'btn-secondary' : 'btn-outline-dark'}" onclick="leadKanban.toggleArchived()" id="toggle-archive-btn" style="white-space: nowrap; border-width: 2px;">
                            <i class="bi bi-archive me-1"></i>
                            ${this.showArchived ? 'Hide' : 'Show'} Archive
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-plus-circle me-1"></i>
                                Add New
                            </button>
                            <ul class="dropdown-menu">
                                <li>
                                    <a class="dropdown-item" href="#" onclick="leadKanban.showAddLeadModal(); return false;">
                                        <i class="bi bi-person-plus me-2"></i>
                                        New Lead
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="leadKanban.showWalkInTrialModal(); return false;">
                                        <i class="bi bi-door-open me-2"></i>
                                        Walk-in Trial
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Metrics Row -->
                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <div class="icon-circle bg-primary bg-opacity-10">
                                        <i class="bi bi-people text-primary"></i>
                                    </div>
                                    <div class="ms-3">
                                        <div class="fs-4 fw-bold text-primary" id="metric-total-active">
                                            ${this.metrics.total_active || 0}
                                        </div>
                                        <div class="text-muted small">Active Leads</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <div class="icon-circle bg-success bg-opacity-10">
                                        <i class="bi bi-check-circle text-success"></i>
                                    </div>
                                    <div class="ms-3">
                                        <div class="fs-4 fw-bold text-success" id="metric-converted">
                                            ${this.metrics.total_converted || 0}
                                        </div>
                                        <div class="text-muted small">Converted</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <div class="icon-circle bg-info bg-opacity-10">
                                        <i class="bi bi-percent text-info"></i>
                                    </div>
                                    <div class="ms-3">
                                        <div class="fs-4 fw-bold text-info" id="metric-conversion-rate">
                                            ${Math.round((this.metrics.conversion_rate || 0) * 100)}%
                                        </div>
                                        <div class="text-muted small">Conversion Rate</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <div class="icon-circle bg-warning bg-opacity-10">
                                        <i class="bi bi-clock text-warning"></i>
                                    </div>
                                    <div class="ms-3">
                                        <div class="fs-4 fw-bold text-warning" id="metric-avg-time">
                                            ${this.metrics.avg_time_to_convert || '0d'}
                                        </div>
                                        <div class="text-muted small">Avg. Time to Convert</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Search Bar -->
                <div class="mb-3">
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="text" 
                               class="form-control" 
                               id="kanban-search"
                               placeholder="Search leads by name, phone, or email..."
                               onkeyup="leadKanban.filterLeads(this.value)">
                    </div>
                </div>

                <!-- Kanban Board -->
                <div class="kanban-board">
                    <div class="row g-3">
                        ${this.renderKanbanColumns()}
                    </div>
                </div>

                <!-- Archive Panel -->
                <div class="archive-panel ${this.showArchived ? 'show' : ''}" id="archive-panel">
                    ${this.renderArchivePanel()}
                </div>
            </div>

            <!-- Modals -->
            ${this.renderModals()}

            <style>
                .lead-kanban { padding: 20px; }
                .icon-circle {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                }
                .kanban-column {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 15px;
                    min-height: 400px;
                }
                .kanban-column-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid;
                }
                .kanban-column.new .kanban-column-header { border-color: #0d6efd; }
                .kanban-column.working .kanban-column-header { border-color: #ffc107; }
                .kanban-column.qualified .kanban-column-header { border-color: #20c997; }
                .kanban-column.trial_scheduled .kanban-column-header { border-color: #6f42c1; }
                
                .kanban-cards {
                    min-height: 350px;
                }
                .lead-card {
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 10px;
                    cursor: move;
                    transition: all 0.2s;
                }
                .lead-card:hover {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transform: translateY(-2px);
                }
                .lead-card.dragging {
                    opacity: 0.5;
                }
                .kanban-column.drag-over {
                    background: #e9ecef;
                    border: 2px dashed #adb5bd;
                }
                .archive-panel {
                    margin-top: 30px;
                    display: none;
                }
                .archive-panel.show {
                    display: block;
                }
                .lead-badge {
                    font-size: 11px;
                    padding: 2px 6px;
                }
                .lead-actions {
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .lead-card:hover .lead-actions {
                    opacity: 1;
                }
            </style>
        `;
    }

    renderKanbanColumns() {
        const columns = [
            { key: 'new', title: 'New', color: 'primary', icon: 'star' },
            { key: 'working', title: 'Working', color: 'warning', icon: 'telephone' },
            { key: 'qualified', title: 'Qualified', color: 'success', icon: 'check2-circle' },
            { key: 'trial_scheduled', title: 'Trial Scheduled', color: 'purple', icon: 'calendar-check' }
        ];

        return columns.map(col => `
            <div class="col-md-3">
                <div class="kanban-column ${col.key}" data-status="${col.key}">
                    <div class="kanban-column-header">
                        <div>
                            <i class="bi bi-${col.icon} text-${col.color} me-2"></i>
                            <strong>${col.title}</strong>
                        </div>
                        <span class="badge bg-${col.color === 'purple' ? 'primary' : col.color}">
                            ${(this.leads[col.key] || []).length}
                        </span>
                    </div>
                    <div class="kanban-cards" 
                         ondrop="leadKanban.handleDrop(event, '${col.key}')"
                         ondragover="leadKanban.handleDragOver(event)"
                         ondragleave="leadKanban.handleDragLeave(event)">
                        ${this.renderLeadCards(this.leads[col.key] || [])}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderLeadCards(leads) {
        if (!leads || leads.length === 0) {
            return '<div class="text-center text-muted py-4">No leads</div>';
        }

        return leads.map(lead => `
            <div class="lead-card" 
                 draggable="true"
                 data-lead-id="${lead.id}"
                 ondragstart="leadKanban.handleDragStart(event, ${lead.id})">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${lead.name || 'Unknown'}</h6>
                    <div class="lead-actions">
                        <button class="btn btn-sm btn-link p-0" onclick="leadKanban.showLeadDetails(${lead.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </div>
                ${lead.phone_number ? `
                    <div class="small text-muted mb-1">
                        <i class="bi bi-telephone me-1"></i>
                        ${this.formatPhone(lead.phone_number)}
                    </div>
                ` : ''}
                ${lead.email ? `
                    <div class="small text-muted mb-1">
                        <i class="bi bi-envelope me-1"></i>
                        ${lead.email}
                    </div>
                ` : ''}
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="lead-badge badge bg-light text-dark">
                        ${lead.contact_attempts || 0} contacts
                    </span>
                    <small class="text-muted">${this.getTimeInStage(lead.stage_entered_at)}</small>
                </div>
            </div>
        `).join('');
    }

    renderArchivePanel() {
        // Combine all archived leads into a single array
        let allArchived = [
            ...(this.archived.positive.converted || []),
            ...(this.archived.negative.unreachable || []),
            ...(this.archived.negative.not_interested || []),
            ...(this.archived.negative.lost || []),
            ...(this.archived.negative.wrong_number || [])
        ];

        // Apply status filter
        if (this.archiveStatusFilter !== 'all') {
            allArchived = allArchived.filter(lead => lead.status === this.archiveStatusFilter);
        }

        // Apply search filter
        if (this.archiveSearchQuery) {
            const query = this.archiveSearchQuery.toLowerCase();
            allArchived = allArchived.filter(lead => {
                const name = (lead.name || '').toLowerCase();
                const phone = (lead.phone_number || '').toLowerCase();
                const email = (lead.email || '').toLowerCase();
                return name.includes(query) || phone.includes(query) || email.includes(query);
            });
        }

        const hasSelection = this.selectedArchivedLeads.size > 0;

        return `
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-transparent">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0">
                            <i class="bi bi-clock-history me-2"></i>
                            Archive History
                            <span class="badge bg-secondary ms-2">${allArchived.length}</span>
                        </h5>
                        <div class="d-flex gap-2">
                            ${hasSelection ? `
                                <button class="btn btn-primary btn-sm" onclick="leadKanban.reactivateSelectedLeads()">
                                    <i class="bi bi-arrow-counterclockwise me-1"></i>
                                    Reactivate Selected (${this.selectedArchivedLeads.size})
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="leadKanban.deleteSelectedLeads()">
                                    <i class="bi bi-trash me-1"></i>
                                    Delete Selected (${this.selectedArchivedLeads.size})
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Search and Filter Row -->
                    <div class="row g-2">
                        <div class="col-md-6">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">
                                    <i class="bi bi-search"></i>
                                </span>
                                <input type="text" 
                                       class="form-control form-control-sm" 
                                       placeholder="Search by name, phone, or email..."
                                       value="${this.archiveSearchQuery}"
                                       onkeyup="leadKanban.filterArchive(this.value, null)">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select form-select-sm" 
                                    onchange="leadKanban.filterArchive(null, this.value)">
                                <option value="all">All Statuses</option>
                                <option value="converted" ${this.archiveStatusFilter === 'converted' ? 'selected' : ''}>Converted</option>
                                <option value="lost" ${this.archiveStatusFilter === 'lost' ? 'selected' : ''}>Lost After Trial</option>
                                <option value="not_interested" ${this.archiveStatusFilter === 'not_interested' ? 'selected' : ''}>Not Interested</option>
                                <option value="unreachable" ${this.archiveStatusFilter === 'unreachable' ? 'selected' : ''}>Unreachable</option>
                                <option value="wrong_number" ${this.archiveStatusFilter === 'wrong_number' ? 'selected' : ''}>Wrong Number</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            ${hasSelection ? `
                                <button class="btn btn-outline-secondary btn-sm w-100" onclick="leadKanban.clearSelection()">
                                    Clear Selection
                                </button>
                            ` : `
                                <button class="btn btn-outline-primary btn-sm w-100" onclick="leadKanban.selectAllVisible()">
                                    Select All
                                </button>
                            `}
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    ${allArchived.length === 0 ? `
                        <div class="text-center text-muted py-4">
                            <i class="bi bi-inbox fs-1"></i>
                            <p class="mt-2">No archived leads ${this.archiveStatusFilter !== 'all' || this.archiveSearchQuery ? 'matching your criteria' : ''}</p>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th width="40">
                                            <input type="checkbox" 
                                                   class="form-check-input" 
                                                   onchange="leadKanban.toggleAllSelection(this.checked)"
                                                   ${this.selectedArchivedLeads.size === allArchived.length && allArchived.length > 0 ? 'checked' : ''}>
                                        </th>
                                        <th>Name</th>
                                        <th>Contact Information</th>
                                        <th>Status</th>
                                        <th>Archived Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allArchived.map(lead => this.renderArchivedLeadRow(lead)).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderArchivedLeadRow(lead) {
        const statusBadges = {
            'converted': '<span class="badge bg-success">Converted</span>',
            'lost': '<span class="badge bg-danger">Lost After Trial</span>',
            'not_interested': '<span class="badge bg-warning">Not Interested</span>',
            'unreachable': '<span class="badge bg-secondary">Unreachable</span>',
            'wrong_number': '<span class="badge bg-dark">Wrong Number</span>'
        };

        const archivedDate = lead.stage_entered_at ? new Date(lead.stage_entered_at).toLocaleDateString() : 'N/A';
        const isSelected = this.selectedArchivedLeads.has(lead.id);

        return `
            <tr class="${isSelected ? 'table-active' : ''}" onclick="leadKanban.toggleLeadSelection(${lead.id}, event)" style="cursor: pointer;">
                <td>
                    <input type="checkbox" 
                           class="form-check-input" 
                           ${isSelected ? 'checked' : ''}
                           onclick="leadKanban.toggleLeadSelection(${lead.id}, event)">
                </td>
                <td><strong>${lead.name || 'Unknown'}</strong></td>
                <td>
                    ${lead.phone_number ? `<div><i class="bi bi-telephone me-1"></i>${this.formatPhone(lead.phone_number)}</div>` : ''}
                    ${lead.email ? `<div><i class="bi bi-envelope me-1"></i>${lead.email}</div>` : ''}
                    ${!lead.phone_number && !lead.email ? '<span class="text-muted">No contact info</span>' : ''}
                </td>
                <td>${statusBadges[lead.status] || lead.status}</td>
                <td>${archivedDate}</td>
            </tr>
        `;
    }


    renderModals() {
        return `
            <!-- Add Lead Modal -->
            <div class="modal fade" id="addLeadModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add New Lead</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-lead-form">
                                <div class="mb-3">
                                    <label class="form-label">Name <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="lead-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Phone <span class="text-danger">*</span></label>
                                    <input type="tel" class="form-control" id="lead-phone" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="lead-email">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Notes</label>
                                    <textarea class="form-control" id="lead-notes" rows="3"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="leadKanban.addLead()">
                                Add Lead
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Schedule Trial Modal -->
            <div class="modal fade" id="scheduleTrialModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Schedule Trial Appointment</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="schedule-trial-form">
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Scheduling trial for: <strong id="trial-lead-name"></strong>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Date <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" id="trial-date" required>
                                </div>
                                <div class="row">
                                    <div class="col-6">
                                        <div class="mb-3">
                                            <label class="form-label">Start Time <span class="text-danger">*</span></label>
                                            <input type="time" class="form-control" id="trial-start-time" required>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="mb-3">
                                            <label class="form-label">End Time <span class="text-danger">*</span></label>
                                            <input type="time" class="form-control" id="trial-end-time" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="send-reminder" checked>
                                        <label class="form-check-label" for="send-reminder">
                                            Send SMS reminder
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="leadKanban.confirmScheduleTrial()">
                                Schedule Trial
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Convert to Customer Modal -->
            <div class="modal fade" id="convertModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Convert Lead to Customer</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="convert-form">
                                <div class="alert alert-success">
                                    <i class="bi bi-check-circle me-2"></i>
                                    Converting: <strong id="convert-lead-name"></strong>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Session Package <span class="text-danger">*</span></label>
                                    <div class="row g-2">
                                        <div class="col-6">
                                            <div class="form-check card p-3">
                                                <input class="form-check-input" type="radio" name="sessionPackage" 
                                                       id="package-10" value="10" required>
                                                <label class="form-check-label w-100" for="package-10">
                                                    <strong>10 Sessions</strong>
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check card p-3">
                                                <input class="form-check-input" type="radio" name="sessionPackage" 
                                                       id="package-20" value="20" required>
                                                <label class="form-check-label w-100" for="package-20">
                                                    <strong>20 Sessions</strong>
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check card p-3">
                                                <input class="form-check-input" type="radio" name="sessionPackage" 
                                                       id="package-30" value="30" required>
                                                <label class="form-check-label w-100" for="package-30">
                                                    <strong>30 Sessions</strong>
                                                </label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check card p-3">
                                                <input class="form-check-input" type="radio" name="sessionPackage" 
                                                       id="package-40" value="40" required>
                                                <label class="form-check-label w-100" for="package-40">
                                                    <strong>40 Sessions</strong>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Payment Method <span class="text-danger">*</span></label>
                                    <select class="form-select" id="payment-method" required>
                                        <option value="">Select payment method</option>
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="transfer">Bank Transfer</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Notes</label>
                                    <textarea class="form-control" id="conversion-notes" rows="2"></textarea>
                                </div>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Customer will receive a registration code for app access
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="leadKanban.confirmConversion()">
                                <i class="bi bi-check-circle me-1"></i>
                                Convert to Customer
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Walk-in Trial Modal -->
            <div class="modal fade" id="walkInTrialModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-door-open me-2"></i>
                                Walk-in Trial Appointment
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="walk-in-trial-form">
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Create a new lead and schedule their trial appointment immediately
                                </div>
                                
                                <h6 class="mb-3">Customer Information</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="walk-in-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Phone <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="walk-in-phone" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Email</label>
                                        <input type="email" class="form-control" id="walk-in-email">
                                    </div>
                                </div>
                                
                                <hr class="my-3">
                                
                                <h6 class="mb-3">Trial Appointment</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Date <span class="text-danger">*</span></label>
                                        <input type="date" class="form-control" id="walk-in-date" required>
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label">Start Time <span class="text-danger">*</span></label>
                                        <input type="time" class="form-control" id="walk-in-start" required>
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label">End Time <span class="text-danger">*</span></label>
                                        <input type="time" class="form-control" id="walk-in-end" required>
                                    </div>
                                </div>
                                
                                <div class="mt-3">
                                    <label class="form-label">Notes</label>
                                    <textarea class="form-control" id="walk-in-notes" rows="2" 
                                              placeholder="Any special requirements or notes..."></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="leadKanban.createWalkInTrial()">
                                <i class="bi bi-calendar-check me-1"></i>
                                Schedule Trial
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadKanbanData() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/kanban?studio_id=${this.studioId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load kanban data');

            const data = await response.json();
            console.log('Kanban data received:', data);
            console.log('Archived data:', data.archived);
            
            // Organize leads by status
            this.leads = data.active || {
                new: [],
                working: [],
                qualified: [],
                trial_scheduled: []
            };
            
            this.archived = data.archived || {
                positive: { converted: [] },
                negative: { 
                    unreachable: [], 
                    wrong_number: [],
                    not_interested: [], 
                    lost: [] 
                }
            };
            
            console.log('Processed archived:', this.archived);
            
            this.metrics = data.metrics || {};
            
            // Force full re-render to ensure UI updates
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error loading kanban data:', error);
            this.showNotification('Failed to load leads', 'error');
        }
    }

    setupDragAndDrop() {
        // Drag and drop is set up via inline event handlers in the HTML
        console.log('Drag and drop initialized');
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('kanban-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterLeads(e.target.value);
            });
        }
    }

    handleDragStart(event, leadId) {
        this.draggedLead = leadId;
        event.dataTransfer.effectAllowed = 'move';
        event.target.classList.add('dragging');
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const column = event.currentTarget.closest('.kanban-column');
        if (column) {
            column.classList.add('drag-over');
        }
    }

    handleDragLeave(event) {
        const column = event.currentTarget.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
        }
    }

    async handleDrop(event, toStatus) {
        event.preventDefault();
        
        const column = event.currentTarget.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
        }

        if (!this.draggedLead) return;

        // Special handling for trial_scheduled - show modal
        if (toStatus === 'trial_scheduled') {
            const lead = this.findLeadById(this.draggedLead);
            if (lead) {
                this.showScheduleTrialModal(lead);
            }
            return;
        }

        // Move the lead
        await this.moveLead(this.draggedLead, toStatus);
        
        // Reset dragging state
        document.querySelectorAll('.lead-card.dragging').forEach(card => {
            card.classList.remove('dragging');
        });
        this.draggedLead = null;
    }

    async moveLead(leadId, toStatus, appointmentData = null) {
        try {
            const token = localStorage.getItem('authToken');
            const requestBody = { to_status: toStatus };
            
            if (appointmentData) {
                requestBody.appointment_data = appointmentData;
            }
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/move`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to move lead');
            }

            // Success - reload data and update UI
            await this.loadKanbanData();
            this.showNotification('Lead moved successfully', 'success');
            
            // Reset dragging state
            this.draggedLead = null;
            document.querySelectorAll('.lead-card.dragging').forEach(card => {
                card.classList.remove('dragging');
            });
        } catch (error) {
            console.error('Error moving lead:', error);
            this.showNotification(error.message, 'error');
            
            // Reset dragging state even on error
            this.draggedLead = null;
            document.querySelectorAll('.lead-card.dragging').forEach(card => {
                card.classList.remove('dragging');
            });
            
            // Reload to reset state
            await this.loadKanbanData();
        }
    }

    showScheduleTrialModal(lead) {
        this.selectedLead = lead;
        document.getElementById('trial-lead-name').textContent = lead.name || 'Unknown';
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('trial-date').value = tomorrow.toISOString().split('T')[0];
        
        const modal = new bootstrap.Modal(document.getElementById('scheduleTrialModal'));
        modal.show();
    }

    async confirmScheduleTrial() {
        const date = document.getElementById('trial-date').value;
        const startTime = document.getElementById('trial-start-time').value;
        const endTime = document.getElementById('trial-end-time').value;

        if (!date || !startTime || !endTime) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }

        const appointmentData = {
            date: date,
            time: startTime,
            end_time: endTime
        };

        // Get the lead ID - prioritize draggedLead if it exists
        const leadId = this.draggedLead || (this.selectedLead ? this.selectedLead.id : null);
        
        if (!leadId) {
            this.showNotification('No lead selected', 'error');
            return;
        }

        await this.moveLead(leadId, 'trial_scheduled', appointmentData);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleTrialModal'));
        if (modal) {
            modal.hide();
        }
        
        // Reset form and state
        document.getElementById('schedule-trial-form').reset();
        this.selectedLead = null;
    }

    async showConvertModal(leadId) {
        const lead = this.findLeadById(leadId);
        if (!lead) return;

        this.selectedLead = lead;
        document.getElementById('convert-lead-name').textContent = lead.name || 'Unknown';
        
        const modal = new bootstrap.Modal(document.getElementById('convertModal'));
        modal.show();
    }

    async confirmConversion() {
        const sessionPackage = document.querySelector('input[name="sessionPackage"]:checked')?.value;
        const paymentMethod = document.getElementById('payment-method').value;
        const notes = document.getElementById('conversion-notes').value;

        if (!sessionPackage || !paymentMethod) {
            this.showNotification('Please select session package and payment method', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${this.selectedLead.id}/convert`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionPackage: parseInt(sessionPackage),
                    paymentMethod: paymentMethod,
                    notes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to convert lead');
            }

            // Show success message
            this.showNotification(
                `Lead converted to customer successfully!`,
                'success'
            );

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('convertModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('convert-form').reset();
            
            // Reload kanban
            await this.loadKanbanData();
        } catch (error) {
            console.error('Error converting lead:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async reactivateLead(leadId) {
        if (!confirm('Reactivate this lead and move it to Working status?')) return;

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/reactivate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target_status: 'working'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to reactivate lead');
            }

            // Reload data and refresh UI
            await this.loadKanbanData();
            
            // If archive panel is visible, update it
            if (this.showArchived) {
                const panel = document.getElementById('archive-panel');
                if (panel) {
                    panel.innerHTML = this.renderArchivePanel();
                }
            }
            
            this.showNotification('Lead reactivated successfully', 'success');
        } catch (error) {
            console.error('Error reactivating lead:', error);
            this.showNotification(error.message || 'Failed to reactivate lead', 'error');
            // Reload to ensure UI is in sync
            await this.loadKanbanData();
        }
    }

    async archiveLead(leadId, archiveStatus) {
        const statusMessages = {
            'not_interested': 'Mark as Not Interested?',
            'unreachable': 'Mark as Unreachable?',
            'wrong_number': 'Mark as Wrong Number?',
            'lost': 'Mark as Lost After Trial?'
        };

        if (!confirm(statusMessages[archiveStatus] || 'Archive this lead?')) return;

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/move`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to_status: archiveStatus
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to archive lead');
            }

            // Close the modal if it's open
            const modal = bootstrap.Modal.getInstance(document.getElementById('leadDetailsModal'));
            if (modal) {
                modal.hide();
            }

            // Reload data and refresh UI
            await this.loadKanbanData();
            
            // If archive panel is visible, update it
            if (this.showArchived) {
                const panel = document.getElementById('archive-panel');
                if (panel) {
                    panel.innerHTML = this.renderArchivePanel();
                }
            }
            
            this.showNotification('Lead archived successfully', 'success');
        } catch (error) {
            console.error('Error archiving lead:', error);
            this.showNotification(error.message || 'Failed to archive lead', 'error');
            // Reload to ensure UI is in sync
            await this.loadKanbanData();
        }
    }

    showAddLeadModal() {
        const modal = new bootstrap.Modal(document.getElementById('addLeadModal'));
        modal.show();
    }

    async addLead() {
        const name = document.getElementById('lead-name').value.trim();
        const phone = document.getElementById('lead-phone').value.trim();
        const email = document.getElementById('lead-email').value.trim();
        const notes = document.getElementById('lead-notes').value.trim();

        if (!name || !phone) {
            this.showNotification('Name and phone are required', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken'); // Fixed: should be authToken not token
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    phone_number: phone,
                    email: email || null,
                    notes: notes || null,
                    status: 'new',
                    source: 'manual',
                    studio_id: this.studioId
                })
            });

            if (!response.ok) throw new Error('Failed to add lead');

            // Close modal and reset form
            const modalElement = document.getElementById('addLeadModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();
            }
            const form = document.getElementById('add-lead-form');
            if (form) {
                form.reset();
            }

            await this.loadKanbanData();
            this.showNotification('Lead added successfully', 'success');
        } catch (error) {
            console.error('Error adding lead:', error);
            this.showNotification('Failed to add lead', 'error');
        }
    }

    async showLeadDetails(leadId) {
        const lead = this.findLeadById(leadId);
        if (!lead) return;

        this.selectedLead = lead;

        // Create and show lead details modal
        const modalHtml = `
            <div class="modal fade" id="leadDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Lead Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <!-- Tabs for Details and Activities -->
                                    <ul class="nav nav-tabs mb-3" id="leadDetailsTabs" role="tablist">
                                        <li class="nav-item" role="presentation">
                                            <button class="nav-link active" id="details-tab" data-bs-toggle="tab" data-bs-target="#details" type="button" role="tab">
                                                <i class="bi bi-person-circle me-1"></i>
                                                Details
                                            </button>
                                        </li>
                                        <li class="nav-item" role="presentation">
                                            <button class="nav-link" id="activities-tab" data-bs-toggle="tab" data-bs-target="#activities" type="button" role="tab" onclick="leadKanban.loadLeadActivities(${leadId})">
                                                <i class="bi bi-clock-history me-1"></i>
                                                Activities
                                            </button>
                                        </li>
                                    </ul>
                                    
                                    <div class="tab-content" id="leadDetailsTabContent">
                                        <!-- Details Tab -->
                                        <div class="tab-pane fade show active" id="details" role="tabpanel">
                                            <h4>${lead.name}</h4>
                                            <div class="mb-3">
                                                <label class="text-muted">Phone:</label>
                                                <div>${lead.phone_number ? `<a href="tel:${lead.phone_number}">${this.formatPhone(lead.phone_number)}</a>` : 'N/A'}</div>
                                            </div>
                                            <div class="mb-3">
                                                <label class="text-muted">Email:</label>
                                                <div>${lead.email ? `<a href="mailto:${lead.email}">${lead.email}</a>` : 'N/A'}</div>
                                            </div>
                                            <div class="mb-3">
                                                <label class="text-muted">Current Status:</label>
                                                <div><span class="badge bg-primary">${lead.status.replace('_', ' ').toUpperCase()}</span></div>
                                            </div>
                                            ${lead.notes ? `
                                                <div class="mb-3">
                                                    <label class="text-muted">Notes:</label>
                                                    <div>${lead.notes}</div>
                                                </div>
                                            ` : ''}
                                        </div>
                                        
                                        <!-- Activities Tab -->
                                        <div class="tab-pane fade" id="activities" role="tabpanel">
                                            <div id="leadActivitiesContainer">
                                                <div class="text-center">
                                                    <div class="spinner-border" role="status">
                                                        <span class="visually-hidden">Loading activities...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <h6 class="mb-3">Quick Actions</h6>
                                    ${lead.status === 'qualified' || lead.status === 'trial_scheduled' ? `
                                        <button class="btn btn-success w-100 mb-2" onclick="leadKanban.showConvertModal(${leadId})">
                                            <i class="bi bi-check-circle me-2"></i>
                                            Convert to Customer
                                        </button>
                                    ` : ''}
                                    
                                    <hr class="my-3">
                                    
                                    <h6 class="mb-3">Archive Lead</h6>
                                    <button class="btn btn-outline-warning w-100 mb-2" onclick="leadKanban.archiveLead(${leadId}, 'not_interested')">
                                        <i class="bi bi-x-circle me-2"></i>
                                        Not Interested
                                    </button>
                                    <button class="btn btn-outline-secondary w-100 mb-2" onclick="leadKanban.archiveLead(${leadId}, 'unreachable')">
                                        <i class="bi bi-telephone-x me-2"></i>
                                        Unreachable
                                    </button>
                                    <button class="btn btn-outline-danger w-100 mb-2" onclick="leadKanban.archiveLead(${leadId}, 'wrong_number')">
                                        <i class="bi bi-exclamation-triangle me-2"></i>
                                        Wrong Number
                                    </button>
                                    ${lead.status === 'trial_scheduled' ? `
                                        <button class="btn btn-outline-danger w-100" onclick="leadKanban.archiveLead(${leadId}, 'lost')">
                                            <i class="bi bi-person-x me-2"></i>
                                            Lost After Trial
                                        </button>
                                    ` : ''}
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

        // Remove existing modal if any
        const existingModal = document.getElementById('leadDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('leadDetailsModal'));
        modal.show();

        // Clean up on hide
        document.getElementById('leadDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async loadLeadActivities(leadId) {
        const container = document.getElementById('leadActivitiesContainer');
        if (!container) return;

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/activities`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load activities');
            }

            const data = await response.json();
            const activities = data.activities || [];

            if (activities.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-clock-history display-6 mb-2"></i>
                        <p>No activities recorded yet</p>
                    </div>
                `;
                return;
            }

            let activitiesHtml = '<div class="list-group list-group-flush">';
            
            activities.forEach(activity => {
                const date = new Date(activity.created_at).toLocaleDateString();
                const time = new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const userName = activity.first_name && activity.last_name 
                    ? `${activity.first_name} ${activity.last_name}` 
                    : 'System';

                let activityIcon = 'bi-circle';
                let activityColor = 'text-muted';

                // Set icons and colors based on activity type
                switch (activity.activity_type) {
                    case 'status_change':
                        activityIcon = 'bi-arrow-right-circle';
                        activityColor = 'text-primary';
                        break;
                    case 'conversion':
                        activityIcon = 'bi-check-circle';
                        activityColor = 'text-success';
                        break;
                    case 'note':
                        activityIcon = 'bi-chat-square-text';
                        activityColor = 'text-info';
                        break;
                    case 'call':
                    case 'email':
                    case 'sms':
                        activityIcon = 'bi-telephone';
                        activityColor = 'text-warning';
                        break;
                    default:
                        activityIcon = 'bi-clock-history';
                        activityColor = 'text-secondary';
                }

                activitiesHtml += `
                    <div class="list-group-item border-0 px-0 py-3">
                        <div class="d-flex align-items-start">
                            <div class="flex-shrink-0 me-3">
                                <i class="bi ${activityIcon} ${activityColor} fs-5"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start mb-1">
                                    <h6 class="mb-1">${activity.description}</h6>
                                    <small class="text-muted">${date} ${time}</small>
                                </div>
                                <div class="d-flex align-items-center text-muted small">
                                    <span>by ${userName}</span>
                                    ${activity.from_status && activity.to_status ? `
                                        <span class="mx-2">•</span>
                                        <span class="badge bg-light text-dark me-1">${activity.from_status}</span>
                                        <i class="bi bi-arrow-right mx-1"></i>
                                        <span class="badge bg-primary">${activity.to_status}</span>
                                    ` : ''}
                                </div>
                                ${activity.metadata ? `
                                    <div class="mt-2">
                                        <small class="text-muted">${this.formatActivityMetadata(activity.metadata)}</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });

            activitiesHtml += '</div>';
            container.innerHTML = activitiesHtml;

        } catch (error) {
            console.error('Error loading lead activities:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Failed to load activities. Please try again.
                </div>
            `;
        }
    }

    formatActivityMetadata(metadata) {
        try {
            const data = JSON.parse(metadata);
            let formatted = [];
            
            if (data.customer_id) {
                formatted.push(`Customer ID: ${data.customer_id}`);
            }
            if (data.registration_code) {
                formatted.push(`Registration Code: ${data.registration_code}`);
            }
            if (data.session_package) {
                formatted.push(`Session Package: ${data.session_package} sessions`);
            }
            
            return formatted.join(' • ');
        } catch (e) {
            return metadata;
        }
    }

    toggleArchived() {
        this.showArchived = !this.showArchived;
        console.log('Toggle archive, showArchived is now:', this.showArchived);
        console.log('Current archived data:', this.archived);
        
        const panel = document.getElementById('archive-panel');
        if (panel) {
            panel.classList.toggle('show');
            // Re-render the archive panel content when showing
            if (this.showArchived) {
                panel.innerHTML = this.renderArchivePanel();
            }
        }
        
        // Update button text and style
        const button = document.getElementById('toggle-archive-btn');
        if (button) {
            button.className = `btn ${this.showArchived ? 'btn-secondary' : 'btn-outline-dark'}`;
            button.innerHTML = `
                <i class="bi bi-archive me-1"></i>
                ${this.showArchived ? 'Hide' : 'Show'} Archive
            `;
        }
    }

    filterLeads(query) {
        this.searchQuery = query.toLowerCase();
        // In a real implementation, this would filter the displayed leads
        console.log('Filtering leads with:', query);
    }

    findLeadById(leadId) {
        // Search in all columns
        for (const status in this.leads) {
            const lead = this.leads[status].find(l => l.id === leadId);
            if (lead) return lead;
        }
        return null;
    }


    formatPhone(phone) {
        // Simple phone formatting
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }

    getTimeInStage(enteredAt) {
        if (!enteredAt) return 'Just added';
        
        const now = new Date();
        const entered = new Date(enteredAt);
        const days = Math.floor((now - entered) / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return '1 day';
        return `${days} days`;
    }

    showWalkInTrialModal() {
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('walk-in-date').value = today;
        
        const modal = new bootstrap.Modal(document.getElementById('walkInTrialModal'));
        modal.show();
    }

    async createWalkInTrial() {
        const name = document.getElementById('walk-in-name').value.trim();
        const phone = document.getElementById('walk-in-phone').value.trim();
        const email = document.getElementById('walk-in-email').value.trim();
        const date = document.getElementById('walk-in-date').value;
        const startTime = document.getElementById('walk-in-start').value;
        const endTime = document.getElementById('walk-in-end').value;
        const notes = document.getElementById('walk-in-notes').value.trim();

        if (!name || !phone || !date || !startTime || !endTime) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            
            // First create the lead
            const leadResponse = await fetch(`${window.API_BASE_URL}/api/v1/leads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    phone_number: phone,
                    email: email || null,
                    notes: notes ? `Walk-in trial scheduled: ${notes}` : 'Walk-in trial scheduled',
                    status: 'trial_scheduled',
                    source: 'walk_in',
                    studio_id: this.studioId
                })
            });

            if (!leadResponse.ok) throw new Error('Failed to create lead');
            const lead = await leadResponse.json();

            // Then create the appointment
            const appointmentResponse = await fetch(`${window.API_BASE_URL}/api/v1/appointments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studio_id: this.studioId,
                    person_type: 'lead',
                    lead_id: lead.id,
                    appointment_type_id: 3, // Probebehandlung
                    appointment_date: date,
                    start_time: startTime,
                    end_time: endTime,
                    status: 'confirmed',
                    notes: 'Walk-in trial appointment'
                })
            });

            if (!appointmentResponse.ok) throw new Error('Failed to create appointment');

            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('walkInTrialModal'));
            modal.hide();
            document.getElementById('walk-in-trial-form').reset();

            await this.loadKanbanData();
            this.showNotification('Walk-in trial scheduled successfully!', 'success');
        } catch (error) {
            console.error('Error creating walk-in trial:', error);
            this.showNotification('Failed to create walk-in trial', 'error');
        }
    }

    confirmDeleteLead(leadId) {
        if (confirm('Are you sure you want to permanently delete this lead from the archive?')) {
            this.deleteLead(leadId);
        }
    }

    async deleteLead(leadId) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete lead');

            await this.loadKanbanData();
            this.showNotification('Lead deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting lead:', error);
            this.showNotification('Failed to delete lead', 'error');
        }
    }

    async reactivateSelectedLeads() {
        const count = this.selectedArchivedLeads.size;
        if (count === 0) return;
        
        // Note: Including converted leads for reactivation
        if (!confirm(`Are you sure you want to reactivate ${count} selected lead(s)? This will move them back to 'Working' status.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            
            // Reactivate each selected lead
            const reactivatePromises = Array.from(this.selectedArchivedLeads).map(leadId => 
                fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/reactivate`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        target_status: 'working'
                    })
                })
            );

            const results = await Promise.all(reactivatePromises);
            
            // Check if all succeeded
            const allSucceeded = results.every(r => r.ok);
            
            this.selectedArchivedLeads.clear();
            await this.loadKanbanData();
            
            // If archive panel is visible, update it
            if (this.showArchived) {
                const panel = document.getElementById('archive-panel');
                if (panel) {
                    panel.innerHTML = this.renderArchivePanel();
                }
            }
            
            if (allSucceeded) {
                this.showNotification(`Reactivated ${count} lead(s) successfully`, 'success');
            } else {
                this.showNotification(`Some leads could not be reactivated. Please check the results.`, 'warning');
            }
        } catch (error) {
            console.error('Error reactivating selected leads:', error);
            this.showNotification('Failed to reactivate selected leads', 'error');
            // Reload to ensure UI is in sync
            await this.loadKanbanData();
        }
    }

    // Archive filtering and selection methods
    filterArchive(searchQuery, statusFilter) {
        if (searchQuery !== null) {
            this.archiveSearchQuery = searchQuery;
        }
        if (statusFilter !== null) {
            this.archiveStatusFilter = statusFilter;
        }
        
        // Re-render archive panel
        const panel = document.getElementById('archive-panel');
        if (panel && this.showArchived) {
            panel.innerHTML = this.renderArchivePanel();
        }
    }

    toggleLeadSelection(leadId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        if (this.selectedArchivedLeads.has(leadId)) {
            this.selectedArchivedLeads.delete(leadId);
        } else {
            this.selectedArchivedLeads.add(leadId);
        }
        
        // Re-render archive panel to update selection
        const panel = document.getElementById('archive-panel');
        if (panel && this.showArchived) {
            panel.innerHTML = this.renderArchivePanel();
        }
    }

    toggleAllSelection(checked) {
        // Get currently visible archived leads
        let allArchived = [
            ...(this.archived.positive.converted || []),
            ...(this.archived.negative.unreachable || []),
            ...(this.archived.negative.not_interested || []),
            ...(this.archived.negative.lost || []),
            ...(this.archived.negative.wrong_number || [])
        ];

        // Apply filters to get only visible leads
        if (this.archiveStatusFilter !== 'all') {
            allArchived = allArchived.filter(lead => lead.status === this.archiveStatusFilter);
        }
        if (this.archiveSearchQuery) {
            const query = this.archiveSearchQuery.toLowerCase();
            allArchived = allArchived.filter(lead => {
                const name = (lead.name || '').toLowerCase();
                const phone = (lead.phone_number || '').toLowerCase();
                const email = (lead.email || '').toLowerCase();
                return name.includes(query) || phone.includes(query) || email.includes(query);
            });
        }

        if (checked) {
            allArchived.forEach(lead => this.selectedArchivedLeads.add(lead.id));
        } else {
            this.selectedArchivedLeads.clear();
        }

        // Re-render archive panel
        const panel = document.getElementById('archive-panel');
        if (panel && this.showArchived) {
            panel.innerHTML = this.renderArchivePanel();
        }
    }

    selectAllVisible() {
        this.toggleAllSelection(true);
    }

    clearSelection() {
        this.selectedArchivedLeads.clear();
        const panel = document.getElementById('archive-panel');
        if (panel && this.showArchived) {
            panel.innerHTML = this.renderArchivePanel();
        }
    }

    async deleteSelectedLeads() {
        const count = this.selectedArchivedLeads.size;
        if (count === 0) return;
        
        if (!confirm(`Are you sure you want to permanently delete ${count} selected lead(s)?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            
            // Delete each selected lead
            const deletePromises = Array.from(this.selectedArchivedLeads).map(leadId => 
                fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
            );

            await Promise.all(deletePromises);
            
            this.selectedArchivedLeads.clear();
            await this.loadKanbanData();
            this.showNotification(`Deleted ${count} lead(s) successfully`, 'success');
        } catch (error) {
            console.error('Error deleting selected leads:', error);
            this.showNotification('Failed to delete selected leads', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create a simple notification
        const alertClass = type === 'error' ? 'danger' : type;
        const notification = document.createElement('div');
        notification.className = `alert alert-${alertClass} position-fixed top-0 end-0 m-3`;
        notification.style.zIndex = '9999';
        notification.innerHTML = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global instance
window.leadKanban = new LeadKanban();
console.log('🎯 Lead Kanban component loaded and registered as window.leadKanban');