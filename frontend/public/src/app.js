// Main application initialization
// Dynamic API base URL based on environment
if (typeof API_BASE_URL === 'undefined') {
  window.API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001'
    : 'https://ail-app-production.up.railway.app';
}

class App {
    constructor() {
        this.currentUser = null;
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.currentStudioId = null;
        this.isLoggingOut = false; // Prevent multiple logout calls
        this.setupFetchInterceptor(); // Setup global 401 handler
        this.init();
    }
    
    // Global fetch wrapper to handle 401 errors
    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = async function(...args) {
            const response = await originalFetch(...args);
            
            // Check for 401 Unauthorized response
            if (response.status === 401 && !self.isLoggingOut) {
                // Get the request URL to determine if this is a login attempt
                const url = args[0];
                const isLoginAttempt = url && (
                    url.includes('/api/v1/auth/login') || 
                    url.includes('/login')
                );
                
                // Only show session expired for authenticated users, not for login failures
                const wasAuthenticated = localStorage.getItem('authToken') && localStorage.getItem('user');
                
                if (wasAuthenticated && !isLoginAttempt) {
                    self.isLoggingOut = true;
                    
                    // Show session expired notification
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
                    alertDiv.style.zIndex = '9999';
                    alertDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    `;
                    document.body.appendChild(alertDiv);
                    
                    // Auto-dismiss after 5 seconds
                    setTimeout(() => {
                        if (alertDiv.parentNode) {
                            alertDiv.remove();
                        }
                    }, 5000);
                    
                    // Redirect to login page after a short delay
                    setTimeout(() => {
                        self.isLoggingOut = false;
                        self.showLoginModal();
                        self.updateUIForGuestUser();
                    }, 1000);
                }
                
                // Always clear auth data on 401
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                localStorage.removeItem('userRole');
            }
            
            return response;
        };
    }

    async init() {
        this.setupEventListeners();
        this.initSidebar();
        this.checkAPIStatus();
        await this.checkAuthStatus();
        
        // Handle email verification parameters
        this.handleEmailVerification();
        
        // Initialize CustomerManagement component for shared modal access
        // Don't initialize on startup - wait until we have a studio ID
        // this.initializeCustomerManagement();
    }

    async initializeCustomerManagement() {
        try {
            // Check if CustomerManagement class is available
            if (typeof CustomerManagement === 'undefined') {
                console.log('CustomerManagement class not yet loaded, skipping initialization');
                return;
            }
            
            // Initialize CustomerManagement if not already done
            if (!window.customerManagement) {
                window.customerManagement = new CustomerManagement();
            }
            
            // Initialize with skipTabSwitch=true so it doesn't interfere with current view
            // This just ensures the modals are available
            // Only initialize if we have a valid studio ID (not undefined or 'undefined')
            if (this.currentStudioId && this.currentStudioId !== 'undefined') {
                await window.customerManagement.init(this.currentStudioId, true);
            }
        } catch (error) {
            console.error('Error initializing CustomerManagement:', error);
        }
    }

    // Handle email verification URL parameters
    handleEmailVerification() {
        const urlParams = new URLSearchParams(window.location.search);
        const verification = urlParams.get('verification');
        const token = urlParams.get('token');
        const message = urlParams.get('message');

        if (verification === 'success' && token) {
            // Auto-login with the verification token
            localStorage.setItem('authToken', token);
            localStorage.setItem('token', token);
            
            // Show success message
            this.showNotification(
                message || 'Email erfolgreich bestätigt! Sie sind jetzt angemeldet.', 
                'success'
            );
            
            // Clear URL parameters and reload auth status
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } else if (verification === 'error') {
            // Show error message
            this.showNotification(
                message || 'E-Mail-Bestätigung fehlgeschlagen. Bitte versuchen Sie es erneut.', 
                'error'
            );
            
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Show notification to user
    showNotification(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 8000);
    }

    async checkAuthStatus() {
        
        if (window.authService && window.authService.isAuthenticated()) {
            // Don't validate token on startup - only validate when user performs actions
            // This prevents premature "session expired" messages on page load
            this.currentUser = window.authService.getCurrentUser();
            
            // Only update UI if we have user data
            if (this.currentUser) {
                this.updateUIForAuthenticatedUser();
            } else {
                this.updateUIForGuestUser();
            }
        } else {
            this.updateUIForGuestUser();
        }
    }

    // Validate token when needed (e.g., before making authenticated requests)
    async validateTokenIfNeeded() {
        if (window.authService && window.authService.isAuthenticated()) {
            try {
                await window.authService.validateToken();
                this.currentUser = window.authService.getCurrentUser();
                return true;
            } catch (error) {
                console.error('Token validation failed:', error);
                this.currentUser = null;
                this.updateUIForGuestUser();
                return false;
            }
        }
        return false;
    }

    updateUIForAuthenticatedUser() {
        // Update sidebar user menu and hide auth buttons
        const userMenuSidebar = document.getElementById('userMenuSidebar');
        const authButtonsSidebar = document.getElementById('authButtonsSidebar');
        const userDisplayNameSidebar = document.getElementById('userDisplayNameSidebar');
        
        if (userMenuSidebar && authButtonsSidebar) {
            userMenuSidebar.style.display = 'block';
            authButtonsSidebar.style.display = 'none';
            
            if (userDisplayNameSidebar) {
                userDisplayNameSidebar.textContent = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
            }
        }

        // Update sidebar navigation
        this.updateSidebarNavigation();
        
        // Load studios for studio owners
        if (this.currentUser?.role === 'studio_owner') {
            this.loadUserStudios();
        }


        // Add user profile toggle functionality
        const userProfileToggle = document.getElementById('userProfileToggle');
        const userActions = document.getElementById('userActions');
        const userChevron = document.getElementById('userChevron');
        
        if (userProfileToggle && userActions && userChevron) {
            userProfileToggle.addEventListener('click', () => {
                const isExpanded = userActions.classList.contains('expanded');
                
                if (isExpanded) {
                    userActions.classList.remove('expanded');
                    userActions.style.display = 'none';
                    userChevron.parentElement.classList.remove('expanded');
                } else {
                    userActions.style.display = 'flex';
                    setTimeout(() => {
                        userActions.classList.add('expanded');
                    }, 10);
                    userChevron.parentElement.classList.add('expanded');
                }
            });
        }

        // Add user action button functionality
        const logoutBtnSidebar = document.getElementById('logoutBtnSidebar');
        const profileBtnSidebar = document.getElementById('profileBtnSidebar');
        const settingsBtnSidebar = document.getElementById('settingsBtnSidebar');
        
        if (logoutBtnSidebar) {
            logoutBtnSidebar.addEventListener('click', () => {
                this.logout();
            });
        }
        
        if (profileBtnSidebar) {
            profileBtnSidebar.addEventListener('click', () => {
                this.navigateToSection('profile');
            });
        }
        
        if (settingsBtnSidebar) {
            settingsBtnSidebar.addEventListener('click', () => {
                this.navigateToSection('settings');
            });
        }

        // Show appropriate dashboard based on role
        if (this.currentUser.role === 'manager') {
            this.showManagerDashboard();
        } else if (this.currentUser.role === 'studio_owner') {
            this.showStudioDashboard();
        } else {
            this.showCustomerDashboard();
        }
    }

    updateUIForGuestUser() {
        // Update sidebar auth buttons and hide user menu
        const userMenuSidebar = document.getElementById('userMenuSidebar');
        const authButtonsSidebar = document.getElementById('authButtonsSidebar');
        
        if (userMenuSidebar && authButtonsSidebar) {
            userMenuSidebar.style.display = 'none';
            authButtonsSidebar.style.display = 'flex';
        }

        // Update sidebar navigation for guest
        this.updateSidebarNavigation();

        // Customer login/registration buttons removed - customers can't login yet


        // Show welcome page
        this.showWelcomePage();
    }

    updateSidebarUser() {
        // Update sidebar user display with current user data
        const userDisplayNameSidebar = document.getElementById('userDisplayNameSidebar');
        if (userDisplayNameSidebar && this.currentUser) {
            userDisplayNameSidebar.textContent = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
        }
    }

    showMainPage() {
        // Navigate to appropriate page based on authentication status
        if (this.currentUser) {
            // User is authenticated - show their dashboard
            this.updateUIForAuthenticatedUser();
        } else {
            // User is not authenticated - show welcome page
            this.showWelcomePage();
        }
    }

    showWelcomePage() {
        const content = document.getElementById('content');
        if (!content) {
            console.error('Content element not found, redirecting to home');
            window.location.href = '/';
            return;
        }
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header">
                            <div class="text-center"><img src="assets/images/LOgo AIL.png" alt="Abnehmen im Liegen" style="height: 80px;"><h4 class="mt-2">Willkommen</h4></div>
                        </div>
                        <div class="card-body">
                            <p>Vereinbaren Sie Ihren Termin schnell und einfach online.</p>
                            <div class="d-grid gap-2 d-md-flex justify-content-md-start">
                                <button class="btn btn-primary" type="button" id="studioLoginBtn">
                                    Studio Login
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('studioLoginBtn').addEventListener('click', () => {
            this.showStudioLogin();
        });
    }

    setupEventListeners() {
        // Main navbar brand link
        document.querySelector('.navbar-brand')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showMainPage();
        });
    }

    async checkAPIStatus() {
        const statusElement = document.getElementById('apiStatus');
        
        // Use dynamic API URL like other services
        const apiUrl = window.location.hostname === 'localhost' 
            ? `${window.API_BASE_URL}/api/v1/status`
            : 'https://ail-app-production.up.railway.app/api/v1/status';
        
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (response.ok) {
                statusElement.className = 'alert alert-success';
                statusElement.innerHTML = `
                    <strong> API Connected</strong><br>
                    ${data.message}<br>
                    <small>Version: ${data.version} | Last check: ${new Date(data.timestamp).toLocaleString()}</small>
                `;
            } else {
                throw new Error('API responded with error');
            }
        } catch (error) {
            statusElement.className = 'alert alert-danger';
            statusElement.innerHTML = `
                <strong>L API Connection Failed</strong><br>
                Unable to connect to backend server.<br>
                <small>Please make sure the server is running on port 3001</small>
            `;
        }
    }

    // Customer login removed - customers can't login yet

    // Customer login handler removed - customers can't login yet

    async logout() {
        try {
            await window.authService.logout();
            this.currentUser = null;
            this.updateUIForGuestUser();
            this.showMainPage();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    showStudioLogin() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6 mx-auto">
                    <div class="text-center mb-3">
                        <h2><a href="#" class="text-decoration-none" id="brandLinkStudio"><img src="assets/images/LOgo AIL.png" alt="Abnehmen im Liegen" style="height: 60px;"></a></h2>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <h4>Studio Login</h4>
                        </div>
                        <div class="card-body">
                            <div id="studioLoginError" class="alert alert-danger d-none"></div>
                            <form id="studioLoginForm">
                                <div class="mb-3">
                                    <label for="studioEmail" class="form-label">Studio E-Mail</label>
                                    <input type="email" class="form-control" id="studioEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label for="studioPassword" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="studioPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="studioLoginSubmitBtn">Login</button>
                            </form>
                            <hr>
                            <div class="text-center">
                                <small>Neues Studio? <a href="#" id="showStudioRegisterLink">Registrieren</a></small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('studioLoginForm').addEventListener('submit', (e) => {
            this.handleStudioLogin(e);
        });
        document.getElementById('brandLinkStudio')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showMainPage();
        });

        document.getElementById('showStudioRegisterLink')?.addEventListener('click', () => {
            this.showStudioRegister();
        });
    }

    async handleStudioLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('studioEmail').value;
        const password = document.getElementById('studioPassword').value;
        const submitBtn = document.getElementById('studioLoginSubmitBtn');
        const errorDiv = document.getElementById('studioLoginError');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            errorDiv.classList.add('d-none');
            
            const result = await window.authService.login(email, password);
            this.currentUser = result.user;
            this.updateUIForAuthenticatedUser();
            
            // Close the modal after successful login
            const modalElement = document.querySelector('.modal.show');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }
            }
            
        } catch (error) {
            // Handle unverified email error with resend option
            if (error.code === 'EMAIL_NOT_VERIFIED') {
                errorDiv.innerHTML = `
                    <div class="mb-2">${error.message}</div>
                    <button type="button" class="btn btn-sm btn-outline-primary" id="resendVerificationBtn">
                        E-Mail-Bestätigung erneut senden
                    </button>
                `;
                
                // Add resend verification functionality
                document.getElementById('resendVerificationBtn').addEventListener('click', async () => {
                    const resendBtn = document.getElementById('resendVerificationBtn');
                    try {
                        resendBtn.disabled = true;
                        resendBtn.textContent = 'Wird gesendet...';
                        
                        await window.authService.resendVerificationEmail(email);
                        
                        resendBtn.className = 'btn btn-sm btn-success';
                        resendBtn.textContent = 'Versendet! Überprüfen Sie Ihre E-Mails.';
                    } catch (resendError) {
                        resendBtn.textContent = 'Fehler beim Versenden';
                        resendBtn.className = 'btn btn-sm btn-danger';
                        console.error('Resend verification error:', resendError);
                    }
                });
            } else {
                errorDiv.textContent = error.message;
            }
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    // Customer registration and handlers removed - customers can't register yet

    async showCustomerDashboard() {
        const content = document.getElementById('content');
        
        // Verify that the current user is actually a customer
        if (this.currentUser.role !== 'customer') {
            console.error('Access denied: User is not a customer. User role:', this.currentUser.role);
            content.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Zugriff verweigert</h4>
                    <p>Sie haben keine Berechtigung, auf das Kundendashboard zuzugreifen.</p>
                    <p>Ihre Rolle: ${this.currentUser.role}</p>
                </div>
            `;
            return;
        }
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2>Meine Termine</h2>
                        <button class="btn btn-primary" id="requestAppointmentBtn">
                            <i class="fas fa-plus"></i> Termin anfragen
                        </button>
                    </div>
                    
                    <!-- Welcome Section -->
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <h5>Willkommen, ${this.currentUser.firstName}!</h5>
                                    <p class="text-muted">Verwalten Sie Ihre Termine und buchen Sie neue Behandlungen.</p>
                                </div>
                                <div class="col-md-4 text-end">
                                    <div class="badge bg-success fs-6">Kunde</div>
                                    <div class="mt-2">
                                        <small class="text-muted">${this.currentUser.email}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Session Counter Widget -->
                    <div class="card mb-4" id="sessionCounterWidget">
                        <div class="card-body">
                            <div class="row align-items-center">
                                <div class="col-md-8">
                                    <div class="d-flex align-items-center">
                                        <div class="me-3">
                                            <i class="fas fa-ticket-alt fa-2x text-primary"></i>
                                        </div>
                                        <div>
                                            <h5 class="mb-1">Ihre Behandlungspakete</h5>
                                            <div id="sessionCountDisplay">
                                                <div class="spinner-border spinner-border-sm" role="status"></div>
                                                <span class="ms-2">Lade Behandlungsstand...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4 text-end">
                                    <div id="sessionAlert" class="d-none">
                                        <div class="badge bg-warning text-dark">
                                            <i class="fas fa-exclamation-triangle"></i> Wenige Behandlungen übrig
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Main Content Tabs -->
                    <div class="card">
                        <div class="card-header">
                            <ul class="nav nav-tabs card-header-tabs" id="customerTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="calendar-tab" data-bs-toggle="tab" data-bs-target="#calendar" type="button" role="tab">
                                        <i class="fas fa-calendar"></i> Kalender
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="appointments-tab" data-bs-toggle="tab" data-bs-target="#appointments" type="button" role="tab">
                                        <i class="fas fa-list"></i> Meine Termine
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div class="card-body">
                            <div class="tab-content" id="customerTabContent">
                                <!-- Calendar Tab -->
                                <div class="tab-pane fade show active" id="calendar" role="tabpanel">
                                    <div id="customerCalendarContainer">
                                        <div class="text-center">
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Lade Kalender...</span>
                                            </div>
                                            <p class="mt-2">Lade Kalender...</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Appointments Tab -->
                                <div class="tab-pane fade" id="appointments" role="tabpanel">
                                    <div id="customerAppointmentsContainer">
                                        <div class="text-center">
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Lade Termine...</span>
                                            </div>
                                            <p class="mt-2">Lade Termine...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize customer dashboard components
        this.initializeCustomerDashboard();
    }

    async initializeCustomerDashboard() {
        // Initialize customer calendar
        this.customerCurrentDate = new Date();
        this.customerSelectedDate = new Date();
        
        // Set up event listeners
        document.getElementById('requestAppointmentBtn').addEventListener('click', () => {
            this.showAppointmentRequestForm();
        });

        // Set up tab change listeners to load content on demand
        document.getElementById('calendar-tab').addEventListener('shown.bs.tab', () => {
            this.loadCustomerCalendar();
        });
        
        document.getElementById('appointments-tab').addEventListener('shown.bs.tab', () => {
            this.loadCustomerAppointments();
        });
        
        document.getElementById('sessions-tab').addEventListener('shown.bs.tab', () => {
            this.loadCustomerSessionsTab();
        });

        // Load initial calendar view
        this.loadCustomerCalendar();
        
        // Load session information
        this.loadCustomerSessions();
    }

    async loadCustomerCalendar() {
        const container = document.getElementById('customerCalendarContainer');
        
        try {
            // Render calendar with customer appointments
            container.innerHTML = `
                <div class="row">
                    <div class="col-md-5">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <button class="btn btn-outline-secondary" id="customerPrevMonth">
                                <i class="fas fa-chevron-left"></i> Zurück
                            </button>
                            <h5 id="customerMonthYearDisplay" class="mb-0"></h5>
                            <button class="btn btn-outline-secondary" id="customerNextMonth">
                                Weiter <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div id="customerCalendarGrid"></div>
                        <div class="mt-3">
                            <small class="text-muted">Klicken Sie auf ein Datum, um Termine für diesen Tag anzuzeigen oder zu buchen.</small>
                        </div>
                    </div>
                    <div class="col-md-7">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h6 id="selectedDateHeader">Termine für heute</h6>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-secondary" id="customerViewModeList" title="Listenansicht">
                                        <i class="fas fa-list"></i>
                                    </button>
                                    <button class="btn btn-outline-secondary active" id="customerViewModeTimeline" title="Timeline-Ansicht">
                                        <i class="fas fa-clock"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="card-body" id="customerDayAppointmentsContent" style="max-height: 600px; overflow-y: auto;">
                                <div class="text-center">
                                    <div class="spinner-border spinner-border-sm" role="status"></div>
                                    <p class="mt-2">Lade Termine...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Set up navigation
            document.getElementById('customerPrevMonth').addEventListener('click', () => {
                this.customerCurrentDate.setMonth(this.customerCurrentDate.getMonth() - 1);
                this.renderCustomerCalendar();
            });

            document.getElementById('customerNextMonth').addEventListener('click', () => {
                this.customerCurrentDate.setMonth(this.customerCurrentDate.getMonth() + 1);
                this.renderCustomerCalendar();
            });

            // Set up view mode toggle
            this.customerTimelineView = true;
            const updateCustomerViewMode = (timeline) => {
                const listBtn = document.getElementById('customerViewModeList');
                const timelineBtn = document.getElementById('customerViewModeTimeline');
                
                if (timeline) {
                    listBtn.classList.remove('active');
                    timelineBtn.classList.add('active');
                    this.customerTimelineView = true;
                } else {
                    listBtn.classList.add('active');
                    timelineBtn.classList.remove('active');
                    this.customerTimelineView = false;
                }
                this.showCustomerDayAppointments(this.customerSelectedDate);
            };
            
            document.getElementById('customerViewModeList').addEventListener('click', () => updateCustomerViewMode(false));
            document.getElementById('customerViewModeTimeline').addEventListener('click', () => updateCustomerViewMode(true));

            this.renderCustomerCalendar();
            
            // Load today's appointments by default
            this.showCustomerDayAppointments(this.customerSelectedDate);
        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden des Kalenders</h6>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async renderCustomerCalendar() {
        if (!this.customerCurrentDate) {
            this.customerCurrentDate = new Date();
        }
        
        const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                           'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        
        const monthYearDisplay = document.getElementById('customerMonthYearDisplay');
        const calendarGrid = document.getElementById('customerCalendarGrid');
        
        if (!monthYearDisplay || !calendarGrid) return;
        
        monthYearDisplay.innerHTML = `<strong>${monthNames[this.customerCurrentDate.getMonth()]} ${this.customerCurrentDate.getFullYear()}</strong>`;
        
        // Calculate first day of month and number of days
        const firstDay = new Date(this.customerCurrentDate.getFullYear(), this.customerCurrentDate.getMonth(), 1);
        // Start from Monday: if firstDay.getDay() is 0 (Sunday), we want to go back 6 days, otherwise go back (firstDay.getDay() - 1) days
        const dayOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        let calendarHTML = `
            <table class="table table-bordered">
                <thead>
                    <tr>
                        ${dayNames.map(day => `<th class="text-center">${day}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;
        
        const today = new Date();
        const currentMonth = this.customerCurrentDate.getMonth();
        
        // Generate 6 weeks (42 days) to cover all possible month layouts
        for (let week = 0; week < 6; week++) {
            calendarHTML += '<tr>';
            
            for (let day = 0; day < 7; day++) {
                const daysFromStart = (week * 7) + day;
                const currentDate = new Date(this.customerCurrentDate.getFullYear(), this.customerCurrentDate.getMonth(), 1 - dayOffset + daysFromStart);
                
                const isCurrentMonth = currentDate.getMonth() === currentMonth;
                const isToday = currentDate.toDateString() === today.toDateString();
                const isSelected = this.customerSelectedDate && currentDate.toDateString() === this.customerSelectedDate.toDateString();
                const isPast = currentDate < today && !isToday;
                
                let cellClass = 'calendar-day text-center';
                if (!isCurrentMonth) cellClass += ' text-muted';
                if (isToday) cellClass += ' bg-primary text-white';
                if (isSelected) cellClass += ' bg-success text-white';
                if (isPast) cellClass += ' text-muted';
                
                const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                
                calendarHTML += `
                    <td class="${cellClass}" 
                        style="cursor: pointer; padding: 12px; border: 1px solid #dee2e6; height: 80px; vertical-align: top;"
                        data-date="${dateString}"
                        onclick="if(window.app && window.app.selectCustomerDate) window.app.selectCustomerDate('${dateString}')">
                        <div>
                            <strong>${currentDate.getDate()}</strong>
                            <div id="customer-day-${dateString}" class="mt-1" style="font-size: 10px;">
                                <!-- Appointment indicators will be loaded here -->
                            </div>
                        </div>
                    </td>
                `;
            }
            
            calendarHTML += '</tr>';
        }
        
        calendarHTML += '</tbody></table>';
        calendarGrid.innerHTML = calendarHTML;
        
        // Load appointment indicators for the month
        this.loadCustomerMonthlyAppointmentIndicators();
    }

    async loadCustomerMonthlyAppointmentIndicators() {
        try {
            const startDate = new Date(this.customerCurrentDate.getFullYear(), this.customerCurrentDate.getMonth(), 1);
            const endDate = new Date(this.customerCurrentDate.getFullYear(), this.customerCurrentDate.getMonth() + 1, 0);
            
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            const data = await window.customerAPI.getMyAppointments({
                from_date: startDateStr,
                to_date: endDateStr
            });
            
            const appointments = data.appointments || [];
            
            // Group appointments by date
            const appointmentsByDate = {};
            appointments.forEach(appointment => {
                const date = appointment.appointment_date;
                if (!appointmentsByDate[date]) {
                    appointmentsByDate[date] = [];
                }
                appointmentsByDate[date].push(appointment);
            });
            
            // Display indicators
            Object.keys(appointmentsByDate).forEach(date => {
                const dayElement = document.getElementById(`customer-day-${date}`);
                if (dayElement) {
                    const count = appointmentsByDate[date].length;
                    const hasConfirmed = appointmentsByDate[date].some(apt => apt.status === 'confirmed');
                    const hasPending = appointmentsByDate[date].some(apt => apt.status === 'pending');
                    
                    let badgeClass = 'badge-secondary';
                    if (hasConfirmed) badgeClass = 'badge-success';
                    else if (hasPending) badgeClass = 'badge-warning';
                    
                    dayElement.innerHTML = `
                        <div style="width: 12px; height: 12px; background-color: #7030a0; border-radius: 50%; margin: 0 auto;"></div>
                    `;
                }
            });
        } catch (error) {
            console.error('Error loading monthly appointment indicators:', error);
        }
    }

    async loadCustomerSessions() {
        const sessionDisplay = document.getElementById('sessionCountDisplay');
        const sessionAlert = document.getElementById('sessionAlert');
        
        try {
            const data = await window.customerAPI.getMySessions();
            
            // Handle both single session and multiple sessions structure
            let sessions = [];
            if (data.session) {
                // Single session structure from backend
                sessions = [data.session];
            } else if (data.sessions) {
                // Multiple sessions structure (fallback)
                sessions = data.sessions;
            }
            
            
            if (sessions.length === 0) {
                sessionDisplay.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <div class="badge bg-secondary me-2">0</div>
                            <span class="text-muted">Keine aktiven Behandlungspakete</span>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="window.app.showCustomerSessionPurchaseModal()">
                            <i class="fas fa-shopping-cart me-1"></i>Paket kaufen
                        </button>
                    </div>
                    <small class="text-muted d-block mt-1">Kaufen Sie neue Behandlungspakete direkt hier oder kontaktieren Sie Ihr Studio.</small>
                `;
                sessionAlert.classList.add('d-none');
                return;
            }
            
            // Calculate total remaining sessions
            const totalRemaining = sessions.reduce((sum, session) => {
                return session.is_active ? sum + session.remaining_sessions : sum;
            }, 0);
            
            
            // Display session count with color coding
            let badgeClass = 'bg-success';
            let statusText = 'Verfügbar';
            
            if (totalRemaining <= 0) {
                badgeClass = 'bg-danger';
                statusText = 'Keine Behandlungen';
            } else if (totalRemaining < 3) {
                badgeClass = 'bg-warning text-dark';
                statusText = 'Niedrig';
            }
            
            sessionDisplay.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <div class="badge ${badgeClass} me-2 fs-6">${totalRemaining}</div>
                        <span><strong>Verbleibende Behandlungen</strong></span>
                    </div>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.app.showCustomerSessionPurchaseModal()">
                        <i class="fas fa-plus me-1"></i>Nachbuchen
                    </button>
                </div>
                <small class="text-muted d-block mt-1">
                    Status: ${statusText} | 
                    ${sessions.filter(s => s.is_active).length} aktive${sessions.filter(s => s.is_active).length !== 1 ? 's' : ''} Paket${sessions.filter(s => s.is_active).length !== 1 ? 'e' : ''}
                    <br><a href="#" onclick="window.app.showCustomerSessionDetails()" class="text-decoration-none small">
                        <i class="fas fa-eye me-1"></i>Behandlungsblöcke anzeigen
                    </a>
                </small>
            `;
            
            // Show warning if sessions are low
            if (totalRemaining > 0 && totalRemaining < 3) {
                sessionAlert.classList.remove('d-none');
            } else {
                sessionAlert.classList.add('d-none');
            }
            
        } catch (error) {
            console.error('Error loading customer sessions:', error);
            sessionDisplay.innerHTML = `
                <div class="text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Fehler beim Laden der Behandlungsdaten</span>
                </div>
            `;
            sessionAlert.classList.add('d-none');
        }
    }

    selectCustomerDate(dateString) {
        try {
            const [year, month, day] = dateString.split('-').map(Number);
            this.customerSelectedDate = new Date(year, month - 1, day);
            this.renderCustomerCalendar();
            this.showCustomerDayAppointments(this.customerSelectedDate);
        } catch (error) {
            console.error('Error in selectCustomerDate:', error);
        }
    }

    async showCustomerDayAppointments(selectedDate) {
        const appointmentsDiv = document.getElementById('customerDayAppointmentsContent');
        if (!appointmentsDiv) {
            console.error('customerDayAppointmentsContent element not found');
            return;
        }

        try {
            // Update the header with selected date and add quick schedule button
            const selectedDateDisplayStr = selectedDate.toLocaleDateString('de-DE', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const headerElement = document.getElementById('selectedDateHeader');
            if (headerElement) {
                // Check if selected date is in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPastDate = selectedDate < today;
                
                headerElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Termine für ${selectedDateDisplayStr}</span>
                        ${!isPastDate ? `
                            <button class="btn btn-sm btn-primary" onclick="window.app.showCreateAppointmentForm('${studioId}', new Date('${selectedDate.toISOString()}'))">
                                <i class="fas fa-plus-circle me-1"></i>
                                Neue Behandlung
                            </button>
                        ` : ''}
                    </div>
                `;
            }

            // Show loading
            appointmentsDiv.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                    <p class="mt-2">Lade Termine...</p>
                </div>
            `;

            // Format date for API call
            const dateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            
            const data = await window.customerAPI.getMyAppointments({
                from_date: dateString,
                to_date: dateString
            });
            
            const appointments = data.appointments || [];
            
            if (appointments.length === 0) {
                appointmentsDiv.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-calendar-times fa-2x mb-3"></i>
                        <p>Keine Termine für diesen Tag.</p>
                        <button class="btn btn-primary btn-sm" onclick="window.app.showAppointmentRequestForm('${dateString}')">
                            Termin anfragen
                        </button>
                    </div>
                `;
            } else {
                if (this.customerTimelineView) {
                    appointmentsDiv.innerHTML = this.renderCustomerTimelineView(appointments, selectedDate);
                } else {
                    appointmentsDiv.innerHTML = appointments.map(appointment => `
                        <div class="card mb-2">
                            <div class="card-body p-2">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="mb-1">${appointment.appointment_type_name || 'Behandlung'}</h6>
                                        <p class="mb-1 small"><strong>Zeit:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
                                        <p class="mb-0 small text-muted">${appointment.studio_name}</p>
                                    </div>
                                    <div class="text-end">
                                        <span class="badge ${this.getCustomerStatusBadgeClass(appointment.status)} mb-1">
                                            ${this.getStatusText(appointment.status)}
                                        </span>
                                        ${appointment.status === 'pending' || appointment.status === 'confirmed' ? `
                                            <div class="btn-group-vertical btn-group-sm">
                                                <button class="btn btn-outline-danger btn-sm" onclick="window.app.cancelCustomerAppointment(${appointment.id})">
                                                    Absagen
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
            
        } catch (error) {
            console.error('Error loading day appointments:', error);
            appointmentsDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden der Termine</h6>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async showDayAppointments(dateString) {
        // Show appointments for selected date in a modal or expanded view
        const modalHTML = `
            <div class="modal fade" id="dayAppointmentsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Termine für ${new Date(dateString).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h5>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-secondary" id="customerViewModeList" title="Listenansicht">
                                    <i class="fas fa-list"></i>
                                </button>
                                <button class="btn btn-outline-secondary active" id="customerViewModeTimeline" title="Timeline-Ansicht">
                                    <i class="fas fa-clock"></i>
                                </button>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="dayAppointmentsContent" style="max-height: 600px; overflow-y: auto;">
                            <div class="text-center">
                                <div class="spinner-border" role="status"></div>
                                <p class="mt-2">Lade Termine...</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="window.app.showAppointmentRequestForm('${dateString}')">
                                Neuen Termin anfragen
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('dayAppointmentsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up view mode toggle
        let isTimelineView = true;
        const updateViewMode = (timeline) => {
            const listBtn = document.getElementById('customerViewModeList');
            const timelineBtn = document.getElementById('customerViewModeTimeline');
            
            if (timeline) {
                listBtn.classList.remove('active');
                timelineBtn.classList.add('active');
                isTimelineView = true;
            } else {
                listBtn.classList.add('active');
                timelineBtn.classList.remove('active');
                isTimelineView = false;
            }
            renderAppointments();
        };
        
        document.getElementById('customerViewModeList').addEventListener('click', () => updateViewMode(false));
        document.getElementById('customerViewModeTimeline').addEventListener('click', () => updateViewMode(true));
        
        let appointments = [];
        const selectedDate = new Date(dateString);
        
        const renderAppointments = () => {
            const content = document.getElementById('dayAppointmentsContent');
            
            if (appointments.length === 0) {
                content.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-calendar-times fa-3x mb-3"></i>
                        <p>Keine Termine für diesen Tag.</p>
                    </div>
                `;
                return;
            }
            
            if (isTimelineView) {
                content.innerHTML = this.renderCustomerTimelineView(appointments, selectedDate);
            } else {
                content.innerHTML = appointments.map(appointment => `
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6>${appointment.appointment_type_name || 'Behandlung'}</h6>
                                    <p class="mb-1"><strong>Zeit:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
                                    <p class="mb-1"><strong>Studio:</strong> ${appointment.studio_name}</p>
                                    <p class="mb-0"><small class="text-muted">Erstellt: ${new Date(appointment.created_at).toLocaleDateString('de-DE')}</small></p>
                                </div>
                                <div class="text-end">
                                    <span class="badge ${this.getCustomerStatusBadgeClass(appointment.status)} mb-2">
                                        ${this.getStatusText(appointment.status)}
                                    </span>
                                    <div class="btn-group-vertical btn-group-sm">
                                        ${appointment.status === 'pending' || appointment.status === 'confirmed' ? `
                                            <button class="btn btn-outline-primary btn-sm" onclick="window.app.rescheduleAppointment(${appointment.id})">
                                                Umbuchen
                                            </button>
                                            <button class="btn btn-outline-danger btn-sm mt-1" onclick="window.app.cancelCustomerAppointment(${appointment.id})">
                                                Absagen
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        };
        
        try {
            const data = await window.customerAPI.getMyAppointments({
                from_date: dateString,
                to_date: dateString
            });
            
            appointments = data.appointments || [];
            renderAppointments();
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('dayAppointmentsModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading day appointments:', error);
            document.getElementById('dayAppointmentsContent').innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden der Termine</h6>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    getCustomerStatusBadgeClass(status) {
        
        const classes = {
            // German terms (primary)
            'bestätigt': 'bg-success',
            'abgesagt': 'bg-danger',
            'abgeschlossen': 'bg-info',
            'nicht erschienen': 'bg-warning',
            // English terms (legacy support)
            'confirmed': 'bg-success',
            'cancelled': 'bg-danger',
            'completed': 'bg-info',
            'no_show': 'bg-warning'
        };
        
        
        const result = classes[status] || 'bg-secondary';
        
        
        return result;
    }

    async loadCustomerAppointments() {
        const container = document.getElementById('customerAppointmentsContainer');
        
        if (!container) {
            console.error('❌ customerAppointmentsContainer not found - this should only happen in customer view');
            return;
        }
        
        try {
            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5>Aktuelle Termine</h5>
                    <div>
                        <select class="form-select form-select-sm" id="customerStatusFilter">
                            <option value="">Alle Status</option>
                            <option value="confirmed">Bestätigt</option>
                            <option value="cancelled">Abgesagt</option>
                        </select>
                    </div>
                </div>
                <div id="customerAppointmentsList">
                    <div class="text-center">
                        <div class="spinner-border" role="status"></div>
                        <p class="mt-2">Lade Termine...</p>
                    </div>
                </div>
            `;

            // Set up filter
            document.getElementById('customerStatusFilter').addEventListener('change', () => {
                this.loadCustomerAppointmentsList();
            });

            this.loadCustomerAppointmentsList();
        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden der Termine</h6>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async loadCustomerAppointmentsList() {
        const listContainer = document.getElementById('customerAppointmentsList');
        const statusFilter = document.getElementById('customerStatusFilter')?.value || '';
        
        if (!listContainer) {
            console.error('customerAppointmentsList container not found - loadCustomerAppointments() should be called first');
            return;
        }
        
        try {
            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            
            // Get ALL appointments (both past and upcoming) for "Meine Termine"
            const data = await window.customerAPI.getMyAppointments(filters);
            let appointments = data.appointments || [];
            
            
            // Sort appointments by date and time (newest first)
            appointments.sort((a, b) => {
                const dateTimeA = new Date(`${a.appointment_date}T${a.start_time}`);
                const dateTimeB = new Date(`${b.appointment_date}T${b.start_time}`);
                return dateTimeB - dateTimeA; // Newest first
            });
            
            if (appointments.length === 0) {
                listContainer.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="fas fa-calendar-plus fa-3x mb-3"></i>
                        <h6>Keine ${statusFilter ? 'passenden ' : ''}Termine gefunden</h6>
                        <p>Möchten Sie einen neuen Termin anfragen?</p>
                        <button class="btn btn-primary" onclick="window.app.showAppointmentRequestForm()">
                            Termin anfragen
                        </button>
                    </div>
                `;
                return;
            }
            
            // Separate past and upcoming appointments for better visual distinction
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            listContainer.innerHTML = appointments.map(appointment => {
                const appointmentDate = new Date(appointment.appointment_date);
                const isPast = appointmentDate < today;
                
                return `
                <div class="card mb-3 ${isPast ? 'border-secondary' : ''}">
                    <div class="card-body ${isPast ? 'bg-light' : ''}">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="mb-1 ${isPast ? 'text-muted' : ''}">${appointment.appointment_type_name || 'Behandlung'}</h6>
                                <p class="mb-1 ${isPast ? 'text-muted' : ''}">
                                    <i class="fas fa-calendar me-2"></i>
                                    ${appointmentDate.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    ${isPast ? '<span class="badge bg-secondary ms-2 small">Vergangen</span>' : '<span class="badge bg-primary ms-2 small">Kommend</span>'}
                                </p>
                                <p class="mb-1 ${isPast ? 'text-muted' : ''}">
                                    <i class="fas fa-clock me-2"></i>
                                    ${appointment.start_time} - ${appointment.end_time}
                                </p>
                                <p class="mb-0 ${isPast ? 'text-muted' : ''}">
                                    <i class="fas fa-map-marker-alt me-2"></i>
                                    ${appointment.studio_name}
                                </p>
                            </div>
                            <div class="col-md-4 text-end">
                                <span class="badge ${this.getCustomerStatusBadgeClass(appointment.status)} mb-2 d-block">
                                    ${this.getStatusText(appointment.status)}
                                </span>
                                ${appointment.status === 'pending' || appointment.status === 'confirmed' ? `
                                    <div class="btn-group-vertical btn-group-sm">
                                        <button class="btn btn-outline-primary btn-sm" onclick="window.app.rescheduleAppointment(${appointment.id})">
                                            <i class="fas fa-edit"></i> Umbuchen
                                        </button>
                                        <button class="btn btn-outline-danger btn-sm mt-1" onclick="window.app.cancelCustomerAppointment(${appointment.id})">
                                            <i class="fas fa-times"></i> Absagen
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading customer appointments:', error);
            listContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden der Termine</h6>
                    <p><strong>Details:</strong> ${error.message}</p>
                    <small class="text-muted">Prüfen Sie die Browser-Konsole für weitere Details oder kontaktieren Sie den Support.</small>
                </div>
            `;
        }
    }

    /**
     * Load customer sessions tab content
     */
    async loadCustomerSessionsTab() {
        const container = document.getElementById('customerSessions');
        
        try {
            // Show loading
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                    <p class="mt-2">Lade Behandlungsblöcke...</p>
                </div>
            `;

            const data = await window.customerAPI.getMySessions();
            const blocks = data.blocks || [];
            const totalRemaining = data.totalRemainingSessions || 0;

            container.innerHTML = `
                <div class="row">
                    <div class="col-12">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h5 class="mb-0">
                                <i class="fas fa-dumbbell text-primary me-2"></i>
                                Meine Behandlungsblöcke
                            </h5>
                            <button class="btn btn-primary" onclick="window.app.showCustomerSessionPurchaseModal()">
                                <i class="fas fa-shopping-cart me-1"></i>Neues Paket kaufen
                            </button>
                        </div>

                        <div class="alert alert-info mb-4">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <i class="fas fa-info-circle me-2"></i>
                                    <strong>Gesamt verfügbare Behandlungen: ${totalRemaining}</strong>
                                </div>
                                <small class="text-muted">FIFO-System: Älteste Pakete werden zuerst verbraucht</small>
                            </div>
                        </div>

                        ${blocks.length === 0 ? `
                            <div class="text-center py-5">
                                <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
                                <h5 class="text-muted">Keine aktiven Behandlungsblöcke</h5>
                                <p class="text-muted">Kaufen Sie Ihr erstes Behandlungspaket, um zu beginnen.</p>
                                <button class="btn btn-primary btn-lg" onclick="window.app.showCustomerSessionPurchaseModal()">
                                    <i class="fas fa-shopping-cart me-2"></i>Erstes Paket kaufen
                                </button>
                            </div>
                        ` : `
                            <div class="row g-3">
                                ${blocks.map((block, index) => `
                                    <div class="col-md-6 col-lg-4">
                                        <div class="card h-100 ${block.remaining_sessions === 0 ? 'border-secondary' : index === 0 ? 'border-success' : 'border-primary'}">
                                            <div class="card-body">
                                                <div class="d-flex justify-content-between align-items-start mb-3">
                                                    <h6 class="card-title mb-0">
                                                        Behandlungsblock ${block.block_order || index + 1}
                                                        ${index === 0 && block.remaining_sessions > 0 ? 
                                                            '<br><span class="badge bg-success mt-1">Aktiv</span>' : 
                                                            block.remaining_sessions === 0 ? 
                                                            '<br><span class="badge bg-secondary mt-1">Verbraucht</span>' :
                                                            '<br><span class="badge bg-primary mt-1">Warteschlange</span>'
                                                        }
                                                    </h6>
                                                    <div class="text-end">
                                                        <span class="badge ${block.remaining_sessions > 0 ? 'bg-primary' : 'bg-secondary'} fs-6">
                                                            ${block.remaining_sessions}/${block.total_sessions}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div class="progress mb-3" style="height: 8px;">
                                                    <div class="progress-bar ${block.remaining_sessions > 0 ? (index === 0 ? 'bg-success' : 'bg-primary') : 'bg-secondary'}" 
                                                        style="width: ${(block.remaining_sessions / block.total_sessions) * 100}%"></div>
                                                </div>
                                                
                                                <div class="small text-muted">
                                                    <p class="mb-1">
                                                        <i class="fas fa-calendar me-1"></i>
                                                        Gekauft: ${new Date(block.purchase_date).toLocaleDateString('de-DE')}
                                                    </p>
                                                    <p class="mb-1">
                                                        <i class="fas fa-layer-group me-1"></i>
                                                        Queue-Position: ${index + 1}
                                                    </p>
                                                    ${block.notes ? `
                                                        <p class="mb-0">
                                                            <i class="fas fa-sticky-note me-1"></i>
                                                            ${block.notes}
                                                        </p>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            <div class="card-footer bg-transparent">
                                                <small class="text-muted">
                                                    ${block.remaining_sessions === 0 ? 
                                                        '<i class="fas fa-check-circle text-success me-1"></i>Vollständig genutzt' : 
                                                        `<i class="fas fa-clock text-primary me-1"></i>${block.remaining_sessions} Behandlung${block.remaining_sessions !== 1 ? 'en' : ''} übrig`
                                                    }
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="mt-4 p-3 bg-light rounded">
                                <h6><i class="fas fa-info-circle text-primary me-1"></i>Wie funktioniert das FIFO-System?</h6>
                                <ul class="small mb-0">
                                    <li>Behandlungen werden vom <strong>ältesten Block</strong> (niedrigste Queue-Position) zuerst verbraucht</li>
                                    <li>Erst wenn ein Block <strong>vollständig aufgebraucht</strong> ist, wird der nächste Block aktiviert</li>
                                    <li>Sie können jederzeit <strong>neue Pakete kaufen</strong>, die automatisch ans Ende der Warteschlange gesetzt werden</li>
                                </ul>
                            </div>
                        `}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading customer sessions tab:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <h6><i class="fas fa-exclamation-triangle me-1"></i>Fehler beim Laden der Behandlungsblöcke</h6>
                    <p class="mb-0">${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * Show customer session purchase modal
     */
    async showCustomerSessionPurchaseModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="sessionPurchaseModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-shopping-cart text-primary me-2"></i>
                                Behandlungspaket kaufen
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Wählen Sie ein Paket:</label>
                                <div class="row g-2">
                                    <div class="col-6">
                                        <div class="card h-100 session-package" data-sessions="10">
                                            <div class="card-body text-center">
                                                <h6 class="card-title">10 Behandlungen</h6>
                                                <p class="card-text text-muted small">Ideal für den Einstieg</p>
                                                <div class="badge bg-light text-dark">Basic</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="card h-100 session-package" data-sessions="20">
                                            <div class="card-body text-center">
                                                <h6 class="card-title">20 Behandlungen</h6>
                                                <p class="card-text text-muted small">Beliebt</p>
                                                <div class="badge bg-primary text-white">Standard</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="card h-100 session-package" data-sessions="30">
                                            <div class="card-body text-center">
                                                <h6 class="card-title">30 Behandlungen</h6>
                                                <p class="card-text text-muted small">Beste Wahl</p>
                                                <div class="badge bg-success text-white">Premium</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="card h-100 session-package" data-sessions="40">
                                            <div class="card-body text-center">
                                                <h6 class="card-title">40 Behandlungen</h6>
                                                <p class="card-text text-muted small">Maximaler Wert</p>
                                                <div class="badge bg-warning text-dark">Deluxe</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="purchaseNotes" class="form-label">Notizen (optional):</label>
                                <textarea class="form-control" id="purchaseNotes" rows="2" 
                                    placeholder="Zusätzliche Informationen zu Ihrem Kauf..."></textarea>
                            </div>
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <small>Ihr neues Behandlungspaket wird automatisch zu Ihrer Warteschlange hinzugefügt.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" id="confirmPurchaseBtn" disabled>
                                <i class="fas fa-shopping-cart me-1"></i>Paket kaufen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Set up event listeners
        const packageCards = document.querySelectorAll('.session-package');
        const confirmBtn = document.getElementById('confirmPurchaseBtn');
        let selectedSessionCount = null;

        packageCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove active class from all cards
                packageCards.forEach(c => c.classList.remove('border-primary', 'bg-light'));
                
                // Add active class to selected card
                card.classList.add('border-primary', 'bg-light');
                
                // Update selected session count
                selectedSessionCount = parseInt(card.dataset.sessions);
                
                // Enable confirm button
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = `<i class="fas fa-shopping-cart me-1"></i>${selectedSessionCount} Behandlungen kaufen`;
            });
        });

        confirmBtn.addEventListener('click', async () => {
            if (!selectedSessionCount) return;

            await this.purchaseCustomerSessionBlock(selectedSessionCount);
        });

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('sessionPurchaseModal'));
        modal.show();

        // Clean up modal after hiding
        document.getElementById('sessionPurchaseModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    /**
     * Show today's appointments modal
     */
    async showTodayAppointmentsModal() {
        console.log('showTodayAppointmentsModal called');
        try {
            // First get studio ID
            if (!this.currentStudioId) {
                console.log('Getting studio ID...');
                this.currentStudioId = await this.getCurrentStudioId();
                console.log('Studio ID:', this.currentStudioId);
            }

            // Fetch today's appointments
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/studio/${this.currentStudioId}?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch appointments');
            }

            const data = await response.json();
            const appointments = data.appointments || [];

            // Filter only remaining/pending appointments
            const remainingAppointments = appointments.filter(appointment => 
                appointment.status === 'pending' || 
                appointment.status === 'confirmed' || 
                appointment.status === 'bestätigt'
            );

            const completedAppointments = appointments.filter(appointment => 
                appointment.status === 'completed' || 
                appointment.status === 'abgeschlossen'
            );

            // Create modal HTML
            const modalHTML = `
                <div class="modal fade" id="todayAppointmentsModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-calendar-day text-primary me-2"></i>
                                    Heutige Termine
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-6">
                                        <div class="text-center p-3 bg-primary bg-opacity-10 rounded">
                                            <h4 class="text-primary mb-1">${remainingAppointments.length}</h4>
                                            <small class="text-muted">Verbleibend</small>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="text-center p-3 bg-success bg-opacity-10 rounded">
                                            <h4 class="text-success mb-1">${completedAppointments.length}</h4>
                                            <small class="text-muted">Abgeschlossen</small>
                                        </div>
                                    </div>
                                </div>

                                ${remainingAppointments.length > 0 ? `
                                    <h6 class="text-primary mb-3">
                                        <i class="fas fa-clock me-1"></i>
                                        Verbleibende Termine
                                    </h6>
                                    <div class="list-group mb-4">
                                        ${remainingAppointments.map(appointment => `
                                            <div class="list-group-item">
                                                <div class="d-flex justify-content-between align-items-start">
                                                    <div class="flex-grow-1">
                                                        <h6 class="mb-1">${appointment.customer_first_name || 'Unknown'} ${appointment.customer_last_name || 'Customer'}</h6>
                                                        <p class="mb-1">
                                                            <i class="fas fa-clock me-1"></i>
                                                            ${appointment.start_time} - ${appointment.end_time}
                                                        </p>
                                                        <small class="text-muted">
                                                            <i class="fas fa-envelope me-1"></i>
                                                            ${appointment.customer_email}
                                                        </small>
                                                    </div>
                                                    <div class="text-end">
                                                        <span class="badge bg-primary">${this.getStatusText(appointment.status)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div class="alert alert-info">
                                        <i class="fas fa-info-circle me-2"></i>
                                        Keine verbleibenden Termine für heute.
                                    </div>
                                `}

                                ${completedAppointments.length > 0 ? `
                                    <h6 class="text-success mb-3">
                                        <i class="fas fa-check-circle me-1"></i>
                                        Abgeschlossene Termine
                                    </h6>
                                    <div class="list-group">
                                        ${completedAppointments.map(appointment => `
                                            <div class="list-group-item">
                                                <div class="d-flex justify-content-between align-items-start">
                                                    <div class="flex-grow-1">
                                                        <h6 class="mb-1 text-muted">${appointment.customer_first_name || 'Unknown'} ${appointment.customer_last_name || 'Customer'}</h6>
                                                        <p class="mb-1 text-muted">
                                                            <i class="fas fa-clock me-1"></i>
                                                            ${appointment.start_time} - ${appointment.end_time}
                                                        </p>
                                                        <small class="text-muted">
                                                            <i class="fas fa-envelope me-1"></i>
                                                            ${appointment.customer_email}
                                                        </small>
                                                    </div>
                                                    <div class="text-end">
                                                        <span class="badge bg-success">${this.getStatusText(appointment.status)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('todayAppointmentsModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('todayAppointmentsModal'));
            modal.show();

            // Clean up modal after hiding
            document.getElementById('todayAppointmentsModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });

        } catch (error) {
            console.error('Error loading today\'s appointments:', error);
            this.showErrorMessage('Fehler', 'Heutige Termine konnten nicht geladen werden.');
        }
    }

    /**
     * Purchase session block for customer
     */
    async purchaseCustomerSessionBlock(sessionCount) {
        const confirmBtn = document.getElementById('confirmPurchaseBtn');
        const originalText = confirmBtn.innerHTML;
        
        try {
            // Show loading state
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Wird gekauft...';
            
            const notes = document.getElementById('purchaseNotes').value;
            const result = await window.customerAPI.purchaseSessionBlock(sessionCount, notes);
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('sessionPurchaseModal'));
            modal.hide();
            
            // Show success message
            this.showSuccessMessage(
                'Behandlungspaket erfolgreich gekauft!', 
                `Sie haben ${sessionCount} Behandlungen erworben. Das Paket wurde zu Ihrer Warteschlange hinzugefügt.`
            );
            
            // Reload sessions to show updated count
            await this.loadCustomerSessions();
            
        } catch (error) {
            console.error('Error purchasing session block:', error);
            this.showErrorMessage('Fehler beim Kauf', error.message);
            
            // Reset button
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        }
    }

    /**
     * Show customer session details and block queue
     */
    async showCustomerSessionDetails() {
        try {
            const data = await window.customerAPI.getMySessions();
            const blocks = data.blocks || [];
            const totalRemaining = data.totalRemainingSessions || 0;

            const modalHTML = `
                <div class="modal fade" id="sessionDetailsModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-dumbbell text-primary me-2"></i>
                                    Meine Behandlungsblöcke
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <div class="alert alert-info">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <strong>Gesamt verfügbare Behandlungen: ${totalRemaining}</strong>
                                        <br><small>Behandlungen werden in der Reihenfolge des Kaufs (FIFO) verbraucht.</small>
                                    </div>
                                </div>
                                
                                ${blocks.length === 0 ? `
                                    <div class="text-center text-muted py-4">
                                        <i class="fas fa-calendar-times fa-3x mb-3"></i>
                                        <p>Keine aktiven Behandlungsblöcke</p>
                                        <button class="btn btn-primary" onclick="window.app.showCustomerSessionPurchaseModal()" data-bs-dismiss="modal">
                                            <i class="fas fa-shopping-cart me-1"></i>Erstes Paket kaufen
                                        </button>
                                    </div>
                                ` : `
                                    <div class="row g-3">
                                        ${blocks.map((block, index) => `
                                            <div class="col-md-6">
                                                <div class="card h-100 ${block.remaining_sessions === 0 ? 'border-secondary' : 'border-primary'}">
                                                    <div class="card-body">
                                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                                            <h6 class="card-title mb-0">
                                                                Block ${block.block_order || index + 1}
                                                                ${index === 0 && block.remaining_sessions > 0 ? 
                                                                    '<span class="badge bg-success ms-2">Aktiv</span>' : ''}
                                                            </h6>
                                                            <span class="badge ${block.remaining_sessions > 0 ? 'bg-primary' : 'bg-secondary'}">
                                                                ${block.remaining_sessions}/${block.total_sessions}
                                                            </span>
                                                        </div>
                                                        <p class="card-text small text-muted mb-2">
                                                            Gekauft: ${new Date(block.purchase_date).toLocaleDateString('de-DE')}
                                                        </p>
                                                        <div class="progress mb-2" style="height: 6px;">
                                                            <div class="progress-bar ${block.remaining_sessions > 0 ? 'bg-primary' : 'bg-secondary'}" 
                                                                style="width: ${(block.remaining_sessions / block.total_sessions) * 100}%"></div>
                                                        </div>
                                                        <small class="text-muted">
                                                            ${block.remaining_sessions === 0 ? 'Vollständig genutzt' : 
                                                              `${block.remaining_sessions} Behandlung${block.remaining_sessions !== 1 ? 'en' : ''} übrig`}
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                    
                                    <div class="text-center mt-4">
                                        <button class="btn btn-outline-primary" onclick="window.app.showCustomerSessionPurchaseModal()" data-bs-dismiss="modal">
                                            <i class="fas fa-plus me-1"></i>Weiteres Paket kaufen
                                        </button>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('sessionDetailsModal'));
            modal.show();

            // Clean up modal after hiding
            document.getElementById('sessionDetailsModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });

        } catch (error) {
            console.error('Error loading session details:', error);
            this.showErrorMessage('Fehler beim Laden', 'Behandlungsblöcke konnten nicht geladen werden.');
        }
    }


    async showAppointmentRequestForm(preselectedDate = null) {
        // Check session availability first
        try {
            const sessionResponse = await fetch(`${window.API_BASE_URL}/api/v1/customers/me/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                const sessions = sessionData.sessions || [];
                const totalRemaining = sessions.reduce((sum, session) => {
                    return session.is_active ? sum + session.remaining_sessions : sum;
                }, 0);
                
                if (totalRemaining <= 0) {
                    this.showErrorMessage('Keine Behandlungen verfügbar', 
                        'Sie haben keine verbleibenden Behandlungen. Bitte kontaktieren Sie Ihr Studio, um ein neues Paket zu erwerben.');
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking session availability:', error);
            // Continue anyway if session check fails
        }
        const modalHTML = `
            <div class="modal fade" id="appointmentRequestModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Termin anfragen</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="studioInfoSection" class="mb-3">
                                <div class="text-center">
                                    <div class="spinner-border spinner-border-sm" role="status"></div>
                                    <span class="ms-2">Lade Studio-Informationen...</span>
                                </div>
                            </div>
                            <form id="appointmentRequestForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="appointmentDate" class="form-label">Wunschdatum</label>
                                        <input type="date" class="form-control" id="appointmentDate" required 
                                               min="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="appointmentTime" class="form-label">Wunschzeit</label>
                                        <select class="form-select" id="appointmentTime" required>
                                            <option value="">Bitte wählen...</option>
                                            <option value="08:00">08:00 Uhr</option>
                                            <option value="09:00">09:00 Uhr</option>
                                            <option value="10:00">10:00 Uhr</option>
                                            <option value="11:00">11:00 Uhr</option>
                                            <option value="12:00">12:00 Uhr</option>
                                            <option value="13:00">13:00 Uhr</option>
                                            <option value="14:00">14:00 Uhr</option>
                                            <option value="15:00">15:00 Uhr</option>
                                            <option value="16:00">16:00 Uhr</option>
                                            <option value="17:00">17:00 Uhr</option>
                                            <option value="18:00">18:00 Uhr</option>
                                            <option value="19:00">19:00 Uhr</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="appointmentType" class="form-label">Behandlungsart</label>
                                    <select class="form-select" id="appointmentType" required>
                                        <option value="">Lade Behandlungsarten...</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="appointmentNotes" class="form-label">Anmerkungen (optional)</label>
                                    <textarea class="form-control" id="appointmentNotes" rows="3" 
                                              placeholder="Besondere Wünsche oder Anmerkungen..."></textarea>
                                </div>
                                <div class="alert alert-info">
                                    <small>
                                        <i class="fas fa-info-circle"></i>
                                        Ihr Terminwunsch wird an Ihr Studio gesendet und muss noch bestätigt werden.
                                    </small>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" id="submitAppointmentRequest">
                                <i class="fas fa-paper-plane"></i> Anfrage senden
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('appointmentRequestModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set preselected date if provided (wait for DOM to be ready)
        setTimeout(() => {
            if (preselectedDate) {
                const dateInput = document.getElementById('appointmentDate');
                if (dateInput) {
                    // Use the timezone-safe date formatter
                    const dateValue = this.formatDateForInput(preselectedDate);
                    dateInput.value = dateValue;
                }
            }
        }, 10);
        
        // Load customer's studio and appointment types
        this.loadCustomerStudioForRequest();
        
        // Set up form submission
        document.getElementById('submitAppointmentRequest').addEventListener('click', () => {
            this.submitAppointmentRequest();
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('appointmentRequestModal'));
        modal.show();
    }

    async loadCustomerStudioForRequest() {
        try {
            // Get customer's associated studio
            const studioData = await window.customerAPI.getMyStudio();
            const studio = studioData.studio;
            
            // Store studio ID for form submission
            this.customerStudioId = studio.id;
            
            // Display studio information
            const studioInfoSection = document.getElementById('studioInfoSection');
            studioInfoSection.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="mb-1">Ihr Studio</h6>
                                <p class="mb-1"><strong>${studio.name}</strong></p>
                                <p class="mb-0 text-muted">
                                    <i class="fas fa-map-marker-alt me-1"></i>
                                    ${studio.address}, ${studio.city}
                                </p>
                            </div>
                            <div class="col-md-4 text-end">
                                <span class="badge bg-success">Zugeordnet</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Load appointment types for this studio
            this.loadAppointmentTypesForRequest(studio.id);
            
        } catch (error) {
            console.error('Error loading customer studio:', error);
            const studioInfoSection = document.getElementById('studioInfoSection');
            studioInfoSection.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden der Studio-Informationen</h6>
                    <p>${error.message}</p>
                    <small>Bitte kontaktieren Sie den Support, wenn dieses Problem weiterhin auftritt.</small>
                </div>
            `;
        }
    }

    async loadAppointmentTypesForRequest(studioId) {
        if (!studioId) {
            document.getElementById('appointmentType').innerHTML = `
                <option value="">Studio wird geladen...</option>
            `;
            return;
        }
        
        try {
            const data = await window.customerAPI.getStudioAppointmentTypes(studioId);
            const types = data.appointmentTypes || [];
            
            const typeSelect = document.getElementById('appointmentType');
            typeSelect.innerHTML = `
                <option value="">Bitte wählen...</option>
                ${types.map(type => {
                    const selected = type.name === 'Behandlung' ? 'selected' : '';
                    return `<option value="${type.id}" ${selected}>${type.name}${type.duration ? ` (${type.duration} Min.)` : ''}</option>`;
                }).join('')}
            `;
            
            // Auto-select "Behandlung" if found
            const abnehmenType = types.find(type => type.name === 'Behandlung');
            if (abnehmenType) {
                typeSelect.value = abnehmenType.id;
            }
        } catch (error) {
            console.error('Error loading appointment types:', error);
            document.getElementById('appointmentType').innerHTML = `
                <option value="">Fehler beim Laden der Behandlungsarten</option>
            `;
        }
    }

    async submitAppointmentRequest() {
        const form = document.getElementById('appointmentRequestForm');
        const submitBtn = document.getElementById('submitAppointmentRequest');
        
        // Validate form
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Ensure we have the customer's studio ID
        if (!this.customerStudioId) {
            this.showErrorMessage('Fehler', 'Studio-Informationen konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
            return;
        }
        
        // Final session availability check
        try {
            const sessionResponse = await fetch(`${window.API_BASE_URL}/api/v1/customers/me/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                const sessions = sessionData.sessions || [];
                const totalRemaining = sessions.reduce((sum, session) => {
                    return session.is_active ? sum + session.remaining_sessions : sum;
                }, 0);
                
                if (totalRemaining <= 0) {
                    this.showErrorMessage('Keine Behandlungen verfügbar', 
                        'Sie haben keine verbleibenden Behandlungen mehr. Bitte kontaktieren Sie Ihr Studio, um ein neues Paket zu erwerben.');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Anfrage senden';
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking session availability:', error);
            // Continue with appointment request even if session check fails
        }
        
        const appointmentData = {
            appointment_date: document.getElementById('appointmentDate').value,
            start_time: document.getElementById('appointmentTime').value,
            studio_id: this.customerStudioId,
            appointment_type_id: parseInt(document.getElementById('appointmentType').value),
            notes: document.getElementById('appointmentNotes').value
        };
        
        // Validate appointment data
        
        if (!appointmentData.appointment_date || !appointmentData.start_time || !appointmentData.studio_id || !appointmentData.appointment_type_id) {
            this.showErrorMessage('Validation Error', 'Alle Pflichtfelder müssen ausgefüllt werden.');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Wird gesendet...';
        
        try {
            await window.customerAPI.requestAppointment(appointmentData);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('appointmentRequestModal'));
            modal.hide();
            
            // Show success message
            this.showSuccessMessage('Terminanfrage erfolgreich gesendet!', 'Das Studio wird Ihre Anfrage prüfen und sich bei Ihnen melden.');
            
            // Refresh calendar, appointments, and session counter
            this.loadCustomerCalendar();
            this.loadCustomerAppointments();
            this.loadCustomerSessions();
        } catch (error) {
            console.error('Error submitting appointment request:', error);
            this.showErrorMessage('Fehler beim Senden der Anfrage', error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Anfrage senden';
        }
    }

    async cancelCustomerAppointment(appointmentId) {
        if (!confirm('Möchten Sie diesen Termin wirklich absagen?')) {
            return;
        }
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}/cancel`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: 'Stornierung durch Kunden'
                })
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle advance notice requirement errors
                if (response.status === 400 && result.requiredHours) {
                    this.showErrorMessage(
                        'Stornierung nicht möglich', 
                        `Terminabsagen sind nur ${result.requiredHours} Stunden im Voraus möglich. ` +
                        `Sie haben noch ${result.currentHours} Stunden Zeit. ` +
                        `Bitte kontaktieren Sie das Studio für kurzfristige Änderungen.`
                    );
                    return;
                }
                throw new Error(result.message || 'Fehler beim Absagen des Termins');
            }

            this.showSuccessMessage(
                'Termin abgesagt', 
                `Ihr Termin wurde erfolgreich abgesagt. Sie erhielten ${result.appointment.advance_notice_hours} Stunden Vorlaufzeit.`
            );
            
            // Refresh views
            this.loadCustomerCalendar();
            this.loadCustomerAppointments();
            this.loadCustomerSessions(); // Refresh session count if restored

        } catch (error) {
            console.error('Error cancelling appointment:', error);
            this.showErrorMessage('Fehler beim Absagen', error.message);
        }
    }

    async rescheduleAppointment(appointmentId) {
        try {
            // First check if appointment can be postponed
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}/can-postpone`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Fehler beim Prüfen der Umbuchung');
            }

            if (!result.canPostpone) {
                this.showErrorMessage(
                    'Umbuchung nicht möglich',
                    result.reason || 'Dieser Termin kann nicht umgebucht werden.'
                );
                return;
            }

            // Check advance notice requirement
            if (result.currentHours < result.requiredHours) {
                this.showErrorMessage(
                    'Umbuchung nicht möglich',
                    `Terminumbuchungen sind nur ${result.requiredHours} Stunden im Voraus möglich. ` +
                    `Sie haben noch ${result.currentHours} Stunden Zeit. ` +
                    `Bitte kontaktieren Sie das Studio für kurzfristige Änderungen.`
                );
                return;
            }

            // Show appointment request form for rescheduling
            this.showSuccessMessage(
                'Umbuchung möglich',
                `Sie können Ihren Termin vom ${result.appointment.date} um ${result.appointment.time} Uhr umbuchen. ` +
                `Bitte wählen Sie einen neuen Termin. Ihr alter Termin wird automatisch storniert.`
            );
            
            this.showAppointmentRequestForm();

        } catch (error) {
            console.error('Error checking reschedule eligibility:', error);
            this.showErrorMessage('Fehler beim Umbuchen', error.message);
        }
    }

    showSuccessMessage(title, message) {
        // Simple success message - could be enhanced with a toast library
        alert(`${title}: ${message}`);
    }

    showErrorMessage(title, message) {
        // Simple error message - could be enhanced with a toast library
        alert(`${title}: ${message}`);
    }

    showInfoMessage(title, message) {
        // Simple info message - could be enhanced with a toast library
        alert(`${title}: ${message}`);
    }

    showStudioDashboard() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="container-fluid p-4">
                <!-- Welcome Header -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="glass-card p-4">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <h1 class="h3 mb-1">Willkommen zurück, ${this.currentUser.firstName}!</h1>
                                    <p class="text-muted mb-0">Hier ist Ihr Studio-Überblick für heute</p>
                                </div>
                                <div class="text-end">
                                    <div class="text-muted small">${new Date().toLocaleDateString('de-DE', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                    })}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Metrics Grid -->
                <div class="metrics-grid" id="dashboardMetrics">
                    ${this.createLoadingMetrics()}
                </div>

                <!-- Studio Status -->
                <div class="row">
                    <div class="col-12">
                        <div class="glass-card p-4 mb-4">
                            <h5 class="mb-3">Studio Status</h5>
                            <div id="studioStatus">
                                <div class="text-center">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2 text-muted">Lade Studio-Informationen...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Check if user has a studio and load metrics
        this.checkStudioStatus();
        this.loadDashboardMetrics();
        
        // Set up auto-refresh for dashboard metrics every 30 seconds
        this.metricsRefreshInterval = setInterval(() => {
            this.loadDashboardMetrics();
        }, 30000);
    }

    createLoadingMetrics() {
        const metrics = [
            { title: 'Aktive Kunden', icon: 'fas fa-users', gradient: 'gradient-purple' },
            { title: 'Heutige Termine', icon: 'fas fa-calendar-day', gradient: 'gradient-blue' },
            { title: 'Auslastung', icon: 'fas fa-chart-line', gradient: 'gradient-orange' }
        ];

        return metrics.map(metric => `
            <div class="metric-card loading">
                <div class="metric-card-content">
                    <div class="metric-info">
                        <div class="metric-value">000</div>
                        <div class="metric-title">${metric.title}</div>
                        <div class="metric-change">Loading</div>
                    </div>
                    <div class="metric-icon-wrapper ${metric.gradient}">
                        <i class="${metric.icon}"></i>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadDashboardMetrics() {
        try {
            // Simulate API calls - replace with real data
            const metrics = await this.fetchStudioMetrics();
            this.renderDashboardMetrics(metrics);
        } catch (error) {
            console.error('Error loading dashboard metrics:', error);
            this.renderDashboardMetrics(this.getDefaultMetrics());
        }
    }

    async fetchStudioMetrics() {
        try {
            // Get studio ID
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            let studioId = user.studio_id;
            
            if (!studioId) {
                const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/my-studio`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    studioId = data.studio.id;
                }
            }

            if (!studioId) {
                throw new Error('Studio ID not found');
            }

            // Fetch real dashboard statistics
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/dashboard-stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard stats');
            }

            const data = await response.json();
            return data.stats;
        } catch (error) {
            console.error('Error fetching studio metrics:', error);
            // Return default values on error
            return this.getDefaultMetrics();
        }
    }

    getDefaultMetrics() {
        return {
            activeCustomers: { value: 0, change: 'Keine Daten', changeType: 'neutral' },
            todayAppointments: { value: 0, change: 'Keine Termine', changeType: 'neutral' },
            utilization: { value: '0%', change: 'Noch keine Auslastung', changeType: 'neutral' }
        };
    }

    renderDashboardMetrics(metrics) {
        const metricsContainer = document.getElementById('dashboardMetrics');
        if (!metricsContainer) return;

        const metricConfigs = [
            { 
                key: 'activeCustomers', 
                title: 'Aktive Kunden', 
                icon: 'fas fa-users', 
                gradient: 'gradient-purple' 
            },
            { 
                key: 'todayAppointments', 
                title: 'Heutige Termine', 
                icon: 'fas fa-calendar-day', 
                gradient: 'gradient-blue' 
            },
            { 
                key: 'utilization', 
                title: 'Auslastung', 
                icon: 'fas fa-chart-line', 
                gradient: 'gradient-orange' 
            }
        ];

        const metricCards = metricConfigs.map((config, index) => {
            const data = metrics[config.key];
            let clickableClass = '';
            let clickHandler = '';
            
            if (config.key === 'activeCustomers') {
                clickableClass = 'metric-card-clickable';
                clickHandler = `onclick="app.navigateToKundenWithFilter()"`;
            } else if (config.key === 'todayAppointments') {
                clickableClass = 'metric-card-clickable';
                clickHandler = `onclick="app.showTodayAppointments()"`;
            } else if (config.key === 'utilization') {
                clickableClass = 'metric-card-clickable';
                clickHandler = `onclick="app.showAuslastungModal()"`;
            }
            
            return `
                <div class="metric-card ${clickableClass}" style="animation-delay: ${index * 0.1}s" ${clickHandler}>
                    <div class="metric-card-content">
                        <div class="metric-info">
                            <div class="metric-value">${data.value}</div>
                            <div class="metric-title">${config.title}</div>
                            <div class="metric-change ${data.changeType}">${data.change}</div>
                        </div>
                        <div class="metric-icon-wrapper ${config.gradient}">
                            <i class="${config.icon}"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        metricsContainer.innerHTML = metricCards;

        // Add animation classes
        setTimeout(() => {
            const cards = metricsContainer.querySelectorAll('.metric-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    card.style.transition = 'all 0.6s ease';
                    
                    requestAnimationFrame(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    });
                }, index * 100);
            });
        }, 100);
    }

    async checkStudioStatus() {
        const statusDiv = document.getElementById('studioStatus');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/my-studio`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const studio = data.studio;
                
                statusDiv.innerHTML = `
                    <div class="glass-card p-3 mb-3">
                        <h6 class="mb-3"><i class="fas fa-building me-2"></i>${studio.name}</h6>
                        <div class="studio-info">
                            <div class="info-item mb-2">
                                <i class="fas fa-map-marker-alt text-primary me-2"></i>
                                <strong>Stadt:</strong> ${studio.city}
                            </div>
                            <div class="info-item mb-2">
                                <i class="fas fa-home text-primary me-2"></i>
                                <strong>Adresse:</strong> ${studio.address}
                            </div>
                            <div class="info-item">
                                <i class="fas fa-phone text-primary me-2"></i>
                                <strong>Telefon:</strong> ${studio.phone}
                            </div>
                        </div>
                    </div>
                `;

                
            } else if (response.status === 404) {
                statusDiv.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Studio wird initialisiert...
                    </div>
                `;
            }
            
        } catch (error) {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden des Studio-Status: ${error.message}
                </div>
            `;
        }
    }

    showStudioLeadManagement(studioId) {
        console.log('showStudioLeadManagement called with studioId:', studioId);
        console.log('window.leadKanban available:', !!window.leadKanban);
        console.log('window.leadManagement available:', !!window.leadManagement);
        
        // Initialize Lead Kanban for the studio
        const content = document.getElementById('content');
        content.innerHTML = `<div id="lead-kanban-content"></div>`;
        
        if (window.leadKanban) {
            console.log('Using Lead Kanban');
            window.leadKanban.init(studioId);
        } else if (window.leadManagement) {
            console.log('Falling back to old Lead Management');
            // Fallback to old Lead Management if Kanban not loaded
            content.innerHTML = `<div id="lead-management-content"></div>`;
            window.leadManagement.init(studioId);
        } else {
            console.error('Lead Kanban component not loaded');
            content.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Error</h4>
                    <p>Lead Kanban component failed to load. Please refresh the page.</p>
                    <button class="btn btn-outline-primary" onclick="app.showStudioDashboard()">
                        <i class="bi bi-arrow-left me-2"></i>
                        Back to Dashboard
                    </button>
                </div>
            `;
        }
    }

    showActivationCodeGeneration(studioId) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Aktivierungscodes generieren</h4>
                            <button class="btn btn-outline-secondary" id="backToCodesListBtn">
                                <i class="fas fa-arrow-left me-2"></i>
                                Zurück
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="activationCodeError" class="alert alert-danger d-none"></div>
                            <div id="activationCodeSuccess" class="alert alert-success d-none"></div>
                            <div class="text-center mb-4">
                                <p class="mb-3">
                                    <i class="fas fa-info-circle text-info me-2"></i>
                                    Es wird <strong>1 Aktivierungscode</strong> mit einer Gültigkeit von <strong>3 Tagen</strong> generiert.
                                </p>
                            </div>
                            <form id="activationCodeForm">
                                <button type="submit" class="btn btn-primary w-100" id="generateActivationSubmitBtn">
                                    <i class="fas fa-plus-circle me-2"></i>
                                    Aktivierungscode generieren
                                </button>
                            </form>
                            <hr>
                            <div class="d-flex justify-content-center">
                                <button class="btn btn-outline-info" id="viewExistingCodesBtn">
                                    <i class="fas fa-list me-2"></i>
                                    Vorhandene Codes anzeigen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('activationCodeForm').addEventListener('submit', (e) => {
            this.handleActivationCodeGeneration(e, studioId);
        });

        document.getElementById('viewExistingCodesBtn').addEventListener('click', () => {
            this.showExistingActivationCodes(studioId);
        });

        // Add new button event listeners with null checks
        const backToListBtn = document.getElementById('backToCodesListBtn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', () => {
                this.showExistingActivationCodes(studioId);
            });
        }

    }

    async handleActivationCodeGeneration(e, studioId) {
        e.preventDefault();
        
        // Fixed values: 1 code, 3-day expiry (as per business requirements)
        const formData = {
            count: 1,
            expiresInDays: 3
        };
        
        const submitBtn = document.getElementById('generateActivationSubmitBtn');
        const errorDiv = document.getElementById('activationCodeError');
        const successDiv = document.getElementById('activationCodeSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generiere Code...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/activation-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Generieren der Codes');
            }
            
            const data = await response.json();
            
            successDiv.innerHTML = `
                <strong>${data.message}</strong><br>
                <small>Die Codes können Sie nun an Ihre Kunden weitergeben.</small>
            `;
            successDiv.classList.remove('d-none');
            
            // Form reset (no fields to reset anymore)
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Aktivierungscode generieren';
        }
    }

    showExistingActivationCodes(studioId) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-10 mx-auto">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Vorhandene Aktivierungscodes</h4>
                            <button class="btn btn-outline-secondary" id="backFromCodesBtn">
                                <i class="fas fa-arrow-left me-2"></i>
                                Zurück
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="activationCodesList">
                                <div class="text-center">
                                    <div class="spinner-border" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Lade Aktivierungscodes...</p>
                                </div>
                            </div>
                            <hr class="my-4">
                            <div class="d-flex justify-content-center">
                                <button class="btn btn-primary" id="generateNewCodeBtn">
                                    <i class="fas fa-plus-circle me-2"></i>
                                    Neuen Code generieren
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners with null checks
        const backBtn = document.getElementById('backFromCodesBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showStudioDashboard();
            });
        }

        const generateBtn = document.getElementById('generateNewCodeBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.showActivationCodeGeneration(studioId);
            });
        }


        this.loadExistingActivationCodes(studioId);
    }

    async loadExistingActivationCodes(studioId) {
        const codesDiv = document.getElementById('activationCodesList');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/activation-codes`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load activation codes');
            }
            
            const data = await response.json();
            const codes = data.codes.codes || [];
            
            if (codes.length === 0) {
                codesDiv.innerHTML = `
                    <div class="text-center">
                        <p>Keine Aktivierungscodes vorhanden.</p>
                        <button class="btn btn-primary" id="generateFirstCodesBtn">
                            Erste Codes generieren
                        </button>
                    </div>
                `;
                
                document.getElementById('generateFirstCodesBtn').addEventListener('click', () => {
                    this.showActivationCodeGeneration(studioId);
                });
            } else {
                codesDiv.innerHTML = `
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Status</th>
                                    <th>Verwendung</th>
                                    <th>Erstellt</th>
                                    <th>Ablauf</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${codes.map(code => `
                                    <tr>
                                        <td><strong>${code.code}</strong></td>
                                        <td>
                                            <span class="badge ${code.is_used ? 'bg-success' : 'bg-primary'}">
                                                ${code.is_used ? 'Verwendet' : 'Aktiv'}
                                            </span>
                                        </td>
                                        <td>
                                            ${code.is_used ? 
                                                `${code.first_name} ${code.last_name} (${code.used_by_email})` : 
                                                'Nicht verwendet'
                                            }
                                        </td>
                                        <td>${new Date(code.created_at).toLocaleDateString()}</td>
                                        <td>${code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Kein Ablauf'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            
        } catch (error) {
            codesDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden der Aktivierungscodes: ${error.message}
                </div>
            `;
        }
    }

    showStudioRegister() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header">
                            <h4>Studio Registrierung</h4>
                        </div>
                        <div class="card-body">
                            <div id="studioRegisterError" class="alert alert-danger d-none"></div>
                            <div id="studioRegisterSuccess" class="alert alert-success d-none"></div>
                            <form id="studioRegisterForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioFirstName" class="form-label">Vorname</label>
                                            <input type="text" class="form-control" id="studioFirstName" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioLastName" class="form-label">Nachname</label>
                                            <input type="text" class="form-control" id="studioLastName" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="studioRegisterEmail" class="form-label">E-Mail</label>
                                    <input type="email" class="form-control" id="studioRegisterEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label for="studioRegisterPassword" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="studioRegisterPassword" required>
                                    <div class="form-text">
                                        Mindestens 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe und eine Zahl
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="studioConfirmPassword" class="form-label">Passwort wiederholen *</label>
                                    <input type="password" class="form-control" id="studioConfirmPassword" required>
                                </div>
                                <div class="mb-3">
                                    <label for="studioPhone" class="form-label">Telefon *</label>
                                    <input type="tel" class="form-control" id="studioPhone" required>
                                </div>
                                
                                <h5 class="mb-3 mt-4">Adresse</h5>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioCountry" class="form-label">Land *</label>
                                            <select class="form-control" id="studioCountry" required>
                                                <option value="Österreich" selected>Österreich</option>
                                                <option value="Deutschland">Deutschland</option>
                                                <option value="Schweiz">Schweiz</option>
                                                <option value="Italien">Italien</option>
                                                <option value="Slowenien">Slowenien</option>
                                                <option value="Tschechien">Tschechien</option>
                                                <option value="Ungarn">Ungarn</option>
                                                <option value="Slowakei">Slowakei</option>
                                                <option value="Kroatien">Kroatien</option>
                                                <option value="Andere">Andere</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioPostalCode" class="form-label">PLZ *</label>
                                            <input type="text" class="form-control" id="studioPostalCode" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="studioCity" class="form-label">Ort *</label>
                                    <input type="text" class="form-control" id="studioCity" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-8">
                                        <div class="mb-3">
                                            <label for="studioStreet" class="form-label">Straße *</label>
                                            <input type="text" class="form-control" id="studioStreet" required>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="studioHouseNumber" class="form-label">Haus NR/Stiege *</label>
                                            <input type="text" class="form-control" id="studioHouseNumber" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="studioDoorApartment" class="form-label">Tür</label>
                                    <input type="text" class="form-control" id="studioDoorApartment">
                                    <div class="form-text">Optional - Wohnungs- oder Büronummer</div>
                                </div>
                                
                                <h5 class="mb-3 mt-4">Rechtliches</h5>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="termsAccepted" required>
                                        <label class="form-check-label" for="termsAccepted">
                                            Ich akzeptiere die <a href="/terms-conditions.html" target="_blank">Allgemeinen Geschäftsbedingungen</a> *
                                        </label>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="privacyAccepted" required>
                                        <label class="form-check-label" for="privacyAccepted">
                                            Ich akzeptiere die <a href="/privacy-policy.html" target="_blank">Datenschutzerklärung</a> *
                                        </label>
                                    </div>
                                </div>
                                
                                <button type="submit" class="btn btn-primary w-100 btn-lg" id="studioRegisterSubmitBtn">Jetzt registrieren</button>
                            </form>
                            <hr>
                            <div class="text-center">
                                <small>Bereits registriert? <a href="#" id="showStudioLoginLink">Anmelden</a></small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('studioRegisterForm').addEventListener('submit', (e) => {
            this.handleStudioRegister(e);
        });

        document.getElementById('showStudioLoginLink')?.addEventListener('click', () => {
            this.showStudioLogin();
        });
    }

    async handleStudioRegister(e) {
        e.preventDefault();
        
        // Validate password confirmation
        const password = document.getElementById('studioRegisterPassword').value;
        const confirmPassword = document.getElementById('studioConfirmPassword').value;
        
        if (password !== confirmPassword) {
            const errorDiv = document.getElementById('studioRegisterError');
            errorDiv.textContent = 'Passwörter stimmen nicht überein';
            errorDiv.classList.remove('d-none');
            return;
        }
        
        const formData = {
            firstName: document.getElementById('studioFirstName').value,
            lastName: document.getElementById('studioLastName').value,
            email: document.getElementById('studioRegisterEmail').value,
            password: password,
            confirmPassword: confirmPassword,
            phone: document.getElementById('studioPhone').value,
            country: document.getElementById('studioCountry').value,
            postalCode: document.getElementById('studioPostalCode').value,
            city: document.getElementById('studioCity').value,
            street: document.getElementById('studioStreet').value,
            houseNumber: document.getElementById('studioHouseNumber').value,
            doorApartment: document.getElementById('studioDoorApartment').value,
            termsAccepted: document.getElementById('termsAccepted').checked,
            privacyAccepted: document.getElementById('privacyAccepted').checked
        };
        
        const submitBtn = document.getElementById('studioRegisterSubmitBtn');
        const errorDiv = document.getElementById('studioRegisterError');
        const successDiv = document.getElementById('studioRegisterSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registriere Studio...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const result = await window.authService.registerStudio(formData);
            
            successDiv.innerHTML = `
                <strong>Studio-Registrierung erfolgreich!</strong><br>
                Bitte überprüfen Sie Ihre E-Mail für die Verifizierung.<br>
                <small class="text-muted">💡 <strong>Tipp:</strong> Falls die E-Mail nicht ankommt, schauen Sie auch in Ihren Spam-Ordner.</small>
            `;
            successDiv.classList.remove('d-none');
            
            setTimeout(() => {
                this.showStudioLogin();
            }, 3000);
            
        } catch (error) {
            console.error('Studio registration error:', error);
            
            // Check for specific error codes
            if (error.code === 'EMAIL_NOT_VERIFIED') {
                errorDiv.innerHTML = `
                    <div class="mb-3">
                        <strong>E-Mail bereits registriert aber nicht verifiziert</strong><br>
                        Bitte überprüfen Sie Ihre E-Mail (auch den Spam-Ordner) für den Verifizierungslink.
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="app.resendVerificationEmail('${formData.email}')">
                        Verifizierungs-E-Mail erneut senden
                    </button>
                `;
            } else if (error.code === 'EMAIL_SEND_FAILED') {
                errorDiv.innerHTML = `
                    <div class="mb-3">
                        <strong>E-Mail konnte nicht gesendet werden</strong><br>
                        Ihre Registrierung war erfolgreich, aber die Verifizierungs-E-Mail konnte nicht gesendet werden.
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="app.resendVerificationEmail('${formData.email}')">
                        Verifizierungs-E-Mail erneut senden
                    </button>
                `;
            } else {
                errorDiv.textContent = error.message;
            }
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Studio Registrieren';
        }
    }

    async resendVerificationEmail(email) {
        const errorDiv = document.getElementById('studioRegisterError');
        const successDiv = document.getElementById('studioRegisterSuccess');
        
        try {
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const result = await window.authService.resendVerificationEmail(email);
            
            successDiv.innerHTML = `
                <strong>Verifizierungs-E-Mail erneut gesendet!</strong><br>
                Bitte überprüfen Sie Ihre E-Mail (auch den Spam-Ordner).<br>
                <small class="text-muted">Verbleibende Versuche: ${result.attemptsRemaining || 'Unbekannt'}</small>
            `;
            successDiv.classList.remove('d-none');
            
        } catch (error) {
            console.error('Resend verification error:', error);
            
            if (error.message.includes('TOO_MANY_ATTEMPTS')) {
                errorDiv.innerHTML = `
                    <strong>Zu viele Versuche</strong><br>
                    Sie haben das Limit für Verifizierungs-E-Mails erreicht. Bitte versuchen Sie es später erneut.
                `;
            } else {
                errorDiv.textContent = error.message;
            }
            errorDiv.classList.remove('d-none');
        }
    }

    showLoginModal() {
        // Redirect to studio login since customer login is removed
        this.showStudioLogin();
    }

    showRegisterModal() {
        // Redirect to studio login since customer registration is removed
        this.showStudioLogin();
    }

    showManagerLogin() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6 mx-auto">
                    <div class="text-center mb-3">
                        <h2><a href="#" class="text-decoration-none" id="brandLinkManager"><img src="assets/images/LOgo AIL.png" alt="Abnehmen im Liegen" style="height: 60px;"></a></h2>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <h4>Manager Login</h4>
                        </div>
                        <div class="card-body">
                            <div id="managerLoginError" class="alert alert-danger d-none"></div>
                            <form id="managerLoginForm">
                                <div class="mb-3">
                                    <label for="managerEmail" class="form-label">Manager E-Mail</label>
                                    <input type="email" class="form-control" id="managerEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label for="managerPassword" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="managerPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="managerLoginSubmitBtn">Login</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('managerLoginForm').addEventListener('submit', (e) => {
            this.handleManagerLogin(e);
        });
        document.getElementById('brandLinkManager')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showMainPage();
        });
    }

    async handleManagerLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('managerEmail').value;
        const password = document.getElementById('managerPassword').value;
        const submitBtn = document.getElementById('managerLoginSubmitBtn');
        const errorDiv = document.getElementById('managerLoginError');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            errorDiv.classList.add('d-none');
            
            const result = await window.authService.login(email, password);
            this.currentUser = result.user;
            this.updateUIForAuthenticatedUser();
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    showManagerDashboard() {
        // Initialize the new Manager Dashboard
        if (window.managerDashboard) {
            window.managerDashboard.init();
        } else {
            console.error('Manager Dashboard component not loaded');
            const content = document.getElementById('content');
            content.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Error</h4>
                    <p>Manager Dashboard component failed to load. Please refresh the page.</p>
                </div>
            `;
        }
    }


    showCodeGenerationForm() {
        const content = document.getElementById('managerContent');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Manager Code generieren</h5>
                        </div>
                        <div class="card-body">
                            <div id="codeGenerationError" class="alert alert-danger d-none"></div>
                            <div id="codeGenerationSuccess" class="alert alert-success d-none"></div>
                            <form id="codeGenerationForm">
                                <div class="mb-3">
                                    <label for="intendedOwnerName" class="form-label">Inhaber Name</label>
                                    <input type="text" class="form-control" id="intendedOwnerName" required
                                           placeholder="Vor- und Nachname des zukünftigen Studio-Inhabers">
                                </div>
                                <div class="mb-3">
                                    <label for="intendedCity" class="form-label">Stadt</label>
                                    <input type="text" class="form-control" id="intendedCity" required
                                           placeholder="Stadt des Studios">
                                </div>
                                <div class="mb-3">
                                    <label for="intendedStudioName" class="form-label">Studio Name (Optional)</label>
                                    <input type="text" class="form-control" id="intendedStudioName"
                                           placeholder="Gewünschter Studio-Name">
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="codeCount" class="form-label">Anzahl Codes</label>
                                            <input type="number" class="form-control" id="codeCount" value="1" min="1" max="10">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="expiresInDays" class="form-label">Gültig für (Tage)</label>
                                            <input type="number" class="form-control" id="expiresInDays" value="30" min="1" max="365">
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="generateCodeSubmitBtn">Codes generieren</button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div id="generatedCodes">
                        <div class="card">
                            <div class="card-header">
                                <h5>Generierte Codes</h5>
                            </div>
                            <div class="card-body">
                                <p class="text-muted">Hier erscheinen die generierten Codes</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('codeGenerationForm').addEventListener('submit', (e) => {
            this.handleCodeGeneration(e);
        });

    }

    async handleCodeGeneration(e) {
        e.preventDefault();
        
        const formData = {
            intendedOwnerName: document.getElementById('intendedOwnerName').value,
            intendedCity: document.getElementById('intendedCity').value,
            intendedStudioName: document.getElementById('intendedStudioName').value,
            count: parseInt(document.getElementById('codeCount').value),
            expiresInDays: parseInt(document.getElementById('expiresInDays').value)
        };
        
        const submitBtn = document.getElementById('generateCodeSubmitBtn');
        const errorDiv = document.getElementById('codeGenerationError');
        const successDiv = document.getElementById('codeGenerationSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generiere Code...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/manager/studio-owner-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Generieren der Codes');
            }
            
            const data = await response.json();
            
            successDiv.textContent = data.message;
            successDiv.classList.remove('d-none');
            
            // Show generated codes
            this.displayGeneratedCodes(data.codes);
            
            // Reset form
            document.getElementById('codeGenerationForm').reset();
            document.getElementById('codeCount').value = 1;
            document.getElementById('expiresInDays').value = 30;
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Codes generieren';
        }
    }

    displayGeneratedCodes(codes) {
        const codesDiv = document.getElementById('generatedCodes');
        
        codesDiv.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5>Generierte Codes (${codes.length})</h5>
                </div>
                <div class="card-body">
                    ${codes.map(code => `
                        <div class="border p-3 mb-2 rounded">
                            <div class="row align-items-center">
                                <div class="col-md-4">
                                    <strong class="text-primary">${code.code}</strong>
                                </div>
                                <div class="col-md-8">
                                    <small class="text-muted">
                                        ${code.intended_owner_name} - ${code.intended_city}
                                        ${code.intended_studio_name ? `(${code.intended_studio_name})` : ''}
                                    </small>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }


    showAppointmentManagement(studioId) {
        console.log('showAppointmentManagement called with studioId:', studioId);
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="container-fluid p-4">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 mb-0">
                            <i class="fas fa-calendar-alt text-primary me-2"></i>
                            Termine verwalten
                        </h2>
                        <p class="text-muted mb-0">Verwalten Sie Ihre Termine und buchen Sie neue Behandlungen</p>
                    </div>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-outline-primary active" id="calendarViewBtn">
                            <i class="fas fa-calendar me-1"></i>Kalender
                        </button>
                        <button type="button" class="btn btn-outline-primary" id="listViewBtn">
                            <i class="fas fa-list me-1"></i>Liste
                        </button>
                    </div>
                </div>
                
                <!-- Calendar View -->
                <div id="calendarView" class="row">
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3 mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="mb-0">Kalender</h6>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary" id="prevMonthBtn">‹</button>
                                    <button class="btn btn-outline-primary" id="nextMonthBtn">›</button>
                                </div>
                            </div>
                            <div id="monthYearDisplay" class="text-center mb-3">
                                <strong>Januar 2025</strong>
                            </div>
                            <div id="calendarGrid">
                                <!-- Calendar will be generated here -->
                            </div>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card border-0 shadow-sm p-3 mb-3">
                            <h6 id="selectedDateHeader" class="mb-3">Termine für heute</h6>
                            <div id="appointmentsList">
                                <div class="text-center">
                                    <div class="spinner-border" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Lade Termine...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- List View -->
                <div id="listView" class="d-none">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body">
                            <!-- Tab Navigation -->
                            <ul class="nav nav-tabs" id="appointmentTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="upcoming-tab" data-bs-toggle="tab" data-bs-target="#upcoming" type="button" role="tab">
                                        <i class="fas fa-calendar-check me-2"></i>Kommende Termine
                                        <span class="badge bg-primary ms-2" id="upcomingCount">0</span>
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="past-tab" data-bs-toggle="tab" data-bs-target="#past" type="button" role="tab">
                                        <i class="fas fa-history me-2"></i>Vergangene Termine
                                        <span class="badge bg-secondary ms-2" id="pastCount">0</span>
                                    </button>
                                </li>
                            </ul>

                            <!-- Tab Content -->
                            <div class="tab-content" id="appointmentTabContent">
                                <!-- Upcoming Appointments Tab -->
                                <div class="tab-pane fade show active" id="upcoming" role="tabpanel">
                                    <div class="row mt-3 mb-3">
                                        <div class="col-md-6">
                                            <input type="text" class="form-control" id="upcomingSearch" placeholder="Suche nach Kunde, Behandlung...">
                                        </div>
                                        <div class="col-md-3">
                                            <select class="form-select" id="upcomingStatusFilter">
                                                <option value="">Alle Status</option>
                                                <option value="bestätigt">Bestätigt</option>
                                                <option value="pending">Wartend</option>
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <!-- Neuer Termin button removed from list view -->
                                        </div>
                                    </div>
                                    <div id="upcomingAppointmentsList">
                                        <div class="text-center py-4">
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                            <p class="mt-2">Lade kommende Termine...</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Past Appointments Tab -->
                                <div class="tab-pane fade" id="past" role="tabpanel">
                                    <div class="row mt-3 mb-3">
                                        <div class="col-md-6">
                                            <input type="text" class="form-control" id="pastSearch" placeholder="Suche nach Kunde, Behandlung...">
                                        </div>
                                        <div class="col-md-3">
                                            <select class="form-select" id="pastStatusFilter">
                                                <option value="">Alle Status</option>
                                                <option value="abgeschlossen">Abgeschlossen</option>
                                                <option value="abgesagt">Abgesagt</option>
                                                <option value="nicht erschienen">Nicht erschienen</option>
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <button class="btn btn-outline-secondary w-100" id="exportPastBtn">
                                                <i class="fas fa-download me-1"></i>Exportieren
                                            </button>
                                        </div>
                                    </div>
                                    <div id="pastAppointmentsList">
                                        <div class="text-center py-4">
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                            <p class="mt-2">Lade vergangene Termine...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Replace placeholder with actual studio ID
        content.innerHTML = content.innerHTML.replace(/__STUDIO_ID__/g, studioId);

        // Set current studio ID and reset dates
        this.currentStudioId = studioId;
        this.selectedDate = new Date(); // Reset to today when opening appointment management
        
        // Re-initialize CustomerManagement with new studio ID for modal access
        this.initializeCustomerManagement(studioId);
        
        // Initialize view state
        this.currentAppointmentView = 'calendar';
        this.currentListTab = 'upcoming';
        this.allAppointments = [];
        this.upcomingAppointments = [];
        this.pastAppointments = [];

        // View toggle event listeners
        document.getElementById('calendarViewBtn').addEventListener('click', () => {
            this.switchToCalendarView();
        });

        document.getElementById('listViewBtn').addEventListener('click', () => {
            this.switchToListView();
        });

        // Calendar navigation event listeners
        const prevBtn = document.getElementById('prevMonthBtn');
        const nextBtn = document.getElementById('nextMonthBtn');
        
        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', () => {
                console.log('Previous month clicked');
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
                // Reload appointments for the new month
                if (this.currentStudioId && this.currentAppointmentView === 'calendar') {
                    this.loadAppointments(this.currentStudioId);
                }
            });

            nextBtn.addEventListener('click', () => {
                console.log('Next month clicked');
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
                // Reload appointments for the new month
                if (this.currentStudioId && this.currentAppointmentView === 'calendar') {
                    this.loadAppointments(this.currentStudioId);
                }
            });
        } else {
            console.error('Calendar navigation buttons not found:', { prevBtn, nextBtn });
        }

        // Initialize calendar and load appointments after DOM is ready
        setTimeout(() => {
            // Ensure all required properties are initialized
            if (!this.currentDate) {
                this.currentDate = new Date();
            }
            if (!this.selectedDate) {
                this.selectedDate = new Date();
            }
            this.renderCalendar();
            this.loadAppointments(studioId);
            this.setupListViewEventListeners();
        }, 100);
    }

    switchToCalendarView() {
        this.currentAppointmentView = 'calendar';
        
        // Update button states
        document.getElementById('calendarViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        
        // Show/hide views
        document.getElementById('calendarView').classList.remove('d-none');
        document.getElementById('listView').classList.add('d-none');
    }

    switchToListView() {
        this.currentAppointmentView = 'list';
        
        // Update button states
        document.getElementById('calendarViewBtn').classList.remove('active');
        document.getElementById('listViewBtn').classList.add('active');
        
        // Show/hide views
        document.getElementById('calendarView').classList.add('d-none');
        document.getElementById('listView').classList.remove('d-none');
        
        // Load all appointments for list view 
        console.log('switchToListView: currentStudioId =', this.currentStudioId);
        if (this.currentStudioId) {
            this.loadAllAppointments(this.currentStudioId);
        } else {
            console.error('No currentStudioId available for loading appointments');
        }
    }

    setupListViewEventListeners() {
        // Upcoming search
        const upcomingSearch = document.getElementById('upcomingSearch');
        if (upcomingSearch) {
            let searchTimeout;
            upcomingSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterUpcomingAppointments(e.target.value);
                }, 300);
            });
        }

        // Upcoming status filter
        const upcomingStatusFilter = document.getElementById('upcomingStatusFilter');
        if (upcomingStatusFilter) {
            upcomingStatusFilter.addEventListener('change', (e) => {
                this.filterUpcomingAppointments(upcomingSearch?.value || '', e.target.value);
            });
        }

        // Past search
        const pastSearch = document.getElementById('pastSearch');
        if (pastSearch) {
            let searchTimeout;
            pastSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterPastAppointments(e.target.value);
                }, 300);
            });
        }

        // Past status filter
        const pastStatusFilter = document.getElementById('pastStatusFilter');
        if (pastStatusFilter) {
            pastStatusFilter.addEventListener('change', (e) => {
                this.filterPastAppointments(pastSearch?.value || '', e.target.value);
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportPastBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportPastAppointments();
            });
        }
    }

    filterUpcomingAppointments(searchTerm = '', statusFilter = '') {
        const searchLower = searchTerm.toLowerCase();
        let filtered = this.upcomingAppointments;

        if (searchTerm) {
            filtered = filtered.filter(apt => {
                const customerName = this.getCustomerDisplayName(apt).toLowerCase();
                const appointmentType = (apt.appointment_type_name || '').toLowerCase();
                const notes = (apt.notes || '').toLowerCase();
                return customerName.includes(searchLower) || 
                       appointmentType.includes(searchLower) || 
                       notes.includes(searchLower);
            });
        }

        if (statusFilter) {
            filtered = filtered.filter(apt => apt.status === statusFilter);
        }

        this.renderFilteredUpcomingList(filtered);
    }

    filterPastAppointments(searchTerm = '', statusFilter = '') {
        const searchLower = searchTerm.toLowerCase();
        let filtered = this.pastAppointments;

        if (searchTerm) {
            filtered = filtered.filter(apt => {
                const customerName = this.getCustomerDisplayName(apt).toLowerCase();
                const appointmentType = (apt.appointment_type_name || '').toLowerCase();
                const notes = (apt.notes || '').toLowerCase();
                return customerName.includes(searchLower) || 
                       appointmentType.includes(searchLower) || 
                       notes.includes(searchLower);
            });
        }

        if (statusFilter) {
            filtered = filtered.filter(apt => apt.status === statusFilter);
        }

        this.renderFilteredPastList(filtered);
    }

    renderFilteredUpcomingList(appointments) {
        const container = document.getElementById('upcomingAppointmentsList');
        if (!container) return;
        
        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <h6>Keine passenden Termine gefunden</h6>
                    <p class="mb-0">Versuchen Sie andere Suchbegriffe oder Filter.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        
        appointments.forEach(apt => {
            const customerName = this.getCustomerDisplayName(apt);
            const statusBadge = this.getListStatusBadge(apt.status, apt);
            const typeColor = apt.appointment_type_color || '#007bff';
            const timeUntil = this.getTimeUntilAppointment(apt);
            
            html += `
                <div class="list-group-item border-start clickable-card" style="border-start-color: ${typeColor} !important; border-start-width: 4px !important; cursor: pointer;" 
                     onclick="window.app.viewAppointmentDetails(${apt.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <span class="badge me-2" style="background-color: ${typeColor}">
                                    ${apt.appointment_type_name || 'Termin'}
                                </span>
                                ${statusBadge}
                                ${timeUntil ? `<small class="text-muted ms-2">${timeUntil}</small>` : ''}
                            </div>
                            <h6 class="mb-1">${customerName}</h6>
                            <div class="text-muted small">
                                <i class="fas fa-calendar me-1"></i>
                                ${this.formatDate(apt.appointment_date)}
                                <i class="fas fa-clock ms-3 me-1"></i>
                                ${apt.start_time} - ${apt.end_time}
                                ${apt.customer_phone ? `<i class="fas fa-phone ms-3 me-1"></i>${apt.customer_phone}` : ''}
                            </div>
                            ${apt.notes ? `<small class="text-muted d-block mt-1"><i class="fas fa-sticky-note me-1"></i>${apt.notes}</small>` : ''}
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="window.app.editAppointment(${apt.id})">
                                    <i class="fas fa-edit me-2"></i>Bearbeiten
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.app.markAppointmentCompleted(${apt.id})">
                                    <i class="fas fa-check me-2"></i>Als abgeschlossen markieren
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="window.app.cancelAppointment(${apt.id})">
                                    <i class="fas fa-times me-2"></i>Absagen
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderFilteredPastList(appointments) {
        const container = document.getElementById('pastAppointmentsList');
        if (!container) return;
        
        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <h6>Keine passenden Termine gefunden</h6>
                    <p class="mb-0">Versuchen Sie andere Suchbegriffe oder Filter.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        
        appointments.forEach(apt => {
            const customerName = this.getCustomerDisplayName(apt);
            const statusBadge = this.getListStatusBadge(apt.status, apt);
            const typeColor = apt.appointment_type_color || '#6c757d';
            
            html += `
                <div class="list-group-item border-start" style="border-start-color: ${typeColor} !important; border-start-width: 4px !important; opacity: 0.8;">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <span class="badge me-2" style="background-color: ${typeColor}; opacity: 0.8;">
                                    ${apt.appointment_type_name || 'Termin'}
                                </span>
                                ${statusBadge}
                            </div>
                            <h6 class="mb-1">${customerName}</h6>
                            <div class="text-muted small">
                                <i class="fas fa-calendar me-1"></i>
                                ${this.formatDate(apt.appointment_date)}
                                <i class="fas fa-clock ms-3 me-1"></i>
                                ${apt.start_time} - ${apt.end_time}
                                ${apt.customer_phone ? `<i class="fas fa-phone ms-3 me-1"></i>${apt.customer_phone}` : ''}
                            </div>
                            ${apt.notes ? `<small class="text-muted d-block mt-1"><i class="fas fa-sticky-note me-1"></i>${apt.notes}</small>` : ''}
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="window.app.viewAppointmentDetails(${apt.id})">
                                    <i class="fas fa-eye me-2"></i>Details anzeigen
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.app.addAppointmentNotes(${apt.id})">
                                    <i class="fas fa-sticky-note me-2"></i>Notiz hinzufügen
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    exportPastAppointments() {
        if (this.pastAppointments.length === 0) {
            alert('Keine vergangenen Termine zum Exportieren verfügbar.');
            return;
        }

        // Create CSV content
        const headers = ['Datum', 'Zeit', 'Kunde', 'Behandlung', 'Status', 'Notizen'];
        const csvContent = [
            headers.join(','),
            ...this.pastAppointments.map(apt => [
                this.formatDate(apt.appointment_date),
                `${apt.start_time} - ${apt.end_time}`,
                `"${this.getCustomerDisplayName(apt)}"`,
                `"${apt.appointment_type_name || 'Termin'}"`,
                apt.status || '',
                `"${apt.notes || ''}"`
            ].join(','))
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `termine_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    async loadAppointments(studioId) {
        if (!studioId) {
            return;
        }
        
        const appointmentsDiv = document.getElementById('appointmentsList');
        
        // Use selectedDate if available, otherwise use today's date
        const selectedDate = this.selectedDate || new Date();
        // Fix: Use local date formatting for consistency
        const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        
        try {
            let url = `${window.API_BASE_URL}/api/v1/appointments/studio/${studioId}`;
            const params = new URLSearchParams();
            params.append('date', selectedDateStr);
            if (params.toString()) url += '?' + params.toString();

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load appointments');
            }
            
            const data = await response.json();
            const appointments = data.appointments || [];
            
            // Update the header with selected date and add quick schedule button
            const selectedDateDisplayStr = selectedDate.toLocaleDateString('de-DE', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const headerElement = document.getElementById('selectedDateHeader');
            if (headerElement) {
                // Check if selected date is in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPastDate = selectedDate < today;
                
                headerElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Termine für ${selectedDateDisplayStr}</span>
                        ${!isPastDate ? `
                            <button class="btn btn-sm btn-primary" onclick="window.app.showCreateAppointmentForm('${studioId}', new Date('${selectedDate.toISOString()}'))">
                                <i class="fas fa-plus-circle me-1"></i>
                                Neue Behandlung
                            </button>
                        ` : ''}
                    </div>
                `;
            }
            
            if (appointments.length === 0) {
                appointmentsDiv.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-calendar-day fa-3x mb-3 text-muted"></i>
                        <p class="mb-0">Keine Termine für diesen Tag.</p>
                    </div>
                `;
            } else {
                // Debug: Log appointment data to check lead appointments
                const leadAppointments = appointments.filter(apt => apt.appointment_source === 'lead' || apt.person_type === 'lead' || apt.lead_id);
                console.log(`Rendering ${appointments.length} appointments (${leadAppointments.length} trials) for ${selectedDateStr}`);
                
                // Create timeline view with colored appointment blocks
                appointmentsDiv.innerHTML = this.renderTimelineView(appointments, selectedDate);
            }
            
            // Load calendar indicators after appointments are loaded
            this.loadMonthlyAppointmentIndicators();
            
        } catch (error) {
            appointmentsDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden der Termine: ${error.message}
                </div>
            `;
        }
    }

    async loadAllAppointments(studioId) {
        if (!studioId) {
            return;
        }
        
        try {
            // Fetch all appointments without date filter
            const url = `${window.API_BASE_URL}/api/v1/appointments/studio/${studioId}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load all appointments');
            }
            
            const data = await response.json();
            this.allAppointments = data.appointments || [];
            
            // Split into upcoming and past appointments
            this.splitAppointments();
            
            // Render the current tab
            this.renderListView();
            
        } catch (error) {
            console.error('Error loading all appointments:', error);
            this.showListViewError(error.message);
        }
    }

    splitAppointments() {
        const now = new Date();
        const currentDateTime = now.getTime();
        
        this.upcomingAppointments = [];
        this.pastAppointments = [];
        
        this.allAppointments.forEach(apt => {
            // Parse appointment date and time properly
            let aptDateStr = apt.appointment_date;
            
            // Handle ISO date strings with timezone
            if (aptDateStr.includes('T')) {
                aptDateStr = aptDateStr.split('T')[0];
            }
            
            // Create proper date object with time
            const aptDateTime = new Date(aptDateStr + 'T' + apt.start_time);
            const isUpcoming = aptDateTime.getTime() > currentDateTime;
            
            console.log(`Appointment ${aptDateStr} ${apt.start_time}: ${isUpcoming ? 'UPCOMING' : 'PAST'} (status: ${apt.status})`);
            
            if (isUpcoming) {
                this.upcomingAppointments.push(apt);
            } else {
                this.pastAppointments.push(apt);
            }
        });
        
        // Sort upcoming appointments (earliest first)
        this.upcomingAppointments.sort((a, b) => {
            // Use ISO format for consistent date parsing
            const dateA = new Date(a.appointment_date + 'T' + a.start_time);
            const dateB = new Date(b.appointment_date + 'T' + b.start_time);
            return dateA.getTime() - dateB.getTime(); // Earliest first
        });
        
        // Sort past appointments (most recent first)
        this.pastAppointments.sort((a, b) => {
            // Parse dates properly handling timezone
            let dateStrA = a.appointment_date;
            let dateStrB = b.appointment_date;
            
            // Handle date format (could be ISO string with timezone)
            if (dateStrA.includes('T')) {
                dateStrA = dateStrA.split('T')[0];
            }
            if (dateStrB.includes('T')) {
                dateStrB = dateStrB.split('T')[0];
            }
            
            const dateA = new Date(dateStrA + 'T' + a.start_time);
            const dateB = new Date(dateStrB + 'T' + b.start_time);
            
            console.log('Sorting past:', dateStrB, b.start_time, 'vs', dateStrA, a.start_time, '=', dateB.getTime() - dateA.getTime());
            
            return dateB.getTime() - dateA.getTime(); // Most recent first
        });
        
        // Update tab counts
        this.updateTabCounts();
    }

    updateTabCounts() {
        const upcomingCountEl = document.getElementById('upcomingCount');
        const pastCountEl = document.getElementById('pastCount');
        
        if (upcomingCountEl) {
            upcomingCountEl.textContent = this.upcomingAppointments.length;
        }
        if (pastCountEl) {
            pastCountEl.textContent = this.pastAppointments.length;
        }
    }

    renderListView() {
        this.renderUpcomingTab();
        this.renderPastTab();
    }

    showListViewError(message) {
        const upcomingList = document.getElementById('upcomingAppointmentsList');
        const pastList = document.getElementById('pastAppointmentsList');
        
        const errorHtml = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Fehler beim Laden der Termine: ${message}
            </div>
        `;
        
        if (upcomingList) upcomingList.innerHTML = errorHtml;
        if (pastList) pastList.innerHTML = errorHtml;
    }

    renderUpcomingTab() {
        const container = document.getElementById('upcomingAppointmentsList');
        if (!container) return;
        
        if (this.upcomingAppointments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-calendar-check fa-3x mb-3"></i>
                    <h6>Keine kommenden Termine</h6>
                    <p class="mb-0">Alle Termine sind abgeschlossen oder es wurden noch keine Termine geplant.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        
        this.upcomingAppointments.forEach(apt => {
            const customerName = this.getCustomerDisplayName(apt);
            const statusBadge = this.getListStatusBadge(apt.status, apt);
            const typeColor = apt.appointment_type_color || '#007bff';
            const timeUntil = this.getTimeUntilAppointment(apt);
            
            html += `
                <div class="list-group-item border-start clickable-card" style="border-start-color: ${typeColor} !important; border-start-width: 4px !important; cursor: pointer;" 
                     onclick="window.app.viewAppointmentDetails(${apt.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <span class="badge me-2" style="background-color: ${typeColor}">
                                    ${apt.appointment_type_name || 'Termin'}
                                </span>
                                ${statusBadge}
                                ${this.canMarkAsNoShow(apt) ? `
                                    <button class="btn btn-sm btn-warning ms-2" 
                                            onclick="window.app.markAsNoShow(${apt.id})"
                                            title="Als nicht erschienen markieren">
                                        <i class="fas fa-user-times"></i>
                                    </button>
                                ` : ''}
                                ${timeUntil ? `<small class="text-muted ms-2">${timeUntil}</small>` : ''}
                            </div>
                            <h6 class="mb-1">
                                <span class="text-dark fw-bold">
                                    ${customerName}
                                </span>
                            </h6>
                            <div class="text-muted small">
                                <i class="fas fa-calendar me-1"></i>
                                ${this.formatDate(apt.appointment_date)}
                                <i class="fas fa-clock ms-3 me-1"></i>
                                ${apt.start_time} - ${apt.end_time}
                                ${apt.customer_phone ? `<i class="fas fa-phone ms-3 me-1"></i>${apt.customer_phone}` : ''}
                            </div>
                            ${apt.notes ? `<small class="text-muted d-block mt-1"><i class="fas fa-sticky-note me-1"></i>${apt.notes}</small>` : ''}
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="window.app.editAppointment(${apt.id})">
                                    <i class="fas fa-edit me-2"></i>Bearbeiten
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.app.markAppointmentCompleted(${apt.id})">
                                    <i class="fas fa-check me-2"></i>Als abgeschlossen markieren
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="window.app.cancelAppointment(${apt.id})">
                                    <i class="fas fa-times me-2"></i>Absagen
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderPastTab() {
        const container = document.getElementById('pastAppointmentsList');
        if (!container) return;
        
        if (this.pastAppointments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-history fa-3x mb-3"></i>
                    <h6>Keine vergangenen Termine</h6>
                    <p class="mb-0">Es wurden noch keine Termine abgeschlossen.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        
        this.pastAppointments.forEach(apt => {
            const customerName = this.getCustomerDisplayName(apt);
            const statusBadge = this.getListStatusBadge(apt.status, apt);
            const typeColor = apt.appointment_type_color || '#6c757d';
            
            html += `
                <div class="list-group-item border-start clickable-card" style="border-start-color: ${typeColor} !important; border-start-width: 4px !important; opacity: 0.8; cursor: pointer;" 
                     onclick="window.app.viewAppointmentDetails(${apt.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <span class="badge me-2" style="background-color: ${typeColor}; opacity: 0.8;">
                                    ${apt.appointment_type_name || 'Termin'}
                                </span>
                                ${statusBadge}
                            </div>
                            <h6 class="mb-1">
                                <span class="text-dark fw-bold">
                                    ${customerName}
                                </span>
                            </h6>
                            <div class="text-muted small">
                                <i class="fas fa-calendar me-1"></i>
                                ${this.formatDate(apt.appointment_date)}
                                <i class="fas fa-clock ms-3 me-1"></i>
                                ${apt.start_time} - ${apt.end_time}
                                ${apt.customer_phone ? `<i class="fas fa-phone ms-3 me-1"></i>${apt.customer_phone}` : ''}
                            </div>
                            ${apt.notes ? `<small class="text-muted d-block mt-1"><i class="fas fa-sticky-note me-1"></i>${apt.notes}</small>` : ''}
                        </div>
                        <div class="dropdown" onclick="event.stopPropagation()">
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="window.app.viewAppointmentDetails(${apt.id})">
                                    <i class="fas fa-eye me-2"></i>Details anzeigen
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.app.addAppointmentNotes(${apt.id})">
                                    <i class="fas fa-sticky-note me-2"></i>Notiz hinzufügen
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    getCustomerDisplayName(appointment) {
        if (appointment.person_type === 'lead') {
            return `${appointment.customer_first_name || ''} ${appointment.customer_last_name || ''}`.trim() || 'Lead';
        } else {
            return `${appointment.customer_first_name || ''} ${appointment.customer_last_name || ''}`.trim() || 'Kunde';
        }
    }

    getListStatusBadge(status, appointment) {
        // Special handling for confirmed/bestätigt status
        if (status === 'confirmed' || status === 'bestätigt') {
            // Check if it's a trial appointment (lead)
            if (appointment && appointment.person_type === 'lead') {
                return '<span class="badge" style="background-color: #ff9800">Probe</span>';
            }
            // Regular customer appointment
            return '<span class="badge bg-success">Regulär</span>';
        }
        
        // Other statuses remain the same
        const statusMap = {
            'completed': '<span class="badge bg-info">Abgeschlossen</span>',
            'abgeschlossen': '<span class="badge bg-info">Abgeschlossen</span>',
            'cancelled': '<span class="badge bg-danger">Abgesagt</span>',
            'abgesagt': '<span class="badge bg-danger">Abgesagt</span>',
            'no_show': '<span class="badge bg-warning">Nicht erschienen</span>',
            'nicht erschienen': '<span class="badge bg-warning">Nicht erschienen</span>',
            'pending': '<span class="badge bg-secondary">Wartend</span>',
            'geplant': '<span class="badge" style="background-color: #ff9800">Geplant</span>'
        };
        return statusMap[status] || `<span class="badge bg-secondary">${status}</span>`;
    }

    getTimeUntilAppointment(appointment) {
        const now = new Date();
        const aptDateTime = new Date(`${appointment.appointment_date} ${appointment.start_time}`);
        const diffMs = aptDateTime - now;
        
        if (diffMs <= 0) return null;
        
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `in ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
        } else if (diffHours > 0) {
            return `in ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
        } else {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            return `in ${diffMinutes} Minute${diffMinutes > 1 ? 'n' : ''}`;
        }
    }

    canMarkAsNoShow(appointment) {
        const now = new Date();
        const startTime = new Date(appointment.appointment_date + 'T' + appointment.start_time);
        const isStarted = now >= startTime;
        const isValidStatus = ['bestätigt', 'confirmed'].includes(appointment.status);
        return isStarted && isValidStatus;
    }

    getStatusBadgeClass(status) {
        
        const classes = {
            // German terms (primary)
            'bestätigt': 'bg-success',
            'abgesagt': 'bg-danger',
            'abgeschlossen': 'bg-info',
            'nicht erschienen': 'bg-warning',
            'geplant': 'bg-warning',
            // English terms (legacy support)
            'confirmed': 'bg-success',
            'cancelled': 'bg-danger',
            'completed': 'bg-info',
            'no_show': 'bg-warning'
        };
        
        
        const result = classes[status] || 'bg-secondary';
        
        
        return result;
    }
    
    getAvailableStatusOptions(appointment) {
        const now = new Date();
        const startTime = new Date(`${appointment.appointment_date} ${appointment.start_time}`);
        const endTime = new Date(`${appointment.appointment_date} ${appointment.end_time}`);
        const hasStarted = now >= startTime;
        const hasEnded = now >= endTime;
        
        const currentStatus = appointment.status;
        const options = [];
        
        // Always show current status first
        if (currentStatus === 'bestätigt' || currentStatus === 'confirmed') {
            options.push({ value: 'bestätigt', englishValue: 'confirmed', label: 'Bestätigt' });
            
            // Can manually mark as completed anytime
            options.push({ value: 'abgeschlossen', englishValue: 'completed', label: 'Abgeschlossen' });
            
            // Can mark as no-show only after appointment has started
            if (hasStarted) {
                options.push({ value: 'nicht erschienen', englishValue: 'no_show', label: 'Nicht erschienen' });
            }
            
            // Can always cancel
            options.push({ value: 'abgesagt', englishValue: 'cancelled', label: 'Abgesagt' });
            
        } else if (currentStatus === 'abgeschlossen' || currentStatus === 'completed') {
            options.push({ value: 'abgeschlossen', englishValue: 'completed', label: 'Abgeschlossen' });
            
            // From completed, can change to no-show (important for correcting mistakes)
            // This is always available for past/completed appointments
            options.push({ value: 'nicht erschienen', englishValue: 'no_show', label: 'Nicht erschienen' });
            
        } else if (currentStatus === 'nicht erschienen' || currentStatus === 'no_show') {
            // No-show is final, no changes allowed
            options.push({ value: 'nicht erschienen', englishValue: 'no_show', label: 'Nicht erschienen' });
            
        } else if (currentStatus === 'abgesagt' || currentStatus === 'cancelled' || currentStatus === 'storniert') {
            // Cancelled is final, no changes allowed
            options.push({ value: 'abgesagt', englishValue: 'cancelled', label: 'Abgesagt' });
            
        } else {
            // For any other status (like pending), show all options
            options.push({ value: 'pending', englishValue: 'pending', label: 'Ausstehend' });
            options.push({ value: 'bestätigt', englishValue: 'confirmed', label: 'Bestätigt' });
            options.push({ value: 'abgeschlossen', englishValue: 'completed', label: 'Abgeschlossen' });
            if (hasStarted) {
                options.push({ value: 'nicht erschienen', englishValue: 'no_show', label: 'Nicht erschienen' });
            }
            options.push({ value: 'abgesagt', englishValue: 'cancelled', label: 'Abgesagt' });
        }
        
        return options;
    }
    
    getStatusChangeWarning(appointment) {
        const now = new Date();
        const startTime = new Date(`${appointment.appointment_date} ${appointment.start_time}`);
        const hasStarted = now >= startTime;
        const currentStatus = appointment.status;
        
        // If appointment hasn't started and current status is confirmed
        if (!hasStarted && (currentStatus === 'bestätigt' || currentStatus === 'confirmed')) {
            return `Hinweis: "Nicht erschienen" kann erst nach Terminbeginn (${appointment.start_time}) ausgewählt werden.`;
        }
        
        // Warning about session consumption
        if (appointment.appointment_type_name === 'Behandlung' && !appointment.session_consumed) {
            if (currentStatus === 'bestätigt' || currentStatus === 'confirmed') {
                return 'Hinweis: Bei Änderung zu "Abgeschlossen" oder "Nicht erschienen" wird eine Sitzung vom Kundenkonto abgezogen.';
            }
        }
        
        return null;
    }

    getStatusText(status) {
        const texts = {
            // English to German translation (legacy support)
            'confirmed': 'Bestätigt',
            'cancelled': 'Abgesagt',
            'completed': 'Abgeschlossen',
            'no_show': 'Nicht erschienen',
            // German terms (primary)
            'bestätigt': 'Bestätigt',
            'abgesagt': 'Abgesagt',
            'abgeschlossen': 'Abgeschlossen',
            'nicht erschienen': 'Nicht erschienen',
            'geplant': 'Geplant'
        };
        return texts[status] || status;
    }

    detectOverlappingAppointments(appointments) {
        // Sort appointments by start time
        const sorted = [...appointments].sort((a, b) => {
            if (a.start_time < b.start_time) return -1;
            if (a.start_time > b.start_time) return 1;
            return 0;
        });
        
        // Group overlapping appointments
        const groups = [];
        sorted.forEach(appointment => {
            // Convert time strings to minutes for easier comparison
            const [startH, startM] = appointment.start_time.split(':').map(Number);
            const [endH, endM] = appointment.end_time.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            
            // Find a group where this appointment overlaps
            let foundGroup = false;
            for (let group of groups) {
                // Check if this appointment overlaps with any in the group
                let overlaps = false;
                for (let existing of group) {
                    const [existStartH, existStartM] = existing.start_time.split(':').map(Number);
                    const [existEndH, existEndM] = existing.end_time.split(':').map(Number);
                    const existStartMinutes = existStartH * 60 + existStartM;
                    const existEndMinutes = existEndH * 60 + existEndM;
                    
                    // Check for overlap
                    if (startMinutes < existEndMinutes && endMinutes > existStartMinutes) {
                        overlaps = true;
                        break;
                    }
                }
                
                if (overlaps) {
                    group.push(appointment);
                    foundGroup = true;
                    break;
                }
            }
            
            if (!foundGroup) {
                groups.push([appointment]);
            }
        });
        
        // Add overlap information to each appointment
        const processedAppointments = [];
        groups.forEach(group => {
            group.forEach((appointment, index) => {
                processedAppointments.push({
                    ...appointment,
                    overlapIndex: index,
                    overlapCount: group.length
                });
            });
        });
        
        return processedAppointments;
    }

    renderTimelineView(appointments, selectedDate) {
        const today = new Date();
        const isToday = selectedDate.toDateString() === today.toDateString();
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        
        // Business hours from 8 AM to 8 PM (12 hours)
        const startHour = 8;
        const endHour = 20;
        const totalHours = endHour - startHour;
        
        // Detect overlapping appointments
        const processedAppointments = this.detectOverlappingAppointments(appointments);
        
        let html = `
            <div class="timeline-container" style="position: relative; min-height: ${totalHours * 90}px; background: linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%);">
                <!-- Time grid background -->
                <div class="time-grid" style="position: absolute; left: 80px; right: 0; top: 0; height: 100%;">
        `;
        
        // Generate hour grid lines
        for (let hour = startHour; hour <= endHour; hour++) {
            const y = (hour - startHour) * 90;
            const isHalfHour = hour % 2 === 0;
            html += `
                <div style="position: absolute; top: ${y}px; left: 0; right: 0; height: 1px; background: ${isHalfHour ? '#dee2e6' : '#f0f0f0'};"></div>
                <div style="position: absolute; top: ${y + 45}px; left: 0; right: 0; height: 1px; background: #f8f8f8;"></div>
            `;
        }
        
        html += `</div>`;
        
        // Hour scale on the left
        html += `<div class="hour-scale" style="position: absolute; left: 0; top: 0; width: 80px; height: 100%;">`;
        
        for (let hour = startHour; hour <= endHour; hour++) {
            const y = (hour - startHour) * 90;
            const displayHour = hour.toString().padStart(2, '0');
            html += `
                <div style="position: absolute; top: ${y - 10}px; left: 0; width: 100%; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; color: #495057;">
                    ${displayHour}:00
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Current time indicator (only show if viewing today)
        if (isToday && currentHour >= startHour && currentHour <= endHour) {
            const currentY = ((currentHour - startHour) * 90) + ((currentMinute / 60) * 90);
            html += `
                <div class="current-time-indicator" style="position: absolute; left: 70px; right: 0; top: ${currentY}px; z-index: 200;">
                    <div style="position: absolute; left: 0; width: 12px; height: 12px; background: #dc3545; border-radius: 50%; margin-top: -6px; margin-left: -6px;"></div>
                    <div style="position: absolute; left: 0; right: 0; height: 2px; background: #dc3545;"></div>
                    <div style="position: absolute; right: 10px; top: -12px; background: #dc3545; color: white; padding: 2px 8px; font-size: 11px; border-radius: 3px; font-weight: 500;">
                        JETZT ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}
                    </div>
                </div>
            `;
        }
        
        // Appointment blocks area
        html += `<div class="appointments-area" style="position: absolute; left: 85px; right: 10px; top: 0; height: 100%;">`;
        
        // Add time slot hints for empty spaces
        for (let hour = startHour; hour < endHour; hour++) {
            const y = (hour - startHour) * 90;
            const hasAppointmentAtHour = processedAppointments.some(apt => {
                const startHour = parseInt(apt.start_time.split(':')[0]);
                return startHour === hour;
            });
            
            if (!hasAppointmentAtHour) {
                html += `
                    <div class="empty-slot-hint" 
                         style="position: absolute; left: 0; right: 0; top: ${y}px; height: 90px; 
                                display: flex; align-items: center; justify-content: center;"
                         onclick="window.app.quickScheduleAppointment('${this.currentStudioId}', '${this.formatDateForInput(selectedDate)}', '${hour.toString().padStart(2, '0')}:00')">
                        <div style="opacity: 0; transition: opacity 0.2s; padding: 8px 16px; background: rgba(0,123,255,0.1); border: 2px dashed rgba(0,123,255,0.3); border-radius: 6px; cursor: pointer; color: #007bff; font-size: 13px;"
                             onmouseover="this.style.opacity='1'" 
                             onmouseout="this.style.opacity='0'">
                            <i class="fas fa-plus-circle me-1"></i>
                            Behandlung hinzufügen
                        </div>
                    </div>
                `;
            }
        }
        
        // Render appointment blocks
        processedAppointments.forEach((appointment, index) => {
            const startTime = appointment.start_time;
            const endTime = appointment.end_time;
            
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            
            // Calculate position and height
            const startY = ((startHours - startHour) * 90) + ((startMinutes / 60) * 90);
            const endY = ((endHours - startHour) * 90) + ((endMinutes / 60) * 90);
            const height = Math.max(endY - startY, 30); // Minimum height for visibility
            
            // Skip if outside business hours
            if (startHours < startHour || endHours > endHour) return;
            
            // Check if this is a trial appointment (lead appointment)
            const isTrialAppointment = appointment.appointment_source === 'lead' || appointment.person_type === 'lead' || appointment.lead_id || 
                                      (appointment.appointment_type_name && appointment.appointment_type_name.toLowerCase().includes('probe'));
            
            // Enhanced color scheme based on status and appointment type
            const statusStyles = {
                'bestätigt': { bg: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', border: '#28a745' },
                'abgeschlossen': { bg: 'linear-gradient(135deg, #17a2b8 0%, #20c9b8 100%)', border: '#17a2b8' },
                'abgesagt': { bg: 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)', border: '#dc3545' },
                'nicht erschienen': { bg: 'linear-gradient(135deg, #6c757d 0%, #adb5bd 100%)', border: '#6c757d' },
                'confirmed': { bg: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', border: '#28a745' },
                'cancelled': { bg: 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)', border: '#dc3545' },
                'completed': { bg: 'linear-gradient(135deg, #17a2b8 0%, #20c9b8 100%)', border: '#17a2b8' },
                'no_show': { bg: 'linear-gradient(135deg, #6c757d 0%, #adb5bd 100%)', border: '#6c757d' },
                // Lead appointment statuses
                'geplant': { bg: 'linear-gradient(135deg, #ff9800 0%, #ffb347 100%)', border: '#ff9800' }
            };
            
            // Use trial appointment styling if it's a trial
            let style = statusStyles[appointment.status] || { bg: 'linear-gradient(135deg, #6c757d 0%, #adb5bd 100%)', border: '#6c757d' };
            if (isTrialAppointment && !statusStyles[appointment.status]) {
                style = { bg: 'linear-gradient(135deg, #ff9800 0%, #ffb347 100%)', border: '#ff9800' };
            }
            
            // Handle overlapping appointments
            const overlapOffset = appointment.overlapIndex || 0;
            const totalOverlaps = appointment.overlapCount || 1;
            const width = totalOverlaps > 1 ? `calc((100% - ${totalOverlaps * 5}px) / ${totalOverlaps})` : 'calc(100% - 10px)';
            const leftOffset = overlapOffset * ((100 / totalOverlaps)) + '%';
            const zIndex = 10 + overlapOffset;
            
            // Show overlap indicator if this appointment has overlaps
            const overlapBadge = appointment.overlapCount > 1 ? 
                `<div style="position: absolute; top: 2px; right: 2px; background: rgba(255,255,255,0.9); color: #333; padding: 1px 4px; font-size: 9px; border-radius: 10px;">
                    ${appointment.overlapIndex + 1}/${appointment.overlapCount}
                </div>` : '';
            
            // Trial badge removed per user request
            const trialBadge = '';
            
            html += `
                <div class="appointment-block" 
                     style="position: absolute; 
                            left: ${leftOffset}; 
                            width: ${width};
                            top: ${startY}px; 
                            height: ${height}px; 
                            background: ${style.bg}; 
                            border-left: 4px solid ${style.border};
                            border-radius: 6px; 
                            padding: 8px 12px; 
                            color: white; 
                            font-size: 12px; 
                            cursor: pointer;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            z-index: ${zIndex};
                            transition: all 0.2s ease;"
                     onmouseover="this.style.zIndex='1000'; this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.4)';"
                     onmouseout="this.style.zIndex='${zIndex}'; this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.3)';"
                     onclick="window.app.editAppointment(${appointment.id})"
                     title="${appointment.overlapCount > 1 ? `${appointment.overlapCount} überlappende Termine - ` : ''}Klicken zum Bearbeiten">
                    ${overlapBadge}
                    ${trialBadge}
                    <div style="font-weight: bold; margin-bottom: 2px;">
                        ${appointment.customer_first_name} ${appointment.customer_last_name}
                    </div>
                    <div style="font-size: 10px; opacity: 0.9;">
                        ${startTime} - ${endTime}
                    </div>
                    <div style="font-size: 10px; opacity: 0.8;">
                        ${appointment.appointment_type_name || 'Behandlung'}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        html += `</div>`;
        
        // Add legend
        html += `
            <div class="mt-4">
                <h6>Status-Legende:</h6>
                <div class="d-flex flex-wrap gap-3">
                    <span class="badge" style="background: #28a745;">Regulär</span>
                    <span class="badge" style="background: #ff9800;">Probe</span>
                    <span class="badge" style="background: #17a2b8;">Abgeschlossen</span>
                    <span class="badge" style="background: #dc3545;">Abgesagt</span>
                    <span class="badge" style="background: #6c757d;">Nicht erschienen</span>
                </div>
            </div>
        `;
        
        return html;
    }

    renderCustomerTimelineView(appointments, selectedDate) {
        const today = new Date();
        const isToday = selectedDate.toDateString() === today.toDateString();
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        
        // Business hours from 8 AM to 8 PM (12 hours)
        const startHour = 8;
        const endHour = 20;
        const totalHours = endHour - startHour;
        
        let html = `
            <div class="timeline-container" style="position: relative; height: ${totalHours * 80}px; border: 1px solid #dee2e6; background: #f8f9fa;">
                <!-- Hour scale -->
                <div class="hour-scale" style="position: absolute; left: 0; top: 0; width: 60px; height: 100%; background: #fff; border-right: 1px solid #dee2e6;">
        `;
        
        // Generate hour markers
        for (let hour = startHour; hour <= endHour; hour++) {
            const y = (hour - startHour) * 80;
            html += `
                <div style="position: absolute; top: ${y}px; left: 0; width: 100%; height: 80px; border-bottom: 1px solid #eee; display: flex; align-items: center; padding: 0 5px; font-size: 12px; color: #666;">
                    ${hour.toString().padStart(2, '0')}:00
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Current time red line (only show if viewing today)
        if (isToday && currentHour >= startHour && currentHour <= endHour) {
            const currentY = ((currentHour - startHour) * 80) + ((currentMinute / 60) * 80);
            html += `
                <div class="current-time-line" style="position: absolute; left: 60px; right: 0; top: ${currentY}px; height: 2px; background: #dc3545; z-index: 100;">
                    <div style="position: absolute; right: 5px; top: -10px; background: #dc3545; color: white; padding: 1px 5px; font-size: 10px; border-radius: 2px;">
                        ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}
                    </div>
                </div>
            `;
        }
        
        // Appointment blocks
        html += `<div class="appointments-area" style="position: absolute; left: 60px; right: 0; top: 0; height: 100%;">`;
        
        appointments.forEach((appointment, index) => {
            const startTime = appointment.start_time; // e.g., "09:30"
            const endTime = appointment.end_time; // e.g., "10:30"
            
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            
            // Calculate position and height
            const startY = ((startHours - startHour) * 80) + ((startMinutes / 60) * 80);
            const endY = ((endHours - startHour) * 80) + ((endMinutes / 60) * 80);
            const height = endY - startY;
            
            // Skip if outside business hours
            if (startHours < startHour || endHours > endHour) return;
            
            // Color based on status
            const statusColors = {
                // German statuses (primary)
                'bestätigt': '#28a745',
                'abgeschlossen': '#17a2b8', 
                'abgesagt': '#dc3545',
                'nicht erschienen': '#6c757d',
                // English fallbacks
                'confirmed': '#28a745',
                'cancelled': '#dc3545',
                'completed': '#17a2b8',
                'no_show': '#6c757d'
            };
            const color = statusColors[appointment.status] || '#6c757d';
            
            html += `
                <div class="appointment-block" 
                     style="position: absolute; 
                            left: 5px; 
                            right: 5px; 
                            top: ${startY}px; 
                            height: ${height}px; 
                            background: ${color}; 
                            border: 1px solid rgba(0,0,0,0.1); 
                            border-radius: 4px; 
                            padding: 5px; 
                            color: white; 
                            font-size: 12px; 
                            cursor: pointer;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
                     onclick="window.app.editAppointment(${appointment.id})"
                     title="Klicken für Details">
                    <div style="font-weight: bold; margin-bottom: 2px;">
                        ${appointment.appointment_type_name || 'Behandlung'}
                    </div>
                    <div style="font-size: 10px; opacity: 0.9;">
                        ${startTime} - ${endTime}
                    </div>
                    <div style="font-size: 10px; opacity: 0.8;">
                        ${appointment.studio_name}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        html += `</div>`;
        
        // Add legend
        html += `
            <div class="mt-4">
                <h6>Status-Legende:</h6>
                <div class="d-flex flex-wrap gap-3">
                    <span class="badge" style="background: #28a745;">Regulär</span>
                    <span class="badge" style="background: #ff9800;">Probe</span>
                    <span class="badge" style="background: #17a2b8;">Abgeschlossen</span>
                    <span class="badge" style="background: #dc3545;">Abgesagt</span>
                    <span class="badge" style="background: #6c757d;">Nicht erschienen</span>
                </div>
            </div>
        `;
        
        return html;
    }

    async showCreateAppointmentForm(studioId, preselectedDate = null) {
        const content = document.getElementById('content');
        
        // Store customers data for search
        this.allCustomers = [];
        this.selectedCustomerId = null;
        
        content.innerHTML = `
            <div class="row">
                <div class="col-lg-8 mx-auto">
                    <div class="card shadow-sm">
                        <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                            <h4 class="mb-0">
                                <i class="fas fa-calendar-plus me-2"></i>
                                Neue Behandlung erstellen
                            </h4>
                            <button class="btn btn-light btn-sm" id="backToAppointmentsBtn">
                                <i class="fas fa-arrow-left me-1"></i>
                                Zurück
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="createAppointmentError" class="alert alert-danger d-none"></div>
                            <div id="createAppointmentSuccess" class="alert alert-success d-none"></div>
                            
                            <!-- Date Display (readonly) -->
                            <div class="mb-4">
                                <div class="row">
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold">Datum</label>
                                        <div class="p-3 bg-light rounded border">
                                            <i class="fas fa-calendar me-2 text-primary"></i>
                                            <span id="displayDate" class="fw-bold"></span>
                                        </div>
                                        <input type="hidden" id="appointmentDate" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="appointmentStartTime" class="form-label fw-bold">Uhrzeit *</label>
                                        <input type="time" 
                                               class="form-control form-control-lg" 
                                               id="appointmentStartTime" 
                                               step="900"
                                               required>
                                        <div class="form-text">15-Minuten-Intervalle • Dauer: 60 Minuten</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Customer Selection -->
                            <div class="mb-4">
                                <label class="form-label fw-bold">Kunde auswählen *</label>
                                
                                <!-- Customer Search -->
                                <div class="mb-3">
                                    <div class="input-group">
                                        <span class="input-group-text">
                                            <i class="fas fa-search"></i>
                                        </span>
                                        <input type="text" 
                                               class="form-control" 
                                               id="customerSearch" 
                                               placeholder="Name oder Telefonnummer eingeben..."
                                               autocomplete="off">
                                    </div>
                                    <div id="customerSearchResults" class="position-relative"></div>
                                </div>
                                
                                <!-- Selected Customer Display -->
                                <div id="selectedCustomerInfo" class="d-none">
                                    <div class="alert alert-success d-flex justify-content-between align-items-center">
                                        <div>
                                            <i class="fas fa-user-check me-2"></i>
                                            <strong>Ausgewählter Kunde:</strong>
                                            <span id="selectedCustomerName"></span>
                                            <span class="badge bg-success ms-2" id="selectedCustomerSessions"></span>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-outline-success" id="changeCustomerBtn">
                                            <i class="fas fa-exchange-alt"></i> Ändern
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Customer List -->
                                <div id="customerListSection">
                                    <h6 class="text-muted mb-2">Alle aktiven Kunden</h6>
                                    <div id="allCustomers" class="list-group" style="max-height: 300px; overflow-y: auto;">
                                        <div class="text-muted p-2">Lädt...</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Notes -->
                            <div class="mb-4">
                                <label for="appointmentNotes" class="form-label fw-bold">Notizen</label>
                                <textarea class="form-control" id="appointmentNotes" rows="3" 
                                          placeholder="Besondere Anmerkungen oder Behandlungsdetails..."></textarea>
                            </div>
                            
                            <form id="createAppointmentForm">
                                <input type="hidden" id="customerId" required>
                                <input type="hidden" id="appointmentDuration" value="60">
                                <input type="hidden" id="appointmentTypeId" value="1">
                                <input type="hidden" id="appointmentStatus" value="bestätigt">
                                
                                <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                    <button type="button" class="btn btn-secondary" id="cancelBtn">
                                        <i class="fas fa-times me-1"></i>
                                        Abbrechen
                                    </button>
                                    <button type="submit" class="btn btn-primary btn-lg" id="createAppointmentSubmitBtn" disabled>
                                        <i class="fas fa-check me-1"></i>
                                        Behandlung erstellen
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Set default date to preselected date or today using timezone-safe formatting
        const defaultDate = preselectedDate ? this.formatDateForInput(preselectedDate) : this.formatDateForInput(new Date());
        const selectedDateObj = preselectedDate || new Date();
        
        document.getElementById('appointmentDate').value = defaultDate;
        
        // Set display date (readonly)
        const displayDateStr = selectedDateObj.toLocaleDateString('de-DE', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        document.getElementById('displayDate').textContent = displayDateStr;

        // Event listeners
        document.getElementById('backToAppointmentsBtn').addEventListener('click', () => {
            this.showAppointmentManagement(studioId);
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.showAppointmentManagement(studioId);
        });

        document.getElementById('createAppointmentForm').addEventListener('submit', (e) => {
            this.handleCreateAppointment(e, studioId);
        });
        
        // Customer search functionality
        const customerSearchInput = document.getElementById('customerSearch');
        const searchResultsDiv = document.getElementById('customerSearchResults');
        
        customerSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            if (searchTerm.length < 2) {
                searchResultsDiv.innerHTML = '';
                return;
            }
            
            const filteredCustomers = this.allCustomers.filter(customer => {
                const fullName = `${customer.contact_first_name} ${customer.contact_last_name}`.toLowerCase();
                const phone = (customer.contact_phone || '').toLowerCase();
                return fullName.includes(searchTerm) || phone.includes(searchTerm);
            });
            
            this.renderCustomerSearchResults(filteredCustomers);
        });
        
        // Change customer button
        document.getElementById('changeCustomerBtn').addEventListener('click', () => {
            this.resetCustomerSelection();
        });

        // Load customers for search and populate lists
        await this.loadCustomersForSearch(studioId);
        this.loadAllCustomers(studioId);
    }

    async loadCustomers(studioId) {
        const customerSelect = document.getElementById('customerId');
        
        if (!customerSelect) {
            console.error('Customer select element not found');
            return;
        }
        
        try {
            console.log('Loading customers for studio:', studioId);
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error loading customers:', response.status, errorText);
                throw new Error(`Failed to load customers: ${response.status}`);
            }
            
            const data = await response.json();
            const customers = data.customers || [];
            
            console.log('Loaded customers:', customers.length);
            
            customerSelect.innerHTML = '<option value="">Kunde auswählen...</option>';
            
            // Filter customers with active sessions only
            const customersWithSessions = customers.filter(customer => customer.remaining_sessions > 0);
            
            customersWithSessions.forEach(customer => {
                const sessionInfo = customer.remaining_sessions ? ` (${customer.remaining_sessions} Sessions)` : '';
                customerSelect.innerHTML += `
                    <option value="${customer.id}">
                        ${customer.contact_first_name} ${customer.contact_last_name}${sessionInfo}
                    </option>
                `;
            });
            
            if (customersWithSessions.length === 0) {
                customerSelect.innerHTML += '<option value="" disabled>Keine Kunden mit aktiven Sessions vorhanden</option>';
                // Add info message about session requirement
                const infoDiv = document.createElement('div');
                infoDiv.className = 'alert alert-info mt-2';
                infoDiv.innerHTML = `
                    <i class="fas fa-info-circle me-2"></i>
                    Nur Kunden mit aktiven Sessions können Termine buchen. 
                    Neue Session-Pakete können im <strong>KUNDEN</strong> Tab hinzugefügt werden.
                `;
                customerSelect.parentNode.appendChild(infoDiv);
            }
            
        } catch (error) {
            console.error('Error in loadCustomers:', error);
            customerSelect.innerHTML = '<option value="">Fehler beim Laden der Kunden</option>';
        }
    }

    async loadAppointmentTypes(studioId) {
        const typeSelect = document.getElementById('appointmentTypeId');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/studio/${studioId}/appointment-types`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load appointment types');
            }
            
            const data = await response.json();
            const types = data.appointmentTypes || [];
            
            typeSelect.innerHTML = '<option value="">Typ auswählen...</option>';
            let abnehmenType = null;
            
            types.forEach(type => {
                const selected = type.name === 'Behandlung' ? 'selected' : '';
                typeSelect.innerHTML += `
                    <option value="${type.id}" ${selected}>
                        ${type.name} (${type.duration} Min)
                    </option>
                `;
                
                if (type.name === 'Behandlung') {
                    abnehmenType = type;
                }
            });
            
            // Auto-select the first "Behandlung" type if found
            if (abnehmenType) {
                typeSelect.value = abnehmenType.id;
            }
            
        } catch (error) {
            typeSelect.innerHTML = '<option value="">Fehler beim Laden der Typen</option>';
        }
    }
    
    async loadCustomersForSearch(studioId) {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load customers');
            }
            
            const data = await response.json();
            this.allCustomers = data.customers || [];
            
            // Filter to only show customers with active sessions
            this.allCustomers = this.allCustomers.filter(c => c.remaining_sessions > 0);
            
        } catch (error) {
            console.error('Error loading customers for search:', error);
            this.allCustomers = [];
        }
    }
    
    loadAllCustomers(studioId) {
        try {
            const allCustomersDiv = document.getElementById('allCustomers');
            if (!allCustomersDiv) return;
            
            // Filter customers with active sessions
            const activeCustomers = this.allCustomers.filter(customer => customer.remaining_sessions > 0);
            
            if (activeCustomers.length > 0) {
                allCustomersDiv.innerHTML = activeCustomers.map(customer => `
                    <button type="button" class="list-group-item list-group-item-action" 
                            onclick="window.app.selectCustomerForAppointment(${customer.id})">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${customer.contact_first_name} ${customer.contact_last_name}</strong>
                                <br>
                                <small class="text-muted">${customer.contact_phone || 'Keine Telefonnummer'}</small>
                            </div>
                            <span class="badge bg-primary">${customer.remaining_sessions} Sessions</span>
                        </div>
                    </button>
                `).join('');
            } else {
                allCustomersDiv.innerHTML = '<div class="text-muted p-2">Keine aktiven Kunden verfügbar</div>';
            }
            
        } catch (error) {
            console.error('Error loading all customers:', error);
            const allCustomersDiv = document.getElementById('allCustomers');
            if (allCustomersDiv) {
                allCustomersDiv.innerHTML = '<div class="text-danger p-2">Fehler beim Laden</div>';
            }
        }
    }
    
    renderCustomerSearchResults(customers) {
        const searchResultsDiv = document.getElementById('customerSearchResults');
        
        if (customers.length === 0) {
            searchResultsDiv.innerHTML = `
                <div class="position-absolute w-100 mt-1 bg-white border rounded shadow-sm p-2" style="z-index: 1000;">
                    <div class="text-muted">Keine Kunden gefunden</div>
                </div>
            `;
            return;
        }
        
        searchResultsDiv.innerHTML = `
            <div class="position-absolute w-100 mt-1 bg-white border rounded shadow-sm" style="z-index: 1000; max-height: 300px; overflow-y: auto;">
                ${customers.slice(0, 10).map(customer => `
                    <button type="button" class="list-group-item list-group-item-action border-0" 
                            onclick="window.app.selectCustomerForAppointment(${customer.id})">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${customer.contact_first_name} ${customer.contact_last_name}</strong>
                                <br>
                                <small class="text-muted">${customer.contact_phone || 'Keine Telefonnummer'}</small>
                            </div>
                            <span class="badge bg-success">${customer.remaining_sessions} Sessions</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    selectCustomerForAppointment(customerId) {
        const customer = this.allCustomers.find(c => c.id === customerId);
        if (!customer) return;
        
        this.selectedCustomerId = customerId;
        
        // Update hidden input
        document.getElementById('customerId').value = customerId;
        
        // Hide search and show selected customer
        document.getElementById('customerSearch').value = '';
        document.getElementById('customerSearchResults').innerHTML = '';
        document.getElementById('selectedCustomerInfo').classList.remove('d-none');
        document.getElementById('selectedCustomerName').textContent = `${customer.contact_first_name} ${customer.contact_last_name}`;
        document.getElementById('selectedCustomerSessions').textContent = `${customer.remaining_sessions} Behandlungen verfügbar`;
        
        // Hide customer list section and enable submit button
        document.getElementById('customerListSection').style.display = 'none';
        document.getElementById('createAppointmentSubmitBtn').disabled = false;
    }
    
    resetCustomerSelection() {
        this.selectedCustomerId = null;
        document.getElementById('customerId').value = '';
        document.getElementById('selectedCustomerInfo').classList.add('d-none');
        document.getElementById('customerSearch').value = '';
        
        // Show customer list section and disable submit button
        document.getElementById('customerListSection').style.display = 'block';
        document.getElementById('createAppointmentSubmitBtn').disabled = true;
    }
    
    // Day schedule preview removed for simplified interface
    
    renderDayTimelineView(appointments, selectedDate) {
        const hours = [];
        for (let i = 8; i <= 20; i++) {
            hours.push(i);
        }
        
        let html = '<div class="timeline-view">';
        
        hours.forEach(hour => {
            const hourStr = hour.toString().padStart(2, '0');
            const hasAppointment = appointments.find(apt => {
                const startHour = parseInt(apt.start_time.split(':')[0]);
                return startHour === hour;
            });
            
            html += `
                <div class="d-flex border-bottom py-2">
                    <div class="text-muted" style="width: 60px;">${hourStr}:00</div>
                    <div class="flex-grow-1 ps-3">
            `;
            
            if (hasAppointment) {
                const statusClass = this.getStatusBadgeClass(hasAppointment.status);
                html += `
                    <div class="alert alert-info py-1 px-2 mb-0">
                        <small>
                            <strong>${hasAppointment.start_time} - ${hasAppointment.end_time}</strong>
                            ${hasAppointment.customer_first_name} ${hasAppointment.customer_last_name}
                            <span class="badge ${statusClass} ms-2">${this.getStatusText(hasAppointment.status)}</span>
                        </small>
                    </div>
                `;
            } else {
                html += `<small class="text-muted">Verfügbar</small>`;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    quickScheduleAppointment(studioId, date, time) {
        // Navigate to create appointment form with pre-filled date and time
        this.showCreateAppointmentForm(studioId, new Date(date + 'T00:00:00'));
        
        // Wait for form to load then set time
        setTimeout(() => {
            const timeInput = document.getElementById('appointmentStartTime');
            if (timeInput) {
                timeInput.value = time;
            }
        }, 100);
    }
    
    async handleCreateAppointment(e, studioId) {
        e.preventDefault();
        
        // Get duration from form
        const duration = parseInt(document.getElementById('appointmentDuration').value);
        const startTime = document.getElementById('appointmentStartTime').value;
        const endTime = this.calculateEndTime(startTime, duration);
        
        // Debug: Check date value
        const appointmentDateElement = document.getElementById('appointmentDate');
        const appointmentDate = appointmentDateElement ? appointmentDateElement.value : '';
        
        console.log('Debug - appointmentDate element:', appointmentDateElement);
        console.log('Debug - appointmentDate value:', appointmentDate);
        
        if (!appointmentDate) {
            alert('Fehler: Kein Datum ausgewählt. Bitte wählen Sie ein Datum aus.');
            return;
        }
        
        // Validate appointment date is not in the past
        const selectedDate = new Date(appointmentDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        if (selectedDate < today) {
            alert('Fehler: Termine können nicht in der Vergangenheit geplant werden. Bitte wählen Sie ein heutiges oder zukünftiges Datum.');
            return;
        }
        
        const customerId = parseInt(document.getElementById('customerId').value);
        
        if (!customerId) {
            alert('Fehler: Kein Kunde ausgewählt. Bitte wählen Sie einen Kunden aus.');
            return;
        }
        
        if (!startTime) {
            alert('Fehler: Keine Startzeit angegeben. Bitte wählen Sie eine Uhrzeit aus.');
            return;
        }
        
        const formData = {
            studio_id: studioId,
            customer_id: customerId,
            appointment_type_id: 1, // Default to "Behandlung" type
            appointment_date: appointmentDate,
            start_time: startTime,
            end_time: endTime,
            status: document.getElementById('appointmentStatus').value || 'bestätigt',
            notes: document.getElementById('appointmentNotes').value
        };
        
        console.log('Debug - formData being sent:', formData);
        console.log('Debug - API_BASE_URL:', window.API_BASE_URL);
        console.log('Debug - authToken exists:', !!localStorage.getItem('authToken'));
        
        const submitBtn = document.getElementById('createAppointmentSubmitBtn');
        const errorDiv = document.getElementById('createAppointmentError');
        const successDiv = document.getElementById('createAppointmentSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Erstelle Behandlung...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            console.log('Debug - Request body:', JSON.stringify(formData, null, 2));
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            console.log('Debug - Response status:', response.status);
            console.log('Debug - Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                let errorMessage = 'Fehler beim Erstellen der Behandlung';
                try {
                    const errorData = await response.json();
                    console.log('Server error response:', errorData);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (parseError) {
                    console.log('Could not parse error response as JSON');
                    const errorText = await response.text();
                    console.log('Error response text:', errorText);
                    errorMessage = `Server error (${response.status}): ${errorText}`;
                }
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            
            successDiv.innerHTML = `
                <i class="fas fa-check-circle me-2"></i>
                Behandlung erfolgreich erstellt!
            `;
            successDiv.classList.remove('d-none');
            
            // Redirect after success
            setTimeout(() => {
                this.showAppointmentManagement(studioId);
            }, 1500);
            
        } catch (error) {
            console.error('Error creating appointment:', error);
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${error.message}
            `;
            errorDiv.classList.remove('d-none');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check me-1"></i>Behandlung erstellen';
        }
    }

    async confirmAppointment(appointmentId) {
        await this.updateAppointmentStatus(appointmentId, 'confirmed');
    }

    async cancelAppointment(appointmentId) {
        await this.updateAppointmentStatus(appointmentId, 'cancelled');
    }

    async updateAppointmentStatus(appointmentId, status) {
        try {
            // Try customer appointments first
            let response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ status })
            });
            
            // If not found, try lead appointments
            if (response.status === 404) {
                response = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ status })
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Aktualisieren des Status');
            }
            
            // Reload the current appointments view
            const appointmentsList = document.getElementById('appointmentsList');
            if (appointmentsList) {
                // Find the studio ID from the current context
                const studioResponse = await fetch(`${window.API_BASE_URL}/api/v1/studios/my-studio`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                
                if (studioResponse.ok) {
                    const studioData = await studioResponse.json();
                    this.loadAppointments(studioData.studio.id);
                }
            }
            
        } catch (error) {
            alert('Fehler beim Aktualisieren des Termins: ' + error.message);
        }
    }

    // Helper function to fetch appointment details (handles both customer and trial appointments)
    async fetchAppointmentDetails(appointmentId) {
        // First try customer appointments endpoint
        let response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            // Successfully found customer appointment
            const data = await response.json();
            return data.appointment || data;
        } else if (response.status === 404) {
            // Try lead appointments endpoint
            console.log('Customer appointment not found, trying lead appointments...');
            response = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const appointment = data.leadAppointment || data;
                // Mark as trial appointment for proper display
                appointment.isTrialAppointment = true;
                return appointment;
            } else {
                throw new Error('Termin nicht gefunden');
            }
        } else {
            throw new Error('Termin nicht gefunden');
        }
    }

    async editAppointment(appointmentId) {
        try {
            // Fetch appointment details using helper function
            const appointment = await this.fetchAppointmentDetails(appointmentId);

            // Show appointment details modal
            this.showAppointmentDetailsModal(appointment);
        } catch (error) {
            console.error('Error loading appointment details:', error);
            alert('Fehler beim Laden der Termindetails. Bitte versuchen Sie es erneut.');
        }
    }

    showAppointmentDetailsModal(appointment) {
        // Handle both customer and lead appointments
        let customerName, firstName, lastName, phone, email;
        
        if (appointment.isTrialAppointment || appointment.lead_name) {
            // Trial/Lead appointment
            customerName = appointment.lead_name || 'Lead';
            const nameParts = customerName.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
            phone = appointment.lead_phone || '';
            email = appointment.lead_email || '';
        } else {
            // Customer appointment
            customerName = this.getCustomerDisplayName(appointment);
            firstName = appointment.customer_first_name || '';
            lastName = appointment.customer_last_name || '';
            phone = appointment.customer_phone || '';
            email = appointment.customer_email || '';
        }
        
        const statusBadge = this.getListStatusBadge(appointment.status, appointment);
        
        // Calculate customer initials
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '??';
        
        // Check if appointment is in the past
        const now = new Date();
        
        // Debug appointment data first
        console.log('Appointment data:', {
            appointment_date: appointment.appointment_date,
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            status: appointment.status
        });
        
        // Safe date parsing with fallbacks
        let appointmentStart, appointmentEnd, isPast, hasStarted;
        try {
            if (!appointment.appointment_date || !appointment.start_time) {
                throw new Error('Missing appointment date or time');
            }
            
            // Handle different time formats (remove seconds if present)
            let cleanStartTime = appointment.start_time;
            let cleanEndTime = appointment.end_time;
            
            // If time includes seconds, remove them (HH:MM:SS -> HH:MM)
            if (cleanStartTime && cleanStartTime.split(':').length === 3) {
                cleanStartTime = cleanStartTime.substring(0, 5);
            }
            if (cleanEndTime && cleanEndTime.split(':').length === 3) {
                cleanEndTime = cleanEndTime.substring(0, 5);
            }
            
            console.log('Cleaned times:', { cleanStartTime, cleanEndTime });
            
            // Try multiple date parsing approaches
            let dateStr1 = `${appointment.appointment_date}T${cleanStartTime}`;
            let dateStr2 = `${appointment.appointment_date} ${cleanStartTime}`;
            
            console.log('Trying date strings:', { dateStr1, dateStr2 });
            
            // Try multiple parsing approaches
            appointmentStart = new Date(dateStr1);
            if (isNaN(appointmentStart.getTime())) {
                appointmentStart = new Date(dateStr2);
            }
            if (isNaN(appointmentStart.getTime())) {
                // Try parsing date and time separately
                const datePart = new Date(appointment.appointment_date);
                const [hours, minutes] = cleanStartTime.split(':');
                datePart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                appointmentStart = datePart;
            }
            
            const endTime = cleanEndTime || this.calculateEndTime(cleanStartTime, 60);
            let endDateStr1 = `${appointment.appointment_date}T${endTime}`;
            let endDateStr2 = `${appointment.appointment_date} ${endTime}`;
            
            appointmentEnd = new Date(endDateStr1);
            if (isNaN(appointmentEnd.getTime())) {
                appointmentEnd = new Date(endDateStr2);
            }
            if (isNaN(appointmentEnd.getTime())) {
                // Try parsing date and time separately
                const datePart = new Date(appointment.appointment_date);
                const [hours, minutes] = endTime.split(':');
                datePart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                appointmentEnd = datePart;
            }
            
            
            if (isNaN(appointmentStart.getTime()) || isNaN(appointmentEnd.getTime())) {
                throw new Error(`Invalid date format - Start: ${appointmentStart}, End: ${appointmentEnd}`);
            }
            
            isPast = appointmentEnd < now;
            hasStarted = appointmentStart <= now;
        } catch (dateError) {
            console.error('Date parsing error:', dateError);
            console.error('Raw appointment data:', appointment);
            // Fallback values
            appointmentStart = now;
            appointmentEnd = now;
            isPast = false;
            hasStarted = false;
        }
        
        const currentStatus = appointment.status;
        
        // Determine if we can show "Nicht erschienen" button
        const canMarkNoShow = hasStarted && (currentStatus === 'confirmed' || currentStatus === 'completed');
        
        // Debug logging for button visibility
        console.log('Nicht erschienen button debug:', {
            hasStarted,
            currentStatus,
            canMarkNoShow,
            appointmentStart: appointmentStart.toISOString(),
            now: now.toISOString()
        });
        
        // Create modal HTML with new design
        const modalHTML = `
            <div class="modal fade" id="appointmentDetailsModal" tabindex="-1" aria-labelledby="appointmentDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header p-0">
                            <div class="w-100">
                                <!-- Customer Header (Clickable) -->
                                <div class="bg-light p-4 border-bottom position-relative" style="cursor: pointer;" onclick="event.preventDefault(); ${appointment.isTrialAppointment || appointment.lead_name ? 'window.app.dismissModalAndShowLead(' + appointment.lead_id + ')' : 'window.app.dismissModalAndShowCustomer(' + (appointment.customer_ref_id || appointment.customer_id) + ')'}">
                                    <div class="d-flex align-items-center">
                                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" style="width: 60px; height: 60px; font-weight: bold; font-size: 1.5rem;">
                                            ${initials}
                                        </div>
                                        <div class="flex-grow-1">
                                            <h4 class="mb-1 text-dark">${customerName}</h4>
                                            <div class="text-muted">
                                                ${email ? `<i class="fas fa-envelope me-2"></i>${email}` : ''}
                                                ${phone ? `<br><i class="fas fa-phone me-2"></i>${phone}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button type="button" class="btn-close position-absolute top-0 end-0 m-3" data-bs-dismiss="modal" aria-label="Schließen" onclick="event.stopPropagation()"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Date & Time with inline edit button -->
                            <div class="mb-4">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="mb-0"><i class="fas fa-calendar me-2"></i>Datum & Zeit</h6>
                                    ${!isPast && currentStatus !== 'cancelled' && currentStatus !== 'no_show' && currentStatus !== 'abgesagt' && currentStatus !== 'nicht erschienen' ? `
                                        <div class="btn-group btn-group-sm" role="group">
                                            <button type="button" class="btn btn-outline-warning" onclick="window.app.rescheduleAppointment(${appointment.id})">
                                                <i class="fas fa-edit"></i> Bearbeiten
                                            </button>
                                            <button type="button" class="btn btn-outline-danger" onclick="window.app.cancelAppointment(${appointment.id})" data-bs-dismiss="modal">
                                                <i class="fas fa-times"></i> Stornieren
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                                <p class="mb-0">${this.formatDate(appointment.appointment_date)} um ${appointment.start_time}</p>
                                <small class="text-muted">${appointment.appointment_type_duration || 60} Minuten (bis ${appointment.end_time || this.calculateEndTime(appointment.start_time, 60)})</small>
                            </div>
                            
                            <!-- Treatment Type -->
                            <div class="mb-4">
                                <h6 class="mb-2"><i class="fas fa-cogs me-2"></i>Behandlungsart</h6>
                                <p class="mb-0">${appointment.appointment_type_name || 'Behandlung'}</p>
                            </div>
                            
                            <!-- Status with inline action -->
                            <div class="mb-4">
                                <div class="d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 class="mb-2"><i class="fas fa-info-circle me-2"></i>Status</h6>
                                        <span class="badge ${this.getStatusBadgeClass(appointment.status)} fs-6">
                                            ${this.getStatusText(appointment.status)}
                                        </span>
                                    </div>
                                    ${canMarkNoShow ? `
                                        <button type="button" class="btn btn-warning" onclick="window.app.markAsNoShow(${appointment.id})" data-bs-dismiss="modal">
                                            <i class="fas fa-user-times"></i> Nicht erschienen
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            
                            <!-- Notes -->
                            ${appointment.notes ? `
                                <div class="mb-4">
                                    <h6 class="mb-2"><i class="fas fa-sticky-note me-2"></i>Notizen</h6>
                                    <div class="editable-notes" onclick="window.app.editNotesInline(${appointment.id}, this, ${appointment.isTrialAppointment || appointment.lead_name ? true : false})">
                                        <div class="notes-display bg-light p-3 rounded" style="cursor: pointer;">
                                            <i class="fas fa-sticky-note me-2 text-muted"></i>${appointment.notes}
                                            <small class="text-muted d-block mt-1"><i class="fas fa-edit me-1"></i>Klicken zum Bearbeiten</small>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div class="mb-4">
                                    <h6 class="mb-2"><i class="fas fa-sticky-note me-2"></i>Notizen</h6>
                                    <div class="editable-notes" onclick="window.app.editNotesInline(${appointment.id}, this, ${appointment.isTrialAppointment || appointment.lead_name ? true : false})">
                                        <div class="notes-display bg-light p-3 rounded text-muted" style="cursor: pointer;">
                                            <i class="fas fa-plus me-2"></i>Notiz hinzufügen...
                                        </div>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('appointmentDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('appointmentDetailsModal'));
        modal.show();

        // Clean up modal after hiding
        document.getElementById('appointmentDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    async editAppointmentDetails(appointmentId) {
        try {
            // First, fetch the appointment details
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load appointment details');
            }

            const result = await response.json();
            const appointment = result.appointment || result;

            // Close the details modal and show edit modal
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (detailsModal) {
                detailsModal.hide();
            }

            // Create edit form modal
            this.showAppointmentEditModal(appointment);

        } catch (error) {
            console.error('Error loading appointment for editing:', error);
            alert('Fehler beim Laden der Termindetails zum Bearbeiten.');
        }
    }

    showAppointmentEditModal(appointment) {
        // Create edit modal HTML
        const modalHTML = `
            <div class="modal fade" id="appointmentEditModal" tabindex="-1" aria-labelledby="appointmentEditModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header" style="background-color: #7030a0; color: white;">
                            <h5 class="modal-title" id="appointmentEditModalLabel">
                                <i class="fas fa-edit me-2"></i>Termin bearbeiten
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editAppointmentForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="editAppointmentDate" class="form-label">
                                                <i class="fas fa-calendar me-2"></i>Datum
                                            </label>
                                            <input type="date" class="form-control" id="editAppointmentDate" 
                                                   value="${appointment.appointment_date}" required
                                                   min="${new Date().toISOString().split('T')[0]}">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="editStartTime" class="form-label">
                                                <i class="fas fa-clock me-2"></i>Startzeit
                                            </label>
                                            <input type="time" class="form-control" id="editStartTime" 
                                                   value="${appointment.start_time}" required>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="editAppointmentStatus" class="form-label">
                                                <i class="fas fa-info-circle me-2"></i>Status
                                            </label>
                                            <select class="form-select" id="editAppointmentStatus">
                                                <option value="pending" ${appointment.status === 'pending' ? 'selected' : ''}>Ausstehend</option>
                                                <option value="bestätigt" ${appointment.status === 'bestätigt' || appointment.status === 'confirmed' ? 'selected' : ''}>Bestätigt</option>
                                                <option value="abgeschlossen" ${appointment.status === 'abgeschlossen' || appointment.status === 'completed' ? 'selected' : ''}>Abgeschlossen</option>
                                                <option value="abgesagt" ${appointment.status === 'abgesagt' || appointment.status === 'cancelled' ? 'selected' : ''}>Abgesagt</option>
                                                <option value="nicht erschienen" ${appointment.status === 'nicht erschienen' || appointment.status === 'no_show' ? 'selected' : ''}>Nicht erschienen</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">
                                                <i class="fas fa-clock me-2"></i>Dauer
                                            </label>
                                            <input type="text" class="form-control" value="60 Minuten" readonly>
                                            <small class="text-muted">Endzeit wird automatisch berechnet</small>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-12">
                                        <div class="mb-3">
                                            <label for="editAppointmentNotes" class="form-label">
                                                <i class="fas fa-sticky-note me-2"></i>Notizen
                                            </label>
                                            <textarea class="form-control" id="editAppointmentNotes" rows="3" 
                                                      placeholder="Zusätzliche Notizen zum Termin...">${appointment.notes || ''}</textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-12">
                                        <div class="alert alert-info">
                                            <i class="fas fa-info-circle me-2"></i>
                                            <strong>Kunde:</strong> ${appointment.customer_first_name} ${appointment.customer_last_name}<br>
                                            <strong>Behandlung:</strong> ${appointment.appointment_type_name || 'Behandlung'}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" style="background-color: #7030a0; border-color: #7030a0;" onclick="window.app.saveAppointmentChanges(${appointment.id})">
                                <i class="fas fa-save me-1"></i>Änderungen speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing edit modal if present
        const existingModal = document.getElementById('appointmentEditModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('appointmentEditModal'));
        modal.show();

        // Clean up modal after hiding
        document.getElementById('appointmentEditModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async saveAppointmentChanges(appointmentId) {
        try {
            const appointmentDate = document.getElementById('editAppointmentDate').value;
            const startTime = document.getElementById('editStartTime').value;
            const status = document.getElementById('editAppointmentStatus').value;
            const notes = document.getElementById('editAppointmentNotes').value;

            // Calculate end time (60 minutes after start time)
            const [hours, minutes] = startTime.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0, 0);
            const endDate = new Date(startDate.getTime() + (60 * 60000));
            const endTime = endDate.toTimeString().slice(0, 5);

            // Prepare update data
            const updateData = {
                appointment_date: appointmentDate,
                start_time: startTime,
                end_time: endTime,
                status: status,
                notes: notes.trim() || null
            };

            // Send update request
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update appointment');
            }

            const result = await response.json();

            // Close the edit modal
            const editModal = bootstrap.Modal.getInstance(document.getElementById('appointmentEditModal'));
            if (editModal) {
                editModal.hide();
            }

            // Show success message
            this.showSuccessMessage('Erfolg!', 'Termin wurde erfolgreich aktualisiert.');

            // Refresh calendar and appointments view
            this.renderCalendar();
            if (this.currentStudioId) {
                this.loadAppointments(this.currentStudioId);
            }

        } catch (error) {
            console.error('Error saving appointment changes:', error);
            alert('Fehler beim Speichern der Änderungen: ' + error.message);
        }
    }

    async showCustomerFromAppointment(customerId) {
        try {
            // Close the appointment details modal first
            const appointmentModal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (appointmentModal) {
                appointmentModal.hide();
            }

            // Switch to customers view
            this.showCustomers();

            // Wait for customers to load, then show customer details
            setTimeout(async () => {
                // If customers not loaded yet, load them first
                if (!this.allCustomers || this.allCustomers.length === 0) {
                    await this.loadCustomersData(this.currentStudioId);
                }
                this.showCustomerDetails(customerId);
            }, 1000);

        } catch (error) {
            console.error('Error navigating to customer details:', error);
            alert('Fehler beim Wechseln zur Kundenansicht.');
        }
    }

    // Method to show customers section
    showCustomers() {
        // Get or set the current studio ID
        if (this.currentStudioId) {
            this.showCustomerList(this.currentStudioId);
        } else {
            // If no studio ID, try to get it from the user
            this.getCurrentStudioId().then(studioId => {
                if (studioId) {
                    this.showCustomerList(studioId);
                }
            });
        }
    }

    async rescheduleAppointment(appointmentId, isTrialAppointment = false) {
        try {
            let appointment, endpoint;
            
            // Determine the correct endpoint based on appointment type
            if (isTrialAppointment) {
                endpoint = `${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}`;
            } else {
                endpoint = `${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`;
            }
            
            // First, fetch the appointment details
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                // If regular appointment fails, try as trial appointment
                if (!isTrialAppointment) {
                    console.log('Regular appointment not found, trying as trial appointment...');
                    return this.rescheduleAppointment(appointmentId, true);
                }
                throw new Error('Failed to load appointment details');
            }

            const result = await response.json();
            appointment = result.appointment || result.leadAppointment || result;
            
            // Mark if it's a trial appointment for the modal
            if (isTrialAppointment) {
                appointment.isTrialAppointment = true;
            }

            // Close the details modal and show reschedule modal
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (detailsModal) {
                detailsModal.hide();
            }

            // Create reschedule modal
            this.showRescheduleModal(appointment);

        } catch (error) {
            console.error('Error loading appointment for rescheduling:', error);
            alert('Fehler beim Laden der Termindetails zum Umplanen.');
        }
    }

    showRescheduleModal(appointment) {
        const modalHTML = `
            <div class="modal fade" id="rescheduleModal" tabindex="-1" aria-labelledby="rescheduleModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title" id="rescheduleModalLabel">
                                <i class="fas fa-calendar-alt me-2"></i>Termin umplanen
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <strong>${appointment.isTrialAppointment ? 'Lead' : 'Kunde'}:</strong> ${
                                    appointment.isTrialAppointment 
                                        ? (appointment.lead_name || 'Unbekannt')
                                        : `${appointment.customer_first_name || ''} ${appointment.customer_last_name || ''}`.trim() || 'Unbekannt'
                                }<br>
                                <strong>Behandlung:</strong> ${appointment.appointment_type_name || 'Behandlung'}
                            </div>
                            
                            <form id="rescheduleForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="rescheduleDate" class="form-label">
                                                <i class="fas fa-calendar me-2"></i>Neues Datum
                                            </label>
                                            <input type="date" class="form-control" id="rescheduleDate" 
                                                   value="${appointment.appointment_date}" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="rescheduleTime" class="form-label">
                                                <i class="fas fa-clock me-2"></i>Neue Startzeit
                                            </label>
                                            <input type="time" class="form-control" id="rescheduleTime" 
                                                   value="${appointment.start_time}" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="rescheduleNotes" class="form-label">
                                        <i class="fas fa-sticky-note me-2"></i>Notiz zur Umplanung (optional)
                                    </label>
                                    <textarea class="form-control" id="rescheduleNotes" rows="2" 
                                              placeholder="Grund für die Umplanung..."></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-warning" onclick="window.app.saveReschedule(${appointment.id}, ${appointment.isTrialAppointment || false})">
                                <i class="fas fa-save me-1"></i>Termin umplanen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('rescheduleModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('rescheduleModal'));
        modal.show();

        // Clean up modal after hiding
        document.getElementById('rescheduleModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async saveReschedule(appointmentId, isTrialAppointment = false) {
        try {
            const date = document.getElementById('rescheduleDate').value;
            const time = document.getElementById('rescheduleTime').value;
            const notes = document.getElementById('rescheduleNotes').value;

            // Use correct endpoint for trial vs regular appointments
            const endpoint = isTrialAppointment 
                ? `${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}`
                : `${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    appointment_date: date,
                    start_time: time,
                    notes: notes ? `Umgeplant: ${notes}` : 'Termin wurde umgeplant'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to reschedule appointment');
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('rescheduleModal'));
            if (modal) {
                modal.hide();
            }

            // Show success message
            this.showSuccessMessage('Erfolg!', 'Termin wurde erfolgreich umgeplant.');

            // Refresh calendar
            this.renderCalendar();
            if (this.currentStudioId) {
                this.loadAppointments(this.currentStudioId);
            }

        } catch (error) {
            console.error('Error rescheduling appointment:', error);
            alert('Fehler beim Umplanen des Termins: ' + error.message);
        }
    }

    async cancelAppointment(appointmentId) {
        try {
            // Simple confirmation for studio owners (no policy warnings)
            const confirmed = confirm('Möchten Sie diesen Termin wirklich stornieren?');
            
            if (!confirmed) {
                return;
            }

            // Close the appointment details modal
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (detailsModal) {
                detailsModal.hide();
            }

            // Cancel the appointment - try customer appointments first
            let response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            // If not found, try lead appointments
            if (response.status === 404) {
                response = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
            }

            if (!response.ok) {
                throw new Error('Failed to cancel appointment');
            }

            const result = await response.json();

            // Show success message
            this.showSuccessMessage('Termin storniert', 'Der Termin wurde erfolgreich storniert.');

            // Refresh calendar
            this.renderCalendar();
            if (this.currentStudioId) {
                this.loadAppointments(this.currentStudioId);
            }

        } catch (error) {
            console.error('Error cancelling appointment:', error);
            alert('Fehler beim Stornieren des Termins: ' + error.message);
        }
    }

    async markAsNoShow(appointmentId) {
        try {
            // Confirm the action - more accurate message about session consumption
            const confirmed = confirm('Möchten Sie diesen Termin als "Nicht erschienen" markieren?');
            
            if (!confirmed) {
                return;
            }
            
            // Update status to "nicht erschienen" - try customer appointments first
            let response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ status: 'nicht erschienen' })
            });
            
            // If not found, try lead appointments
            if (response.status === 404) {
                response = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ status: 'nicht erschienen' })
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Aktualisieren des Status');
            }
            
            const result = await response.json();
            
            // Close the details modal
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (detailsModal) {
                detailsModal.hide();
            }
            
            // Show appropriate success message based on whether session was deducted
            if (result.sessionDeducted) {
                this.showSuccessMessage('Status aktualisiert', 'Der Termin wurde als "Nicht erschienen" markiert und eine Sitzung wurde verbraucht.');
            } else {
                this.showSuccessMessage('Status aktualisiert', 'Der Termin wurde als "Nicht erschienen" markiert. Keine zusätzliche Sitzung verbraucht.');
            }
            
            // Refresh calendar
            this.renderCalendar();
            if (this.currentStudioId) {
                this.loadAppointments(this.currentStudioId);
            }
            
        } catch (error) {
            console.error('Error marking appointment as no-show:', error);
            alert('Fehler: ' + error.message);
        }
    }

    async initStatusChange(appointmentId) {
        try {
            // First, fetch current appointment status
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load appointment details');
            }

            const result = await response.json();
            const appointment = result.appointment || result;

            // Close the details modal and show status change modal
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (detailsModal) {
                detailsModal.hide();
            }

            // Create status change modal
            this.showStatusChangeModal(appointment);

        } catch (error) {
            console.error('Error loading appointment for status change:', error);
            alert('Fehler beim Laden der Termindetails.');
        }
    }

    showStatusChangeModal(appointment) {
        // Get available status options based on appointment time
        const statusOptions = this.getAvailableStatusOptions(appointment);
        const statusOptionsHTML = statusOptions.map(option => 
            `<option value="${option.value}" ${appointment.status === option.value || appointment.status === option.englishValue ? 'selected' : ''}>${option.label}</option>`
        ).join('');
        
        // Get any warnings for status changes
        const statusWarning = this.getStatusChangeWarning(appointment);
        
        const modalHTML = `
            <div class="modal fade" id="statusChangeModal" tabindex="-1" aria-labelledby="statusChangeModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header" style="background-color: #7030a0; color: white;">
                            <h5 class="modal-title" id="statusChangeModalLabel">
                                <i class="fas fa-exchange-alt me-2"></i>Status ändern
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <h6><i class="fas fa-user me-2"></i>Termin für:</h6>
                                <p class="mb-2">${appointment.customer_first_name} ${appointment.customer_last_name}</p>
                                <p class="mb-3 text-muted">${this.formatDate(appointment.appointment_date)} um ${appointment.start_time}</p>
                            </div>
                            
                            <div class="mb-3">
                                <label for="newStatus" class="form-label">
                                    <i class="fas fa-info-circle me-2"></i>Neuer Status:
                                </label>
                                <select class="form-select" id="newStatus">
                                    ${statusOptionsHTML}
                                </select>
                            </div>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Aktueller Status:</strong> 
                                <span class="badge ${this.getStatusBadgeClass(appointment.status)} ms-2">
                                    ${this.getStatusText(appointment.status)}
                                </span>
                            </div>
                            
                            ${statusWarning ? `
                                <div class="alert alert-warning">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    ${statusWarning}
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" style="background-color: #7030a0; border-color: #7030a0;" onclick="window.app.updateAppointmentStatus(${appointment.id})">
                                <i class="fas fa-check me-1"></i>Status aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('statusChangeModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('statusChangeModal'));
        modal.show();

        // Clean up modal after hiding
        document.getElementById('statusChangeModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async updateAppointmentStatus(appointmentId) {
        try {
            const newStatus = document.getElementById('newStatus').value;

            // Send status update request
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update appointment status');
            }

            const result = await response.json();

            // Close the status modal
            const statusModal = bootstrap.Modal.getInstance(document.getElementById('statusChangeModal'));
            if (statusModal) {
                statusModal.hide();
            }

            // Show success message
            this.showSuccessMessage('Erfolg!', 'Terminstatus wurde erfolgreich aktualisiert.');

            // Refresh calendar and appointments view
            this.renderCalendar();
            if (this.currentStudioId) {
                this.loadAppointments(this.currentStudioId);
            }

        } catch (error) {
            console.error('Error updating appointment status:', error);
            alert('Fehler beim Aktualisieren des Status: ' + error.message);
        }
    }

    async markAppointmentCompleted(appointmentId) {
        if (!confirm('Termin als abgeschlossen markieren?')) {
            return;
        }
        
        try {
            await this.updateAppointmentStatus(appointmentId, 'abgeschlossen');
            
            // Refresh list view if we're in list mode
            if (this.currentAppointmentView === 'list') {
                await this.loadAllAppointments(this.currentStudioId);
            }
            
            this.showSuccessMessage('Erfolg!', 'Termin wurde als abgeschlossen markiert.');
        } catch (error) {
            console.error('Error marking appointment as completed:', error);
            alert('Fehler beim Markieren als abgeschlossen: ' + error.message);
        }
    }


    async viewAppointmentDetails(appointmentId) {
        try {
            // Fetch appointment details using helper function
            const appointment = await this.fetchAppointmentDetails(appointmentId);
            
            // Show appointment details modal
            this.showAppointmentDetailsModal(appointment);
            
        } catch (error) {
            console.error('Error loading appointment details:', error);
            alert('Fehler beim Laden der Termindetails: ' + error.message);
        }
    }


    async addAppointmentNotes(appointmentId) {
        // Get current appointment to prefill notes
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Termin nicht gefunden');
            }
            
            const data = await response.json();
            const appointment = data.appointment;
            
            const notes = prompt('Notiz hinzufügen oder bearbeiten:', appointment.notes || '');
            
            if (notes !== null) {
                await this.updateAppointmentNotes(appointmentId, notes);
            }
            
        } catch (error) {
            console.error('Error loading appointment for notes:', error);
            
            // Fallback: just ask for new notes
            const notes = prompt('Notiz hinzufügen:');
            if (notes !== null) {
                await this.updateAppointmentNotes(appointmentId, notes);
            }
        }
    }

    async updateAppointmentNotes(appointmentId, notes) {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ notes })
            });
            
            if (!response.ok) {
                throw new Error('Fehler beim Speichern der Notiz');
            }
            
            // Refresh list view if we're in list mode
            if (this.currentAppointmentView === 'list') {
                await this.loadAllAppointments(this.currentStudioId);
            }
            
            this.showSuccessMessage('Erfolg!', 'Notiz wurde gespeichert.');
            
        } catch (error) {
            console.error('Error updating appointment notes:', error);
            alert('Fehler beim Speichern der Notiz: ' + error.message);
        }
    }

    calculateEndTime(startTime, durationMinutes) {
        if (!startTime) return '';
        
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate.getTime() + (durationMinutes * 60000));
        
        return endDate.toTimeString().slice(0, 5); // Return in HH:MM format
    }

    async loadTodaysAppointments(studioId) {
        const todaysDiv = document.getElementById('todaysAppointments');
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/studio/${studioId}?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load today\'s appointments');
            }
            
            const data = await response.json();
            const appointments = data.appointments || [];
            
            if (appointments.length === 0) {
                todaysDiv.innerHTML = `
                    <div class="text-muted">
                        <small>Keine Termine für heute</small>
                    </div>
                `;
            } else {
                todaysDiv.innerHTML = `
                    <div class="list-group">
                        ${appointments.map(appointment => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${appointment.start_time} - ${appointment.end_time}</strong><br>
                                    <small>${appointment.customer_first_name} ${appointment.customer_last_name}</small>
                                </div>
                                <span class="badge ${this.getStatusBadgeClass(appointment.status)}">
                                    ${this.getStatusText(appointment.status)}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
        } catch (error) {
            todaysDiv.innerHTML = `
                <div class="alert alert-warning alert-sm">
                    <small>Fehler beim Laden der Termine: ${error.message}</small>
                </div>
            `;
        }
    }

    showCustomerList(studioId) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="container-fluid p-4">
                <!-- Customers Content -->
                <div id="customersContent">
                    <!-- CustomerManagement component will be initialized here -->
                </div>
                
                <!-- Customers Grid (Legacy) -->
                <div class="customers-grid" id="customersGrid" style="display: none;">
                    <!-- Loading state -->
                    <div class="col-12">
                        <div class="text-center py-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-3 text-muted">Lade Kunden...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize customer management
        console.log('About to initialize customer management with studioId:', studioId);
        this.initializeCustomerManagement(studioId);
    }

    initializeCustomerManagement(studioId) {
        // Validate studio ID before proceeding
        if (!studioId || studioId === 'undefined') {
            console.warn('initializeCustomerManagement called with invalid studio ID:', studioId);
            return;
        }
        
        // Use the CustomerManagement component if available
        if (typeof CustomerManagement !== 'undefined') {
            console.log('Using CustomerManagement component for studio:', studioId);
            const container = document.getElementById('customersContent');
            if (container) {
                container.innerHTML = '<div id="customer-management-content"></div>';
                
                // Create instance if it doesn't exist
                if (!window.customerManagement) {
                    console.log('Creating new CustomerManagement instance');
                    window.customerManagement = new CustomerManagement();
                }
                
                // Always call init - it will handle whether to reinitialize or just refresh
                console.log('Calling CustomerManagement init with studioId:', studioId);
                window.customerManagement.init(studioId);
                
                return;
            }
        }
        
        // Fallback to built-in implementation
        this.currentStudioId = studioId;
        this.allCustomers = [];
        this.filteredCustomers = [];
        this.searchTerm = '';
        this.statusFilter = 'all';

        // Set up event listeners
        this.setupCustomerSearchAndFilter();
        
        // Load customers
        this.loadCustomersData(studioId);
    }

    setupCustomerSearchAndFilter() {
        const searchInput = document.getElementById('customerSearch');
        const statusFilter = document.getElementById('statusFilter');
        const addCustomerBtn = document.getElementById('addCustomerBtn');

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTerm = e.target.value.toLowerCase();
                    this.filterAndRenderCustomers();
                }, 300);
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.filterAndRenderCustomers();
            });
        }

        if (addCustomerBtn) {
            addCustomerBtn.addEventListener('click', () => {
                this.showAddCustomerModal();
            });
        }
    }

    async loadCustomersData(studioId) {
        // Guard against undefined studio ID
        if (!studioId || studioId === 'undefined') {
            console.warn('loadCustomersData called with invalid studio ID:', studioId);
            this.allCustomers = [];
            this.filterAndRenderCustomers();
            return;
        }
        
        try {
            // Fetch customers from real API endpoint
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                let customers = data.customers || [];
                
                // Enhance customers with session block data
                customers = await this.enhanceCustomersWithSessionData(customers);
                
                this.allCustomers = customers;
            } else {
                // Use mock data for now
                this.allCustomers = this.getMockCustomers();
            }
        } catch (error) {
            console.error('Error loading customers:', error);
            this.allCustomers = this.getMockCustomers();
        }

        this.filterAndRenderCustomers();
    }

    async enhanceCustomersWithSessionData(customers) {
        // Process customers in batches to avoid overwhelming the API
        const enhancedCustomers = [];
        
        for (const customer of customers) {
            try {
                // Fetch session blocks for this customer
                const sessionBlocks = await this.loadCustomerSessionBlocks(customer.id);
                
                // Calculate totals
                const totalSessions = sessionBlocks.reduce((sum, block) => sum + (block.total_sessions || 0), 0);
                const remainingSessions = sessionBlocks.reduce((sum, block) => sum + (block.remaining_sessions || 0), 0);
                const completedSessions = totalSessions - remainingSessions;
                
                // Determine if customer is active (has remaining sessions)
                const isActive = remainingSessions > 0;
                
                // Update customer object
                const enhancedCustomer = {
                    ...customer,
                    total_sessions: totalSessions,
                    remaining_sessions: remainingSessions,
                    completed_sessions: completedSessions,
                    is_active: isActive,
                    status: isActive ? 'aktiv' : (customer.status || 'neu')
                };
                
                enhancedCustomers.push(enhancedCustomer);
            } catch (error) {
                console.error(`Error loading session data for customer ${customer.id}:`, error);
                // Add customer without session data if API fails
                enhancedCustomers.push({
                    ...customer,
                    total_sessions: 0,
                    remaining_sessions: 0,
                    completed_sessions: 0,
                    is_active: false
                });
            }
        }
        
        return enhancedCustomers;
    }

    getMockCustomers() {
        return [
            {
                id: 1,
                firstName: 'Anna',
                lastName: 'Schmidt',
                email: 'anna.schmidt@email.com',
                phone: '+49 123 456789',
                status: 'active',
                sessionBalance: 8,
                lastAppointment: '2024-01-15',
                createdDate: '2023-12-01'
            },
            {
                id: 2,
                firstName: 'Marco',
                lastName: 'Weber',
                email: 'marco.weber@email.com',
                phone: '+49 987 654321',
                status: 'vip',
                sessionBalance: 12,
                lastAppointment: '2024-01-18',
                createdDate: '2023-11-15'
            },
            {
                id: 3,
                firstName: 'Sarah',
                lastName: 'Müller',
                email: 'sarah.mueller@email.com',
                phone: '+49 555 123456',
                status: 'inactive',
                sessionBalance: 2,
                lastAppointment: '2023-12-20',
                createdDate: '2023-10-10'
            },
            {
                id: 4,
                firstName: 'Lisa',
                lastName: 'Klein',
                email: 'lisa.klein@email.com',
                phone: '+49 777 888999',
                status: 'new',
                sessionBalance: 5,
                lastAppointment: null,
                createdDate: '2024-01-20'
            }
        ];
    }

    filterAndRenderCustomers() {
        this.filteredCustomers = this.allCustomers.filter(customer => {
            // Handle both camelCase (mock) and snake_case (database) field names
            const firstName = (customer.contact_first_name || customer.first_name || customer.firstName || '').toLowerCase();
            const lastName = (customer.contact_last_name || customer.last_name || customer.lastName || '').toLowerCase();
            const email = (customer.email || '').toLowerCase();
            const phone = customer.phone || '';
            
            const matchesSearch = !this.searchTerm || 
                firstName.includes(this.searchTerm) ||
                lastName.includes(this.searchTerm) ||
                email.includes(this.searchTerm) ||
                phone.includes(this.searchTerm);

            const matchesStatus = this.statusFilter === 'all' || 
                customer.status === this.statusFilter;

            return matchesSearch && matchesStatus;
        });

        this.renderCustomersGrid();
        this.updateCustomerCount();
    }

    renderCustomersGrid() {
        const grid = document.getElementById('customersGrid');
        if (!grid) return;

        if (this.filteredCustomers.length === 0) {
            grid.innerHTML = this.createEmptyState();
            return;
        }

        const customersHTML = this.filteredCustomers.map((customer, index) => 
            this.createCustomerCard(customer, index)
        ).join('');

        grid.innerHTML = customersHTML;

        // Add staggered animation
        setTimeout(() => {
            const cards = grid.querySelectorAll('.customer-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    card.style.transition = 'all 0.6s ease';
                    
                    requestAnimationFrame(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    });
                }, index * 100);
            });
        }, 100);
    }

    createCustomerCard(customer, index) {
        // Handle both camelCase (mock) and snake_case (database) field names
        const firstName = customer.contact_first_name || customer.first_name || customer.firstName || '';
        const lastName = customer.contact_last_name || customer.last_name || customer.lastName || '';
        const initials = this.getCustomerInitials(firstName, lastName);
        const statusClass = this.getStatusClass(customer.status);
        const statusText = this.getStatusText(customer.status);
        
        return `
            <div class="customer-card" data-customer-id="${customer.id}" style="animation-delay: ${index * 0.1}s">
                <div class="customer-card-header">
                    <div class="customer-avatar">
                        <span class="avatar-initials">${initials}</span>
                    </div>
                    <div class="customer-info">
                        <h3 class="customer-name">${firstName} ${lastName}</h3>
                        <p class="customer-email">${customer.email}</p>
                    </div>
                    <span class="customer-status ${statusClass}">
                        ${statusText}
                    </span>
                </div>
                
                <div class="customer-details">
                    <div class="detail-row">
                        <span class="detail-label">Telefon:</span>
                        <span class="detail-value">${customer.phone || 'Nicht angegeben'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Behandlungen:</span>
                        <span class="detail-value">${customer.completed_sessions || 0}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Registriert:</span>
                        <span class="detail-value">${this.formatDate(customer.created_at) || 'Unbekannt'}</span>
                    </div>
                </div>
                
                <div class="customer-actions">
                    <button class="btn btn-outline-primary details-btn" onclick="app.showCustomerDetails(${customer.id})">
                        <i class="fas fa-eye me-2"></i>
                        Details anzeigen
                    </button>
                </div>
            </div>
        `;
    }

    createEmptyState() {
        return `
            <div class="customers-empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-users"></i>
                </div>
                <h3 class="empty-state-title">
                    ${this.searchTerm || this.statusFilter !== 'all' 
                        ? 'Keine Kunden gefunden' 
                        : 'Noch keine Kunden'}
                </h3>
                <p class="empty-state-text">
                    ${this.searchTerm || this.statusFilter !== 'all' 
                        ? 'Versuchen Sie, Ihre Suchkriterien zu ändern' 
                        : 'Fügen Sie Ihren ersten Kunden hinzu, um zu beginnen'}
                </p>
                ${this.searchTerm || this.statusFilter !== 'all' ? '' : `
                    <button class="btn btn-primary" onclick="app.showAddCustomerModal()">
                        <i class="fas fa-plus me-2"></i>
                        Ersten Kunden hinzufügen
                    </button>
                `}
            </div>
        `;
    }

    getCustomerInitials(firstName, lastName) {
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }

    getStatusClass(status) {
        const statusClasses = {
            'neu': 'new',
            'aktiv': 'active'
        };
        return statusClasses[status] || '';
    }

    getStatusText(status) {
        const statusMap = {
            'neu': 'Neu',
            'aktiv': 'Aktiv'
        };
        return statusMap[status] || '';
    }

    updateCustomerCount() {
        const countElement = document.getElementById('customerCountNumber');
        if (countElement) {
            countElement.textContent = this.filteredCustomers.length;
        }
    }

    formatDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE');
    }

    async loadCustomerAppointmentHistory(customerId) {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/customer/${customerId}/history?studioId=${this.currentStudioId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load appointment history');
            }
            
            const data = await response.json();
            this.displayAppointmentHistory(data.pastAppointments || [], data.upcomingAppointments || []);
            
        } catch (error) {
            console.error('Error loading appointment history:', error);
            const container = document.getElementById('appointmentHistoryContainer');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Terminhistorie konnte nicht geladen werden
                    </div>
                `;
            }
        }
    }
    
    displayAppointmentHistory(pastAppointments, upcomingAppointments) {
        const container = document.getElementById('appointmentHistoryContainer');
        if (!container) return;
        
        let html = '';
        
        // Upcoming appointments section
        if (upcomingAppointments.length > 0) {
            html += `
                <div class="mb-4">
                    <h6 class="text-primary mb-3">
                        <i class="fas fa-calendar-check me-2"></i>Kommende Termine (${upcomingAppointments.length})
                    </h6>
                    <div class="list-group">
            `;
            
            upcomingAppointments.forEach(apt => {
                const statusBadge = this.getAppointmentStatusBadge(apt.status);
                const typeColor = apt.appointment_type_color || '#28a745';
                html += `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge" style="background-color: ${typeColor}">
                                    ${apt.appointment_type_name || 'Termin'}
                                </span>
                                <strong class="ms-2">${this.formatDate(apt.appointment_date)}</strong>
                                <span class="text-muted ms-2">${apt.start_time} - ${apt.end_time}</span>
                            </div>
                            ${statusBadge}
                        </div>
                        ${apt.notes ? `<small class="text-muted d-block mt-1">${apt.notes}</small>` : ''}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Past appointments section
        if (pastAppointments.length > 0) {
            html += `
                <div>
                    <h6 class="text-secondary mb-3">
                        <i class="fas fa-history me-2"></i>Vergangene Termine (${pastAppointments.length})
                    </h6>
                    <div class="list-group">
            `;
            
            // Show only last 10 past appointments
            pastAppointments.slice(0, 10).forEach(apt => {
                const statusBadge = this.getAppointmentStatusBadge(apt.status);
                const typeColor = apt.appointment_type_color || '#6c757d';
                html += `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge" style="background-color: ${typeColor}; opacity: 0.7">
                                    ${apt.appointment_type_name || 'Termin'}
                                </span>
                                <span class="ms-2">${this.formatDate(apt.appointment_date)}</span>
                                <span class="text-muted ms-2">${apt.start_time} - ${apt.end_time}</span>
                            </div>
                            ${statusBadge}
                        </div>
                        ${apt.notes ? `<small class="text-muted d-block mt-1">${apt.notes}</small>` : ''}
                    </div>
                `;
            });
            
            if (pastAppointments.length > 10) {
                html += `
                    <div class="text-center mt-2">
                        <small class="text-muted">... und ${pastAppointments.length - 10} weitere vergangene Termine</small>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Empty state
        if (upcomingAppointments.length === 0 && pastAppointments.length === 0) {
            html = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-calendar-times fa-3x mb-3"></i>
                    <p>Keine Termine vorhanden</p>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    getAppointmentStatusBadge(status) {
        const statusMap = {
            'bestätigt': '<span class="badge bg-primary">Bestätigt</span>',
            'absolviert': '<span class="badge bg-success">Absolviert</span>',
            'nicht_erschienen': '<span class="badge bg-warning">Nicht erschienen</span>',
            'storniert': '<span class="badge bg-secondary">Storniert</span>'
        };
        return statusMap[status] || `<span class="badge bg-secondary">${status}</span>`;
    }

    async dismissModalAndShowCustomer(customerId) {
        try {
            // Close appointment details modal first
            const modal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (modal) modal.hide();
            
            // Wait for modal to close, then show customer details using shared CustomerManagement modal
            setTimeout(async () => {
                // Ensure CustomerManagement is initialized
                if (!window.customerManagement) {
                    if (typeof CustomerManagement !== 'undefined') {
                        window.customerManagement = new CustomerManagement();
                        if (this.currentStudioId) {
                            await window.customerManagement.init(this.currentStudioId, true);
                        }
                    } else {
                        console.error('CustomerManagement class not available');
                        alert('Fehler: Kundenverwaltung nicht verfügbar');
                        return;
                    }
                }
                
                if (window.customerManagement && window.customerManagement.showCustomerDetails) {
                    await window.customerManagement.showCustomerDetails(customerId);
                } else {
                    console.error('CustomerManagement.showCustomerDetails not available');
                    alert('Fehler: Kundenverwaltung nicht verfügbar');
                }
            }, 300);
        } catch (error) {
            console.error('Error in dismissModalAndShowCustomer:', error);
        }
    }

    async dismissModalAndShowLead(leadId) {
        try {
            // Close appointment details modal first
            const modal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
            if (modal) modal.hide();
            
            // Wait for modal to close, then show lead details
            setTimeout(async () => {
                // Try to use LeadKanban if available AND functional
                if (window.leadKanban && 
                    window.leadKanban.showLeadDetails && 
                    typeof window.leadKanban.showLeadDetails === 'function') {
                    
                    try {
                        // Test if LeadKanban modal elements exist
                        if (document.getElementById('leadDetailsModal') || 
                            (window.leadKanban.renderModals && typeof window.leadKanban.renderModals === 'function')) {
                            await window.leadKanban.showLeadDetails(leadId);
                            return;
                        }
                    } catch (leadKanbanError) {
                        console.warn('LeadKanban failed, falling back to standalone modal:', leadKanbanError);
                    }
                }
                
                // Fallback to standalone modal (always reliable)
                await this.showLeadDetailsStandalone(leadId);
            }, 300);
        } catch (error) {
            console.error('Error in dismissModalAndShowLead:', error);
            // Show user-friendly error message
            this.showNotification('Fehler beim Öffnen der Lead-Details', 'error');
        }
    }

    async showLeadDetailsStandalone(leadId) {
        try {
            // Fetch lead details from API
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/leads/${leadId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch lead details');

            const data = await response.json();
            const lead = data.lead;

            // Ensure modal exists (following CustomerManagement pattern)
            this.ensureLeadModalExists();
            
            // Verify modal content element exists before populating
            const modalContent = document.getElementById('standalone-lead-details-content');
            if (!modalContent) {
                console.error('standalone-lead-details-content element not found, recreating modal');
                // Force recreate the modal
                this.createStandaloneLeadModal();
            }

            // Populate modal with lead data
            this.populateLeadModalContent(lead);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('standaloneLeadModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading lead details:', error);
            this.showNotification('Fehler beim Laden der Lead-Details', 'error');
        }
    }

    // Following CustomerManagement pattern - ensure modal exists
    ensureLeadModalExists() {
        if (!document.getElementById('standaloneLeadModal')) {
            this.createStandaloneLeadModal();
        }
    }

    // Separate content population for better error handling
    populateLeadModalContent(lead) {
        try {
            // Use safer element selection with error handling
            const setElementText = (id, text) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = text;
                } else {
                    console.warn(`Element ${id} not found during lead modal population`);
                }
            };

            setElementText('standalone-lead-name', lead.name || '-');
            setElementText('standalone-lead-phone', this.formatPhone(lead.phone_number) || '-');
            setElementText('standalone-lead-email', lead.email || '-');
            setElementText('standalone-lead-source', lead.source || '-');
            setElementText('standalone-lead-created', new Date(lead.created_at).toLocaleDateString('de-DE'));
            setElementText('standalone-lead-notes', lead.notes || 'Keine Notizen');
            
            // Status badge with error handling
            const statusBadge = document.getElementById('standalone-lead-status');
            if (statusBadge) {
                statusBadge.textContent = this.getLeadStatusDisplay(lead.status);
                statusBadge.className = `badge ${this.getLeadStatusBadgeClass(lead.status)}`;
            }

        } catch (populateError) {
            console.error('Error populating lead modal content:', populateError);
            throw populateError;
        }
    }

    createStandaloneLeadModal() {
        // Remove existing modal if present (following CustomerManagement pattern)
        const existingModal = document.getElementById('standaloneLeadModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div class="modal fade" id="standaloneLeadModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person me-2"></i>
                                Lead Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="standalone-lead-details-content">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Name</label>
                                    <div class="form-control-plaintext" id="standalone-lead-name">-</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Telefon</label>
                                    <div class="form-control-plaintext" id="standalone-lead-phone">-</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">E-Mail</label>
                                    <div class="form-control-plaintext" id="standalone-lead-email">-</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Quelle</label>
                                    <div class="form-control-plaintext" id="standalone-lead-source">-</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Status</label>
                                    <div class="form-control-plaintext">
                                        <span class="badge" id="standalone-lead-status">-</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Erstellt am</label>
                                    <div class="form-control-plaintext" id="standalone-lead-created">-</div>
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Notizen</label>
                                    <div class="form-control-plaintext" id="standalone-lead-notes" style="min-height: 60px; padding: 8px; background: #f8f9fa; border-radius: 4px;">-</div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="window.app.openLeadManagement()">
                                <i class="bi bi-kanban me-1"></i>
                                Lead Management öffnen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .bg-brown {
                    background-color: #8B4513 !important;
                    color: white !important;
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    getLeadStatusDisplay(status) {
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

    getLeadStatusBadgeClass(status) {
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

    openLeadManagement() {
        // Close the lead details modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('standaloneLeadModal'));
        if (modal) modal.hide();
        
        // Switch to Lead Management tab
        this.switchToView('lead-kanban');
    }

    editNotesInline(appointmentId, container, isLeadAppointment = false) {
        const display = container.querySelector('.notes-display');
        const currentText = display.textContent.replace('Klicken zum Bearbeiten', '').replace('Notiz hinzufügen...', '').trim();
        
        // Create textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'form-control';
        textarea.value = currentText;
        textarea.rows = 3;
        
        // Replace display with textarea
        container.innerHTML = '';
        container.appendChild(textarea);
        textarea.focus();
        
        // Save on blur
        textarea.addEventListener('blur', async () => {
            await this.saveNotesInline(appointmentId, textarea.value, container, isLeadAppointment);
        });
        
        // Save on Escape
        textarea.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape') {
                await this.saveNotesInline(appointmentId, textarea.value, container, isLeadAppointment);
            }
        });
    }

    async saveNotesInline(appointmentId, notes, container, isLeadAppointment = false) {
        try {
            // Try customer appointments first, unless we know it's a lead appointment
            let response = await fetch(
                isLeadAppointment 
                    ? `${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}`
                    : `${window.API_BASE_URL}/api/v1/appointments/${appointmentId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ notes })
                }
            );
            
            // If customer appointment failed with 404, try lead appointments
            if (!isLeadAppointment && response.status === 404) {
                response = await fetch(`${window.API_BASE_URL}/api/v1/lead-appointments/${appointmentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ notes })
                });
            }
            
            if (!response.ok) throw new Error('Failed to save notes');
            
            // Restore display
            container.innerHTML = notes ? 
                `<div class="notes-display bg-light p-3 rounded" style="cursor: pointer;">
                    <i class="fas fa-sticky-note me-2 text-muted"></i>${notes}
                    <small class="text-muted d-block mt-1"><i class="fas fa-edit me-1"></i>Klicken zum Bearbeiten</small>
                </div>` :
                `<div class="notes-display bg-light p-3 rounded text-muted" style="cursor: pointer;">
                    <i class="fas fa-plus me-2"></i>Notiz hinzufügen...
                </div>`;
                
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Fehler beim Speichern der Notiz');
        }
    }

    async showCustomerDetails(customerId) {
        const customer = this.allCustomers.find(c => c.id === customerId);
        if (!customer) {
            alert('Kunde nicht gefunden');
            return;
        }

        // Store current customer ID for session operations
        this.currentCustomerId = customerId;

        // Get customer's session blocks
        const sessionBlocks = await this.loadCustomerSessionBlocks(customerId);
        
        // Ensure sessionBlocks is always an array
        const safeSessionBlocks = Array.isArray(sessionBlocks) ? sessionBlocks : [];
        
        const firstName = customer.contact_first_name || customer.first_name || customer.firstName || '';
        const lastName = customer.contact_last_name || customer.last_name || customer.lastName || '';
        
        // Remove any existing customer modal to prevent conflicts
        let existingModal = document.getElementById('customerDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Always create fresh modal
        const modalHTML = this.createCustomerModalHTML(customer, safeSessionBlocks, customerId);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('customerDetailsModal'));

        // Show modal
        modal.show();
        
        // Load appointment history after modal is shown
        this.loadCustomerAppointmentHistory(customerId);
    }

    createCustomerModalHTML(customer, safeSessionBlocks, customerId) {
        const firstName = customer.contact_first_name || customer.first_name || customer.firstName || '';
        const lastName = customer.contact_last_name || customer.last_name || customer.lastName || '';
        
        return `
            <div class="modal fade" id="customerDetailsModal" tabindex="-1" aria-labelledby="customerDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="customerDetailsModalLabel">
                                <i class="fas fa-user me-2"></i>
                                <span id="customerModalName">${firstName} ${lastName}</span>
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body" id="customerModalBody">
                            ${this.createCustomerModalBodyContent(customer, safeSessionBlocks, customerId)}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createCustomerModalBodyContent(customer, safeSessionBlocks, customerId) {
        const firstName = customer.contact_first_name || customer.first_name || customer.firstName || '';
        const lastName = customer.contact_last_name || customer.last_name || customer.lastName || '';
        
        return `
            <!-- Customer Info -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Kundendaten</h6>
                            <button class="btn btn-sm btn-outline-primary" onclick="app.toggleCustomerEdit(${customerId})">
                                <i class="fas fa-edit"></i> Bearbeiten
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="customerViewMode-${customerId}">
                                <p class="mb-2"><strong>Email:</strong> ${customer.email}</p>
                                <p class="mb-2"><strong>Telefon:</strong> ${customer.phone || 'Nicht angegeben'}</p>
                                <p class="mb-0"><strong>Registriert:</strong> ${this.formatDate(customer.created_at)}</p>
                                ${customer.status === 'neu' ? '<span class="badge bg-info mt-2">Neuer Kunde</span>' : ''}
                            </div>
                            <div id="customerEditMode-${customerId}" style="display: none;">
                                <form id="customerEditForm-${customerId}">
                                    <div class="mb-3">
                                        <label class="form-label"><strong>Vorname:</strong></label>
                                        <input type="text" class="form-control" id="editFirstName-${customerId}" value="${firstName}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><strong>Nachname:</strong></label>
                                        <input type="text" class="form-control" id="editLastName-${customerId}" value="${lastName}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><strong>Email:</strong></label>
                                        <input type="email" class="form-control" id="editEmail-${customerId}" value="${customer.email}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><strong>Telefon:</strong></label>
                                        <input type="text" class="form-control" id="editPhone-${customerId}" value="${customer.phone || ''}">
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button type="button" class="btn btn-success btn-sm" onclick="app.saveCustomerEdit(${customerId})">
                                            <i class="fas fa-save"></i> Speichern
                                        </button>
                                        <button type="button" class="btn btn-secondary btn-sm" onclick="app.cancelCustomerEdit(${customerId})">
                                            <i class="fas fa-times"></i> Abbrechen
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>Statistiken</h6>
                        </div>
                        <div class="card-body" id="customerStatsContent">
                            <p class="mb-2"><strong>Gesamte Sessions:</strong> ${safeSessionBlocks.reduce((sum, block) => sum + (block.total_sessions || 0), 0)}</p>
                            <p class="mb-2"><strong>Durchgeführte Behandlungen:</strong> ${safeSessionBlocks.reduce((sum, block) => sum + ((block.total_sessions || 0) - (block.remaining_sessions || 0)), 0)}</p>
                            <p class="mb-2"><strong>Verbleibende Sessions:</strong> ${safeSessionBlocks.reduce((sum, block) => sum + (block.remaining_sessions || 0), 0)}</p>
                            <p class="mb-0"><strong>Aktive Blöcke:</strong> ${safeSessionBlocks.filter(block => block.is_active && block.remaining_sessions > 0).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Treatment Management -->
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0"><i class="fas fa-dumbbell me-2"></i>Behandlungen</h6>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-success" onclick="app.addSessionBlock(${customerId}, 10)" title="10er Block hinzufügen">+10</button>
                        <button class="btn btn-sm btn-success" onclick="app.addSessionBlock(${customerId}, 20)" title="20er Block hinzufügen">+20</button>
                        <button class="btn btn-sm btn-success" onclick="app.addSessionBlock(${customerId}, 30)" title="30er Block hinzufügen">+30</button>
                        <button class="btn btn-sm btn-success" onclick="app.addSessionBlock(${customerId}, 40)" title="40er Block hinzufügen">+40</button>
                    </div>
                </div>
                <div class="card-body" id="sessionBlocksContainer">
                    ${this.renderTreatmentBlocks(safeSessionBlocks, customerId)}
                </div>
            </div>

            <!-- Appointment History -->
            <div class="card mt-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="fas fa-calendar-alt me-2"></i>Terminhistorie</h6>
                </div>
                <div class="card-body" id="appointmentHistoryContainer">
                    <div class="text-center">
                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                            <span class="visually-hidden">Lade Termine...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateCustomerModalContent(customer, safeSessionBlocks, customerId) {
        const firstName = customer.contact_first_name || customer.first_name || customer.firstName || '';
        const lastName = customer.contact_last_name || customer.last_name || customer.lastName || '';
        
        // Update modal title
        const modalName = document.getElementById('customerModalName');
        if (modalName) {
            modalName.textContent = `${firstName} ${lastName}`;
        }
        
        // Update modal body content
        const modalBody = document.getElementById('customerModalBody');
        if (modalBody) {
            modalBody.innerHTML = this.createCustomerModalBodyContent(customer, safeSessionBlocks, customerId);
        }
    }

    renderTreatmentBlocks(sessionBlocks, customerId) {
        if (sessionBlocks.length === 0) {
            return `
                <div class="text-muted text-center py-4">
                    <i class="fas fa-dumbbell fa-2x mb-2"></i>
                    <p>Keine Behandlungsblöcke vorhanden</p>
                    <p><small>Fügen Sie einen Block hinzu, um mit den Behandlungen zu beginnen</small></p>
                </div>
            `;
        }

        // Calculate totals for better overview
        const totalSessions = sessionBlocks.reduce((sum, block) => sum + (block.total_sessions || 0), 0);
        const usedSessions = sessionBlocks.reduce((sum, block) => sum + ((block.total_sessions || 0) - (block.remaining_sessions || 0)), 0);
        const remainingSessions = sessionBlocks.reduce((sum, block) => sum + (block.remaining_sessions || 0), 0);

        return `
            <!-- Treatment Overview -->
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="text-center p-3 bg-light rounded">
                        <div class="h4 mb-1 text-primary">${totalSessions}</div>
                        <small class="text-muted">Gesamt gekauft</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center p-3 bg-light rounded">
                        <div class="h4 mb-1 text-success">${usedSessions}</div>
                        <small class="text-muted">Durchgeführt</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center p-3 bg-light rounded">
                        <div class="h4 mb-1 text-warning">${remainingSessions}</div>
                        <small class="text-muted">Verbleibend</small>
                    </div>
                </div>
            </div>

            <!-- Treatment Blocks -->
            ${sessionBlocks.map((block, index) => {
                const isCurrentBlock = index === 0 && block.remaining_sessions > 0;
                const isStarted = block.total_sessions > block.remaining_sessions;
                const progressPercent = ((block.total_sessions - block.remaining_sessions) / block.total_sessions) * 100;
                const blockType = block.total_sessions >= 40 ? 'XL' : block.total_sessions >= 30 ? 'L' : block.total_sessions >= 20 ? 'M' : 'S';
                
                return `
                    <div class="card mb-3 session-block ${isCurrentBlock ? 'border-primary border-2' : ''}">
                        <div class="card-header d-flex justify-content-between align-items-center ${isCurrentBlock ? 'bg-primary bg-opacity-10' : ''}">
                            <div>
                                <h6 class="mb-0">
                                    <i class="fas fa-cube me-2"></i>
                                    ${block.total_sessions}er Block (${blockType})
                                    ${isCurrentBlock ? '<span class="badge bg-primary ms-2"><i class="fas fa-play-circle me-1"></i>Aktiv</span>' : ''}
                                    ${!block.is_active ? '<span class="badge bg-secondary ms-2">Inaktiv</span>' : ''}
                                </h6>
                                <small class="text-muted">
                                    <i class="fas fa-calendar me-1"></i>
                                    Gekauft: ${this.formatDate(block.purchase_date)}
                                </small>
                            </div>
                            <button class="btn btn-sm btn-outline-danger" onclick="app.deleteSessionBlock(${customerId}, ${block.id})" title="Block löschen">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="d-flex justify-content-between mb-2">
                                        <span><i class="fas fa-chart-pie me-1"></i>Behandlungsfortschritt:</span>
                                        <span class="fw-bold">${block.total_sessions - block.remaining_sessions} / ${block.total_sessions}</span>
                                    </div>
                                    <div class="progress mb-3" style="height: 8px;">
                                        <div class="progress-bar ${isCurrentBlock ? 'bg-primary' : 'bg-secondary'}" 
                                             style="width: ${progressPercent}%"></div>
                                    </div>
                                    <div class="row text-center">
                                        <div class="col-6">
                                            <small class="text-muted d-block">Durchgeführt</small>
                                            <span class="badge bg-success">${block.total_sessions - block.remaining_sessions}</span>
                                        </div>
                                        <div class="col-6">
                                            <small class="text-muted d-block">Offen</small>
                                            <span class="badge bg-warning">${block.remaining_sessions}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-center">
                                        <div class="h3 mb-1 ${remainingSessions > 0 ? 'text-primary' : 'text-muted'}">${block.remaining_sessions}</div>
                                        <small class="text-muted">Behandlungen verfügbar</small>
                                        ${block.remaining_sessions === 0 ? '<div class="mt-2"><span class="badge bg-success">Abgeschlossen</span></div>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }

    async loadCustomerSessionBlocks(customerId) {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Customer has no session blocks yet
                    return [];
                }
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`Failed to load session blocks: ${response.status}`);
            }

            const data = await response.json();
            return Array.isArray(data.sessions) ? data.sessions : [];
        } catch (error) {
            console.error('Error loading session blocks:', error);
            // Return empty array as fallback
            return [];
        }
    }

    async addSessionBlock(customerId, sessionCount) {
        try {
            const studioId = await this.getCurrentStudioId();
            if (!studioId) {
                alert('Studio-ID konnte nicht ermittelt werden');
                return;
            }

            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    total_sessions: sessionCount,
                    payment_method: 'cash',
                    notes: `${sessionCount}er Behandlungsblock hinzugefügt`
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Hinzufügen des Session-Blocks');
            }

            // Refresh customer details with animation
            await this.showCustomerDetails(customerId);
            
            // Add animation to new session blocks
            setTimeout(() => {
                const sessionBlocks = document.querySelectorAll('.session-block');
                if (sessionBlocks.length > 0) {
                    const newestBlock = sessionBlocks[sessionBlocks.length - 1];
                    newestBlock.classList.add('session-block-enter');
                    
                    // Remove animation class after animation completes
                    setTimeout(() => {
                        newestBlock.classList.remove('session-block-enter');
                    }, 400);
                }
            }, 100);
        } catch (error) {
            console.error('Error adding session block:', error);
            alert(`Fehler beim Hinzufügen des Session-Blocks: ${error.message}`);
        }
    }


    async deleteSessionBlock(customerId, blockId) {
        if (!confirm('Sind Sie sicher, dass Sie diesen Session-Block löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
            return;
        }

        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/session-blocks/${blockId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Delete session block error:', errorData);
                throw new Error(errorData.message || 'Fehler beim Löschen des Session-Blocks');
            }

            const result = await response.json();
            console.log('Session block deleted successfully:', result);

            // Refresh details using stored customer ID
            if (this.currentCustomerId) {
                await this.showCustomerDetails(this.currentCustomerId);
            }
        } catch (error) {
            console.error('Error deleting session block:', error);
            console.error('Block ID:', blockId);
            alert(`Fehler beim Löschen des Session-Blocks: ${error.message}`);
        }
    }

    async getCurrentStudioId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('getCurrentStudioId: user role is', user.role);
        let studioId = user.studio_id;
        
        if (!studioId) {
            let endpoint;
            
            // Use different endpoints based on user role
            if (user.role === 'manager') {
                endpoint = `${window.API_BASE_URL}/api/v1/manager/studios`;
            } else if (user.role === 'studio_owner') {
                endpoint = `${window.API_BASE_URL}/api/v1/studios/my-studio`;
            } else {
                return null;
            }
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (user.role === 'manager') {
                    const studios = data.studios || [];
                    if (studios.length > 0) {
                        studioId = studios[0].id;
                        this.currentStudioId = studioId; // Also set the class property
                        console.log('Set currentStudioId for manager:', this.currentStudioId);
                    }
                } else if (user.role === 'studio_owner') {
                    studioId = data.studio.id;
                    this.currentStudioId = studioId; // Also set the class property
                    console.log('Set currentStudioId for studio owner:', this.currentStudioId);
                }
            }
        }
        
        return studioId;
    }

    async getCustomerIdFromSessionBlock(blockId) {
        // This is a helper method to find the customer ID from a session block
        // In practice, we could store this in the modal or make an API call
        const modal = document.getElementById('customerDetailsModal');
        if (modal) {
            // Extract customer ID from the add session block buttons
            const addButtons = modal.querySelectorAll('[onclick*="addSessionBlock"]');
            if (addButtons.length > 0) {
                const onclick = addButtons[0].getAttribute('onclick');
                const match = onclick.match(/addSessionBlock\((\d+),/);
                if (match) {
                    return parseInt(match[1]);
                }
            }
        }
        return null;
    }

    toggleCustomerEdit(customerId) {
        const viewMode = document.getElementById(`customerViewMode-${customerId}`);
        const editMode = document.getElementById(`customerEditMode-${customerId}`);
        
        if (viewMode && editMode) {
            if (viewMode.style.display === 'none') {
                // Currently in edit mode, switch to view mode
                viewMode.style.display = 'block';
                editMode.style.display = 'none';
            } else {
                // Currently in view mode, switch to edit mode
                viewMode.style.display = 'none';
                editMode.style.display = 'block';
            }
        }
    }

    cancelCustomerEdit(customerId) {
        const viewMode = document.getElementById(`customerViewMode-${customerId}`);
        const editMode = document.getElementById(`customerEditMode-${customerId}`);
        
        if (viewMode && editMode) {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
        }
    }

    async saveCustomerEdit(customerId) {
        const firstName = document.getElementById(`editFirstName-${customerId}`).value.trim();
        const lastName = document.getElementById(`editLastName-${customerId}`).value.trim();
        const email = document.getElementById(`editEmail-${customerId}`).value.trim();
        const phone = document.getElementById(`editPhone-${customerId}`).value.trim();

        // Validation
        if (!firstName || !lastName || !email) {
            alert('Bitte füllen Sie alle Pflichtfelder aus (Vorname, Nachname, Email)');
            return;
        }

        if (!this.isValidEmail(email)) {
            alert('Bitte geben Sie eine gültige E-Mail-Adresse ein');
            return;
        }

        try {
            const studioId = await this.getCurrentStudioId();
            if (!studioId) {
                throw new Error('Studio-ID konnte nicht ermittelt werden');
            }

            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers/${customerId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    phone: phone
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Aktualisieren der Kundendaten');
            }

            // Update customer in local array
            const customerIndex = this.allCustomers.findIndex(c => c.id === customerId);
            if (customerIndex !== -1) {
                this.allCustomers[customerIndex] = {
                    ...this.allCustomers[customerIndex],
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    phone: phone
                };
            }

            // Refresh customer details modal
            await this.showCustomerDetails(customerId);
            
            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'alert alert-success alert-dismissible fade show';
            successDiv.innerHTML = `
                <i class="fas fa-check-circle me-2"></i>
                Kundendaten erfolgreich aktualisiert!
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            const modalBody = document.querySelector('#customerDetailsModal .modal-body');
            if (modalBody) {
                modalBody.insertBefore(successDiv, modalBody.firstChild);
                setTimeout(() => successDiv.remove(), 3000);
            }

        } catch (error) {
            console.error('Error updating customer:', error);
            alert(`Fehler beim Aktualisieren der Kundendaten: ${error.message}`);
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showAddCustomerModal() {
        // Use CustomerManagement component if available
        if (window.customerManagement && window.customerManagement.showAddCustomerModal) {
            window.customerManagement.showAddCustomerModal();
        } else {
            alert('Neuen Kunden hinzufügen\n\nDiese Funktion wird in der nächsten Phase implementiert.');
        }
    }

    async loadCustomersList(studioId) {
        const customersDiv = document.getElementById('customersList');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load customers');
            }
            
            const data = await response.json();
            const customers = data.customers || [];
            
            if (customers.length === 0) {
                customersDiv.innerHTML = `
                    <div class="text-muted">
                        <small>Keine Kunden vorhanden</small>
                    </div>
                `;
            } else {
                customersDiv.innerHTML = `
                    <div class="list-group">
                        ${customers.map(customer => `
                            <a href="#" class="list-group-item list-group-item-action customer-item" data-customer-id="${customer.id}">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${customer.contact_first_name || customer.first_name} ${customer.contact_last_name || customer.last_name}</h6>
                                    <small>${new Date(customer.created_at).toLocaleDateString('de-DE')}</small>
                                </div>
                                <p class="mb-1">${customer.email}</p>
                                <small>${customer.phone || 'Kein Telefon'}</small>
                            </a>
                        `).join('')}
                    </div>
                `;
                
                // Add click event listeners to customer items
                document.querySelectorAll('.customer-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        const customerId = item.dataset.customerId;
                        const customerName = item.querySelector('h6').textContent;
                        
                        // Show tabs and load both appointments and sessions
                        this.selectCustomer(customerId, customerName);
                        
                        // Remove active class from all items and add to clicked item
                        document.querySelectorAll('.customer-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    });
                });
            }
            
        } catch (error) {
            customersDiv.innerHTML = `
                <div class="alert alert-danger alert-sm">
                    <small>Fehler beim Laden der Kunden: ${error.message}</small>
                </div>
            `;
        }
    }

    async loadStudioCustomerAppointments(customerId, customerName) {
        const appointmentsDiv = document.getElementById('customerAppointments');
        
        if (!appointmentsDiv) {
            console.error('customerAppointments element not found - this function should only be called in studio view');
            return;
        }
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/appointments/customer/${customerId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load customer appointments');
            }
            
            const data = await response.json();
            const appointments = data.appointments || [];
            
            // Separate past and upcoming appointments
            const today = new Date();
            const pastAppointments = appointments.filter(apt => new Date(apt.appointment_date) < today);
            const upcomingAppointments = appointments.filter(apt => new Date(apt.appointment_date) >= today);
            
            appointmentsDiv.innerHTML = `
                <div class="mb-3">
                    <h6>Termine für ${customerName}</h6>
                    <div class="btn-group btn-group-sm mb-3" role="group">
                        <button type="button" class="btn btn-outline-primary" id="showUpcomingBtn">
                            Kommende (${upcomingAppointments.length})
                        </button>
                        <button type="button" class="btn btn-outline-secondary" id="showPastBtn">
                            Vergangene (${pastAppointments.length})
                        </button>
                    </div>
                </div>
                
                <div id="upcomingAppointments" class="appointment-section">
                    ${upcomingAppointments.length === 0 ? 
                        '<div class="text-muted"><small>Keine kommenden Termine</small></div>' :
                        `<div class="list-group">
                            ${upcomingAppointments.map(appointment => `
                                <div class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${new Date(appointment.appointment_date).toLocaleDateString('de-DE')}</h6>
                                        <span class="badge ${this.getStatusBadgeClass(appointment.status)}">
                                            ${this.getStatusText(appointment.status)}
                                        </span>
                                    </div>
                                    <p class="mb-1">${appointment.start_time} - ${appointment.end_time}</p>
                                    <small>Behandlung</small>
                                    ${appointment.notes ? `<div class="mt-2"><small class="text-muted">Notizen: ${appointment.notes}</small></div>` : ''}
                                </div>
                            `).join('')}
                        </div>`
                    }
                </div>
                
                <div id="pastAppointments" class="appointment-section" style="display: none;">
                    ${pastAppointments.length === 0 ? 
                        '<div class="text-muted"><small>Keine vergangenen Termine</small></div>' :
                        `<div class="list-group">
                            ${pastAppointments.map(appointment => `
                                <div class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${new Date(appointment.appointment_date).toLocaleDateString('de-DE')}</h6>
                                        <span class="badge ${this.getStatusBadgeClass(appointment.status)}">
                                            ${this.getStatusText(appointment.status)}
                                        </span>
                                    </div>
                                    <p class="mb-1">${appointment.start_time} - ${appointment.end_time}</p>
                                    <small>Behandlung</small>
                                    ${appointment.notes ? `<div class="mt-2"><small class="text-muted">Notizen: ${appointment.notes}</small></div>` : ''}
                                </div>
                            `).join('')}
                        </div>`
                    }
                </div>
            `;
            
            // Add event listeners for the buttons
            document.getElementById('showUpcomingBtn').addEventListener('click', () => {
                document.getElementById('upcomingAppointments').style.display = 'block';
                document.getElementById('pastAppointments').style.display = 'none';
                document.getElementById('showUpcomingBtn').classList.replace('btn-outline-primary', 'btn-primary');
                document.getElementById('showPastBtn').classList.replace('btn-secondary', 'btn-outline-secondary');
            });
            
            document.getElementById('showPastBtn').addEventListener('click', () => {
                document.getElementById('upcomingAppointments').style.display = 'none';
                document.getElementById('pastAppointments').style.display = 'block';
                document.getElementById('showPastBtn').classList.replace('btn-outline-secondary', 'btn-secondary');
                document.getElementById('showUpcomingBtn').classList.replace('btn-primary', 'btn-outline-primary');
            });
            
        } catch (error) {
            appointmentsDiv.innerHTML = `
                <div class="alert alert-danger alert-sm">
                    <small>Fehler beim Laden der Termine: ${error.message}</small>
                </div>
            `;
        }
    }

    /**
     * Select customer and show integrated tabs for appointments and sessions
     */
    selectCustomer(customerId, customerName) {
        // Hide initial prompt and show tabs
        document.getElementById('customerSelectPrompt').style.display = 'none';
        document.getElementById('customerDetailTabs').classList.remove('d-none');
        
        // Update header
        document.getElementById('customerDetailHeader').textContent = `${customerName} - Details`;
        
        // Store current customer
        this.currentCustomerId = customerId;
        this.currentCustomerName = customerName;
        
        // Load data for both tabs
        this.loadStudioCustomerAppointments(customerId, customerName);
        this.loadCustomerSessionBlocks(customerId, customerName);
    }

    /**
     * Load customer's session blocks in new format
     */
    async loadCustomerSessionBlocks(customerId, customerName) {
        try {
            console.log('Loading session blocks for customer:', customerId);
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/session-blocks`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                console.error('Failed to load customer session blocks:', response.status, response.statusText);
                return [];
            }
            
            const data = await response.json();
            const blocks = data.blocks || [];
            
            // Return the blocks data for use in the modal
            return blocks;
            
        } catch (error) {
            console.error('Error loading customer session blocks:', error);
            return [];
        }
    }

    /**
     * Add new session block to customer
     */


    /**
     * Deactivate session block
     */
    async deactivateSessionBlock(sessionId) {
        if (!confirm('Möchten Sie diesen Behandlungsblock wirklich deaktivieren?')) {
            return;
        }
        
        try {
            const reason = prompt('Grund für Deaktivierung:', 'Vom Studio-Besitzer deaktiviert');
            if (!reason) return;
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/sessions/${sessionId}/deactivate`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: reason,
                    notes: 'Block deaktiviert'
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Fehler beim Deaktivieren');
            }
            
            this.showSuccessMessage('Erfolg', 'Behandlungsblock wurde deaktiviert');
            
            // Reload session blocks
            this.loadCustomerSessionBlocks(this.currentCustomerId, this.currentCustomerName);
            
        } catch (error) {
            console.error('Error deactivating session block:', error);
            this.showErrorMessage('Fehler beim Deaktivieren', error.message);
        }
    }

    showSessionManagement(studioId) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>Behandlungen verwalten</h4>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6>Kunden mit Behandlungen</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="sessionCustomersList">
                                                <div class="text-center">
                                                    <div class="spinner-border spinner-border-sm" role="status">
                                                        <span class="visually-hidden">Loading...</span>
                                                    </div>
                                                    <p class="mt-2 small">Lade Kunden...</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6>Behandlungsdetails</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="sessionDetails">
                                                <div class="text-muted text-center">
                                                    <p>Wählen Sie einen Kunden aus der Liste</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event listener

        // Store studio ID for use in other functions
        this.currentStudioId = studioId;
        
        // Load customers with sessions
        this.loadSessionCustomersList(studioId);
    }

    async loadSessionCustomersList(studioId) {
        const customersDiv = document.getElementById('sessionCustomersList');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/customers/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load customers with sessions');
            }
            
            const data = await response.json();
            const customers = data.customers || [];
            
            if (customers.length === 0) {
                customersDiv.innerHTML = `
                    <div class="text-center text-muted">
                        <p>Noch keine Kunden mit Behandlungspaketen</p>
                    </div>
                `;
                return;
            }
            
            customersDiv.innerHTML = customers.map(customer => {
                const totalSessions = customer.total_sessions || 0;
                const remainingSessions = customer.remaining_sessions || 0;
                const usedSessions = totalSessions - remainingSessions;
                
                let statusClass = 'bg-success';
                if (remainingSessions <= 0) statusClass = 'bg-danger';
                else if (remainingSessions < 3) statusClass = 'bg-warning text-dark';
                
                return `
                    <div class="list-group-item list-group-item-action" style="cursor: pointer;" 
                         onclick="window.app.loadCustomerSessionDetails(${customer.customer_id})">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-1">${customer.contact_first_name || customer.first_name} ${customer.contact_last_name || customer.last_name}</h6>
                            <span class="badge ${statusClass}">${remainingSessions} / ${totalSessions}</span>
                        </div>
                        <p class="mb-1">${customer.email}</p>
                        <small class="text-muted">
                            ${usedSessions} verbraucht • ${remainingSessions} verbleibend
                        </small>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            customersDiv.innerHTML = `
                <div class="alert alert-danger alert-sm">
                    <small>Fehler beim Laden: ${error.message}</small>
                </div>
            `;
        }
    }

    async loadCustomerSessionDetails(customerId) {
        const detailsDiv = document.getElementById('sessionDetails');
        
        // Store current customer ID for use in other functions
        this.currentCustomerId = customerId;
        
        try {
            detailsDiv.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                    <p class="mt-2 small">Lade Behandlungsdetails...</p>
                </div>
            `;
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load customer session details');
            }
            
            const data = await response.json();
            const customer = data.customer || data; // Handle different response structures
            const sessions = data.sessions || [];
            
            // Validate customer data
            if (!customer || (!customer.contact_first_name && !customer.first_name)) {
                console.error('Invalid customer data:', data);
                throw new Error('Kundendaten konnten nicht geladen werden');
            }
            
            detailsDiv.innerHTML = `
                <div class="mb-4">
                    <h5>${customer.contact_first_name || customer.first_name} ${customer.contact_last_name || customer.last_name}</h5>
                    <p class="text-muted">${customer.email}</p>
                </div>
                
                <div class="mb-4">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <button class="btn btn-primary btn-sm w-100" onclick="window.app.showSessionTopupModal(${customerId}, 10)">
                                <i class="fas fa-plus"></i> +10 Behandlungen
                            </button>
                        </div>
                        <div class="col-md-6 mb-3">
                            <button class="btn btn-primary btn-sm w-100" onclick="window.app.showSessionTopupModal(${customerId}, 20)">
                                <i class="fas fa-plus"></i> +20 Behandlungen
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <h6>Aktive Behandlungspakete</h6>
                    ${sessions.filter(s => s.is_active).map(session => {
                        const usedSessions = session.total_sessions - session.remaining_sessions;
                        const progressPercent = (usedSessions / session.total_sessions) * 100;
                        
                        return `
                            <div class="card mb-2">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <span><strong>${session.total_sessions}er Paket</strong></span>
                                        <div>
                                            <span class="badge bg-primary me-2">${session.remaining_sessions} verbleibend</span>
                                            <button class="btn btn-outline-danger btn-sm" 
                                                    onclick="window.app.showDeactivateSessionModal(${session.id}, ${session.total_sessions})">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="progress mb-2" style="height: 8px;">
                                        <div class="progress-bar" role="progressbar" 
                                             style="width: ${progressPercent}%" 
                                             aria-valuenow="${progressPercent}" 
                                             aria-valuemin="0" aria-valuemax="100">
                                        </div>
                                    </div>
                                    <small class="text-muted">
                                        Erworben: ${new Date(session.purchase_date).toLocaleDateString('de-DE')}
                                        ${session.notes ? ` | ${session.notes}` : ''}
                                    </small>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
        } catch (error) {
            detailsDiv.innerHTML = `
                <div class="alert alert-danger">
                    <small>Fehler beim Laden der Details: ${error.message}</small>
                </div>
            `;
        }
    }

    showSessionTopupModal(customerId, amount) {
        const modalHTML = `
            <div class="modal fade" id="sessionTopupModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Behandlungen hinzufügen</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Möchten Sie <strong>${amount} Behandlungen</strong> zum Konto dieses Kunden hinzufügen?</p>
                            <div class="mb-3">
                                <label for="topupNotes" class="form-label">Notizen (optional)</label>
                                <textarea class="form-control" id="topupNotes" rows="3" 
                                          placeholder="z.B. Paket erworben, Nachzahlung..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" id="confirmTopupBtn">
                                <i class="fas fa-plus"></i> ${amount} Behandlungen hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('sessionTopupModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event listener
        document.getElementById('confirmTopupBtn').addEventListener('click', () => {
            this.performSessionTopup(customerId, amount);
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('sessionTopupModal'));
        modal.show();
    }

    async performSessionTopup(customerId, amount) {
        const confirmBtn = document.getElementById('confirmTopupBtn');
        const notes = document.getElementById('topupNotes').value;
        
        try {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Wird hinzugefügt...';
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/customers/${customerId}/sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    total_sessions: amount,
                    payment_method: 'cash',
                    notes: notes
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to add sessions');
            }
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('sessionTopupModal'));
            modal.hide();
            
            // Refresh the view
            this.loadCustomerSessionDetails(customerId);
            this.loadSessionCustomersList(this.currentStudioId);
            
            // Show success message
            this.showSuccessMessage('Erfolgreich', `${amount} Behandlungen wurden erfolgreich hinzugefügt.`);
            
        } catch (error) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i class="fas fa-plus"></i> ${amount} Behandlungen hinzufügen`;
            this.showErrorMessage('Fehler', 'Fehler beim Hinzufügen der Behandlungen: ' + error.message);
        }
    }


    // Session edit function removed - editing session blocks is not allowed

    showDeactivateSessionModal(sessionId, totalSessions) {
        const modalHTML = `
            <div class="modal fade" id="deactivateSessionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Behandlungspaket deaktivieren</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>Achtung:</strong> Möchten Sie dieses ${totalSessions}er Behandlungspaket wirklich deaktivieren?
                            </div>
                            <p>Das Paket wird deaktiviert und steht nicht mehr für neue Termine zur Verfügung.</p>
                            <div class="mb-3">
                                <label for="deactivateReason" class="form-label">Grund (optional)</label>
                                <textarea class="form-control" id="deactivateReason" rows="3" 
                                          placeholder="z.B. Kunde hat Studio gewechselt, Rückerstattung..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-danger" id="confirmDeactivateBtn">
                                <i class="fas fa-times"></i> Paket deaktivieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('deactivateSessionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event listener
        document.getElementById('confirmDeactivateBtn').addEventListener('click', () => {
            this.performSessionDeactivation(sessionId);
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('deactivateSessionModal'));
        modal.show();
    }

    async performSessionDeactivation(sessionId) {
        const confirmBtn = document.getElementById('confirmDeactivateBtn');
        const reason = document.getElementById('deactivateReason').value;
        
        try {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Wird deaktiviert...';
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/sessions/${sessionId}/deactivate`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: reason
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to deactivate session');
            }
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deactivateSessionModal'));
            modal.hide();
            
            // Refresh the view
            const currentCustomerId = this.currentCustomerId;
            if (currentCustomerId) {
                this.loadCustomerSessionDetails(currentCustomerId);
                this.loadSessionCustomersList(this.currentStudioId);
            }
            
            // Show success message
            this.showSuccessMessage('Erfolgreich', 'Behandlungspaket wurde deaktiviert.');
            
        } catch (error) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-times"></i> Paket deaktivieren';
            this.showErrorMessage('Fehler', 'Fehler beim Deaktivieren: ' + error.message);
        }
    }

    renderCalendar() {
        // Ensure currentDate is initialized
        if (!this.currentDate) {
            this.currentDate = new Date();
        }
        
        const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                           'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        
        const monthYearDisplay = document.getElementById('monthYearDisplay');
        const calendarGrid = document.getElementById('calendarGrid');
        
        if (!monthYearDisplay || !calendarGrid) return;
        
        // Update month/year display
        monthYearDisplay.innerHTML = `<strong>${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}</strong>`;
        
        // Remove old legend if it exists
        let oldLegend = document.getElementById('calendar-legend');
        if (oldLegend) {
            oldLegend.remove();
        }
        
        // Calculate first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        // Start from Monday: if firstDay.getDay() is 0 (Sunday), we want to go back 6 days, otherwise go back (firstDay.getDay() - 1) days
        const dayOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        startDate.setDate(startDate.getDate() - dayOffset);
        
        // Generate calendar HTML
        let calendarHTML = `
            <table class="table table-sm">
                <thead>
                    <tr>
                        ${dayNames.map(day => `<th class="text-center">${day}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;
        
        const today = new Date();
        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();
        
        // Generate 6 weeks (42 days) to cover all possible month layouts
        for (let week = 0; week < 6; week++) {
            calendarHTML += '<tr>';
            
            for (let day = 0; day < 7; day++) {
                // Fix: Calculate dates properly without mutation and timezone issues
                const daysFromStart = (week * 7) + day;
                const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1 - dayOffset + daysFromStart);
                
                const isCurrentMonth = currentDate.getMonth() === currentMonth;
                const isToday = currentDate.toDateString() === today.toDateString();
                const isSelected = this.selectedDate && currentDate.toDateString() === this.selectedDate.toDateString();
                
                let cellClass = 'calendar-day text-center';
                if (!isCurrentMonth) cellClass += ' text-muted';
                if (isToday) cellClass += ' bg-primary text-white';
                if (isSelected) cellClass += ' bg-success text-white';
                
                // Fix: Create local date string without timezone conversion
                const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                
                calendarHTML += `
                    <td class="${cellClass}" 
                        style="cursor: pointer; padding: 8px; border: 1px solid #dee2e6;"
                        data-date="${dateString}"
                        onclick="if(window.app && window.app.isInitialized && window.app.selectDate) window.app.selectDate('${dateString}')">
                        <div class="d-flex flex-column align-items-center">
                            <span>${currentDate.getDate()}</span>
                            <div id="day-${dateString}" class="appointment-indicator mt-1">
                                <!-- Appointment indicators will be loaded here -->
                            </div>
                        </div>
                    </td>
                `;
            }
            
            calendarHTML += '</tr>';
        }
        
        calendarHTML += '</tbody></table>';
        calendarGrid.innerHTML = calendarHTML;
        
        // Load appointment indicators for the month
        this.loadMonthlyAppointmentIndicators();
    }

    selectDate(dateString) {
        try {
            // Fix: Parse date string properly to avoid timezone issues
            const [year, month, day] = dateString.split('-').map(Number);
            this.selectedDate = new Date(year, month - 1, day);
            this.renderCalendar();
            this.loadAppointments(this.currentStudioId);
        } catch (error) {
            console.error('Error in selectDate:', error);
        }
    }

    // Helper function to format date to YYYY-MM-DD without timezone issues
    formatDateForInput(date) {
        if (!date) return '';
        
        // Ensure we have a Date object
        if (typeof date === 'string') {
            const [year, month, day] = date.split('-').map(Number);
            date = new Date(year, month - 1, day);
        }
        
        // Format using local date components to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    async loadMonthlyAppointmentIndicators() {
        
        if (!this.currentStudioId || !this.currentDate) {
            return;
        }
        
        try {
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
            
            // Fix: Use local date formatting for consistency
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            const apiUrl = `${window.API_BASE_URL}/api/v1/appointments/studio/${this.currentStudioId}?from_date=${startDateStr}&to_date=${endDateStr}`;
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            
            if (!response.ok) {
                return;
            }
            
            const data = await response.json();
            const appointments = data.appointments || [];
            
            // Debug: Check for lead appointments  
            const leadAppointments = appointments.filter(apt => apt.person_type === 'lead');
            if (leadAppointments.length > 0) {
            }
            
            // Group appointments by date and type
            const appointmentsByDate = {};
            
            appointments.forEach(appointment => {
                // Normalize date format - handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ" formats
                let originalDate = appointment.appointment_date;
                let date = appointment.appointment_date;
                if (date && date.includes('T')) {
                    date = date.split('T')[0]; // Extract just the date part
                }
                
                
                if (!appointmentsByDate[date]) {
                    appointmentsByDate[date] = {
                        leads: [],
                        customers: [],
                        total: []
                    };
                }
                appointmentsByDate[date].total.push(appointment);
                
                // Check if appointment is for a lead or customer
                if (appointment.person_type === 'lead' || appointment.lead_id) {
                    appointmentsByDate[date].leads.push(appointment);
                } else {
                    appointmentsByDate[date].customers.push(appointment);
                }
            });
            
            // Configuration for density visualization
            const maxAppointments = this.maxAppointmentsPerDay || 8; // Default to 8, configurable later
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            // Debug logging for calendar indicators
            
            // Apply density visualization to calendar day cells themselves
            const allDaysInMonth = this.getAllDaysInCurrentMonth();
            
            allDaysInMonth.forEach(date => {
                const dayCell = document.querySelector(`[data-date="${date}"]`);
                const dayElement = document.getElementById(`day-${date}`);
                
                
                if (dayCell) {
                    const dayData = appointmentsByDate[date] || { leads: [], customers: [], total: [] };
                    const leadCount = dayData.leads.length;
                    const customerCount = dayData.customers.length;
                    const totalCount = dayData.total.length;
                    
                    if (totalCount > 0) {
                        console.log(`  - Appointments:`, dayData.total);
                    }
                    
                    const density = Math.min(totalCount / maxAppointments, 1);
                    const isToday = date === todayStr;
                    
                    // Apply density and today styling with lead/customer distinction
                    this.applyDensityStylesToCell(dayCell, density, isToday, leadCount, customerCount);
                    
                    // Add visual indicators in the day element
                    if (dayElement && (leadCount > 0 || customerCount > 0)) {
                        const indicators = this.createAppointmentIndicators(leadCount, customerCount);
                        dayElement.innerHTML = indicators;
                    } else if (dayElement) {
                        dayElement.innerHTML = '';
                    }
                } else {
                }
            });
            
        } catch (error) {
            console.error('Error loading monthly appointments:', error);
        }
    }

    applyDensityStylesToCell(dayCell, density, isToday = false, leadCount = 0, customerCount = 0) {
        // Use different colors for leads vs customers
        const leadColor = '#f59e0b'; // Amber for leads (trial appointments)
        const customerColor = '#10b981'; // Green for customers (paid sessions)
        const mixedColor = '#B8A8D8'; // Pastel grau-lila for mixed days
        
        let baseColor;
        if (leadCount > 0 && customerCount > 0) {
            baseColor = mixedColor; // Mixed: both leads and customers
        } else if (leadCount > 0) {
            baseColor = leadColor; // Only leads
        } else if (customerCount > 0) {
            baseColor = customerColor; // Only customers
        } else {
            baseColor = '#B8A8D8'; // Default
        }
        
        const fillHeight = Math.round(density * 100); // Percentage fill from bottom
        
        // Create gradient background with chosen color
        const backgroundGradient = `linear-gradient(to top, 
            ${baseColor}${density > 0 ? '40' : '10'} 0%, 
            ${baseColor}${density > 0 ? '40' : '10'} ${fillHeight}%, 
            transparent ${fillHeight}%, 
            transparent 100%)`;
        
        // Apply background gradient
        dayCell.style.background = backgroundGradient;
        
        // Add border for today
        if (isToday) {
            dayCell.style.border = `2px solid ${baseColor}`;
            dayCell.style.boxShadow = `0 0 8px ${baseColor}30`;
        } else {
            // Reset border if not today
            dayCell.style.border = '1px solid #dee2e6';
            dayCell.style.boxShadow = 'none';
        }
    }

    createAppointmentIndicators(leadCount, customerCount) {
        let indicators = '';
        
        // Create small dot indicators
        if (leadCount > 0) {
            indicators += `<span class="badge badge-sm" style="background-color: #f59e0b; font-size: 10px; margin-right: 2px;" title="Trial Termine">${leadCount}</span>`;
        }
        
        if (customerCount > 0) {
            indicators += `<span class="badge badge-sm" style="background-color: #10b981; font-size: 10px;" title="Kunden Termine">${customerCount}</span>`;
        }
        
        return indicators;
    }

    getAllDaysInCurrentMonth() {
        const days = [];
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            days.push(dateString);
        }
        
        return days;
    }

    // Sidebar Management
    initSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const mainContent = document.querySelector('.main-content');

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Make logo clickable to return to dashboard
        const logoImg = document.querySelector('.logo-img');
        if (logoImg) {
            logoImg.style.cursor = 'pointer';
            logoImg.addEventListener('click', () => {
                this.navigateToSection('dashboard');
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 992) {
                this.closeSidebar();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        sidebar.classList.toggle('show');
        sidebarOverlay.classList.toggle('show');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (sidebar) {
            sidebar.classList.remove('show');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('show');
        }
    }

    async loadUserStudios() {
        if (this.currentUser?.role !== 'studio_owner') return;
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/my-studios`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userStudios = data.studios || [];
                this.subscriptionInfo = data.subscription || null;
                
                // If no selected studio, select the first one
                if (this.userStudios.length > 0 && !this.currentStudioId) {
                    const savedStudioId = localStorage.getItem('selectedStudioId');
                    const studioExists = this.userStudios.find(s => s.id === parseInt(savedStudioId));
                    
                    if (studioExists) {
                        this.currentStudioId = parseInt(savedStudioId);
                    } else {
                        this.currentStudioId = this.userStudios[0].id;
                        localStorage.setItem('selectedStudioId', this.currentStudioId);
                    }
                }
                
                // Update studio selector if it exists
                this.updateStudioSelector();
            }
        } catch (error) {
            console.error('Error loading user studios:', error);
        }
    }
    
    updateStudioSelector() {
        const studioSelector = document.getElementById('studioSelector');
        if (!studioSelector || !this.userStudios) return;
        
        // Get current studio for machine count display
        const currentStudio = this.userStudios.find(s => s.id === this.currentStudioId);
        const machineCount = currentStudio?.machine_count || 1;
        
        // Create subscription status info
        const subscriptionStatus = this.subscriptionInfo ? `
            <div class="text-muted small mt-1">
                ${this.subscriptionInfo.current_studios}/${this.subscriptionInfo.max_studios_allowed} Studios
            </div>
        ` : '';
        
        // Create add studio button if allowed
        const canAddStudio = this.subscriptionInfo?.can_create_studio;
        const addStudioButton = canAddStudio ? `
            <button class="btn btn-outline-primary btn-sm w-100 mt-2" onclick="window.app.showCreateStudioForm()">
                <i class="fas fa-plus me-1"></i>
                Neues Studio hinzufügen
            </button>
        ` : '';
        
        // Create upgrade button if at limit
        const upgradeButton = this.subscriptionInfo && !canAddStudio && this.subscriptionInfo.subscription_active ? `
            <button class="btn btn-outline-warning btn-sm w-100 mt-2" onclick="window.app.showUpgradeOptions()">
                <i class="fas fa-crown me-1"></i>
                Plan erweitern
            </button>
        ` : '';
        
        // Always show as dropdown now (even for single studio) for consistency
        if (this.userStudios.length >= 1) {
            studioSelector.innerHTML = `
                <div class="studio-selector mb-3 px-3">
                    <label class="small text-muted mb-1">
                        <i class="fas fa-building me-1"></i>
                        Studio auswählen:
                    </label>
                    <div class="dropdown">
                        <button class="btn btn-outline-secondary btn-sm w-100 d-flex justify-content-between align-items-center" 
                                type="button" id="studioDropdownButton" data-bs-toggle="dropdown" aria-expanded="false">
                            <span class="fw-medium">${currentStudio?.name || 'Studio wählen'}</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <ul class="dropdown-menu w-100" aria-labelledby="studioDropdownButton">
                            ${this.userStudios.map(studio => `
                                <li>
                                    <a class="dropdown-item ${studio.id === this.currentStudioId ? 'active' : ''}" 
                                       href="#" onclick="window.app.switchStudio(${studio.id}); return false;">
                                        <i class="fas fa-building me-2"></i>
                                        ${studio.name}
                                        ${studio.id === this.currentStudioId ? '<i class="fas fa-check ms-auto"></i>' : ''}
                                    </a>
                                </li>
                            `).join('')}
                            ${canAddStudio ? `
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <a class="dropdown-item text-primary" href="#" onclick="window.app.showCreateStudioForm(); return false;">
                                        <i class="fas fa-plus me-2"></i>
                                        Neues Studio hinzufügen
                                    </a>
                                </li>
                            ` : ''}
                            ${upgradeButton && !canAddStudio ? `
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <a class="dropdown-item text-warning" href="#" onclick="window.app.showUpgradeOptions(); return false;">
                                        <i class="fas fa-crown me-2"></i>
                                        Plan erweitern
                                    </a>
                                </li>
                            ` : ''}
                        </ul>
                    </div>
                    ${subscriptionStatus}
                    <div class="d-flex align-items-center mt-2">
                        <i class="fas fa-cogs text-muted me-2"></i>
                        <small class="text-muted">
                            ${machineCount} ${machineCount === 1 ? 'Gerät' : 'Geräte'} verfügbar
                        </small>
                        <button class="btn btn-link btn-sm ms-auto p-0" onclick="window.app.editStudioMachineCount()">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    async switchStudio(studioId) {
        if (studioId === this.currentStudioId) return;
        
        this.currentStudioId = studioId;
        localStorage.setItem('selectedStudioId', studioId);
        
        // Update the studio selector to reflect the change
        this.updateStudioSelector();
        
        // Reload the current view with new studio context
        if (this.currentUser?.role === 'studio_owner') {
            this.showStudioDashboard();
        }
        
        // Close the dropdown after selection
        const dropdown = document.getElementById('studioDropdownButton');
        if (dropdown) {
            const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdown);
            if (bootstrapDropdown) {
                bootstrapDropdown.hide();
            }
        }
        
        // Show success message
        const selectedStudio = this.userStudios.find(s => s.id === studioId);
        if (selectedStudio) {
            this.showSuccessMessage('Studio gewechselt', `Aktives Studio: ${selectedStudio.name}`);
        }
    }

    async showCreateStudioForm() {
        // Check subscription limits first
        if (!this.subscriptionInfo?.can_create_studio) {
            if (!this.subscriptionInfo?.subscription_active) {
                this.showErrorMessage('Abonnement erforderlich', 'Sie benötigen ein aktives Abonnement, um weitere Studios zu erstellen.');
                return;
            } else {
                this.showUpgradeOptions();
                return;
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'createStudioModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-plus-circle me-2"></i>
                            Neues Studio erstellen
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info mb-4">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Studio ${this.subscriptionInfo.current_studios + 1}/${this.subscriptionInfo.max_studios_allowed}</strong> - 
                            Sie können noch ${this.subscriptionInfo.max_studios_allowed - this.subscriptionInfo.current_studios} Studio(s) erstellen.
                        </div>
                        
                        <form id="newStudioForm">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="newStudioName" class="form-label">Studio Name *</label>
                                        <input type="text" class="form-control" id="newStudioName" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="newStudioCity" class="form-label">Stadt *</label>
                                        <input type="text" class="form-control" id="newStudioCity" required>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="newStudioAddress" class="form-label">Adresse *</label>
                                <input type="text" class="form-control" id="newStudioAddress" required>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="newStudioPhone" class="form-label">Telefon</label>
                                        <input type="tel" class="form-control" id="newStudioPhone">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="newStudioEmail" class="form-label">Studio E-Mail</label>
                                        <input type="email" class="form-control" id="newStudioEmail">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="newStudioMachineCount" class="form-label">Anzahl Geräte</label>
                                <select class="form-select" id="newStudioMachineCount">
                                    <option value="1">1 Gerät</option>
                                    <option value="2">2 Geräte</option>
                                    <option value="3">3 Geräte</option>
                                    <option value="4">4 Geräte</option>
                                    <option value="5">5 Geräte</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                        <button type="button" class="btn btn-primary" onclick="window.app.handleCreateStudio()">
                            <i class="fas fa-plus me-1"></i>
                            Studio erstellen
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    async handleCreateStudio() {
        const form = document.getElementById('newStudioForm');
        const formData = new FormData(form);
        
        const studioData = {
            name: document.getElementById('newStudioName').value,
            city: document.getElementById('newStudioCity').value,
            address: document.getElementById('newStudioAddress').value,
            phone: document.getElementById('newStudioPhone').value,
            email: document.getElementById('newStudioEmail').value,
            machine_count: parseInt(document.getElementById('newStudioMachineCount').value)
        };

        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(studioData)
            });

            const result = await response.json();

            if (response.ok) {
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('createStudioModal'));
                modal.hide();

                // Show address update modal for profile sync
                await this.showStudioAddressUpdateModal(studioData, result.studio);
                
                // Reload studios and switch to new one
                await this.loadUserStudios();
                await this.switchStudio(result.studio.id);
                
                this.showSuccessMessage('Studio erstellt', `${result.studio.name} wurde erfolgreich erstellt!`);
            } else {
                if (response.status === 402) {
                    // Payment required - show upgrade options
                    this.showUpgradeOptions(result);
                } else {
                    this.showErrorMessage('Fehler', result.message || 'Fehler beim Erstellen des Studios');
                }
            }
        } catch (error) {
            console.error('Error creating studio:', error);
            this.showErrorMessage('Fehler', 'Netzwerkfehler beim Erstellen des Studios');
        }
    }

    showUpgradeOptions(subscriptionError = null) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'upgradeModal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning text-dark">
                        <h5 class="modal-title">
                            <i class="fas fa-crown me-2"></i>
                            Plan erweitern
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${subscriptionError ? `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                ${subscriptionError.message}
                            </div>
                        ` : ''}
                        
                        <p class="mb-3">Um weitere Studios zu erstellen, erweitern Sie Ihren Plan:</p>
                        
                        <div class="row g-3">
                            <div class="col-12">
                                <div class="card border-primary">
                                    <div class="card-body text-center">
                                        <h6 class="card-title">Dual Studio Plan</h6>
                                        <div class="h4 text-primary">€49<small class="text-muted">/Monat</small></div>
                                        <ul class="list-unstyled">
                                            <li><i class="fas fa-check text-success me-1"></i> Bis zu 2 Studios</li>
                                            <li><i class="fas fa-check text-success me-1"></i> Alle Premium-Features</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="card border-success">
                                    <div class="card-body text-center">
                                        <h6 class="card-title">Triple Studio Plan</h6>
                                        <div class="h4 text-success">€69<small class="text-muted">/Monat</small></div>
                                        <ul class="list-unstyled">
                                            <li><i class="fas fa-check text-success me-1"></i> Bis zu 3 Studios</li>
                                            <li><i class="fas fa-check text-success me-1"></i> Alle Premium-Features</li>
                                            <li><i class="fas fa-crown text-warning me-1"></i> Prioritäts-Support</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-info-circle me-2"></i>
                            Aktuell: ${this.subscriptionInfo?.current_studios || 0}/${this.subscriptionInfo?.max_studios_allowed || 1} Studios verwendet
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Später</button>
                        <button type="button" class="btn btn-primary" onclick="window.app.contactSupport()">
                            <i class="fas fa-envelope me-1"></i>
                            Upgrade anfragen
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    contactSupport() {
        // Close upgrade modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('upgradeModal'));
        if (modal) modal.hide();
        
        // Open email client or show contact info
        const email = 'support@abnehmen-im-liegen.com';
        const subject = 'Plan Upgrade Anfrage';
        const body = `Hallo,\n\nich möchte meinen Plan erweitern, um weitere Studios erstellen zu können.\n\nAktuelle Situation:\n- Studios: ${this.subscriptionInfo?.current_studios || 0}/${this.subscriptionInfo?.max_studios_allowed || 1}\n\nBitte kontaktieren Sie mich für weitere Informationen.\n\nVielen Dank!`;
        
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        this.showSuccessMessage('E-Mail geöffnet', 'Ihre E-Mail-Anwendung wurde geöffnet. Senden Sie die Nachricht ab, um Unterstützung zu erhalten.');
    }

    async showStudioAddressUpdateModal(studioData, createdStudio) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'studioAddressModal';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-map-marker-alt me-2"></i>
                                Studio-Adresse für Profil übernehmen
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Studio "${createdStudio.name}" wurde erstellt!</strong><br>
                                Möchten Sie die Studio-Adresse als Ihre Profil-Adresse übernehmen?
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-muted mb-3">Studio-Adresse:</h6>
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <div class="mb-2"><strong>Stadt:</strong> ${studioData.city}</div>
                                            <div class="mb-2"><strong>Adresse:</strong> ${studioData.address}</div>
                                            ${studioData.phone ? `<div><strong>Telefon:</strong> ${studioData.phone}</div>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-muted mb-3">Aktuelle Profil-Adresse:</h6>
                                    <div class="card">
                                        <div class="card-body">
                                            <div class="mb-2"><strong>Stadt:</strong> ${this.currentUser.city || 'Nicht gesetzt'}</div>
                                            <div class="mb-2"><strong>Straße:</strong> ${this.currentUser.street || 'Nicht gesetzt'}</div>
                                            <div><strong>Telefon:</strong> ${this.currentUser.phone || 'Nicht gesetzt'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <form id="addressUpdateForm" class="mt-4">
                                <h6 class="mb-3">Adress-Details für Profil-Update:</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="updateCountry" class="form-label">Land</label>
                                            <select class="form-control" id="updateCountry">
                                                <option value="Österreich" selected>Österreich</option>
                                                <option value="Deutschland">Deutschland</option>
                                                <option value="Schweiz">Schweiz</option>
                                                <option value="Italien">Italien</option>
                                                <option value="Slowenien">Slowenien</option>
                                                <option value="Tschechien">Tschechien</option>
                                                <option value="Ungarn">Ungarn</option>
                                                <option value="Slowakei">Slowakei</option>
                                                <option value="Kroatien">Kroatien</option>
                                                <option value="Andere">Andere</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="updatePostalCode" class="form-label">PLZ</label>
                                            <input type="text" class="form-control" id="updatePostalCode" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="updateCity" class="form-label">Stadt</label>
                                    <input type="text" class="form-control" id="updateCity" value="${studioData.city}" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-8">
                                        <div class="mb-3">
                                            <label for="updateStreet" class="form-label">Straße</label>
                                            <input type="text" class="form-control" id="updateStreet" value="${studioData.address.split(',')[0] || studioData.address}" required>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="updateHouseNumber" class="form-label">Haus NR/Stiege</label>
                                            <input type="text" class="form-control" id="updateHouseNumber" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="updateDoorApartment" class="form-label">Tür (optional)</label>
                                            <input type="text" class="form-control" id="updateDoorApartment">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="updatePhone" class="form-label">Telefon</label>
                                            <input type="tel" class="form-control" id="updatePhone" value="${studioData.phone || ''}">
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="window.app.skipAddressUpdate('${modal.id}')">
                                Überspringen
                            </button>
                            <button type="button" class="btn btn-primary" onclick="window.app.updateProfileFromStudio('${modal.id}')">
                                <i class="fas fa-sync me-1"></i>
                                Profil aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();

            // Store resolve function for later use
            modal.resolve = resolve;

            // Clean up modal when hidden
            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
                resolve();
            });
        });
    }

    skipAddressUpdate(modalId) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
        if (modal) modal.hide();
    }

    async updateProfileFromStudio(modalId) {
        const formData = {
            country: document.getElementById('updateCountry').value,
            postalCode: document.getElementById('updatePostalCode').value,
            city: document.getElementById('updateCity').value,
            street: document.getElementById('updateStreet').value,
            houseNumber: document.getElementById('updateHouseNumber').value,
            doorApartment: document.getElementById('updateDoorApartment').value,
            phone: document.getElementById('updatePhone').value
        };

        // Keep current user's name
        formData.firstName = this.currentUser.firstName;
        formData.lastName = this.currentUser.lastName;

        try {
            const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // Update current user data
                Object.assign(this.currentUser, formData);

                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
                if (modal) modal.hide();

                this.showSuccessMessage('Profil aktualisiert', 'Ihre Profil-Adresse wurde mit der Studio-Adresse synchronisiert!');
            } else {
                const error = await response.json();
                this.showErrorMessage('Fehler', error.message || 'Fehler beim Aktualisieren des Profils');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showErrorMessage('Fehler', 'Netzwerkfehler beim Aktualisieren des Profils');
        }
    }
    
    showSuccessMessage(title, message) {
        const alertHTML = `
            <div class="alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" 
                 style="z-index: 9999; min-width: 300px;" role="alert">
                <strong>${title}</strong> ${message ? `<br>${message}` : ''}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', alertHTML);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.querySelector('.alert-success');
            if (alert) alert.remove();
        }, 5000);
    }
    
    showErrorMessage(title, message) {
        const alertHTML = `
            <div class="alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" 
                 style="z-index: 9999; min-width: 300px;" role="alert">
                <strong>${title}</strong> ${message ? `<br>${message}` : ''}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', alertHTML);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.querySelector('.alert-danger');
            if (alert) alert.remove();
        }, 5000);
    }

    async editStudioMachineCount() {
        const currentStudio = this.userStudios?.find(s => s.id === this.currentStudioId);
        if (!currentStudio) return;
        
        const currentCount = currentStudio.machine_count || 1;
        
        // Create modal for editing machine count
        const modalHTML = `
            <div class="modal fade" id="editMachineCountModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-cogs me-2"></i>Anzahl der Behandlungsgeräte
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted mb-3">
                                Geben Sie an, wie viele Behandlungsgeräte in Ihrem Studio verfügbar sind. 
                                Dies bestimmt, wie viele Termine gleichzeitig gebucht werden können.
                            </p>
                            <div class="form-group">
                                <label for="newMachineCount" class="form-label">Anzahl der Geräte:</label>
                                <input type="number" class="form-control" id="newMachineCount" 
                                       min="1" max="3" value="${currentCount}" required>
                                <small class="form-text text-muted">
                                    Aktuell: ${currentCount} ${currentCount === 1 ? 'Gerät' : 'Geräte'}
                                </small>
                            </div>
                            <div id="machineCountError" class="alert alert-danger d-none mt-3"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" id="saveMachineCount">
                                <i class="fas fa-save me-2"></i>Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('editMachineCountModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('editMachineCountModal'));
        
        // Save button handler
        document.getElementById('saveMachineCount').addEventListener('click', async () => {
            const newCount = parseInt(document.getElementById('newMachineCount').value);
            const errorDiv = document.getElementById('machineCountError');
            const saveBtn = document.getElementById('saveMachineCount');
            
            if (newCount < 1 || newCount > 3) {
                errorDiv.textContent = 'Die Anzahl muss zwischen 1 und 3 liegen.';
                errorDiv.classList.remove('d-none');
                return;
            }
            
            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Speichern...';
                errorDiv.classList.add('d-none');
                
                const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${this.currentStudioId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ machine_count: newCount })
                });
                
                if (!response.ok) {
                    throw new Error('Fehler beim Speichern');
                }
                
                // Update local data
                currentStudio.machine_count = newCount;
                
                // Update UI
                this.updateStudioSelector();
                
                // Close modal
                modal.hide();
                
                // Show success message
                this.showSuccessMessage('Erfolgreich gespeichert', 
                    `Die Anzahl der Geräte wurde auf ${newCount} aktualisiert.`);
                
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('d-none');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Speichern';
            }
        });
        
        modal.show();
    }

    updateSidebarNavigation() {
        const sidebarNav = document.getElementById('sidebarNav');
        if (!sidebarNav) return;

        let navItems = [];

        if (!this.currentUser) {
            // Guest navigation
            navItems = [
                { icon: 'fas fa-home', text: 'Home', section: 'welcome', active: true }
            ];
        } else {
            // Authenticated user navigation based on role
            switch (this.currentUser.role) {
                case 'manager':
                    navItems = [
                        { icon: 'fas fa-tachometer-alt', text: 'Dashboard', section: 'dashboard', active: true },
                        { icon: 'fas fa-building', text: 'Studios', section: 'studios' },
                        { icon: 'fas fa-users', text: 'Studio Owners', section: 'owners' },
                        { icon: 'fas fa-key', text: 'Aktivierungscodes', section: 'aktivierungscodes' },
                        { icon: 'fas fa-chart-line', text: 'Analytics', section: 'analytics' }
                    ];
                    break;
                    
                case 'studio_owner':
                    navItems = [
                        { icon: 'fas fa-tachometer-alt', text: 'Dashboard', section: 'dashboard', active: true },
                        { icon: 'fas fa-calendar-alt', text: 'Termine', section: 'termine' },
                        { icon: 'fas fa-users', text: 'Kunden', section: 'kunden' },
                        { icon: 'fas fa-user-plus', text: 'Leads', section: 'leads' },
                        { icon: 'fas fa-chart-bar', text: 'Berichte', section: 'berichte' }
                    ];
                    break;
                    
                case 'customer':
                    navItems = [
                        { icon: 'fas fa-tachometer-alt', text: 'Dashboard', section: 'dashboard', active: true },
                        { icon: 'fas fa-calendar-check', text: 'Meine Termine', section: 'appointments' },
                        { icon: 'fas fa-dumbbell', text: 'Meine Behandlungen', section: 'sessions' },
                        { icon: 'fas fa-user', text: 'Profil', section: 'profile' },
                        { icon: 'fas fa-phone', text: 'Kontakt', section: 'contact' }
                    ];
                    break;
                    
                default:
                    navItems = [
                        { icon: 'fas fa-home', text: 'Home', section: 'welcome', active: true }
                    ];
            }
        }

        // Generate navigation HTML
        const navHTML = navItems.map(item => `
            <li class="nav-item">
                <a class="nav-link ${item.active ? 'active' : ''}" href="#" data-section="${item.section}">
                    <i class="${item.icon}"></i>
                    <span class="nav-text">${item.text}</span>
                </a>
            </li>
        `).join('');

        // Always replace navigation content completely
        sidebarNav.innerHTML = navHTML;

        // Add click event listeners
        sidebarNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.navigateToSection(section);
                
                // Update active state
                sidebarNav.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Close sidebar on mobile
                if (window.innerWidth < 992) {
                    this.closeSidebar();
                }
            });
        });
    }

    navigateToSection(section) {
        // Update sidebar active state
        const sidebarNav = document.getElementById('sidebarNav');
        if (sidebarNav) {
            sidebarNav.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-section') === section) {
                    link.classList.add('active');
                }
            });
        }
        
        // Clear any existing intervals when navigating away from dashboard
        if (this.metricsRefreshInterval) {
            clearInterval(this.metricsRefreshInterval);
            this.metricsRefreshInterval = null;
        }
        
        // This method will handle navigation to different sections
        switch (section) {
            case 'welcome':
                this.showWelcomePage();
                break;
            case 'login':
                this.showStudioLogin();
                break;
            case 'register':
                this.showStudioLogin();
                break;
            case 'dashboard':
                if (this.currentUser) {
                    if (this.currentUser.role === 'manager') {
                        this.showManagerDashboard();
                    } else if (this.currentUser.role === 'studio_owner') {
                        this.showStudioDashboard();
                    } else if (this.currentUser.role === 'customer') {
                        this.showCustomerDashboard();
                    }
                } else {
                    this.showWelcomePage();
                }
                break;
            case 'calendar':
            case 'termine':
                console.log('Navigating to appointments, currentStudioId:', this.currentStudioId);
                if (this.currentStudioId) {
                    this.showAppointmentManagement(this.currentStudioId);
                } else {
                    console.log('Getting studio ID from API...');
                    this.getCurrentStudioId().then(studioId => {
                        console.log('Got studio ID:', studioId);
                        if (studioId) this.showAppointmentManagement(studioId);
                    });
                }
                break;
            case 'customers':
            case 'kunden':
                if (this.currentStudioId) {
                    this.showCustomerList(this.currentStudioId);
                } else {
                    this.getCurrentStudioId().then(studioId => {
                        if (studioId) this.showCustomerList(studioId);
                    });
                }
                break;
            case 'leads':
                this.showLeadsView();
                break;
            case 'sessions':
                if (this.currentStudioId) {
                    this.showSessionManagement(this.currentStudioId);
                } else {
                    this.getCurrentStudioId().then(studioId => {
                        if (studioId) this.showSessionManagement(studioId);
                    });
                }
                break;
            case 'aktivierungscodes':
                if (this.currentUser.role === 'manager') {
                    this.showCodeGenerationForm();
                } else if (this.currentStudioId) {
                    this.showActivationCodeGeneration(this.currentStudioId);
                } else {
                    this.getCurrentStudioId().then(studioId => {
                        if (studioId) this.showActivationCodeGeneration(studioId);
                    });
                }
                break;
            case 'profile':
                this.showProfileView();
                break;
            case 'settings':
                this.showSettingsView();
                break;
            case 'studios':
                if (this.currentUser.role === 'manager') {
                    this.showManagerDashboard(); // Studios are shown in manager dashboard
                }
                break;
            case 'reports':
            case 'berichte':
                this.showReportsView();
                break;
            case 'analytics':
                this.showAnalyticsView();
                break;
            case 'customers':
            case 'kunden':
                this.showCustomers();
                break;
            // Add more cases as needed
            default:
                console.log(`Navigation to ${section} not implemented yet`);
        }
    }

    // Navigate to Kunden tab with Aktive Kunden filter
    navigateToKundenWithFilter() {
        // Navigate to kunden section
        this.navigateToSection('kunden');
        
        // Set filter to active customers after a short delay to ensure the UI is loaded
        setTimeout(() => {
            const filterSelect = document.getElementById('filter-status');
            if (filterSelect) {
                filterSelect.value = 'active_sessions';
                // Trigger the filter change event
                if (window.customerManagement && typeof window.customerManagement.filterByStatus === 'function') {
                    window.customerManagement.filterByStatus('active_sessions');
                }
            }
        }, 500);
    }

    // Show Auslastung settings modal
    showAuslastungModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="auslastungModal" tabindex="-1" aria-labelledby="auslastungModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="auslastungModalLabel">
                                <i class="fas fa-chart-line me-2"></i>
                                Auslastung Einstellungen
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                Legen Sie fest, wie viele Termine Sie pro Woche erwarten, um die Auslastung korrekt zu berechnen.
                            </div>
                            <form id="auslastung-form">
                                <div class="mb-3">
                                    <label for="expectedWeeklyAppointments" class="form-label">Erwartete wöchentliche Termine</label>
                                    <input type="number" class="form-control" id="expectedWeeklyAppointments" 
                                           min="1" max="200" step="1" placeholder="z.B. 40">
                                    <div class="form-text">Anzahl der Termine, die Sie pro Woche erwarten (inkl. Kunden- und Lead-Termine)</div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" onclick="app.saveAuslastungSettings()">
                                <i class="fas fa-save me-2"></i>
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('auslastungModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Load current settings
        this.loadCurrentAuslastungSettings();

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('auslastungModal'));
        modal.show();
    }

    // Load current auslastung settings
    async loadCurrentAuslastungSettings() {
        try {
            const studioId = this.currentStudioId;
            if (!studioId) {
                console.error('No studio ID available');
                return;
            }

            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/settings`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const input = document.getElementById('expectedWeeklyAppointments');
                if (input && data.settings) {
                    input.value = data.settings.expected_weekly_appointments || 40;
                }
            }
        } catch (error) {
            console.error('Error loading auslastung settings:', error);
        }
    }

    // Save auslastung settings
    async saveAuslastungSettings() {
        const input = document.getElementById('expectedWeeklyAppointments');
        const value = parseInt(input.value);

        if (!value || value < 1 || value > 200) {
            alert('Bitte geben Sie eine gültige Anzahl zwischen 1 und 200 ein.');
            return;
        }

        try {
            const studioId = this.currentStudioId;
            if (!studioId) {
                throw new Error('Studio ID nicht verfügbar');
            }

            const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/${studioId}/settings`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    expected_weekly_appointments: value
                })
            });

            if (!response.ok) {
                throw new Error('Fehler beim Speichern der Einstellungen');
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('auslastungModal'));
            modal.hide();

            // Show success message
            this.showSuccessNotification('Auslastung-Einstellungen erfolgreich gespeichert!');

            // Refresh dashboard metrics to show updated calculation
            this.loadDashboardMetrics();

        } catch (error) {
            console.error('Error saving auslastung settings:', error);
            alert('Fehler beim Speichern: ' + error.message);
        }
    }

    // Show today's appointments
    showTodayAppointments() {
        // Navigate to termine section which shows appointments
        this.navigateToSection('termine');
    }

    // Show success notification
    showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-success position-fixed top-0 end-0 m-3';
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-check-circle me-2"></i>
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    // Helper method to get current studio ID
    async getCurrentStudioId() {
        if (this.currentStudioId) return this.currentStudioId;
        
        try {
            let endpoint;
            const user = this.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
            
            // Use different endpoints based on user role
            if (user.role === 'manager') {
                endpoint = `${window.API_BASE_URL}/api/v1/manager/studios`;
            } else if (user.role === 'studio_owner') {
                endpoint = `${window.API_BASE_URL}/api/v1/studios/my-studio`;
            } else {
                return null; // No studio access for other roles
            }
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (user.role === 'manager') {
                    // For managers, get the first studio from the list
                    const studios = data.studios || [];
                    if (studios.length > 0) {
                        this.currentStudioId = studios[0].id;
                        return this.currentStudioId;
                    }
                } else if (user.role === 'studio_owner') {
                    this.currentStudioId = data.studio.id;
                    return this.currentStudioId;
                }
            }
        } catch (error) {
            console.error('Error getting studio ID:', error);
        }
        return null;
    }

    // Placeholder methods for missing navigation features
    async showLeadsView() {
        const content = document.getElementById('content');
        
        // Initialize Lead Kanban component
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role !== 'studio_owner') {
                content.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Zugriff verweigert: Studio-Besitzer-Berechtigung erforderlich.
                    </div>
                `;
                return;
            }

            // Get studio ID from user data or fetch from API
            let studioId = user.studio_id;
            if (!studioId) {
                const response = await fetch(`${window.API_BASE_URL}/api/v1/studios/my-studio`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    studioId = data.studio.id;
                }
            }

            if (studioId) {
                // Use Lead Kanban instead of old Lead Management
                content.innerHTML = `<div id="lead-kanban-content"></div>`;
                if (window.leadKanban) {
                    console.log('Initializing Lead Kanban for studio:', studioId);
                    await window.leadKanban.init(studioId);
                } else {
                    console.error('Lead Kanban not loaded, falling back to Lead Management');
                    content.innerHTML = `<div id="lead-management-content"></div>`;
                    window.leadManagement = new LeadManagement();
                    await window.leadManagement.init(studioId);
                }
            } else {
                content.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Fehler: Studio-ID konnte nicht ermittelt werden.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading Lead Kanban:', error);
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Fehler beim Laden der Lead-Verwaltung: ${error.message}
                </div>
            `;
        }
    }

    showReportsView() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-chart-bar me-2"></i>Berichte</h4>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Coming Soon!</strong> Berichtsfunktionen sind in Entwicklung.
                                <br><small>Hier werden Sie detaillierte Berichte über Termine, Umsätze und Kunden finden.</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showAnalyticsView() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-chart-line me-2"></i>Analytics</h4>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Coming Soon!</strong> Analytics Dashboard wird bald verfügbar sein.
                                <br><small>Hier werden Sie erweiterte Analysen und Insights zu Ihrem Business finden.</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async showProfileView() {
        const content = document.getElementById('content');
        
        try {
            // Get user profile data
            const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load profile');
            
            const data = await response.json();
            const user = data.user;
            
            // Get subscription status for studio owners
            let subscriptionData = null;
            if (this.currentUser.role === 'studio_owner') {
                try {
                    const subResponse = await fetch(`${window.API_BASE_URL}/api/v1/subscriptions/status`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                        }
                    });
                    if (subResponse.ok) {
                        subscriptionData = await subResponse.json();
                    }
                } catch (error) {
                    console.log('Could not load subscription data:', error);
                }
            }
            
            content.innerHTML = `
                <div class="row">
                    <div class="col-md-8 mx-auto">
                        <div class="card">
                            <div class="card-header">
                                <h4><i class="fas fa-user me-2"></i>Mein Profil</h4>
                            </div>
                            <div class="card-body">
                                <div id="profileError" class="alert alert-danger d-none"></div>
                                <div id="profileSuccess" class="alert alert-success d-none"></div>
                                
                                <form id="profileForm">
                                    <h5 class="mb-3">Persönliche Daten</h5>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="profileFirstName" class="form-label">Vorname</label>
                                                <input type="text" class="form-control" id="profileFirstName" value="${user.firstName || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="profileLastName" class="form-label">Nachname</label>
                                                <input type="text" class="form-control" id="profileLastName" value="${user.lastName || ''}">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-8">
                                            <div class="mb-3">
                                                <label for="profileEmail" class="form-label">E-Mail</label>
                                                <input type="email" class="form-control" id="profileEmail" value="${user.email || ''}" readonly>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="mb-3">
                                                <label class="form-label">&nbsp;</label>
                                                <button type="button" class="btn btn-outline-primary w-100" id="editEmailBtn">E-Mail ändern</button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label for="profilePhone" class="form-label">Telefon</label>
                                        <input type="tel" class="form-control" id="profilePhone" value="${user.phone || ''}">
                                    </div>
                                    
                                    <h5 class="mb-3 mt-4">Adresse</h5>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="profileCountry" class="form-label">Land</label>
                                                <select class="form-control" id="profileCountry">
                                                    <option value="Österreich" ${(user.country || 'Österreich') === 'Österreich' ? 'selected' : ''}>Österreich</option>
                                                    <option value="Deutschland" ${user.country === 'Deutschland' ? 'selected' : ''}>Deutschland</option>
                                                    <option value="Schweiz" ${user.country === 'Schweiz' ? 'selected' : ''}>Schweiz</option>
                                                    <option value="Italien" ${user.country === 'Italien' ? 'selected' : ''}>Italien</option>
                                                    <option value="Slowenien" ${user.country === 'Slowenien' ? 'selected' : ''}>Slowenien</option>
                                                    <option value="Tschechien" ${user.country === 'Tschechien' ? 'selected' : ''}>Tschechien</option>
                                                    <option value="Ungarn" ${user.country === 'Ungarn' ? 'selected' : ''}>Ungarn</option>
                                                    <option value="Slowakei" ${user.country === 'Slowakei' ? 'selected' : ''}>Slowakei</option>
                                                    <option value="Kroatien" ${user.country === 'Kroatien' ? 'selected' : ''}>Kroatien</option>
                                                    <option value="Andere" ${user.country === 'Andere' ? 'selected' : ''}>Andere</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label for="profilePostalCode" class="form-label">PLZ</label>
                                                <input type="text" class="form-control" id="profilePostalCode" value="${user.postalCode || user.postal_code || ''}">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="profileCity" class="form-label">Ort</label>
                                        <input type="text" class="form-control" id="profileCity" value="${user.city || ''}">
                                    </div>
                                    <div class="row">
                                        <div class="col-md-8">
                                            <div class="mb-3">
                                                <label for="profileStreet" class="form-label">Straße</label>
                                                <input type="text" class="form-control" id="profileStreet" value="${user.street || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="mb-3">
                                                <label for="profileHouseNumber" class="form-label">Haus NR/Stiege</label>
                                                <input type="text" class="form-control" id="profileHouseNumber" value="${user.houseNumber || user.house_number || ''}">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="profileDoorApartment" class="form-label">Tür</label>
                                        <input type="text" class="form-control" id="profileDoorApartment" value="${user.doorApartment || user.door_apartment || ''}">
                                        <div class="form-text">Optional - Wohnungs- oder Büronummer</div>
                                    </div>
                                    
                                    ${this.currentUser.role === 'studio_owner' ? `
                                        <h5 class="mb-3 mt-4">Abonnement</h5>
                                        ${this.renderSubscriptionSection(subscriptionData)}
                                        
                                        <h5 class="mb-3 mt-4">Studio-Einstellungen</h5>
                                        <div class="mb-3">
                                            <label for="machinesCount" class="form-label">Anzahl der Behandlungsgeräte</label>
                                            <select class="form-control" id="machinesCount">
                                                <option value="1" ${(user.machinesCount || 1) == 1 ? 'selected' : ''}>1</option>
                                                <option value="2" ${(user.machinesCount || 1) == 2 ? 'selected' : ''}>2</option>
                                                <option value="3" ${(user.machinesCount || 1) == 3 ? 'selected' : ''}>3</option>
                                            </select>
                                        </div>
                                    ` : ''}
                                    
                                    <button type="submit" class="btn btn-primary" id="saveProfileBtn">Profil speichern</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add form handler
            document.getElementById('profileForm').addEventListener('submit', (e) => {
                this.handleProfileUpdate(e);
            });
            
            // Add email change handler
            document.getElementById('editEmailBtn').addEventListener('click', () => {
                this.showEmailChangeModal();
            });
            
            // Add subscription management handler if button exists
            const manageSubBtn = document.getElementById('manageSubscriptionBtn');
            if (manageSubBtn) {
                manageSubBtn.addEventListener('click', () => {
                    this.showSubscriptionManagementModal(subscriptionData);
                });
            }
            
        } catch (error) {
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Fehler beim Laden des Profils: ${error.message}
                </div>
            `;
        }
    }
    
    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('profileFirstName').value.trim();
        const lastName = document.getElementById('profileLastName').value.trim();
        const phone = document.getElementById('profilePhone').value.trim();
        const country = document.getElementById('profileCountry').value.trim();
        const postalCode = document.getElementById('profilePostalCode').value.trim();
        const city = document.getElementById('profileCity').value.trim();
        const street = document.getElementById('profileStreet').value.trim();
        const houseNumber = document.getElementById('profileHouseNumber').value.trim();
        const doorApartment = document.getElementById('profileDoorApartment').value.trim();
        
        const errorDiv = document.getElementById('profileError');
        
        // Validate all required fields are filled
        if (!firstName || !lastName || !phone || !country || !postalCode || !city || !street || !houseNumber) {
            errorDiv.textContent = 'Alle Pflichtfelder müssen ausgefüllt werden.';
            errorDiv.classList.remove('d-none');
            return;
        }
        
        const formData = {
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            country: country,
            postalCode: postalCode,
            city: city,
            street: street,
            houseNumber: houseNumber,
            doorApartment: doorApartment
        };
        
        if (this.currentUser.role === 'studio_owner') {
            formData.machinesCount = document.getElementById('machinesCount').value;
        }
        
        const saveBtn = document.getElementById('saveProfileBtn');
        const successDiv = document.getElementById('profileSuccess');
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Speichere...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Fehler beim Speichern');
            }
            
            successDiv.textContent = 'Profil erfolgreich gespeichert!';
            successDiv.classList.remove('d-none');
            
            // Update current user data and refresh UI
            this.currentUser.firstName = formData.firstName;
            this.currentUser.lastName = formData.lastName;
            this.currentUser.phone = formData.phone;
            
            // Update sidebar display with new name
            this.updateSidebarUser();
            
            // Refresh the profile view with updated data from server
            setTimeout(() => {
                this.showProfileView();
            }, 1000);
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Profil speichern';
        }
    }

    showEmailChangeModal() {
        const modalHTML = `
            <div class="modal fade" id="emailChangeModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">E-Mail-Adresse ändern</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="emailChangeError" class="alert alert-danger d-none"></div>
                            <div id="emailChangeSuccess" class="alert alert-success d-none"></div>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Sicherheitshinweis:</strong> Zur Änderung Ihrer E-Mail-Adresse benötigen wir Ihr aktuelles Passwort. 
                                Eine Bestätigungs-E-Mail wird an die neue Adresse gesendet.
                            </div>
                            
                            <form id="emailChangeForm">
                                <div class="mb-3">
                                    <label for="newEmail" class="form-label">Neue E-Mail-Adresse</label>
                                    <input type="email" class="form-control" id="newEmail" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="confirmPassword" class="form-label">Aktuelles Passwort zur Bestätigung</label>
                                    <input type="password" class="form-control" id="confirmPassword" required>
                                    <div class="form-text">
                                        Geben Sie Ihr aktuelles Passwort ein, um die Änderung zu bestätigen.
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" id="confirmEmailChangeBtn">
                                <i class="fas fa-envelope"></i> Bestätigungs-E-Mail senden
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('emailChangeModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event listeners
        document.getElementById('confirmEmailChangeBtn').addEventListener('click', () => {
            this.handleEmailChangeRequest();
        });
        
        document.getElementById('emailChangeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailChangeRequest();
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('emailChangeModal'));
        modal.show();
    }

    async handleEmailChangeRequest() {
        const newEmail = document.getElementById('newEmail').value.trim();
        const password = document.getElementById('confirmPassword').value;
        const confirmBtn = document.getElementById('confirmEmailChangeBtn');
        const errorDiv = document.getElementById('emailChangeError');
        const successDiv = document.getElementById('emailChangeSuccess');

        // Basic validation
        if (!newEmail || !password) {
            errorDiv.textContent = 'Bitte füllen Sie alle Felder aus.';
            errorDiv.classList.remove('d-none');
            successDiv.classList.add('d-none');
            return;
        }

        if (newEmail === this.currentUser.email) {
            errorDiv.textContent = 'Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden.';
            errorDiv.classList.remove('d-none');
            successDiv.classList.add('d-none');
            return;
        }

        try {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Wird gesendet...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');

            const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/request-email-change`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    newEmail: newEmail,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Fehler beim Senden der Bestätigungs-E-Mail');
            }

            successDiv.innerHTML = `
                <i class="fas fa-check-circle me-2"></i>
                <strong>Bestätigungs-E-Mail gesendet!</strong><br>
                Bitte überprüfen Sie Ihr Postfach bei <strong>${newEmail}</strong> und klicken Sie auf den Bestätigungslink, 
                um die E-Mail-Änderung abzuschließen.
            `;
            successDiv.classList.remove('d-none');

            // Hide form after successful request
            document.getElementById('emailChangeForm').style.display = 'none';
            confirmBtn.style.display = 'none';

        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-envelope"></i> Bestätigungs-E-Mail senden';
        }
    }

    showSettingsView() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-cog me-2"></i>Einstellungen</h4>
                        </div>
                        <div class="card-body">
                            <h5 class="mb-3">Passwort ändern</h5>
                            <div id="passwordError" class="alert alert-danger d-none"></div>
                            <div id="passwordSuccess" class="alert alert-success d-none"></div>
                            
                            <form id="changePasswordForm">
                                <div class="mb-3">
                                    <label for="currentPassword" class="form-label">Aktuelles Passwort</label>
                                    <input type="password" class="form-control" id="currentPassword" required>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="newPassword" class="form-label">Neues Passwort</label>
                                            <input type="password" class="form-control" id="newPassword" required>
                                            <div class="form-text">
                                                Mind. 8 Zeichen, Groß-/Kleinbuchstaben und Zahl
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="confirmNewPassword" class="form-label">Neues Passwort wiederholen</label>
                                            <input type="password" class="form-control" id="confirmNewPassword" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" class="btn btn-primary" id="changePasswordBtn">Passwort ändern</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add form handler
        document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
            this.handlePasswordChange(e);
        });
    }
    
    async handlePasswordChange(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        
        // Validate password confirmation
        if (newPassword !== confirmPassword) {
            const errorDiv = document.getElementById('passwordError');
            errorDiv.textContent = 'Neue Passwörter stimmen nicht überein';
            errorDiv.classList.remove('d-none');
            return;
        }
        
        const formData = {
            currentPassword: currentPassword,
            newPassword: newPassword,
            confirmPassword: confirmPassword
        };
        
        const changeBtn = document.getElementById('changePasswordBtn');
        const errorDiv = document.getElementById('passwordError');
        const successDiv = document.getElementById('passwordSuccess');
        
        try {
            changeBtn.disabled = true;
            changeBtn.textContent = 'Ändere Passwort...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Fehler beim Ändern des Passworts');
            }
            
            successDiv.textContent = 'Passwort erfolgreich geändert!';
            successDiv.classList.remove('d-none');
            
            // Clear form
            document.getElementById('changePasswordForm').reset();
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            changeBtn.disabled = false;
            changeBtn.textContent = 'Passwort ändern';
        }
    }
    
    // Render subscription section for profile
    renderSubscriptionSection(subscriptionData) {
        if (!subscriptionData) {
            return `
                <div class="card border-0 bg-light">
                    <div class="card-body py-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge bg-secondary me-2">Keine Abonnement-Daten</span>
                                <span class="text-muted">Abonnement-Status konnte nicht geladen werden</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-primary" onclick="window.location.reload()">
                                Aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Determine status badge
        let statusBadge = '';
        let statusText = '';
        let daysText = '';
        
        if (subscriptionData.subscription?.status === 'trial') {
            if (subscriptionData.days_remaining > 0) {
                statusBadge = '<span class="badge bg-info me-2">Probezeit</span>';
                statusText = `${subscriptionData.subscription.plan_type === 'trial' ? 'Trial Plan' : subscriptionData.subscription.plan_type}`;
                daysText = `${subscriptionData.days_remaining} Tage verbleibend`;
            } else {
                statusBadge = '<span class="badge bg-warning me-2">Probezeit abgelaufen</span>';
                statusText = 'Upgrade erforderlich';
                daysText = 'Jetzt upgraden';
            }
        } else if (subscriptionData.subscription?.status === 'active') {
            statusBadge = '<span class="badge bg-success me-2">Aktiv</span>';
            statusText = subscriptionData.subscription.plan_type || 'Premium Plan';
            if (subscriptionData.days_until_renewal > 0) {
                daysText = `Erneuert sich in ${subscriptionData.days_until_renewal} Tagen`;
            }
        } else {
            statusBadge = '<span class="badge bg-danger me-2">Inaktiv</span>';
            statusText = 'Kein aktives Abonnement';
            daysText = 'Aktivierung erforderlich';
        }
        
        return `
            <div class="card border-0 bg-light">
                <div class="card-body py-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            ${statusBadge}
                            <span class="fw-medium">${statusText}</span>
                            ${daysText ? `<br><small class="text-muted">${daysText}</small>` : ''}
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary" id="manageSubscriptionBtn">
                            Verwalten
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Show subscription management modal
    showSubscriptionManagementModal(subscriptionData) {
        // Remove existing modal if present
        const existingModal = document.getElementById('subscriptionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHtml = `
            <div class="modal fade" id="subscriptionModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-credit-card me-2"></i>
                                Abonnement verwalten
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${this.renderSubscriptionManagement(subscriptionData)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('subscriptionModal'));
        modal.show();
    }
    
    // Render subscription management content
    renderSubscriptionManagement(subscriptionData) {
        // Get plan information
        const plans = [
            {
                id: 'single_studio',
                name: 'Single Studio',
                price: '29',
                currency: 'EUR',
                period: 'Monat',
                studios: 1,
                features: ['1 Studio verwalten', 'Unbegrenzte Termine', 'Google Sheets Integration', 'Kunden-Management', 'E-Mail Support']
            },
            {
                id: 'dual_studio',
                name: 'Dual Studio',
                price: '49',
                currency: 'EUR', 
                period: 'Monat',
                studios: 2,
                features: ['2 Studios verwalten', 'Unbegrenzte Termine', 'Google Sheets Integration', 'Kunden-Management', 'Prioritäts-Support'],
                popular: true
            },
            {
                id: 'triple_studio',
                name: 'Triple Studio',
                price: '69',
                currency: 'EUR',
                period: 'Monat',
                studios: 3,
                features: ['3 Studios verwalten', 'Unbegrenzte Termine', 'Google Sheets Integration', 'Kunden-Management', 'Prioritäts-Support', 'Erweiterte Analytics']
            }
        ];
        
        const currentPlan = subscriptionData?.subscription?.plan_type || 'trial';
        
        return `
            <!-- Nav tabs -->
            <ul class="nav nav-tabs mb-4" role="tablist">
                <li class="nav-item">
                    <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#current-plan-tab">
                        <i class="bi bi-info-circle me-1"></i>Aktueller Plan
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#plans-tab">
                        <i class="bi bi-grid-3x3 me-1"></i>Pläne
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#promocode-tab">
                        <i class="bi bi-ticket-perforated me-1"></i>Promo Code
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#billing-tab">
                        <i class="bi bi-receipt me-1"></i>Rechnung
                    </button>
                </li>
            </ul>
            
            <!-- Tab content -->
            <div class="tab-content">
                ${this.renderCurrentPlanTab(subscriptionData)}
                ${this.renderPlansTab(plans, currentPlan)}
                ${this.renderPromoCodeTab()}
                ${this.renderBillingTab()}
            </div>
        `;
    }
    
    // Render current plan tab
    renderCurrentPlanTab(subscriptionData) {
        if (!subscriptionData) {
            return `
                <div class="tab-pane fade show active" id="current-plan-tab">
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Keine Abonnement-Daten verfügbar
                    </div>
                </div>
            `;
        }
        
        const statusColor = subscriptionData.subscription?.status === 'active' ? 'success' : 
                           subscriptionData.subscription?.status === 'trial' ? 'info' : 'warning';
        
        return `
            <div class="tab-pane fade show active" id="current-plan-tab">
                <div class="row">
                    <div class="col-md-6">
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <h6 class="card-title">Plan Status</h6>
                                <div class="mb-3">
                                    <span class="badge bg-${statusColor} fs-6">${subscriptionData.subscription?.plan_type || 'Trial'}</span>
                                </div>
                                
                                <div class="mb-3">
                                    <small class="text-muted d-block">Status</small>
                                    <strong>${subscriptionData.subscription?.status === 'trial' ? 'Probezeit' : subscriptionData.subscription?.status === 'active' ? 'Aktiv' : 'Inaktiv'}</strong>
                                </div>
                                
                                ${subscriptionData.days_remaining || subscriptionData.days_until_renewal ? `
                                    <div class="mb-3">
                                        <small class="text-muted d-block">${subscriptionData.subscription?.status === 'trial' ? 'Verbleibende Probezeit' : 'Bis zur Verlängerung'}</small>
                                        <strong>${subscriptionData.days_remaining || subscriptionData.days_until_renewal} Tage</strong>
                                    </div>
                                ` : ''}
                                
                                <div class="mb-3">
                                    <small class="text-muted d-block">Studios erlaubt</small>
                                    <strong>${subscriptionData.max_studios_allowed || 1}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card border-0">
                            <div class="card-body">
                                <h6 class="card-title">Nutzung</h6>
                                <div class="mb-3">
                                    <small class="text-muted d-block">Aktuelle Studios</small>
                                    <strong>${subscriptionData.current_studios || 0} von ${subscriptionData.max_studios_allowed || 1}</strong>
                                </div>
                                
                                ${subscriptionData.subscription?.status === 'trial' && subscriptionData.days_remaining <= 7 ? `
                                    <div class="alert alert-warning py-2 px-3">
                                        <small>
                                            <i class="bi bi-exclamation-triangle me-1"></i>
                                            Ihre Probezeit läuft bald ab. Upgraden Sie jetzt!
                                        </small>
                                    </div>
                                ` : ''}
                                
                                ${subscriptionData.can_create_studios === false ? `
                                    <div class="alert alert-info py-2 px-3">
                                        <small>
                                            <i class="bi bi-info-circle me-1"></i>
                                            Studio-Limit erreicht. Upgraden für mehr Studios.
                                        </small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render plans tab
    renderPlansTab(plans, currentPlan) {
        return `
            <div class="tab-pane fade" id="plans-tab">
                <div class="mb-4">
                    <h6 class="text-center mb-3">Wählen Sie Ihren Plan</h6>
                    <p class="text-muted text-center">Alle Pläne beinhalten eine 30-tägige kostenlose Testphase</p>
                </div>
                
                <div class="row g-4">
                    ${plans.map(plan => `
                        <div class="col-lg-4">
                            <div class="card ${plan.popular ? 'border-primary' : 'border-0'} ${currentPlan === plan.id ? 'bg-light' : ''} h-100">
                                ${plan.popular ? '<div class="card-header bg-primary text-white text-center py-2"><small>Am beliebtesten</small></div>' : ''}
                                <div class="card-body text-center">
                                    <h5 class="card-title">${plan.name}</h5>
                                    <div class="mb-3">
                                        <span class="h2">€${plan.price}</span>
                                        <small class="text-muted">/${plan.period}</small>
                                    </div>
                                    <div class="mb-4">
                                        <strong>${plan.studios} Studio${plan.studios > 1 ? 's' : ''}</strong>
                                    </div>
                                    
                                    <ul class="list-unstyled mb-4">
                                        ${plan.features.map(feature => `
                                            <li class="mb-2">
                                                <i class="bi bi-check-circle text-success me-2"></i>
                                                <small>${feature}</small>
                                            </li>
                                        `).join('')}
                                    </ul>
                                    
                                    ${currentPlan === plan.id ? `
                                        <button class="btn btn-outline-secondary w-100" disabled>
                                            Aktueller Plan
                                        </button>
                                    ` : `
                                        <button class="btn ${plan.popular ? 'btn-primary' : 'btn-outline-primary'} w-100" 
                                                onclick="window.app.selectPlan('${plan.id}', '${plan.name}', ${plan.price})">
                                            ${currentPlan === 'trial' ? 'Plan auswählen' : 'Plan wechseln'}
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Render promo code tab
    renderPromoCodeTab() {
        return `
            <div class="tab-pane fade" id="promocode-tab">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <h6 class="card-title text-center mb-4">
                                    <i class="bi bi-ticket-perforated me-2"></i>
                                    Promo Code einlösen
                                </h6>
                                
                                <form id="promoCodeForm" onsubmit="window.app.redeemPromoCode(event)">
                                    <div class="mb-3">
                                        <label for="promoCode" class="form-label">Promo Code</label>
                                        <input type="text" class="form-control" id="promoCode" 
                                               placeholder="Geben Sie Ihren Code ein" required>
                                        <div class="form-text">
                                            Promo Codes verlängern Ihre Probezeit um zusätzliche Monate
                                        </div>
                                    </div>
                                    
                                    <div id="promoCodeError" class="alert alert-danger d-none"></div>
                                    <div id="promoCodeSuccess" class="alert alert-success d-none"></div>
                                    
                                    <button type="submit" class="btn btn-primary w-100" id="redeemPromoBtn">
                                        Code einlösen
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render billing tab
    renderBillingTab() {
        return `
            <div class="tab-pane fade" id="billing-tab">
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="mb-3">Zahlungsmethode</h6>
                        <div class="card border-0 bg-light">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <i class="bi bi-credit-card text-muted me-2"></i>
                                        <span class="text-muted">Noch keine Zahlungsmethode hinterlegt</span>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary" onclick="window.app.addPaymentMethod()">
                                        Hinzufügen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <h6 class="mb-3">Rechnungshistorie</h6>
                        <div class="card border-0 bg-light">
                            <div class="card-body text-center">
                                <i class="bi bi-receipt text-muted mb-2" style="font-size: 2rem;"></i>
                                <p class="text-muted mb-0">Keine Rechnungen vorhanden</p>
                                <small class="text-muted">Rechnungen erscheinen hier nach der ersten Zahlung</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Handle plan selection (dummy for now)
    selectPlan(planId, planName, price) {
        // Show dummy payment modal
        this.showPaymentModal(planId, planName, price);
    }
    
    // Show dummy payment modal
    showPaymentModal(planId, planName, price) {
        const modalHtml = `
            <div class="modal fade" id="paymentModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Zahlung - ${planName}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <h4 class="text-primary">€${price}/Monat</h4>
                                <p class="text-muted">${planName} Plan</p>
                            </div>
                            
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle me-2"></i>
                                <strong>Demo Modus:</strong> Die Zahlungsverarbeitung ist noch nicht implementiert.
                                Dieser Plan würde normalerweise über Stripe verarbeitet werden.
                            </div>
                            
                            <div class="d-grid gap-2">
                                <button class="btn btn-success" onclick="window.app.processDummyPayment('${planId}', '${planName}')">
                                    <i class="bi bi-check-circle me-2"></i>
                                    Demo Zahlung simulieren
                                </button>
                                <button class="btn btn-secondary" data-bs-dismiss="modal">
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
        modal.show();
        
        // Remove modal after closing
        modal._element.addEventListener('hidden.bs.modal', () => {
            modal._element.remove();
        });
    }
    
    // Process dummy payment
    processDummyPayment(planId, planName) {
        // Close payment modal
        const paymentModal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
        paymentModal.hide();
        
        // Show success message
        this.showSuccessMessage('Demo Zahlung erfolgreich', 
            `Der ${planName} Plan wurde erfolgreich simuliert. In der echten Version würde dies über Stripe verarbeitet werden.`);
        
        // Refresh subscription modal after delay
        setTimeout(() => {
            const subscriptionModal = bootstrap.Modal.getInstance(document.getElementById('subscriptionModal'));
            if (subscriptionModal) {
                subscriptionModal.hide();
            }
        }, 2000);
    }
    
    // Redeem promo code
    async redeemPromoCode(event) {
        event.preventDefault();
        
        const promoCode = document.getElementById('promoCode').value.trim();
        const errorDiv = document.getElementById('promoCodeError');
        const successDiv = document.getElementById('promoCodeSuccess');
        const submitBtn = document.getElementById('redeemPromoBtn');
        
        if (!promoCode) {
            errorDiv.textContent = 'Bitte geben Sie einen Promo Code ein';
            errorDiv.classList.remove('d-none');
            return;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Wird eingelöst...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/subscriptions/redeem-promocode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ promocode: promoCode })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Fehler beim Einlösen des Promo Codes');
            }
            
            successDiv.textContent = `Promo Code erfolgreich eingelöst! ${result.months_added} Monate hinzugefügt.`;
            successDiv.classList.remove('d-none');
            
            // Clear form
            document.getElementById('promoCodeForm').reset();
            
            // Refresh the page after delay to show updated subscription
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Code einlösen';
        }
    }
    
    // Add payment method (dummy)
    addPaymentMethod() {
        this.showInfoMessage('Demo Modus', 'Die Zahlungsmethoden-Verwaltung ist noch nicht implementiert. Dies würde normalerweise Stripe Elements verwenden.');
    }

}

// Global helper functions
function showTodayAppointments() {
    console.log('Global showTodayAppointments called');
    if (window.app && window.app.showTodayAppointmentsModal) {
        window.app.showTodayAppointmentsModal();
    } else {
        console.error('App not ready or method not found');
    }
}

// Attach to window for global access
window.showTodayAppointments = showTodayAppointments;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.isInitialized = true;
});