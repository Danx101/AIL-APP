// Main application initialization
const API_BASE_URL = 'http://localhost:3001';

class App {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAPIStatus();
    }

    setupEventListeners() {
        // Navigation event listeners
        document.getElementById('customerLoginBtn')?.addEventListener('click', () => {
            this.showCustomerLogin();
        });

        document.getElementById('studioLoginBtn')?.addEventListener('click', () => {
            this.showStudioLogin();
        });

        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.showLoginModal();
        });

        document.getElementById('registerBtn')?.addEventListener('click', () => {
            this.showRegisterModal();
        });
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
                            <form id="customerLoginForm">
                                <div class="mb-3">
                                    <label for="email" class="form-label">E-Mail</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Login</button>
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

        document.getElementById('showRegisterLink')?.addEventListener('click', () => {
            this.showCustomerRegister();
        });
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
                            <form id="studioLoginForm">
                                <div class="mb-3">
                                    <label for="studioEmail" class="form-label">Studio E-Mail</label>
                                    <input type="email" class="form-control" id="studioEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label for="studioPassword" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="studioPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Login</button>
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

        document.getElementById('showStudioRegisterLink')?.addEventListener('click', () => {
            this.showStudioRegister();
        });
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
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Registrieren</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
                            <form id="studioRegisterForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioName" class="form-label">Studio Name</label>
                                            <input type="text" class="form-control" id="studioName" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="ownerName" class="form-label">Inhaber Name</label>
                                            <input type="text" class="form-control" id="ownerName" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="studioAddress" class="form-label">Adresse</label>
                                    <input type="text" class="form-control" id="studioAddress" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioPhone" class="form-label">Telefon</label>
                                            <input type="tel" class="form-control" id="studioPhone" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="studioRegisterEmail" class="form-label">E-Mail</label>
                                            <input type="email" class="form-control" id="studioRegisterEmail" required>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="studioRegisterPassword" class="form-label">Passwort</label>
                                    <input type="password" class="form-control" id="studioRegisterPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Studio Registrieren</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showLoginModal() {
        // Generic login modal for header link
        this.showCustomerLogin();
    }

    showRegisterModal() {
        // Generic register modal for header link
        this.showCustomerRegister();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});