class GoogleSheetsConnectionModal {
    constructor() {
        this.modal = null;
        this.currentStudio = null;
        this.previewData = null;
        this.columnMapping = {};
        this.isConnecting = false;
    }

    // Show the connection modal for a specific studio
    show(studio) {
        this.currentStudio = studio;
        this.previewData = null;
        this.columnMapping = {};
        this.isConnecting = false;
        
        this.createModal();
        this.modal.show();
        
        // Reset form
        document.getElementById('sheet-url-input').value = '';
        this.updateStep(1);
    }

    // Hide the modal
    hide() {
        if (this.modal) {
            this.modal.hide();
        }
    }

    // Create the modal HTML structure
    createModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('google-sheets-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="google-sheets-modal" tabindex="-1" aria-labelledby="googleSheetsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="googleSheetsModalLabel">
                                <i class="bi bi-table me-2"></i>
                                Connect Google Sheet to ${this.currentStudio?.name || 'Studio'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Step 1: Enter Sheet URL -->
                            <div id="step-1" class="connection-step">
                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">Step 1: Enter Google Sheets URL</h6>
                                    <div class="mb-3">
                                        <label for="sheet-url-input" class="form-label">Google Sheets URL</label>
                                        <input type="url" class="form-control" id="sheet-url-input" 
                                               placeholder="https://docs.google.com/spreadsheets/d/..." 
                                               onchange="googleSheetsModal.validateUrl()">
                                        <div class="form-text">
                                            Paste the URL of your Google Sheet. Make sure it's shared with view access.
                                        </div>
                                        <div id="url-validation-feedback" class="invalid-feedback"></div>
                                    </div>
                                    <button type="button" class="btn btn-primary" id="preview-btn" 
                                            onclick="googleSheetsModal.previewSheet()" disabled>
                                        <i class="bi bi-eye me-2"></i>Preview Sheet Data
                                    </button>
                                </div>
                            </div>

                            <!-- Step 2: Preview and Column Mapping -->
                            <div id="step-2" class="connection-step d-none">
                                <div class="mb-4">
                                    <h6 class="fw-bold mb-3">Step 2: Map Columns</h6>
                                    <div class="alert alert-info">
                                        <i class="bi bi-info-circle me-2"></i>
                                        Map your sheet columns to lead fields. Name and Phone are required.
                                    </div>
                                    
                                    <div id="column-mapping-section">
                                        <!-- Column mapping will be populated here -->
                                    </div>

                                    <div class="mt-3">
                                        <h6>Sheet Preview</h6>
                                        <div id="sheet-preview" class="table-responsive">
                                            <!-- Preview table will be populated here -->
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Step 3: Connection Status -->
                            <div id="step-3" class="connection-step d-none">
                                <div id="connection-status">
                                    <!-- Connection status will be shown here -->
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary d-none" id="connect-btn" 
                                    onclick="googleSheetsModal.connectSheet()">
                                <i class="bi bi-link me-2"></i>Connect Sheet
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Initialize Bootstrap modal
        this.modal = new bootstrap.Modal(document.getElementById('google-sheets-modal'));
    }

    // Validate Google Sheets URL
    validateUrl() {
        const urlInput = document.getElementById('sheet-url-input');
        const previewBtn = document.getElementById('preview-btn');
        const feedback = document.getElementById('url-validation-feedback');
        
        const url = urlInput.value.trim();
        
        if (!url) {
            previewBtn.disabled = true;
            urlInput.classList.remove('is-valid', 'is-invalid');
            return;
        }

        const isValid = window.managerAPI.validateGoogleSheetsUrl(url);
        
        if (isValid) {
            urlInput.classList.remove('is-invalid');
            urlInput.classList.add('is-valid');
            previewBtn.disabled = false;
            feedback.textContent = '';
        } else {
            urlInput.classList.remove('is-valid');
            urlInput.classList.add('is-invalid');
            previewBtn.disabled = true;
            feedback.textContent = 'Please enter a valid Google Sheets URL';
        }
    }

    // Preview sheet data
    async previewSheet() {
        if (this.isConnecting) return;

        const urlInput = document.getElementById('sheet-url-input');
        const previewBtn = document.getElementById('preview-btn');
        const url = urlInput.value.trim();

        if (!url) return;

        try {
            // Show loading state
            previewBtn.disabled = true;
            previewBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Loading...';

            // Get sheet preview
            const response = await window.managerAPI.previewGoogleSheet(url);
            this.previewData = response.preview;

            // Show step 2
            this.updateStep(2);
            this.renderColumnMapping();
            this.renderPreview();

        } catch (error) {
            console.error('Error previewing sheet:', error);
            this.showError('Failed to preview sheet. Please check the URL and make sure the sheet is shared with view access.');
        } finally {
            previewBtn.disabled = false;
            previewBtn.innerHTML = '<i class="bi bi-eye me-2"></i>Preview Sheet Data';
        }
    }

    // Render column mapping interface
    renderColumnMapping() {
        if (!this.previewData) return;

        const container = document.getElementById('column-mapping-section');
        const headers = this.previewData.headers || [];

        const mappingFields = [
            { key: 'name', label: 'Name', required: true },
            { key: 'phone_number', label: 'Phone Number', required: true },
            { key: 'email', label: 'Email', required: false },
            { key: 'notes', label: 'Notes', required: false }
        ];

        let mappingHtml = '<div class="row">';

        mappingFields.forEach(field => {
            mappingHtml += `
                <div class="col-md-6 mb-3">
                    <label for="mapping-${field.key}" class="form-label">
                        ${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    <select class="form-select" id="mapping-${field.key}" 
                            onchange="googleSheetsModal.updateMapping('${field.key}', this.value)">
                        <option value="">-- Select Column --</option>
                        ${headers.map(header => 
                            `<option value="${header}">${header}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        });

        mappingHtml += '</div>';
        container.innerHTML = mappingHtml;

        // Auto-map common column names
        this.autoMapColumns(headers);
    }

    // Auto-map common column names
    autoMapColumns(headers) {
        const commonMappings = {
            name: ['name', 'full name', 'customer name', 'lead name', 'person'],
            phone_number: ['phone', 'phone number', 'mobile', 'telephone', 'contact'],
            email: ['email', 'email address', 'e-mail'],
            notes: ['notes', 'comments', 'remarks', 'additional info']
        };

        Object.entries(commonMappings).forEach(([field, variations]) => {
            const select = document.getElementById(`mapping-${field}`);
            if (!select) return;

            const matchedHeader = headers.find(header => 
                variations.some(variation => 
                    header.toLowerCase().includes(variation.toLowerCase())
                )
            );

            if (matchedHeader) {
                select.value = matchedHeader;
                this.columnMapping[field] = matchedHeader;
            }
        });

        this.validateMapping();
    }

    // Update column mapping
    updateMapping(field, column) {
        if (column) {
            this.columnMapping[field] = column;
        } else {
            delete this.columnMapping[field];
        }
        this.validateMapping();
    }

    // Validate column mapping
    validateMapping() {
        const requiredFields = ['name', 'phone_number'];
        const isValid = requiredFields.every(field => this.columnMapping[field]);
        
        const connectBtn = document.getElementById('connect-btn');
        if (connectBtn) {
            connectBtn.disabled = !isValid;
            if (isValid) {
                connectBtn.classList.remove('d-none');
            }
        }
    }

    // Render sheet preview
    renderPreview() {
        const container = document.getElementById('sheet-preview');
        
        if (!this.previewData || !this.previewData.headers) {
            container.innerHTML = '<p class="text-muted">No preview data available</p>';
            return;
        }

        const { headers, sampleData: rows } = this.previewData;

        let tableHtml = `
            <table class="table table-sm table-bordered">
                <thead class="table-light">
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        if (rows && rows.length > 0) {
            rows.slice(0, 5).forEach(row => {
                tableHtml += `
                    <tr>
                        ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="${headers.length}" class="text-center text-muted">No data available</td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
            <small class="text-muted">Showing first 5 rows</small>
        `;

        container.innerHTML = tableHtml;
    }

    // Connect the sheet
    async connectSheet() {
        if (this.isConnecting) return;

        try {
            this.isConnecting = true;
            this.updateStep(3);
            
            const statusContainer = document.getElementById('connection-status');
            statusContainer.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Connecting...</span>
                    </div>
                    <p class="mt-2">Connecting your Google Sheet...</p>
                </div>
            `;

            const url = document.getElementById('sheet-url-input').value.trim();
            
            const response = await window.managerAPI.connectGoogleSheet(
                this.currentStudio.id,
                url,
                this.columnMapping,
                false // No auto-sync
            );

            // Show success
            statusContainer.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle me-2"></i>
                    <strong>Success!</strong> Google Sheet connected successfully.
                    <br>
                    <small>Imported ${response.importResults?.imported || 0} leads from your sheet.</small>
                </div>
            `;

            // Reload studios data in parent dashboard
            if (window.managerDashboard && typeof window.managerDashboard.loadStudioData === 'function') {
                setTimeout(() => {
                    window.managerDashboard.loadStudioData();
                }, 1000);
            }

            // Auto-close modal after 2 seconds
            setTimeout(() => {
                this.hide();
            }, 2000);

        } catch (error) {
            console.error('Error connecting sheet:', error);
            const statusContainer = document.getElementById('connection-status');
            statusContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong>Connection Failed</strong>
                    <br>
                    ${error.message || 'An unexpected error occurred. Please try again.'}
                </div>
            `;
        } finally {
            this.isConnecting = false;
        }
    }

    // Update step display
    updateStep(step) {
        // Hide all steps
        document.querySelectorAll('.connection-step').forEach(el => {
            el.classList.add('d-none');
        });

        // Show current step
        const currentStep = document.getElementById(`step-${step}`);
        if (currentStep) {
            currentStep.classList.remove('d-none');
        }
    }

    // Show error message
    showError(message) {
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Insert at the beginning of modal body
        const modalBody = document.querySelector('#google-sheets-modal .modal-body');
        if (modalBody) {
            modalBody.insertAdjacentHTML('afterbegin', alertHtml);
        }
    }
}

// Create global instance
window.googleSheetsModal = new GoogleSheetsConnectionModal();