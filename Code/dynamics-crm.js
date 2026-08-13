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
//
// ── DEV/PROD-Routing ────────────────────────────────────────────
// Welche Dynamics-Umgebung angesprochen wird, entscheidet NICHT der Client
// (der hat gar keinen Zugriff auf Secrets), sondern welche Edge Function
// aufgerufen wird: "crm-submit" schreibt gegen Dynamics PROD (eigene
// DYNAMICS_PROD_*-Secrets), "crm-submit-dev" gegen Dynamics DEV (die
// bereits vorhandenen DYNAMICS_*-Secrets) — siehe supabase/functions/crm-submit(-dev).
// Diese Klasse wählt nur den Funktionsnamen anhand der Umgebung, in der
// die Seite gerade läuft:
//   - localhost/127.0.0.1/file:// oder ?dynamics_env=dev  → *-dev (DEV)
//   - alles andere (z. B. infoweherzit.github.io)         → * (PROD)
// ================================================================

class DynamicsCRM {
  constructor(client, environment) {
    this.client = client || (typeof db !== 'undefined' ? db : null);
    this.environment = environment || DynamicsCRM.detectEnvironment();
    console.info('[DynamicsCRM] Ziel-Umgebung:', this.environment);
  }

  static detectEnvironment() {
    try {
      var override = new URLSearchParams(window.location.search).get('dynamics_env');
      if (override === 'dev' || override === 'prod') return override;

      var host = window.location.hostname;
      var isLocal = window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '';
      return isLocal ? 'dev' : 'prod';
    } catch (e) {
      return 'prod';
    }
  }

  _functionName(base) {
    return this.environment === 'dev' ? base + '-dev' : base;
  }

  // Legt einen Kontakt an/aktualisiert ihn (supabase/functions/crm-submit[-dev]).
  submitContact(fields) {
    fields = fields || {};
    return this.client.functions.invoke(this._functionName('crm-submit'), {
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
  // JSON-Notiz an den Kontakt (supabase/functions/crm-survey-submit[-dev]).
  submitSurvey(fields) {
    fields = fields || {};
    return this.client.functions.invoke(this._functionName('crm-survey-submit'), {
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
