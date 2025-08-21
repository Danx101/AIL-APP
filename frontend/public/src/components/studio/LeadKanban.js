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
        this.showArchived = false; // Default hide archive
        this.searchQuery = '';
        this.selectedLead = null;
        this.selectedArchivedLeads = new Set();
        this.archiveSearchQuery = '';
        this.archiveStatusFilter = 'all';
        this.searchDebounceTimer = null;
    }

    async init(studioId) {
        this.studioId = studioId;
        
        // Verify authorization
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'studio_owner') {
            return;
        }

        this.render();
        await this.loadKanbanData();
        this.setupDragAndDrop();
        this.setupEventListeners();
    }

    render() {
        const container = document.getElementById('lead-kanban-content') || document.getElementById('app');
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
                        <button class="btn ${this.showArchived ? 'btn-secondary' : 'btn-outline-dark'}" onclick="leadKanban.toggleArchived()" id="toggle-archive-btn" style="white-space: nowrap; border-width: 2px;">
                            <i class="bi bi-archive me-1"></i>
                            ${this.showArchived ? 'Archiv schließen' : 'Archiv anzeigen'}
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bi bi-plus-circle me-1"></i>
                                Erstellen
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
                                        <i class="bi bi-people icon-very-light"></i>
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
                                        <div class="text-muted small">Konvertiert (30 Tage)</div>
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
                                            ${this.metrics.conversion_rate || 0}%
                                        </div>
                                        <div class="text-muted small">
                                            Konversionsrate (30 Tage)
                                        </div>
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
                                        <div class="text-muted small">
                                            Durchschn. Konversionszeit (30 Tage)
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- Main Content Area -->
                <!-- Kanban Board -->
                    <div class="kanban-board">
                        <div class="row g-3">
                            ${this.renderKanbanColumns()}
                        </div>
                    </div>

                    <!-- Archive Panel -->
                    <div class="archive-panel ${this.showArchived ? 'show' : ''} mt-4" id="archive-panel" style="${this.showArchived ? 'display: block;' : 'display: none;'}">
                        ${this.showArchived ? this.renderArchivePanel() : ''}
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
                .icon-very-light {
                    color: #E8DDF0 !important;
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
                
                /* Mac-style selection for archived leads */
                .archive-table-container .table tbody tr.archive-lead-row {
                    transition: background-color 0.15s ease !important;
                    user-select: none;
                    cursor: pointer !important;
                }
                
                .archive-table-container .table tbody tr.archive-lead-row.selected {
                    background-color: #cce5ff !important;
                    border-left: 4px solid #007bff !important;
                }
                
                .archive-table-container .table tbody tr.archive-lead-row:hover {
                    background-color: #f8f9fa !important;
                }
                
                .archive-table-container .table tbody tr.archive-lead-row.selected:hover {
                    background-color: #b8daff !important;
                }
                
                /* Purple status badge */
                .bg-purple {
                    background-color: #6f42c1 !important;
                }
                
                /* Modal improvements */
                #leadDetailsModal .modal-body {
                    padding: 2rem;
                }
                
                #leadDetailsModal .section-title {
                    color: #495057;
                    font-weight: 600;
                    border-bottom: 2px solid #e9ecef;
                    padding-bottom: 8px;
                }
                
                #leadDetailsModal .form-label {
                    font-weight: 600;
                    color: #6c757d;
                    margin-bottom: 4px;
                    font-size: 0.875rem;
                }
                
                #leadDetailsModal .form-control-plaintext {
                    font-size: 1rem;
                    color: #212529;
                    padding: 8px 0;
                    border-bottom: 1px solid #f8f9fa;
                }
                
                #leadDetailsModal .notes-container {
                    background: #fff;
                    border-radius: 8px;
                }
                
                #leadDetailsModal .notes-display {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    line-height: 1.5;
                    font-size: 0.95rem;
                }
                
                #leadDetailsModal .action-buttons-section {
                    background: #f8f9fa;
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
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


                .archive-table-container {
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #dee2e6;
                }
                
                /* Purple button styles for trial scheduling */
                .btn-outline-purple {
                    color: #6f42c1;
                    border-color: #6f42c1;
                }
                .btn-outline-purple:hover {
                    color: #fff;
                    background-color: #6f42c1;
                    border-color: #6f42c1;
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
                            ${hasSelection && this.selectedArchivedLeads.size === 1 && !this.isConvertedLead([...this.selectedArchivedLeads][0]) ? `
                                <button class="btn btn-outline-primary btn-sm" onclick="leadKanban.reactivateSelectedLeads()">
                                    <i class="bi bi-arrow-counterclockwise me-1"></i>
                                    Reaktivieren
                                </button>
                            ` : ''}
                            ${hasSelection ? `
                                <button class="btn btn-outline-danger btn-sm" onclick="leadKanban.deleteSelectedLeads()">
                                    <i class="bi bi-trash me-1"></i>
                                    ${this.selectedArchivedLeads.size === 1 ? 'Löschen' : `Löschen (${this.selectedArchivedLeads.size})`}
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
                                <option value="lost" ${this.archiveStatusFilter === 'lost' ? 'selected' : ''}>Verloren</option>
                                <option value="not_interested" ${this.archiveStatusFilter === 'not_interested' ? 'selected' : ''}>Nicht interessiert</option>
                                <option value="unreachable" ${this.archiveStatusFilter === 'unreachable' ? 'selected' : ''}>Nicht erreichbar</option>
                                <option value="wrong_number" ${this.archiveStatusFilter === 'wrong_number' ? 'selected' : ''}>Falsche Nummer</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            ${hasSelection ? `
                                <button class="btn btn-outline-dark btn-sm w-100" onclick="leadKanban.clearSelection()">
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
                        <div class="archive-table-container" onclick="leadKanban.handleTableClick(event)">
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
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
            'converted': '<span class="badge bg-success">Konvertiert</span>',
            'lost': '<span class="badge bg-danger">Verloren</span>',
            'not_interested': '<span class="badge bg-warning">Nicht interessiert</span>',
            'unreachable': '<span class="badge" style="background-color: #8B4513; color: white;">Nicht erreichbar</span>',
            'wrong_number': '<span class="badge bg-dark">Falsche Nummer</span>'
        };

        const archivedDate = lead.archive_date ? new Date(lead.archive_date).toLocaleDateString('de-DE') : 
                           lead.stage_entered_at ? new Date(lead.stage_entered_at).toLocaleDateString('de-DE') : 'N/A';
        const isSelected = this.selectedArchivedLeads.has(lead.id);

        return `
            <tr class="archive-lead-row ${isSelected ? 'selected' : ''}" 
                data-lead-id="${lead.id}"
                onclick="leadKanban.handleLeadSelection(${lead.id}, event)" 
                style="cursor: pointer; ${isSelected ? 'background-color: #e3f2fd !important;' : ''}">
                
                <td style="${isSelected ? 'background-color: #e3f2fd !important;' : ''}"><strong>${lead.name || 'Unknown'}</strong></td>
                <td style="${isSelected ? 'background-color: #e3f2fd !important;' : ''}">
                    ${lead.phone_number ? `<div><i class="bi bi-telephone me-1"></i>${this.formatPhone(lead.phone_number)}</div>` : ''}
                    ${lead.email ? `<div><i class="bi bi-envelope me-1"></i>${lead.email}</div>` : ''}
                    ${!lead.phone_number && !lead.email ? '<span class="text-muted">No contact info</span>' : ''}
                </td>
                <td style="${isSelected ? 'background-color: #e3f2fd !important;' : ''}">${statusBadges[lead.status] || lead.status}</td>
                <td style="${isSelected ? 'background-color: #e3f2fd !important;' : ''}">${archivedDate}</td>
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
                            <h5 class="modal-title">Neuen Lead hinzufügen</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-lead-form">
                                <div class="mb-3">
                                    <label class="form-label">Name <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="lead-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Telefon <span class="text-danger">*</span></label>
                                    <input type="tel" class="form-control" id="lead-phone" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">E-Mail</label>
                                    <input type="email" class="form-control" id="lead-email">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Notizen</label>
                                    <textarea class="form-control" id="lead-notes" rows="3"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="leadKanban.addLead()">
                                Lead hinzufügen
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

            <!-- Lead Details Modal -->
            <div class="modal fade" id="leadDetailsModal" tabindex="-1">
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
                            <div class="row">
                                <!-- Lead Information Column -->
                                <div class="col-md-8">
                                    <div class="lead-info-section mb-4">
                                        <h6 class="section-title mb-3">
                                            <i class="bi bi-info-circle me-2"></i>
                                            Kontaktinformationen
                                        </h6>
                                        <div class="row g-3">
                                            <div class="col-md-6">
                                                <label class="form-label">Name</label>
                                                <div class="form-control-plaintext" id="lead-detail-name">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Telefon</label>
                                                <div class="form-control-plaintext" id="lead-detail-phone">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">E-Mail</label>
                                                <div class="form-control-plaintext" id="lead-detail-email">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Quelle</label>
                                                <div class="form-control-plaintext" id="lead-detail-source">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Status</label>
                                                <div class="form-control-plaintext">
                                                    <span class="badge" id="lead-detail-status-badge">-</span>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Erstellt am</label>
                                                <div class="form-control-plaintext" id="lead-detail-created">-</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Notes Section -->
                                    <div class="notes-section">
                                        <h6 class="section-title mb-3">
                                            <i class="bi bi-sticky-note me-2"></i>
                                            Notizen
                                        </h6>
                                        <div class="notes-container">
                                            <div class="notes-display" id="lead-notes-display" 
                                                 onclick="leadKanban.editNotes()" 
                                                 style="min-height: 100px; padding: 12px; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; background: #f8f9fa;">
                                                <span class="text-muted">Klicken Sie hier, um Notizen hinzuzufügen oder zu bearbeiten...</span>
                                            </div>
                                            <textarea class="form-control d-none" id="lead-notes-editor" 
                                                      rows="4" 
                                                      placeholder="Notizen eingeben..."
                                                      onblur="leadKanban.saveNotes()"></textarea>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Buttons Column -->
                                <div class="col-md-4">
                                    <div class="action-buttons-section">
                                        <h6 class="section-title mb-3">
                                            <i class="bi bi-gear me-2"></i>
                                            Aktionen
                                        </h6>
                                        <div id="lead-action-buttons" class="d-grid gap-2">
                                            <!-- Buttons will be dynamically populated based on lead status -->
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                Walk-in Probebehandlung
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="walk-in-trial-form">
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Neuen Lead erstellen und Probebehandlung sofort vereinbaren
                                </div>
                                
                                <h6 class="mb-3">Kundeninformationen</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="walk-in-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Telefon <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="walk-in-phone" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">E-Mail</label>
                                        <input type="email" class="form-control" id="walk-in-email">
                                    </div>
                                </div>
                                
                                <hr class="my-3">
                                
                                <h6 class="mb-3">Probebehandlung Termin</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Datum <span class="text-danger">*</span></label>
                                        <input type="date" class="form-control" id="walk-in-date" required onchange="leadKanban.checkDateAppointments(this.value)">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Uhrzeit <span class="text-danger">*</span></label>
                                        <input type="time" class="form-control" id="walk-in-start" required>
                                        <small class="text-muted">Dauer: 60 Minuten</small>
                                    </div>
                                </div>
                                
                                <!-- Appointment availability display -->
                                <div id="appointment-availability" class="mt-3" style="display: none;">
                                    <div class="alert alert-light border">
                                        <h6 class="mb-2">Termine am <span id="selected-date"></span>:</h6>
                                        <div id="appointment-list" class="small">
                                            <!-- Will be populated dynamically -->
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mt-3">
                                    <label class="form-label">Notizen</label>
                                    <textarea class="form-control" id="walk-in-notes" rows="2" 
                                              placeholder="Besondere Anforderungen oder Notizen..."></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="leadKanban.createWalkInTrial()">
                                <i class="bi bi-calendar-check me-1"></i>
                                Termin vereinbaren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadKanbanData() {
        // Skip loading if no studioId (e.g., when called from another tab)
        if (!this.studioId) {
            return;
        }
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/studio/${this.studioId}/kanban`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load kanban data');

            const data = await response.json();
            
            // Organize leads by status (data structure from backend matches)
            this.leads = data.leads || {
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
            
            
            this.metrics = data.metrics || {};
            
            // Force full re-render to ensure UI updates
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error loading kanban data:', error);
            this.showNotification('Fehler beim Laden der Leads', 'error');
        }
    }

    setupDragAndDrop() {
        // Drag and drop is set up via inline event handlers in the HTML
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

    // Handle drop event for drag and drop
    async handleDrop(event, newStatus) {
        event.preventDefault();
        event.stopPropagation();
        
        const leadId = this.draggedLead;
        if (!leadId) return;
        
        // Remove visual feedback
        const column = event.currentTarget.closest('.kanban-column');
        const cardsContainer = event.currentTarget.closest('.kanban-cards');
        if (column) column.classList.remove('drag-over');
        if (cardsContainer) cardsContainer.classList.remove('drag-over');
        
        // Find the lead to update
        const leadToUpdate = this.findLeadById(leadId);
        if (!leadToUpdate) return;
        
        // Don't do anything if dropping in same status
        if (leadToUpdate.status === newStatus) {
            const draggingElement = document.querySelector('.dragging');
            if (draggingElement) draggingElement.classList.remove('dragging');
            return;
        }
        
        // Special handling for trial_scheduled - show appointment modal
        if (newStatus === 'trial_scheduled') {
            const draggingElement = document.querySelector('.dragging');
            if (draggingElement) draggingElement.classList.remove('dragging');
            this.draggedLead = null;
            this.draggedFromStatus = null;
            
            // Show trial scheduling modal with lead data
            this.showTrialSchedulingModal(leadId);
            return;
        }
        
        try {
            // Update lead status
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (!response.ok) throw new Error('Failed to update lead status');
            
            // Reload kanban data
            await this.loadKanbanData();
            this.showNotification('Lead-Status erfolgreich aktualisiert', 'success');
            
        } catch (error) {
            console.error('Error updating lead status:', error);
            this.showNotification('Fehler beim Aktualisieren des Lead-Status', 'error');
            // Reload to restore original state
            await this.loadKanbanData();
        }
        
        // Clean up
        const draggingElement = document.querySelector('.dragging');
        if (draggingElement) draggingElement.classList.remove('dragging');
        this.draggedLead = null;
        this.draggedFromStatus = null;
    }

    // Find lead status by ID
    findLeadStatus(leadId) {
        // Search through active leads first
        if (this.leads) {
            for (const [status, leads] of Object.entries(this.leads)) {
                if (Array.isArray(leads)) {
                    const lead = leads.find(l => l.id === leadId);
                    if (lead) return lead.status;
                }
            }
        }
        
        // Search through archived leads
        if (this.archived) {
            for (const [category, statuses] of Object.entries(this.archived)) {
                if (typeof statuses === 'object' && statuses !== null) {
                    for (const [status, leads] of Object.entries(statuses)) {
                        if (Array.isArray(leads)) {
                            const lead = leads.find(l => l.id === leadId);
                            if (lead) return lead.status;
                        }
                    }
                }
            }
        }
        return null;
    }

    // Find lead by ID
    findLeadById(leadId) {
        // Search through active leads first
        if (this.leads) {
            for (const [status, leads] of Object.entries(this.leads)) {
                if (Array.isArray(leads)) {
                    const lead = leads.find(l => l.id === leadId);
                    if (lead) return lead;
                }
            }
        }
        
        // Search through archived leads
        if (this.archived) {
            for (const [category, statuses] of Object.entries(this.archived)) {
                if (typeof statuses === 'object' && statuses !== null) {
                    for (const [status, leads] of Object.entries(statuses)) {
                        if (Array.isArray(leads)) {
                            const lead = leads.find(l => l.id === leadId);
                            if (lead) return lead;
                        }
                    }
                }
            }
        }
        return null;
    }

    // Helper method to format phone numbers
    formatPhone(phone) {
        if (!phone) return '';
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        // Format based on length
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 11 && cleaned[0] === '1') {
            return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.startsWith('49')) {
            // German format
            return `+49 ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
        }
        // Return as-is if format is unknown
        return phone;
    }

    // Helper method to calculate time in stage
    getTimeInStage(stageEnteredAt) {
        if (!stageEnteredAt) return 'Neu';
        
        const now = new Date();
        const entered = new Date(stageEnteredAt);
        const diffMs = now - entered;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) {
            return `${diffMins} Min`;
        } else if (diffHours < 24) {
            return `${diffHours} Std`;
        } else if (diffDays === 1) {
            return '1 Tag';
        } else {
            return `${diffDays} Tage`;
        }
    }

    // Helper method to show notifications
    showNotification(message, type = 'info') {
        const notificationContainer = document.getElementById('notification-container') || this.createNotificationContainer();
        
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';

        const notification = document.createElement('div');
        notification.className = `alert ${alertClass} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        notificationContainer.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        document.body.appendChild(container);
        return container;
    }

    // Toggle archive display
    toggleArchived() {
        this.showArchived = !this.showArchived;
        this.render();
    }

    // Mac-style selection handler
    handleLeadSelection(leadId, event) {
        event.preventDefault();
        event.stopPropagation();
        
        const isSelected = this.selectedArchivedLeads.has(leadId);
        
        if (event.metaKey || event.ctrlKey) {
            // Cmd/Ctrl+Click: Toggle selection
            if (isSelected) {
                this.selectedArchivedLeads.delete(leadId);
            } else {
                this.selectedArchivedLeads.add(leadId);
            }
        } else if (event.shiftKey && this.lastSelectedLead) {
            // Shift+Click: Range selection
            this.selectRange(this.lastSelectedLead, leadId);
        } else {
            // Normal click: Multiple selection mode - toggle individual items
            if (isSelected) {
                this.selectedArchivedLeads.delete(leadId);
            } else {
                this.selectedArchivedLeads.add(leadId);
            }
        }
        
        this.lastSelectedLead = leadId;
        this.updateArchiveSelection();
    }

    // Select range of leads (for Shift+Click)
    selectRange(startId, endId) {
        const allArchived = this.getAllArchivedLeads();
        const startIndex = allArchived.findIndex(lead => lead.id === startId);
        const endIndex = allArchived.findIndex(lead => lead.id === endId);
        
        if (startIndex !== -1 && endIndex !== -1) {
            const minIndex = Math.min(startIndex, endIndex);
            const maxIndex = Math.max(startIndex, endIndex);
            
            this.selectedArchivedLeads.clear();
            for (let i = minIndex; i <= maxIndex; i++) {
                this.selectedArchivedLeads.add(allArchived[i].id);
            }
        }
    }

    // Get all archived leads as single array
    getAllArchivedLeads() {
        return [
            ...(this.archived.positive.converted || []),
            ...(this.archived.negative.unreachable || []),
            ...(this.archived.negative.not_interested || []),
            ...(this.archived.negative.lost || []),
            ...(this.archived.negative.wrong_number || [])
        ];
    }

    // Update visual selection in UI
    updateArchiveSelection() {
        document.querySelectorAll('.archive-lead-row').forEach(row => {
            const leadId = parseInt(row.dataset.leadId);
            if (this.selectedArchivedLeads.has(leadId)) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
        // Re-render to update action buttons
        this.render();
    }

    // Check if lead is converted (cannot be reactivated)
    isConvertedLead(leadId) {
        return this.archived.positive.converted.some(lead => lead.id === leadId);
    }

    // Clear all selections (when clicking empty space)
    clearSelection() {
        this.selectedArchivedLeads.clear();
        this.lastSelectedLead = null;
        this.render();
    }

    // Select all visible leads
    selectAllVisible() {
        const allArchived = this.getAllArchivedLeads();
        allArchived.forEach(lead => this.selectedArchivedLeads.add(lead.id));
        this.render();
    }

    // Handle clicks on table area (for clearing selection)
    handleTableClick(event) {
        // Only clear selection if clicking on table background, not on a row
        if (event.target.closest('.archive-lead-row')) {
            return; // Let row handler deal with this
        }
        
        // Clear selection when clicking empty space
        if (this.selectedArchivedLeads.size > 0) {
            this.clearSelection();
        }
    }

    // Create lead details modal dynamically if it doesn't exist
    createLeadDetailsModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('leadDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div class="modal fade" id="leadDetailsModal" tabindex="-1">
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
                            <div class="row">
                                <!-- Lead Information Column -->
                                <div class="col-md-8">
                                    <div class="lead-info-section mb-4">
                                        <h6 class="section-title mb-3">
                                            <i class="bi bi-info-circle me-2"></i>
                                            Kontaktinformationen
                                        </h6>
                                        <div class="row g-3">
                                            <div class="col-md-6">
                                                <label class="form-label">Name</label>
                                                <div class="form-control-plaintext" id="lead-detail-name">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Telefon</label>
                                                <div class="form-control-plaintext" id="lead-detail-phone">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">E-Mail</label>
                                                <div class="form-control-plaintext" id="lead-detail-email">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Quelle</label>
                                                <div class="form-control-plaintext" id="lead-detail-source">-</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Status</label>
                                                <div class="form-control-plaintext">
                                                    <span class="badge" id="lead-detail-status-badge">-</span>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label">Erstellt am</label>
                                                <div class="form-control-plaintext" id="lead-detail-created">-</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Notes Section -->
                                    <div class="notes-section">
                                        <h6 class="section-title mb-3">
                                            <i class="bi bi-sticky-note me-2"></i>
                                            Notizen
                                        </h6>
                                        <div class="notes-container">
                                            <div class="notes-display" id="lead-notes-display" 
                                                 onclick="leadKanban.editNotes()" 
                                                 style="min-height: 100px; padding: 12px; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; background: #f8f9fa;">
                                                <span class="text-muted">Klicken Sie hier, um Notizen hinzuzufügen oder zu bearbeiten...</span>
                                            </div>
                                            <textarea class="form-control d-none" id="lead-notes-editor" 
                                                      rows="4" 
                                                      placeholder="Notizen eingeben..."
                                                      onblur="leadKanban.saveNotes()"></textarea>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Buttons Column -->
                                <div class="col-md-4">
                                    <div class="action-buttons-section">
                                        <h6 class="section-title mb-3">
                                            <i class="bi bi-gear me-2"></i>
                                            Aktionen
                                        </h6>
                                        <div id="lead-action-buttons" class="d-grid gap-2">
                                            <!-- Buttons will be dynamically populated based on lead status -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Show lead details modal
    async showLeadDetails(leadId) {
        try {
            // Ensure modal exists
            if (!document.getElementById('leadDetailsModal')) {
                this.createLeadDetailsModal();
            }

            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch lead details');

            const data = await response.json();
            const lead = data.lead;

            // Populate modal with lead data
            document.getElementById('lead-detail-name').textContent = lead.name || '-';
            document.getElementById('lead-detail-phone').textContent = this.formatPhone(lead.phone_number) || '-';
            document.getElementById('lead-detail-email').textContent = lead.email || '-';
            document.getElementById('lead-detail-source').textContent = lead.source || '-';
            document.getElementById('lead-detail-created').textContent = new Date(lead.created_at).toLocaleDateString('de-DE');
            
            // Status badge
            const statusBadge = document.getElementById('lead-detail-status-badge');
            statusBadge.textContent = this.getStatusDisplay(lead.status);
            statusBadge.className = `badge ${this.getStatusBadgeClass(lead.status)}`;
            
            // Notes
            const notesDisplay = document.getElementById('lead-notes-display');
            const notesEditor = document.getElementById('lead-notes-editor');
            if (lead.notes && lead.notes.trim()) {
                notesDisplay.innerHTML = lead.notes.replace(/\n/g, '<br>');
            } else {
                notesDisplay.innerHTML = '<span class="text-muted">Klicken Sie hier, um Notizen hinzuzufügen oder zu bearbeiten...</span>';
            }
            notesEditor.value = lead.notes || '';
            
            // Store current lead ID for notes saving
            this.currentLeadId = leadId;
            this.currentLeadData = lead;
            
            // Populate action buttons based on status
            this.populateActionButtons(lead.status, lead);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('leadDetailsModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading lead details:', error);
            this.showNotification('Fehler beim Laden der Lead-Details', 'error');
        }
    }

    // Get status display text
    getStatusDisplay(status) {
        const statusMap = {
            'new': 'Neu',
            'working': 'In Bearbeitung',
            'qualified': 'Qualifiziert',
            'trial_scheduled': 'Probebehandlung geplant',
            'converted': 'Konvertiert',
            'unreachable': 'Nicht erreichbar',
            'wrong_number': 'Falsche Nummer',
            'not_interested': 'Nicht interessiert',
            'lost': 'Verloren'
        };
        return statusMap[status] || status;
    }

    // Get status badge CSS class
    getStatusBadgeClass(status) {
        const classMap = {
            'new': 'bg-primary',
            'working': 'bg-warning',
            'qualified': 'bg-info',
            'trial_scheduled': 'bg-purple text-white',
            'converted': 'bg-success',
            'unreachable': 'bg-brown',
            'wrong_number': 'bg-danger',
            'not_interested': 'bg-dark',
            'lost': 'bg-muted'
        };
        return classMap[status] || 'bg-secondary';
    }

    // Populate action buttons based on lead status
    populateActionButtons(status, lead) {
        const buttonsContainer = document.getElementById('lead-action-buttons');
        let buttonsHtml = '';
        
        switch (status) {
            case 'new':
                // Neu - keine Actions
                buttonsHtml = '';
                break;
                
            case 'working':
                // In Bearbeitung - nicht erreichbar, nicht interessiert, falsche nummer
                buttonsHtml = `
                    <button class="btn btn-outline-dark btn-sm" onclick="leadKanban.updateLeadStatus('unreachable')" onmouseover="this.style.backgroundColor='#8B4513'; this.style.color='white'; this.style.borderColor='#8B4513'" onmouseout="this.style.backgroundColor=''; this.style.color=''; this.style.borderColor=''">
                        <i class="bi bi-telephone-x me-1"></i>
                        Nicht erreichbar
                    </button>
                    <button class="btn btn-outline-warning btn-sm" onclick="leadKanban.updateLeadStatus('not_interested')">
                        <i class="bi bi-x-circle me-1"></i>
                        Nicht interessiert
                    </button>
                    <button class="btn btn-outline-dark btn-sm" onclick="leadKanban.updateLeadStatus('wrong_number')">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        Falsche Nummer
                    </button>
                `;
                break;
                
            case 'qualified':
                // Qualifiziert - Probebehandlung vereinbaren, verloren
                buttonsHtml = `
                    <button class="btn btn-outline-purple btn-sm" onclick="leadKanban.showTrialSchedulingModal('${lead.id}')">
                        <i class="bi bi-calendar-plus me-1"></i>
                        Probebehandlung vereinbaren
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="leadKanban.updateLeadStatus('lost')">
                        <i class="bi bi-x-circle me-1"></i>
                        Verloren
                    </button>
                `;
                break;
                
            case 'trial_scheduled':
                // Probebehandlung geplant - verloren, convert to customer
                buttonsHtml = `
                    <button class="btn btn-outline-danger btn-sm" onclick="leadKanban.updateLeadStatus('lost')">
                        <i class="bi bi-x-circle me-1"></i>
                        Verloren
                    </button>
                    <button class="btn btn-outline-success btn-sm" onclick="leadKanban.updateLeadStatus('converted')">
                        <i class="bi bi-check-circle me-1"></i>
                        Zu Kunde konvertieren
                    </button>
                `;
                break;
                
            default:
                // Archived status - no actions
                buttonsHtml = '<div class="text-muted small">Keine Aktionen verfügbar</div>';
                break;
        }
        
        buttonsContainer.innerHTML = buttonsHtml;
    }

    // Update lead status
    async updateLeadStatus(newStatus) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${this.currentLeadId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Failed to update lead status');

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('leadDetailsModal'));
            modal.hide();
            
            // Show success notification
            this.showNotification(`Lead-Status wurde zu ${this.getStatusDisplay(newStatus)} aktualisiert`, 'success');
            
            // Reload data to reflect changes
            await this.loadKanbanData();
            
        } catch (error) {
            console.error('Error updating lead status:', error);
            this.showNotification('Fehler beim Aktualisieren des Lead-Status', 'error');
        }
    }

    // Edit notes (switch to editor mode)
    editNotes() {
        const display = document.getElementById('lead-notes-display');
        const editor = document.getElementById('lead-notes-editor');
        
        display.classList.add('d-none');
        editor.classList.remove('d-none');
        editor.focus();
    }

    // Save notes (switch back to display mode)
    async saveNotes() {
        const display = document.getElementById('lead-notes-display');
        const editor = document.getElementById('lead-notes-editor');
        const newNotes = editor.value.trim();
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${this.currentLeadId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: this.currentLeadData.name,
                    phone_number: this.currentLeadData.phone_number,
                    email: this.currentLeadData.email,
                    status: this.currentLeadData.status,
                    source: this.currentLeadData.source,
                    notes: newNotes
                })
            });

            if (!response.ok) throw new Error('Failed to save notes');

            // Update display
            if (newNotes) {
                display.innerHTML = newNotes.replace(/\n/g, '<br>');
            } else {
                display.innerHTML = '<span class="text-muted">Klicken Sie hier, um Notizen hinzuzufügen oder zu bearbeiten...</span>';
            }
            
            // Update current lead data
            this.currentLeadData.notes = newNotes;
            
            // Switch back to display mode
            editor.classList.add('d-none');
            display.classList.remove('d-none');
            
            // Show success notification (subtle)
            this.showNotification('Notizen gespeichert', 'success');
            
        } catch (error) {
            console.error('Error saving notes:', error);
            this.showNotification('Fehler beim Speichern der Notizen', 'error');
            
            // Keep in edit mode on error
        }
    }

    // Show add lead modal
    showAddLeadModal() {
        const modal = new bootstrap.Modal(document.getElementById('addLeadModal'));
        modal.show();
        // Auto-focus first input
        setTimeout(() => {
            document.getElementById('lead-name')?.focus();
        }, 500);
    }

    // Show trial scheduling modal for existing lead
    showTrialSchedulingModal(leadId) {
        // Find the lead data
        const lead = this.findLeadById(leadId);
        if (!lead) {
            this.showNotification('Lead nicht gefunden', 'error');
            return;
        }

        // Pre-fill the walk-in modal with lead data
        document.getElementById('walk-in-name').value = lead.name || '';
        document.getElementById('walk-in-phone').value = lead.phone_number || '';
        document.getElementById('walk-in-email').value = lead.email || '';
        document.getElementById('walk-in-notes').value = `Termin für Lead: ${lead.name}`;

        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('walk-in-date').value = tomorrow.toISOString().split('T')[0];

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('walkInTrialModal'));
        modal.show();
        
        // Store the lead ID for later use
        this.schedulingLeadId = leadId;
        
        // Auto-focus date input since name/phone are pre-filled
        setTimeout(() => {
            document.getElementById('walk-in-date')?.focus();
        }, 500);
    }

    // Helper method to find lead by ID
    findLeadById(leadId) {
        const allLeads = [
            ...this.leads.new,
            ...this.leads.working,
            ...this.leads.qualified,
            ...this.leads.trial_scheduled
        ];
        return allLeads.find(lead => lead.id == leadId);
    }

    // Show walk-in trial modal
    showWalkInTrialModal() {
        // Clear any stored lead ID
        this.schedulingLeadId = null;
        
        const modal = new bootstrap.Modal(document.getElementById('walkInTrialModal'));
        modal.show();
        // Auto-focus first input
        setTimeout(() => {
            document.getElementById('walk-in-name')?.focus();
        }, 500);
        // Hide availability on modal open
        const availabilityDiv = document.getElementById('appointment-availability');
        if (availabilityDiv) {
            availabilityDiv.style.display = 'none';
        }
    }

    // Add new lead
    async addLead() {
        try {
            const name = document.getElementById('lead-name').value.trim();
            const phone = document.getElementById('lead-phone').value.trim();
            const email = document.getElementById('lead-email').value.trim();
            const notes = document.getElementById('lead-notes').value.trim();

            if (!name || !phone) {
                this.showNotification('Name und Telefon sind erforderlich', 'error');
                return;
            }

            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studio_id: this.studioId,
                    name,
                    phone_number: phone,  // Fixed: Backend expects phone_number
                    email: email || null,
                    notes: notes || null,
                    status: 'new'
                })
            });

            if (!response.ok) throw new Error('Failed to create lead');

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addLeadModal'));
            modal.hide();

            // Reset form
            document.getElementById('add-lead-form').reset();

            // Reload kanban
            await this.loadKanbanData();
            this.showNotification('Lead erfolgreich erstellt', 'success');

        } catch (error) {
            console.error('Error creating lead:', error);
            this.showNotification('Fehler beim Erstellen des Leads', 'error');
        }
    }

    // Check appointments for a specific date
    async checkDateAppointments(date) {
        if (!date) return;
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/studio/${this.studioId}?date=${date}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.error('Failed to fetch appointments');
                return;
            }

            const data = await response.json();
            const appointments = data.appointments || [];

            // Display appointments
            const availabilityDiv = document.getElementById('appointment-availability');
            const selectedDateSpan = document.getElementById('selected-date');
            const appointmentList = document.getElementById('appointment-list');

            if (availabilityDiv && selectedDateSpan && appointmentList) {
                // Format date for display
                const dateObj = new Date(date + 'T00:00:00');
                const formattedDate = dateObj.toLocaleDateString('de-DE', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                selectedDateSpan.textContent = formattedDate;
                
                if (appointments.length === 0) {
                    appointmentList.innerHTML = '<div class="text-success"><i class="bi bi-check-circle me-2"></i>Keine Termine - alle Zeiten verfügbar</div>';
                } else {
                    // Sort appointments by start time
                    appointments.sort((a, b) => a.start_time.localeCompare(b.start_time));
                    
                    let html = '<div class="list-group list-group-flush">';
                    appointments.forEach(apt => {
                        const startTime = apt.start_time.substring(0, 5);
                        const endTime = apt.end_time ? apt.end_time.substring(0, 5) : this.addMinutesToTime(startTime, 60);
                        const customerName = apt.customer_first_name || apt.customer_last_name ? 
                            `${apt.customer_first_name || ''} ${apt.customer_last_name || ''}`.trim() : 'Unbekannt';
                        const typeName = apt.appointment_type_name || 'Termin';
                        
                        html += `
                            <div class="list-group-item px-0 py-1 border-0">
                                <span class="text-danger"><i class="bi bi-x-circle me-2"></i></span>
                                <strong>${startTime} - ${endTime}</strong>: ${typeName} (${customerName})
                            </div>
                        `;
                    });
                    html += '</div>';
                    appointmentList.innerHTML = html;
                }
                
                availabilityDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error checking appointments:', error);
        }
    }

    // Helper function to add minutes to time string
    addMinutesToTime(timeStr, minutes) {
        const [hours, mins] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + mins + minutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMins = totalMinutes % 60;
        return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
    }

    // Create walk-in trial or schedule appointment for existing lead
    async createWalkInTrial() {
        try {
            const name = document.getElementById('walk-in-name').value.trim();
            const phone = document.getElementById('walk-in-phone').value.trim();
            const email = document.getElementById('walk-in-email').value.trim();
            const notes = document.getElementById('walk-in-notes').value.trim();
            const date = document.getElementById('walk-in-date').value;
            const startTime = document.getElementById('walk-in-start').value;

            if (!name || !phone || !date || !startTime) {
                this.showNotification('Bitte alle Pflichtfelder ausfüllen', 'error');
                return;
            }

            // Calculate end time (60 minutes after start)
            const endTime = this.addMinutesToTime(startTime, 60);

            const token = localStorage.getItem('authToken');
            
            // Get appointment types to find Probebehandlung ID
            const typesResponse = await fetch(`${window.API_BASE_URL}/api/v1/appointment-types/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            let appointmentTypeId = 1; // Default fallback
            if (typesResponse.ok) {
                const typesData = await typesResponse.json();
                const trialType = typesData.appointmentTypes?.find(t => 
                    t.name.toLowerCase().includes('probe') || 
                    t.is_probebehandlung === true
                );
                if (trialType) {
                    appointmentTypeId = trialType.id;
                }
            }
            
            // Check if we're scheduling for an existing lead or creating a new walk-in
            if (this.schedulingLeadId) {
                // Scheduling appointment for existing lead
                const leadAppointmentResponse = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        studio_id: this.studioId,
                        lead_id: this.schedulingLeadId,
                        appointment_type_id: appointmentTypeId,
                        appointment_date: date,
                        start_time: startTime,
                        end_time: endTime,
                        notes: notes || null
                    })
                });

                if (!leadAppointmentResponse.ok) {
                    const errorData = await leadAppointmentResponse.json();
                    throw new Error(errorData.message || 'Fehler beim Erstellen des Termins');
                }

                const appointmentData = await leadAppointmentResponse.json();
                this.showNotification('Probebehandlung erfolgreich geplant', 'success');
            } else {
                // Create new walk-in (lead + appointment atomically)
                const walkInResponse = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments/walk-in`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        studio_id: this.studioId,
                        lead_data: {
                            name,
                            phone_number: phone,
                            email: email || null
                        },
                        appointment_data: {
                            appointment_type_id: appointmentTypeId,
                            appointment_date: date,
                            start_time: startTime,
                            end_time: endTime,
                            notes: notes || null
                        }
                    })
                });

                if (!walkInResponse.ok) {
                    const errorData = await walkInResponse.json();
                    throw new Error(errorData.message || 'Fehler beim Erstellen des Termins');
                }

                const walkInData = await walkInResponse.json();
                this.showNotification('Walk-in Probebehandlung erfolgreich geplant', 'success');
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('walkInTrialModal'));
            modal.hide();

            // Reset form and state
            document.getElementById('walk-in-trial-form').reset();
            this.schedulingLeadId = null; // Clear the stored lead ID
            const availabilityDiv = document.getElementById('appointment-availability');
            if (availabilityDiv) {
                availabilityDiv.style.display = 'none';
            }

            // Reload kanban to reflect changes
            await this.loadKanbanData();

        } catch (error) {
            console.error('Error creating walk-in trial:', error);
            this.showNotification('Fehler beim Erstellen der Walk-in Probebehandlung', 'error');
        }
    }

    // Reactivate selected archived leads
    async reactivateSelectedLeads() {
        if (this.selectedArchivedLeads.size === 0) return;

        try {
            const token = localStorage.getItem('authToken');
            const leadId = [...this.selectedArchivedLeads][0]; // Only single lead can be reactivated
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'new' })
            });

            if (!response.ok) throw new Error('Failed to reactivate lead');

            this.showNotification('Lead erfolgreich reaktiviert', 'success');
            this.selectedArchivedLeads.clear();
            await this.loadKanbanData();

        } catch (error) {
            console.error('Error reactivating lead:', error);
            this.showNotification('Fehler beim Reaktivieren des Leads', 'error');
        }
    }

    // Delete selected archived leads
    async deleteSelectedLeads() {
        if (this.selectedArchivedLeads.size === 0) return;

        const leadCount = this.selectedArchivedLeads.size;
        const confirmMessage = leadCount === 1 
            ? 'Are you sure you want to delete this lead? This action cannot be undone.'
            : `Are you sure you want to delete ${leadCount} leads? This action cannot be undone.`;

        if (!confirm(confirmMessage)) return;

        try {
            const token = localStorage.getItem('authToken');
            const deletePromises = [...this.selectedArchivedLeads].map(leadId => 
                fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
            );

            const responses = await Promise.all(deletePromises);
            const failedDeletes = responses.filter(response => !response.ok);

            if (failedDeletes.length > 0) {
                throw new Error(`Failed to delete ${failedDeletes.length} leads`);
            }

            const successMessage = leadCount === 1 
                ? 'Lead erfolgreich gelöscht'
                : `${leadCount} Leads erfolgreich gelöscht`;
                
            this.showNotification(successMessage, 'success');
            this.selectedArchivedLeads.clear();
            await this.loadKanbanData();

        } catch (error) {
            console.error('Error deleting leads:', error);
            this.showNotification('Fehler beim Löschen der Leads', 'error');
        }
    }

    // Filter archive by search query and/or status
    filterArchive(searchQuery, statusFilter) {
        // Update search query if provided
        if (searchQuery !== null) {
            this.archiveSearchQuery = searchQuery;
            
            // Clear existing debounce timer
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            // Debounce search rendering to avoid excessive re-renders
            this.searchDebounceTimer = setTimeout(() => {
                this.updateArchivePanel();
            }, 300);
            return;
        }
        
        // Update status filter if provided
        if (statusFilter !== null) {
            this.archiveStatusFilter = statusFilter;
        }
        
        // Re-render immediately for status filter changes
        this.updateArchivePanel();
    }
    
    // Update only the archive panel to avoid full re-render
    updateArchivePanel() {
        const archivePanel = document.getElementById('archive-panel');
        if (archivePanel && this.showArchived) {
            // Preserve search input state before re-rendering
            const searchInput = archivePanel.querySelector('input[type="text"]');
            const hadFocus = searchInput && document.activeElement === searchInput;
            const cursorPosition = hadFocus ? searchInput.selectionStart : 0;
            
            // Update the panel content
            archivePanel.innerHTML = this.renderArchivePanel();
            
            // Restore search input state after re-rendering
            if (hadFocus) {
                const newSearchInput = archivePanel.querySelector('input[type="text"]');
                if (newSearchInput) {
                    newSearchInput.focus();
                    newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
                }
            }
        } else if (!this.showArchived) {
            // If archive is hidden, do full render
            this.render();
        }
    }

}

// Global instance
window.leadKanban = new LeadKanban();
