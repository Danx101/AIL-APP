# Technical Cheat Sheet - Abnehmen im Liegen Backend
*Keep this file updated with current configuration and architecture*

## Environment Configuration

### Current Production Environment (Railway)
```bash
NODE_ENV=production
PORT=3001
DB_HOST=hopper.proxy.rlwy.net
DB_PORT=34671
DB_USER=root
DB_PASSWORD=bbrlhmlgPbZdyKSrAeRepjooYRiSayER
DB_NAME=railway
JWT_SECRET=abnehmen-im-liegen-jwt-secret-2025-secure-key
JWT_EXPIRES_IN=24h
FRONTEND_URL=https://ail-app.vercel.app
```

### Railway MySQL Variables (Auto-provided)
```bash
MYSQL_DATABASE=railway
MYSQL_PUBLIC_URL=mysql://root:bbrlhmlgPbZdyKSrAeRepjooYRiSayER@hopper.proxy.rlwy.net:34671/railway
MYSQL_ROOT_PASSWORD=bbrlhmlgPbZdyKSrAeRepjooYRiSayER
MYSQL_URL=mysql://root:bbrlhmlgPbZdyKSrAeRepjooYRiSayER@mysql.railway.internal:3306/railway
MYSQLHOST=hopper.proxy.rlwy.net
MYSQLPASSWORD=bbrlhmlgPbZdyKSrAeRepjooYRiSayER
MYSQLPORT=34671
MYSQLUSER=root
```

### Development Environment (Now MySQL-only)
```bash
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=abnehmen_app
PORT=3001
BASE_URL=http://localhost:3001
```

## Deployment URLs
- **Production Backend**: https://ail-app-production.up.railway.app
- **Frontend**: https://ail-app.vercel.app
- **Health Check**: https://ail-app-production.up.railway.app/health
- **API Status**: https://ail-app-production.up.railway.app/api/v1/status

## Architecture Overview

### Core Stack
- **Framework**: Node.js + Express.js
- **Database**: MySQL (both dev and prod) 
- **Authentication**: JWT with role-based authorization
- **Deployment**: Railway (backend) + Vercel (frontend)

### Database Strategy
- **Development**: MySQL (local)
- **Production**: MySQL on Railway
- **Migration**: `scripts/migrate-sqlite-to-mysql.js` (one-time SQLite→MySQL migration)
- **Wrapper**: `src/database/database-wrapper.js` (MySQL-only interface)

## Project Structure

```
backend/
├── server.js                    # 🚀 Main entry point
├── src/
│   ├── controllers/             # 🎯 Business logic
│   │   ├── authController.js    # Authentication
│   │   ├── studioController.js  # Studio management
│   │   ├── leadController.js    # Lead management
│   │   └── managerController.js # Admin functions
│   ├── routes/                  # 🛣️ API routes
│   │   ├── auth.js             # /api/v1/auth
│   │   ├── studios.js          # /api/v1/studios
│   │   ├── leads.js            # /api/v1/leads
│   │   └── manager.js          # /api/v1/manager
│   ├── middleware/              # 🔒 Security & validation
│   │   ├── auth.js             # JWT + RBAC
│   │   ├── validation.js       # Input validation
│   │   └── errorHandler.js     # Error handling
│   ├── database/                # 🗄️ Database layer
│   │   ├── database-wrapper.js # MySQL-only interface
│   │   ├── mysql-connection.js # MySQL setup
│   │   └── connection.js       # SQLite (legacy)
│   └── services/                # 🔌 External integrations
│       ├── googleSheetsService.js
│       ├── twilioService.js
│       └── activationCodeService.js
└── scripts/                     # 🔧 Migration tools
    └── migrate-sqlite-to-mysql.js
```

## API Endpoints

### Authentication (`/api/v1/auth`)
```
POST   /register    # User registration
POST   /login       # User authentication  
GET    /profile     # Get user profile
PUT    /profile     # Update profile
POST   /logout      # Logout
```

### Studios (`/api/v1/studios`)
```
POST   /                      # Create studio
GET    /my-studio             # Get current user's studio
GET    /prefill-info          # Get pre-fill information
GET    /:id                   # Get studio by ID
PUT    /:id                   # Update studio
GET    /:id/stats             # Studio statistics
GET    /:id/dashboard-stats   # Dashboard metrics
GET    /:id/customers         # Studio customers
GET    /:id/activation-codes  # Activation codes
POST   /:id/activation-codes  # Generate codes
```

### Leads (`/api/v1/leads`)
```
GET    /                # List leads
POST   /                # Create lead
GET    /:id             # Get lead details
PUT    /:id             # Update lead
DELETE /:id             # Delete lead
POST   /:id/call-logs   # Add call log
GET    /:id/call-logs   # Get call logs
```

### Manager (`/api/v1/manager`)
```
GET    /dashboard       # Manager dashboard
POST   /manager-codes   # Generate manager codes
GET    /manager-codes   # List manager codes
GET    /studios         # All studios overview
```

## Database Schema

### Core Tables
```sql
-- Users (12 records in production)
users (id, email, password_hash, role, first_name, last_name, phone, is_active)

-- Studios (2 records in production)  
studios (id, name, owner_id, address, phone, email, business_hours, city)

-- Manager codes for registration
manager_codes (id, code, created_by_user_id, used_by_user_id, is_used, expires_at, intended_city, intended_studio_name, intended_owner_name)

-- Activation codes for customers
activation_codes (id, code, studio_id, used_by_user_id, is_used, expires_at)

-- Lead management
leads (id, name, phone_number, email, studio_id, status, source, notes, last_contact_date, next_contact_date)
lead_call_logs (id, lead_id, call_date, call_duration, call_outcome, notes, created_by)

-- Appointments (future)
appointments (id, customer_id, studio_id, appointment_date, appointment_time, duration_minutes, status, notes)

-- Google Sheets integration
google_sheets_integrations (id, studio_id, sheet_id, sheet_name, webhook_url, is_active, last_sync_at, sync_status)
```

### User Roles
- **`manager`**: System administrators
- **`studio_owner`**: Studio management  
- **`customer`**: End users

## Authentication & Authorization

### JWT Configuration
- **Secret**: `abnehmen-im-liegen-jwt-secret-2025-secure-key`
- **Expiry**: 24 hours
- **Header**: `Authorization: Bearer <token>`

### Middleware Functions (`src/middleware/auth.js`)
```javascript
authenticate          // JWT validation
authorize(roles)       // Role-based access
authorizeStudioOwner   // Studio ownership check
authorizeCustomerAccess // Customer data access
optionalAuth          // Optional authentication
```

## External Integrations

### Google Sheets (`src/services/googleSheetsService.js`)
- **Purpose**: Import leads from Google Sheets
- **Features**: Sheet validation, data preview, bulk import
- **Auth**: Service account with private key

### Twilio (`src/services/twilioService.js`)
- **Purpose**: Voice calling system
- **Features**: Outbound calls, TwiML generation, call tracking
- **Language**: German

### Dialogflow CX (`src/dialogflow/`)
- **Purpose**: AI conversation handling
- **Features**: Intent handling, appointment booking
- **Location**: europe-west3

## Migration & Database Management

### Migration Scripts
```bash
# Full migration (replaces all MySQL data)
node scripts/migrate-sqlite-to-mysql.js migrate

# Check environment  
node scripts/migrate-sqlite-to-mysql.js check

# Interactive mode
node scripts/migrate-sqlite-to-mysql.js
```

### Migration Features
- ✅ Handles datetime format conversion (ISO → MySQL)
- ✅ Fixes time format (HH:MM → HH:MM:SS)  
- ✅ Maps column names (phone → phone_number)
- ✅ Complete schema recreation
- ✅ Foreign key constraint handling
- ✅ Batch processing for large datasets

## Package.json Scripts
```json
{
  "start": "node server.js",
  "dev": "nodemon server.js", 
  "db:migrate": "node scripts/migrate-sqlite-to-mysql.js migrate",
  "db:check": "node scripts/migrate-sqlite-to-mysql.js check"
}
```

## Recent Fixes Applied

### Fixed Issues (2025-08-04)
- ✅ **Login 500 error**: Fixed MySQL connection management in database-wrapper.js
- ✅ **Connection recovery**: Added automatic reconnection for closed MySQL connections
- ✅ **User data migration**: Successfully migrated 12 users to production MySQL

### Root Cause Resolution
The production login errors were caused by **MySQL connection timeout/closure**. The database-wrapper.js now includes:
- Connection health checking (`ensureConnection`)
- Automatic reconnection on connection failures  
- Retry logic for failed queries
- Specific handling for "closed state" errors

### Remaining Issues
- ⚠️ **Incomplete data migration**: Some tables (studios, leads, etc.) need schema updates
- ⚠️ **Sync checkpoint errors**: DateTime format issues in sync tracking (non-critical)

## Debugging Commands

### Test MySQL Connection
```bash
cd backend && node -e "
const db = require('./src/database/database-wrapper');
(async () => {
  await db.init();
  const user = await db.get('SELECT * FROM users LIMIT 1');
  console.log('User sample:', user);
  await db.close();
})();
"
```

### Setup Local MySQL (for development)
```bash
# Install MySQL (macOS)
brew install mysql
brew services start mysql

# Create local database
mysql -u root -e 'CREATE DATABASE abnehmen_app;'

# Update .env for local development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=abnehmen_app
```

### Test Production API
```bash
# Health check
curl https://ail-app-production.up.railway.app/health

# Test login (should work after migration)
curl -X POST https://ail-app-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"studio@test.com","password":"password123"}'
```

## Recovery Plan

### Immediate Fix: Clean Migration
1. **Run improved migration script** (handles all format issues)
2. **Test login functionality** 
3. **Verify studio data access**
4. **Test frontend integration**

### Migration Safety
- ✅ **Non-destructive**: Can be run multiple times
- ✅ **Complete schema**: Includes all missing tables/columns
- ✅ **Format fixes**: Handles datetime/time conversion
- ✅ **Error resilient**: Continues on batch failures

---

*Last Updated: 2025-08-04*  
*Status: Ready for clean migration to fix production login issues*