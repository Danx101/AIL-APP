// Main application initialization
class App {
    constructor() {
        this.currentUser = null;
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.currentStudioId = null;
        this.init();
    }

    async init() {
        console.log('App.init() called');
        this.setupEventListeners();
        console.log('About to check API status...');
        this.checkAPIStatus();
        console.log('About to check auth status...');
        await this.checkAuthStatus();
        console.log('App initialization complete');
    }

    async checkAuthStatus() {
        console.log('checkAuthStatus called');
        console.log('window.authService:', window.authService);
        console.log('isAuthenticated:', window.authService?.isAuthenticated());
        
        if (window.authService && window.authService.isAuthenticated()) {
            try {
                console.log('Validating token...');
                await window.authService.validateToken();
                this.currentUser = window.authService.getCurrentUser();
                console.log('User authenticated:', this.currentUser);
                this.updateUIForAuthenticatedUser();
            } catch (error) {
                console.error('Token validation failed:', error);
                this.currentUser = null;
                this.updateUIForGuestUser();
            }
        } else {
            console.log('No auth or not authenticated, showing guest UI');
            this.updateUIForGuestUser();
        }
    }

    updateUIForAuthenticatedUser() {
        const navbar = document.querySelector('.navbar-nav');
        if (navbar) {
            navbar.innerHTML = `
                <span class="navbar-text me-3">
                    Welcome, ${this.currentUser.firstName}!
                </span>
                <button class="btn btn-outline-light btn-sm" id="logoutBtn">
                    Logout
                </button>
            `;
            
            document.getElementById('logoutBtn').addEventListener('click', () => {
                this.logout();
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
        const navbar = document.querySelector('.navbar-nav');
        if (navbar) {
            navbar.innerHTML = `
                <a class="nav-link" href="#" id="loginBtn">Login</a>
                <a class="nav-link" href="#" id="registerBtn">Registrieren</a>
            `;
            
            document.getElementById('loginBtn').addEventListener('click', () => {
                this.showLoginModal();
            });
            
            document.getElementById('registerBtn').addEventListener('click', () => {
                this.showRegisterModal();
            });
        }

        // Show welcome page
        this.showWelcomePage();
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
        console.log('showWelcomePage called');
        const content = document.getElementById('content');
        console.log('content element:', content);
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
                                <button class="btn btn-primary" type="button" id="customerLoginBtn">
                                    Kunde Login
                                </button>
                                <button class="btn btn-outline-primary" type="button" id="studioLoginBtn">
                                    Studio Login
                                </button>
                                <button class="btn btn-outline-secondary" type="button" id="managerLoginBtn">
                                    Manager Login
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('customerLoginBtn').addEventListener('click', () => {
            this.showCustomerLogin();
        });

        document.getElementById('studioLoginBtn').addEventListener('click', () => {
            this.showStudioLogin();
        });

        document.getElementById('managerLoginBtn').addEventListener('click', () => {
            this.showManagerLogin();
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
        
        try {
            const response = await fetch('http://localhost:3001/api/v1/status');
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

    showCustomerLogin() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6 mx-auto">
                    <div class="text-center mb-3">
                        <h2><a href="#" class="text-decoration-none" id="brandLinkCustomer"><img src="assets/images/LOgo AIL.png" alt="Abnehmen im Liegen" style="height: 60px;"></a></h2>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <h4>Kunde Login</h4>
                        </div>
                        <div class="card-body">
                            <div id="loginError" class="alert alert-danger d-none"></div>
                            <form id="customerLoginForm">
                                <div class="mb-3">
                                    <label for="email" class="form-label">E-Mail</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="loginSubmitBtn">Login</button>
                            </form>
                            <hr>
                            <div class="text-center">
                                <small>Noch kein Konto? <a href="#" id="showRegisterLink">Registrieren</a></small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('customerLoginForm').addEventListener('submit', (e) => {
            this.handleLogin(e);
        });
        document.getElementById('brandLinkCustomer')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showMainPage();
        });

        document.getElementById('showRegisterLink')?.addEventListener('click', () => {
            this.showCustomerRegister();
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = document.getElementById('loginSubmitBtn');
        const errorDiv = document.getElementById('loginError');
        
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
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    showCustomerRegister() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6 mx-auto">
                    <div class="card">
                        <div class="card-header">
                            <h4>Kunde Registrierung</h4>
                        </div>
                        <div class="card-body">
                            <div id="registerError" class="alert alert-danger d-none"></div>
                            <div id="registerSuccess" class="alert alert-success d-none"></div>
                            <form id="customerRegisterForm">
                                <div class="mb-3">
                                    <label for="activationCode" class="form-label">Aktivierungscode</label>
                                    <input type="text" class="form-control" id="activationCode" required 
                                           placeholder="Code vom Studio erhalten">
                                </div>
                                <div class="mb-3">
                                    <label for="firstName" class="form-label">Vorname</label>
                                    <input type="text" class="form-control" id="firstName" required>
                                </div>
                                <div class="mb-3">
                                    <label for="lastName" class="form-label">Nachname</label>
                                    <input type="text" class="form-control" id="lastName" required>
                                </div>
                                <div class="mb-3">
                                    <label for="registerEmail" class="form-label">E-Mail</label>
                                    <input type="email" class="form-control" id="registerEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label for="registerPassword" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="registerPassword" required>
                                    <div class="form-text">
                                        Mindestens 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe und eine Zahl
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="phone" class="form-label">Telefon (optional)</label>
                                    <input type="tel" class="form-control" id="phone">
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="registerSubmitBtn">Registrieren</button>
                            </form>
                            <hr>
                            <div class="text-center">
                                <small>Bereits ein Konto? <a href="#" id="showLoginLink">Anmelden</a></small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('customerRegisterForm').addEventListener('submit', (e) => {
            this.handleRegister(e);
        });

        document.getElementById('showLoginLink')?.addEventListener('click', () => {
            this.showCustomerLogin();
        });
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = {
            activationCode: document.getElementById('activationCode').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            phone: document.getElementById('phone').value,
            role: 'customer'
        };
        
        const submitBtn = document.getElementById('registerSubmitBtn');
        const errorDiv = document.getElementById('registerError');
        const successDiv = document.getElementById('registerSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const result = await window.authService.register(formData);
            this.currentUser = result.user;
            
            successDiv.textContent = 'Registrierung erfolgreich! Sie werden weitergeleitet...';
            successDiv.classList.remove('d-none');
            
            setTimeout(() => {
                this.updateUIForAuthenticatedUser();
            }, 2000);
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Registrieren';
        }
    }

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
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        
        const monthYearDisplay = document.getElementById('customerMonthYearDisplay');
        const calendarGrid = document.getElementById('customerCalendarGrid');
        
        if (!monthYearDisplay || !calendarGrid) return;
        
        monthYearDisplay.innerHTML = `<strong>${monthNames[this.customerCurrentDate.getMonth()]} ${this.customerCurrentDate.getFullYear()}</strong>`;
        
        // Calculate first day of month and number of days
        const firstDay = new Date(this.customerCurrentDate.getFullYear(), this.customerCurrentDate.getMonth(), 1);
        
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
                const currentDate = new Date(this.customerCurrentDate.getFullYear(), this.customerCurrentDate.getMonth(), 1 - firstDay.getDay() + daysFromStart);
                
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
            const response = await fetch('http://localhost:3001/api/v1/customers/me/sessions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load session information');
            }
            
            const data = await response.json();
            const sessions = data.sessions || [];
            
            if (sessions.length === 0) {
                sessionDisplay.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="badge bg-secondary me-2">0</div>
                        <span class="text-muted">Keine aktiven Behandlungspakete</span>
                    </div>
                    <small class="text-muted d-block mt-1">Kontaktieren Sie Ihr Studio, um ein Paket zu erwerben.</small>
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
                <div class="d-flex align-items-center">
                    <div class="badge ${badgeClass} me-2 fs-6">${totalRemaining}</div>
                    <span><strong>Verbleibende Behandlungen</strong></span>
                </div>
                <small class="text-muted d-block mt-1">
                    Status: ${statusText} | 
                    ${sessions.filter(s => s.is_active).length} aktive${sessions.filter(s => s.is_active).length !== 1 ? 's' : ''} Paket${sessions.filter(s => s.is_active).length !== 1 ? 'e' : ''}
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
            // Update the header with selected date
            const selectedDateDisplayStr = selectedDate.toLocaleDateString('de-DE', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const headerElement = document.getElementById('selectedDateHeader');
            if (headerElement) {
                headerElement.textContent = `Termine für ${selectedDateDisplayStr}`;
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
                                        <h6 class="mb-1">${appointment.appointment_type_name || 'Abnehmen Behandlung'}</h6>
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
                                    <h6>${appointment.appointment_type_name || 'Abnehmen Behandlung'}</h6>
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
            'pending': 'bg-warning text-dark',
            'confirmed': 'bg-success',
            'cancelled': 'bg-danger',
            'completed': 'bg-info',
            'no_show': 'bg-secondary'
        };
        return classes[status] || 'bg-secondary';
    }

    async loadCustomerAppointments() {
        const container = document.getElementById('customerAppointmentsContainer');
        
        try {
            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5>Aktuelle Termine</h5>
                    <div>
                        <select class="form-select form-select-sm" id="customerStatusFilter">
                            <option value="">Alle Status</option>
                            <option value="pending">Ausstehend</option>
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
                                <h6 class="mb-1 ${isPast ? 'text-muted' : ''}">${appointment.appointment_type_name || 'Abnehmen Behandlung'}</h6>
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
            listContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h6>Fehler beim Laden der Termine</h6>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }


    async showAppointmentRequestForm(preselectedDate = null) {
        // Check session availability first
        try {
            const sessionResponse = await fetch('http://localhost:3001/api/v1/customers/me/sessions', {
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
                    // Handle both string dates (YYYY-MM-DD) and Date objects
                    let dateValue = preselectedDate;
                    if (preselectedDate instanceof Date) {
                        dateValue = preselectedDate.toISOString().split('T')[0];
                    }
                    dateInput.value = dateValue;
                    console.log('Set appointment date to:', dateValue);
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
                    const selected = type.name === 'Abnehmen Behandlung' ? 'selected' : '';
                    return `<option value="${type.id}" ${selected}>${type.name}${type.duration ? ` (${type.duration} Min.)` : ''}</option>`;
                }).join('')}
            `;
            
            // Auto-select "Abnehmen Behandlung" if found
            const abnehmenType = types.find(type => type.name === 'Abnehmen Behandlung');
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
            const sessionResponse = await fetch('http://localhost:3001/api/v1/customers/me/sessions', {
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
        console.log('Submitting appointment data:', appointmentData);
        
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
            await window.customerAPI.cancelAppointment(appointmentId);
            this.showSuccessMessage('Termin abgesagt', 'Ihr Termin wurde erfolgreich abgesagt.');
            
            // Refresh views
            this.loadCustomerCalendar();
            this.loadCustomerAppointments();
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            this.showErrorMessage('Fehler beim Absagen', error.message);
        }
    }

    async rescheduleAppointment(appointmentId) {
        // For now, just show the request form with a note
        this.showAppointmentRequestForm();
        // TODO: Implement proper rescheduling logic
        this.showInfoMessage('Umbuchen', 'Buchen Sie einen neuen Termin und sagen Sie den alten ab, oder kontaktieren Sie das Studio direkt.');
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
            <div class="row">
                <div class="col-md-10 mx-auto">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Studio Dashboard</h4>
                            <button class="btn btn-outline-primary" id="setupStudioBtn">Studio Setup</button>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h5>Willkommen, ${this.currentUser.firstName}!</h5>
                                    <p>Sie sind erfolgreich angemeldet als Studio-Inhaber.</p>
                                    <p><strong>Email:</strong> ${this.currentUser.email}</p>
                                    <p><strong>Name:</strong> ${this.currentUser.firstName} ${this.currentUser.lastName}</p>
                                </div>
                                <div class="col-md-6">
                                    <div id="studioStatus">
                                        <div class="text-center">
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                            <p class="mt-2">Lade Studio-Status...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('setupStudioBtn').addEventListener('click', () => {
            this.showStudioSetup();
        });

        // Check if user has a studio
        this.checkStudioStatus();
    }

    async checkStudioStatus() {
        const statusDiv = document.getElementById('studioStatus');
        
        try {
            const response = await fetch('http://localhost:3001/api/v1/studios/my-studio', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const studio = data.studio;
                
                statusDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h6>Ihr Studio: ${studio.name}</h6>
                            <p><strong>Stadt:</strong> ${studio.city}</p>
                            <p><strong>Adresse:</strong> ${studio.address}</p>
                            <p><strong>Telefon:</strong> ${studio.phone}</p>
                            <div class="mt-3">
                                <button class="btn btn-primary btn-sm me-2" id="generateActivationCodesBtn">
                                    Aktivierungscodes generieren
                                </button>
                                <button class="btn btn-success btn-sm me-2" id="manageAppointmentsBtn">
                                    Termine verwalten
                                </button>
                                <button class="btn btn-info btn-sm me-2" id="viewCustomersBtn">
                                    Kunden anzeigen
                                </button>
                                <button class="btn btn-warning btn-sm" id="manageSessionsBtn">
                                    Behandlungen verwalten
                                </button>
                            </div>
                            
                            <!-- Today's appointments overview -->
                            <div class="mt-4">
                                <h6>Heutige Termine</h6>
                                <div id="todaysAppointments">
                                    <div class="text-center">
                                        <div class="spinner-border spinner-border-sm" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2 small">Lade heutige Termine...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                document.getElementById('generateActivationCodesBtn').addEventListener('click', () => {
                    this.showActivationCodeGeneration(studio.id);
                });
                
                document.getElementById('manageAppointmentsBtn').addEventListener('click', () => {
                    this.showAppointmentManagement(studio.id);
                });
                
                document.getElementById('viewCustomersBtn').addEventListener('click', () => {
                    this.showCustomerList(studio.id);
                });
                
                document.getElementById('manageSessionsBtn').addEventListener('click', () => {
                    this.showSessionManagement(studio.id);
                });
                
                // Load today's appointments
                this.loadTodaysAppointments(studio.id);
                
            } else if (response.status === 404) {
                statusDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h6>Studio Setup erforderlich</h6>
                            <p>Sie müssen zuerst Ihr Studio einrichten.</p>
                            <button class="btn btn-primary" id="startStudioSetupBtn">
                                Studio einrichten
                            </button>
                        </div>
                    </div>
                `;
                
                document.getElementById('startStudioSetupBtn').addEventListener('click', () => {
                    this.showStudioSetup();
                });
            }
            
        } catch (error) {
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden des Studio-Status: ${error.message}
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
                        <div class="card-header">
                            <h4>Aktivierungscodes generieren</h4>
                        </div>
                        <div class="card-body">
                            <div id="activationCodeError" class="alert alert-danger d-none"></div>
                            <div id="activationCodeSuccess" class="alert alert-success d-none"></div>
                            <form id="activationCodeForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="codeCountActivation" class="form-label">Anzahl Codes</label>
                                            <input type="number" class="form-control" id="codeCountActivation" value="10" min="1" max="100">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="expiresInDaysActivation" class="form-label">Gültig für (Tage)</label>
                                            <input type="number" class="form-control" id="expiresInDaysActivation" value="365" min="1" max="365">
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="generateActivationSubmitBtn">
                                    Aktivierungscodes generieren
                                </button>
                            </form>
                            <hr>
                            <div class="d-flex justify-content-between">
                                <button class="btn btn-outline-secondary" id="backToDashboardBtn">
                                    Zurück zum Dashboard
                                </button>
                                <button class="btn btn-outline-info" id="viewExistingCodesBtn">
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

        document.getElementById('backToDashboardBtn').addEventListener('click', () => {
            this.showStudioDashboard();
        });

        document.getElementById('viewExistingCodesBtn').addEventListener('click', () => {
            this.showExistingActivationCodes(studioId);
        });
    }

    async handleActivationCodeGeneration(e, studioId) {
        e.preventDefault();
        
        const formData = {
            count: parseInt(document.getElementById('codeCountActivation').value),
            expiresInDays: parseInt(document.getElementById('expiresInDaysActivation').value)
        };
        
        const submitBtn = document.getElementById('generateActivationSubmitBtn');
        const errorDiv = document.getElementById('activationCodeError');
        const successDiv = document.getElementById('activationCodeSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generiere Codes...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch(`http://localhost:3001/api/v1/studios/${studioId}/activation-codes`, {
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
            
            // Reset form
            document.getElementById('activationCodeForm').reset();
            document.getElementById('codeCountActivation').value = 10;
            document.getElementById('expiresInDaysActivation').value = 365;
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Aktivierungscodes generieren';
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
                                Zurück zum Dashboard
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
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backFromCodesBtn').addEventListener('click', () => {
            this.showStudioDashboard();
        });

        this.loadExistingActivationCodes(studioId);
    }

    async loadExistingActivationCodes(studioId) {
        const codesDiv = document.getElementById('activationCodesList');
        
        try {
            const response = await fetch(`http://localhost:3001/api/v1/studios/${studioId}/activation-codes`, {
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
                                <div class="mb-3">
                                    <label for="managerCode" class="form-label">Manager Code</label>
                                    <input type="text" class="form-control" id="managerCode" required 
                                           placeholder="Code vom Manager erhalten">
                                    <div class="form-text">
                                        Dieser Code wird von einem Manager bereitgestellt
                                    </div>
                                </div>
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
                                    <label for="studioPhone" class="form-label">Telefon (optional)</label>
                                    <input type="tel" class="form-control" id="studioPhone">
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="studioRegisterSubmitBtn">Studio Registrieren</button>
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
        
        const formData = {
            managerCode: document.getElementById('managerCode').value,
            firstName: document.getElementById('studioFirstName').value,
            lastName: document.getElementById('studioLastName').value,
            email: document.getElementById('studioRegisterEmail').value,
            password: document.getElementById('studioRegisterPassword').value,
            phone: document.getElementById('studioPhone').value || '',
            role: 'studio_owner'
        };
        
        const submitBtn = document.getElementById('studioRegisterSubmitBtn');
        const errorDiv = document.getElementById('studioRegisterError');
        const successDiv = document.getElementById('studioRegisterSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registriere Studio...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            console.log('Registration data:', formData);
            const result = await window.authService.register(formData);
            this.currentUser = result.user;
            
            successDiv.textContent = 'Studio-Registrierung erfolgreich! Sie werden zum Studio-Setup weitergeleitet...';
            successDiv.classList.remove('d-none');
            
            setTimeout(() => {
                this.showStudioSetup();
            }, 2000);
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Studio Registrieren';
        }
    }

    showLoginModal() {
        // Generic login modal for header link
        this.showCustomerLogin();
    }

    showRegisterModal() {
        // Generic register modal for header link
        this.showCustomerRegister();
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
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Manager Dashboard</h4>
                            <div class="btn-group">
                                <button class="btn btn-primary" id="generateCodesBtn">Codes generieren</button>
                                <button class="btn btn-outline-secondary" id="viewStatsBtn">Statistiken</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="managerContent">
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="card bg-primary text-white">
                                            <div class="card-body">
                                                <h5>Willkommen, ${this.currentUser.firstName}!</h5>
                                                <p>Sie sind als Manager angemeldet.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-8">
                                        <div id="managerStats">
                                            <div class="text-center">
                                                <div class="spinner-border" role="status">
                                                    <span class="visually-hidden">Loading...</span>
                                                </div>
                                                <p class="mt-2">Lade Statistiken...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row mt-4">
                                    <div class="col-md-12">
                                        <div class="card">
                                            <div class="card-header d-flex justify-content-between align-items-center">
                                                <h5>Registrierte Studios</h5>
                                                <button class="btn btn-sm btn-outline-primary" id="refreshStudiosBtn">
                                                    Aktualisieren
                                                </button>
                                            </div>
                                            <div class="card-body">
                                                <div id="studiosList">
                                                    <div class="text-center">
                                                        <div class="spinner-border spinner-border-sm" role="status">
                                                            <span class="visually-hidden">Loading...</span>
                                                        </div>
                                                        <p class="mt-2">Lade Studios...</p>
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
            </div>
        `;

        document.getElementById('generateCodesBtn').addEventListener('click', () => {
            this.showCodeGenerationForm();
        });

        document.getElementById('viewStatsBtn').addEventListener('click', () => {
            this.loadManagerStats();
        });

        document.getElementById('refreshStudiosBtn').addEventListener('click', () => {
            this.loadManagerStudios();
        });

        // Load initial stats and studios
        this.loadManagerStats();
        this.loadManagerStudios();
    }

    async loadManagerStats() {
        const statsDiv = document.getElementById('managerStats');
        
        try {
            const response = await fetch('http://localhost:3001/api/v1/manager/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            
            const data = await response.json();
            const stats = data.statistics;
            
            statsDiv.innerHTML = `
                <div class="row">
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="card-title">${stats.codes.total}</h5>
                                <p class="card-text">Codes Gesamt</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="card-title">${stats.codes.used}</h5>
                                <p class="card-text">Codes Verwendet</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="card-title">${stats.studios.total}</h5>
                                <p class="card-text">Studios</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h5 class="card-title">${stats.cities.count}</h5>
                                <p class="card-text">Städte</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            statsDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden der Statistiken: ${error.message}
                </div>
            `;
        }
    }

    async loadManagerStudios() {
        const studiosDiv = document.getElementById('studiosList');
        
        try {
            const response = await fetch('http://localhost:3001/api/v1/manager/studios', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load studios');
            }
            
            const data = await response.json();
            const studios = data.studios;
            
            if (studios.length === 0) {
                studiosDiv.innerHTML = `
                    <div class="text-center text-muted">
                        <p>Noch keine Studios registriert.</p>
                        <small>Studios werden angezeigt, sobald Studio-Inhaber sich mit Manager-Codes registriert haben.</small>
                    </div>
                `;
            } else {
                studiosDiv.innerHTML = `
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Studio Name</th>
                                    <th>Inhaber</th>
                                    <th>Stadt</th>
                                    <th>Adresse</th>
                                    <th>Telefon</th>
                                    <th>Registriert</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${studios.map(studio => `
                                    <tr>
                                        <td><strong>${studio.name}</strong></td>
                                        <td>${studio.owner_first_name} ${studio.owner_last_name}<br>
                                            <small class="text-muted">${studio.owner_email}</small></td>
                                        <td>${studio.city || studio.intended_city}</td>
                                        <td>${studio.address}</td>
                                        <td>${studio.phone || '-'}</td>
                                        <td>${new Date(studio.created_at).toLocaleDateString('de-DE')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            
        } catch (error) {
            studiosDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden der Studios: ${error.message}
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
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5>Manager Code generieren</h5>
                            <button class="btn btn-sm btn-outline-secondary" id="backToDashboardBtn">
                                ← Zurück zum Dashboard
                            </button>
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

        document.getElementById('backToDashboardBtn').addEventListener('click', () => {
            this.showManagerDashboard();
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
            submitBtn.textContent = 'Generiere Codes...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch('http://localhost:3001/api/v1/manager/studio-owner-codes', {
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

    showStudioSetup() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Studio Setup</h4>
                            <button class="btn btn-outline-secondary" id="backToDashboardFromSetupBtn">
                                Zurück zum Dashboard
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="studioSetupError" class="alert alert-danger d-none"></div>
                            <div id="studioSetupSuccess" class="alert alert-success d-none"></div>
                            <div id="preFillInfo" class="alert alert-info">
                                <div class="spinner-border spinner-border-sm" role="status"></div>
                                Lade Vorab-Informationen...
                            </div>
                            <form id="studioSetupForm">
                                <div class="mb-3">
                                    <label for="studioName" class="form-label">Studio Name</label>
                                    <input type="text" class="form-control" id="studioName" required>
                                </div>
                                <div class="mb-3">
                                    <label for="studioCity" class="form-label">Stadt</label>
                                    <input type="text" class="form-control" id="studioCity" required>
                                </div>
                                <div class="mb-3">
                                    <label for="studioAddress" class="form-label">Adresse</label>
                                    <input type="text" class="form-control" id="studioAddress" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioSetupPhone" class="form-label">Telefon</label>
                                            <input type="tel" class="form-control" id="studioSetupPhone" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioSetupEmail" class="form-label">Studio E-Mail</label>
                                            <input type="email" class="form-control" id="studioSetupEmail" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="businessHours" class="form-label">Öffnungszeiten</label>
                                    <textarea class="form-control" id="businessHours" rows="3" 
                                              placeholder="Mo-Fr: 9:00-18:00, Sa: 10:00-16:00"></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="studioSetupSubmitBtn">Studio erstellen</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('studioSetupForm').addEventListener('submit', (e) => {
            this.handleStudioSetup(e);
        });
        document.getElementById('backToDashboardFromSetupBtn').addEventListener('click', () => {
            this.showStudioDashboard();
        });

        // Load pre-fill information
        this.loadStudioPreFillInfo();
    }

    async loadStudioPreFillInfo() {
        const preFillDiv = document.getElementById('preFillInfo');
        
        try {
            const response = await fetch('http://localhost:3001/api/v1/studios/prefill-info', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load pre-fill info');
            }
            
            const data = await response.json();
            const info = data.preFillInfo;
            
            // Pre-fill form fields
            document.getElementById('studioName').value = info.studioName || '';
            document.getElementById('studioCity').value = info.city || '';
            
            preFillDiv.innerHTML = `
                <strong>Vorab-Informationen geladen:</strong><br>
                Inhaber: ${info.ownerName}<br>
                Stadt: ${info.city}<br>
                ${info.studioName ? `Studio Name: ${info.studioName}` : ''}
            `;
            
        } catch (error) {
            preFillDiv.innerHTML = `
                <div class="alert alert-warning">
                    Vorab-Informationen konnten nicht geladen werden: ${error.message}
                </div>
            `;
        }
    }

    async handleStudioSetup(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('studioName').value,
            city: document.getElementById('studioCity').value,
            address: document.getElementById('studioAddress').value,
            phone: document.getElementById('studioSetupPhone').value,
            email: document.getElementById('studioSetupEmail').value,
            business_hours: document.getElementById('businessHours').value
        };
        
        const submitBtn = document.getElementById('studioSetupSubmitBtn');
        const errorDiv = document.getElementById('studioSetupError');
        const successDiv = document.getElementById('studioSetupSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Erstelle Studio...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch('http://localhost:3001/api/v1/studios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Erstellen des Studios');
            }
            
            const data = await response.json();
            
            successDiv.textContent = 'Studio erfolgreich erstellt! Sie werden zum Dashboard weitergeleitet...';
            successDiv.classList.remove('d-none');
            
            setTimeout(() => {
                this.showStudioDashboard();
            }, 2000);
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Studio erstellen';
        }
    }

    showAppointmentManagement(studioId) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Termine verwalten</h4>
                            <div class="btn-group">
                                <button class="btn btn-primary" id="createAppointmentBtn">
                                    Neuer Termin
                                </button>
                                <button class="btn btn-outline-secondary" id="backToStudioDashboardBtn">
                                    Zurück zum Dashboard
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <h6>Kalender</h6>
                                            <div class="btn-group btn-group-sm">
                                                <button class="btn btn-outline-primary" id="prevMonthBtn">‹</button>
                                                <button class="btn btn-outline-primary" id="nextMonthBtn">›</button>
                                            </div>
                                        </div>
                                        <div class="card-body">
                                            <div id="monthYearDisplay" class="text-center mb-3">
                                                <strong>Januar 2025</strong>
                                            </div>
                                            <div id="calendarGrid">
                                                <!-- Calendar will be generated here -->
                                            </div>
                                            <div class="mt-3">
                                                <div class="mb-2">
                                                    <label class="form-label">Status Filter</label>
                                                    <select class="form-select form-select-sm" id="appointmentStatusFilter">
                                                        <option value="">Alle</option>
                                                        <option value="pending">Ausstehend</option>
                                                        <option value="confirmed">Bestätigt</option>
                                                        <option value="cancelled">Abgesagt</option>
                                                        <option value="completed">Abgeschlossen</option>
                                                        <option value="no_show">Nicht erschienen</option>
                                                    </select>
                                                </div>
                                                <button class="btn btn-outline-primary btn-sm w-100" id="filterAppointmentsBtn">
                                                    Filter anwenden
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 id="selectedDateHeader">Termine für heute</h6>
                                        </div>
                                        <div class="card-body">
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Set current studio ID and reset dates
        this.currentStudioId = studioId;
        this.selectedDate = new Date(); // Reset to today when opening appointment management

        // Event listeners
        document.getElementById('createAppointmentBtn').addEventListener('click', () => {
            this.showCreateAppointmentForm(studioId);
        });

        document.getElementById('backToStudioDashboardBtn').addEventListener('click', () => {
            this.showStudioDashboard();
        });

        document.getElementById('filterAppointmentsBtn').addEventListener('click', () => {
            this.loadAppointments(studioId);
        });

        document.getElementById('prevMonthBtn').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('nextMonthBtn').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

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
        }, 100);
    }

    async loadAppointments(studioId) {
        if (!studioId) {
            console.warn('No studio ID provided to loadAppointments');
            return;
        }
        
        const appointmentsDiv = document.getElementById('appointmentsList');
        const statusFilter = document.getElementById('appointmentStatusFilter')?.value || '';
        
        // Use selectedDate if available, otherwise use today's date
        const selectedDate = this.selectedDate || new Date();
        // Fix: Use local date formatting for consistency
        const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        
        try {
            let url = `http://localhost:3001/api/v1/appointments/studio/${studioId}`;
            const params = new URLSearchParams();
            params.append('date', selectedDateStr);
            if (statusFilter) params.append('status', statusFilter);
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
            
            // Update the header with selected date
            const selectedDateDisplayStr = selectedDate.toLocaleDateString('de-DE', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const headerElement = document.getElementById('selectedDateHeader');
            if (headerElement) {
                headerElement.textContent = `Termine für ${selectedDateDisplayStr}`;
            }
            
            if (appointments.length === 0) {
                appointmentsDiv.innerHTML = `
                    <div class="text-center text-muted">
                        <p>Keine Termine für diesen Tag.</p>
                        <button class="btn btn-primary" id="createAppointmentForDateBtn">
                            Termin für ${selectedDate.toLocaleDateString('de-DE')} erstellen
                        </button>
                    </div>
                `;
                
                document.getElementById('createAppointmentForDateBtn').addEventListener('click', () => {
                    this.showCreateAppointmentForm(studioId, selectedDate);
                });
            } else {
                // Create timeline view with colored appointment blocks
                appointmentsDiv.innerHTML = this.renderTimelineView(appointments, selectedDate);
            }
            
        } catch (error) {
            appointmentsDiv.innerHTML = `
                <div class="alert alert-danger">
                    Fehler beim Laden der Termine: ${error.message}
                </div>
            `;
        }
    }

    getStatusBadgeClass(status) {
        const classes = {
            'pending': 'bg-warning',
            'confirmed': 'bg-success',
            'cancelled': 'bg-danger',
            'completed': 'bg-info',
            'no_show': 'bg-secondary'
        };
        return classes[status] || 'bg-secondary';
    }

    getStatusText(status) {
        const texts = {
            'pending': 'Ausstehend',
            'confirmed': 'Bestätigt',
            'cancelled': 'Abgesagt',
            'completed': 'Abgeschlossen',
            'no_show': 'Nicht erschienen'
        };
        return texts[status] || status;
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
                'pending': '#ffc107',
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
                     title="Klicken zum Bearbeiten">
                    <div style="font-weight: bold; margin-bottom: 2px;">
                        ${appointment.customer_first_name} ${appointment.customer_last_name}
                    </div>
                    <div style="font-size: 10px; opacity: 0.9;">
                        ${startTime} - ${endTime}
                    </div>
                    <div style="font-size: 10px; opacity: 0.8;">
                        ${appointment.appointment_type_name || 'Abnehmen Behandlung'}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        html += `</div>`;
        
        // Add legend
        html += `
            <div class="mt-3">
                <h6>Status-Legende:</h6>
                <div class="d-flex flex-wrap gap-3">
                    <span class="badge" style="background: #ffc107; color: black;">Ausstehend</span>
                    <span class="badge" style="background: #28a745;">Bestätigt</span>
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
                'pending': '#ffc107',
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
                     title="Klicken für Details">
                    <div style="font-weight: bold; margin-bottom: 2px;">
                        ${appointment.appointment_type_name || 'Abnehmen Behandlung'}
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
            <div class="mt-3">
                <h6>Status-Legende:</h6>
                <div class="d-flex flex-wrap gap-3">
                    <span class="badge" style="background: #ffc107; color: black;">Ausstehend</span>
                    <span class="badge" style="background: #28a745;">Bestätigt</span>
                    <span class="badge" style="background: #17a2b8;">Abgeschlossen</span>
                    <span class="badge" style="background: #dc3545;">Abgesagt</span>
                    <span class="badge" style="background: #6c757d;">Nicht erschienen</span>
                </div>
            </div>
        `;
        
        return html;
    }

    showCreateAppointmentForm(studioId, preselectedDate = null) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Neuen Termin erstellen</h4>
                            <button class="btn btn-outline-secondary" id="backToAppointmentsBtn">
                                Zurück zu Terminen
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="createAppointmentError" class="alert alert-danger d-none"></div>
                            <div id="createAppointmentSuccess" class="alert alert-success d-none"></div>
                            <form id="createAppointmentForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="appointmentDate" class="form-label">Datum *</label>
                                            <input type="date" class="form-control" id="appointmentDate" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="appointmentStartTime" class="form-label">Start Zeit *</label>
                                            <input type="time" class="form-control" id="appointmentStartTime" required>
                                            <div class="form-text">Dauer: 60 Minuten (automatisch berechnet)</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="customerId" class="form-label">Kunde *</label>
                                    <select class="form-select" id="customerId" required>
                                        <option value="">Kunde auswählen...</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="appointmentTypeId" class="form-label">Termin Typ</label>
                                    <select class="form-select" id="appointmentTypeId" required>
                                        <option value="">Typ auswählen...</option>
                                    </select>
                                    <div class="form-text">Standard: Abnehmen Behandlung (60 Min)</div>
                                </div>
                                <div class="mb-3">
                                    <label for="appointmentNotes" class="form-label">Notizen</label>
                                    <textarea class="form-control" id="appointmentNotes" rows="3"></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary w-100" id="createAppointmentSubmitBtn">
                                    Termin erstellen
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Set default date to preselected date or today
        const defaultDate = preselectedDate ? preselectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('appointmentDate').value = defaultDate;

        // Event listeners
        document.getElementById('backToAppointmentsBtn').addEventListener('click', () => {
            this.showAppointmentManagement(studioId);
        });

        document.getElementById('createAppointmentForm').addEventListener('submit', (e) => {
            this.handleCreateAppointment(e, studioId);
        });

        // Load customers and appointment types
        this.loadCustomers(studioId);
        this.loadAppointmentTypes(studioId);
    }

    async loadCustomers(studioId) {
        const customerSelect = document.getElementById('customerId');
        
        try {
            const response = await fetch(`http://localhost:3001/api/v1/studios/${studioId}/customers`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load customers');
            }
            
            const data = await response.json();
            const customers = data.customers || [];
            
            customerSelect.innerHTML = '<option value="">Kunde auswählen...</option>';
            customers.forEach(customer => {
                customerSelect.innerHTML += `
                    <option value="${customer.id}">
                        ${customer.first_name} ${customer.last_name} (${customer.email})
                    </option>
                `;
            });
            
        } catch (error) {
            customerSelect.innerHTML = '<option value="">Fehler beim Laden der Kunden</option>';
        }
    }

    async loadAppointmentTypes(studioId) {
        const typeSelect = document.getElementById('appointmentTypeId');
        
        try {
            const response = await fetch(`http://localhost:3001/api/v1/appointments/studio/${studioId}/appointment-types`, {
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
                const selected = type.name === 'Abnehmen Behandlung' ? 'selected' : '';
                typeSelect.innerHTML += `
                    <option value="${type.id}" ${selected}>
                        ${type.name} (${type.duration} Min)
                    </option>
                `;
                
                if (type.name === 'Abnehmen Behandlung') {
                    abnehmenType = type;
                }
            });
            
            // Auto-select the first "Abnehmen Behandlung" type if found
            if (abnehmenType) {
                typeSelect.value = abnehmenType.id;
            }
            
        } catch (error) {
            typeSelect.innerHTML = '<option value="">Fehler beim Laden der Typen</option>';
        }
    }

    async handleCreateAppointment(e, studioId) {
        e.preventDefault();
        
        // Calculate end time (start time + 60 minutes)
        const startTime = document.getElementById('appointmentStartTime').value;
        const endTime = this.calculateEndTime(startTime, 60);
        
        const formData = {
            studio_id: studioId,
            customer_id: parseInt(document.getElementById('customerId').value),
            appointment_type_id: parseInt(document.getElementById('appointmentTypeId').value),
            appointment_date: document.getElementById('appointmentDate').value,
            start_time: startTime,
            end_time: endTime,
            notes: document.getElementById('appointmentNotes').value
        };
        
        const submitBtn = document.getElementById('createAppointmentSubmitBtn');
        const errorDiv = document.getElementById('createAppointmentError');
        const successDiv = document.getElementById('createAppointmentSuccess');
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Erstelle Termin...';
            errorDiv.classList.add('d-none');
            successDiv.classList.add('d-none');
            
            const response = await fetch('http://localhost:3001/api/v1/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Erstellen des Termins');
            }
            
            const data = await response.json();
            
            successDiv.textContent = 'Termin erfolgreich erstellt!';
            successDiv.classList.remove('d-none');
            
            // Reset form
            document.getElementById('createAppointmentForm').reset();
            document.getElementById('appointmentDate').value = new Date().toISOString().split('T')[0];
            
            // Redirect after success
            setTimeout(() => {
                this.showAppointmentManagement(studioId);
            }, 2000);
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Termin erstellen';
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
            const response = await fetch(`http://localhost:3001/api/v1/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Aktualisieren des Status');
            }
            
            // Reload the current appointments view
            const appointmentsList = document.getElementById('appointmentsList');
            if (appointmentsList) {
                // Find the studio ID from the current context
                const studioResponse = await fetch('http://localhost:3001/api/v1/studios/my-studio', {
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

    editAppointment(appointmentId) {
        // TODO: Implement edit functionality
        alert('Edit functionality coming soon!');
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
            const response = await fetch(`http://localhost:3001/api/v1/appointments/studio/${studioId}?date=${today}`, {
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
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Kunden Übersicht</h4>
                            <button class="btn btn-outline-secondary" id="backToStudioDashboardFromCustomersBtn">
                                Zurück zum Dashboard
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6>Kundenliste</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="customersList">
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
                                            <h6>Kunden Termine</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="customerAppointments">
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
        document.getElementById('backToStudioDashboardFromCustomersBtn').addEventListener('click', () => {
            this.showStudioDashboard();
        });

        // Load customers
        this.loadCustomersList(studioId);
    }

    async loadCustomersList(studioId) {
        const customersDiv = document.getElementById('customersList');
        
        try {
            const response = await fetch(`http://localhost:3001/api/v1/studios/${studioId}/customers`, {
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
                                    <h6 class="mb-1">${customer.first_name} ${customer.last_name}</h6>
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
                        this.loadCustomerAppointments(customerId, customerName);
                        
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

    async loadCustomerAppointments(customerId, customerName) {
        const appointmentsDiv = document.getElementById('customerAppointments');
        
        if (!appointmentsDiv) {
            console.error('customerAppointments element not found - this function should only be called in studio view');
            return;
        }
        
        try {
            const response = await fetch(`http://localhost:3001/api/v1/appointments/customer/${customerId}`, {
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
                                    <small>Abnehmen Behandlung</small>
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
                                    <small>Abnehmen Behandlung</small>
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

    showSessionManagement(studioId) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h4>Behandlungen verwalten</h4>
                            <button class="btn btn-outline-secondary" id="backToStudioDashboardFromSessionsBtn">
                                Zurück zum Dashboard
                            </button>
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
        document.getElementById('backToStudioDashboardFromSessionsBtn').addEventListener('click', () => {
            this.showStudioDashboard();
        });

        // Store studio ID for use in other functions
        this.currentStudioId = studioId;
        
        // Load customers with sessions
        this.loadSessionCustomersList(studioId);
    }

    async loadSessionCustomersList(studioId) {
        const customersDiv = document.getElementById('sessionCustomersList');
        
        try {
            const response = await fetch(`http://localhost:3001/api/v1/studios/${studioId}/customers/sessions`, {
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
                            <h6 class="mb-1">${customer.first_name} ${customer.last_name}</h6>
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
            
            const response = await fetch(`http://localhost:3001/api/v1/customers/${customerId}/sessions`, {
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
            if (!customer || !customer.first_name) {
                console.error('Invalid customer data:', data);
                throw new Error('Kundendaten konnten nicht geladen werden');
            }
            
            detailsDiv.innerHTML = `
                <div class="mb-4">
                    <h5>${customer.first_name} ${customer.last_name}</h5>
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
                                            <button class="btn btn-outline-primary btn-sm me-1" 
                                                    onclick="window.app.showEditSessionModal(${session.id}, ${session.remaining_sessions}, '${session.notes || ''}')">
                                                <i class="fas fa-edit"></i>
                                            </button>
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
            
            const response = await fetch(`http://localhost:3001/api/v1/customers/${customerId}/sessions/topup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount,
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

    showEditSessionModal(sessionId, currentRemaining, currentNotes) {
        const modalHTML = `
            <div class="modal fade" id="editSessionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Behandlungspaket bearbeiten</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="editRemainingTreatments" class="form-label">Verbleibende Behandlungen</label>
                                <input type="number" class="form-control" id="editRemainingTreatments" 
                                       value="${currentRemaining}" min="0" max="50">
                                <div class="form-text">Aktuelle Anzahl der verbleibenden Behandlungen.</div>
                            </div>
                            <div class="mb-3">
                                <label for="editSessionNotes" class="form-label">Notizen</label>
                                <textarea class="form-control" id="editSessionNotes" rows="3">${currentNotes}</textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" id="confirmEditBtn">
                                <i class="fas fa-save"></i> Änderungen speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('editSessionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up event listener
        document.getElementById('confirmEditBtn').addEventListener('click', () => {
            this.performSessionEdit(sessionId, currentRemaining);
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editSessionModal'));
        modal.show();
    }

    async performSessionEdit(sessionId, originalRemaining) {
        const confirmBtn = document.getElementById('confirmEditBtn');
        const newRemaining = parseInt(document.getElementById('editRemainingTreatments').value);
        const newNotes = document.getElementById('editSessionNotes').value;
        
        try {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Wird gespeichert...';
            
            // Calculate the difference to determine if we're adding or removing treatments
            const difference = newRemaining - originalRemaining;
            
            const response = await fetch(`http://localhost:3001/api/v1/sessions/${sessionId}/edit`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    remaining_sessions: newRemaining,
                    notes: newNotes,
                    adjustment_amount: difference
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update session');
            }
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editSessionModal'));
            modal.hide();
            
            // Refresh the view
            const currentCustomerId = this.currentCustomerId; // We need to store this
            if (currentCustomerId) {
                this.loadCustomerSessionDetails(currentCustomerId);
                this.loadSessionCustomersList(this.currentStudioId);
            }
            
            // Show success message
            this.showSuccessMessage('Erfolgreich', 'Behandlungspaket wurde erfolgreich aktualisiert.');
            
        } catch (error) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-save"></i> Änderungen speichern';
            this.showErrorMessage('Fehler', 'Fehler beim Aktualisieren: ' + error.message);
        }
    }

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
            
            const response = await fetch(`http://localhost:3001/api/v1/sessions/${sessionId}/deactivate`, {
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
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        
        const monthYearDisplay = document.getElementById('monthYearDisplay');
        const calendarGrid = document.getElementById('calendarGrid');
        
        if (!monthYearDisplay || !calendarGrid) return;
        
        // Update month/year display
        monthYearDisplay.innerHTML = `<strong>${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}</strong>`;
        
        // Calculate first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
        
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
                const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1 - firstDay.getDay() + daysFromStart);
                
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

    async loadMonthlyAppointmentIndicators() {
        if (!this.currentStudioId || !this.currentDate) return;
        
        try {
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
            
            // Fix: Use local date formatting for consistency
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            const response = await fetch(`http://localhost:3001/api/v1/appointments/studio/${this.currentStudioId}?from_date=${startDateStr}&to_date=${endDateStr}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
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
            
            // Update calendar indicators
            Object.keys(appointmentsByDate).forEach(date => {
                const dayElement = document.getElementById(`day-${date}`);
                if (dayElement) {
                    const count = appointmentsByDate[date].length;
                    dayElement.innerHTML = `<div style="width: 12px; height: 12px; background-color: #7030a0; border-radius: 50%; margin: 0 auto;"></div>`;
                }
            });
            
        } catch (error) {
            console.error('Error loading monthly appointments:', error);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.isInitialized = true;
});