// ================================================================
// EmailJS Konfiguration
// Werte eintragen nach Setup auf emailjs.com:
//   Account → API Keys (Public Key) · Email Services (Service ID) · Email Templates (Template ID)
// ================================================================

const EMAILJS_PUBLIC_KEY  = '61HDtV0fSnuRzKNd4';
const EMAILJS_SERVICE_ID  = 'service_6jnlzxd';
const EMAILJS_TEMPLATE_ID_Erfolgreiche_Registrierung_fur_Nutzer = 'template_e42axd9';
const EMAILJS_TEMPLATE_ID_Dankeschön_und_Bonus = 'template_3nqqrk3';

const EMAILJS_REGISTRIERUNG_TEST_BCC         = 'sorin.ratiu@weherzit.de; vukinadriana@gmail.com';
const EMAILJS_REGISTRIERUNG_BCC         = 'sorin.ratiu@weherzit.de; vukinadriana@gmail.com';
const EMAILJS_EVENT_DETAILS_CHANGE_BCC         = '';

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
