# Studio-Centric Manager Dashboard Implementation Plan

## Overview
Transform the Manager Dashboard to focus on Studios as the primary entity, with Google Sheets integration as a key feature per studio. Remove obsolete manager code generation functionality.

## Current State Analysis

### ✅ Working Components
- Backend Google Sheets API endpoints (`/api/v1/manager/google-sheets/*`)
- Google Sheets service with valid credentials configured
- Lead management endpoints (`/api/v1/manager/leads/*`)
- Studios overview endpoint (`/api/v1/manager/studios`)
- Database tables: `studios`, `google_sheets_integrations`, `leads`

### ❌ Obsolete Features to Remove
- Manager code generation for studio registration
- `/api/v1/manager/studio-owner-codes` endpoints
- "Manager Codes" or "Studio Codes" UI tabs
- `manager_codes` table usage (keep for historical data)

### ⚠️ Features to Add/Update
- Address field search for studios
- Google Sheets connection status in studio listings
- Studio-first navigation flow
- Per-studio sheet connection interface

## Implementation Phases

### Phase 1: Backend Updates

#### 1.1 Enhance Studio Search API
**File**: `backend/src/controllers/managerController.js`
- Add address search capability to `getStudiosOverview`
- Include Google Sheets integration status in response
- Add fields: `has_google_sheet`, `last_sync_date`, `total_imported_leads`

```javascript
// Enhanced query parameters
{
  search: string,      // Search by name, city, or address
  address: string,     // Specific address search
  city: string,        // City filter
  hasSheet: boolean,   // Filter by sheet connection status
  page: number,
  limit: number
}

// Enhanced response structure
{
  studios: [{
    id: number,
    name: string,
    owner_name: string,
    city: string,
    address: string,
    phone_number: string,
    created_at: date,
    google_sheets_integration: {
      connected: boolean,
      sheet_name: string,
      last_sync: date,
      total_leads_imported: number,
      auto_sync_enabled: boolean
    }
  }],
  pagination: {...}
}
```

#### 1.2 Remove Obsolete Endpoints
**Files to Update**:
- `backend/src/routes/manager.js` - Remove studio-owner-codes routes
- `backend/src/controllers/managerController.js` - Remove code generation methods

#### 1.3 Add Studio-Sheet Association Endpoint
**New Endpoint**: `GET /api/v1/manager/studios/:studioId/integration`
- Get detailed Google Sheets integration for specific studio
- Include sync history and column mappings

### Phase 2: Frontend Redesign

#### 2.1 Navigation Structure
**Primary Navigation**:
1. **Studios** (default) - Main studio management view
2. **Overview** - Aggregate statistics dashboard
3. **Lead Analytics** - Cross-studio lead metrics

#### 2.2 Studios Tab Features
**File**: `frontend/public/src/pages/ManagerDashboard.js`

**Main View Components**:
```javascript
// Studio list with enhanced filtering
<StudiosView>
  <SearchBar>
    - Text search (name, owner, address)
    - City dropdown filter
    - Connection status filter (All/Connected/Not Connected)
  </SearchBar>
  
  <StudiosList>
    - Studio cards or table rows
    - Visual indicators for sheet connection
    - Quick actions per studio
  </StudiosList>
</StudiosView>
```

**Studio Card/Row Design**:
```
┌─────────────────────────────────────────────────────┐
│ [Logo] Studio Name                     [Status Badge]│
│ Owner: John Doe                                      │
│ Address: Hauptstraße 123, 10115 Berlin              │
│ ├─ 📊 Google Sheet: ✅ Connected (Auto-sync ON)     │
│ ├─ 📈 Leads: 245 total, 12 imported today           │
│ └─ 🔄 Last sync: 2 hours ago                        │
│                                                      │
│ [Manage Integration] [View Details] [Sync Now]      │
└─────────────────────────────────────────────────────┘
```

#### 2.3 Google Sheets Connection Flow
**Modal/Page**: Connect Google Sheet to Studio

1. **Studio Selection** (if not pre-selected)
2. **Sheet URL Input**
   - Validation of Google Sheets URL
   - Access permission check
3. **Preview & Column Mapping**
   - Display first 5 rows
   - Map columns to lead fields (name, phone, email, etc.)
4. **Sync Settings**
   - Auto-sync enabled/disabled
   - Sync frequency
5. **Confirmation & Initial Import**

### Phase 3: Database Updates

#### 3.1 Studios Table Enhancement
```sql
-- Add address field if not exists
ALTER TABLE studios 
ADD COLUMN IF NOT EXISTS address VARCHAR(255) AFTER city;

-- Add index for address search
CREATE INDEX IF NOT EXISTS idx_studios_address 
ON studios(address);
```

#### 3.2 Integration Status View
```sql
-- Create view for studio integration status
CREATE OR REPLACE VIEW studio_integration_status AS
SELECT 
  s.*,
  CASE WHEN gsi.id IS NOT NULL THEN TRUE ELSE FALSE END as has_google_sheet,
  gsi.sheet_name,
  gsi.last_sync_at,
  gsi.auto_sync_enabled,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT CASE 
    WHEN l.source = 'google_sheets' 
    AND DATE(l.created_at) = CURDATE() 
    THEN l.id 
  END) as leads_imported_today
FROM studios s
LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id
LEFT JOIN leads l ON s.id = l.studio_id
GROUP BY s.id;
```

### Phase 4: API Implementation Details

#### 4.1 Enhanced Studios Endpoint
**File**: `backend/src/controllers/managerController.js`

```javascript
async getStudiosOverview(req, res) {
  const { 
    search, 
    address, 
    city, 
    hasSheet, 
    page = 1, 
    limit = 20 
  } = req.query;
  
  // Build dynamic query with filters
  let query = `
    SELECT 
      s.*,
      u.first_name as owner_first_name,
      u.last_name as owner_last_name,
      CASE WHEN gsi.id IS NOT NULL THEN TRUE ELSE FALSE END as has_google_sheet,
      gsi.sheet_name,
      gsi.last_sync_at,
      gsi.auto_sync_enabled,
      COUNT(DISTINCT l.id) as total_leads,
      COUNT(DISTINCT CASE 
        WHEN l.source = 'google_sheets' 
        THEN l.id 
      END) as imported_leads
    FROM studios s
    LEFT JOIN users u ON s.owner_id = u.id
    LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id
    LEFT JOIN leads l ON s.id = l.studio_id
    WHERE 1=1
  `;
  
  // Add search filters
  if (search) {
    query += ` AND (
      s.name LIKE ? OR 
      s.address LIKE ? OR 
      s.city LIKE ? OR
      CONCAT(u.first_name, ' ', u.last_name) LIKE ?
    )`;
  }
  
  if (address) {
    query += ` AND s.address LIKE ?`;
  }
  
  if (city) {
    query += ` AND s.city = ?`;
  }
  
  if (hasSheet !== undefined) {
    query += hasSheet 
      ? ` AND gsi.id IS NOT NULL` 
      : ` AND gsi.id IS NULL`;
  }
  
  query += ` GROUP BY s.id ORDER BY s.created_at DESC`;
  
  // Execute with pagination
  // Return formatted response
}
```

#### 4.2 Studio-Specific Integration Endpoint
```javascript
async getStudioIntegration(req, res) {
  const { studioId } = req.params;
  
  // Get studio details with integration
  const studio = await db.get(`
    SELECT s.*, gsi.*
    FROM studios s
    LEFT JOIN google_sheets_integrations gsi ON s.id = gsi.studio_id
    WHERE s.id = ?
  `, [studioId]);
  
  // Get sync history
  const syncHistory = await db.all(`
    SELECT * FROM sync_tracking
    WHERE entity_type = 'studio' AND entity_id = ?
    ORDER BY synced_at DESC
    LIMIT 10
  `, [studioId]);
  
  return res.json({
    studio,
    integration: studio.sheet_url ? {
      connected: true,
      sheet_url: studio.sheet_url,
      sheet_name: studio.sheet_name,
      column_mapping: JSON.parse(studio.column_mapping || '{}'),
      auto_sync_enabled: studio.auto_sync_enabled,
      last_sync: studio.last_sync_at,
      sync_history: syncHistory
    } : {
      connected: false
    }
  });
}
```

### Phase 5: Frontend Implementation

#### 5.1 Studios List Component
**File**: `frontend/public/src/components/manager/StudiosList.js`

```javascript
class StudiosList {
  constructor() {
    this.studios = [];
    this.filters = {
      search: '',
      address: '',
      city: '',
      hasSheet: null
    };
  }
  
  async loadStudios() {
    const params = new URLSearchParams(this.filters);
    const response = await managerAPI.getStudios(params);
    this.studios = response.studios;
    this.render();
  }
  
  renderStudioCard(studio) {
    const sheetStatus = studio.has_google_sheet 
      ? `✅ Connected (${studio.imported_leads} leads)`
      : `⚠️ Not Connected`;
    
    return `
      <div class="studio-card">
        <div class="studio-header">
          <h3>${studio.name}</h3>
          <span class="status-badge ${studio.has_google_sheet ? 'connected' : 'not-connected'}">
            ${sheetStatus}
          </span>
        </div>
        <div class="studio-details">
          <p>Owner: ${studio.owner_first_name} ${studio.owner_last_name}</p>
          <p>Address: ${studio.address || 'N/A'}, ${studio.city}</p>
          <p>Total Leads: ${studio.total_leads}</p>
          ${studio.has_google_sheet ? `
            <p>Last Sync: ${this.formatDate(studio.last_sync_at)}</p>
          ` : ''}
        </div>
        <div class="studio-actions">
          ${studio.has_google_sheet ? `
            <button onclick="managerDashboard.manageIntegration(${studio.id})">
              Manage Integration
            </button>
            <button onclick="managerDashboard.syncNow(${studio.id})">
              Sync Now
            </button>
          ` : `
            <button onclick="managerDashboard.connectSheet(${studio.id})" class="btn-primary">
              Connect Google Sheet
            </button>
          `}
          <button onclick="managerDashboard.viewStudioDetails(${studio.id})">
            View Details
          </button>
        </div>
      </div>
    `;
  }
}
```

#### 5.2 Search and Filter Component
```javascript
class StudioSearch {
  renderSearchBar() {
    return `
      <div class="search-filters">
        <input 
          type="text" 
          id="studio-search" 
          placeholder="Search by name, owner, or address..."
          class="form-control"
        />
        <input 
          type="text" 
          id="address-search" 
          placeholder="Search by address..."
          class="form-control"
        />
        <select id="city-filter" class="form-control">
          <option value="">All Cities</option>
          ${this.getCityOptions()}
        </select>
        <select id="sheet-filter" class="form-control">
          <option value="">All Studios</option>
          <option value="true">With Google Sheets</option>
          <option value="false">Without Google Sheets</option>
        </select>
        <button onclick="studiosList.applyFilters()" class="btn btn-primary">
          Search
        </button>
      </div>
    `;
  }
}
```

### Phase 6: Testing Plan

#### 6.1 Backend Tests
- Studio search with various filters
- Address search functionality
- Google Sheets integration status in listings
- Studio-specific integration details
- Verify obsolete endpoints are removed

#### 6.2 Frontend Tests
- Studios list rendering with all statuses
- Search and filter functionality
- Google Sheets connection flow
- Integration management for connected studios
- Responsive design for studio cards

#### 6.3 Integration Tests
- Complete flow: Connect sheet to studio
- Sync data from connected sheet
- Update integration settings
- Disconnect and reconnect sheet
- Search studios by address

## Migration Steps

1. **Backup current system**
2. **Deploy backend changes**
   - Add address field to studios table
   - Update API endpoints
   - Remove obsolete code generation endpoints
3. **Deploy frontend changes**
   - New Studios-focused UI
   - Remove Manager Codes tab
4. **Data migration**
   - Populate address field for existing studios (if available)
5. **Testing in staging**
6. **Production deployment**

## Success Metrics

- All studios visible with Google Sheets connection status
- Address search returning accurate results
- Successful sheet connections per studio
- No references to obsolete manager codes
- Improved manager workflow efficiency

## Timeline

- Phase 1-2: Backend updates (2 days)
- Phase 3-4: Frontend redesign (3 days)
- Phase 5: Testing & refinement (2 days)
- Phase 6: Deployment (1 day)

Total: ~8 days of development