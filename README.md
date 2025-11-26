# KYC Watchlist Checker (DEMO)

A simple demo web application for KYC (Know Your Customer) watchlist checking. **This is for demonstration purposes only and uses fake data.**

## ⚠️ Important Disclaimer

This application is **DEMO ONLY** and uses **FAKE DATA**. It is not an official or legal clearance system and should not be used for any real-world KYC or compliance purposes.

## Features

- **Login System**: Simple authentication with demo credentials
- **Watchlist Checking**: Check individuals against a local JSON watchlist
- **Certificate Generation**: Generate clearance certificates for non-matches
- **Check History**: View and search previous watchlist checks
- **Clean UI**: Modern, responsive design with Tailwind CSS

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **Data Storage**: JSON files (no database)

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. **Install backend dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Running the Application

1. **Start the backend server:**
   ```bash
   cd server
   npm start
   ```
   The server will run on `http://localhost:3001`

2. **Start the frontend (in a new terminal):**
   ```bash
   cd client
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Demo Credentials

- **Username**: `admin`
- **Password**: `Admin123`

## Project Structure

```
terrorist-list/
├── server/
│   ├── server.js          # Express backend server
│   ├── package.json
│   └── data/              # Data files (auto-created)
│       ├── watchlist.json # Fake watchlist entries
│       └── checks_log.json # Log of all checks
├── client/
│   ├── src/
│   │   ├── pages/         # React pages
│   │   │   ├── Login.jsx
│   │   │   └── Home.jsx
│   │   ├── context/       # Auth context
│   │   │   └── AuthContext.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

## API Endpoints

- `POST /api/login` - Login with username/password
- `POST /api/check-person` - Check person against watchlist (requires auth)
- `POST /api/generate-certificate` - Generate clearance certificate (requires auth)
- `GET /api/check-history` - Get check history with optional search (requires auth)

## Data Files

The application automatically creates:
- `server/data/watchlist.json` - Contains fake watchlist entries
- `server/data/checks_log.json` - Logs all watchlist checks

## Notes

- All data is fake and for demonstration only
- JWT tokens are stored in localStorage (not secure for production)
- No real database is used - all data is stored in JSON files
- The watchlist matching is simple case-insensitive name/ID matching

## License

This is a demo project for educational purposes only.
