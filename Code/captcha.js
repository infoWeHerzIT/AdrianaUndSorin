/*
 * Google reCAPTCHA v2 (Checkbox) — geteilte Ladelogik.
 * Rendert jedes Element mit Klasse "g-recaptcha" auf der Seite (unabhängig
 * davon, in welchem Formular es steckt) und stellt eine einfache Prüf-
 * funktion bereit, um vor dem Absenden zu prüfen, ob es gelöst wurde.
 *
 * Einbindung: <script src="Code/captcha.js"></script> (bzw. "../Code/captcha.js"
 * aus Unterordnern) einmal pro Seite, dann irgendwo im Markup:
 *   <div class="g-recaptcha" data-sitekey="…"></div>
 *
 * Vor dem Absenden prüfen: if (!captchaIsSolved()) { … Fehler anzeigen … }
 */
(function (global) {
  'use strict';

  function loadScript(url, callback) {
    var script = document.createElement('script');
    script.src = url;
    if (callback) {
      script.onload = script.onreadystatechange = function () {
        if (!this.readyState || this.readyState === 'complete') callback();
      };
    }
    document.head.appendChild(script);
  }

  global.recaptcha_callback = function () {
    var recaptchas = document.getElementsByClassName('g-recaptcha');
    for (var i = 0; i < recaptchas.length; i++) {
      var recaptchaId = 'recaptcha_' + i;
      recaptchas[i].id = recaptchaId;
      var el = document.getElementById(recaptchaId);
      if (el) {
        var sitekey = el.getAttribute('data-sitekey');
        var stoken = el.getAttribute('data-stoken');
        global.grecaptcha.render(recaptchaId, { sitekey: sitekey, stoken: stoken });
      }
    }
  };

  global.captchaIsSolved = function () {
    if (typeof global.grecaptcha === 'undefined') return false;
    try { return !!global.grecaptcha.getResponse(); } catch (e) { return false; }
  };

  loadScript('https://www.google.com/recaptcha/api.js?onload=recaptcha_callback&render=explicit');
})(window);
