// ================================================================
// Supabase Konfiguration
// Werte eintragen nach Projekt-Erstellung auf supabase.com:
//   Einstellungen → API → Project URL & anon public key
// ================================================================

const SUPABASE_URL  = 'https://vtdekigorlwlarvlshpp.supabase.co';   // z. B. https://xxxx.supabase.co
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZGVraWdvcmx3bGFydmxzaHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Njg1MTUsImV4cCI6MjA5NTU0NDUxNX0.79Iq7Py-KyCunT015cfC-y7bAHwQaYVzync2nC_LyJ4';       // beginnt mit "eyJ..."

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
