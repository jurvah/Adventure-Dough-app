# Adventure Dough

Mobile-first React PWA for tracking farmers market sales, expenses, orders, and customers. Wraps as a native iOS app via Capacitor.

## Prerequisites

- Node.js 18+
- A Firebase project (free Spark tier)
- Xcode (for iOS build)

## Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. In the project, enable **Firestore Database** (start in production mode).
3. Enable **Authentication** → Sign-in method → **Anonymous**.
4. In Project Settings → General → Your apps, click **Add app** → Web, register it, and copy the config.
5. Update Firestore security rules (in Firestore → Rules tab):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == get(/databases/$(database)/documents/meta/owner).data.uid;
    }
  }
}
```

6. Copy `.env.example` to `.env.local` and fill in your values:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

The Anthropic API key is used for receipt scanning (optional — the form works without it).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## iOS Build (Capacitor)

### First-time setup

```bash
npm install @capacitor/cli @capacitor/ios -D
npm run build
npx cap add ios
npx cap sync
```

### After each code change

```bash
npm run build
npx cap sync
```

Then open Xcode:

```bash
npx cap open ios
```

### Sideloading to your iPhone (no paid developer account)

1. Open `ios/App/App.xcodeproj` in Xcode.
2. Select the `App` target → Signing & Capabilities.
3. Under Team, select your personal Apple ID (free account).
4. Connect your iPhone via USB.
5. Select your iPhone as the build destination.
6. Press **Run** (⌘R).
7. On your iPhone, go to Settings → General → VPN & Device Management → trust your developer certificate.

> **Important:** Free provisioning certificates expire every **7 days**. You must reconnect your iPhone, open Xcode, and rebuild weekly to keep the app working.

## Project Structure

```
src/
  App.jsx           # Root: auth, tab router, shared products state
  firebase.js       # Firebase init + re-exported helpers
  constants.js      # Color tokens, constants, utility functions
  main.jsx          # React entry point
  tabs/
    Record.jsx      # Sales entry tab
    Orders.jsx      # Order queue tab
    Customers.jsx   # CRM tab
    Treasury.jsx    # Financial summary tab
  components/
    Sheet.jsx       # Bottom sheet modal
    Pill.jsx        # Toggle pill button
    ExpenseSheet.jsx  # Expense form with receipt scan
    IncomeSheet.jsx   # Other income form
    ProductsSheet.jsx # Product management
```

## Collections (Firestore)

| Collection | Fields |
|---|---|
| `/products` | name, price, createdAt |
| `/marketSales` | market, date, productId, productName, unitsSold, pricePerUnit, revenue, createdAt |
| `/transactions` | type ("expense"\|"income"), date, category, amount, notes, createdAt |
| `/orders` | customerName, customerContact, items[], total, status, notes, dueDate, createdAt, completedAt |
| `/customers` | name, phone, email, instagram, tags[], leadStatus, newsletterOptIn, notes, orderIds[], createdAt, updatedAt |
| `/meta/owner` | uid (anonymous auth UID — written on first launch) |
