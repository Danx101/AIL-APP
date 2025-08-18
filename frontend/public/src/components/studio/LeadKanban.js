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
        this.draggedFromStatus = null;
        this.showArchived = true; // Always show archive
        this.currentView = 'kanban'; // 'kanban' or 'verlauf'
        this.searchQuery = '';
        this.selectedLead = null;
        this.selectedArchivedLeads = new Set();
        this.archiveSearchQuery = '';
        this.archiveStatusFilter = 'all';
        this.historyData = [];
        this.historyPagination = {};
        this.historyFilters = {};
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
                            Lead Management
                        </h2>
                        <p class="text-muted mb-0">Leads durch Phasen ziehen und ablegen</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap" style="min-width: 250px;">
                        <!-- View Toggle -->
                        <div class="btn-group" role="group">
                            <button class="btn ${this.currentView === 'kanban' ? 'btn-primary' : 'btn-outline-primary'}" onclick="leadKanban.switchView('kanban')">
                                <i class="bi bi-kanban me-1"></i>
                                Kanban
                            </button>
                            <button class="btn ${this.currentView === 'verlauf' ? 'btn-primary' : 'btn-outline-primary'}" onclick="leadKanban.switchView('verlauf')">
                                <i class="bi bi-clock-history me-1"></i>
                                Verlauf
                            </button>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-plus-circle me-1"></i>
                                Add New
                            </button>
                            <ul class="dropdown-menu">
                                <li>
                                    <a class="dropdown-item" href="#" onclick="leadKanban.showAddLeadModal(); return false;">
                                        <i class="bi bi-person-plus me-2"></i>
                                        Neuer Lead
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="leadKanban.showWalkInTrialModal(); return false;">
                                        <i class="bi bi-door-open me-2"></i>
                                        Walk-in Probebehandlung
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
                                        <div class="text-muted small">Aktive Leads</div>
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
                                        <div class="text-muted small">Konvertiert</div>
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
                                        <div class="text-muted small">Konversionsrate</div>
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
                                        <div class="text-muted small">Durchschn. Konversionszeit</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- Main Content Area -->
                ${this.currentView === 'kanban' ? `
                    <!-- Kanban Board -->
                    <div class="kanban-board">
                        <div class="row g-3">
                            ${this.renderKanbanColumns()}
                        </div>
                    </div>

                    <!-- Archive Panel (Always Visible) -->
                    <div class="archive-panel show mt-4" id="archive-panel">
                        ${this.renderArchivePanel()}
                    </div>
                ` : `
                    <!-- History View -->
                    <div class="history-view mt-3">
                        ${this.renderHistoryView()}
                    </div>
                `}
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
                    background: #e3f2fd;
                    border: 2px dashed #2196f3;
                    transition: all 0.2s ease;
                }
                .kanban-cards.drag-over::after {
                    content: "Hier ablegen";
                    display: block;
                    text-align: center;
                    padding: 20px;
                    background: #f8f9fa;
                    border: 2px dashed #dee2e6;
                    border-radius: 6px;
                    color: #6c757d;
                    font-weight: 500;
                    margin-top: 10px;
                }
                .archive-panel {
                    margin-top: 30px;
                    display: none;
                }
                .archive-panel.show {
                    display: block;
                }
                
                /* Modern Archive Styling */
                .archive-container {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
                    border: 1px solid #dee2e6;
                    overflow: hidden;
                }
                
                .archive-header {
                    background: rgba(255, 255, 255, 0.8);
                    padding: 20px 24px;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .archive-title {
                    color: #495057;
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                
                .archive-count {
                    background: #6c757d;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    margin-left: 8px;
                }
                
                .archive-content {
                    background: white;
                    padding: 0;
                }
                
                .archive-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }
                
                .archive-empty i {
                    font-size: 3rem;
                    color: #adb5bd;
                    margin-bottom: 16px;
                    display: block;
                }
                
                .archive-empty p {
                    margin: 0;
                    font-size: 1rem;
                }
                
                .archive-table-container {
                    border-radius: 0 0 12px 12px;
                    overflow: hidden;
                }
                
                .archive-table-container .table thead th {
                    background: #f1f3f4;
                    border-bottom: 2px solid #dee2e6;
                    color: #495057;
                    font-weight: 600;
                    font-size: 0.875rem;
                    padding: 12px 16px;
                }
                
                .archive-table-container .table tbody td {
                    padding: 12px 16px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f3f4;
                }
                
                .archive-table-container .table tbody tr:hover {
                    background-color: #f8f9fa;
                }
                .lead-badge {
                    font-size: 11px;
                    padding: 2px 6px;
                }
                
                /* Auto-save status styling */
                .save-status {
                    min-height: 1.2rem;
                    transition: opacity 0.3s ease;
                }
                
                .save-status small {
                    font-size: 0.75rem;
                    display: inline-flex;
                    align-items: center;
                }
                
                .save-status .text-muted {
                    opacity: 0.8;
                }
                
                .save-status .text-success {
                    opacity: 1;
                }
                
                .save-status .text-danger {
                    opacity: 1;
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
            { key: 'new', title: 'Neu', color: 'primary', icon: 'star' },
            { key: 'working', title: 'In Bearbeitung', color: 'warning', icon: 'telephone' },
            { key: 'qualified', title: 'Qualifiziert', color: 'success', icon: 'check2-circle' },
            { key: 'trial_scheduled', title: 'Probebehandlung geplant', color: 'purple', icon: 'calendar-check' }
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
            return '<div class="text-center text-muted py-4">Keine Leads</div>';
        }

        // Sort leads so that oldest (by stage_entered_at) appear first, newest at bottom
        const sortedLeads = [...leads].sort((a, b) => {
            const dateA = new Date(a.stage_entered_at || 0);
            const dateB = new Date(b.stage_entered_at || 0);
            return dateA - dateB; // Ascending order (oldest first)
        });

        return sortedLeads.map(lead => `
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
                <div class="d-flex justify-content-end align-items-center mt-2">
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
            <div class="archive-container">
                <div class="archive-header">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0 archive-title">
                            <i class="bi bi-archive me-2"></i>
                            Archiv
                            <span class="archive-count">${allArchived.length}</span>
                        </h5>
                        <div class="d-flex gap-2">
                            ${hasSelection ? `
                                <button class="btn btn-primary btn-sm" onclick="leadKanban.reactivateSelectedLeads()">
                                    <i class="bi bi-arrow-counterclockwise me-1"></i>
                                    Reaktivieren (${this.selectedArchivedLeads.size})
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="leadKanban.deleteSelectedLeads()">
                                    <i class="bi bi-trash me-1"></i>
                                    Löschen (${this.selectedArchivedLeads.size})
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
                                       placeholder="Nach Name, Telefon oder E-Mail suchen..."
                                       value="${this.archiveSearchQuery}"
                                       onkeyup="leadKanban.filterArchive(this.value, null)">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select form-select-sm" 
                                    onchange="leadKanban.filterArchive(null, this.value)">
                                <option value="all">Alle Status</option>
                                <option value="converted" ${this.archiveStatusFilter === 'converted' ? 'selected' : ''}>Konvertiert</option>
                                <option value="lost" ${this.archiveStatusFilter === 'lost' ? 'selected' : ''}>Nach Probebehandlung verloren</option>
                                <option value="not_interested" ${this.archiveStatusFilter === 'not_interested' ? 'selected' : ''}>Nicht interessiert</option>
                                <option value="unreachable" ${this.archiveStatusFilter === 'unreachable' ? 'selected' : ''}>Nicht erreichbar</option>
                                <option value="wrong_number" ${this.archiveStatusFilter === 'wrong_number' ? 'selected' : ''}>Falsche Nummer</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            ${hasSelection ? `
                                <button class="btn btn-outline-secondary btn-sm w-100" onclick="leadKanban.clearSelection()">
                                    Auswahl aufheben
                                </button>
                            ` : `
                                <button class="btn btn-outline-primary btn-sm w-100" onclick="leadKanban.selectAllVisible()">
                                    Alle auswählen
                                </button>
                            `}
                        </div>
                    </div>
                </div>
                <div class="archive-content">
                    ${allArchived.length === 0 ? `
                        <div class="archive-empty">
                            <i class="bi bi-inbox"></i>
                            <p>Keine archivierten Leads ${this.archiveStatusFilter !== 'all' || this.archiveSearchQuery ? 'gefunden' : ''}</p>
                        </div>
                    ` : `
                        <div class="archive-table-container">
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th width="40">
                                            <input type="checkbox" 
                                                   class="form-check-input" 
                                                   onchange="leadKanban.toggleAllSelection(this.checked)"
                                                   ${this.selectedArchivedLeads.size === allArchived.length && allArchived.length > 0 ? 'checked' : ''}>
                                        </th>
                                        <th>Name</th>
                                        <th>Kontaktinformationen</th>
                                        <th>Status</th>
                                        <th>Archivierungsdatum</th>
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
        // Store the current status of the dragged lead
        this.draggedFromStatus = this.findLeadStatus(leadId);
        event.dataTransfer.effectAllowed = 'move';
        event.target.classList.add('dragging');
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const column = event.currentTarget.closest('.kanban-column');
        const cardsContainer = event.currentTarget;
        
        if (column) {
            column.classList.add('drag-over');
        }
        if (cardsContainer) {
            cardsContainer.classList.add('drag-over');
        }
    }

    handleDragLeave(event) {
        const column = event.currentTarget.closest('.kanban-column');
        const cardsContainer = event.currentTarget;
        
        if (column) {
            column.classList.remove('drag-over');
        }
        if (cardsContainer) {
            cardsContainer.classList.remove('drag-over');
        }
    }

    // View switching methods
    switchView(view) {
        this.currentView = view;
        if (view === 'verlauf') {
            this.loadHistoryData();
        }
        this.render();
        this.setupEventListeners();
    }

    async loadHistoryData(filters = {}) {
        try {
            const token = localStorage.getItem('authToken');
            
            // Build query parameters
            const params = new URLSearchParams({
                page: filters.page || 1,
                limit: filters.limit || 50,
                ...filters
            });
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/studio/${this.studioId}/history?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.historyData = data.history || [];
                this.historyPagination = data.pagination || {};
                this.historyFilters = data.filters || {};
            } else {
                console.warn('Failed to load history data');
                this.historyData = [];
                this.historyPagination = {};
            }
        } catch (error) {
            console.error('Error loading history data:', error);
            this.historyData = [];
            this.historyPagination = {};
        }
    }

    renderHistoryView() {
        return `
            <div class="row">
                <div class="col-12">
                    <!-- Filters Panel -->
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <label class="form-label small text-muted">Suchen</label>
                                    <input type="text" class="form-control" id="history-search" 
                                           placeholder="Lead oder Beschreibung..." 
                                           value="${this.historyFilters.search || ''}"
                                           onchange="leadKanban.filterHistory()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted">Aktivität</label>
                                    <select class="form-select" id="history-activity-filter" onchange="leadKanban.filterHistory()">
                                        <option value="">Alle Aktivitäten</option>
                                        <option value="status_change" ${this.historyFilters.activity_type === 'status_change' ? 'selected' : ''}>Status geändert</option>
                                        <option value="note" ${this.historyFilters.activity_type === 'note' ? 'selected' : ''}>Notiz</option>
                                        <option value="call" ${this.historyFilters.activity_type === 'call' ? 'selected' : ''}>Anruf</option>
                                        <option value="conversion" ${this.historyFilters.activity_type === 'conversion' ? 'selected' : ''}>Konvertierung</option>
                                        <option value="archive" ${this.historyFilters.activity_type === 'archive' ? 'selected' : ''}>Archiviert</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted">Von Datum</label>
                                    <input type="date" class="form-control" id="history-date-from" 
                                           value="${this.historyFilters.date_from || ''}"
                                           onchange="leadKanban.filterHistory()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted">Bis Datum</label>
                                    <input type="date" class="form-control" id="history-date-to" 
                                           value="${this.historyFilters.date_to || ''}"
                                           onchange="leadKanban.filterHistory()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted">Einträge pro Seite</label>
                                    <select class="form-select" id="history-limit" onchange="leadKanban.filterHistory()">
                                        <option value="25" ${(this.historyPagination.limit || 50) == 25 ? 'selected' : ''}>25</option>
                                        <option value="50" ${(this.historyPagination.limit || 50) == 50 ? 'selected' : ''}>50</option>
                                        <option value="100" ${(this.historyPagination.limit || 50) == 100 ? 'selected' : ''}>100</option>
                                    </select>
                                </div>
                                <div class="col-md-1">
                                    <label class="form-label small text-muted">&nbsp;</label>
                                    <button class="btn btn-outline-secondary w-100" onclick="leadKanban.clearHistoryFilters()">
                                        <i class="bi bi-x-circle"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- History Data -->
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-0">
                                    <i class="bi bi-clock-history me-2"></i>
                                    Lead-Verlauf (Letzte 12 Monate)
                                    <span class="badge bg-primary ms-2">${this.historyPagination.total || this.historyData.length}</span>
                                </h5>
                                <small class="text-muted">Zeigt Aktivitäten der letzten 12 Monate</small>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-primary btn-sm" onclick="leadKanban.exportHistory()" title="Export als CSV">
                                    <i class="bi bi-download me-1"></i>
                                    Export
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" onclick="leadKanban.refreshHistory()" title="Aktualisieren">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body p-0">
                            ${this.historyData.length === 0 ? this.renderEmptyHistoryState() : this.renderHistoryTable()}
                        </div>
                        ${this.renderHistoryPagination()}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderEmptyHistoryState() {
        return `
            <div class="text-center py-5">
                <i class="bi bi-clock-history display-1 text-muted mb-3"></i>
                <h5>Keine Verlaufsdaten verfügbar</h5>
                <p class="text-muted">Hier werden Lead-Aktivitäten der letzten 12 Monate angezeigt, sobald Daten verfügbar sind.</p>
                <small class="text-muted">Ältere Aktivitäten werden automatisch ausgeblendet, um die Performance zu optimieren.</small>
            </div>
        `;
    }
    
    renderHistoryTable() {
        return `
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th style="width: 140px;">Datum/Zeit</th>
                            <th style="width: 200px;">Lead</th>
                            <th style="width: 150px;">Aktivität</th>
                            <th style="width: 120px;">Von</th>
                            <th style="width: 120px;">Nach</th>
                            <th style="width: 120px;">Benutzer</th>
                            <th>Beschreibung</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.historyData.map(item => this.renderHistoryRow(item)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderHistoryPagination() {
        if (!this.historyPagination || this.historyPagination.totalPages <= 1) {
            return '';
        }
        
        const currentPage = this.historyPagination.page || 1;
        const totalPages = this.historyPagination.totalPages || 1;
        const total = this.historyPagination.total || 0;
        
        let paginationHtml = `
            <div class="card-footer d-flex justify-content-between align-items-center">
                <small class="text-muted">
                    Zeige ${((currentPage - 1) * this.historyPagination.limit) + 1} - ${Math.min(currentPage * this.historyPagination.limit, total)} von ${total} Einträgen
                </small>
                <nav>
                    <ul class="pagination pagination-sm mb-0">
        `;
        
        // Previous button
        paginationHtml += `
            <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="leadKanban.goToHistoryPage(${currentPage - 1}); return false;">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="leadKanban.goToHistoryPage(1); return false;">1</a></li>`;
            if (startPage > 2) {
                paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="leadKanban.goToHistoryPage(${i}); return false;">${i}</a>
                </li>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="leadKanban.goToHistoryPage(${totalPages}); return false;">${totalPages}</a></li>`;
        }
        
        // Next button
        paginationHtml += `
            <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="leadKanban.goToHistoryPage(${currentPage + 1}); return false;">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;
        
        paginationHtml += `
                    </ul>
                </nav>
            </div>
        `;
        
        return paginationHtml;
    }

    renderHistoryRow(item) {
        const date = new Date(item.created_at);
        const dateStr = date.toLocaleDateString('de-DE');
        const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        const statusTranslations = {
            'new': 'Neu',
            'working': 'In Bearbeitung', 
            'qualified': 'Qualifiziert',
            'trial_scheduled': 'Probebehandlung geplant',
            'converted': 'Konvertiert',
            'not_interested': 'Nicht interessiert',
            'unreachable': 'Nicht erreichbar',
            'wrong_number': 'Falsche Nummer',
            'lost': 'Nach Probebehandlung verloren'
        };

        const actionTranslations = {
            'status_change': 'Status geändert',
            'note': 'Notiz hinzugefügt',
            'call': 'Anruf',
            'email': 'E-Mail',
            'sms': 'SMS',
            'appointment_scheduled': 'Termin geplant',
            'appointment_completed': 'Termin abgeschlossen',
            'conversion': 'Konvertiert',
            'archive': 'Archiviert'
        };
        
        const activityIcons = {
            'status_change': 'bi-arrow-right-circle',
            'note': 'bi-chat-text',
            'call': 'bi-telephone',
            'email': 'bi-envelope',
            'sms': 'bi-chat-dots',
            'appointment_scheduled': 'bi-calendar-plus',
            'appointment_completed': 'bi-calendar-check',
            'conversion': 'bi-star-fill',
            'archive': 'bi-archive'
        };
        
        const activityColors = {
            'status_change': 'bg-info',
            'note': 'bg-secondary',
            'call': 'bg-success',
            'email': 'bg-primary',
            'sms': 'bg-warning',
            'appointment_scheduled': 'bg-info',
            'appointment_completed': 'bg-success',
            'conversion': 'bg-success',
            'archive': 'bg-dark'
        };

        const userName = item.first_name && item.last_name 
            ? `${item.first_name} ${item.last_name}` 
            : (item.user_name || 'System');

        return `
            <tr class="history-row" style="cursor: pointer;" onclick="leadKanban.showHistoryDetails(${item.id})">
                <td>
                    <div class="fw-medium">${dateStr}</div>
                    <small class="text-muted">${timeStr}</small>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div>
                            <div class="fw-medium">${item.lead_name || 'Unbekannt'}</div>
                            ${item.lead_phone ? `<small class="text-muted">${item.lead_phone}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${activityColors[item.activity_type] || 'bg-secondary'} d-inline-flex align-items-center">
                        <i class="bi ${activityIcons[item.activity_type] || 'bi-circle'} me-1"></i>
                        ${actionTranslations[item.activity_type] || item.activity_type}
                    </span>
                </td>
                <td>
                    ${item.from_status ? `
                        <span class="badge bg-light text-dark border">
                            ${statusTranslations[item.from_status] || item.from_status}
                        </span>
                    ` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    ${item.to_status ? `
                        <span class="badge bg-primary">
                            ${statusTranslations[item.to_status] || item.to_status}
                        </span>
                    ` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" 
                             style="width: 24px; height: 24px; font-size: 0.7rem;">
                            ${userName.charAt(0).toUpperCase()}
                        </div>
                        <small>${userName}</small>
                    </div>
                </td>
                <td>
                    <div class="text-truncate" style="max-width: 200px;" title="${item.description || ''}">
                        ${item.description || '-'}
                    </div>
                    ${item.metadata ? `<small class="text-muted d-block">Details verfügbar</small>` : ''}
                </td>
            </tr>
        `;
    }

    async handleDrop(event, toStatus) {
        event.preventDefault();
        
        const column = event.currentTarget.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
        }

        if (!this.draggedLead) return;

        // Prevent same-column drops
        if (this.draggedFromStatus === toStatus) {
            this.showNotification('Lead ist bereits in dieser Spalte', 'warning');
            this.resetDragState();
            return;
        }

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
        
        this.resetDragState();
    }

    resetDragState() {
        // Reset dragging state
        document.querySelectorAll('.lead-card.dragging').forEach(card => {
            card.classList.remove('dragging');
        });
        document.querySelectorAll('.kanban-column.drag-over').forEach(column => {
            column.classList.remove('drag-over');
        });
        document.querySelectorAll('.kanban-cards.drag-over').forEach(container => {
            container.classList.remove('drag-over');
        });
        this.draggedLead = null;
        this.draggedFromStatus = null;
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
            this.showNotification('Lead erfolgreich verschoben', 'success');
            
            // Reset dragging state
            this.draggedLead = null;
            document.querySelectorAll('.lead-card.dragging').forEach(card => {
                card.classList.remove('dragging');
            });
        } catch (error) {
            console.error('Error moving lead:', error);
            this.showNotification(error.message, 'error');
            
            // Reset dragging state even on error
            this.resetDragState();
            
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
            this.showNotification('Bitte alle erforderlichen Felder ausfüllen', 'error');
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
            this.showNotification('Kein Lead ausgewählt', 'error');
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
        
        // Close the lead details modal first to prevent z-index issues
        const leadDetailsModal = bootstrap.Modal.getInstance(document.getElementById('leadDetailsModal'));
        if (leadDetailsModal) {
            leadDetailsModal.hide();
        }
        
        // Wait a moment for the modal to close, then show convert modal
        setTimeout(() => {
            document.getElementById('convert-lead-name').textContent = lead.name || 'Unknown';
            const modal = new bootstrap.Modal(document.getElementById('convertModal'));
            modal.show();
        }, 300);
    }

    async confirmConversion() {
        const sessionPackage = document.querySelector('input[name="sessionPackage"]:checked')?.value;
        const paymentMethod = document.getElementById('payment-method').value;
        const notes = document.getElementById('conversion-notes').value;

        console.log('Conversion data:', { sessionPackage, paymentMethod, notes, leadId: this.selectedLead?.id });

        if (!sessionPackage || !paymentMethod) {
            this.showNotification('Bitte Behandlungspaket und Zahlungsmethode auswählen', 'error');
            return;
        }

        if (!this.selectedLead || !this.selectedLead.id) {
            this.showNotification('Kein Lead ausgewählt', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const requestBody = {
                sessionPackage: parseInt(sessionPackage, 10),
                paymentMethod: paymentMethod,
                notes: notes || null
            };

            console.log('Sending conversion request:', requestBody);

            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${this.selectedLead.id}/convert`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                
                let errorMessage = 'Fehler beim Konvertieren des Leads';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    console.error('Could not parse error response:', e);
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Conversion successful:', result);

            // Show success message
            this.showNotification(
                `Lead erfolgreich zu Kunde konvertiert!`,
                'success'
            );

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('convertModal'));
            if (modal) {
                modal.hide();
            }
            
            // Reset form
            document.getElementById('convert-form').reset();
            
            // Reload kanban
            await this.loadKanbanData();
        } catch (error) {
            console.error('Error converting lead:', error);
            this.showNotification(error.message || 'Unbekannter Fehler beim Konvertieren', 'error');
        }
    }

    async reactivateLead(leadId) {
        if (!confirm('Diesen Lead reaktivieren und zu "In Bearbeitung" verschieben?')) return;

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
            
            this.showNotification('Lead erfolgreich reaktiviert', 'success');
        } catch (error) {
            console.error('Error reactivating lead:', error);
            this.showNotification(error.message || 'Lead konnte nicht reaktiviert werden', 'error');
            // Reload to ensure UI is in sync
            await this.loadKanbanData();
        }
    }

    async archiveLead(leadId, archiveStatus) {
        const statusMessages = {
            'not_interested': 'Als "Nicht interessiert" markieren?',
            'unreachable': 'Als "Nicht erreichbar" markieren?',
            'wrong_number': 'Als "Falsche Nummer" markieren?',
            'lost': 'Als "Nach Probebehandlung verloren" markieren?'
        };

        if (!confirm(statusMessages[archiveStatus] || 'Diesen Lead archivieren?')) return;

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
            
            this.showNotification('Lead erfolgreich archiviert', 'success');
        } catch (error) {
            console.error('Error archiving lead:', error);
            this.showNotification(error.message || 'Lead konnte nicht archiviert werden', 'error');
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
            this.showNotification('Name und Telefon sind erforderlich', 'error');
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
            this.showNotification('Lead erfolgreich hinzugefügt', 'success');
        } catch (error) {
            console.error('Error adding lead:', error);
            this.showNotification('Lead konnte nicht hinzugefügt werden', 'error');
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
                            <h5 class="modal-title">Lead-Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <!-- Lead Details -->
                                    <div>
                                        <h4>${lead.name}</h4>
                                        <div class="mb-3">
                                            <label class="text-muted">Telefon:</label>
                                            <div>${lead.phone_number ? `<a href="tel:${lead.phone_number}">${this.formatPhone(lead.phone_number)}</a>` : 'N/A'}</div>
                                        </div>
                                        <div class="mb-3">
                                            <label class="text-muted">E-Mail:</label>
                                            <div>${lead.email ? `<a href="mailto:${lead.email}">${lead.email}</a>` : 'N/A'}</div>
                                        </div>
                                        <div class="mb-3">
                                            <label class="text-muted">Aktueller Status:</label>
                                            <div><span class="badge bg-primary">${this.getGermanStatus(lead.status)}</span></div>
                                        </div>
                                        <div class="mb-3">
                                            <label class="text-muted">Notizen:</label>
                                            <div class="position-relative">
                                                <textarea class="form-control" 
                                                         id="lead-notes-${leadId}" 
                                                         rows="3" 
                                                         placeholder="Notizen hier eingeben..."
                                                         onblur="leadKanban.autoSaveNotes(${leadId})"
                                                         data-original-value="">${lead.notes || ''}</textarea>
                                                <div id="save-status-${leadId}" class="save-status mt-1"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    ${lead.status === 'qualified' || lead.status === 'trial_scheduled' ? `
                                        <h6 class="mb-3">Schnellaktionen</h6>
                                        <button class="btn btn-success w-100 mb-2" onclick="leadKanban.showConvertModal(${leadId})">
                                            <i class="bi bi-check-circle me-2"></i>
                                            Zu Kunde konvertieren
                                        </button>
                                        <hr class="my-3">
                                    ` : ''}
                                    
                                    <h6 class="mb-3">Lead archivieren</h6>
                                    ${lead.status !== 'trial_scheduled' ? `
                                        <button class="btn btn-outline-warning w-100 mb-2" onclick="leadKanban.archiveLead(${leadId}, 'not_interested')">
                                            <i class="bi bi-x-circle me-2"></i>
                                            Nicht interessiert
                                        </button>
                                        <button class="btn btn-outline-danger w-100 mb-2" onclick="leadKanban.archiveLead(${leadId}, 'wrong_number')">
                                            <i class="bi bi-exclamation-triangle me-2"></i>
                                            Falsche Nummer
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-outline-secondary w-100 mb-2" onclick="leadKanban.archiveLead(${leadId}, 'unreachable')">
                                        <i class="bi bi-telephone-x me-2"></i>
                                        Nicht erreichbar
                                    </button>
                                    ${lead.status === 'trial_scheduled' ? `
                                        <button class="btn btn-outline-danger w-100" onclick="leadKanban.archiveLead(${leadId}, 'lost')">
                                            <i class="bi bi-person-x me-2"></i>
                                            Nach Probebehandlung verloren
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
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

    // Archive is now always visible, no toggle needed

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

    findLeadStatus(leadId) {
        // Find which status column contains this lead
        for (const status in this.leads) {
            const lead = this.leads[status].find(l => l.id === leadId);
            if (lead) return status;
        }
        return null;
    }


    formatPhone(phone) {
        // Simple phone formatting
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }

    getTimeInStage(enteredAt) {
        if (!enteredAt) return 'Gerade hinzugefügt';
        
        const now = new Date();
        const entered = new Date(enteredAt);
        const days = Math.floor((now - entered) / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Heute';
        if (days === 1) return '1 Tag';
        return `${days} Tage`;
    }

    getGermanStatus(status) {
        const statusTranslations = {
            'new': 'Neu',
            'working': 'In Bearbeitung',
            'qualified': 'Qualifiziert', 
            'trial_scheduled': 'Probebehandlung geplant',
            'converted': 'Konvertiert',
            'not_interested': 'Nicht interessiert',
            'unreachable': 'Nicht erreichbar',
            'wrong_number': 'Falsche Nummer',
            'lost': 'Nach Probebehandlung verloren'
        };
        return statusTranslations[status] || status.replace('_', ' ').toUpperCase();
    }

    async autoSaveNotes(leadId) {
        const notesTextarea = document.getElementById(`lead-notes-${leadId}`);
        const statusDiv = document.getElementById(`save-status-${leadId}`);
        
        if (!notesTextarea) {
            return;
        }

        const notes = notesTextarea.value;
        
        // Show saving status
        if (statusDiv) {
            statusDiv.innerHTML = '<small class="text-muted"><i class="bi bi-cloud-upload me-1"></i>Speichert...</small>';
        }

        try {
            const token = localStorage.getItem('authToken');
            
            // Use the existing leadKanban addLeadNote endpoint
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    note: notes || ''
                })
            });

            if (!response.ok) {
                throw new Error('Fehler beim Speichern');
            }

            // Update the lead object in memory
            const lead = this.findLeadById(leadId);
            if (lead) {
                lead.notes = notes;
            }

            // Show success status
            if (statusDiv) {
                statusDiv.innerHTML = '<small class="text-success"><i class="bi bi-check-circle me-1"></i>Gespeichert</small>';
                setTimeout(() => {
                    if (statusDiv) {
                        statusDiv.innerHTML = '';
                    }
                }, 2000);
            }

        } catch (error) {
            console.error('Error auto-saving notes:', error);
            
            // Show error status
            if (statusDiv) {
                statusDiv.innerHTML = '<small class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Fehler</small>';
            }
        }
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
            this.showNotification('Bitte alle erforderlichen Felder ausfüllen', 'error');
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
            this.showNotification('Walk-in Probebehandlung erfolgreich geplant!', 'success');
        } catch (error) {
            console.error('Error creating walk-in trial:', error);
            this.showNotification('Walk-in Probebehandlung konnte nicht erstellt werden', 'error');
        }
    }

    confirmDeleteLead(leadId) {
        if (confirm('Sind Sie sicher, dass Sie diesen Lead dauerhaft aus dem Archiv löschen möchten?')) {
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
            this.showNotification('Lead erfolgreich gelöscht', 'success');
        } catch (error) {
            console.error('Error deleting lead:', error);
            this.showNotification('Lead konnte nicht gelöscht werden', 'error');
        }
    }

    async reactivateSelectedLeads() {
        const count = this.selectedArchivedLeads.size;
        if (count === 0) return;
        
        // Note: Including converted leads for reactivation
        if (!confirm(`Sind Sie sicher, dass Sie ${count} ausgewählte Lead(s) reaktivieren möchten? Diese werden zurück zu 'In Bearbeitung' verschoben.`)) {
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
                this.showNotification(`${count} Lead(s) erfolgreich reaktiviert`, 'success');
            } else {
                this.showNotification(`Einige Leads konnten nicht reaktiviert werden. Bitte prüfen Sie die Ergebnisse.`, 'warning');
            }
        } catch (error) {
            console.error('Error reactivating selected leads:', error);
            this.showNotification('Ausgewählte Leads konnten nicht reaktiviert werden', 'error');
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
        
        if (!confirm(`Sind Sie sicher, dass Sie ${count} ausgewählte Lead(s) dauerhaft löschen möchten?`)) {
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
            this.showNotification(`${count} Lead(s) erfolgreich gelöscht`, 'success');
        } catch (error) {
            console.error('Error deleting selected leads:', error);
            this.showNotification('Ausgewählte Leads konnten nicht gelöscht werden', 'error');
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

    // History view methods
    async filterHistory() {
        const search = document.getElementById('history-search')?.value || '';
        const activity_type = document.getElementById('history-activity-filter')?.value || '';
        const date_from = document.getElementById('history-date-from')?.value || '';
        const date_to = document.getElementById('history-date-to')?.value || '';
        const limit = document.getElementById('history-limit')?.value || 50;
        
        const filters = {
            search,
            activity_type,
            date_from,
            date_to,
            limit,
            page: 1 // Reset to first page when filtering
        };
        
        await this.loadHistoryData(filters);
        this.render();
        this.setupEventListeners();
    }
    
    clearHistoryFilters() {
        document.getElementById('history-search').value = '';
        document.getElementById('history-activity-filter').value = '';
        document.getElementById('history-date-from').value = '';
        document.getElementById('history-date-to').value = '';
        document.getElementById('history-limit').value = '50';
        
        this.filterHistory();
    }
    
    async goToHistoryPage(page) {
        if (page < 1 || (this.historyPagination.totalPages && page > this.historyPagination.totalPages)) {
            return;
        }
        
        const currentFilters = {
            search: this.historyFilters.search || '',
            activity_type: this.historyFilters.activity_type || '',
            date_from: this.historyFilters.date_from || '',
            date_to: this.historyFilters.date_to || '',
            limit: this.historyPagination.limit || 50,
            page: page
        };
        
        await this.loadHistoryData(currentFilters);
        this.render();
        this.setupEventListeners();
    }
    
    async refreshHistory() {
        const currentFilters = {
            search: this.historyFilters.search || '',
            activity_type: this.historyFilters.activity_type || '',
            date_from: this.historyFilters.date_from || '',
            date_to: this.historyFilters.date_to || '',
            limit: this.historyPagination.limit || 50,
            page: this.historyPagination.page || 1
        };
        
        await this.loadHistoryData(currentFilters);
        this.render();
        this.setupEventListeners();
        this.showNotification('Verlauf aktualisiert', 'success');
    }
    
    showHistoryDetails(activityId) {
        const activity = this.historyData.find(item => item.id === activityId);
        if (!activity) return;
        
        const modalHtml = `
            <div class="modal fade" id="historyDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-clock-history me-2"></i>
                                Aktivitäts-Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-muted">Lead Information</h6>
                                    <p><strong>${activity.lead_name || 'Unbekannt'}</strong></p>
                                    ${activity.lead_phone ? `<p class="text-muted mb-1">${activity.lead_phone}</p>` : ''}
                                    ${activity.lead_email ? `<p class="text-muted mb-3">${activity.lead_email}</p>` : ''}
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-muted">Aktivität</h6>
                                    <p class="mb-1">${activity.activity_type}</p>
                                    <p class="text-muted">${new Date(activity.created_at).toLocaleString('de-DE')}</p>
                                </div>
                            </div>
                            
                            ${activity.description ? `
                                <div class="mt-3">
                                    <h6 class="text-muted">Beschreibung</h6>
                                    <p>${activity.description}</p>
                                </div>
                            ` : ''}
                            
                            ${activity.from_status || activity.to_status ? `
                                <div class="mt-3">
                                    <h6 class="text-muted">Status-Änderung</h6>
                                    <p>
                                        ${activity.from_status ? `Von: <span class="badge bg-light text-dark">${activity.from_status}</span>` : ''}
                                        ${activity.from_status && activity.to_status ? ' → ' : ''}
                                        ${activity.to_status ? `Nach: <span class="badge bg-primary">${activity.to_status}</span>` : ''}
                                    </p>
                                </div>
                            ` : ''}
                            
                            ${activity.metadata ? `
                                <div class="mt-3">
                                    <h6 class="text-muted">Zusätzliche Informationen</h6>
                                    <pre class="bg-light p-2 rounded"><code>${JSON.stringify(JSON.parse(activity.metadata), null, 2)}</code></pre>
                                </div>
                            ` : ''}
                            
                            <div class="mt-3">
                                <h6 class="text-muted">Durchgeführt von</h6>
                                <p>${activity.first_name && activity.last_name ? `${activity.first_name} ${activity.last_name}` : 'System'}</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                            ${activity.lead_id ? `
                                <button type="button" class="btn btn-primary" onclick="leadKanban.showLeadDetails(${activity.lead_id}); bootstrap.Modal.getInstance(document.getElementById('historyDetailsModal')).hide();">
                                    Lead anzeigen
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('historyDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('historyDetailsModal'));
        modal.show();
    }
    
    exportHistory() {
        if (this.historyData.length === 0) {
            this.showNotification('Keine Daten zum Exportieren verfügbar', 'warning');
            return;
        }
        
        // Prepare CSV data
        const headers = ['Datum', 'Zeit', 'Lead', 'Telefon', 'Aktivität', 'Von Status', 'Nach Status', 'Benutzer', 'Beschreibung'];
        const csvData = [headers];
        
        this.historyData.forEach(item => {
            const date = new Date(item.created_at);
            const row = [
                date.toLocaleDateString('de-DE'),
                date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                item.lead_name || 'Unbekannt',
                item.lead_phone || '',
                item.activity_type || '',
                item.from_status || '',
                item.to_status || '',
                item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : 'System',
                item.description || ''
            ];
            csvData.push(row);
        });
        
        // Convert to CSV string
        const csvContent = csvData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `lead-verlauf-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Verlauf erfolgreich exportiert', 'success');
    }
}

// Global instance
window.leadKanban = new LeadKanban();
console.log('🎯 Lead Kanban component loaded and registered as window.leadKanban');