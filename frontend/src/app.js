// Main application initialization
const API_BASE_URL = 'http://localhost:3001';

class App {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkAPIStatus();
        await this.checkAuthStatus();
    }

    async checkAuthStatus() {
        if (window.authService && window.authService.isAuthenticated()) {
            try {
                await window.authService.validateToken();
                this.currentUser = window.authService.getCurrentUser();
                this.updateUIForAuthenticatedUser();
            } catch (error) {
                console.error('Token validation failed:', error);
                this.currentUser = null;
                this.updateUIForGuestUser();
            }
        } else {
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

    showWelcomePage() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="card">
                        <div class="card-header">
                            <h3>Willkommen bei Abnehmen im Liegen</h3>
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
        // Navigation event listeners - These will be set up after DOM elements are created
        // Initial event listeners will be set up in the respective show methods
    }

    async checkAPIStatus() {
        const statusElement = document.getElementById('apiStatus');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/status`);
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
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    showStudioLogin() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6 mx-auto">
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

    showCustomerDashboard() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-10 mx-auto">
                    <div class="card">
                        <div class="card-header">
                            <h4>Kunden Dashboard</h4>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h5>Willkommen, ${this.currentUser.firstName}!</h5>
                                    <p>Sie sind erfolgreich angemeldet als Kunde.</p>
                                    <p><strong>Email:</strong> ${this.currentUser.email}</p>
                                    <p><strong>Name:</strong> ${this.currentUser.firstName} ${this.currentUser.lastName}</p>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-body">
                                            <h6>Nächste Schritte:</h6>
                                            <ul>
                                                <li>Termine buchen</li>
                                                <li>Terminhistorie ansehen</li>
                                                <li>Profil bearbeiten</li>
                                            </ul>
                                            <p class="text-muted">Diese Funktionen werden in Phase 2 implementiert.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
                                <button class="btn btn-primary btn-sm" id="generateActivationCodesBtn">
                                    Aktivierungscodes generieren
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.getElementById('generateActivationCodesBtn').addEventListener('click', () => {
                    this.showActivationCodeGeneration(studio.id);
                });
                
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
            phone: document.getElementById('studioPhone').value,
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

        // Load initial stats
        this.loadManagerStats();
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
                        <div class="card-header">
                            <h4>Studio Setup</h4>
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});