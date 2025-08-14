const db = require('../database/database-wrapper');

class SearchController {
  // Unified search across leads and customers
  async searchPersons(req, res) {
    try {
      const { type = 'all', query = '', studio_id } = req.query;
      const studioId = studio_id || req.user.studio_id;

      if (!studioId) {
        return res.status(400).json({ message: 'Studio ID is required' });
      }

      if (!query || query.trim().length < 2) {
        return res.status(400).json({ message: 'Search query must be at least 2 characters' });
      }

      const searchPattern = `%${query}%`;
      const results = [];

      // Search leads if type is 'all' or 'lead'
      if (type === 'all' || type === 'lead') {
        const leadsSql = `
          SELECT 
            l.id,
            l.name,
            l.phone_number,
            l.email,
            l.status,
            l.is_archived,
            COUNT(a.id) as appointment_count
          FROM leads l
          LEFT JOIN appointments a ON l.id = a.lead_id
          WHERE l.studio_id = ? 
            AND (l.name LIKE ? OR l.phone_number LIKE ? OR l.email LIKE ?)
            AND l.is_archived = FALSE
          GROUP BY l.id
          ORDER BY l.created_at DESC
          LIMIT 20
        `;
        
        const leads = await db.all(leadsSql, [studioId, searchPattern, searchPattern, searchPattern]);

        leads.forEach(lead => {
          results.push({
            id: `lead_${lead.id}`,
            type: 'lead',
            name: lead.name,
            phone: lead.phone_number,
            email: lead.email,
            badge: this.getLeadBadge(lead.status),
            can_book_trial: lead.status !== 'trial_scheduled' && lead.appointment_count === 0,
            status: lead.status,
            color: '#007bff' // Blue for leads
          });
        });
      }

      // Search customers if type is 'all' or 'customer'
      if (type === 'all' || type === 'customer') {
        const customersSql = `
          SELECT 
            c.id,
            c.contact_first_name,
            c.contact_last_name,
            c.contact_phone,
            c.contact_email,
            c.registration_code,
            c.has_app_access,
            c.total_sessions_purchased,
            (SELECT remaining_sessions 
             FROM customer_sessions cs 
             WHERE cs.customer_id = c.id AND cs.status = 'active'
             LIMIT 1) as remaining_sessions
          FROM customers c
          WHERE c.studio_id = ? 
            AND (
              CONCAT(c.contact_first_name, ' ', c.contact_last_name) LIKE ? 
              OR c.contact_phone LIKE ? 
              OR c.contact_email LIKE ?
              OR c.registration_code LIKE ?
            )
          ORDER BY c.customer_since DESC
          LIMIT 20
        `;
        
        const customers = await db.all(
          customersSql, 
          [studioId, searchPattern, searchPattern, searchPattern, searchPattern]
        );

        customers.forEach(customer => {
          const remainingSessions = customer.remaining_sessions || 0;
          results.push({
            id: `customer_${customer.id}`,
            type: 'customer',
            name: `${customer.contact_first_name} ${customer.contact_last_name}`,
            phone: customer.contact_phone,
            email: customer.contact_email,
            registration_code: customer.registration_code,
            badge: this.getCustomerBadge(customer.has_app_access, remainingSessions),
            sessions: {
              total_purchased: customer.total_sessions_purchased,
              remaining: remainingSessions
            },
            has_app_access: customer.has_app_access,
            can_book: remainingSessions > 0,
            color: customer.has_app_access ? '#28a745' : '#6c757d' // Green for app users, gray for non-app
          });
        });
      }

      res.json({ 
        results,
        total: results.length,
        query,
        type
      });

    } catch (error) {
      console.error('Search persons error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Quick search for appointment booking
  async quickSearch(req, res) {
    try {
      const { query, studio_id } = req.query;
      const studioId = studio_id || req.user.studio_id;

      if (!studioId) {
        return res.status(400).json({ message: 'Studio ID is required' });
      }

      if (!query || query.trim().length < 2) {
        return res.json({ results: [] });
      }

      const searchPattern = `%${query}%`;
      const results = [];

      // Search leads for trial appointments
      const leadsSql = `
        SELECT 
          l.id,
          l.name,
          l.phone_number,
          l.status,
          COUNT(a.id) as trial_count
        FROM leads l
        LEFT JOIN appointments a ON l.id = a.lead_id
        WHERE l.studio_id = ? 
          AND (l.name LIKE ? OR l.phone_number LIKE ?)
          AND l.is_archived = FALSE
        GROUP BY l.id
        HAVING trial_count = 0 OR l.status != 'trial_scheduled'
        ORDER BY l.created_at DESC
        LIMIT 5
      `;
      
      const leads = await db.all(leadsSql, [studioId, searchPattern, searchPattern]);

      leads.forEach(lead => {
        results.push({
          value: `lead_${lead.id}`,
          label: lead.name,
          subtitle: `Lead - ${lead.phone_number}`,
          type: 'lead',
          can_book_trial: true
        });
      });

      // Search customers for regular appointments
      const customersSql = `
        SELECT 
          c.id,
          c.contact_first_name,
          c.contact_last_name,
          c.contact_phone,
          c.registration_code,
          (SELECT remaining_sessions 
           FROM customer_sessions cs 
           WHERE cs.customer_id = c.id AND cs.status = 'active'
           LIMIT 1) as remaining_sessions
        FROM customers c
        WHERE c.studio_id = ? 
          AND (
            CONCAT(c.contact_first_name, ' ', c.contact_last_name) LIKE ? 
            OR c.contact_phone LIKE ?
            OR c.registration_code LIKE ?
          )
        ORDER BY c.customer_since DESC
        LIMIT 5
      `;
      
      const customers = await db.all(
        customersSql, 
        [studioId, searchPattern, searchPattern, searchPattern]
      );

      customers.forEach(customer => {
        const name = `${customer.contact_first_name} ${customer.contact_last_name}`;
        const remainingSessions = customer.remaining_sessions || 0;
        results.push({
          value: `customer_${customer.id}`,
          label: name,
          subtitle: `Kunde - ${customer.registration_code} (${remainingSessions} Sessions)`,
          type: 'customer',
          can_book: remainingSessions > 0,
          remaining_sessions: remainingSessions
        });
      });

      res.json({ results });

    } catch (error) {
      console.error('Quick search error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Helper method to get lead badge
  getLeadBadge(status) {
    const badges = {
      'new': 'Lead - Neu',
      'working': 'Lead - In Bearbeitung',
      'qualified': 'Lead - Qualifiziert',
      'trial_scheduled': 'Lead - Probe geplant',
      'converted': 'Lead - Konvertiert',
      'unreachable': 'Lead - Nicht erreichbar',
      'wrong_number': 'Lead - Falsche Nummer',
      'not_interested': 'Lead - Kein Interesse',
      'lost': 'Lead - Verloren'
    };
    return badges[status] || 'Lead';
  }

  // Helper method to get customer badge
  getCustomerBadge(hasAppAccess, remainingSessions) {
    if (hasAppAccess) {
      if (remainingSessions === 0) {
        return 'Kunde - App-Nutzer (Keine Sessions)';
      }
      return 'Kunde - App-Nutzer';
    } else {
      if (remainingSessions === 0) {
        return 'Kunde - Nicht registriert (Keine Sessions)';
      }
      return 'Kunde - Nicht registriert';
    }
  }
}

module.exports = new SearchController();