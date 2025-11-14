# DonniDeli - Purchase Tracking Application

A beautiful web application for tracking customer purchases with user authentication powered by Supabase.

## Features

### User Features
- User authentication (Sign up, Sign in, Password reset)
- Email confirmation
- Personal dashboard with purchase statistics
- **Unique barcode for each user** (for quick admin lookup)
- View total purchases and average spending per visit
- Purchase history management

### Admin Features
- Admin dashboard to manage client purchases
- **Look up clients by email address OR barcode** (supports barcode scanners)
- View client purchase statistics (total purchases, total spent, average per visit)
- Display client's unique barcode
- Add purchases for clients
- Delete individual purchases
- Reset purchase history for clients with 10+ purchases (reward system)

## Setup Instructions

1. **Create a Supabase Project**
   - Go to [https://supabase.com](https://supabase.com)
   - Create a new project
   - Copy your Project URL and Anon Key

2. **Configure Supabase Credentials**
   - Open `js/config.js`
   - Replace `YOUR_SUPABASE_PROJECT_URL` with your actual Supabase Project URL
   - Replace `YOUR_SUPABASE_ANON_KEY` with your actual Supabase Anon Key
   - Example:
     ```javascript
     const SUPABASE_URL = 'https://your-project.supabase.co';
     const SUPABASE_ANON_KEY = 'your-anon-key-here';
     ```

3. **Set Up Database Tables**
   Run the following SQL in your Supabase SQL Editor:

   ```sql
   -- Create purchases table
   CREATE TABLE purchases (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     amount DECIMAL(10, 2) NOT NULL,
     purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     notes TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

   -- Create policy to allow users to read their own purchases
   CREATE POLICY "Users can view their own purchases"
     ON purchases FOR SELECT
     USING (auth.uid() = user_id);

   -- Create policy to allow users to insert their own purchases
   CREATE POLICY "Users can insert their own purchases"
     ON purchases FOR INSERT
     WITH CHECK (auth.uid() = user_id);

   -- Create policy to allow users to update their own purchases
   CREATE POLICY "Users can update their own purchases"
     ON purchases FOR UPDATE
     USING (auth.uid() = user_id);

   -- Create policy to allow users to delete their own purchases
   CREATE POLICY "Users can delete their own purchases"
     ON purchases FOR DELETE
     USING (auth.uid() = user_id);
   ```

4. **Set Up Admin System (Optional)**
   - Run the SQL from `admin-setup.sql` in your Supabase SQL Editor
   - Create your admin account by signing up normally
   - Add your account as admin by running this SQL (replace with your email):
     ```sql
     INSERT INTO admins (user_id)
     SELECT id FROM auth.users WHERE email = 'your-admin@example.com';
     ```
   - Admin users can access the Admin Panel to manage client purchases

5. **Set Up Barcode System (Recommended)**
   - Run the SQL from `barcode-setup.sql` in your Supabase SQL Editor
   - This will create unique barcodes for all users (existing and new)
   - Users will see their barcode in their dashboard
   - Admins can search clients by barcode or email
   - See `BARCODE_SETUP_INSTRUCTIONS.md` for detailed setup and usage

6. **Configure Email Templates (Optional)**
   - In Supabase Dashboard, go to Authentication > Email Templates
   - Customize the confirmation and password reset emails

7. **Run the Application**
   - Open `index.html` in a web browser
   - Or use a local server like `python -m http.server` or `npx serve`

## Project Structure

```
donnideli2/
├── index.html                      # Homepage
├── signup.html                     # Sign up page
├── signin.html                     # Sign in page
├── reset-password.html             # Password reset page
├── email-confirmation.html         # Email confirmation page
├── dashboard.html                  # User dashboard
├── admin.html                      # Admin dashboard
├── admin-setup.sql                 # Admin system SQL setup
├── barcode-setup.sql               # Barcode system SQL setup
├── BARCODE_SETUP_INSTRUCTIONS.md   # Barcode setup guide
├── js/
│   ├── auth.js                    # Authentication handler
│   ├── dashboard.js               # Dashboard functionality
│   ├── admin.js                   # Admin functionality
│   └── config.js                  # Supabase configuration
├── css/
│   └── styles.css                 # Global styles
├── .env                           # Environment variables
└── README.md                      # This file
```

## Technologies Used

- HTML5
- CSS3
- Vanilla JavaScript
- Supabase (Backend & Authentication)
- Lucide Icons (via CDN)

## Adding Your Logo (Optional)

The project uses text placeholders for the logo. To add your own logo:

1. Add your logo images to the `images/` folder:
   - `logo.png` - For navigation bar (recommended size: 150x50px)
   - `logo-hero.png` - For homepage hero section (recommended size: 200x200px)

2. Update the HTML files to use your logo images instead of the text placeholders

## Security Notes

- **IMPORTANT**: Never commit `js/config.js` with real credentials to a public repository
- Keep your Supabase credentials private
- The Supabase Anon Key is safe to use in client-side code when combined with RLS
- Row Level Security (RLS) policies protect user data
- Consider using environment variables for production deployments
