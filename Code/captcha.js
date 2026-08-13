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
 *
 * DEV/PROD: Auf localhost/127.0.0.1/file:// (lokales Testen) wird das
 * reCAPTCHA-Widget weder geladen noch angezeigt, und captchaIsSolved()
 * liefert automatisch true — beim lokalen Testen ist keine Bestätigung
 * nötig. Nur auf einer echten Domain (PROD) wird es geladen und verlangt.
 */
(function (global) {
  'use strict';

  function isLocalEnvironment() {
    try {
      var host = global.location.hostname;
      return global.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '';
    } catch (e) {
      return false;
    }
  }

  var isDev = isLocalEnvironment();

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
    if (isDev) return true;
    if (typeof global.grecaptcha === 'undefined') return false;
    try { return !!global.grecaptcha.getResponse(); } catch (e) { return false; }
  };

  if (isDev) {
    console.info('[captcha] DEV-Umgebung erkannt – reCAPTCHA wird nicht geladen.');
    document.addEventListener('DOMContentLoaded', function () {
      var recaptchas = document.getElementsByClassName('g-recaptcha');
      for (var i = recaptchas.length - 1; i >= 0; i--) {
        var wrapper = recaptchas[i].closest('.form-group') || recaptchas[i];
        wrapper.style.display = 'none';
      }
    });
  } else {
    loadScript('https://www.google.com/recaptcha/api.js?onload=recaptcha_callback&render=explicit');
  }
})(window);
