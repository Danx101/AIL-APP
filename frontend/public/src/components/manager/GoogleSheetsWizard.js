// Google Sheets Connection Wizard - 5 Step Process
class GoogleSheetsWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 5;
        this.wizardData = {
            sheetUrl: '',
            sheetId: '',
            sheetInfo: null,
            previewData: null,
            columnMapping: {
                name: '',
                phone_number: '',
                email: '',
                notes: ''
            },
            selectedStudio: null,
            autoSyncEnabled: true,
            syncFrequency: 30
        };
        this.isLoading = false;
    }

    // Initialize the wizard
    init() {
        this.render();
        this.setupEventListeners();
    }

    // Render the wizard container
    render() {
        const container = document.getElementById('dashboard-content');
        container.innerHTML = `
            <div class="google-sheets-wizard">
                <!-- Wizard Header -->
                <div class="row mb-4">
                    <div class="col">
                        <h2 class="h3 mb-0">
                            <i class="bi bi-plus-circle text-primary me-2"></i>
                            Connect New Google Sheet
                        </h2>
                        <p class="text-muted mb-0">Follow the steps to connect a Google Sheet to a studio</p>
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-outline-secondary" onclick="managerDashboard.switchTab('overview')">
                            <i class="bi bi-arrow-left me-2"></i>
                            Back to Dashboard
                        </button>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                        <div class="wizard-progress">
                            <div class="progress mb-3" style="height: 8px;">
                                <div class="progress-bar bg-primary" 
                                     style="width: ${(this.currentStep / this.totalSteps) * 100}%"
                                     role="progressbar"></div>
                            </div>
                            <div class="d-flex justify-content-between">
                                ${this.renderProgressSteps()}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Wizard Content -->
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <div id="wizard-step-content">
                            ${this.renderCurrentStep()}
                        </div>
                    </div>
                    <div class="card-footer bg-transparent border-0">
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-outline-secondary" 
                                    id="prev-step-btn" 
                                    onclick="googleSheetsWizard.previousStep()"
                                    ${this.currentStep === 1 ? 'disabled' : ''}>
                                <i class="bi bi-arrow-left me-2"></i>
                                Previous
                            </button>
                            <button class="btn btn-primary" 
                                    id="next-step-btn" 
                                    onclick="googleSheetsWizard.nextStep()">
                                ${this.currentStep === this.totalSteps ? 'Connect Sheet' : 'Next'}
                                <i class="bi bi-arrow-right ms-2"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Render progress steps
    renderProgressSteps() {
        const steps = [
            { number: 1, title: 'Sheet URL', icon: 'link' },
            { number: 2, title: 'Preview', icon: 'eye' },
            { number: 3, title: 'Mapping', icon: 'diagram-3' },
            { number: 4, title: 'Studio', icon: 'building' },
            { number: 5, title: 'Confirm', icon: 'check-circle' }
        ];

        return steps.map(step => `
            <div class="wizard-step ${step.number <= this.currentStep ? 'active' : ''} ${step.number < this.currentStep ? 'completed' : ''}">
                <div class="step-circle">
                    <i class="bi bi-${step.number < this.currentStep ? 'check' : step.icon}"></i>
                </div>
                <small class="step-title">${step.title}</small>
            </div>
        `).join('');
    }

    // Render current step content
    renderCurrentStep() {
        switch (this.currentStep) {
            case 1:
                return this.renderStep1();
            case 2:
                return this.renderStep2();
            case 3:
                return this.renderStep3();
            case 4:
                return this.renderStep4();
            case 5:
                return this.renderStep5();
            default:
                return this.renderStep1();
        }
    }

    // Step 1: Sheet URL Input
    renderStep1() {
        return `
            <div class="step-content">
                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div class="text-center mb-4">
                            <i class="bi bi-link-45deg display-4 text-primary mb-3"></i>
                            <h4>Enter Google Sheets URL</h4>
                            <p class="text-muted">Paste the URL of the Google Sheet you want to connect</p>
                        </div>

                        <div class="mb-4">
                            <label for="sheet-url" class="form-label fw-bold">Google Sheets URL</label>
                            <input type="url" 
                                   class="form-control form-control-lg" 
                                   id="sheet-url" 
                                   placeholder="https://docs.google.com/spreadsheets/d/..." 
                                   value="${this.wizardData.sheetUrl}">
                            <div class="form-text">
                                The URL should look like: <code>https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit...</code>
                            </div>
                            <div id="url-validation-feedback" class="invalid-feedback"></div>
                        </div>

                        <div class="alert alert-info">
                            <h6 class="alert-heading">
                                <i class="bi bi-info-circle me-2"></i>
                                Before continuing, make sure:
                            </h6>
                            <ul class="mb-0">
                                <li>The Google Sheet contains lead data with at least <strong>Name</strong> and <strong>Phone Number</strong> columns</li>
                                <li>The sheet is shared with: <code>sheets-api-ail@leads-lists.iam.gserviceaccount.com</code></li>
                                <li>The service account has <strong>Editor</strong> access to the sheet</li>
                            </ul>
                        </div>

                        <div class="card bg-light border-0">
                            <div class="card-body">
                                <h6 class="card-title">
                                    <i class="bi bi-question-circle me-2"></i>
                                    How to share your Google Sheet:
                                </h6>
                                <ol class="mb-0">
                                    <li>Open your Google Sheet</li>
                                    <li>Click the "Share" button (top right)</li>
                                    <li>Add this email: <code>sheets-api-ail@leads-lists.iam.gserviceaccount.com</code></li>
                                    <li>Set permission to "Editor"</li>
                                    <li>Click "Send"</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Step 2: Sheet Preview
    renderStep2() {
        return `
            <div class="step-content">
                <div class="text-center mb-4">
                    <i class="bi bi-eye display-4 text-primary mb-3"></i>
                    <h4>Preview Sheet Data</h4>
                    <p class="text-muted">Review your Google Sheet data before mapping columns</p>
                </div>

                <div id="preview-container">
                    ${this.wizardData.previewData ? this.renderPreviewData() : this.renderPreviewPlaceholder()}
                </div>
            </div>
        `;
    }

    // Step 3: Column Mapping
    renderStep3() {
        if (!this.wizardData.previewData) {
            return '<div class="text-center py-4">No preview data available. Please go back to Step 2.</div>';
        }

        const headers = this.wizardData.previewData.headers || [];
        
        return `
            <div class="step-content">
                <div class="text-center mb-4">
                    <i class="bi bi-diagram-3 display-4 text-primary mb-3"></i>
                    <h4>Map Sheet Columns</h4>
                    <p class="text-muted">Map your sheet columns to the required lead fields</p>
                </div>

                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div class="column-mapping">
                            <!-- Required Fields -->
                            <h6 class="text-primary mb-3">
                                <i class="bi bi-asterisk me-2"></i>
                                Required Fields
                            </h6>
                            
                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <label for="map-name" class="form-label fw-bold">
                                        Name <span class="text-danger">*</span>
                                    </label>
                                    <select class="form-select" id="map-name">
                                        <option value="">Select column...</option>
                                        ${headers.map(header => `
                                            <option value="${header}" ${this.wizardData.columnMapping.name === header ? 'selected' : ''}>
                                                ${header}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="col-md-6">
                                    <label for="map-phone" class="form-label fw-bold">
                                        Phone Number <span class="text-danger">*</span>
                                    </label>
                                    <select class="form-select" id="map-phone">
                                        <option value="">Select column...</option>
                                        ${headers.map(header => `
                                            <option value="${header}" ${this.wizardData.columnMapping.phone_number === header ? 'selected' : ''}>
                                                ${header}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <!-- Optional Fields -->
                            <h6 class="text-secondary mb-3">
                                <i class="bi bi-plus-circle me-2"></i>
                                Optional Fields
                            </h6>
                            
                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <label for="map-email" class="form-label fw-bold">Email</label>
                                    <select class="form-select" id="map-email">
                                        <option value="">Skip this field</option>
                                        ${headers.map(header => `
                                            <option value="${header}" ${this.wizardData.columnMapping.email === header ? 'selected' : ''}>
                                                ${header}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="col-md-6">
                                    <label for="map-notes" class="form-label fw-bold">Notes</label>
                                    <select class="form-select" id="map-notes">
                                        <option value="">Skip this field</option>
                                        ${headers.map(header => `
                                            <option value="${header}" ${this.wizardData.columnMapping.notes === header ? 'selected' : ''}>
                                                ${header}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <!-- Mapping Preview -->
                            <div class="card bg-light border-0">
                                <div class="card-header bg-transparent">
                                    <h6 class="mb-0">
                                        <i class="bi bi-eye me-2"></i>
                                        Preview Mapping
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="mapping-preview">
                                        ${this.renderMappingPreview()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Step 4: Studio Selection
    renderStep4() {
        return `
            <div class="step-content">
                <div class="text-center mb-4">
                    <i class="bi bi-building display-4 text-primary mb-3"></i>
                    <h4>Select Target Studio</h4>
                    <p class="text-muted">Choose which studio will receive the imported leads</p>
                </div>

                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div id="studio-selection">
                            ${this.renderStudioSelection()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Step 5: Configuration & Confirmation
    renderStep5() {
        return `
            <div class="step-content">
                <div class="text-center mb-4">
                    <i class="bi bi-check-circle display-4 text-success mb-3"></i>
                    <h4>Review & Confirm</h4>
                    <p class="text-muted">Review your settings and connect the Google Sheet</p>
                </div>

                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <!-- Configuration Options -->
                        <div class="card border-0 bg-light mb-4">
                            <div class="card-header bg-transparent">
                                <h6 class="mb-0">
                                    <i class="bi bi-gear me-2"></i>
                                    Sync Configuration
                                </h6>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" 
                                                   type="checkbox" 
                                                   id="auto-sync-toggle" 
                                                   ${this.wizardData.autoSyncEnabled ? 'checked' : ''}>
                                            <label class="form-check-label fw-bold" for="auto-sync-toggle">
                                                Enable Auto-Sync
                                            </label>
                                            <div class="form-text">
                                                Automatically import new leads every 30 minutes
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Summary Review -->
                        <div class="card border-0 shadow-sm">
                            <div class="card-header bg-transparent">
                                <h6 class="mb-0">
                                    <i class="bi bi-list-check me-2"></i>
                                    Connection Summary
                                </h6>
                            </div>
                            <div class="card-body">
                                ${this.renderConnectionSummary()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Setup event listeners
    setupEventListeners() {
        // URL input validation
        const urlInput = document.getElementById('sheet-url');
        if (urlInput) {
            urlInput.addEventListener('input', (e) => {
                this.wizardData.sheetUrl = e.target.value;
                this.validateSheetUrl();
            });
        }

        // Column mapping selects
        ['name', 'phone_number', 'email', 'notes'].forEach(field => {
            const select = document.getElementById(`map-${field === 'phone_number' ? 'phone' : field}`);
            if (select) {
                select.addEventListener('change', (e) => {
                    this.wizardData.columnMapping[field] = e.target.value;
                    this.updateMappingPreview();
                });
            }
        });

        // Auto-sync toggle
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.addEventListener('change', (e) => {
                this.wizardData.autoSyncEnabled = e.target.checked;
            });
        }
    }

    // Validate Google Sheets URL
    validateSheetUrl() {
        const urlInput = document.getElementById('sheet-url');
        const feedback = document.getElementById('url-validation-feedback');
        const nextBtn = document.getElementById('next-step-btn');

        if (!urlInput || !feedback || !nextBtn) return;

        const url = urlInput.value.trim();
        
        if (!url) {
            urlInput.classList.remove('is-valid', 'is-invalid');
            nextBtn.disabled = true;
            return;
        }

        try {
            const isValid = window.managerAPI.validateGoogleSheetsUrl(url);
            if (isValid) {
                urlInput.classList.remove('is-invalid');
                urlInput.classList.add('is-valid');
                feedback.textContent = '';
                nextBtn.disabled = false;
                this.wizardData.sheetId = window.managerAPI.extractSheetId(url);
            } else {
                throw new Error('Invalid URL format');
            }
        } catch (error) {
            urlInput.classList.remove('is-valid');
            urlInput.classList.add('is-invalid');
            feedback.textContent = 'Please enter a valid Google Sheets URL';
            nextBtn.disabled = true;
        }
    }

    // Move to next step
    async nextStep() {
        if (this.isLoading) return;

        // Validate current step
        if (!await this.validateCurrentStep()) {
            return;
        }

        // Process step-specific logic
        if (this.currentStep === 1) {
            await this.previewSheet();
        } else if (this.currentStep === this.totalSteps) {
            await this.connectSheet();
            return;
        }

        // Move to next step
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            
            // Load studios when entering step 4
            if (this.currentStep === 4) {
                this.render();
                this.setupEventListeners();
                await this.loadStudios();
                // Re-render after studios are loaded
                const studioContainer = document.getElementById('studio-selection');
                if (studioContainer) {
                    studioContainer.innerHTML = this.renderStudioSelection();
                }
            } else {
                this.render();
                this.setupEventListeners();
            }
        }
    }

    // Move to previous step
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.render();
            this.setupEventListeners();
        }
    }

    // Validate current step
    async validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                return this.wizardData.sheetUrl && this.wizardData.sheetId;
            case 2:
                return this.wizardData.previewData !== null;
            case 3:
                return this.wizardData.columnMapping.name && this.wizardData.columnMapping.phone_number;
            case 4:
                return this.wizardData.selectedStudio !== null;
            case 5:
                return true;
            default:
                return false;
        }
    }

    // Preview sheet data
    async previewSheet() {
        this.isLoading = true;
        const nextBtn = document.getElementById('next-step-btn');
        const originalText = nextBtn.innerHTML;
        nextBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
        nextBtn.disabled = true;

        try {
            const previewData = await window.managerAPI.previewGoogleSheet(this.wizardData.sheetUrl);
            this.wizardData.previewData = previewData.preview;
            this.wizardData.sheetInfo = {
                title: previewData.title || 'Untitled Sheet',
                totalRows: previewData.preview.totalRows || 0
            };
        } catch (error) {
            console.error('Error previewing sheet:', error);
            this.showError('Failed to preview sheet: ' + error.message);
            nextBtn.innerHTML = originalText;
            nextBtn.disabled = false;
            this.isLoading = false;
            return;
        }

        nextBtn.innerHTML = originalText;
        nextBtn.disabled = false;
        this.isLoading = false;
    }

    // Load studios for selection
    async loadStudios() {
        try {
            console.log('Loading studios for wizard step 4...');
            const response = await window.managerAPI.getAllStudios();
            console.log('Studios response:', response);
            this.studios = response.studios || [];
            console.log('Loaded studios:', this.studios);
            
            if (this.studios.length === 0) {
                console.warn('No studios found for current manager');
            }
        } catch (error) {
            console.error('Error loading studios:', error);
            this.studios = [];
            this.showError('Failed to load studios: ' + error.message);
        }
    }

    // Connect the sheet
    async connectSheet() {
        this.isLoading = true;
        const nextBtn = document.getElementById('next-step-btn');
        const originalText = nextBtn.innerHTML;
        nextBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Connecting...';
        nextBtn.disabled = true;

        try {
            const result = await window.managerAPI.connectGoogleSheet(
                this.wizardData.selectedStudio.id,
                this.wizardData.sheetUrl,
                this.wizardData.columnMapping,
                this.wizardData.autoSyncEnabled
            );

            this.showSuccess('Google Sheet connected successfully!');
            
            // Redirect back to integrations tab after a short delay
            setTimeout(() => {
                managerDashboard.switchTab('integrations');
                managerDashboard.loadDashboardData();
            }, 1500);

        } catch (error) {
            console.error('Error connecting sheet:', error);
            this.showError('Failed to connect sheet: ' + error.message);
            nextBtn.innerHTML = originalText;
            nextBtn.disabled = false;
        }

        this.isLoading = false;
    }

    // Render preview data
    renderPreviewData() {
        const data = this.wizardData.previewData;
        if (!data || !data.sampleData) {
            return this.renderPreviewPlaceholder();
        }

        return `
            <div class="sheet-preview">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h6 class="mb-0">${this.wizardData.sheetInfo?.title || 'Sheet Preview'}</h6>
                        <small class="text-muted">
                            Showing first ${data.sampleData.length} of ${data.totalRows} rows
                        </small>
                    </div>
                    <span class="badge bg-success">${data.headers.length} columns</span>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                ${data.headers.map(header => `<th>${header}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.sampleData.slice(0, 5).map(row => `
                                <tr>
                                    ${data.headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderPreviewPlaceholder() {
        return `
            <div class="text-center py-4">
                <i class="bi bi-table display-4 text-muted mb-3"></i>
                <h5 class="text-muted">Sheet Preview</h5>
                <p class="text-muted">Click "Next" to preview your Google Sheet data</p>
            </div>
        `;
    }

    // Render mapping preview
    renderMappingPreview() {
        if (!this.wizardData.previewData || !this.wizardData.previewData.sampleData.length) {
            return '<p class="text-muted">No preview data available</p>';
        }

        const sampleRow = this.wizardData.previewData.sampleData[0];
        const mapping = this.wizardData.columnMapping;

        return `
            <div class="row g-2">
                <div class="col-md-6">
                    <strong>Name:</strong> ${mapping.name ? sampleRow[mapping.name] || '<em>empty</em>' : '<em>not mapped</em>'}
                </div>
                <div class="col-md-6">
                    <strong>Phone:</strong> ${mapping.phone_number ? sampleRow[mapping.phone_number] || '<em>empty</em>' : '<em>not mapped</em>'}
                </div>
                <div class="col-md-6">
                    <strong>Email:</strong> ${mapping.email ? sampleRow[mapping.email] || '<em>empty</em>' : '<em>not mapped</em>'}
                </div>
                <div class="col-md-6">
                    <strong>Notes:</strong> ${mapping.notes ? sampleRow[mapping.notes] || '<em>empty</em>' : '<em>not mapped</em>'}
                </div>
            </div>
        `;
    }

    updateMappingPreview() {
        const previewContainer = document.getElementById('mapping-preview');
        if (previewContainer) {
            previewContainer.innerHTML = this.renderMappingPreview();
        }
    }

    // Render studio selection
    renderStudioSelection() {
        if (!this.studios) {
            return `
                <div class="text-center py-4">
                    <div class="spinner-border" role="status"></div>
                    <p class="text-muted mt-2">Loading studios...</p>
                </div>
            `;
        }

        if (this.studios.length === 0) {
            return `
                <div class="text-center py-4">
                    <i class="bi bi-building display-4 text-muted mb-3"></i>
                    <h5 class="text-muted">No Studios Found</h5>
                    <p class="text-muted">No studios have been registered using your manager codes yet.</p>
                    <div class="alert alert-info text-start mt-3">
                        <h6 class="alert-heading">To create studios:</h6>
                        <ol class="mb-0">
                            <li>Generate studio owner codes in the Manager Dashboard</li>
                            <li>Share these codes with studio owners</li>
                            <li>Studio owners use the codes to register their studios</li>
                            <li>Once registered, studios will appear here for Google Sheets connection</li>
                        </ol>
                    </div>
                    <button class="btn btn-primary mt-3" onclick="managerDashboard.switchTab('overview')">
                        <i class="bi bi-arrow-left me-2"></i>
                        Go Generate Studio Codes
                    </button>
                </div>
            `;
        }

        return `
            <div class="studio-grid">
                ${this.studios.map(studio => `
                    <div class="studio-card ${this.wizardData.selectedStudio?.id === studio.id ? 'selected' : ''}" 
                         onclick="googleSheetsWizard.selectStudio(${studio.id})">
                        <div class="card border-2 h-100">
                            <div class="card-body">
                                <div class="d-flex align-items-start">
                                    <div class="flex-grow-1">
                                        <h6 class="card-title mb-1">${studio.name}</h6>
                                        <p class="card-text text-muted small mb-2">
                                            ${studio.address || 'No address available'}
                                        </p>
                                        <div class="d-flex align-items-center">
                                            <small class="text-muted">
                                                <i class="bi bi-person me-1"></i>
                                                ${studio.owner_name || 'Unknown Owner'}
                                            </small>
                                        </div>
                                    </div>
                                    <div class="selection-indicator">
                                        <i class="bi bi-check-circle-fill"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Select studio
    selectStudio(studioId) {
        this.wizardData.selectedStudio = this.studios.find(s => s.id === studioId);
        
        // Update UI
        document.querySelectorAll('.studio-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');

        // Enable next button
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.disabled = false;
        }
    }

    // Render connection summary
    renderConnectionSummary() {
        return `
            <div class="summary-grid">
                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="summary-item">
                            <strong>Google Sheet:</strong>
                            <div class="text-muted">${this.wizardData.sheetInfo?.title || 'Unknown Sheet'}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="summary-item">
                            <strong>Target Studio:</strong>
                            <div class="text-muted">${this.wizardData.selectedStudio?.name || 'Unknown Studio'}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="summary-item">
                            <strong>Total Rows:</strong>
                            <div class="text-muted">${this.wizardData.sheetInfo?.totalRows || 0} leads</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="summary-item">
                            <strong>Auto-Sync:</strong>
                            <div class="text-muted">
                                ${this.wizardData.autoSyncEnabled ? 
                                    '<span class="text-success">Enabled (every 30 min)</span>' : 
                                    '<span class="text-warning">Disabled</span>'}
                            </div>
                        </div>
                    </div>
                </div>

                <hr>

                <div class="mapping-summary">
                    <strong>Column Mapping:</strong>
                    <div class="row g-2 mt-2">
                        <div class="col-md-6">
                            <small><strong>Name:</strong> ${this.wizardData.columnMapping.name || '<em>Not mapped</em>'}</small>
                        </div>
                        <div class="col-md-6">
                            <small><strong>Phone:</strong> ${this.wizardData.columnMapping.phone_number || '<em>Not mapped</em>'}</small>
                        </div>
                        <div class="col-md-6">
                            <small><strong>Email:</strong> ${this.wizardData.columnMapping.email || '<em>Not mapped</em>'}</small>
                        </div>
                        <div class="col-md-6">
                            <small><strong>Notes:</strong> ${this.wizardData.columnMapping.notes || '<em>Not mapped</em>'}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Utility methods
    showSuccess(message) {
        console.log('Success:', message);
        // Use the manager dashboard notification system
        if (window.managerDashboard) {
            window.managerDashboard.showSuccess(message);
        }
    }

    showError(message) {
        console.error('Error:', message);
        // Use the manager dashboard notification system
        if (window.managerDashboard) {
            window.managerDashboard.showError(message);
        }
    }
}

// Global instance
window.googleSheetsWizard = new GoogleSheetsWizard();