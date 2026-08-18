// ================================================================
// Dynamic Survey Renderer
// ----------------------------------------------------------------
// Baut aus einer Fragenliste (wie von dynamicsCRM.getSurvey() geliefert)
// ein Formular in ein gegebenes Container-Element und sammelt beim
// Absenden die Antworten in der Form, die
// dynamicsCRM.submitSurveyResponse({ answers: [...] }) erwartet:
//   { questionId, value }              — bei text/email/telefon/nummer
//   { questionId, options: [{id,label}] } — bei einmal-/mehrfachauswahl
//     (einmalauswahl: options mit genau einem Eintrag). Das Label wird
//     mitgeschickt, damit wht_surveyanswer.wht_value (Primary-Name-Feld
//     in Dynamics) auch bei Auswahl-Antworten befüllt werden kann.
//
// Nutzung:
//   var renderer = new DynamicSurveyRenderer(document.getElementById('root'));
//   renderer.renderQuestions(questions);
//   ...
//   if (!renderer.validate()) return;
//   var answers = renderer.getAnswers();
// ================================================================

class DynamicSurveyRenderer {
  constructor(container) {
    this.container = container;
    this.questions = [];
  }

  static esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  renderQuestions(questions) {
    this.questions = questions || [];
    var esc = DynamicSurveyRenderer.esc;
    var html = this.questions.map(function (q, idx) {
      var reqBadge = q.required ? ' <span class="req">*</span>' : '';
      var fieldId = 'dq-' + q.id;
      var errId = 'err-dq-' + q.id;
      var body = '';

      if (q.type === 'mehrfachauswahl') {
        body =
          '<div class="option-list" id="' + fieldId + '">' +
          (q.options || []).map(function (o) {
            return '<label class="option-item"><input type="checkbox" name="' + fieldId + '" value="' + esc(o.id) + '"> ' + esc(o.label) + '</label>';
          }).join('') +
          '</div>';
      } else if (q.type === 'einmalauswahl') {
        body =
          '<div class="option-list" id="' + fieldId + '">' +
          (q.options || []).map(function (o) {
            return '<label class="option-item"><input type="radio" name="' + fieldId + '" value="' + esc(o.id) + '"> ' + esc(o.label) + '</label>';
          }).join('') +
          '</div>';
      } else if (q.type === 'text') {
        body = '<textarea class="form-textarea" id="' + fieldId + '"></textarea>';
      } else if (q.type === 'email') {
        body = '<input class="form-input" type="email" id="' + fieldId + '" placeholder="max@beispiel.de">';
      } else if (q.type === 'telefon') {
        body = '<input class="form-input" type="tel" id="' + fieldId + '" placeholder="+49 123 456789">';
      } else if (q.type === 'nummer') {
        body = '<input class="form-input" type="number" id="' + fieldId + '">';
      } else {
        // Unbekannter/nicht erkannter Typ: sicherer Fallback statt eines
        // stillen Blindgängers (leeres/kaputtes Feld ohne Erklärung).
        console.warn('[DynamicSurveyRenderer] Unbekannter Fragetyp "' + q.type + '" bei Frage ' + q.id + ' — falle auf Textfeld zurück.');
        body = '<input class="form-input" type="text" id="' + fieldId + '">';
      }

      return (
        '<div class="form-group" data-question-id="' + esc(q.id) + '" data-question-type="' + esc(q.type) + '">' +
        '<label class="question-label">' + (idx + 1) + '. ' + esc(q.label) + reqBadge + '</label>' +
        body +
        '<span class="field-error" id="' + errId + '">Bitte beantworte diese Frage.</span>' +
        '</div>'
      );
    }).join('');

    this.container.innerHTML = html;

    // Fehler beim Interagieren wieder entfernen
    var self = this;
    this.questions.forEach(function (q) {
      var fieldId = 'dq-' + q.id;
      var group = self.container.querySelector('[data-question-id="' + q.id.replace(/"/g, '') + '"]');
      if (!group) return;
      group.addEventListener('change', function () { self._clearError(q.id); });
      group.addEventListener('input', function () { self._clearError(q.id); });
    });
  }

  _clearError(questionId) {
    var group = this.container.querySelector('[data-question-id="' + questionId + '"]');
    if (!group) return;
    group.classList.remove('error');
    var err = document.getElementById('err-dq-' + questionId);
    if (err) err.classList.remove('visible');
    var optList = group.querySelector('.option-list');
    if (optList) optList.classList.remove('error');
  }

  // Prüft alle Pflichtfragen, markiert Fehler visuell, fokussiert die erste
  // ungültige Frage. Gibt true zurück, wenn alles gültig ist.
  validate() {
    var valid = true;
    var firstInvalid = null;

    this.questions.forEach((q) => {
      if (!q.required) return;
      var ok = this._isAnswered(q);
      var group = this.container.querySelector('[data-question-id="' + q.id + '"]');
      var err = document.getElementById('err-dq-' + q.id);
      if (!ok) {
        valid = false;
        if (group) group.classList.add('error');
        var optList = group ? group.querySelector('.option-list') : null;
        if (optList) optList.classList.add('error');
        if (err) err.classList.add('visible');
        if (!firstInvalid) firstInvalid = group;
      } else {
        if (group) group.classList.remove('error');
        if (err) err.classList.remove('visible');
      }
    });

    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return valid;
  }

  _isAnswered(q) {
    var fieldId = 'dq-' + q.id;
    if (q.type === 'mehrfachauswahl' || q.type === 'einmalauswahl') {
      return this.container.querySelectorAll('input[name="' + fieldId + '"]:checked').length > 0;
    }
    var el = document.getElementById(fieldId);
    return !!(el && el.value && el.value.trim());
  }

  // Sammelt die Antworten in der vom Write-Endpoint erwarteten Form.
  // Unbeantwortete, nicht-pflicht Fragen werden ausgelassen.
  getAnswers() {
    var answers = [];
    var fieldId;
    this.questions.forEach((q) => {
      fieldId = 'dq-' + q.id;
      if (q.type === 'mehrfachauswahl' || q.type === 'einmalauswahl') {
        var checkedIds = Array.prototype.slice
          .call(this.container.querySelectorAll('input[name="' + fieldId + '"]:checked'))
          .map(function (inp) { return inp.value; });
        if (checkedIds.length > 0) {
          // Label pro gewählter Option mitschicken (nicht nur die GUID) —
          // wht_surveyanswer.wht_value ist das Primary-Name-Feld in Dynamics
          // und würde sonst bei Auswahl-Antworten leer bleiben.
          var options = checkedIds.map(function (id) {
            var opt = (q.options || []).find(function (o) { return o.id === id; });
            return { id: id, label: opt ? opt.label : '' };
          });
          answers.push({ questionId: q.id, options: options });
        }
      } else {
        var el = document.getElementById(fieldId);
        var val = el ? el.value.trim() : '';
        if (val) answers.push({ questionId: q.id, value: val });
      }
    });
    return answers;
  }
}
