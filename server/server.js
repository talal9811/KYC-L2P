import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = 'demo-secret-key-change-in-production'; // Demo only!

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
const watchlistPath = path.join(dataDir, 'watchlist.json');
const checksLogPath = path.join(dataDir, 'checks_log.json');

// Initialize data files if they don't exist
async function initializeDataFiles() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    
    // Initialize watchlist.json if it doesn't exist
    try {
      await fs.access(watchlistPath);
    } catch {
      const defaultWatchlist = [
        {
          id: "DEMO-001",
          name: "John Demo",
          dateOfBirth: "1980-01-15",
          nationality: "US",
          idType: "Passport",
          idNumber: "P123456",
          notes: "Fake example only - DEMO DATA"
        },
        {
          id: "DEMO-002",
          name: "Jane Smith",
          dateOfBirth: "1975-05-20",
          nationality: "UK",
          idType: "National ID",
          idNumber: "UK789012",
          notes: "Fake example only - DEMO DATA"
        }
      ];
      await fs.writeFile(watchlistPath, JSON.stringify(defaultWatchlist, null, 2));
    }

    // Initialize checks_log.json if it doesn't exist
    try {
      await fs.access(checksLogPath);
    } catch {
      await fs.writeFile(checksLogPath, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Error initializing data files:', error);
  }
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Hardcoded demo credentials
  if (username === 'admin' && password === 'Admin123') {
    const token = jwt.sign({ username: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// Check person against watchlist
app.post('/api/check-person', verifyToken, async (req, res) => {
  try {
    const { fullName, dateOfBirth, nationality, idType, idNumber } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Load watchlist
    const watchlistData = await fs.readFile(watchlistPath, 'utf-8');
    const watchlist = JSON.parse(watchlistData);

    // Simple case-insensitive matching
    const matches = watchlist.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(fullName.toLowerCase()) ||
                       fullName.toLowerCase().includes(item.name.toLowerCase());
      
      let idMatch = true;
      if (idNumber && item.idNumber) {
        idMatch = item.idNumber.toLowerCase() === idNumber.toLowerCase();
      }

      return nameMatch && idMatch;
    });

    const result = {
      status: matches.length > 0 ? 'MATCH_FOUND' : 'NO_MATCH',
      matches: matches,
      person: {
        fullName,
        dateOfBirth,
        nationality,
        idType,
        idNumber
      }
    };

    // Log the check
    const logEntry = {
      timestamp: new Date().toISOString(),
      input: { fullName, dateOfBirth, nationality, idType, idNumber },
      result: result.status,
      matches: matches.length
    };

    const checksLogData = await fs.readFile(checksLogPath, 'utf-8');
    const checksLog = JSON.parse(checksLogData);
    checksLog.push(logEntry);
    await fs.writeFile(checksLogPath, JSON.stringify(checksLog, null, 2));

    res.json(result);
  } catch (error) {
    console.error('Error checking person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to escape HTML (no longer needed for PDF generation, but kept for potential future use)

// Generate certificate
app.post('/api/generate-certificate', verifyToken, async (req, res) => {
  try {
    const { person, timestamp } = req.body;

    console.log('Certificate generation request received');
    console.log('Request body:', JSON.stringify({ person, timestamp }, null, 2));
    console.log('Person object:', person);
    console.log('Person type:', typeof person);
    console.log('Person keys:', person ? Object.keys(person) : 'null');

    if (!person) {
      console.error('Error: Person data is missing from request body');
      return res.status(400).json({ error: 'Person data is required' });
    }

    if (!person.fullName && !person.name) {
      console.error('Error: Person full name is missing');
      console.error('Person object:', person);
      return res.status(400).json({ error: 'Person full name is required' });
    }

    console.log('Generating certificate number...');
    const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    console.log('Certificate number:', certificateNumber);
    
    const certDate = timestamp || new Date().toISOString();
    console.log('Certificate date:', certDate);
    
    let formattedDate;
    try {
      formattedDate = new Date(certDate).toLocaleString();
      if (formattedDate === 'Invalid Date') {
        console.warn('Invalid date, using current date');
        formattedDate = new Date().toLocaleString();
      }
    } catch (dateError) {
      console.error('Date formatting error:', dateError);
      formattedDate = new Date().toLocaleString();
    }
    console.log('Formatted date:', formattedDate);
    
    // Get person data with fallbacks
    const displayFullName = person.fullName || person.name || 'N/A';
    const displayDateOfBirth = person.dateOfBirth || 'N/A';
    const displayNationality = person.nationality || 'N/A';
    const displayIdType = person.idType || 'N/A';
    const displayIdNumber = person.idNumber || 'N/A';
    
    console.log('Person data for certificate:');
    console.log('  Full Name:', displayFullName);
    console.log('  Date of Birth:', displayDateOfBirth);
    console.log('  Nationality:', displayNationality);
    console.log('  ID Type:', displayIdType);
    console.log('  ID Number:', displayIdNumber);

    // Generate PDF certificate
    console.log('Generating PDF certificate...');
    
    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="clearance-certificate-${certificateNumber}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Try to add logo (if exists)
    // Place your company logo as logo.png in the server directory
    const logoPath = path.join(__dirname, 'logo.png');
    try {
      await fs.access(logoPath);
      // Center the logo horizontally
      const logoWidth = 100;
      const pageWidth = doc.page.width;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.image(logoPath, logoX, 50, { width: logoWidth });
      doc.moveDown(3);
      console.log('Logo added to certificate');
    } catch (logoError) {
      console.log('Logo not found at:', logoPath);
      console.log('To add a logo, place logo.png in the server directory');
      // Continue without logo
    }

    // Header
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#2563eb')
       .text('CLEARANCE CERTIFICATE', { align: 'center' })
       .moveDown(1);

    // Certificate Number
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666666')
       .text(`Certificate Number: ${certificateNumber}`, { align: 'right' })
       .moveDown(2);

    // Date
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#000000')
       .text(`Date: ${currentDate}`, { align: 'left' })
       .moveDown(2);

    // Full Name
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('Full Name:', { continued: true })
       .font('Helvetica')
       .text(` ${displayFullName}`)
       .moveDown(1.5);

    // Passport Number (ID Number)
    if (displayIdNumber !== 'N/A') {
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Passport Number:', { continued: true })
         .font('Helvetica')
         .text(` ${displayIdNumber}`)
         .moveDown(1.5);
    }

    // Clearance Statement
    doc.moveDown(2);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#10b981')
       .text('CLEARANCE STATEMENT', { align: 'center' })
       .moveDown(1);

    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#000000')
       .text('This man is not terrorist.', { align: 'center' })
       .moveDown(2);

    // Additional details
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Based on a comprehensive search of our internal watchlist database,', { align: 'center' })
       .text(`no matching record was found for ${displayFullName}.`, { align: 'center' })
       .moveDown(2);

    // Footer
    doc.fontSize(10)
       .font('Helvetica-Oblique')
       .fillColor('#999999')
       .text('This certificate is generated for informational purposes only.', { align: 'center' })
       .text(`Generated on: ${formattedDate}`, { align: 'center' });

    // Finalize PDF
    doc.end();
    
    console.log('PDF certificate generated and sent successfully');
  } catch (error) {
    console.error('Error generating certificate:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get check history
app.get('/api/check-history', verifyToken, async (req, res) => {
  try {
    console.log('Check history request received');
    const { query } = req.query;
    console.log('Query parameter:', query);
    
    let checksLog = [];
    
    // Ensure data directory exists
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (dirError) {
      console.warn('Could not create data directory:', dirError.message);
    }
    
    try {
      console.log('Reading check history from:', checksLogPath);
      const checksLogData = await fs.readFile(checksLogPath, 'utf-8');
      console.log('File read successfully, length:', checksLogData.length);
      
      if (checksLogData && checksLogData.trim()) {
        try {
          checksLog = JSON.parse(checksLogData);
          console.log('Parsed check history, entries:', checksLog.length);
        } catch (parseError) {
          console.error('Error parsing check history JSON:', parseError.message);
          console.error('File content (first 200 chars):', checksLogData.substring(0, 200));
          checksLog = [];
        }
      } else {
        console.log('Check history file is empty');
        checksLog = [];
      }
    } catch (fileError) {
      // File doesn't exist or is empty - that's okay, return empty array
      if (fileError.code === 'ENOENT') {
        console.log('Check history file does not exist yet, returning empty history');
        // Try to create the file
        try {
          await fs.writeFile(checksLogPath, JSON.stringify([], null, 2));
          console.log('Created empty check history file');
        } catch (writeError) {
          console.warn('Could not create check history file:', writeError.message);
        }
      } else {
        console.warn('Error reading check history file:', fileError.message);
        console.warn('Error code:', fileError.code);
      }
      checksLog = [];
    }

    // Ensure checksLog is an array
    if (!Array.isArray(checksLog)) {
      console.warn('Check history is not an array, resetting to empty array');
      console.warn('Type:', typeof checksLog);
      checksLog = [];
    }

    // Filter by query if provided
    if (query) {
      const queryLower = query.toLowerCase();
      const beforeFilter = checksLog.length;
      checksLog = checksLog.filter(entry => {
        if (!entry || typeof entry !== 'object') return false;
        const name = entry.input?.fullName?.toLowerCase() || '';
        const id = entry.input?.idNumber?.toLowerCase() || '';
        return name.includes(queryLower) || id.includes(queryLower);
      });
      console.log(`Filtered from ${beforeFilter} to ${checksLog.length} entries`);
    }

    // Return most recent first
    checksLog.reverse();

    console.log('Returning history with', checksLog.length, 'entries');
    res.json({ history: checksLog });
  } catch (error) {
    console.error('Error fetching check history:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Always return valid JSON, even on error
    try {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } catch (sendError) {
      console.error('Failed to send error response:', sendError);
      // Last resort - try to send a plain text response
      res.status(500).send('Internal server error');
    }
  }
});

// Get current watchlist data
app.get('/api/watchlist', verifyToken, async (req, res) => {
  try {
    const watchlistData = await fs.readFile(watchlistPath, 'utf-8');
    const watchlist = JSON.parse(watchlistData);
    res.json({ watchlist });
  } catch (error) {
    console.error('Error loading watchlist:', error);
    res.status(500).json({ error: 'Failed to load watchlist' });
  }
});

// Replace watchlist data with provided JSON
app.put('/api/watchlist', verifyToken, async (req, res) => {
  try {
    const { watchlist } = req.body;

    if (!Array.isArray(watchlist)) {
      return res.status(400).json({ error: 'Watchlist must be an array of entries' });
    }

    await fs.writeFile(watchlistPath, JSON.stringify(watchlist, null, 2));

    res.json({
      success: true,
      count: watchlist.length
    });
  } catch (error) {
    console.error('Error saving watchlist:', error);
    res.status(500).json({ error: 'Failed to save watchlist' });
  }
});

// Start server
app.listen(PORT, async () => {
  await initializeDataFiles();
  console.log(`Server running on http://localhost:${PORT}`);
});


