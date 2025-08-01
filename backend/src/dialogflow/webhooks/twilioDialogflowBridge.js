const dialogflowService = require('../services/dialogflowService');
const appointmentHandler = require('../handlers/appointmentHandler');
const responseBuilder = require('../utils/responseBuilder');
const twilioService = require('../../services/twilioService');
const Lead = require('../../models/Lead');
const LeadCallLog = require('../../models/LeadCallLog');
const DialogflowConversation = require('../../models/DialogflowConversation');

/**
 * Twilio-Dialogflow Bridge
 * Handles the integration between Twilio voice calls and Dialogflow CX
 */
class TwilioDialogflowBridge {
  constructor() {
    this.sessionMap = new Map(); // Map Twilio CallSid to Dialogflow SessionId
  }

  /**
   * Handle incoming Twilio voice webhook with Dialogflow integration
   */
  async handleVoiceWebhook(req, res) {
    try {
      const { CallSid, From, To, SpeechResult, Digits } = req.body;
      const { leadId, callLogId } = req.query;

      console.log(`📞 Dialogflow Voice webhook: ${CallSid} from ${From}`);

      // Get or create Dialogflow session
      let sessionId = this.sessionMap.get(CallSid);
      if (!sessionId) {
        sessionId = dialogflowService.createSession(From, leadId);
        this.sessionMap.set(CallSid, sessionId);
      }

      // Update session activity
      dialogflowService.updateSessionActivity(sessionId);

      let dialogflowResponse;
      let userInput = '';

      // Determine user input
      if (SpeechResult) {
        userInput = SpeechResult;
        console.log(`🎙️ Speech input: "${SpeechResult}"`);
      } else if (Digits) {
        userInput = this.convertDigitsToIntent(Digits);
        console.log(`📱 DTMF input: ${Digits} -> "${userInput}"`);
      } else {
        // First call - send welcome event
        userInput = 'WELCOME_EVENT';
      }

      // Process with Dialogflow
      if (userInput === 'WELCOME_EVENT') {
        dialogflowResponse = await dialogflowService.sendEvent(sessionId, 'WELCOME', {
          phoneNumber: From,
          leadId: leadId,
          callSid: CallSid
        });
      } else {
        dialogflowResponse = await dialogflowService.detectIntentText(sessionId, userInput, {
          phoneNumber: From,
          leadId: leadId,
          callSid: CallSid
        });
      }

      // Handle business logic based on intent
      const enhancedResponse = await this.processIntent(
        dialogflowResponse,
        sessionId,
        leadId,
        callLogId
      );

      // Log conversation
      await this.logConversation(leadId, callLogId, sessionId, userInput, enhancedResponse);

      // Convert response to TwiML
      const twimlResponse = this.convertToTwiML(enhancedResponse, CallSid);

      res.type('text/xml');
      res.send(twimlResponse);

    } catch (error) {
      console.error('Error in Dialogflow voice webhook:', error);
      
      // Fallback TwiML response
      const fallbackTwiML = twilioService.generateTwiML({
        message: 'Entschuldigung, es ist ein technischer Fehler aufgetreten. Ein Mitarbeiter wird sich bei Ihnen melden.',
        transferTo: process.env.FALLBACK_PHONE_NUMBER // Optional fallback to human
      });

      res.type('text/xml');
      res.send(fallbackTwiML);
    }
  }

  /**
   * Process intent and apply business logic
   */
  async processIntent(dialogflowResponse, sessionId, leadId, callLogId) {
    const intentName = dialogflowResponse.intent.displayName;
    const parameters = dialogflowResponse.parameters;

    console.log(`🧠 Processing intent: ${intentName}`, parameters);

    let enhancedResponse = dialogflowResponse;

    try {
      switch (intentName) {
        case 'Welcome':
          enhancedResponse = await this.handleWelcomeIntent(sessionId, leadId, parameters);
          break;

        case 'BookAppointment':
          enhancedResponse = await this.handleBookAppointmentIntent(
            sessionId, leadId, parameters
          );
          break;

        case 'ConfirmBooking':
          enhancedResponse = await this.handleConfirmBookingIntent(
            sessionId, parameters
          );
          break;

        case 'CheckAvailability':
          enhancedResponse = await this.handleCheckAvailabilityIntent(
            sessionId, parameters
          );
          break;

        case 'ProvideContactInfo':
          enhancedResponse = await this.handleContactInfoIntent(
            sessionId, leadId, parameters
          );
          break;

        case 'CancelAppointment':
          enhancedResponse = await this.handleCancelIntent(sessionId, parameters);
          break;

        case 'DefaultFallback':
          enhancedResponse = this.handleFallbackIntent(sessionId, parameters);
          break;

        default:
          // Use original Dialogflow response
          break;
      }
    } catch (error) {
      console.error(`Error processing intent ${intentName}:`, error);
      enhancedResponse = responseBuilder.buildErrorResponse(error);
    }

    return enhancedResponse;
  }

  /**
   * Handle welcome intent
   */
  async handleWelcomeIntent(sessionId, leadId, parameters) {
    try {
      let leadName = null;
      
      if (leadId) {
        const lead = await Lead.findById(leadId);
        if (lead) {
          leadName = lead.name;
        }
      }

      return responseBuilder.buildWelcomeResponse(leadName);
    } catch (error) {
      console.error('Error in welcome intent:', error);
      return responseBuilder.buildWelcomeResponse();
    }
  }

  /**
   * Handle book appointment intent
   */
  async handleBookAppointmentIntent(sessionId, leadId, parameters) {
    // Default studio ID - in production, this would be determined by routing logic
    const studioId = 1;

    const result = await appointmentHandler.handleBookAppointment(
      sessionId,
      parameters,
      leadId,
      studioId
    );

    if (result.parameters?.needsConfirmation) {
      return responseBuilder.buildConfirmationResponse({
        date: result.parameters.appointmentDate,
        time: result.parameters.appointmentTime,
        service: result.parameters.serviceType || 'Behandlung'
      });
    }

    return responseBuilder.buildTextResponse(result.fulfillmentText, result.parameters);
  }

  /**
   * Handle confirm booking intent
   */
  async handleConfirmBookingIntent(sessionId, parameters) {
    const confirmed = this.extractConfirmation(parameters);
    
    const result = await appointmentHandler.handleConfirmBooking(
      sessionId,
      parameters,
      confirmed
    );

    if (result.parameters?.confirmed) {
      return responseBuilder.buildAppointmentConfirmedResponse({
        appointmentId: result.parameters.appointmentId
      });
    }

    return responseBuilder.buildTextResponse(result.fulfillmentText, result.parameters);
  }

  /**
   * Handle check availability intent
   */
  async handleCheckAvailabilityIntent(sessionId, parameters) {
    const studioId = 1; // Default studio
    
    const result = await appointmentHandler.handleCheckAvailability(
      sessionId,
      parameters,
      studioId
    );

    if (result.parameters?.availableSlots) {
      return responseBuilder.buildTimeSelectionResponse(result.parameters.availableSlots);
    }

    return responseBuilder.buildTextResponse(result.fulfillmentText, result.parameters);
  }

  /**
   * Handle contact information intent
   */
  async handleContactInfoIntent(sessionId, leadId, parameters) {
    try {
      const { name, phone, email } = parameters;

      if (!leadId && name) {
        // Create new lead
        const lead = new Lead({
          studio_id: 1, // Default studio
          name: name,
          phone_number: phone || 'unknown',
          email: email,
          source: 'dialogflow_call',
          status: 'contacted',
          notes: `Contact info provided via Dialogflow CX - Session: ${sessionId}`
        });

        leadId = await lead.create();
        
        // Update session with lead ID
        const session = dialogflowService.getSession(sessionId);
        if (session) {
          session.leadId = leadId;
        }
      } else if (leadId && (name || phone || email)) {
        // Update existing lead
        const lead = await Lead.findById(leadId);
        if (lead) {
          if (name) lead.name = name;
          if (phone) lead.phone_number = phone;
          if (email) lead.email = email;
          await lead.update();
        }
      }

      return responseBuilder.buildTextResponse(
        'Vielen Dank für Ihre Angaben. Jetzt können wir einen Termin für Sie vereinbaren. Wann hätten Sie gerne einen Termin?'
      );

    } catch (error) {
      console.error('Error handling contact info:', error);
      return responseBuilder.buildTextResponse(
        'Entschuldigung, beim Speichern Ihrer Daten ist ein Fehler aufgetreten. Können Sie Ihre Angaben wiederholen?'
      );
    }
  }

  /**
   * Handle cancel intent
   */
  async handleCancelIntent(sessionId, parameters) {
    return responseBuilder.buildEndConversationResponse('completed');
  }

  /**
   * Handle fallback intent
   */
  handleFallbackIntent(sessionId, parameters) {
    const session = dialogflowService.getSession(sessionId);
    const context = session?.context || null;
    
    return responseBuilder.buildFallbackResponse(context);
  }

  /**
   * Convert DTMF digits to meaningful intent
   */
  convertDigitsToIntent(digits) {
    const digitMappings = {
      '1': 'Ja',
      '2': 'Nein',
      '3': 'Termin vereinbaren',
      '4': 'Verfügbarkeit prüfen',
      '5': 'Mit Mitarbeiter sprechen',
      '0': 'Hilfe'
    };

    return digitMappings[digits] || `Taste ${digits} gedrückt`;
  }

  /**
   * Extract confirmation from parameters
   */
  extractConfirmation(parameters) {
    const confirmationText = (parameters.confirmation || '').toLowerCase();
    const positiveWords = ['ja', 'yes', 'bestätigen', 'ok', 'richtig', 'korrekt'];
    const negativeWords = ['nein', 'no', 'nicht', 'falsch', 'anders'];

    if (positiveWords.some(word => confirmationText.includes(word))) {
      return true;
    }
    
    if (negativeWords.some(word => confirmationText.includes(word))) {
      return false;
    }

    return null; // Unclear response
  }

  /**
   * Convert Dialogflow response to TwiML
   */
  convertToTwiML(dialogflowResponse, callSid) {
    let message = 'Entschuldigung, ich konnte keine Antwort generieren.';
    let gatherInput = null;
    let shouldEndCall = false;
    let shouldTransfer = false;

    // Extract text from response
    if (dialogflowResponse.responseMessages && dialogflowResponse.responseMessages.length > 0) {
      const textMessage = dialogflowResponse.responseMessages.find(msg => msg.type === 'text');
      if (textMessage) {
        message = textMessage.text;
      }

      // Check for Twilio-specific payload
      const payloadMessage = dialogflowResponse.responseMessages.find(msg => msg.type === 'payload');
      if (payloadMessage && payloadMessage.payload.twilio) {
        const twilioPayload = payloadMessage.payload.twilio;
        
        if (twilioPayload.action === 'end_call') {
          shouldEndCall = true;
        } else if (twilioPayload.action === 'transfer_to_human') {
          shouldTransfer = true;
        }
      }
    } else if (dialogflowResponse.fulfillmentText) {
      message = dialogflowResponse.fulfillmentText;
    }

    // Determine if we need to gather input
    if (!shouldEndCall && !shouldTransfer) {
      gatherInput = { 
        prompt: 'Bitte antworten Sie oder drücken Sie eine Taste.' 
      };
    }

    // Generate TwiML options
    const twilioOptions = {
      message: message,
      gatherInput: gatherInput
    };

    if (shouldTransfer && process.env.FALLBACK_PHONE_NUMBER) {
      twilioOptions.transferTo = process.env.FALLBACK_PHONE_NUMBER;
    }

    return twilioService.generateTwiML(twilioOptions);
  }

  /**
   * Log conversation to database
   */
  async logConversation(leadId, callLogId, sessionId, userMessage, botResponse) {
    try {
      if (!leadId) return;

      await DialogflowConversation.create({
        lead_id: leadId,
        call_log_id: callLogId,
        session_id: sessionId,
        intent_name: botResponse.intent?.displayName || 'Unknown',
        confidence_score: botResponse.intent?.confidence || 0,
        user_message: userMessage,
        bot_response: botResponse.fulfillmentText || 'No response',
        context_data: JSON.stringify({
          parameters: botResponse.parameters || {},
          currentPage: botResponse.currentPage
        })
      });

    } catch (error) {
      console.error('Error logging conversation:', error);
      // Don't throw - logging failures shouldn't break the call
    }
  }

  /**
   * Clean up session when call ends
   */
  cleanupSession(callSid) {
    const sessionId = this.sessionMap.get(callSid);
    if (sessionId) {
      dialogflowService.endSession(sessionId);
      this.sessionMap.delete(callSid);
      console.log(`🧹 Cleaned up session for call: ${callSid}`);
    }
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount() {
    return this.sessionMap.size;
  }
}

module.exports = new TwilioDialogflowBridge();