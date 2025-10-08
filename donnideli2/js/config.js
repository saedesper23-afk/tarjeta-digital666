// Supabase Configuration
// IMPORTANT: Replace these placeholder values with your actual Supabase credentials
// Get them from: https://app.supabase.com/project/YOUR_PROJECT/settings/api

const SUPABASE_URL = 'https://puzofatutnflclickbbr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1em9mYXR1dG5mbGNsaWNrYmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzMwODIsImV4cCI6MjA3NTIwOTA4Mn0.e1fl9CZbUDx_0ZTGB7yrVNNIjIk-N0a4JcqioAXUGeI';

// Validate configuration before initializing
if (!SUPABASE_URL || SUPABASE_URL === 'your_supabase_project_url_here') {
    console.error('❌ CONFIGURATION ERROR: Please update SUPABASE_URL in js/config.js with your actual Supabase project URL');
    alert('Configuration Error: Supabase URL not configured. Please check js/config.js and update with your Supabase credentials.');
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'your_supabase_anon_key_here') {
    console.error('❌ CONFIGURATION ERROR: Please update SUPABASE_ANON_KEY in js/config.js with your actual Supabase anon key');
    alert('Configuration Error: Supabase Anon Key not configured. Please check js/config.js and update with your Supabase credentials.');
}

// Initialize Supabase client
let supabase = null;
try {
    if (SUPABASE_URL !== 'your_supabase_project_url_here' && SUPABASE_ANON_KEY !== 'your_supabase_anon_key_here') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    alert('Failed to initialize Supabase. Please check your configuration in js/config.js');
}

// Export for use in other files
window.supabaseClient = supabase;
