# Dialogflow CX Agent Setup Guide

This guide will help you set up a Dialogflow CX agent for autonomous appointment scheduling with Twilio integration.

## Prerequisites

1. Google Cloud Project with Dialogflow API enabled
2. Dialogflow CX API enabled
3. Service account with appropriate permissions
4. Twilio account with phone number

## Step 1: Create Dialogflow CX Agent

### 1.1 Navigate to Dialogflow CX Console
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Select your project
- Navigate to Dialogflow CX

### 1.2 Create New Agent
```
Agent Name: Abnehmen im Liegen Appointment Bot
Display Name: Appointment Scheduler
Default Language: German (de)
Time Zone: Europe/Berlin
Location: europe-west3
```

### 1.3 Note Important IDs
After creation, note these values for your `.env` file:
- Project ID: `your-project-id`
- Agent ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Location: `europe-west3`

## Step 2: Configure Intents

### 2.1 Default Welcome Intent
**Intent Name:** `Default Welcome Intent`
**Training Phrases:**
- Hallo
- Guten Tag
- Hi
- Ich möchte einen Termin
- Kann ich einen Termin vereinbaren?

**Response:**
```
Guten Tag! Hier ist Abnehmen im Liegen. Wie kann ich Ihnen helfen? Möchten Sie einen Termin vereinbaren?
```

### 2.2 Book Appointment Intent
**Intent Name:** `BookAppointment`
**Training Phrases:**
- Ich möchte einen Termin vereinbaren
- Können Sie einen Termin für mich buchen?
- Ich brauche einen Termin am [date] um [time]
- Termin buchen für [date]
- Einen Termin bitte am [date] um [time] Uhr

**Parameters:**
- `date` → `@sys.date` (required)
- `time` → `@sys.time` (required)
- `serviceType` → `@ServiceType` (optional)

**Response:**
```
Ich prüfe die Verfügbarkeit für $date um $time Uhr. Einen Moment bitte...
```

### 2.3 Check Availability Intent
**Intent Name:** `CheckAvailability`
**Training Phrases:**
- Haben Sie am [date] Zeit?
- Ist am [date] etwas frei?
- Welche Termine haben Sie am [date]?
- Verfügbarkeit prüfen für [date]

**Parameters:**
- `date` → `@sys.date` (required)

**Response:**
```
Ich prüfe die verfügbaren Termine für $date...
```

### 2.4 Confirm Booking Intent
**Intent Name:** `ConfirmBooking`
**Training Phrases:**
- Ja, das passt
- Ja, bestätigen
- Das ist richtig
- Ja, buchen Sie den Termin
- Nein, das passt nicht
- Nein, anderen Termin bitte

**Parameters:**
- `confirmation` → `@Confirmation` (required)

**Response:**
```
Vielen Dank! Ihr Termin wird bestätigt...
```

### 2.5 Provide Contact Info Intent
**Intent Name:** `ProvideContactInfo`
**Training Phrases:**
- Mein Name ist [name]
- Ich heiße [name]
- [name] ist mein Name
- Meine Nummer ist [phone]
- Sie können mich unter [phone] erreichen

**Parameters:**
- `name` → `@sys.person` (optional)
- `phone` → `@sys.phone-number` (optional)
- `email` → `@sys.email` (optional)

### 2.6 Cancel Appointment Intent
**Intent Name:** `CancelAppointment`
**Training Phrases:**
- Ich möchte absagen
- Termin stornieren
- Den Termin nicht mehr
- Abbrechen
- Auf Wiederhören

## Step 3: Create Entity Types

### 3.1 ServiceType Entity
**Entity Name:** `ServiceType`
**Values:**
- `abnehmen_behandlung` → "Abnehmen im Liegen Behandlung", "Behandlung", "Abnehmen"
- `beratung` → "Beratungsgespräch", "Beratung", "Gespräch"
- `probebehandlung` → "Probebehandlung", "Probe", "Schnuppertermin"

### 3.2 Confirmation Entity
**Entity Name:** `Confirmation`
**Values:**
- `yes` → "ja", "yes", "richtig", "korrekt", "bestätigen", "ok"
- `no` → "nein", "no", "nicht", "falsch", "anders", "abbrechen"

## Step 4: Configure Flows

### 4.1 Main Flow Structure
```
Start Page (Default Welcome)
├── Collect Contact Info
│   ├── Get Name
│   ├── Get Phone
│   └── Continue to Booking
├── Book Appointment
│   ├── Get Preferred Date
│   ├── Get Preferred Time
│   ├── Check Availability
│   └── Show Available Slots
├── Confirm Booking
│   ├── Confirm Details
│   ├── Create Appointment
│   └── Send Confirmation
└── End Conversation
```

### 4.2 Webhook Configuration
For each intent that needs business logic:

**Webhook URL:** `https://your-domain.com/api/v1/dialogflow/webhook`
**Method:** POST
**Authentication:** None (webhook validation handled in code)

Enable webhook for these intents:
- `BookAppointment`
- `CheckAvailability` 
- `ConfirmBooking`
- `ProvideContactInfo`

## Step 5: Test Configuration

### 5.1 Test in Simulator
Use Dialogflow CX simulator to test:
- "Hallo, ich möchte einen Termin"
- "Ich brauche einen Termin morgen um 14 Uhr"
- "Ja, bestätigen"

### 5.2 Integration Test
Once deployed, test with Twilio:
- Call your Twilio number
- Test voice recognition
- Test appointment booking flow

## Step 6: Environment Configuration

### 6.1 Service Account Setup
Create service account with these roles:
- Dialogflow API Client
- Dialogflow Reader
- Dialogflow Admin (for development)

Download JSON key file and place in your project root as `dialogflow-credentials.json`

### 6.2 Environment Variables
Update your `.env` file:
```env
DIALOGFLOW_PROJECT_ID=your-project-id
DIALOGFLOW_LOCATION=europe-west3
DIALOGFLOW_AGENT_ID=your-agent-id
DIALOGFLOW_ENVIRONMENT=production
GOOGLE_APPLICATION_CREDENTIALS=./dialogflow-credentials.json
ENABLE_DIALOGFLOW=true
```

## Step 7: Advanced Configuration

### 7.1 NLU Settings
- **ML Classification Threshold:** 0.3
- **Classification Threshold:** 0.3
- **Max Consecutive No-Match Count:** 3
- **Max Consecutive No-Input Count:** 3

### 7.2 Speech Settings
- **Speech-to-Text Model:** latest_long
- **Language:** de-DE
- **Audio Encoding:** MULAW (for Twilio)
- **Sample Rate:** 8000 Hz (for Twilio)

## Step 8: Monitoring & Analytics

### 8.1 Enable Analytics
- Go to Agent Settings → Advanced → Analytics
- Enable Dialogflow Analytics
- Enable BigQuery Export (optional)

### 8.2 Set up Alerts
Create alerts for:
- High fallback intent rates
- Low confidence scores
- Webhook failures

## Troubleshooting

### Common Issues

**1. Webhook Timeout**
- Increase timeout to 30 seconds
- Optimize database queries
- Add retry logic

**2. Speech Recognition Issues**
- Test with different accents
- Add more training phrases
- Adjust speech model settings

**3. Intent Matching Problems**
- Review training phrases
- Check entity mapping
- Verify parameter extraction

**4. Integration Issues**
- Verify webhook URL is accessible
- Check authentication
- Review error logs

### Debug Tools

**1. Dialogflow CX Simulator**
- Test intents and flows
- Check parameter extraction
- Verify webhook responses

**2. Twilio Console**
- Monitor call logs
- Check webhook responses
- Review TwiML generation

**3. Application Logs**
- Monitor conversation logs
- Check appointment creation
- Review error messages

## Production Checklist

- [ ] All intents tested and working
- [ ] Webhook endpoints secured
- [ ] Error handling implemented
- [ ] Fallback responses configured
- [ ] Analytics enabled
- [ ] Monitoring set up
- [ ] Load testing completed
- [ ] Documentation updated

## Next Steps

After completing this setup:
1. Test the complete flow from Twilio call to appointment booking
2. Monitor conversation success rates
3. Iterate on training phrases based on real usage
4. Set up A/B testing for different conversation flows
5. Implement advanced features like appointment rescheduling