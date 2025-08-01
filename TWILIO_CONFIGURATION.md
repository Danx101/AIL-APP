# Twilio Configuration Guide for Autonomous Appointment Scheduling

This guide covers the complete setup of Twilio integration with Dialogflow CX for autonomous appointment scheduling.

## Prerequisites

- Twilio account with active phone number
- Deployed backend application with public URL
- Dialogflow CX agent configured
- SSL certificate (required for webhooks)

## Step 1: Twilio Account Setup

### 1.1 Purchase a Phone Number

1. Log into [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Buy a number**
3. Select a German number (+49) for local presence
4. Choose a number with **Voice** capability
5. Purchase the number

### 1.2 Get Account Credentials

Navigate to **Account** → **API keys & tokens**:
- **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Auth Token**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Webhook Configuration

### 2.1 Configure Voice Webhook

1. Go to **Phone Numbers** → **Manage** → **Active numbers**
2. Click on your purchased number
3. In the **Voice Configuration** section:
   - **Webhook URL**: `https://your-domain.com/api/v1/twilio/voice/webhook`
   - **HTTP Method**: POST
   - **Primary Handler Failures**: `https://your-domain.com/api/v1/twilio/voice/webhook`

### 2.2 Configure Status Callbacks

Add these URLs for call tracking:
- **Status Callback URL**: `https://your-domain.com/api/v1/twilio/status/callback`
- **Status Callback Method**: POST
- **Status Callback Events**: Select all events

### 2.3 Configure Recording Callback

For call recordings:
- **Recording Status Callback URL**: `https://your-domain.com/api/v1/twilio/recording/callback`
- **Recording Status Callback Method**: POST

## Step 3: Environment Configuration

### 3.1 Update .env File

Add these variables to your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+49xxxxxxxxxx

# Base URL for webhooks
BASE_URL=https://your-domain.com

# Optional: Fallback number for human transfer
FALLBACK_PHONE_NUMBER=+49xxxxxxxxxx
```

### 3.2 Verify Configuration

Test your Twilio configuration:

```bash
# Test endpoint accessibility
curl -X POST https://your-domain.com/api/v1/twilio/voice/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test&From=%2B49xxxxxxxxx&To=%2B49xxxxxxxxx"

# Test Dialogflow endpoint
curl -X POST https://your-domain.com/api/v1/dialogflow/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"message":"Hallo, ich möchte einen Termin"}'
```

## Step 4: Lead Management Integration

### 4.1 Automatic Lead Creation

When a call comes in, the system will:
1. Check if lead exists by phone number
2. Create new lead if not found
3. Update existing lead with conversation data
4. Track call logs and outcomes

### 4.2 Lead Routing by Studio

Configure studio routing based on:
- Called Twilio number (if multiple studios)
- Time of day
- Geographic location (area code)

Example configuration in `dialogflowConfig.js`:

```javascript
getStudioRouting(calledNumber, callerNumber) {
  const routingRules = {
    '+4930xxxxxxxx': 1, // Berlin studio
    '+4989xxxxxxxx': 2, // Munich studio
    // Default studio
    'default': 1
  };
  
  return routingRules[calledNumber] || routingRules.default;
}
```

## Step 5: Call Flow Configuration

### 5.1 Basic Call Flow

```
Incoming Call
├── Welcome Message (Dialogflow)
├── Intent Recognition
│   ├── Book Appointment
│   │   ├── Collect Date/Time
│   │   ├── Check Availability
│   │   ├── Confirm Booking
│   │   └── Send Confirmation
│   ├── Check Availability
│   │   ├── Provide Available Slots
│   │   └── Book if Interested
│   ├── Provide Contact Info
│   │   ├── Update Lead Data
│   │   └── Continue to Booking
│   └── Transfer to Human
│       └── Connect to Studio
└── End Call
```

### 5.2 TwiML Response Examples

**Welcome Message:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="de-DE">
        Guten Tag! Hier ist Abnehmen im Liegen. Wie kann ich Ihnen helfen?
    </Say>
    <Gather input="speech dtmf" timeout="10" speechTimeout="auto" language="de-DE" 
            action="/api/v1/twilio/voice/gather" method="POST">
        <Say voice="alice" language="de-DE">
            Sagen Sie mir einfach, womit ich Ihnen helfen kann, oder drücken Sie die 1 für einen Rückruf.
        </Say>
    </Gather>
</Response>
```

**Appointment Confirmation:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="de-DE">
        Vielen Dank! Ihr Termin am Montag, den 15. Januar um 14 Uhr ist bestätigt. 
        Sie erhalten eine SMS-Bestätigung. Wir freuen uns auf Ihren Besuch!
    </Say>
</Response>
```

## Step 6: Advanced Features

### 6.1 Call Recording

Enable automatic call recording:

```javascript
const callOptions = {
  to: phoneNumber,
  from: process.env.TWILIO_PHONE_NUMBER,
  url: webhookUrl,
  record: true,
  recordingStatusCallback: recordingCallbackUrl,
  recordingStatusCallbackMethod: 'POST'
};
```

### 6.2 Call Queuing

For high-volume periods:

```javascript
// Queue calls when all agents busy
if (allAgentsBusy) {
  const twiml = new VoiceResponse();
  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Alle unsere Mitarbeiter sind momentan beschäftigt. Bitte bleiben Sie dran.');
  
  twiml.play('https://your-domain.com/hold-music.mp3');
  twiml.redirect('/api/v1/twilio/voice/queue-check');
}
```

### 6.3 Sentiment Analysis

Track conversation sentiment:

```javascript
// In webhook handler
const sentiment = await analyzeSentiment(userMessage);
await updateLeadSentiment(leadId, sentiment);

if (sentiment.score < -0.5) {
  // Transfer to human agent
  return transferToHuman();
}
```

## Step 7: Testing & Debugging

### 7.1 Test Scenarios

**Basic Appointment Booking:**
1. Call Twilio number
2. Say: "Ich möchte einen Termin vereinbaren"
3. Provide date: "Morgen um 14 Uhr"
4. Confirm: "Ja, das passt"
5. Verify appointment created in database

**Availability Check:**
1. Call Twilio number
2. Say: "Haben Sie morgen Zeit?"
3. Listen to available slots
4. Select a time
5. Complete booking

**Contact Information:**
1. Call without existing lead
2. System asks for name
3. Provide: "Mein Name ist Max Müller"
4. Continue with appointment booking

### 7.2 Debugging Tools

**Twilio Console:**
- Monitor call logs
- Check webhook delivery
- Review TwiML responses
- Analyze call quality

**Application Logs:**
```javascript
// Add detailed logging
console.log('📞 Call received:', {
  callSid: CallSid,
  from: From,
  to: To,
  timestamp: new Date().toISOString()
});

console.log('🤖 Dialogflow response:', {
  intent: response.intent.displayName,
  confidence: response.intent.confidence,
  parameters: response.parameters
});
```

**Database Monitoring:**
```sql
-- Check recent conversations
SELECT * FROM dialogflow_conversations 
WHERE created_at > NOW() - INTERVAL 1 HOUR
ORDER BY created_at DESC;

-- Check appointment bookings
SELECT * FROM appointments 
WHERE created_at > NOW() - INTERVAL 1 DAY
AND status = 'confirmed';

-- Monitor call success rates
SELECT 
  call_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM lead_call_logs), 2) as percentage
FROM lead_call_logs 
WHERE created_at > NOW() - INTERVAL 1 DAY
GROUP BY call_status;
```

## Step 8: Production Deployment

### 8.1 SSL Certificate

Ensure your webhook endpoints use HTTPS:
- Use Let's Encrypt for free SSL
- Configure reverse proxy (nginx/Apache)
- Test SSL with: `curl -I https://your-domain.com`

### 8.2 Load Balancing

For high-volume deployments:
- Use multiple server instances
- Configure load balancer
- Implement session stickiness for ongoing calls

### 8.3 Error Handling

Implement comprehensive error handling:

```javascript
// Webhook error handling
app.use('/api/v1/twilio', (err, req, res, next) => {
  console.error('Twilio webhook error:', err);
  
  const fallbackTwiML = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice" language="de-DE">
        Entschuldigung, es ist ein technischer Fehler aufgetreten. 
        Ein Mitarbeiter wird sich bei Ihnen melden.
      </Say>
    </Response>
  `;
  
  res.type('text/xml').send(fallbackTwiML);
});
```

### 8.4 Monitoring & Alerts

Set up monitoring for:
- Webhook response times
- Call success rates
- Database connection issues
- Dialogflow API limits

## Step 9: Security Considerations

### 9.1 Webhook Validation

Validate Twilio requests:

```javascript
const twilio = require('twilio');

function validateTwilioRequest(req, res, next) {
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  if (twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  )) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
}

app.use('/api/v1/twilio', validateTwilioRequest);
```

### 9.2 Rate Limiting

Implement rate limiting:

```javascript
const rateLimit = require('express-rate-limit');

const twilioLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/v1/twilio', twilioLimiter);
```

### 9.3 Data Privacy

Ensure GDPR compliance:
- Log minimal personal data
- Implement data retention policies
- Provide data deletion capabilities
- Encrypt sensitive information

## Troubleshooting

### Common Issues

**1. Webhook Not Receiving Calls**
- Check URL accessibility from internet
- Verify SSL certificate
- Check firewall settings
- Test with ngrok for development

**2. Dialogflow Not Responding**
- Verify service account credentials
- Check API quotas and limits
- Review agent configuration
- Test intent matching

**3. Appointments Not Created**
- Check database connections
- Verify appointment model validation
- Review error logs
- Test appointment creation manually

**4. Poor Speech Recognition**
- Check audio quality settings
- Review training phrases
- Test with different speakers
- Adjust confidence thresholds

### Support Resources

- [Twilio Voice Documentation](https://www.twilio.com/docs/voice)
- [Dialogflow CX Documentation](https://cloud.google.com/dialogflow/cx/docs)
- [TwiML Reference](https://www.twilio.com/docs/voice/twiml)
- [Twilio Helper Libraries](https://www.twilio.com/docs/libraries)

## Next Steps

After successful configuration:
1. Monitor call patterns and optimize flows
2. Implement A/B testing for different approaches
3. Add multi-language support if needed
4. Integrate with CRM systems
5. Implement advanced analytics and reporting