// Enhanced Customer Management Component with Card View and Block Logic
class CustomerManagement {
    constructor() {
        this.studioId = null;
        this.customers = [];
        this.filteredCustomers = [];
        this.selectedCustomer = null;
        this.searchQuery = '';
        this.filterStatus = 'all';
        this.viewMode = 'cards'; // cards or list
        this.isLoading = false;
        this._initialized = false;
    }

    async init(studioId, skipTabSwitch = false) {
        // Prevent multiple initializations
        if (this._initializing) {
            console.log('Already initializing, skipping...');
            return;
        }
        
        if (this._initialized && this.getStudioId() === studioId) {
            console.log('Already initialized with same studio, just refreshing...');
            
            // Check if the container exists, if not re-render (unless skipTabSwitch is true)
            if (!skipTabSwitch) {
                const container = document.getElementById('customers-container');
                if (!container) {
                    console.log('Container not found, re-rendering...');
                    this.render();
                    this.setupEventListeners();
                }
                
                await this.loadCustomers();
            }
            return;
        }
        
        // Clear any pending UI updates
        if (this._updateUITimeout) {
            clearTimeout(this._updateUITimeout);
            this._updateUITimeout = null;
        }
        
        this._initializing = true;
        this._initialized = false;
        this.studioId = studioId;
        console.log('Initializing Customer Management for studio:', studioId);
        
        if (studioId) {
            this._studioId = studioId;
            window._customerManagementStudioId = studioId;
        }
        
        try {
            // Only render the main UI if not skipping tab switch
            if (!skipTabSwitch) {
                this.render();
            } else {
                // Just ensure the modals are available in the DOM
                this.ensureModalsExist();
            }
            
            await this.loadCustomers(true); // Pass true to skip initial updateUI
            
            if (!skipTabSwitch) {
                this.setupEventListeners();
            }
            
            this._initialized = true;
        } catch (error) {
            console.error('Error during initialization:', error);
            this._initialized = false;
        } finally {
            this._initializing = false;
        }
    }
    
    getStudioId() {
        return this.studioId || this._studioId || window._customerManagementStudioId;
    }

    ensureModalsExist() {
        // Check if the modals container exists, if not create it
        if (!document.getElementById('customerManagementModals')) {
            const modalsContainer = document.createElement('div');
            modalsContainer.id = 'customerManagementModals';
            modalsContainer.innerHTML = this.renderModals();
            document.body.appendChild(modalsContainer);
        }
    }

    render() {
        const container = document.getElementById('customer-management-content') || document.getElementById('app');
        container.innerHTML = `
            <div class="customer-management">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 mb-0">
                            <i class="bi bi-people-fill text-primary me-2"></i>
                            Kunden Management
                        </h2>
                        <p class="text-muted mb-0">Verwalten Sie Ihre Kunden mit Behandlungspaketen und Registrierungscodes</p>
                    </div>
                    <button class="btn btn-primary" onclick="customerManagement.showAddCustomerModal()">
                        <i class="bi bi-plus-circle me-1"></i>
                        Neuer Kunde
                    </button>
                </div>

                <!-- Statistics -->
                <div class="row g-3 mb-4">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <div class="icon-circle bg-primary bg-opacity-10">
                                        <i class="bi bi-people icon-very-light"></i>
                                    </div>
                                    <div class="ms-3">
                                        <div class="fs-4 fw-bold text-primary" id="stat-total">0</div>
                                        <div class="text-muted small">Kunden Gesamt</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <div class="icon-circle bg-success bg-opacity-10">
                                        <i class="bi bi-check-circle icon-deep-green"></i>
                                    </div>
                                    <div class="ms-3">
                                        <div class="fs-4 fw-bold text-success" id="stat-active">0</div>
                                        <div class="text-muted small">Aktive Kunden</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Search and Filters -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="input-group">
                                    <span class="input-group-text">
                                        <i class="bi bi-search"></i>
                                    </span>
                                    <input type="text" 
                                           class="form-control" 
                                           id="customer-search"
                                           placeholder="Suchen nach Name, Telefon, E-Mail oder Code..."
                                           onkeyup="customerManagement.searchCustomers(this.value)">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <select class="form-select" id="filter-status" onchange="customerManagement.filterByStatus(this.value)">
                                    <option value="all">Alle Kunden</option>
                                    <option value="active_sessions">Aktive Kunden</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <div class="btn-group w-100" role="group">
                                    <button type="button" class="btn view-toggle-btn ${this.viewMode === 'cards' ? 'view-active' : ''}" 
                                            onclick="customerManagement.setViewMode('cards')"
                                            title="Card View">
                                        <i class="bi bi-grid-3x2-gap"></i>
                                    </button>
                                    <button type="button" class="btn view-toggle-btn ${this.viewMode === 'list' ? 'view-active' : ''}" 
                                            onclick="customerManagement.setViewMode('list')"
                                            title="List View">
                                        <i class="bi bi-list-ul"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Customers Container -->
                <div id="customers-container">
                    <div class="text-center py-5">
                        <div class="spinner-border" role="status"></div>
                        <p class="text-muted mt-2">Lade Kunden...</p>
                    </div>
                </div>
            </div>

            <!-- Modals -->
            ${this.renderModals()}

            <style>
                .customer-management { padding: 0; }
                .icon-circle {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                }
                .customer-card {
                    transition: transform 0.2s, box-shadow 0.2s;
                    cursor: pointer;
                    height: 100%;
                }
                .customer-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.1) !important;
                }
                .registration-code {
                    font-family: monospace;
                    font-size: 13px;
                    background: #f8f9fa;
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid #dee2e6;
                    display: inline-block;
                }
                .session-block {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    margin-bottom: 8px;
                }
                .session-block.inactive {
                    background: #e9ecef;
                    color: #6c757d;
                }
                .appointment-item {
                    padding: 12px;
                    border-left: 3px solid #0d6efd;
                    background: #f8f9fa;
                    margin-bottom: 8px;
                    border-radius: 4px;
                }
                .appointment-item.past {
                    border-left-color: #6c757d;
                    opacity: 0.7;
                }
                .detail-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .avatar-large {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 32px;
                    font-weight: bold;
                }
                .customer-row:hover {
                    background: #f8f9fa;
                }
                .block-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                    margin-right: 4px;
                }
                .block-indicator.active { background: #28a745; }
                .block-indicator.inactive { background: #6c757d; }
                .view-toggle-btn {
                    border: 1px solid #B8A8D8;
                    color: #B8A8D8;
                    background: transparent;
                    transition: all 0.2s;
                }
                .view-toggle-btn:hover {
                    border-color: #B8A8D8;
                    color: #B8A8D8;
                    background: rgba(184, 168, 216, 0.1);
                }
                .view-toggle-btn.view-active {
                    background: #B8A8D8;
                    border-color: #B8A8D8;
                    color: white;
                }
                .view-toggle-btn.view-active:hover {
                    background: #B8A8D8;
                    border-color: #B8A8D8;
                    color: white;
                }
                .icon-very-light {
                    color: #E8DDF0 !important;
                }
                .icon-deep-green {
                    color: #198754 !important;
                }
            </style>
        `;
    }

    renderCustomers() {
        if (this.isLoading) {
            return `
                <div class="text-center py-5">
                    <div class="spinner-border" role="status"></div>
                    <p class="text-muted mt-2">Loading customers...</p>
                </div>
            `;
        }

        if (this.filteredCustomers.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="bi bi-people display-4 text-muted mb-3"></i>
                    <h5 class="text-muted">Keine Kunden gefunden</h5>
                    <p class="text-muted">
                        ${this.searchQuery || this.filterStatus !== 'all' ? 
                            'Keine Kunden entsprechen Ihren Filtern.' : 
                            'Fügen Sie Ihren ersten Kunden mit einem Behandlungspaket hinzu.'}
                    </p>
                    ${!this.searchQuery && this.filterStatus === 'all' ? `
                        <button class="btn btn-primary mt-3" onclick="customerManagement.showAddCustomerModal()">
                            <i class="bi bi-plus-circle me-1"></i>
                            Ersten Kunden hinzufügen
                        </button>
                    ` : ''}
                </div>
            `;
        }

        return this.viewMode === 'cards' ? this.renderCustomerCards() : this.renderCustomersList();
    }

    renderCustomerCards() {
        return `
            <div class="row g-4">
                ${this.filteredCustomers.map(customer => this.renderCustomerCard(customer)).join('')}
            </div>
        `;
    }

    renderCustomerCard(customer) {
        const initials = `${customer.contact_first_name?.[0] || ''}${customer.contact_last_name?.[0] || ''}`.toUpperCase();
        const hasActiveSessions = customer.remaining_sessions > 0;
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card customer-card border-0 shadow-sm" onclick="customerManagement.showCustomerDetails(${customer.id})">
                    <div class="card-body">
                        <!-- Header with Avatar -->
                        <div class="d-flex align-items-start mb-3">
                            <div class="avatar-circle me-3" style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                                ${initials}
                            </div>
                            <div class="flex-grow-1">
                                <h5 class="card-title mb-1">${customer.contact_first_name} ${customer.contact_last_name}</h5>
                                <div class="d-flex gap-2 flex-wrap">
                                    ${customer.has_app_access ? 
                                        '<span class="badge bg-success bg-opacity-10 text-success"><i class="bi bi-phone-fill me-1"></i>App Benutzer</span>' :
                                        '<span class="badge bg-warning bg-opacity-10 text-warning"><i class="bi bi-clock me-1"></i>Nicht registriert</span>'}
                                    ${hasActiveSessions ? 
                                        '<span class="badge bg-success bg-opacity-10 text-success"><i class="bi bi-check-circle me-1"></i>Aktiv</span>' :
                                        '<span class="badge bg-secondary bg-opacity-10 text-secondary">Inaktiv</span>'}
                                </div>
                            </div>
                        </div>

                        <!-- Registration Code -->
                        <div class="mb-3">
                            <small class="text-muted d-block mb-1">Registrierungscode</small>
                            <div class="d-flex align-items-center">
                                <span class="registration-code me-2">${customer.registration_code}</span>
                                ${!customer.has_app_access ? `
                                    <button class="btn btn-sm btn-link p-0" 
                                            onclick="event.stopPropagation(); customerManagement.copyCode('${customer.registration_code}')"
                                            title="Copy code">
                                        <i class="bi bi-clipboard"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Sessions Info -->
                        <div class="mb-3">
                            <small class="text-muted d-block mb-1">Behandlungen</small>
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <span class="fs-5 fw-bold ${hasActiveSessions ? 'text-success' : 'text-secondary'}">${customer.remaining_sessions}</span>
                                    <span class="text-muted">/ ${customer.total_sessions_purchased}</span>
                                </div>
                                <div class="progress" style="width: 100px; height: 8px;">
                                    <div class="progress-bar ${hasActiveSessions ? 'bg-success' : 'bg-secondary'}" 
                                         style="width: ${(customer.remaining_sessions / customer.total_sessions_purchased * 100) || 0}%"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Contact Info -->
                        <div class="small text-muted mb-3">
                            ${customer.contact_phone ? `<div><i class="bi bi-telephone me-1"></i>${this.formatPhone(customer.contact_phone)}</div>` : ''}
                            ${customer.contact_email ? `<div class="text-truncate"><i class="bi bi-envelope me-1"></i>${customer.contact_email}</div>` : ''}
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    renderCustomersList() {
        return `
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Kunde</th>
                                    <th>Registrierungscode</th>
                                    <th>Behandlungen</th>
                                    <th>App Status</th>
                                    <th>Kontakt</th>
                                    <th>Seit</th>
                                    <th>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.filteredCustomers.map(customer => this.renderCustomerRow(customer)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    renderCustomerRow(customer) {
        const hasActiveSessions = customer.remaining_sessions > 0;
        const appStatusBadge = customer.has_app_access ? 
            '<span class="badge bg-success"><i class="bi bi-phone me-1"></i>App Benutzer</span>' :
            '<span class="badge bg-warning"><i class="bi bi-clock me-1"></i>Nicht registriert</span>';

        return `
            <tr class="customer-row" data-customer-id="${customer.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2">
                            <i class="bi bi-person-circle fs-4"></i>
                        </div>
                        <div>
                            <strong>${customer.contact_first_name} ${customer.contact_last_name}</strong>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="registration-code">${customer.registration_code}</span>
                    ${!customer.has_app_access ? `
                        <button class="btn btn-sm btn-link p-0 ms-2" 
                                onclick="customerManagement.copyCode('${customer.registration_code}')"
                                title="Copy code">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    ` : ''}
                </td>
                <td>
                    <div>
                        <span class="badge ${hasActiveSessions ? 'bg-success' : 'bg-secondary'}">
                            ${customer.remaining_sessions}/${customer.total_sessions_purchased} sessions
                        </span>
                    </div>
                </td>
                <td>${appStatusBadge}</td>
                <td>
                    <div class="small">
                        ${customer.contact_phone ? `<div><i class="bi bi-telephone me-1"></i>${this.formatPhone(customer.contact_phone)}</div>` : ''}
                        ${customer.contact_email ? `<div><i class="bi bi-envelope me-1"></i>${customer.contact_email}</div>` : ''}
                    </div>
                </td>
                <td>
                    <small class="text-muted">
                        ${new Date(customer.customer_since || customer.created_at).toLocaleDateString()}
                    </small>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="customerManagement.showCustomerDetails(${customer.id})"
                            title="View Details">
                        <i class="bi bi-eye"></i> Details
                    </button>
                </td>
            </tr>
        `;
    }

    renderModals() {
        return `
            <!-- Add Customer Modal -->
            <div class="modal fade" id="addCustomerModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person-plus me-2"></i>
                                Neuen Kunden hinzufügen
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-customer-form">
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Kunden müssen ein Behandlungspaket kaufen. Sie erhalten einen Registrierungscode für den App-Zugang.
                                </div>
                                
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Vorname <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="customer-first-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Nachname <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="customer-last-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Telefon <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="customer-phone" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Email</label>
                                        <input type="email" class="form-control" id="customer-email">
                                    </div>
                                </div>

                                <hr class="my-4">

                                <h6 class="mb-3">Behandlungspaket <span class="text-danger">*</span></h6>
                                <div class="row g-2">
                                    <div class="col-6 col-md-3">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="sessionPackage" 
                                                   id="new-package-10" value="10" required>
                                            <label class="form-check-label w-100" for="new-package-10">
                                                <strong>10</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="sessionPackage" 
                                                   id="new-package-20" value="20" required checked>
                                            <label class="form-check-label w-100" for="new-package-20">
                                                <strong>20</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="sessionPackage" 
                                                   id="new-package-30" value="30" required>
                                            <label class="form-check-label w-100" for="new-package-30">
                                                <strong>30</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-3">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="sessionPackage" 
                                                   id="new-package-40" value="40" required>
                                            <label class="form-check-label w-100" for="new-package-40">
                                                <strong>40</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mt-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Zahlungsart <span class="text-danger">*</span></label>
                                        <select class="form-select" id="customer-payment-method" required>
                                            <option value="">Methode wählen</option>
                                            <option value="cash">Bar</option>
                                            <option value="card">Karte</option>
                                            <option value="transfer">Banküberweisung</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Notizen</label>
                                        <textarea class="form-control" id="customer-notes" rows="1"></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" onclick="customerManagement.addCustomer()">
                                <i class="bi bi-check-circle me-1"></i>
                                Kunde erstellen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Customer Details Modal -->
            <div class="modal fade" id="customerDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person me-2"></i>
                                Kundendetails
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="customer-details-content">
                            <!-- Content loaded dynamically -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Behandlungen hinzufügen Modal -->
            <div class="modal fade" id="addSessionsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-plus-circle me-2"></i>
                                Behandlungspaket hinzufügen
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-sessions-form">
                                <div class="alert alert-info">
                                    Behandlungen hinzufügen für: <strong id="sessions-customer-name"></strong>
                                </div>
                                
                                <h6 class="mb-3">Paket auswählen <span class="text-danger">*</span></h6>
                                <div class="row g-2">
                                    <div class="col-6">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="addSessionPackage" 
                                                   id="add-package-10" value="10" required>
                                            <label class="form-check-label w-100" for="add-package-10">
                                                <strong>10</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="addSessionPackage" 
                                                   id="add-package-20" value="20" required checked>
                                            <label class="form-check-label w-100" for="add-package-20">
                                                <strong>20</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="addSessionPackage" 
                                                   id="add-package-30" value="30" required>
                                            <label class="form-check-label w-100" for="add-package-30">
                                                <strong>30</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="form-check card p-3 text-center">
                                            <input class="form-check-input" type="radio" name="addSessionPackage" 
                                                   id="add-package-40" value="40" required>
                                            <label class="form-check-label w-100" for="add-package-40">
                                                <strong>40</strong><br>Behandlungen
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-3">
                                    <label class="form-label">Zahlungsart <span class="text-danger">*</span></label>
                                    <select class="form-select" id="add-sessions-payment" required>
                                        <option value="">Methode wählen</option>
                                        <option value="cash">Bar</option>
                                        <option value="card">Karte</option>
                                        <option value="transfer">Banküberweisung</option>
                                    </select>
                                </div>

                                <div class="mt-3">
                                    <label class="form-label">Notizen</label>
                                    <textarea class="form-control" id="add-sessions-notes" rows="2"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" onclick="customerManagement.addSessions()">
                                <i class="bi bi-plus-circle me-1"></i>
                                Behandlungen hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            <!-- Consume Sessions Modal -->
            <div class="modal fade" id="consumeSessionsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-dash-circle me-2"></i>
                                Behandlungen verbrauchen
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="consume-sessions-form">
                                <div class="alert alert-info">
                                    <strong id="consume-remaining">0</strong> Behandlungen verbleiben im aktiven Block
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Zu verbrauchende Behandlungen <span class="text-danger">*</span></label>
                                    <input type="number" class="form-control" id="sessions-to-consume" 
                                           min="1" max="10" value="1" required>
                                    <small class="text-muted">Anzahl der abgeschlossenen Behandlungen eingeben</small>
                                </div>

                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-danger" onclick="customerManagement.consumeSessions()">
                                <i class="bi bi-check-circle me-1"></i>
                                Behandlungen verbrauchen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Refund Sessions Modal -->
            <div class="modal fade" id="refundSessionsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-plus-circle me-2"></i>
                                Behandlungen erstatten
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="refund-sessions-form">
                                <div class="alert alert-warning">
                                    <i class="bi bi-exclamation-triangle me-2"></i>
                                    Dies fügt Behandlungen zurück zum aktiven Block
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Zu erstattende Behandlungen <span class="text-danger">*</span></label>
                                    <input type="number" class="form-control" id="sessions-to-refund" 
                                           min="1" max="10" value="1" required>
                                    <small class="text-muted">Anzahl der zurückzufügenden Behandlungen</small>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Grund <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="refund-reason" required
                                           placeholder="z.B. Termin abgesagt, Fehler beim Verbrauch">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-success" onclick="customerManagement.refundSessions()">
                                <i class="bi bi-check-circle me-1"></i>
                                Behandlungen erstatten
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Edit Contact Modal -->
            <div class="modal fade" id="editContactModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-pencil me-2"></i>
                                Kontaktinformationen bearbeiten
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-contact-form">
                                <div class="mb-3">
                                    <label class="form-label">Vorname <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="edit-first-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Nachname <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="edit-last-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Telefon <span class="text-danger">*</span></label>
                                    <input type="tel" class="form-control" id="edit-phone" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">E-Mail</label>
                                    <input type="email" class="form-control" id="edit-email">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" onclick="customerManagement.updateContact()">
                                <i class="bi bi-check-circle me-1"></i>
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadCustomers(skipInitialUpdate = false) {
        this.isLoading = true;
        
        // Only update UI if not skipping (during init)
        if (!skipInitialUpdate) {
            this.updateUI();
        }

        const studioId = this.getStudioId();
        if (!studioId) {
            console.error('No studio ID for loading customers');
            this.isLoading = false;
            this.updateUI();
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load customers');

            const data = await response.json();
            this.customers = data.customers || [];
            this.filteredCustomers = [...this.customers];
            
            this.updateStatistics();
        } catch (error) {
            console.error('Error loading customers:', error);
            this.showNotification('Fehler beim Laden der Kunden', 'error');
        } finally {
            this.isLoading = false;
            this.updateUI();
        }
    }

    async showCustomerDetails(customerId) {
        try {
            const token = localStorage.getItem('authToken');
            
            // Load customer details with session history
            const customerResponse = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!customerResponse.ok) throw new Error('Failed to load customer details');

            const customerData = await customerResponse.json();
            const customer = customerData.customer;
            const sessionHistory = customerData.session_history || [];

            // Load customer appointments
            let appointments = [];
            try {
                const appointmentsResponse = await fetch(`${window.API_BASE_URL}/api/v1/appointments/customer/${customerId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (appointmentsResponse.ok) {
                    const appointmentsData = await appointmentsResponse.json();
                    appointments = appointmentsData.appointments || [];
                }
            } catch (error) {
                console.error('Error loading appointments:', error);
            }

            // Separate upcoming and past appointments
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingAppointments = appointments.filter(a => new Date(a.appointment_date) >= today);
            const pastAppointments = appointments.filter(a => new Date(a.appointment_date) < today);

            // Load session blocks with full details
            let sessionBlocks = [];
            try {
                const blocksResponse = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/session-blocks`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (blocksResponse.ok) {
                    const blocksData = await blocksResponse.json();
                    sessionBlocks = blocksData.blocks || [];
                }
            } catch (error) {
                console.error('Error loading session blocks:', error);
            }

            // Categorize session blocks properly - only 3 categories
            const activeBlock = sessionBlocks.find(s => s.status === 'active');
            const pendingBlock = sessionBlocks.find(s => s.status === 'pending');
            const historyBlocks = sessionBlocks.filter(s => s.status === 'completed');

            const initials = `${customer.name.split(' ')[0]?.[0]}${customer.name.split(' ')[1]?.[0]}`.toUpperCase();
            
            // Calculate combined remaining sessions from active + pending blocks
            const combinedRemainingSessions = (activeBlock?.remaining_sessions || 0) + (pendingBlock?.remaining_sessions || 0);

            const content = `
                <div class="row g-4">
                    <!-- Customer Header -->
                    <div class="col-12">
                        <div class="detail-section">
                            <div class="d-flex align-items-center">
                                <div class="avatar-large me-4">
                                    ${initials}
                                </div>
                                <div class="flex-grow-1">
                                    <h3 class="mb-2">${customer.name}</h3>
                                    <div class="d-flex gap-3 flex-wrap">
                                        ${customer.has_app_access ? 
                                            '<span class="badge bg-success"><i class="bi bi-phone-fill me-1"></i>App Benutzer</span>' :
                                            '<span class="badge bg-warning"><i class="bi bi-clock me-1"></i>Nicht registriert</span>'}
                                        ${customer.remaining_sessions > 0 ? 
                                            '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktiv</span>' :
                                            '<span class="badge bg-secondary">Inaktiv</span>'}
                                        <span class="text-muted">Kunde seit ${new Date(customer.customer_since).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Contact & Registration Info -->
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body">
                                <h5 class="card-title mb-3">
                                    <i class="bi bi-person-lines-fill me-2"></i>Kontaktinformationen
                                    <button class="btn btn-sm btn-outline-primary ms-2" onclick="customerManagement.showEditContactModal(${customer.id})">
                                        <i class="bi bi-pencil"></i> Bearbeiten
                                    </button>
                                </h5>
                                <div class="mb-3">
                                    <label class="text-muted small">Telefon</label>
                                    <div class="fw-medium">${customer.phone || 'Nicht angegeben'}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="text-muted small">E-Mail</label>
                                    <div class="fw-medium">${customer.email || 'Nicht angegeben'}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="text-muted small">Registrierungscode</label>
                                    <div class="d-flex align-items-center">
                                        <span class="registration-code me-2">${customer.registration_code}</span>
                                        ${!customer.has_app_access ? `
                                            <button class="btn btn-sm btn-link p-0" 
                                                    onclick="customerManagement.copyCode('${customer.registration_code}')"
                                                    title="Copy code">
                                                <i class="bi bi-clipboard"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Session Blocks -->
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="card-title mb-0">
                                        <i class="bi bi-box-seam me-2"></i>Behandlungsblöcke
                                    </h5>
                                    ${!pendingBlock ? `
                                        <button class="btn btn-sm btn-outline-primary" onclick="customerManagement.showAddSessionsModal(${customer.id})">
                                            <i class="bi bi-plus"></i> Wartenden Block hinzufügen
                                        </button>
                                    ` : `
                                        <button class="btn btn-sm btn-outline-danger" onclick="customerManagement.deletePendingBlock(${customer.id}, ${pendingBlock.id})">
                                            <i class="bi bi-trash"></i> Wartenden Block löschen
                                        </button>
                                    `}
                                </div>
                                <!-- ACTIVE BLOCK (Most Prominent) -->
                                ${activeBlock ? `
                                    <div class="session-block position-relative mb-3" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
                                        <div class="dropdown position-absolute" style="top: 8px; right: 8px; z-index: 10;">
                                            <button class="btn btn-sm btn-link text-white p-1" type="button" data-bs-toggle="dropdown" style="line-height: 1;">
                                                <i class="bi bi-three-dots-vertical"></i>
                                            </button>
                                            <ul class="dropdown-menu">
                                                <li>
                                                    <a class="dropdown-item" href="#" onclick="event.preventDefault(); customerManagement.showConsumeSessionsModal(${customer.id}, ${activeBlock.id}, ${activeBlock.remaining_sessions})">
                                                        <i class="bi bi-dash-circle me-2"></i>Behandlungen verbrauchen
                                                    </a>
                                                </li>
                                                <li>
                                                    <a class="dropdown-item" href="#" onclick="event.preventDefault(); customerManagement.showRefundSessionsModal(${customer.id}, ${activeBlock.id})">
                                                        <i class="bi bi-plus-circle me-2"></i>Behandlungen erstatten
                                                    </a>
                                                </li>
                                                ${activeBlock.used_sessions === 0 ? `
                                                    <li><hr class="dropdown-divider"></li>
                                                    <li>
                                                        <a class="dropdown-item text-danger" href="#" onclick="event.preventDefault(); customerManagement.deleteSessionBlock(${customer.id}, ${activeBlock.id})">
                                                            <i class="bi bi-trash me-2"></i>Block löschen
                                                        </a>
                                                    </li>
                                                ` : ''}
                                            </ul>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <span class="badge bg-white text-success me-2 fw-bold">AKTIV</span>
                                                <strong>${activeBlock.total_sessions} Behandlungen</strong>
                                            </div>
                                            <div class="text-end">
                                                <div class="fs-4 fw-bold">${activeBlock.remaining_sessions}</div>
                                                <small>Verbleibend</small>
                                            </div>
                                        </div>
                                        <div class="progress mt-2" style="height: 8px;">
                                            <div class="progress-bar bg-white" 
                                                 style="width: ${(activeBlock.remaining_sessions / activeBlock.total_sessions * 100)}%"></div>
                                        </div>
                                        <div class="d-flex justify-content-between mt-2">
                                            <small>Gekauft: ${new Date(activeBlock.purchase_date).toLocaleDateString()}</small>
                                            <small>Verbraucht: ${activeBlock.used_sessions || 0} Behandlungen</small>
                                        </div>
                                    </div>
                                ` : ''}
                                
                                <!-- PENDING BLOCK (Secondary Prominence) -->
                                ${pendingBlock ? `
                                    <div class="session-block position-relative mb-3" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);">
                                        <div class="dropdown position-absolute" style="top: 8px; right: 8px; z-index: 10;">
                                            <button class="btn btn-sm btn-link text-white p-1" type="button" disabled style="line-height: 1; opacity: 0.5;">
                                                <i class="bi bi-three-dots-vertical"></i>
                                            </button>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <span class="badge bg-white text-warning me-2 fw-bold">WARTEND</span>
                                                <strong>${pendingBlock.total_sessions} Behandlungen</strong>
                                            </div>
                                            <div class="text-end">
                                                <div class="fs-5 fw-bold">${pendingBlock.remaining_sessions}</div>
                                                <small>Bereit zur Aktivierung</small>
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-between mt-2">
                                            <small>Gekauft: ${new Date(pendingBlock.purchase_date).toLocaleDateString()}</small>
                                            <small>Zahlung: ${pendingBlock.payment_method || 'Unbekannt'}</small>
                                        </div>
                                    </div>
                                ` : ''}
                                
                                <!-- HISTORY BLOCKS (Minimal Display) -->
                                ${historyBlocks.length > 0 ? `
                                    <div class="mt-3">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <small class="text-muted">Verlauf</small>
                                            <button class="btn btn-sm btn-link text-muted p-0" type="button" data-bs-toggle="collapse" data-bs-target="#historyBlocks${customer.id}">
                                                <small>${historyBlocks.length} abgeschlossene anzeigen</small>
                                            </button>
                                        </div>
                                        <div class="collapse" id="historyBlocks${customer.id}">
                                            ${historyBlocks.map(block => `
                                                <div class="d-flex justify-content-between text-muted small py-1 border-bottom">
                                                    <span>${block.total_sessions} Behandlungen • Abgeschlossen</span>
                                                    <span>${new Date(block.purchase_date).toLocaleDateString()}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${!activeBlock && !pendingBlock ? '<div class="alert alert-info mb-3"><i class="bi bi-info-circle me-2"></i>Keine aktiven Behandlungsblöcke. Fügen Sie Behandlungen hinzu, um zu beginnen.</div>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Upcoming Appointments -->
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="card-title mb-0">
                                        <i class="bi bi-calendar-event me-2"></i>Bevorstehende Termine
                                    </h5>
                                    ${upcomingAppointments.length > 3 ? `
                                        <button class="btn btn-sm btn-link text-muted p-0" type="button" data-bs-toggle="collapse" data-bs-target="#upcomingAppointments${customer.id}">
                                            <small>Alle ${upcomingAppointments.length} anzeigen</small>
                                        </button>
                                    ` : ''}
                                </div>
                                ${upcomingAppointments.length > 0 ? `
                                    <div class="appointments-list">
                                        ${upcomingAppointments.slice(0, 3).map(apt => `
                                            <div class="appointment-item">
                                                <div class="d-flex justify-content-between">
                                                    <div>
                                                        <strong>${new Date(apt.appointment_date).toLocaleDateString()}</strong>
                                                        <div class="text-muted small">${apt.appointment_time || 'Zeit folgt'}</div>
                                                    </div>
                                                    <div>
                                                        <span class="badge bg-${apt.status === 'confirmed' ? 'success' : 'warning'}">
                                                            ${apt.status === 'confirmed' ? 'Bestätigt' : apt.status === 'pending' ? 'Ausstehend' : apt.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                        ${upcomingAppointments.length > 3 ? `
                                            <div class="collapse" id="upcomingAppointments${customer.id}">
                                                ${upcomingAppointments.slice(3).map(apt => `
                                                    <div class="appointment-item">
                                                        <div class="d-flex justify-content-between">
                                                            <div>
                                                                <strong>${new Date(apt.appointment_date).toLocaleDateString()}</strong>
                                                                <div class="text-muted small">${apt.appointment_time || 'Zeit folgt'}</div>
                                                            </div>
                                                            <div>
                                                                <span class="badge bg-${apt.status === 'confirmed' ? 'success' : 'warning'}">
                                                                    ${apt.status === 'confirmed' ? 'Bestätigt' : apt.status === 'pending' ? 'Ausstehend' : apt.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : '<p class="text-muted mb-0">Keine bevorstehenden Termine</p>'}
                            </div>
                        </div>
                    </div>

                    <!-- Appointment History -->
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="card-title mb-0">
                                        <i class="bi bi-clock-history me-2"></i>Terminverlauf
                                    </h5>
                                    ${pastAppointments.length > 3 ? `
                                        <button class="btn btn-sm btn-link text-muted p-0" type="button" data-bs-toggle="collapse" data-bs-target="#pastAppointments${customer.id}">
                                            <small>Alle ${pastAppointments.length} anzeigen</small>
                                        </button>
                                    ` : ''}
                                </div>
                                ${pastAppointments.length > 0 ? `
                                    <div class="appointments-list">
                                        ${pastAppointments.slice(0, 3).map(apt => `
                                            <div class="appointment-item past">
                                                <div class="d-flex justify-content-between">
                                                    <div>
                                                        <strong>${new Date(apt.appointment_date).toLocaleDateString()}</strong>
                                                        <div class="text-muted small">${apt.appointment_time || 'Abgeschlossen'}</div>
                                                    </div>
                                                    <div>
                                                        <span class="badge bg-secondary">
                                                            ${apt.status === 'completed' ? 'Abgeschlossen' : apt.status === 'cancelled' ? 'Abgesagt' : apt.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                        ${pastAppointments.length > 3 ? `
                                            <div class="collapse" id="pastAppointments${customer.id}">
                                                ${pastAppointments.slice(3).map(apt => `
                                                    <div class="appointment-item past">
                                                        <div class="d-flex justify-content-between">
                                                            <div>
                                                                <strong>${new Date(apt.appointment_date).toLocaleDateString()}</strong>
                                                                <div class="text-muted small">${apt.appointment_time || 'Abgeschlossen'}</div>
                                                            </div>
                                                            <div>
                                                                <span class="badge bg-secondary">
                                                                    ${apt.status === 'completed' ? 'Abgeschlossen' : apt.status === 'cancelled' ? 'Abgesagt' : apt.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="text-center mt-3">
                                        <small class="text-muted">Termine insgesamt: ${pastAppointments.length}</small>
                                    </div>
                                ` : '<p class="text-muted mb-0">Kein Terminverlauf</p>'}
                            </div>
                        </div>
                    </div>

                    <!-- Statistics -->
                    <div class="col-12">
                        <div class="card border-0 shadow-sm">
                            <div class="card-body">
                                <h5 class="card-title mb-3">
                                    <i class="bi bi-graph-up me-2"></i>Statistiken
                                </h5>
                                <div class="row text-center">
                                    <div class="col-md-3">
                                        <div class="fs-3 fw-bold text-primary">${customer.total_sessions_purchased}</div>
                                        <small class="text-muted">Behandlungen Gesamt</small>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="fs-3 fw-bold text-success">${combinedRemainingSessions}</div>
                                        <small class="text-muted">Behandlungen Verbleibend</small>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="fs-3 fw-bold text-primary">${customer.stats?.total_appointments || 0}</div>
                                        <small class="text-muted">Termine Gesamt</small>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="fs-3 fw-bold text-warning">${customer.stats?.upcoming_appointments || 0}</div>
                                        <small class="text-muted">Bevorstehend</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Ensure modal exists before trying to use it
            this.ensureModalsExist();
            
            const modalContent = document.getElementById('customer-details-content');
            if (!modalContent) {
                console.error('customer-details-content element not found, creating modal structure');
                // Force create the modal if it doesn't exist
                const modalHTML = `
                    <div class="modal fade" id="customerDetailsModal" tabindex="-1">
                        <div class="modal-dialog modal-xl">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">
                                        <i class="bi bi-person me-2"></i>
                                        Kundendetails
                                    </h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body" id="customer-details-content">
                                    <!-- Content loaded dynamically -->
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Remove existing modal if any
                const existingModal = document.getElementById('customerDetailsModal');
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Add new modal to body
                document.body.insertAdjacentHTML('beforeend', modalHTML);
            }
            
            // Now set the content
            document.getElementById('customer-details-content').innerHTML = content;
            
            const modal = new bootstrap.Modal(document.getElementById('customerDetailsModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading customer details:', error);
            this.showNotification('Fehler beim Laden der Kundendetails', 'error');
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button classes immediately
        const cardBtn = document.querySelector('button[onclick="customerManagement.setViewMode(\'cards\')"]');
        const listBtn = document.querySelector('button[onclick="customerManagement.setViewMode(\'list\')"]');
        
        if (cardBtn && listBtn) {
            // Remove active class from both
            cardBtn.classList.remove('view-active');
            listBtn.classList.remove('view-active');
            
            // Add active class to selected button
            if (mode === 'cards') {
                cardBtn.classList.add('view-active');
            } else {
                listBtn.classList.add('view-active');
            }
        }
        
        this.updateUI();
    }

    setupEventListeners() {
        console.log('Event listeners set up');
    }

    searchCustomers(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    filterByStatus(status) {
        this.filterStatus = status;
        this.applyFilters();
    }

    applyFilters() {
        this.filteredCustomers = this.customers.filter(customer => {
            // Search filter
            if (this.searchQuery) {
                const searchMatch = 
                    customer.contact_first_name?.toLowerCase().includes(this.searchQuery) ||
                    customer.contact_last_name?.toLowerCase().includes(this.searchQuery) ||
                    customer.contact_phone?.includes(this.searchQuery) ||
                    customer.contact_email?.toLowerCase().includes(this.searchQuery) ||
                    customer.registration_code?.toLowerCase().includes(this.searchQuery);
                
                if (!searchMatch) return false;
            }

            // Status filter
            if (this.filterStatus !== 'all') {
                switch (this.filterStatus) {
                    case 'active_sessions':
                        if (customer.remaining_sessions <= 0) return false;
                        break;
                }
            }

            return true;
        });

        this.updateUI();
    }

    showAddCustomerModal() {
        const modalElement = document.getElementById('addCustomerModal');
        
        if (!modalElement) {
            const currentStudioId = this.getStudioId();
            this.render();
            this.setupEventListeners();
            this.studioId = currentStudioId;
            this._studioId = currentStudioId;
            
            setTimeout(() => {
                const retryModal = document.getElementById('addCustomerModal');
                if (retryModal) {
                    const modal = new bootstrap.Modal(retryModal);
                    modal.show();
                }
            }, 100);
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }

    async addCustomer() {
        const firstName = document.getElementById('customer-first-name').value.trim();
        const lastName = document.getElementById('customer-last-name').value.trim();
        const phone = document.getElementById('customer-phone').value.trim();
        const email = document.getElementById('customer-email').value.trim();
        const sessionPackage = document.querySelector('input[name="sessionPackage"]:checked')?.value;
        const paymentMethod = document.getElementById('customer-payment-method').value;
        const notes = document.getElementById('customer-notes').value.trim();

        if (!firstName || !lastName || !phone || !sessionPackage || !paymentMethod) {
            this.showNotification('Bitte füllen Sie alle Pflichtfelder aus', 'error');
            return;
        }

        const studioId = this.getStudioId();
        if (!studioId) {
            console.error('Studio ID not set in CustomerManagement');
            this.showNotification('Studio-ID nicht gesetzt. Bitte laden Sie die Seite neu.', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    phone,
                    email: email || null,
                    sessionPackage: parseInt(sessionPackage),
                    paymentMethod,
                    notes: notes || null
                })
            });

            if (!response.ok) throw new Error('Failed to create customer');

            const result = await response.json();
            
            this.showNotification(
                `Customer created! Registration code: ${result.customer.registration_code}`,
                'success'
            );

            this.copyCode(result.customer.registration_code);

            const modal = bootstrap.Modal.getInstance(document.getElementById('addCustomerModal'));
            modal.hide();
            document.getElementById('add-customer-form').reset();

            await this.loadCustomers();
        } catch (error) {
            console.error('Error creating customer:', error);
            this.showNotification('Fehler beim Erstellen des Kunden', 'error');
        }
    }

    showAddSessionsModal(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        this.selectedCustomer = customer;
        document.getElementById('sessions-customer-name').textContent = 
            `${customer.contact_first_name || customer.name?.split(' ')[0]} ${customer.contact_last_name || customer.name?.split(' ')[1]}`;
        
        const modal = new bootstrap.Modal(document.getElementById('addSessionsModal'));
        modal.show();
    }

    async addSessions() {
        const sessionPackage = document.querySelector('input[name="addSessionPackage"]:checked')?.value;
        const paymentMethod = document.getElementById('add-sessions-payment').value;
        const notes = document.getElementById('add-sessions-notes').value.trim();

        if (!sessionPackage || !paymentMethod) {
            this.showNotification('Bitte wählen Sie Paket und Zahlungsart aus', 'error');
            return;
        }

        // Disable the submit button to prevent double submission
        const submitBtn = document.querySelector('#addSessionsModal .btn-primary');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding...';

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${this.selectedCustomer.id}/sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    total_sessions: parseInt(sessionPackage),
                    payment_method: paymentMethod,
                    notes: notes || null
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to add sessions');
            }

            const result = await response.json();
            
            // Close modal first
            const modal = bootstrap.Modal.getInstance(document.getElementById('addSessionsModal'));
            if (modal) {
                modal.hide();
            }
            
            // Show success notification
            this.showNotification(result.message || `${sessionPackage} Behandlungen erfolgreich hinzugefügt`, 'success');
            
            // Reset form
            const form = document.getElementById('add-sessions-form');
            if (form) {
                form.reset();
            }

            // Reload customers list
            await this.loadCustomers();
            
            // If customer details modal is open, refresh it immediately
            const detailsModal = document.getElementById('customerDetailsModal');
            if (detailsModal && detailsModal.classList.contains('show')) {
                await this.showCustomerDetails(this.selectedCustomer.id);
            }
            
            // Update main UI
            this.updateUI();
            
        } catch (error) {
            console.error('Error adding sessions:', error);
            this.showNotification(error.message || 'Fehler beim Hinzufügen der Behandlungen', 'error');
        } finally {
            // Re-enable the button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    copyCode(code) {
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(code).then(() => {
                this.showNotification(`Code ${code} in Zwischenablage kopiert!`, 'success');
            }).catch(err => {
                console.warn('Clipboard API failed, using fallback:', err.message);
                this.fallbackCopyCode(code);
            });
        } else {
            // Use fallback for non-secure contexts or older browsers
            this.fallbackCopyCode(code);
        }
    }
    
    fallbackCopyCode(code) {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification(`Code ${code} in Zwischenablage kopiert!`, 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showNotification(`Registration code: ${code} (copy manually)`, 'info');
        }
        
        document.body.removeChild(textArea);
    }

    updateStatistics() {
        const stats = {
            total: this.customers.length,
            active: this.customers.filter(c => c.remaining_sessions > 0).length
        };

        // Check if elements exist before updating
        const totalEl = document.getElementById('stat-total');
        const activeEl = document.getElementById('stat-active');

        if (totalEl) totalEl.textContent = stats.total;
        if (activeEl) activeEl.textContent = stats.active;
    }

    updateUI() {
        // Debounce rapid updates
        if (this._updateUITimeout) {
            clearTimeout(this._updateUITimeout);
        }
        
        this._updateUITimeout = setTimeout(() => {
            const container = document.getElementById('customers-container');
            if (container) {
                try {
                    container.innerHTML = this.renderCustomers();
                } catch (error) {
                    console.error('Error rendering customers:', error);
                    container.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Fehler beim Anzeigen der Kunden. Bitte laden Sie die Seite neu.
                        </div>
                    `;
                }
            }
            this.updateStatistics();
        }, 50); // Small delay to batch updates
    }

    formatPhone(phone) {
        if (phone.startsWith('+49')) {
            return phone.replace(/(\+49)(\d{3})(\d+)/, '$1 $2 $3');
        }
        return phone;
    }

    showNotification(message, type = 'info') {
        const alertClass = type === 'error' ? 'danger' : type;
        const notification = document.createElement('div');
        notification.className = `alert alert-${alertClass} position-fixed top-0 end-0 m-3`;
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi bi-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Session Block Management Functions
    
    showConsumeSessionsModal(customerId, blockId, remaining) {
        this.currentCustomerId = customerId;
        this.currentBlockId = blockId;
        
        document.getElementById('consume-remaining').textContent = remaining;
        document.getElementById('sessions-to-consume').max = Math.min(10, remaining);
        document.getElementById('sessions-to-consume').value = 1;
        
        const modal = new bootstrap.Modal(document.getElementById('consumeSessionsModal'));
        modal.show();
    }

    async consumeSessions() {
        const sessionsToConsume = parseInt(document.getElementById('sessions-to-consume').value);

        if (!sessionsToConsume || sessionsToConsume < 1) {
            this.showNotification('Bitte geben Sie eine gültige Anzahl von Behandlungen ein', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${this.currentCustomerId}/consume-sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessions_to_consume: sessionsToConsume,
                    reason: 'Behandlung verbraucht'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to consume sessions');
            }

            const result = await response.json();
            this.showNotification(result.message, 'success');

            // Close modal and refresh
            const modal = bootstrap.Modal.getInstance(document.getElementById('consumeSessionsModal'));
            modal.hide();
            document.getElementById('consume-sessions-form').reset();

            // Refresh the customer details modal
            setTimeout(() => {
                this.showCustomerDetails(this.currentCustomerId);
            }, 500);

        } catch (error) {
            console.error('Error consuming sessions:', error);
            this.showNotification(error.message || 'Fehler beim Verbrauchen der Behandlungen', 'error');
        }
    }

    showRefundSessionsModal(customerId, blockId) {
        this.currentCustomerId = customerId;
        this.currentBlockId = blockId;
        
        document.getElementById('sessions-to-refund').value = 1;
        
        const modal = new bootstrap.Modal(document.getElementById('refundSessionsModal'));
        modal.show();
    }

    async refundSessions() {
        const sessionsToRefund = parseInt(document.getElementById('sessions-to-refund').value);
        const reason = document.getElementById('refund-reason').value.trim();

        if (!sessionsToRefund || sessionsToRefund < 1) {
            this.showNotification('Bitte geben Sie eine gültige Anzahl von Behandlungen ein', 'error');
            return;
        }

        if (!reason) {
            this.showNotification('Bitte geben Sie einen Grund für die Erstattung an', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${this.currentCustomerId}/refund-sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessions_to_refund: sessionsToRefund,
                    block_id: this.currentBlockId,
                    reason
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to refund sessions');
            }

            const result = await response.json();
            this.showNotification(result.message, 'success');

            // Close modal and refresh
            const modal = bootstrap.Modal.getInstance(document.getElementById('refundSessionsModal'));
            modal.hide();
            document.getElementById('refund-sessions-form').reset();

            // Refresh the customer details modal
            setTimeout(() => {
                this.showCustomerDetails(this.currentCustomerId);
            }, 500);

        } catch (error) {
            console.error('Error refunding sessions:', error);
            this.showNotification(error.message || 'Fehler beim Erstatten der Behandlungen', 'error');
        }
    }

    async deleteSessionBlock(customerId, blockId) {
        // Get block details for better confirmation dialog
        const customer = this.customers.find(c => c.id === customerId);
        const customerName = customer ? customer.name : `Customer ${customerId}`;
        
        const confirmMessage = `⚠️ DELETE SESSION BLOCK\n\n` +
                              `Customer: ${customerName}\n` +
                              `Block ID: ${blockId}\n\n` +
                              `This will permanently delete the UNUSED session block.\n` +
                              `Only blocks with 0 consumed sessions can be deleted.\n\n` +
                              `⚠️ This action CANNOT be undone!\n\n` +
                              `Are you sure you want to proceed?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/session-blocks/${blockId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                
                // Better error handling for 404s
                if (response.status === 404) {
                    throw new Error(`Session block not found. It may have already been deleted or doesn't exist.`);
                }
                
                throw new Error(error.message || 'Failed to delete session block');
            }

            const result = await response.json();
            this.showNotification(result.message, 'success');

            // Refresh the customer details modal
            setTimeout(() => {
                this.showCustomerDetails(customerId);
            }, 500);

            // Also refresh the main customer list
            await this.loadCustomers();

        } catch (error) {
            console.error('Error deleting session block:', error);
            this.showNotification(error.message || 'Fehler beim Löschen des Behandlungsblocks', 'error');
        }
    }

    async deletePendingBlock(customerId, blockId) {
        if (!confirm('Sind Sie sicher, dass Sie diesen wartenden Block löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/session-blocks/${blockId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete pending block');
            }

            const result = await response.json();
            this.showNotification(result.message || 'Wartender Block erfolgreich gelöscht', 'success');

            // Refresh customer details immediately
            await this.showCustomerDetails(customerId);
            
            // Refresh main customer list
            await this.loadCustomers();
            this.updateUI();

        } catch (error) {
            console.error('Error deleting session block:', error);
            this.showNotification('Fehler beim Löschen des Behandlungsblocks: ' + error.message, 'error');
        }
    }

    showEditContactModal(customerId) {
        const customer = this.customers.find(c => c.id === customerId) || 
                        { contact_first_name: '', contact_last_name: '', contact_phone: '', contact_email: '' };
        
        this.currentCustomerId = customerId;
        
        // Pre-fill the form
        document.getElementById('edit-first-name').value = customer.contact_first_name || customer.name?.split(' ')[0] || '';
        document.getElementById('edit-last-name').value = customer.contact_last_name || customer.name?.split(' ')[1] || '';
        document.getElementById('edit-phone').value = customer.contact_phone || customer.phone || '';
        document.getElementById('edit-email').value = customer.contact_email || customer.email || '';
        
        const modal = new bootstrap.Modal(document.getElementById('editContactModal'));
        modal.show();
    }

    async updateContact() {
        const firstName = document.getElementById('edit-first-name').value.trim();
        const lastName = document.getElementById('edit-last-name').value.trim();
        const phone = document.getElementById('edit-phone').value.trim();
        const email = document.getElementById('edit-email').value.trim();

        if (!firstName || !lastName || !phone) {
            this.showNotification('Bitte füllen Sie alle Pflichtfelder aus', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${this.currentCustomerId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contact_first_name: firstName,
                    contact_last_name: lastName,
                    contact_phone: phone,
                    contact_email: email || null
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update contact');
            }

            const result = await response.json();
            this.showNotification(result.message || 'Kontaktinformationen erfolgreich aktualisiert', 'success');

            // Close modal and refresh
            const modal = bootstrap.Modal.getInstance(document.getElementById('editContactModal'));
            modal.hide();
            document.getElementById('edit-contact-form').reset();

            // Refresh customer details modal and main list
            await this.loadCustomers();
            setTimeout(() => {
                this.showCustomerDetails(this.currentCustomerId);
            }, 500);

        } catch (error) {
            console.error('Error updating contact:', error);
            this.showNotification(error.message || 'Fehler beim Aktualisieren der Kontaktinformationen', 'error');
        }
    }

}

// Global instance will be created when needed
// window.customerManagement = new CustomerManagement();