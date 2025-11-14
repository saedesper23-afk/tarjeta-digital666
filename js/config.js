// Supabase Configuration
// IMPORTANT: Replace these placeholder values with your actual Supabase credentials
// Get them from: https://app.supabase.com/project/YOUR_PROJECT/settings/api

const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Validate configuration before initializing
if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL') {
    console.error('❌ CONFIGURATION ERROR: Please update SUPABASE_URL in js/config.js with your actual Supabase project URL');
    alert('Configuration Error: Supabase URL not configured. Please check js/config.js and update with your Supabase credentials.');
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.error('❌ CONFIGURATION ERROR: Please update SUPABASE_ANON_KEY in js/config.js with your actual Supabase anon key');
    alert('Configuration Error: Supabase Anon Key not configured. Please check js/config.js and update with your Supabase credentials.');
}

// Initialize Supabase client
let supabase = null;
try {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    alert('Failed to initialize Supabase. Please check your configuration in js/config.js');
}

// Export for use in other files
window.supabaseClient = supabase;
