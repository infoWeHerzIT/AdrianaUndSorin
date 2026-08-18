// ================================================================
// Dynamics CRM Integration (Dataverse via Supabase Edge Functions)
// ----------------------------------------------------------------
// Browser-JS darf nie direkt mit Client-Secret gegen die Dataverse Web API
// sprechen – das Secret wäre für jeden im Quelltext sichtbar. Stattdessen
// ruft diese Klasse die Supabase Edge Functions "crm-submit" bzw.
// "crm-survey-submit" auf, die serverseitig mit der bestehenden Dynamics-
// Verbindung die Datensätze anlegen/aktualisieren.
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

  // Legt einen Lead (wht_lead) an (supabase/functions/crm-submit[-dev]).
  // eventId: Supabase-Event-ID (z. B. "evt_..."), der die Anmeldung zugeordnet
  // ist — wird als wht_eventid mitgeschickt (optional).
  // quelle: numerische ID aus dem "Wie hast du von uns erfahren?"-Feld (optional).
  // interesseAnCoachingOptIn / einwilligungDatenverarbeitungOptIn /
  // newsletterOptIn / testimonialOptIn: true, wenn die jeweilige Checkbox
  // beim Absenden gesetzt war — die Function trägt dafür serverseitig das
  // aktuelle Datum ein (Dynamics speichert dort den Zeitpunkt der
  // Zustimmung, kein Bool). Alle vier sind optional; wird ein Feld nicht
  // angegeben, bleibt es in Dynamics einfach leer.
  submitLead(fields) {
    fields = fields || {};
    return this.client.functions.invoke(this._functionName('crm-submit'), {
      body: {
        firstname:                          fields.firstname   || '',
        lastname:                           fields.lastname    || '',
        email:                              fields.email       || '',
        mobilephone:                        fields.mobilephone || '',
        eventId:                            fields.eventId      || '',
        quelle:                             fields.quelle != null && fields.quelle !== '' ? fields.quelle : null,
        interesseAnCoachingOptIn:           !!fields.interesseAnCoachingOptIn,
        einwilligungDatenverarbeitungOptIn: !!fields.einwilligungDatenverarbeitungOptIn,
        newsletterOptIn:                    !!fields.newsletterOptIn,
        testimonialOptIn:                   !!fields.testimonialOptIn
      }
    }).catch(function (err) {
      console.error('CRM submit error:', err);
    });
  }

  // Legt einen Lead (wht_lead) mit den übergebenen Umfrage-Antworten als JSON
  // (wht_jsoncontent) an (supabase/functions/crm-survey-submit[-dev]).
  // eventId: Dynamics-Event-GUID (wht_eventid), der die Umfrage zugeordnet
  // ist — wird als wht_EventId-Lookup mitgeschickt (optional).
  submitSurvey(fields) {
    fields = fields || {};
    return this.client.functions.invoke(this._functionName('crm-survey-submit'), {
      body: {
        firstname:   fields.firstname   || '',
        lastname:    fields.lastname    || '',
        email:       fields.email       || '',
        mobilephone: fields.mobilephone || '',
        eventId:     fields.eventId     || '',
        survey:      fields.survey      || {}
      }
    }).catch(function (err) {
      console.error('CRM submit error:', err);
    });
  }

  // Liest alle Events aus Dynamics (Entität wht_event, read-only) —
  // supabase/functions/dynamics-events-list[-dev]. Gibt bei Fehlern ein
  // leeres Array zurück statt zu werfen, damit eine Kalenderseite nie mit
  // einer Exception hängen bleibt.
  listEvents() {
    return this.client.functions.invoke(this._functionName('dynamics-events-list'), {
      method: 'GET'
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    }).catch(function (err) {
      console.error('CRM list events error:', err);
      return [];
    });
  }

  // Liest eine dynamische Umfrage-Definition (wht_survey + wht_surveyquestion
  // + wht_surveyquestionoption, read-only) anhand ihres Slugs —
  // supabase/functions/dynamics-survey-get[-dev]. Gibt bei Fehlern ODER wenn
  // keine Umfrage mit diesem Slug existiert bewusst "null" zurück (nicht ein
  // leeres Array/Objekt) — "nicht gefunden/Ladefehler" und "Umfrage ohne
  // Fragen" sind unterschiedliche Zustände, die die aufrufende Seite
  // unterschiedlich behandeln muss.
  getSurvey(slug) {
    var fnName = this._functionName('dynamics-survey-get') + '?slug=' + encodeURIComponent(slug || '');
    return this.client.functions.invoke(fnName, {
      method: 'GET'
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || null;
    }).catch(function (err) {
      console.error('CRM get survey error:', err);
      return null;
    });
  }

  // Wie getSurvey(), aber Lookup per Dynamics-GUID (wht_surveyid) statt per
  // Slug — für Seiten, die per "?id=<guid>" statt "?survey=<slug>" verlinkt
  // werden. Gleiches "null bei Fehler/nicht gefunden"-Verhalten wie getSurvey().
  getSurveyById(id) {
    var fnName = this._functionName('dynamics-survey-get') + '?id=' + encodeURIComponent(id || '');
    return this.client.functions.invoke(fnName, {
      method: 'GET'
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || null;
    }).catch(function (err) {
      console.error('CRM get survey by id error:', err);
      return null;
    });
  }

  // Legt eine Umfrage-Einreichung normalisiert in Dynamics an: 1 Lead
  // (Kontaktdaten) + 1 wht_surveyresponse (Klammer der Einreichung) + je
  // beantworteter Frage 1 (oder bei Mehrfachauswahl mehrere)
  // wht_surveyanswer-Zeile(n) — supabase/functions/crm-survey-response-submit[-dev].
  // fields.surveyId: Dynamics wht_surveyid-GUID (Pflicht).
  // fields.answers: Array aus { questionId, value } (Text/E-Mail/Telefon/
  // Nummer) ODER { questionId, optionIds: [...] } (Einmal-/Mehrfachauswahl).
  submitSurveyResponse(fields) {
    fields = fields || {};
    return this.client.functions.invoke(this._functionName('crm-survey-response-submit'), {
      body: {
        firstname:   fields.firstname   || '',
        lastname:    fields.lastname    || '',
        email:       fields.email       || '',
        mobilephone: fields.mobilephone || '',
        eventId:     fields.eventId     || '',
        surveyId:    fields.surveyId    || '',
        answers:     fields.answers     || []
      }
    }).catch(function (err) {
      console.error('CRM submit survey response error:', err);
    });
  }

  // Listet alle aktiven Umfragen (wht_survey, read-only) —
  // supabase/functions/dynamics-surveys-list[-dev]. Gibt bei Fehlern ein
  // leeres Array zurück statt zu werfen, analog zu listEvents().
  listSurveys() {
    return this.client.functions.invoke(this._functionName('dynamics-surveys-list'), {
      method: 'GET'
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    }).catch(function (err) {
      console.error('CRM list surveys error:', err);
      return [];
    });
  }

  // Liest und aggregiert die Ergebnisse einer Umfrage anhand ihrer
  // Dynamics-GUID — supabase/functions/dynamics-survey-results[-dev].
  // Anders als getSurvey()/getSurveyById() (fürs Formular) liefert das hier
  // pro Frage bereits ausgewertete Daten: Häufigkeiten pro Option bei
  // Auswahl-Fragen, die Liste der Einzelantworten bei Text-Fragen. Gleiches
  // "null bei Fehler/nicht gefunden"-Verhalten wie getSurvey().
  getSurveyResults(id) {
    var fnName = this._functionName('dynamics-survey-results') + '?id=' + encodeURIComponent(id || '');
    return this.client.functions.invoke(fnName, {
      method: 'GET'
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || null;
    }).catch(function (err) {
      console.error('CRM get survey results error:', err);
      return null;
    });
  }

  // Bestätigt die Double-Opt-In-E-Mail eines Leads: prüft, ob "token"
  // (die Lead-GUID) zu einem Lead mit der übergebenen E-Mail-Adresse
  // gehört, und setzt bei Erfolg statuscode=Active + wht_doubleoptinam —
  // supabase/functions/crm-lead-confirm[-dev]. Anders als die übrigen
  // Methoden hier NICHT silent-catch: verify-email.html muss das Ergebnis
  // (Erfolg/bereits bestätigt/Fehler) anzeigen.
  confirmLead(email, token) {
    return this.client.functions.invoke(this._functionName('crm-lead-confirm'), {
      body: { email: email || '', token: token || '' }
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    }).catch(function (err) {
      console.error('CRM confirm lead error:', err);
      return { success: false, error: String(err) };
    });
  }
}

var dynamicsCRM = new DynamicsCRM();
