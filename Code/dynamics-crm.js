// ================================================================
// Dynamics CRM Integration (Dataverse via Supabase Edge Functions)
// ----------------------------------------------------------------
// Browser-JS darf nie direkt mit Client-Secret gegen die Dataverse Web API
// (…/api/data/v9.2/contacts) sprechen – das Secret wäre für jeden im
// Quelltext sichtbar. Stattdessen ruft diese Klasse die Supabase Edge
// Functions "crm-submit" bzw. "crm-survey-submit" auf, die serverseitig
// mit der bestehenden Dynamics-Verbindung den Kontakt anlegen/aktualisieren.
//
// Voraussetzung: supabase-config.js ist VOR dieser Datei eingebunden
// (stellt den globalen "db"-Client bereit).
//
// Alle Methoden sind fire-and-forget: Fehler werden geloggt, aber nie
// geworfen, damit ein CRM-Ausfall nie die Registrierung/Weiterleitung
// des Nutzers blockiert.
// ================================================================

class DynamicsCRM {
  constructor(client) {
    this.client = client || (typeof db !== 'undefined' ? db : null);
  }

  // Legt einen Kontakt an/aktualisiert ihn (supabase/functions/crm-submit).
  submitContact(fields) {
    fields = fields || {};
    return this.client.functions.invoke('crm-submit', {
      body: {
        firstname:   fields.firstname   || '',
        lastname:    fields.lastname    || '',
        email:       fields.email       || '',
        mobilephone: fields.mobilephone || ''
      }
    }).catch(function (err) {
      console.error('CRM submit error:', err);
    });
  }

  // Wie submitContact, hängt zusätzlich die übergebenen Antworten als
  // JSON-Notiz an den Kontakt (supabase/functions/crm-survey-submit).
  submitSurvey(fields) {
    fields = fields || {};
    return this.client.functions.invoke('crm-survey-submit', {
      body: {
        firstname:   fields.firstname   || '',
        lastname:    fields.lastname    || '',
        email:       fields.email       || '',
        mobilephone: fields.mobilephone || '',
        survey:      fields.survey      || {}
      }
    }).catch(function (err) {
      console.error('CRM submit error:', err);
    });
  }
}

var dynamicsCRM = new DynamicsCRM();
