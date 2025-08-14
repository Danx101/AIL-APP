# Customer Management & Appointment System Fix Plan

## Current Issues Identified

### 1. Customer Name Display (undefined undefined)
- **Root Cause:** Frontend accessing wrong field names (`first_name`/`last_name` instead of `contact_first_name`/`contact_last_name`)
- **Affected Files:** 
  - `frontend/public/src/components/studio/CustomerManagement.js`
  - `frontend/public/src/app.js`

### 2. Session Blocks Not Activating
- **Root Cause:** Backend activation date logic not working correctly
- **Affected Files:**
  - `backend/src/controllers/customerController.js`
  - Session block status management

### 3. API Errors (404, 400, 500)
- **404 Error:** Missing routes or incorrect endpoint paths
- **400 Error:** Session addition validation issues
- **500 Error:** Appointments API joining wrong table (`users` instead of `customers`)
- **Affected Files:**
  - `backend/src/routes/appointments.js`
  - `backend/server.js`

### 4. Appointment Scheduling UX Issues
- Dropdown not scalable for many customers
- Basic date/time inputs lack user-friendliness
- No visual feedback for available time slots
- Missing appointment type details during selection

### 5. Lead Trial Scheduling Issues
- No proper integration between lead trials and appointment system
- Missing conflict detection for probebehandlung appointments
- No automatic status update when trial is scheduled

## Database Structure Analysis

### Current Tables Structure

#### appointments table
```sql
- id
- studio_id
- customer_id (references users.id - CRITICAL ISSUE!)
- lead_id (for lead appointments)
- person_type (customer/lead)
- appointment_type_id
- appointment_date
- start_time
- end_time
- status
- notes
- session_consumed (boolean flag)
- created_by_user_id
- created_at
- updated_at
```

#### customers table
```sql
- id
- studio_id
- contact_first_name
- contact_last_name
- contact_phone
- contact_email
- registration_code
- has_app_access
- customer_since
- acquisition_type
- notes
```

#### customer_sessions table
```sql
- id
- customer_id
- studio_id
- block_type
- total_sessions
- remaining_sessions
- status (active/pending/completed/expired)
- activation_date
- expiry_date
- purchase_date
- payment_method
- notes
```

#### appointment_types table
```sql
- id
- studio_id
- name
- duration_minutes
- consumes_session (boolean)
- is_probebehandlung (boolean)
- max_per_customer
- description
- color
- is_active
```

#### studios table
```sql
- id
- name
- owner_id
- machine_count (number of machines available)
- address
- business_hours
- (other fields...)
```

### Critical Database Issues Identified

1. **Major Issue:** `appointments.customer_id` references `users.id` but studio customers are in `customers` table
2. **Missing relationship:** No direct link between appointments and customer_sessions for proper session consumption tracking
3. **No appointment-session link:** Session consumption is tracked only by boolean flag, not which block was used
4. **Machine capacity not considered:** No tracking of concurrent appointments vs available machines

## Session Consumption & Machine Dependency Explanation

### How Session Consumption Should Work

1. **Session Block Selection:**
   - When appointment is created, system identifies active session block
   - Links appointment to specific session block via `session_block_id`
   - Records how many sessions will be consumed (usually 1, but configurable)

2. **Consumption Process:**
   ```sql
   -- When appointment status changes to 'completed' or 'no_show'
   UPDATE customer_sessions 
   SET remaining_sessions = remaining_sessions - 1
   WHERE id = [session_block_id];
   
   -- Record in appointments table
   UPDATE appointments 
   SET session_consumed = TRUE,
       sessions_consumed_count = 1,
       session_block_id = [block_id]
   WHERE id = [appointment_id];
   ```

3. **Block Activation:**
   - When active block reaches 0 sessions → mark as 'completed'
   - Automatically activate next pending block if exists
   - Update activation_date on the newly activated block

### Machine Quantity Dependency

1. **Capacity Check During Scheduling:**
   ```sql
   -- Check concurrent appointments for a time slot
   SELECT COUNT(*) as concurrent_appointments
   FROM appointments 
   WHERE studio_id = [studio_id]
     AND appointment_date = [date]
     AND status NOT IN ('cancelled', 'storniert')
     AND (
       ([start_time] >= start_time AND [start_time] < end_time) OR
       ([end_time] > start_time AND [end_time] <= end_time)
     );
   
   -- Compare with studio machine_count
   IF concurrent_appointments >= studio.machine_count THEN
     -- Block this time slot
   END IF;
   ```

2. **Visual Indicators:**
   - Green: Available slots (< 50% capacity)
   - Yellow: Limited availability (50-80% capacity)
   - Red: Near/at capacity (> 80% capacity)
   - Gray: Fully booked

## Proposed Solutions

### Phase 1: Critical Database Fixes (Immediate)

#### 1.1 Create Migration for Appointments Table
```sql
-- Migration 013: Fix appointments customer reference and add session tracking
ALTER TABLE appointments 
  ADD COLUMN customer_ref_id INT AFTER customer_id,
  ADD COLUMN session_block_id INT AFTER person_type,
  ADD COLUMN sessions_consumed_count INT DEFAULT 1 AFTER session_consumed,
  ADD FOREIGN KEY (customer_ref_id) REFERENCES customers(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (session_block_id) REFERENCES customer_sessions(id) ON DELETE SET NULL;

-- Migrate existing customer appointments to use customers table
UPDATE appointments a
JOIN users u ON a.customer_id = u.id
JOIN customers c ON c.contact_email = u.email AND c.studio_id = a.studio_id
SET a.customer_ref_id = c.id
WHERE a.person_type = 'customer';

-- Add index for performance
CREATE INDEX idx_appointment_timeslot ON appointments(studio_id, appointment_date, start_time, end_time, status);
```

#### 1.2 Fix Customer Name Display
```javascript
// Update all references in frontend
// FROM: customer.first_name, customer.last_name
// TO: customer.contact_first_name, customer.contact_last_name
```

#### 1.3 Fix Session Block Activation
```javascript
// In customerController.js addSessions method
const blockStatus = activeBlock ? 'pending' : 'active';
const activationDate = activeBlock ? null : new Date().toISOString();

// Auto-activate pending block when active block is completed
if (activeBlock && activeBlock.remaining_sessions === 0) {
  await db.run('UPDATE customer_sessions SET status = "completed" WHERE id = ?', [activeBlock.id]);
  const pendingBlock = await db.get('SELECT * FROM customer_sessions WHERE customer_id = ? AND status = "pending" ORDER BY purchase_date LIMIT 1', [customerId]);
  if (pendingBlock) {
    await db.run('UPDATE customer_sessions SET status = "active", activation_date = CURRENT_TIMESTAMP WHERE id = ?', [pendingBlock.id]);
  }
}
```

### Phase 2: Appointment System Improvements

#### 2.1 Fix Appointment API Queries
```javascript
// Update all appointment queries to use customers table
const query = `
  SELECT 
    a.*,
    c.contact_first_name as customer_first_name,
    c.contact_last_name as customer_last_name,
    c.contact_email as customer_email,
    c.contact_phone as customer_phone,
    cs.remaining_sessions,
    at.name as appointment_type_name,
    at.duration_minutes,
    at.consumes_session,
    s.machine_count
  FROM appointments a
  LEFT JOIN customers c ON a.customer_ref_id = c.id
  LEFT JOIN leads l ON a.lead_id = l.id
  LEFT JOIN customer_sessions cs ON cs.customer_id = c.id AND cs.status = 'active'
  LEFT JOIN appointment_types at ON a.appointment_type_id = at.id
  LEFT JOIN studios s ON a.studio_id = s.id
  WHERE a.studio_id = ?
`;
```

#### 2.2 Implement Session Consumption Logic
```javascript
async function consumeSessionForAppointment(appointmentId) {
  // Get appointment details
  const appointment = await db.get(`
    SELECT a.*, c.id as customer_id, at.consumes_session
    FROM appointments a
    JOIN customers c ON a.customer_ref_id = c.id
    JOIN appointment_types at ON a.appointment_type_id = at.id
    WHERE a.id = ?
  `, [appointmentId]);
  
  if (!appointment.consumes_session) return;
  
  // Get active session block
  const activeBlock = await db.get(`
    SELECT * FROM customer_sessions 
    WHERE customer_id = ? AND status = 'active' AND remaining_sessions > 0
  `, [appointment.customer_id]);
  
  if (!activeBlock) {
    throw new Error('No active session block available');
  }
  
  // Consume session
  await db.run('UPDATE customer_sessions SET remaining_sessions = remaining_sessions - 1 WHERE id = ?', [activeBlock.id]);
  await db.run('UPDATE appointments SET session_consumed = TRUE, session_block_id = ?, sessions_consumed_count = 1 WHERE id = ?', [activeBlock.id, appointmentId]);
  
  // Check if block is now empty and activate next
  if (activeBlock.remaining_sessions === 1) {
    await activateNextBlock(appointment.customer_id);
  }
}
```

#### 2.3 Machine Capacity Check
```javascript
async function checkMachineAvailability(studioId, date, startTime, endTime, excludeAppointmentId = null) {
  const query = `
    SELECT COUNT(*) as count 
    FROM appointments 
    WHERE studio_id = ? 
      AND appointment_date = ?
      AND status NOT IN ('cancelled', 'storniert')
      ${excludeAppointmentId ? 'AND id != ?' : ''}
      AND (
        (? >= start_time AND ? < end_time) OR
        (? > start_time AND ? <= end_time) OR
        (start_time >= ? AND start_time < ?) OR
        (end_time > ? AND end_time <= ?)
      )
  `;
  
  const params = excludeAppointmentId 
    ? [studioId, date, excludeAppointmentId, startTime, startTime, endTime, endTime, startTime, endTime, startTime, endTime]
    : [studioId, date, startTime, startTime, endTime, endTime, startTime, endTime, startTime, endTime];
  
  const result = await db.get(query, params);
  const studio = await db.get('SELECT machine_count FROM studios WHERE id = ?', [studioId]);
  
  return {
    concurrent: result.count,
    capacity: studio.machine_count || 1,
    available: result.count < (studio.machine_count || 1)
  };
}
```

### Phase 3: Lead Trial Scheduling Improvements

#### 3.1 Probebehandlung Integration
```javascript
// When scheduling trial for lead
async function scheduleTrialAppointment(leadId, appointmentData) {
  // Get probebehandlung appointment type
  const trialType = await db.get(`
    SELECT * FROM appointment_types 
    WHERE studio_id = ? AND is_probebehandlung = 1 AND is_active = 1
  `, [studioId]);
  
  if (!trialType) {
    throw new Error('No trial appointment type configured');
  }
  
  // Check lead hasn't already had trial
  const existingTrial = await db.get(`
    SELECT * FROM appointments 
    WHERE lead_id = ? AND appointment_type_id = ?
  `, [leadId, trialType.id]);
  
  if (existingTrial) {
    throw new Error('Lead has already scheduled/completed a trial');
  }
  
  // Check machine availability
  const availability = await checkMachineAvailability(
    studioId, 
    appointmentData.date, 
    appointmentData.startTime, 
    appointmentData.endTime
  );
  
  if (!availability.available) {
    throw new Error('No machines available at this time');
  }
  
  // Create appointment
  await db.run(`
    INSERT INTO appointments (
      studio_id, lead_id, person_type, appointment_type_id,
      appointment_date, start_time, end_time, status
    ) VALUES (?, ?, 'lead', ?, ?, ?, ?, 'confirmed')
  `, [studioId, leadId, trialType.id, appointmentData.date, appointmentData.startTime, appointmentData.endTime]);
  
  // Update lead status
  await db.run(`
    UPDATE leads SET status = 'trial_scheduled' WHERE id = ?
  `, [leadId]);
}
```

#### 3.2 Trial Availability Calendar
```javascript
// Get available trial slots for next 2 weeks
async function getAvailableTrialSlots(studioId) {
  const slots = [];
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);
  
  const studio = await db.get('SELECT machine_count, business_hours FROM studios WHERE id = ?', [studioId]);
  const businessHours = JSON.parse(studio.business_hours || '{}');
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
    const dayHours = businessHours[dayName];
    
    if (!dayHours || dayHours.closed) continue;
    
    // Get all appointments for this day
    const appointments = await db.all(`
      SELECT start_time, end_time 
      FROM appointments 
      WHERE studio_id = ? AND appointment_date = ? 
        AND status NOT IN ('cancelled', 'storniert')
      ORDER BY start_time
    `, [studioId, dateStr]);
    
    // Generate 60-minute slots (for probebehandlung)
    const availableSlots = generateAvailableSlots(
      dayHours.open, 
      dayHours.close, 
      60, 
      appointments, 
      studio.machine_count
    );
    
    if (availableSlots.length > 0) {
      slots.push({
        date: dateStr,
        slots: availableSlots
      });
    }
  }
  
  return slots;
}
```

### Phase 4: UI/UX Improvements

#### 4.1 Enhanced Customer Selection
```javascript
// CustomerSelector.js component
class CustomerSelector {
  constructor() {
    this.selectedCustomer = null;
    this.searchTerm = '';
  }
  
  render() {
    return `
      <div class="customer-selector">
        <div class="input-group">
          <input type="text" 
                 class="form-control" 
                 placeholder="Search customer by name or phone..."
                 id="customer-search-input">
          <button class="btn btn-outline-secondary" 
                  onclick="customerSelector.openSearchModal()">
            <i class="bi bi-search"></i> Browse
          </button>
        </div>
        <div id="customer-search-results" class="search-results-dropdown"></div>
        <div class="selected-customer-info mt-2" id="selected-customer-info"></div>
      </div>
    `;
  }
  
  async searchCustomers(term) {
    const customers = await fetch(`/api/v1/studios/${studioId}/customers?search=${term}&hasActiveSessions=true`);
    return customers.filter(c => c.remaining_sessions > 0);
  }
  
  renderSearchResults(customers) {
    return customers.map(c => `
      <div class="search-result-item" onclick="customerSelector.selectCustomer(${c.id})">
        <strong>${c.contact_first_name} ${c.contact_last_name}</strong>
        <span class="badge bg-success">${c.remaining_sessions} sessions</span>
        <small class="text-muted d-block">${c.contact_phone}</small>
      </div>
    `).join('');
  }
}
```

#### 4.2 Time Slot Grid
```javascript
// TimeSlotPicker.js component
class TimeSlotPicker {
  async renderAvailableSlots(studioId, date, appointmentTypeId) {
    const availability = await this.checkDayAvailability(studioId, date);
    const slots = this.generateTimeSlots();
    
    return `
      <div class="time-slot-grid">
        ${slots.map(slot => {
          const status = this.getSlotStatus(slot, availability);
          return `
            <button class="time-slot ${status}" 
                    onclick="timeSlotPicker.selectSlot('${slot.time}')"
                    ${status === 'unavailable' ? 'disabled' : ''}>
              <div class="slot-time">${slot.time}</div>
              <div class="slot-status">
                ${status === 'available' ? '✓ Available' : 
                  status === 'limited' ? `${availability.remaining} left` : 
                  'Full'}
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }
  
  getSlotStatus(slot, availability) {
    const concurrent = availability[slot.time] || 0;
    const capacity = availability.machineCount;
    
    if (concurrent >= capacity) return 'unavailable';
    if (concurrent >= capacity * 0.8) return 'limited';
    return 'available';
  }
}
```

#### 4.3 Multi-Step Appointment Form
```javascript
// AppointmentWizard.js
class AppointmentWizard {
  constructor() {
    this.steps = ['customer', 'service', 'datetime', 'confirm'];
    this.currentStep = 0;
  }
  
  render() {
    return `
      <div class="appointment-wizard">
        <div class="wizard-progress">
          ${this.steps.map((step, i) => `
            <div class="step ${i <= this.currentStep ? 'active' : ''}">
              <div class="step-number">${i + 1}</div>
              <div class="step-label">${step}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="wizard-content">
          ${this.renderCurrentStep()}
        </div>
        
        <div class="wizard-actions">
          <button class="btn btn-secondary" 
                  onclick="wizard.previousStep()"
                  ${this.currentStep === 0 ? 'disabled' : ''}>
            Previous
          </button>
          <button class="btn btn-primary" 
                  onclick="wizard.nextStep()">
            ${this.currentStep === this.steps.length - 1 ? 'Confirm' : 'Next'}
          </button>
        </div>
      </div>
    `;
  }
}
```

## Implementation Timeline

### Week 1: Critical Fixes
- [x] Day 1: Analyze all issues and create comprehensive plan
- [ ] Day 2: Fix customer name field mappings
- [ ] Day 3: Create and run database migration for appointments
- [ ] Day 4: Fix session block activation logic
- [ ] Day 5: Fix appointments API to use customers table

### Week 2: Core Functionality
- [ ] Day 1-2: Implement proper session consumption tracking
- [ ] Day 3: Add machine capacity checking
- [ ] Day 4: Fix lead trial scheduling
- [ ] Day 5: Testing and bug fixes

### Week 3: UI Components
- [ ] Day 1-2: Create CustomerSelector component
- [ ] Day 3-4: Implement TimeSlotPicker with availability
- [ ] Day 5: Build appointment wizard

### Week 4: Integration & Polish
- [ ] Day 1-2: Integrate all new components
- [ ] Day 3: Add conflict detection and warnings
- [ ] Day 4: Implement visual calendar improvements
- [ ] Day 5: Final testing and deployment

## Testing Checklist

### Database & Backend
- [ ] Customer reference migration successful
- [ ] Session consumption tracking works
- [ ] Machine capacity limits enforced
- [ ] Block activation automatic
- [ ] Lead trials create correct appointments

### Customer Management
- [ ] Customer names display correctly everywhere
- [ ] Session blocks activate/deactivate properly
- [ ] Can't add pending block when one exists
- [ ] Session counts update correctly

### Appointments
- [ ] Can create appointment with customer (not user)
- [ ] Shows correct customer information
- [ ] Time slots respect machine capacity
- [ ] Sessions consumed from correct block
- [ ] Status updates trigger proper actions
- [ ] Cancellation/rescheduling works

### Lead Trials
- [ ] Probebehandlung appointments created correctly
- [ ] Lead status updates to trial_scheduled
- [ ] Only one trial per lead allowed
- [ ] Trial doesn't consume customer sessions

### UI/UX
- [ ] Customer search returns active customers only
- [ ] Time slots show real availability
- [ ] Visual indicators for capacity
- [ ] Form validation prevents errors
- [ ] Error messages are helpful

## Notes for Development

1. **Data Integrity:** Always check existing data before migrations
2. **Backward Compatibility:** Keep old fields temporarily during transition
3. **Session Management:** Never allow negative session counts
4. **Timezone Handling:** Store in UTC, display in local
5. **Concurrency:** Use transactions for critical operations
6. **Performance:** Add indexes for common queries
7. **Validation:** Check both frontend and backend

## Success Metrics

- Zero undefined customer names
- All session blocks activate/deactivate correctly
- No 404/500 errors in normal operation
- Machine capacity never exceeded
- Appointment creation time < 30 seconds
- Lead trial conversion rate improvement
- Customer satisfaction with new UI

## Risk Mitigation

1. **Database Migration Risks:**
   - Backup database before migration
   - Test migration on copy first
   - Have rollback script ready

2. **Session Consumption Errors:**
   - Add audit log for all consumption
   - Daily reconciliation report
   - Manual adjustment capability

3. **Machine Overbooking:**
   - Real-time capacity checking
   - Soft limits with warnings
   - Admin override capability

## Future Enhancements (Post-MVP)

1. **Smart Scheduling:** AI-powered optimal time slot suggestions
2. **Recurring Appointments:** Weekly/monthly templates
3. **Waiting List:** Automatic filling of cancelled slots
4. **SMS/Email Reminders:** Automated notifications
5. **Analytics Dashboard:** Utilization and revenue metrics
6. **Mobile App Integration:** Real-time sync
7. **Multi-Studio Support:** Cross-location booking
8. **Resource Management:** Track equipment/room usage
9. **Staff Assignment:** Assign trainers to appointments
10. **Package Deals:** Bundle sessions with discounts