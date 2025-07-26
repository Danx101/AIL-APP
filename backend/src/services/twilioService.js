const twilio = require('twilio');
const LeadCallLog = require('../models/LeadCallLog');

class TwilioService {
  constructor() {
    this.client = null;
    this.initialized = false;
    
    // Initialize if credentials are available
    this.initialize();
  }

  initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        console.warn('⚠️ Twilio credentials not found. Voice calling will be disabled.');
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      console.log('✅ Twilio service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Twilio service:', error);
    }
  }

  /**
   * Check if Twilio is properly configured
   */
  isConfigured() {
    return this.initialized && this.client !== null;
  }

  /**
   * Initiate an outbound call to a lead
   */
  async initiateCall(options) {
    if (!this.isConfigured()) {
      throw new Error('Twilio service is not configured');
    }

    const { to, leadId, callLogId, from, twimlUrl } = options;

    try {
      // Use configured Twilio phone number or provided 'from' number
      const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
      
      if (!fromNumber) {
        throw new Error('No Twilio phone number configured');
      }

      // Create TwiML URL with parameters for the call
      const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/api/v1/twilio/voice/webhook`;
      const statusCallbackUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/api/v1/twilio/status/callback`;

      const callOptions = {
        to: to,
        from: fromNumber,
        url: twimlUrl || `${webhookUrl}?leadId=${leadId}&callLogId=${callLogId}`,
        statusCallback: `${statusCallbackUrl}?callLogId=${callLogId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true, // Enable call recording
        recordingStatusCallback: `${process.env.BASE_URL || 'http://localhost:3001'}/api/v1/twilio/recording/callback`,
        recordingStatusCallbackMethod: 'POST'
      };

      const call = await this.client.calls.create(callOptions);

      console.log(`📞 Call initiated: ${call.sid} to ${to}`);
      
      return {
        sid: call.sid,
        status: call.status,
        to: call.to,
        from: call.from,
        dateCreated: call.dateCreated
      };

    } catch (error) {
      console.error('Error initiating Twilio call:', error);
      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  }

  /**
   * Get call details from Twilio
   */
  async getCallDetails(callSid) {
    if (!this.isConfigured()) {
      throw new Error('Twilio service is not configured');
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      
      return {
        sid: call.sid,
        status: call.status,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime,
        price: call.price,
        priceUnit: call.priceUnit,
        direction: call.direction,
        answeredBy: call.answeredBy
      };

    } catch (error) {
      console.error('Error fetching call details:', error);
      throw new Error(`Failed to get call details: ${error.message}`);
    }
  }

  /**
   * End an ongoing call
   */
  async endCall(callSid) {
    if (!this.isConfigured()) {
      throw new Error('Twilio service is not configured');
    }

    try {
      const call = await this.client.calls(callSid).update({ status: 'completed' });
      
      console.log(`📞 Call ended: ${call.sid}`);
      
      return {
        sid: call.sid,
        status: call.status
      };

    } catch (error) {
      console.error('Error ending call:', error);
      throw new Error(`Failed to end call: ${error.message}`);
    }
  }

  /**
   * Generate TwiML for voice response
   */
  generateTwiML(options) {
    const { message, gatherInput, transferTo, playUrl } = options;
    
    const twiml = new twilio.twiml.VoiceResponse();

    if (playUrl) {
      twiml.play(playUrl);
    } else if (message) {
      twiml.say({
        voice: 'alice',
        language: 'de-DE' // German voice
      }, message);
    }

    if (gatherInput) {
      const gather = twiml.gather({
        input: 'speech dtmf',
        timeout: 10,
        speechTimeout: 'auto',
        language: 'de-DE',
        action: '/api/v1/twilio/voice/gather',
        method: 'POST'
      });
      
      gather.say({
        voice: 'alice',
        language: 'de-DE'
      }, gatherInput.prompt || 'Bitte sprechen Sie nach dem Ton.');
    }

    if (transferTo) {
      twiml.dial(transferTo);
    }

    return twiml.toString();
  }

  /**
   * Handle Twilio webhook for voice calls
   */
  async handleVoiceWebhook(req, res) {
    try {
      const { leadId, callLogId } = req.query;
      const { CallSid, CallStatus, From, To } = req.body;

      console.log(`📞 Voice webhook: ${CallSid} - ${CallStatus}`);

      // Update call log if available
      if (callLogId) {
        const callLog = await LeadCallLog.findById(callLogId);
        if (callLog) {
          await callLog.updateStatus(this.mapTwilioStatusToLocal(CallStatus), {
            started_at: new Date().toISOString()
          });
        }
      }

      // Generate TwiML response based on lead and call context
      const twimlResponse = this.generateTwiML({
        message: 'Hallo! Dies ist ein Anruf von Abnehmen im Liegen. Wie kann ich Ihnen helfen?',
        gatherInput: {
          prompt: 'Drücken Sie 1 für einen Rückruf oder sprechen Sie Ihre Nachricht nach dem Ton.'
        }
      });

      res.type('text/xml');
      res.send(twimlResponse);

    } catch (error) {
      console.error('Error handling voice webhook:', error);
      
      // Return basic TwiML response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  }

  /**
   * Handle Twilio status callback
   */
  async handleStatusCallback(req, res) {
    try {
      const { callLogId } = req.query;
      const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

      console.log(`📞 Status callback: ${CallSid} - ${CallStatus}`);

      if (callLogId) {
        const callLog = await LeadCallLog.findById(callLogId);
        if (callLog) {
          const updateData = {
            duration_seconds: CallDuration ? parseInt(CallDuration) : undefined,
            recording_url: RecordingUrl,
            ended_at: ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus) 
              ? new Date().toISOString() : undefined
          };

          await callLog.updateStatus(this.mapTwilioStatusToLocal(CallStatus), updateData);
        }
      }

      res.status(200).send('OK');

    } catch (error) {
      console.error('Error handling status callback:', error);
      res.status(500).send('Error');
    }
  }

  /**
   * Handle recording callback
   */
  async handleRecordingCallback(req, res) {
    try {
      const { CallSid, RecordingUrl, RecordingDuration } = req.body;

      console.log(`🎙️ Recording callback: ${CallSid} - ${RecordingUrl}`);

      // Find call log by Twilio SID and update with recording URL
      const callLog = await LeadCallLog.findByTwilioSid(CallSid);
      if (callLog) {
        await callLog.updateStatus(callLog.call_status, {
          recording_url: RecordingUrl,
          duration_seconds: RecordingDuration ? parseInt(RecordingDuration) : callLog.duration_seconds
        });
      }

      res.status(200).send('OK');

    } catch (error) {
      console.error('Error handling recording callback:', error);
      res.status(500).send('Error');
    }
  }

  /**
   * Map Twilio call status to local status
   */
  mapTwilioStatusToLocal(twilioStatus) {
    const statusMapping = {
      'queued': 'initiated',
      'initiated': 'initiated', 
      'ringing': 'ringing',
      'in-progress': 'answered',
      'completed': 'completed',
      'busy': 'busy',
      'no-answer': 'no_answer',
      'failed': 'failed',
      'canceled': 'cancelled'
    };

    return statusMapping[twilioStatus] || 'unknown';
  }

  /**
   * Get account balance and usage
   */
  async getAccountInfo() {
    if (!this.isConfigured()) {
      throw new Error('Twilio service is not configured');
    }

    try {
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      return {
        accountSid: account.sid,
        friendlyName: account.friendlyName,
        status: account.status,
        type: account.type
      };

    } catch (error) {
      console.error('Error fetching account info:', error);
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }

  /**
   * Get available phone numbers
   */
  async getPhoneNumbers() {
    if (!this.isConfigured()) {
      throw new Error('Twilio service is not configured');
    }

    try {
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({ limit: 20 });
      
      return phoneNumbers.map(number => ({
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        capabilities: number.capabilities
      }));

    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      throw new Error(`Failed to get phone numbers: ${error.message}`);
    }
  }
}

module.exports = new TwilioService();