// Global Inbox Component for Notifications
class Inbox {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.studioId = null;
        this.isOpen = false;
        this.pollingInterval = null;
        this.init();
    }

    async init() {
        this.createInboxButton();
        this.createInboxDrawer();
        
        // Try to get studio ID and initialize if available
        this.tryInitializeWithStudio();
    }

    async tryInitializeWithStudio() {
        // Get studio ID from current user context
        this.studioId = window.currentUser?.studioId || this.getStudioIdFromURL() || window.app?.currentStudioId;
        
        if (this.studioId && this.studioId !== 'undefined') {
            await this.loadUnreadCount();
            this.startPolling();
        } else {
            // Retry in 2 seconds if no studio ID
            setTimeout(() => this.tryInitializeWithStudio(), 2000);
        }
    }

    getStudioIdFromURL() {
        // Try to extract studio ID from URL or other context
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('studio_id') || localStorage.getItem('currentStudioId');
    }

    createInboxButton() {
        // Create a floating inbox button that appears on all pages
        const existingButton = document.getElementById('global-inbox-btn');
        if (existingButton) existingButton.remove();

        const button = document.createElement('button');
        button.id = 'global-inbox-btn';
        button.className = 'btn btn-primary position-fixed';
        button.style.cssText = `
            bottom: 20px;
            right: 20px;
            z-index: 1050;
            border-radius: 50px;
            width: 60px;
            height: 60px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            overflow: visible;
        `;
        button.innerHTML = `
            <div style="position: relative; display: inline-block; overflow: visible;">
                <i class="bi bi-inbox fs-5"></i>
                <span id="global-inbox-badge" style="position: absolute; top: -18px; right: -18px; background: #dc3545; color: white; border-radius: 50%; width: 20px; height: 20px; display: none; justify-content: center; align-items: center; font-size: 0.75rem; font-weight: bold; z-index: 1060; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    0
                </span>
            </div>
        `;
        button.onclick = () => this.toggleDrawer();
        
        document.body.appendChild(button);
    }

    createInboxDrawer() {
        const existingDrawer = document.getElementById('inboxDrawer');
        if (existingDrawer) existingDrawer.remove();

        const drawer = document.createElement('div');
        drawer.innerHTML = `
            <!-- Overlay -->
            <div id="inboxOverlay" class="inbox-overlay" style="display: none;" onclick="inbox.closeDrawer()"></div>
            
            <!-- Drawer -->
            <div id="inboxDrawer" class="inbox-drawer">
                <div class="inbox-header">
                    <h5 class="mb-0">
                        <i class="bi bi-inbox me-2"></i>
                        Benachrichtigungen
                        <span class="badge bg-primary ms-2" id="drawer-unread-count">0</span>
                    </h5>
                    <button type="button" class="btn-close" onclick="inbox.closeDrawer()"></button>
                </div>
                
                <div class="inbox-actions">
                    <div class="d-flex justify-content-end">
                        <button class="btn btn-outline-dark btn-sm" onclick="inbox.clearInbox()">
                            <i class="bi bi-trash me-1"></i>
                            Inbox leeren
                        </button>
                    </div>
                </div>
                
                <div class="inbox-content" id="notifications-list">
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Laden...</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .inbox-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1040;
                    transition: opacity 0.3s ease;
                }
                
                .inbox-drawer {
                    position: fixed;
                    top: 0;
                    right: -400px;
                    width: 400px;
                    height: 100%;
                    background: white;
                    z-index: 1045;
                    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
                    transition: right 0.3s ease;
                    display: flex;
                    flex-direction: column;
                }
                
                .inbox-drawer.open {
                    right: 0;
                }
                
                .inbox-header {
                    padding: 20px;
                    border-bottom: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .inbox-actions {
                    padding: 15px 20px;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .inbox-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                
                .notification-arrow {
                    transition: transform 0.2s ease;
                }
                
                .notification-details {
                    transition: all 0.3s ease;
                    overflow: hidden;
                }
                
                .lead-item:last-child {
                    border-bottom: none !important;
                }
                
                @media (max-width: 768px) {
                    .inbox-drawer {
                        width: 100%;
                        right: -100%;
                    }
                }
            </style>
        `;
        
        document.body.appendChild(drawer);
    }

    async loadUnreadCount() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/notifications/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateUnreadCount(data.unreadCount);
            } else {
            }
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    }

    async loadNotifications(unreadOnly = false) {
        try {
            const token = localStorage.getItem('authToken');
            const params = new URLSearchParams({ 
                limit: 50,
                unread_only: unreadOnly 
            });
            
            const response = await fetch(`${window.API_BASE_URL}/api/v1/notifications/studio/${this.studioId}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.notifications;
                this.unreadCount = data.unreadCount;
                this.updateUnreadCount(this.unreadCount);
                this.renderNotifications();
            } else {
                throw new Error('Failed to load notifications');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.renderError();
        }
    }

    updateUnreadCount(count) {
        this.unreadCount = count;
        
        const globalBadge = document.getElementById('global-inbox-badge');
        const drawerBadge = document.getElementById('drawer-unread-count');
        
        
        if (count > 0) {
            if (globalBadge) {
                globalBadge.textContent = count;
                globalBadge.style.display = 'flex';
            } else {
            }
            if (drawerBadge) {
                drawerBadge.textContent = count;
            }
        } else {
            if (globalBadge) {
                globalBadge.style.display = 'none';
            }
            if (drawerBadge) {
                drawerBadge.textContent = '0';
            }
        }
    }

    renderNotifications() {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-inbox display-1 text-muted"></i>
                    <h5 class="text-muted mt-2">Keine Benachrichtigungen</h5>
                    <p class="text-muted">Du bist auf dem neuesten Stand!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.notifications.map(notification => `
            <div class="notification-item border-bottom py-3 ${notification.is_read ? '' : 'bg-light'}" data-id="${notification.id}">
                <div class="d-flex">
                    <div class="flex-shrink-0 me-3">
                        <i class="bi ${this.getNotificationIcon(notification.type)} fs-4 ${this.getNotificationColor(notification.type)}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="mb-1 ${notification.is_read ? 'text-muted' : 'fw-bold'}">${notification.title}</h6>
                                <p class="mb-1 text-muted small">${notification.message}</p>
                                <small class="text-muted">${new Date(notification.created_at).toLocaleString('de-DE')}</small>
                            </div>
                            ${this.hasExpandableContent(notification) ? `
                                <button class="btn btn-link btn-sm text-muted p-1" onclick="inbox.toggleNotificationDetails(${notification.id})" title="Details anzeigen">
                                    <i class="bi bi-chevron-left notification-arrow" id="arrow-${notification.id}"></i>
                                </button>
                            ` : ''}
                        </div>
                        ${this.hasExpandableContent(notification) ? `
                            <div class="notification-details mt-2" id="details-${notification.id}" style="display: none;">
                                ${this.renderNotificationDetails(notification)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderError() {
        const container = document.getElementById('notifications-list');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-exclamation-triangle display-1 text-warning"></i>
                    <h5 class="text-muted mt-2">Fehler beim Laden</h5>
                    <p class="text-muted">Die Benachrichtigungen konnten nicht geladen werden.</p>
                    <button class="btn btn-outline-primary" onclick="inbox.loadNotifications()">
                        Erneut versuchen
                    </button>
                </div>
            `;
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'google_sheets_import': 'bi-envelope',
            'system': 'bi-gear',
            'warning': 'bi-exclamation-triangle',
            'success': 'bi-check-circle',
            'error': 'bi-x-circle',
            'welcome': 'bi-hand-wave'
        };
        return icons[type] || 'bi-bell';
    }

    getNotificationColor(type) {
        const colors = {
            'google_sheets_import': 'text-success',
            'system': 'text-primary',
            'warning': 'text-warning',
            'success': 'text-success',
            'error': 'text-danger',
            'welcome': 'text-success'
        };
        return colors[type] || 'text-primary';
    }

    hasExpandableContent(notification) {
        return notification.type === 'google_sheets_import' && 
               notification.metadata && 
               notification.metadata.leadDetails && 
               notification.metadata.leadDetails.length > 0;
    }

    renderNotificationDetails(notification) {
        if (!this.hasExpandableContent(notification)) {
            return '';
        }

        const leadDetails = notification.metadata.leadDetails;
        return `
            <div class="bg-light rounded p-3">
                <h6 class="mb-2 text-primary">Neue Leads:</h6>
                <div class="lead-details">
                    ${leadDetails.map(lead => `
                        <div class="lead-item d-flex justify-content-between align-items-center py-2 border-bottom border-light">
                            <div>
                                <strong>${lead.name || 'Unbekannt'}</strong>
                                <div class="small text-muted">
                                    <i class="bi bi-telephone me-1"></i>${lead.phone_number || 'Keine Telefonnummer'}
                                    ${lead.email ? `<br><i class="bi bi-envelope me-1"></i>${lead.email}` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    toggleNotificationDetails(notificationId) {
        
        const detailsElement = document.getElementById(`details-${notificationId}`);
        const arrowElement = document.getElementById(`arrow-${notificationId}`);
        
        
        if (!detailsElement || !arrowElement) {
            return;
        }
        
        const isExpanded = detailsElement.style.display !== 'none';
        
        if (isExpanded) {
            // Collapse
            detailsElement.style.display = 'none';
            arrowElement.className = 'bi bi-chevron-left notification-arrow';
        } else {
            // Expand
            detailsElement.style.display = 'block';
            arrowElement.className = 'bi bi-chevron-down notification-arrow';
            
            // Mark as read when expanding details
            const notification = this.notifications.find(n => n.id === notificationId);
            
            if (notification && (!notification.is_read || notification.is_read === 0)) {
                this.markAsRead(notificationId);
            } else {
            }
        }
    }

    async toggleDrawer() {
        if (this.isOpen) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }

    async openDrawer() {
        // Try to get studio ID if we don't have one
        if (!this.studioId) {
            this.studioId = window.currentUser?.studioId || window.app?.currentStudioId;
        }
        
        if (!this.studioId) {
            console.error('No studio ID available for inbox');
            return;
        }

        this.isOpen = true;
        
        // Show overlay and drawer
        const overlay = document.getElementById('inboxOverlay');
        const drawer = document.getElementById('inboxDrawer');
        
        if (overlay) overlay.style.display = 'block';
        if (drawer) drawer.classList.add('open');
        
        // Load notifications
        await this.loadNotifications();
        
        // Automatically mark all visible notifications as read when opening drawer
        await this.markAllVisibleAsRead();
    }

    // Method to reinitialize when studio becomes available
    reinitializeWithStudio(studioId) {
        if (studioId && studioId !== 'undefined') {
            this.studioId = studioId;
            this.loadUnreadCount();
            if (!this.pollingInterval) {
                this.startPolling();
            }
        }
    }

    closeDrawer() {
        this.isOpen = false;
        
        const overlay = document.getElementById('inboxOverlay');
        const drawer = document.getElementById('inboxDrawer');
        
        if (overlay) overlay.style.display = 'none';
        if (drawer) drawer.classList.remove('open');
    }

    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Update local state
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.is_read = true;
                }
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateUnreadCount(this.unreadCount);
                this.renderNotifications();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllVisibleAsRead() {
        try {
            // Find all unread notifications in current view
            const unreadNotifications = this.notifications.filter(n => !n.is_read);
            
            if (unreadNotifications.length === 0) {
                return;
            }

            // Mark each unread notification as read
            const token = localStorage.getItem('authToken');
            const markAsReadPromises = unreadNotifications.map(notification => 
                fetch(`${window.API_BASE_URL}/api/v1/notifications/${notification.id}/read`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
            );

            const results = await Promise.all(markAsReadPromises);
            const successfulMarks = results.filter(response => response.ok).length;

            if (successfulMarks > 0) {
                // Update local state for all notifications
                this.notifications.forEach(notification => {
                    if (!notification.is_read) {
                        notification.is_read = true;
                    }
                });
                
                // Update unread count
                this.unreadCount = Math.max(0, this.unreadCount - successfulMarks);
                this.updateUnreadCount(this.unreadCount);
                this.renderNotifications();
                
            }
        } catch (error) {
            console.error('Error marking all visible notifications as read:', error);
        }
    }

    async clearInbox() {
        if (!confirm('Möchten Sie wirklich alle Benachrichtigungen löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/api/v1/notifications/studio/${this.studioId}/clear`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Clear local state
                this.notifications = [];
                this.unreadCount = 0;
                this.updateUnreadCount(0);
                this.renderNotifications();
            } else {
                alert('Fehler beim Leeren der Inbox. Bitte versuchen Sie es erneut.');
            }
        } catch (error) {
            console.error('Error clearing inbox:', error);
            alert('Fehler beim Leeren der Inbox. Bitte versuchen Sie es erneut.');
        }
    }



    startPolling() {
        // Poll for new notifications every 30 seconds
        this.pollingInterval = setInterval(() => {
            this.loadUnreadCount();
        }, 30000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    destroy() {
        this.stopPolling();
        const button = document.getElementById('global-inbox-btn');
        if (button) button.remove();
        
        const drawer = document.getElementById('inboxDrawer');
        if (drawer) drawer.remove();
        
        const overlay = document.getElementById('inboxOverlay');
        if (overlay) overlay.remove();
    }
}

// Global instance
window.inbox = new Inbox();
