# Business Requirements - Abnehmen im Liegen Backend

*Comprehensive business logic and requirements documentation*

## Core Business Model

### **Studio Management System**
- **Managers** create studios and manage operations
- **Studio Owners** manage their specific studio(s)
- **Customers** book and attend treatments

### **Session-Based Treatment System**
Customers purchase session blocks (packages) containing multiple treatments, which are consumed as they attend appointments.

---

## Session Block Management

### **Session Block Rules**
- **Single Active Block**: Only ONE `customer_sessions` record with `is_active=1` per customer at any time
- **Queue System**: Additional blocks are added with `is_active=0` and wait in queue
- **Automatic Progression**: When active block reaches `remaining_sessions=0`, next block in queue becomes active
- **Booking Prevention**: Cannot schedule "Behandlung" when `remaining_sessions=0` (no active sessions)

### **Session Block Sizes**
- 10, 20, 30, or 40 sessions per block
- Purchased in-studio (no online transactions)
- Studio owner manually adds blocks when customer pays

### **Session Consumption Logic**
```
✅ Session Consumed:
- Behandlung completed ("absolviert")
- Customer no-show ("nicht erschienen") 
- Customer cancels <48 hours before appointment

❌ Session NOT Consumed:
- Beratung (always free)
- Probebehandlung (always free)
- Studio owner cancels appointment
- Customer cancels ≥48 hours before appointment
```

---

## Appointment System

### **Appointment Types**

#### **1. Behandlung (Treatment)**
- **Duration**: 60 minutes
- **Session Cost**: Consumes 1 session from active block
- **Booking**: Requires active session block with remaining_sessions > 0
- **Purpose**: Main treatment service

#### **2. Beratung (Consultation)**
- **Duration**: 20 minutes (updated from 30 minutes)
- **Session Cost**: FREE - no session consumption
- **Booking**: Always available to any customer
- **Purpose**: Consultation and advice

#### **3. Probebehandlung (Trial Treatment)**
- **Duration**: 60 minutes
- **Session Cost**: FREE - no session consumption
- **Booking**: 1 per customer per studio (lifetime limit)
- **Purpose**: Trial treatment for new customers
- **UI Display**: 
  - Available: "Probebehandlung (1)"
  - Used: "Probebehandlung (0)" with message "Probebehandlung bereits verwendet"

### **Appointment Status Workflow**

#### **Status Options**
```
"bestätigt"        → Default when scheduled by studio owner
"absolviert"       → Completed treatment (manually set by studio owner)
"nicht erschienen" → Customer no-show (manually set by studio owner)
"storniert"        → Cancelled appointment
```

#### **Status Change Rules**
- **Studio Owner Actions**:
  - Schedule appointment → "bestätigt"
  - Mark completed → "absolviert" (consumes session if applicable)
  - Mark no-show → "nicht erschienen" (consumes session if applicable)
  - Cancel appointment → "storniert" (no session consumed)

- **Customer Actions** (current scope: cancellation only):
  - Cancel ≥48 hours ahead → "storniert" (no session consumed)
  - Cancel <48 hours ahead → "storniert" (session consumed if applicable)

- **System Actions**:
  - Past appointments remain "bestätigt" until manually updated
  - No automatic status changes based on time

### **Cancellation Policy**
- **Studio Owner Cancellation**: Never consumes sessions
- **Customer Cancellation**:
  - ≥48 hours in advance: No session consumed
  - <48 hours in advance: Session consumed (if appointment type requires sessions)

---

## Customer Management

### **Customer Lifecycle**
1. **New Customer**: Receives activation code from studio owner
2. **Registration**: Creates account using activation code
3. **Probebehandlung**: Gets 1 free trial treatment
4. **Session Purchase**: Buys session blocks in-studio
5. **Regular Customer**: Books and attends treatments

### **Customer Status Tracking**
- Track if Probebehandlung has been used
- Track active and queued session blocks
- Track appointment history and remaining sessions

---

## Lead Management & Google Sheets Integration

### **Lead Sources**
- **Google Sheets Sync**: Automated import from integrated sheets
- **Manual Entry**: Studio owners can manually add leads
- **Walk-in Customers**: Direct registration

### **Lead Status Flow**
```
"neu" → "kontaktiert" → "interessiert" → "termin_vereinbart" → "kunde_geworden" / "nicht_interessiert"
```

### **Google Sheets Integration**
- **Sync Process**: When new entry appears in integrated Google Sheet
- **Lead Creation**: Automatically creates lead with status "neu"
- **Notification**: Studio owner sees new leads in lead tab
- **Deduplication**: Prevent duplicate lead creation
- **One Integration Per Studio**: Each studio integrates with one Google Sheet

---

## Database Schema Requirements

### **Core Tables Structure**

#### **customers**
```sql
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  studio_id INT NOT NULL,
  probebehandlung_used BOOLEAN DEFAULT FALSE,
  probebehandlung_appointment_id INT,
  last_weight DECIMAL(5,2),
  goal_weight DECIMAL(5,2),
  initial_weight DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_studio (user_id, studio_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);
```

#### **customer_sessions**
```sql
CREATE TABLE customer_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  studio_id INT NOT NULL,
  total_sessions INT NOT NULL,
  remaining_sessions INT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  queue_position INT DEFAULT 0,
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);
```

#### **appointments**
```sql
CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  studio_id INT NOT NULL,
  appointment_type_id INT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('bestätigt', 'absolviert', 'nicht_erschienen', 'storniert') DEFAULT 'bestätigt',
  cancelled_by ENUM('customer', 'studio', 'system') NULL,
  cancelled_at TIMESTAMP NULL,
  session_consumed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by_user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

#### **appointment_types**
```sql
CREATE TABLE appointment_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  studio_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  duration_minutes INT NOT NULL,
  consumes_session BOOLEAN DEFAULT TRUE,
  is_probebehandlung BOOLEAN DEFAULT FALSE,
  max_per_customer INT DEFAULT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#28a745',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);
```

---

## Business Logic Implementation

### **Session Consumption Function**
```javascript
async function handleSessionConsumption(appointmentId, newStatus, cancelledBy = null) {
  const appointment = await getAppointment(appointmentId);
  const appointmentType = await getAppointmentType(appointment.appointment_type_id);
  
  // Determine if session should be consumed
  let shouldConsume = false;
  
  if (appointmentType.consumes_session && !appointment.session_consumed) {
    if (newStatus === 'absolviert' || newStatus === 'nicht_erschienen') {
      shouldConsume = true;
    } else if (newStatus === 'storniert') {
      if (cancelledBy === 'customer') {
        const hoursUntilAppointment = getHoursUntil(appointment.appointment_date, appointment.start_time);
        shouldConsume = hoursUntilAppointment < 48;
      }
      // Studio cancellations never consume sessions
    }
  }
  
  if (shouldConsume) {
    await consumeSessionFromActiveBlock(appointment.customer_id, appointment.studio_id);
    await updateAppointment(appointmentId, { session_consumed: true });
  }
}
```

### **Session Block Queue Management**
```javascript
async function consumeSessionFromActiveBlock(customerId, studioId) {
  // Get active block
  const activeBlock = await db.get(
    'SELECT * FROM customer_sessions WHERE customer_id = ? AND studio_id = ? AND is_active = 1',
    [customerId, studioId]
  );
  
  if (!activeBlock || activeBlock.remaining_sessions <= 0) {
    throw new Error('No active sessions available');
  }
  
  // Consume session
  const newRemaining = activeBlock.remaining_sessions - 1;
  await db.run(
    'UPDATE customer_sessions SET remaining_sessions = ? WHERE id = ?',
    [newRemaining, activeBlock.id]
  );
  
  // If block is empty, activate next block
  if (newRemaining === 0) {
    await activateNextSessionBlock(customerId, studioId);
  }
}

async function activateNextSessionBlock(customerId, studioId) {
  // Deactivate current block
  await db.run(
    'UPDATE customer_sessions SET is_active = 0 WHERE customer_id = ? AND studio_id = ? AND is_active = 1',
    [customerId, studioId]
  );
  
  // Activate next block in queue
  const nextBlock = await db.get(
    'SELECT * FROM customer_sessions WHERE customer_id = ? AND studio_id = ? AND is_active = 0 AND remaining_sessions > 0 ORDER BY queue_position ASC, id ASC LIMIT 1',
    [customerId, studioId]
  );
  
  if (nextBlock) {
    await db.run('UPDATE customer_sessions SET is_active = 1 WHERE id = ?', [nextBlock.id]);
  }
}
```

### **Probebehandlung Availability Check**
```javascript
function getProbebehandlungStatus(customerId, studioId) {
  const customer = await db.get(
    'SELECT probebehandlung_used FROM customers WHERE user_id = ? AND studio_id = ?',
    [customerId, studioId]
  );
  
  if (!customer || customer.probebehandlung_used) {
    return { 
      available: false, 
      label: "Probebehandlung (0)", 
      message: "Probebehandlung bereits verwendet" 
    };
  }
  
  return { 
    available: true, 
    label: "Probebehandlung (1)", 
    message: null 
  };
}
```

---

## Default Data Configuration

### **Standard Appointment Types (Per Studio)**
```sql
-- Behandlung (Standard Treatment)
INSERT INTO appointment_types (studio_id, name, duration_minutes, consumes_session, description, color) 
VALUES (?, 'Behandlung', 60, TRUE, 'Standard Abnehmen im Liegen Behandlung', '#28a745');

-- Beratung (Consultation) 
INSERT INTO appointment_types (studio_id, name, duration_minutes, consumes_session, description, color)
VALUES (?, 'Beratung', 20, FALSE, 'Kostenlose Beratung und Aufklärung', '#17a2b8');

-- Probebehandlung (Trial Treatment)
INSERT INTO appointment_types (studio_id, name, duration_minutes, consumes_session, is_probebehandlung, max_per_customer, description, color)
VALUES (?, 'Probebehandlung', 60, FALSE, TRUE, 1, 'Kostenlose Probebehandlung für Neukunden', '#ffc107');
```

---

## Future Enhancements (Not Current Scope)

### **Phase 2 Features**
- Customer self-service portal (reschedule appointments)
- SMS/Email notifications
- Customer notification inbox
- Advanced lead conversion tracking

### **Phase 3 Features**  
- Online session block purchasing
- Multi-studio customer management
- Advanced reporting and analytics
- Mobile app integration

---

*Last Updated: 2025-08-04*  
*Status: Implementation Ready*