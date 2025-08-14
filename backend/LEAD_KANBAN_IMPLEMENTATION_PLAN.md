# Comprehensive Implementation Plan: Lead Management Kanban + Smart Customer Registration System

## 📊 Current Progress: ~70% Complete

### ✅ Completed Features
- **Lead Kanban Board** with 4-stage pipeline (New → Working → Qualified → Trial Scheduled)
- **Drag & Drop** functionality between stages
- **Archive System** with positive (converted) and negative outcomes (not interested, unreachable, wrong number, lost)
- **Lead Details Modal** with quick archive actions
- **Add Manual Leads** with form validation
- **Backend API Endpoints** for kanban data, status updates, lead details
- **Status Transitions** with validation
- **Archive Toggle** with show/hide functionality
- **Lead Conversion** (simplified - status change to 'converted')
- **Reactivate Leads** from archive back to working status
- **Real-time Updates** after actions (add, move, archive, convert)

### 🚧 In Progress
- **Archive Display** - Data is loaded but rendering needs fixing
- **Visual Polish** - Archive button visibility improvements

### 📋 Remaining Tasks
- **Walk-in Workflows** - Direct customer creation with mandatory sessions
- **Calendar Visual Distinctions** - Different styles for lead vs customer appointments
- **Activity Logging** - Track all lead interactions
- **Customer Registration with Sessions** - Full conversion flow with session packages
- **Analytics Dashboard** - Conversion metrics and funnel visualization
- **Trial Scheduling** - Full appointment booking when moving to trial_scheduled

## Overview
This document outlines the complete implementation plan for the enhanced lead management system with Kanban board visualization, unified appointment scheduling, and smart customer registration where customers must purchase session packages to exist and can access the mobile app.

## Core Business Rule
**Customer = Has Purchased Sessions**. You cannot be a customer without buying a session package.

## Key Features
- 4-stage active lead pipeline with drag-and-drop
- Archived states for completed/lost leads
- Inline appointment scheduling for leads
- Smart conversion modal for lead-to-customer transformation (requires session purchase)
- Session package-required customer creation
- Registration code system: `{studio_id}-{customer_id}` (stored in database)
- Support for two person types: leads (no sessions) and customers (have/had sessions)
- Visual distinction between lead and customer appointments
- Walk-in customer handling with mandatory session purchase
- Immediate app access after customer creation (since they have sessions)

---

## Phase 1: Database Foundation (Priority: HIGH)

### 1.1 Studio Unique Identifier System
```sql
-- Add unique identifier to studios (used in registration codes)
ALTER TABLE studios 
ADD COLUMN unique_identifier VARCHAR(20) UNIQUE AFTER name,
ADD INDEX idx_studio_identifier (unique_identifier);

-- Generate unique identifiers for existing studios based on city
UPDATE studios SET unique_identifier = 
  CASE 
    WHEN city = 'Berlin' THEN CONCAT('BER-', id)
    WHEN city = 'Munich' THEN CONCAT('MUC-', id)
    WHEN city = 'Hamburg' THEN CONCAT('HAM-', id)
    WHEN city = 'Frankfurt' THEN CONCAT('FRA-', id)
    ELSE CONCAT('STU-', id)
  END;

-- Remove old activation codes system (after migration)
-- DROP TABLE activation_codes;
```

### 1.2 Customer Registration System
```sql
-- Modify customers table for mandatory session-based model
ALTER TABLE customers 
MODIFY COLUMN user_id INT NULL,
ADD COLUMN registration_code VARCHAR(50) UNIQUE NOT NULL AFTER user_id,
ADD COLUMN has_app_access BOOLEAN DEFAULT FALSE AFTER registration_code,
ADD COLUMN total_sessions_purchased INT DEFAULT 0 AFTER has_app_access,
ADD COLUMN customer_since DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER total_sessions_purchased,
ADD COLUMN created_from_lead_id INT NULL AFTER customer_since,
ADD COLUMN acquisition_type ENUM('lead_conversion', 'direct_purchase', 'walk_in') 
  DEFAULT 'direct_purchase' AFTER created_from_lead_id,
ADD INDEX idx_registration_code (registration_code),
ADD FOREIGN KEY (created_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- Create trigger to generate registration codes on customer creation
DELIMITER $$
CREATE TRIGGER generate_registration_code
BEFORE INSERT ON customers
FOR EACH ROW
BEGIN
  DECLARE studio_code VARCHAR(20);
  
  -- Get studio identifier
  SELECT unique_identifier INTO studio_code 
  FROM studios WHERE id = NEW.studio_id;
  
  -- Generate registration code (will use auto-increment ID)
  SET NEW.registration_code = CONCAT(studio_code, '-', NEW.id);
END$$
DELIMITER ;

-- Note: In practice, we'll generate this in application code after INSERT
-- to get the auto-increment ID, then UPDATE the registration_code

-- Migrate existing customers
UPDATE customers c
SET registration_code = CONCAT(
    (SELECT unique_identifier FROM studios WHERE id = c.studio_id),
    '-',
    c.id
),
total_sessions_purchased = (
    SELECT COALESCE(SUM(total_sessions), 0)
    FROM customer_sessions cs 
    WHERE cs.customer_id = c.id
),
has_app_access = (user_id IS NOT NULL)
WHERE registration_code IS NULL;
```

### 1.3 Lead Status Enhancement
```sql
-- Update lead status enum for Kanban workflow
ALTER TABLE leads MODIFY COLUMN status 
ENUM('new', 'working', 'qualified', 'trial_scheduled', 
     'converted', 'unreachable', 'wrong_number', 'not_interested', 'lost') 
DEFAULT 'new';

-- Add workflow tracking fields
ALTER TABLE leads 
ADD COLUMN stage_entered_at TIMESTAMP NULL AFTER status,
ADD COLUMN contact_attempts INT DEFAULT 0 AFTER stage_entered_at,
ADD COLUMN last_contact_attempt TIMESTAMP NULL AFTER contact_attempts,
ADD COLUMN is_archived BOOLEAN DEFAULT FALSE AFTER last_contact_attempt,
ADD COLUMN archive_reason VARCHAR(100) NULL AFTER is_archived,
ADD COLUMN converted_to_user_id INT NULL AFTER archive_reason,
ADD COLUMN conversion_date TIMESTAMP NULL AFTER conversion_date,
ADD COLUMN trial_appointment_id INT NULL AFTER conversion_date,
ADD COLUMN initial_package_size INT NULL AFTER trial_appointment_id,
ADD INDEX idx_leads_archived (is_archived, status),
ADD INDEX idx_leads_stage (status, stage_entered_at),
ADD FOREIGN KEY (converted_to_user_id) REFERENCES users(id) ON DELETE SET NULL;
```

### 1.4 Appointments Table Enhancement
```sql
-- Add support for leads and customers
ALTER TABLE appointments 
ADD COLUMN lead_id INT NULL AFTER customer_id,
ADD COLUMN person_type ENUM('customer', 'lead') NOT NULL DEFAULT 'customer' AFTER lead_id,
ADD INDEX idx_appointment_lead (lead_id),
ADD INDEX idx_appointment_person_type (person_type, appointment_date),
ADD CONSTRAINT fk_appointment_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Update existing appointments
UPDATE appointments 
SET person_type = 'customer'
WHERE customer_id IS NOT NULL;

-- Add check constraint after migration
ALTER TABLE appointments 
ADD CONSTRAINT chk_person_reference CHECK (
  (person_type = 'customer' AND customer_id IS NOT NULL AND lead_id IS NULL) OR
  (person_type = 'lead' AND lead_id IS NOT NULL AND customer_id IS NULL)
);
```

### 1.5 Lead Activities Tracking
```sql
CREATE TABLE lead_activities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lead_id INT NOT NULL,
  studio_id INT NOT NULL,
  activity_type ENUM('status_change', 'call', 'email', 'sms', 'note', 
                     'appointment_scheduled', 'appointment_completed', 
                     'conversion', 'archive') NOT NULL,
  description TEXT,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  metadata JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead_activities (lead_id, created_at),
  INDEX idx_activity_type (activity_type, studio_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```


---

## Phase 2: Backend API Development

### 2.1 Authentication & Registration Updates

#### POST /api/v1/auth/register-customer
Register customer using registration code (customers always have sessions by definition)
```javascript
// Request body
{
  "registrationCode": "BER-3-456",  // Studio ID + Customer ID
  "email": "customer@example.com",
  "password": "securePassword"
}

// Validation logic:
// 1. Lookup customer by registration code (direct database query)
// 2. Verify customer exists (customers always have/had sessions)
// 3. Check customer not already registered (has_app_access = false)
// 4. Create user account and link to customer

// Response
{
  "message": "Registration successful",
  "user": { id, email, role: "customer" },
  "customer": { 
    id: 456,
    studio_id: 3,
    registration_code: "BER-3-456",
    total_sessions_purchased: 20,
    remaining_sessions: 18,
    appointments: [...]
  },
  "token": "jwt_token"
}
```

#### GET /api/v1/auth/validate-code
Validate registration code before registration
```javascript
// Query params
?code=STU-BER-3-456

// Response
{
  "valid": true,
  "customer_name": "Max Mustermann",
  "studio_name": "AiL Berlin",
  "active_sessions": 20,
  "can_register": true
}
```

### 2.2 Customer Management Endpoints

#### POST /api/v1/studios/:studioId/customers
Create customer with mandatory session package (studio owner only)
```javascript
// Request body
{
  "firstName": "Anna",
  "lastName": "Schmidt",
  "phone": "+49176987654",
  "email": "anna@example.com",  // Optional
  "sessionPackage": 20,  // REQUIRED - 10, 20, 30, or 40
  "paymentMethod": "cash",
  "notes": "Prefers morning appointments"
}

// Response - customer created with sessions and registration code
{
  "customer": {
    "id": 789,
    "registration_code": "BER-3-789",  // Generated immediately
    "total_sessions_purchased": 20,
    "remaining_sessions": 20,
    "has_app_access": false,  // Not registered yet
    "customer_since": "2025-01-10T10:00:00Z"
  },
  "message": "Customer created with 20 sessions. Registration code: BER-3-789"
}
```

#### POST /api/v1/customers/:id/sessions
Add additional session package to existing customer
```javascript
// Request body
{
  "total_sessions": 20,
  "paymentMethod": "card",
  "notes": "20er Block Nachkauf"
}

// Response
{
  "session_package": { id, total: 20, remaining: 20 },
  "registration_code": "BER-3-789",  // Same code as always
  "total_sessions_purchased": 40,  // Cumulative
  "current_remaining": 35,
  "message": "Session package added. Customer can use existing code: BER-3-789"
}
```

#### GET /api/v1/customers/:id/registration-info
Get registration code and instructions for customer
```javascript
// Response
{
  "customer_id": 789,
  "customer_name": "Anna Schmidt",
  "registration_code": "STU-BER-3-789",
  "has_active_sessions": true,
  "total_sessions": 20,
  "remaining_sessions": 18,
  "is_registered": false,
  "instructions": "Download the app and register with code: STU-BER-3-789"
}
```

### 2.3 Lead Kanban Endpoints

#### GET /api/v1/leads/kanban
Returns grouped leads by status with metrics
```javascript
// Response structure
{
  "active": {
    "new": [...],
    "working": [...],
    "qualified": [...],
    "trial_scheduled": [...]
  },
  "archived": {
    "positive": { "converted": [...] },
    "negative": { 
      "unreachable": [...], 
      "not_interested": [...],
      "lost": [...] 
    }
  },
  "metrics": {
    "conversion_rate": 0.42,
    "avg_time_to_convert": "5 days",
    "total_active": 28,
    "total_archived": 168
  }
}
```

#### PUT /api/v1/leads/:id/move
Moves lead between stages with validation
```javascript
// Request body
{
  "to_status": "trial_scheduled",
  "appointment_data": {
    "date": "2025-09-01",
    "time": "14:00"
  }
}
```

#### POST /api/v1/leads/:id/convert
Converts lead to customer (MUST include session package)
```javascript
// Request body
{
  "sessionPackage": 20,  // REQUIRED - cannot convert without purchase
  "paymentMethod": "cash",
  "notes": "Converted after trial"
}

// Response - always includes sessions and registration code
{
  "customer": {
    "id": 890,
    "registration_code": "BER-3-890",  // Generated immediately
    "total_sessions_purchased": 20,
    "remaining_sessions": 20,
    "has_app_access": false,  // Can register now
    "customer_since": "2025-01-10T14:00:00Z",
    "acquisition_type": "lead_conversion"
  },
  "session_package": { total: 20, remaining: 20 },
  "message": "Lead converted to customer with 20 sessions. Registration code: BER-3-890"
}

// Error if no session package
{
  "error": "Cannot convert lead to customer without session package purchase",
  "code": "SESSION_REQUIRED"
}
```

### 2.4 Unified Search Endpoints

#### GET /api/v1/search/persons
Search across leads and customers
```javascript
// Query params
?type=all&query=max&studio_id=3

// Response
{
  "results": [
    {
      "id": "lead_123",
      "type": "lead",
      "name": "Max Mustermann",
      "phone": "0176-1234567",
      "email": "max@example.com",
      "badge": "Lead - Qualifiziert",
      "can_book_trial": true,
      "color": "#007bff"
    },
    {
      "id": "customer_456",
      "type": "customer",
      "name": "Max Meyer",
      "phone": "0176-9876543",
      "email": "max.meyer@example.com",
      "registration_code": "BER-3-456",
      "badge": "Kunde - App-Nutzer",
      "sessions": { total_purchased: 30, remaining: 12 },
      "has_app_access": true,
      "can_book": true,
      "color": "#28a745"
    },
    {
      "id": "customer_789",
      "type": "customer",
      "name": "Maximilian Schmidt",
      "phone": "0176-5551234",
      "registration_code": "BER-3-789",
      "badge": "Kunde - Nicht registriert",
      "sessions": { total_purchased: 20, remaining: 18 },
      "has_app_access": false,
      "can_book": true,
      "color": "#6c757d"
    }
  ]
}
```

### 2.5 Enhanced Appointment Endpoints

#### POST /api/v1/appointments
Create appointment for lead or customer
```javascript
// Request body for lead (trial only)
{
  "studio_id": 3,
  "person_type": "lead",
  "lead_id": 123,
  "appointment_type_id": 3, // Probebehandlung only
  "appointment_date": "2025-09-01",
  "start_time": "14:00",
  "end_time": "15:00"
}

// Request body for customer (any appointment type)
{
  "studio_id": 3,
  "person_type": "customer",
  "customer_id": 456,
  "appointment_type_id": 1,  // Behandlung, Beratung, etc.
  "appointment_date": "2025-09-01",
  "start_time": "14:00",
  "end_time": "15:00"
}
```

---

## Phase 3: Frontend Implementation

### 3.1 Lead Kanban Board Component
Location: `/frontend/public/src/components/studio/LeadKanban.js`

**Features:**
- 4 active columns with drag-and-drop
- Inline scheduling modal on drop to "trial_scheduled"
- Quick action buttons (call, email, schedule, note)
- Archive panel as collapsible sidebar
- Search and filter bar
- Bulk actions support

### 3.2 Inline Scheduling Modal
```javascript
// Modal structure when moving to "Probebehandlung Vereinbart"
{
  title: "Probebehandlung terminieren",
  lead: { name, phone, email },
  quickSlots: ["Mo 14:00", "Di 10:00", "Mi 15:00"],
  manualSelection: { date, time },
  machineAvailability: "2 von 3",
  smsReminder: true,
  actions: ["Abbrechen", "Termin erstellen"]
}
```

### 3.3 Smart Conversion Modal
```javascript
// Modal structure for lead conversion with mandatory session package
{
  title: "Lead zu Kunde konvertieren",
  lead: { name, phone, email },
  sessionPackage: {
    label: "Behandlungsblock wählen (erforderlich)",
    required: true,
    options: [
      { value: 10, label: "10er Block - €XXX" },
      { value: 20, label: "20er Block - €XXX" },
      { value: 30, label: "30er Block - €XXX" },
      { value: 40, label: "40er Block - €XXX" }
    ],
    note: "Kunde wird mit Behandlungsblock erstellt und erhält Registrierungscode"
  },
  paymentMethods: ["cash", "transfer", "card"],
  notes: "optional",
  actions: ["Abbrechen", "Kunde erstellen"],
  // Always shows registration info
  infoMessage: "Kunde erhält Code: BER-3-XXX für App-Registrierung"
```

### 3.4 Calendar Visual Updates
```css
/* Lead appointments (trial only) */
.appointment-lead {
  border-left: 4px solid #007bff;
  background: linear-gradient(90deg, #e3f2fd 0%, white 10%);
}

/* Customer appointments (with app access) */
.appointment-customer-registered {
  border-left: 4px solid #28a745;
  background: linear-gradient(90deg, #e8f5e9 0%, white 10%);
}

/* Customer appointments (without app access) */
.appointment-customer-not-registered {
  border-left: 4px solid #6c757d;
  background: linear-gradient(90deg, #f8f9fa 0%, white 10%);
}

/* Visual indicators */
.appointment-icon-lead: 🔷
.appointment-icon-customer-app: 📱
.appointment-icon-customer-no-app: 📋
```

### 3.5 Walk-in Workflows

#### Walk-in for Trial
1. Click [+ Neuer Termin]
2. Select [Neuer Lead - Probe]
3. Fill lead details + schedule
4. Creates lead in "trial_scheduled" status

#### Walk-in Direct Purchase
1. Click [+ Neuer Kunde]
2. Fill customer details
3. Select session package (10/20/30/40) - REQUIRED
4. Select payment method
5. System creates customer with registration code: BER-3-XXX
6. Print/SMS code to customer
7. Customer can immediately download app and register
8. Optional: Schedule first appointment

### 3.6 Customer Dashboard Updates
```javascript
// Customer list with registration status
{
  customers: [
    {
      name: "Anna Schmidt",
      registration_code: "BER-3-123",
      sessions: { total_purchased: 20, remaining: 18 },
      has_app_access: false,
      status_badge: "📋 Kunde - Nicht registriert",
      actions: ["Code anzeigen", "Per SMS senden", "Drucken"]
    },
    {
      name: "Max Meyer",
      registration_code: "BER-3-124",
      sessions: { total_purchased: 30, remaining: 25 },
      has_app_access: true,
      status_badge: "📱 Kunde - App-Nutzer",
      last_login: "Vor 2 Stunden"
    },
    {
      name: "Lisa Müller",
      registration_code: "BER-3-125",
      sessions: { total_purchased: 40, remaining: 0 },
      has_app_access: true,
      status_badge: "📱 Kunde - Keine aktiven Sessions",
      actions: ["Sessions nachkaufen"]
    }
  ]
}
```

---

## Phase 4: Business Logic Implementation

### 4.1 Status Transition Rules
```javascript
const validTransitions = {
  'new': ['working', 'unreachable', 'wrong_number'],
  'working': ['qualified', 'not_interested', 'unreachable'],
  'qualified': ['trial_scheduled', 'not_interested'],
  'trial_scheduled': ['converted', 'lost'],
  // Archive states are terminal (no transitions out)
};
```

### 4.2 Auto-progression Triggers
- **Appointment scheduled** → Lead moves to "trial_scheduled"
- **Appointment cancelled** → Lead moves back to "qualified"
- **Trial completed** → Show conversion prompt
- **5+ contact attempts** → Suggest "unreachable"
- **Session purchase** → Auto-convert to customer

### 4.3 Conversion Process Flow
```javascript
async function convertLeadToCustomer(leadId, conversionData) {
  // Session package is REQUIRED
  if (!conversionData.session_package || conversionData.session_package <= 0) {
    throw new Error('Cannot convert lead to customer without session package purchase');
  }
  
  // 1. Start transaction
  await db.beginTransaction();
  
  try {
    const lead = await getLead(leadId);
    const studio = await getStudio(lead.studio_id);
    
    // 2. Create customer record
    const customerId = await createCustomer({
      user_id: null,  // No user account yet
      studio_id: lead.studio_id,
      contact_first_name: lead.name.split(' ')[0],
      contact_last_name: lead.name.split(' ')[1],
      contact_phone: lead.phone_number,
      contact_email: lead.email,
      created_from_lead_id: leadId,
      acquisition_type: 'lead_conversion',
      customer_since: new Date()
    });
    
    // 3. Generate and store registration code
    const registrationCode = `${studio.unique_identifier}-${customerId}`;
    
    await updateCustomer(customerId, {
      registration_code: registrationCode,
      total_sessions_purchased: conversionData.session_package
    });
    
    // 4. Create session package (required)
    await addSessionPackage({
      customer_id: customerId,
      studio_id: lead.studio_id,
      total_sessions: conversionData.session_package,
      remaining_sessions: conversionData.session_package,
      payment_method: conversionData.payment_method,
      is_active: true
    });
    
    // 5. Update lead status
    await updateLead(leadId, {
      status: 'converted',
      is_archived: true,
      converted_to_customer_id: customerId,
      conversion_date: new Date()
    });
    
    // 6. Log activity
    await logActivity({
      lead_id: leadId,
      activity_type: 'conversion',
      description: `Converted to customer with ${conversionData.session_package} sessions. Registration code: ${registrationCode}`
    });
    
    // 7. Send registration instructions
    if (conversionData.sendInstructions) {
      await sendRegistrationInstructions(
        lead.phone_number || lead.email,
        registrationCode,
        conversionData.session_package
      );
    }
    
    await db.commit();
    return { 
      success: true, 
      customerId, 
      registrationCode,
      message: `Customer created with ${conversionData.session_package} sessions. Code: ${registrationCode}`
    };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

// Registration process for customers with codes
async function registerCustomerWithCode(registrationCode, credentials) {
  // Direct lookup by registration code
  const customer = await getCustomerByRegistrationCode(registrationCode);
  
  if (!customer) {
    throw new Error('Invalid registration code');
  }
  
  // All customers have/had sessions by definition
  // Optional: Check if they currently have active sessions
  // if (customer.remaining_sessions === 0) {
  //   // Still allow registration but with limited features
  // }
  
  if (customer.has_app_access) {
    throw new Error('Customer already registered');
  }
  
  // Create user account
  const userId = await createUser({
    email: credentials.email,
    password: credentials.password,
    first_name: customer.contact_first_name,
    last_name: customer.contact_last_name,
    phone: customer.contact_phone,
    role: 'customer'
  });
  
  // Link to customer and mark as having app access
  await updateCustomer(customer.id, {
    user_id: userId,
    has_app_access: true
  });
  
  return { 
    userId, 
    customerId: customer.id, 
    studioId: customer.studio_id,
    remainingSessions: customer.remaining_sessions
  };
}

// Helper function for direct code lookup
async function getCustomerByRegistrationCode(code) {
  return await db.query(
    'SELECT * FROM customers WHERE registration_code = ?',
    [code]
  );
}
```

---

## Phase 5: Data Migration

### 5.1 Migration Scripts
```sql
-- 1. Generate studio unique identifiers
UPDATE studios 
SET unique_identifier = CASE 
    WHEN city = 'Berlin' THEN CONCAT('BER-', id)
    WHEN city = 'Munich' THEN CONCAT('MUC-', id)
    WHEN city = 'Hamburg' THEN CONCAT('HAM-', id)
    WHEN city = 'Frankfurt' THEN CONCAT('FRA-', id)
    ELSE CONCAT('STU-', id)
END
WHERE unique_identifier IS NULL;

-- 2. Generate registration codes for ALL existing customers
UPDATE customers c
SET registration_code = CONCAT(
    (SELECT unique_identifier FROM studios WHERE id = c.studio_id),
    '-',
    c.id
),
total_sessions_purchased = (
    SELECT COALESCE(SUM(total_sessions), 0)
    FROM customer_sessions cs 
    WHERE cs.customer_id = c.id
),
has_app_access = (user_id IS NOT NULL)
WHERE registration_code IS NULL;

-- 3. Update appointments with simplified person types
UPDATE appointments a
SET a.person_type = 'customer'
WHERE a.customer_id IS NOT NULL;

-- 4. Clean up customers without sessions (optional - review case by case)
-- These would be invalid in the new model
SELECT c.id, c.contact_first_name, c.contact_last_name, c.studio_id
FROM customers c
LEFT JOIN customer_sessions cs ON c.id = cs.customer_id
WHERE cs.id IS NULL
GROUP BY c.id;
-- Decision: Either delete these or create minimal session packages

-- 5. Map existing lead statuses
UPDATE leads SET status = CASE
  WHEN status = 'neu' THEN 'new'
  WHEN status = 'kontaktiert' THEN 'working'
  WHEN status = 'konvertiert' THEN 'converted'
  WHEN status = 'nicht_interessiert' THEN 'not_interested'
  ELSE status
END;

-- 6. Set archive flags for terminal states
UPDATE leads 
SET is_archived = TRUE,
    archive_reason = status
WHERE status IN ('converted', 'not_interested', 'lost', 'unreachable', 'wrong_number');

-- 7. Clean up old activation codes system
CREATE TABLE activation_codes_backup AS SELECT * FROM activation_codes;
-- DROP TABLE activation_codes; -- Run after verifying backup
```

---

## Phase 6: Testing & Validation

### 6.1 Test Scenarios
- [ ] Customer creation requires session package
- [ ] Registration code generated on customer creation
- [ ] Registration code stored in database
- [ ] Customer registration with valid code
- [ ] Lead progression through all stages
- [ ] Lead conversion with mandatory session package
- [ ] Block lead conversion without sessions
- [ ] Registration code validation by direct lookup
- [ ] Appointment creation for leads (trial only)
- [ ] Appointment creation for customers (all types)
- [ ] Customer always has registration code
- [ ] Code format: BER-3-456
- [ ] Archive and reactivation
- [ ] Walk-in trial handling
- [ ] Walk-in direct purchase with mandatory sessions
- [ ] Calendar visual distinction (2 types)
- [ ] Search filtering by person type
- [ ] Registration instructions delivery
- [ ] Activity logging
- [ ] Session top-up uses same registration code

### 6.2 Validation Rules
- Registration codes must be unique (stored in database)
- Cannot create customer without session package
- All customers have registration codes from creation
- Customers without user accounts cannot access app
- Cannot register without valid registration code
- Leads can only book Probebehandlung
- Cannot book multiple Probebehandlung for same lead
- Status transitions must follow defined rules
- Customer creation includes session package
- Archived leads cannot be edited (only reactivated)
- Person type must match appointment restrictions
- Registration code never changes for a customer

---

## Phase 7: Analytics & Reporting

### 7.1 Key Metrics
```javascript
// Conversion funnel metrics
{
  "new_to_working": 0.75,        // 75% of new leads get contacted
  "working_to_qualified": 0.60,   // 60% of contacted are qualified
  "qualified_to_trial": 0.50,     // 50% of qualified book trial
  "trial_to_customer": 0.80,      // 80% of trials convert
  "overall_conversion": 0.18      // 18% total conversion rate
}
```

### 7.2 Dashboard Components
- Kanban column counters
- Conversion funnel visualization
- Average time per stage
- Lead source effectiveness
- Team member performance
- Trial success rate
- Customer app registration rate
- Registration code usage rate
- Average sessions per customer
- Active vs inactive customers
- Customers with/without app access
- Direct purchase vs lead conversion ratio
- Time from customer creation to app registration

---

## Implementation Timeline

### Week 1 (Database & Backend Foundation) ✅ COMPLETED
- [x] Day 1-2: Database schema updates
- [x] Day 2-3: Migration scripts and testing
- [x] Day 3-4: Kanban API endpoints
- [x] Day 4-5: Search and appointment APIs

### Week 2 (Frontend Kanban) ✅ COMPLETED
- [x] Day 1-2: Kanban board layout
- [x] Day 2-3: Drag-and-drop functionality
- [x] Day 3-4: Inline scheduling modal (trial appointment)
- [x] Day 4-5: Archive panel and filtering

### Week 3 (Conversion & Integration) 🚧 IN PROGRESS
- [x] Day 1-2: Conversion modal (simplified - status change only)
- [ ] Day 2-3: Walk-in workflows
- [ ] Day 3-4: Calendar updates (visual distinctions)
- [ ] Day 4-5: Activity logging

### Week 4 (Testing & Polish)
- [ ] Day 1-2: End-to-end testing
- [ ] Day 2-3: Bug fixes and refinements
- [ ] Day 3-4: Analytics implementation
- [ ] Day 4-5: Documentation and training

---

## Success Criteria
- ✅ Lead to customer conversion rate >40%
- ✅ Average lead response time <24 hours
- ✅ Zero orphaned appointments
- ✅ 100% data integrity maintained
- ✅ All status transitions validated
- ✅ Visual distinction clear in calendar
- ✅ User satisfaction score >4.5/5

---

## Risk Mitigation
1. **Data Migration**: Full backup before migration
2. **Performance**: Index all foreign keys and search fields
3. **User Training**: Create video tutorials for new workflows
4. **Rollback Plan**: Keep old lead UI accessible during transition

---

## Notes & Considerations
- Registration codes format: `{studio_id}-{customer_id}` (e.g., BER-3-456)
- Registration codes are stored in database for fast lookup
- Customer = Has purchased sessions (no customer without sessions)
- Registration code generated immediately on customer creation
- Customer creation requires session package purchase
- Manual conversion only (no auto-conversion after trial)
- Archive states are terminal but can be reactivated
- "Kunde Geworden" is an archive state, not active pipeline
- Walk-ins must purchase sessions to become customers
- All actions are logged for audit trail
- Clear business model: Buy sessions = Become customer = Get registration code

---

## Person Types Summary

### Customers (Have/Had Sessions)
- **Must purchase sessions to become customer**
- Registration code generated on creation: `BER-3-456`
- Code stored in database permanently
- Can register on app anytime after creation
- Two states:
  - **With App Access**: Have user account, use mobile app
  - **Without App Access**: No user account yet, managed by studio

### Leads (Potential Customers)
- Have not purchased sessions yet
- Can book trial appointments only
- Convert to customer by purchasing sessions
- Tracked in Kanban pipeline
- Cannot have registration code (not customers)

## Registration Flow
1. **Lead → Customer** (must purchase sessions)
2. **Customer Creation** → Registration Code Generated & Stored
3. **Customer + App Download** → Enter Code → App Access
4. **Core Rule: No Sessions = Not a Customer = No Code**

---

## Phase 8: Email-Based Registration System (Simplified - No Subscriptions)

### Overview
Replace manager code system with email verification for studio owners. Keep customer registration simple with optional email verification. No subscription logic to avoid complexity during development.

### 8.1 Database Changes (Minimal)
```sql
-- Migration 009: Add email verification fields
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE AFTER role,
ADD COLUMN email_verification_token VARCHAR(255) AFTER email_verified,
ADD COLUMN email_verification_expires TIMESTAMP NULL AFTER email_verification_token,
ADD INDEX idx_email_verification (email_verification_token);

-- Mark all existing users as verified (they're already active)
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL;
```

### 8.2 Email Service Setup
```javascript
// Dependencies: npm install nodemailer
// Email service using Gmail SMTP
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Environment variables needed:
// EMAIL_USER=your-app@gmail.com
// EMAIL_APP_PASSWORD=your-app-specific-password
// FRONTEND_URL=https://your-frontend.com
```

### 8.3 Studio Registration Flow (Email Verification)

#### POST /api/v1/auth/register-studio
```javascript
// Request
{
  "email": "owner@studio.com",
  "password": "SecurePassword123",
  "firstName": "Max",
  "lastName": "Mustermann",
  "phone": "+49176123456",
  "studioName": "AiL Berlin Mitte",
  "studioAddress": "Hauptstraße 1, 10115 Berlin",
  "studioCity": "Berlin"
}

// Process:
// 1. Create user with role='studio_owner', email_verified=false
// 2. Generate verification token
// 3. Send verification email
// 4. Create inactive studio record
// 5. Activate both on email verification

// Response
{
  "message": "Registration successful. Please check your email to verify your account.",
  "requiresVerification": true
}
```

#### GET /api/v1/auth/verify-email/:token
```javascript
// Verifies email and activates account
// Response: JWT token for auto-login
```

### 8.4 Customer Registration (Optional Email Verification)

Keep existing registration code system as primary method:
1. Customer receives code from studio: `BER-456`
2. Registers with code + email + password
3. **Optional**: Send verification email for security
4. Customer can use app immediately (no waiting for email)

```javascript
// Enhanced customer registration
POST /api/v1/auth/register-customer
{
  "registrationCode": "BER-456",
  "email": "customer@email.com",
  "password": "password123",
  "sendVerificationEmail": true  // Optional
}
```

### 8.5 What We're NOT Adding (Keeping It Simple)
- ❌ No subscription plans or tiers
- ❌ No payment processing
- ❌ No feature restrictions based on plans
- ❌ No customer app access control
- ❌ All studios have same features

### 8.6 Benefits of This Approach
1. **Removes manager codes** - No need to pre-generate codes
2. **Self-service studio registration** - Studios can sign up directly
3. **Simple implementation** - Just email sending, no complex logic
4. **Doesn't disrupt testing** - No subscription states to mock
5. **Easy to add subscriptions later** - When ready for production

### 8.7 Implementation Priority
1. Core Lead Kanban features (Phase 3-7) remain top priority
2. Email verification is secondary enhancement
3. Can be implemented in parallel without disrupting main features

---

*Last Updated: 2025-01-10*
*Status: Ready for Implementation - Simplified Model*
*Key Changes: Customers must have sessions, registration codes stored in DB, email verification for studios (no subscriptions)*