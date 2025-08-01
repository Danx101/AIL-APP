const { SessionsClient, IntentsClient, FlowsClient } = require('@google-cloud/dialogflow-cx');

/**
 * Dialogflow CX Configuration
 * Handles initialization and configuration of Dialogflow CX client
 */
class DialogflowConfig {
  constructor() {
    this.projectId = process.env.DIALOGFLOW_PROJECT_ID;
    this.location = process.env.DIALOGFLOW_LOCATION || 'europe-west3';
    this.agentId = process.env.DIALOGFLOW_AGENT_ID;
    this.environment = process.env.DIALOGFLOW_ENVIRONMENT || 'production';
    this.languageCode = 'de-DE'; // German language

    // Validate configuration
    this.validateConfig();

    // Initialize clients
    this.sessionsClient = null;
    this.intentsClient = null;
    this.flowsClient = null;
  }

  validateConfig() {
    const missingVars = [];
    
    if (!this.projectId) missingVars.push('DIALOGFLOW_PROJECT_ID');
    if (!this.agentId) missingVars.push('DIALOGFLOW_AGENT_ID');
    
    if (missingVars.length > 0) {
      console.warn(`⚠️ Missing Dialogflow configuration: ${missingVars.join(', ')}`);
      console.warn('Dialogflow CX integration will be disabled until properly configured.');
    }
  }

  isConfigured() {
    return !!(this.projectId && this.agentId);
  }

  getSessionsClient() {
    if (!this.isConfigured()) {
      throw new Error('Dialogflow CX is not properly configured');
    }

    if (!this.sessionsClient) {
      this.sessionsClient = new SessionsClient({
        apiEndpoint: `${this.location}-dialogflow.googleapis.com`
      });
    }
    return this.sessionsClient;
  }

  getIntentsClient() {
    if (!this.isConfigured()) {
      throw new Error('Dialogflow CX is not properly configured');
    }

    if (!this.intentsClient) {
      this.intentsClient = new IntentsClient({
        apiEndpoint: `${this.location}-dialogflow.googleapis.com`
      });
    }
    return this.intentsClient;
  }

  getFlowsClient() {
    if (!this.isConfigured()) {
      throw new Error('Dialogflow CX is not properly configured');
    }

    if (!this.flowsClient) {
      this.flowsClient = new FlowsClient({
        apiEndpoint: `${this.location}-dialogflow.googleapis.com`
      });
    }
    return this.flowsClient;
  }

  getAgentPath() {
    return `projects/${this.projectId}/locations/${this.location}/agents/${this.agentId}`;
  }

  getSessionPath(sessionId) {
    const agentPath = this.getAgentPath();
    return `${agentPath}/sessions/${sessionId}`;
  }

  getEnvironmentPath() {
    const agentPath = this.getAgentPath();
    return `${agentPath}/environments/${this.environment}`;
  }

  // Intent names for appointment booking flow
  getIntentNames() {
    return {
      WELCOME: 'Welcome',
      CHECK_AVAILABILITY: 'CheckAvailability',
      BOOK_APPOINTMENT: 'BookAppointment',
      CONFIRM_BOOKING: 'ConfirmBooking',
      CANCEL_APPOINTMENT: 'CancelAppointment',
      RESCHEDULE_APPOINTMENT: 'RescheduleAppointment',
      PROVIDE_CONTACT_INFO: 'ProvideContactInfo',
      SELECT_SERVICE: 'SelectService',
      SELECT_TIME_SLOT: 'SelectTimeSlot',
      FALLBACK: 'DefaultFallback'
    };
  }

  // Entity types for appointment booking
  getEntityTypes() {
    return {
      DATE: '@sys.date',
      TIME: '@sys.time',
      NUMBER: '@sys.number',
      SERVICE_TYPE: 'ServiceType',
      CONFIRMATION: 'Confirmation',
      CONTACT_METHOD: 'ContactMethod'
    };
  }

  // Conversation contexts
  getContexts() {
    return {
      APPOINTMENT_BOOKING: 'appointment-booking',
      AWAITING_CONFIRMATION: 'awaiting-confirmation',
      SERVICE_SELECTED: 'service-selected',
      TIME_SELECTED: 'time-selected',
      CONTACT_PROVIDED: 'contact-provided'
    };
  }

  // Response variations for better conversation flow
  getResponseTemplates() {
    return {
      WELCOME: [
        'Guten Tag! Hier ist Abnehmen im Liegen. Wie kann ich Ihnen helfen?',
        'Hallo! Willkommen bei Abnehmen im Liegen. Möchten Sie einen Termin vereinbaren?'
      ],
      ASK_SERVICE: [
        'Welche Behandlung interessiert Sie?',
        'Für welchen Service möchten Sie einen Termin vereinbaren?'
      ],
      ASK_DATE: [
        'An welchem Tag hätten Sie gerne einen Termin?',
        'Wann würde es Ihnen passen? Nennen Sie mir bitte Ihren Wunschtermin.'
      ],
      ASK_TIME: [
        'Welche Uhrzeit würde Ihnen passen?',
        'Zu welcher Zeit möchten Sie kommen?'
      ],
      CONFIRM_APPOINTMENT: [
        'Perfekt! Ich habe einen Termin für Sie am {date} um {time} Uhr für {service} vorgemerkt. Stimmt das so?',
        'Alles klar! {service} am {date} um {time} Uhr. Möchten Sie diesen Termin bestätigen?'
      ],
      APPOINTMENT_CONFIRMED: [
        'Vielen Dank! Ihr Termin wurde erfolgreich gebucht. Sie erhalten eine Bestätigung per SMS.',
        'Wunderbar! Der Termin ist für Sie reserviert. Wir freuen uns auf Ihren Besuch!'
      ],
      NO_AVAILABILITY: [
        'Leider haben wir zu diesem Zeitpunkt keinen freien Termin. Können Sie mir eine Alternative nennen?',
        'Dieser Termin ist bereits vergeben. Wann würde es Ihnen noch passen?'
      ]
    };
  }
}

module.exports = new DialogflowConfig();