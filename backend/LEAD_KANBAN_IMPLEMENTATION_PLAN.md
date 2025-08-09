# Comprehensive Implementation Plan: Lead Management Kanban + Unified Appointment System

## Overview
This document outlines the complete implementation plan for the enhanced lead management system with Kanban board visualization and unified appointment scheduling that supports both leads and customers.

## Key Features
- 4-stage active lead pipeline with drag-and-drop
- Archived states for completed/lost leads
- Inline appointment scheduling for leads
- Smart conversion modal for lead-to-customer transformation
- Visual distinction between lead and customer appointments
- Walk-in customer handling workflows

---

## Phase 1: Database Foundation (Priority: HIGH)

### 1.1 Lead Status Enhancement
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

### 1.2 Appointments Table Enhancement
```sql
-- Add lead support to appointments
ALTER TABLE appointments 
ADD COLUMN lead_id INT NULL AFTER customer_id,
ADD COLUMN person_type ENUM('customer', 'lead') NOT NULL DEFAULT 'customer' AFTER lead_id,
ADD INDEX idx_appointment_lead (lead_id),
ADD INDEX idx_appointment_person_type (person_type, appointment_date),
ADD CONSTRAINT fk_appointment_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Update existing appointments
UPDATE appointments SET person_type = 'customer' WHERE customer_id IS NOT NULL;

-- Add check constraint after migration
ALTER TABLE appointments 
ADD CONSTRAINT chk_person_reference CHECK (
  (person_type = 'customer' AND customer_id IS NOT NULL AND lead_id IS NULL) OR
  (person_type = 'lead' AND lead_id IS NOT NULL AND customer_id IS NULL)
);
```

### 1.3 Lead Activities Tracking
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

### 1.4 Customer Table Enhancement
```sql
ALTER TABLE customers 
ADD COLUMN created_from_lead_id INT NULL AFTER studio_id,
ADD COLUMN acquisition_type ENUM('lead_conversion', 'direct_purchase', 'online_registration') 
  DEFAULT 'direct_purchase' AFTER created_from_lead_id,
ADD INDEX idx_customer_lead_source (created_from_lead_id),
ADD FOREIGN KEY (created_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;
```

---

## Phase 2: Backend API Development

### 2.1 Lead Kanban Endpoints

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
Converts lead to customer with session package
```javascript
// Request body
{
  "create_account": true,
  "email": "max@example.com",
  "password": "auto_generated",
  "session_package": 20,
  "payment_method": "cash",
  "notes": "Eager to start"
}
```

### 2.2 Unified Search Endpoints

#### GET /api/v1/search/persons
Search persons based on appointment type
```javascript
// Query params
?type=probebehandlung&query=max&studio_id=3

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
      "can_book": true,
      "color": "#007bff"
    }
  ]
}
```

### 2.3 Enhanced Appointment Endpoints

#### POST /api/v1/appointments
Create appointment for lead or customer
```javascript
// Request body for lead
{
  "studio_id": 3,
  "person_type": "lead",
  "lead_id": 123,
  "appointment_type_id": 3, // Probebehandlung
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
// Modal structure for lead conversion
{
  title: "Lead zu Kunde konvertieren",
  lead: { name, phone, email },
  accountCreation: {
    email: "editable",
    password: "auto_generated"
  },
  sessionPackages: [10, 20, 30, 40],
  paymentMethods: ["cash", "transfer", "card"],
  notes: "optional",
  actions: ["Abbrechen", "Kunde erstellen"]
}
```

### 3.4 Calendar Visual Updates
```css
/* Lead appointments */
.appointment-lead {
  border-left: 4px solid #007bff;
  background: linear-gradient(90deg, #e3f2fd 0%, white 10%);
}

/* Customer appointments */
.appointment-customer {
  border-left: 4px solid #28a745;
  background: linear-gradient(90deg, #e8f5e9 0%, white 10%);
}

/* Visual indicators */
.appointment-icon-lead: 🔷
.appointment-icon-customer: ⭐
```

### 3.5 Walk-in Workflows

#### Walk-in for Trial
1. Click [+ Neuer Termin]
2. Select [Neuer Lead - Probe]
3. Fill lead details + schedule
4. Creates lead in "trial_scheduled" status

#### Walk-in Direct Purchase
1. Click [+ Neuer Termin]
2. Select [Walk-in Direktkauf]
3. Fill customer details + session package
4. Creates customer with sessions
5. Optional: Schedule first appointment

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
  // 1. Start transaction
  await db.beginTransaction();
  
  try {
    // 2. Create user account
    const userId = await createUser({
      email: conversionData.email,
      password: conversionData.password,
      first_name: lead.name.split(' ')[0],
      last_name: lead.name.split(' ')[1],
      phone: lead.phone_number,
      role: 'customer'
    });
    
    // 3. Create customer record
    const customerId = await createCustomer({
      user_id: userId,
      studio_id: lead.studio_id,
      created_from_lead_id: leadId,
      acquisition_type: 'lead_conversion'
    });
    
    // 4. Add session package
    await addSessionPackage({
      customer_id: customerId,
      studio_id: lead.studio_id,
      total_sessions: conversionData.session_package,
      remaining_sessions: conversionData.session_package,
      is_active: true
    });
    
    // 5. Update lead
    await updateLead(leadId, {
      status: 'converted',
      is_archived: true,
      converted_to_user_id: userId,
      conversion_date: new Date()
    });
    
    // 6. Log activity
    await logActivity({
      lead_id: leadId,
      activity_type: 'conversion',
      description: `Converted to customer with ${conversionData.session_package} sessions`
    });
    
    await db.commit();
    return { success: true, customerId };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}
```

---

## Phase 5: Data Migration

### 5.1 Migration Scripts
```sql
-- 1. Update existing appointments
UPDATE appointments 
SET person_type = 'customer' 
WHERE customer_id IS NOT NULL;

-- 2. Map existing lead statuses to new enum values
UPDATE leads SET status = CASE
  WHEN status = 'neu' THEN 'new'
  WHEN status = 'kontaktiert' THEN 'working'
  WHEN status = 'konvertiert' THEN 'converted'
  WHEN status = 'nicht_interessiert' THEN 'not_interested'
  ELSE status
END;

-- 3. Set archive flags for terminal states
UPDATE leads 
SET is_archived = TRUE,
    archive_reason = status
WHERE status IN ('converted', 'not_interested', 'lost', 'unreachable', 'wrong_number');

-- 4. Initialize stage_entered_at
UPDATE leads 
SET stage_entered_at = updated_at 
WHERE stage_entered_at IS NULL;
```

---

## Phase 6: Testing & Validation

### 6.1 Test Scenarios
- [ ] Lead progression through all stages
- [ ] Drag-and-drop with validation
- [ ] Inline scheduling modal
- [ ] Appointment creation for leads
- [ ] Appointment creation for customers
- [ ] Lead to customer conversion
- [ ] Archive and reactivation
- [ ] Walk-in trial handling
- [ ] Walk-in direct purchase
- [ ] Calendar visual distinction
- [ ] Search filtering by appointment type
- [ ] Bulk operations
- [ ] Activity logging

### 6.2 Validation Rules
- Cannot book Behandlung for leads
- Cannot book multiple Probebehandlung for same lead
- Status transitions must follow defined rules
- Appointments must update lead status correctly
- Conversion must create all required records
- Archived leads cannot be edited (only reactivated)
- Person type must match appointment type

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
- Direct vs converted customer ratio

---

## Implementation Timeline

### Week 1 (Database & Backend Foundation)
- [ ] Day 1-2: Database schema updates
- [ ] Day 2-3: Migration scripts and testing
- [ ] Day 3-4: Kanban API endpoints
- [ ] Day 4-5: Search and appointment APIs

### Week 2 (Frontend Kanban)
- [ ] Day 1-2: Kanban board layout
- [ ] Day 2-3: Drag-and-drop functionality
- [ ] Day 3-4: Inline scheduling modal
- [ ] Day 4-5: Archive panel and filtering

### Week 3 (Conversion & Integration)
- [ ] Day 1-2: Conversion modal
- [ ] Day 2-3: Walk-in workflows
- [ ] Day 3-4: Calendar updates
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
- Manual conversion only (no auto-conversion after trial)
- Archive states are terminal but can be reactivated
- "Kunde Geworden" is an archive state, not active pipeline
- Walk-ins can enter at different points in the flow
- All actions are logged for audit trail

---

*Last Updated: 2025-01-09*
*Status: Ready for Implementation*