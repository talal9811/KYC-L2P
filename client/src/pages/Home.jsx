import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase/firebase'
import { Upload, FileSearch, CheckCircle2, Zap, Shield, Search, FileText, LogOut, Menu, X, User, Calendar, Globe, CreditCard, AlertTriangle, CheckCircle, XCircle, Settings, Database, Moon, Sun } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function Home() {
  const { logout, getToken, user, isAuthenticated } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    fullName: '',
    nationality: '',
    idNumber: ''
  })
  
  const [checkResult, setCheckResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [watchlistText, setWatchlistText] = useState('')
  const [watchlistMessage, setWatchlistMessage] = useState(null)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistSaving, setWatchlistSaving] = useState(false)
  const [watchlistFileName, setWatchlistFileName] = useState('')
  const [rawEntryText, setRawEntryText] = useState('')
  const [rawEntryMessage, setRawEntryMessage] = useState(null)
  const [sanctionsJsonFile, setSanctionsJsonFile] = useState(null)
  const [sanctionsMessage, setSanctionsMessage] = useState(null)
  const [sanctionsSaving, setSanctionsSaving] = useState(false)
  const [sanctionsLoading, setSanctionsLoading] = useState(false)
  const [extractedData, setExtractedData] = useState(null)
  const [showSanctions, setShowSanctions] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const ensureAuthToken = () => {
    const token = getToken()
    if (!token) {
      throw new Error('Authentication token is missing. Please log in again.')
    }
    return token
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // Helper function to extract numeric ID from strings that might contain prefixes
  // Handles cases like "الرقم المدني: 307092900239" -> "307092900239"
  const extractIdNumber = (idString) => {
    if (!idString || idString === 'N/A') return ''
    
    const str = String(idString).trim()
    
    // If the string contains a colon, try to extract the part after it
    if (str.includes(':')) {
      const parts = str.split(':')
      // Get the last part after the colon and trim it
      const afterColon = parts[parts.length - 1].trim()
      // If it's a valid number (or contains numbers), use it
      if (afterColon && /[\d]/.test(afterColon)) {
        // Extract all digits and preserve leading zeros by keeping the numeric part
        const numericPart = afterColon.replace(/[^\d]/g, '')
        if (numericPart) {
          return numericPart
        }
      }
    }
    
    // Try to extract just the numeric part (preserving leading zeros)
    // This handles cases where numbers are mixed with text
    const numericMatch = str.match(/\d+/)
    if (numericMatch) {
      // Find the longest sequence of digits
      const allNumericMatches = str.match(/\d+/g)
      if (allNumericMatches && allNumericMatches.length > 0) {
        // Return the longest numeric sequence (most likely the ID)
        return allNumericMatches.reduce((a, b) => a.length > b.length ? a : b)
      }
    }
    
    // If no numeric part found, return the original string trimmed
    return str
  }

  const handleCheckWatchlist = async (e) => {
    e.preventDefault()
    setLoading(true)
    setCheckResult(null)

    try {
      // Query Firebase sanctions collection
      const sanctionsRef = collection(db, 'sanctions')
      const snapshot = await getDocs(sanctionsRef)
      
      // Get all entries from all documents
      const allEntries = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        // Check if document has entries array (from HTML upload)
        if (data.entries && Array.isArray(data.entries)) {
          data.entries.forEach((entry, index) => {
            allEntries.push({
              ...entry,
              sourceDocId: doc.id,
              entryIndex: index
            })
          })
        } else if (data.name || data.id) {
          // Single entry format (legacy or direct entry)
          allEntries.push({
            name: data.name || 'N/A',
            nationality: data.nationality || 'N/A',
            birth: data.birth || 'N/A',
            id: data.id || 'N/A',
            sourceDocId: doc.id
          })
        }
      })

      console.log(`Checking against ${allEntries.length} entries from Firebase`)
      console.log('Search criteria:', { 
        fullName: formData.fullName, 
        idNumber: formData.idNumber, 
        nationality: formData.nationality 
      })

      // Search for matches
      const searchName = formData.fullName?.toLowerCase().trim() || ''
      const searchId = formData.idNumber?.trim() || '' // Don't lowercase ID numbers to preserve leading zeros
      const searchNationality = formData.nationality?.toLowerCase().trim() || ''
      
      // Extract numeric ID from search term (in case user pastes with prefix)
      const normalizedSearchId = searchId ? extractIdNumber(searchId) : ''
      
      console.log('Search values:', { searchName, searchId, normalizedSearchId, searchNationality })

      const matches = allEntries.filter(entry => {
        // Name matching (case-insensitive, partial match) - only if name is provided
        let nameMatch = true
        if (searchName) {
          const entryName = String(entry.name || '').toLowerCase().trim()
          nameMatch = entryName.includes(searchName) || searchName.includes(entryName)
        }
        
        // ID matching (if provided) - check both id and idNumber fields
        // Extract numeric ID from entry and compare with normalized search ID
        let idMatch = true
        if (normalizedSearchId) {
          // Get ID from either field
          const entryIdValue = entry.id || entry.idNumber
          if (entryIdValue && entryIdValue !== 'N/A' && String(entryIdValue).trim() !== '') {
            // Extract numeric ID from entry (handles Arabic prefixes like "الرقم المدني: 307092900239")
            const normalizedEntryId = extractIdNumber(entryIdValue)
            
            // Compare normalized IDs
            idMatch = normalizedEntryId === normalizedSearchId
            
            // Debug logging for ID matches
            if (idMatch) {
              console.log('ID match found:', { 
                searchId, 
                normalizedSearchId,
                entryIdValue,
                normalizedEntryId, 
                entryName: entry.name
              })
            } else {
              // Log when IDs don't match for debugging
              console.log('ID comparison:', {
                searchId,
                normalizedSearchId,
                entryIdValue,
                normalizedEntryId,
                match: false
              })
            }
          } else {
            // If search ID is provided but entry has no ID, don't match
            idMatch = false
          }
        }

        // Nationality matching (if provided)
        let nationalityMatch = true
        if (searchNationality) {
          // If user provided a nationality, entry must have a matching nationality
          if (entry.nationality && entry.nationality !== 'N/A') {
            const entryNationality = String(entry.nationality || '').toLowerCase().trim()
            nationalityMatch = entryNationality.includes(searchNationality) || searchNationality.includes(entryNationality)
          } else {
            // Entry doesn't have a nationality, so it doesn't match
            nationalityMatch = false
          }
        }

        return nameMatch && idMatch && nationalityMatch
      })

      const result = {
        status: matches.length > 0 ? 'MATCH_FOUND' : 'NO_MATCH',
        matches: matches,
        person: {
          fullName: formData.fullName,
          nationality: formData.nationality,
          idNumber: formData.idNumber
        },
        totalEntriesChecked: allEntries.length
      }

      console.log('Search results:', { 
        matchesFound: matches.length, 
        totalEntries: allEntries.length,
        matches: matches.map(m => ({ name: m.name, id: m.id || m.idNumber }))
      })

      setCheckResult(result)
    } catch (error) {
      console.error('Error checking watchlist:', error)
      setCheckResult({ 
        error: error.message || 'Failed to check watchlist',
        status: 'ERROR'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCertificate = async () => {
    try {
      console.log('Generating certificate for:', formData)

      // Create PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      let y = margin

      // Try to add logo (if exists in public folder)
      const logoImg = new Image()
      logoImg.crossOrigin = 'anonymous'
      logoImg.src = '/logo.png'

      // Function to generate PDF with logo
      const generatePDFWithLogo = async (doc, logoImg, pageWidth, pageHeight, margin) => {
        let y = margin
        
        // Add logo
        const logoWidth = 50
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight)
        y += logoHeight + 15
        
        await generatePDFContent(doc, y, pageWidth, pageHeight, margin)
      }

      // Function to generate PDF content
      const generatePDFContent = async (doc, startY, pageWidth, pageHeight, margin) => {
        let y = startY

        // Header - Arabic title rendered as image for proper RTL display
        const arabicTitle = 'شهادة الامتثال والتدقيق'
        const titleDiv = document.createElement('div')
        titleDiv.style.position = 'absolute'
        titleDiv.style.left = '-9999px'
        titleDiv.style.fontSize = '24px'
        titleDiv.style.fontFamily = 'Arial, "DejaVu Sans", "Arabic Typesetting", "Traditional Arabic", sans-serif'
        titleDiv.style.fontWeight = 'bold'
        titleDiv.style.color = '#2563eb' // Blue color (37, 99, 235 in hex)
        titleDiv.style.textAlign = 'center'
        titleDiv.style.direction = 'rtl'
        titleDiv.style.unicodeBidi = 'embed'
        titleDiv.style.whiteSpace = 'nowrap'
        titleDiv.style.paddingTop = '15px'
        titleDiv.style.paddingBottom = '15px'
        titleDiv.textContent = arabicTitle
        document.body.appendChild(titleDiv)
        
        try {
          const titleCanvas = await html2canvas(titleDiv, { 
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
          })
          const titleImgData = titleCanvas.toDataURL('image/png')
          const titleImgWidth = titleCanvas.width / 10 // Convert pixels to mm
          const titleImgHeight = titleCanvas.height / 10
          
          // Center the title
          const titleX = (pageWidth - titleImgWidth) / 2
          doc.addImage(titleImgData, 'PNG', titleX, y, titleImgWidth, titleImgHeight)
          document.body.removeChild(titleDiv)
          y += titleImgHeight + 10
        } catch (error) {
          console.warn('Failed to render Arabic title as image:', error)
          document.body.removeChild(titleDiv)
          y += 20
        }

        // Certificate Number - moved to left
        const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(102, 102, 102) // Gray
        doc.text(`Certificate Number: ${certificateNumber}`, margin, y, { align: 'left' })
        y += 20

        // Arabic Clearance Statement Template
        y += 10
        
        // Format date in Arabic format (DD/MM/YYYY)
        const arabicDate = new Date().toLocaleDateString('ar-EG', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).replace(/\//g, '/')
        
        // Get nationality in Arabic (or use provided)
        const nationality = formData.nationality || 'N/A'
        const idNumber = formData.idNumber || 'N/A'
        const fullName = formData.fullName || 'N/A'
        
        // Arabic template text with placeholders
        const arabicTemplate = `دولة الكويت  

تحريراً فى ${arabicDate}

الى من يهمه الامر                                                                 

تحية طيبه وبعد،، 

يرجى العلم بأنه تم الكشف على العميل ${fullName} ، ${nationality} الجنسية ،.ب.م/${idNumber} وقد تبين من خلال الكشف عليه أنه غير مدرج ضمن الأسماء المحظور التعامل معهم والمرسلة إلينا من هيئة اسواق المال أن المعلن عنهم كأفراد أو كيانات أو جماعات إرهابية أو المدرجين ضمن قائمة الأشخاص أو الكيانات المدرجين على قائمة الجزاءت الموحده لمجلس الأمن التابع للأمم المتحدة ، أو أنه ضمن الأشخاص أو الكيانات التى أدرجتها دولة الكويت على قائم الإرهاب  

مسؤول الدعم الفنى`

        // Render Arabic text as image for proper display
        const arabicDiv = document.createElement('div')
        arabicDiv.style.position = 'absolute'
        arabicDiv.style.left = '-9999px'
        arabicDiv.style.fontSize = '14px'
        arabicDiv.style.fontFamily = 'Arial, "DejaVu Sans", "Arabic Typesetting", "Traditional Arabic", sans-serif'
        arabicDiv.style.color = '#000000'
        arabicDiv.style.textAlign = 'right'
        arabicDiv.style.direction = 'rtl'
        arabicDiv.style.unicodeBidi = 'embed'
        arabicDiv.style.whiteSpace = 'pre-line'
        arabicDiv.style.lineHeight = '1.8'
        arabicDiv.style.width = '600px'
        arabicDiv.textContent = arabicTemplate
        document.body.appendChild(arabicDiv)
        
        try {
          const arabicCanvas = await html2canvas(arabicDiv, { 
            scale: 3, // Higher scale for better quality
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 600
          })
          const arabicImgData = arabicCanvas.toDataURL('image/png')
          const arabicImgWidth = arabicCanvas.width / 10 // Convert pixels to mm
          const arabicImgHeight = arabicCanvas.height / 10
          
          // Center the Arabic text
          const arabicX = (pageWidth - arabicImgWidth) / 2
          doc.addImage(arabicImgData, 'PNG', arabicX, y, arabicImgWidth, arabicImgHeight)
          document.body.removeChild(arabicDiv)
          y += arabicImgHeight + 10
        } catch (error) {
          console.warn('Failed to render Arabic text as image:', error)
          // Fallback - try to render without image
          document.body.removeChild(arabicDiv)
          y += 20
        }

        // Footer
        const formattedDate = new Date().toLocaleString()
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(153, 153, 153) // Light gray
        doc.text('This certificate is generated for informational purposes only.', pageWidth / 2, pageHeight - 20, { align: 'center' })
        doc.text(`Generated on: ${formattedDate}`, pageWidth / 2, pageHeight - 15, { align: 'center' })

        // Save PDF
        const filename = `clearance-certificate-${certificateNumber}.pdf`
        doc.save(filename)
        console.log('PDF certificate generated and downloaded:', filename)
      }
      
      const waitForLogoLoad = () => new Promise((resolve) => {
        logoImg.onload = () => resolve(true)
        logoImg.onerror = () => resolve(false)
      })

      // Generate once: use logo when it loads, fall back otherwise
      const logoReady = logoImg.complete && logoImg.naturalWidth > 0
        ? true
        : await waitForLogoLoad()

      if (logoReady) {
        await generatePDFWithLogo(doc, logoImg, pageWidth, pageHeight, margin)
      } else {
        await generatePDFContent(doc, y, pageWidth, pageHeight, margin)
      }

    } catch (error) {
      console.error('Error generating certificate:', error)
      alert(error.message || 'Failed to generate certificate. Check console for details.')
    }
  }

  const normalizeDate = (value = '') => {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }

    const normalized = trimmed.replace(/-/g, '/')
    const parts = normalized.split('/')

    if (parts.length === 3) {
      let [day, month, year] = parts.map((part) => part.trim())

      if (year.length === 2 && /^\d+$/.test(year)) {
        const yearNumber = parseInt(year, 10)
        year = yearNumber >= 50 ? `19${year}` : `20${year}`
      }

      if (day.length && month.length && year.length === 4) {
        const paddedDay = day.padStart(2, '0')
        const paddedMonth = month.padStart(2, '0')

        const dayNumber = parseInt(paddedDay, 10)
        const monthNumber = parseInt(paddedMonth, 10)

        if (
          dayNumber >= 1 &&
          dayNumber <= 31 &&
          monthNumber >= 1 &&
          monthNumber <= 12
        ) {
          return `${year}-${paddedMonth}-${paddedDay}`
        }
      }
    }

    return trimmed
  }

  const handleLoadWatchlist = async () => {
    setWatchlistLoading(true)
    setWatchlistMessage(null)

    try {
      const token = ensureAuthToken()
      const response = await fetch('/api/watchlist', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load watchlist data')
      }

      const entries = Array.isArray(data.watchlist) ? data.watchlist : []
      setWatchlistText(JSON.stringify(entries, null, 2))
      setWatchlistFileName('')
      setWatchlistMessage({
        type: 'success',
        text: `Loaded ${entries.length} entries from the server`
      })
    } catch (error) {
      setWatchlistMessage({
        type: 'error',
        text: error.message || 'Failed to load watchlist data'
      })
    } finally {
      setWatchlistLoading(false)
    }
  }

  const handleWatchlistFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result
        if (typeof text !== 'string') {
          throw new Error('Unable to read file contents')
        }

        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed)) {
          throw new Error('JSON must be an array of entries')
        }

        setWatchlistText(JSON.stringify(parsed, null, 2))
        setWatchlistFileName(file.name)
        setWatchlistMessage({
          type: 'success',
          text: `Loaded ${parsed.length} entries from ${file.name}`
        })
      } catch (error) {
        setWatchlistMessage({
          type: 'error',
          text: error.message || 'Invalid JSON file'
        })
      }
    }

    reader.onerror = () => {
      setWatchlistMessage({
        type: 'error',
        text: 'Failed to read the selected file'
      })
    }

    reader.readAsText(file)
    event.target.value = ''
  }

  const handleSaveWatchlist = async () => {
    setWatchlistMessage(null)

    let parsedData
    try {
      if (!watchlistText.trim()) {
        throw new Error('Upload or paste JSON data before saving')
      }

      parsedData = JSON.parse(watchlistText)
      if (!Array.isArray(parsedData)) {
        throw new Error('JSON must be an array of entries')
      }
    } catch (error) {
      setWatchlistMessage({
        type: 'error',
        text: error.message || 'Invalid JSON format'
      })
      return
    }

    setWatchlistSaving(true)
    try {
      const token = ensureAuthToken()
      const response = await fetch('/api/watchlist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ watchlist: parsedData })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save watchlist')
      }

      setWatchlistMessage({
        type: 'success',
        text: `Watchlist updated with ${data.count ?? parsedData.length} entries`
      })
    } catch (error) {
      setWatchlistMessage({
        type: 'error',
        text: error.message || 'Failed to save watchlist'
      })
    } finally {
      setWatchlistSaving(false)
    }
  }

  const handleConvertRawEntries = () => {
    setRawEntryMessage(null)

    if (!rawEntryText.trim()) {
      setRawEntryMessage({
        type: 'error',
        text: 'Paste at least one row of tab-separated data before converting'
      })
      return
    }

    let baseWatchlist = []
    try {
      if (watchlistText.trim()) {
        const parsed = JSON.parse(watchlistText)
        if (!Array.isArray(parsed)) {
          throw new Error('Current JSON must be an array')
        }
        baseWatchlist = parsed
      }
    } catch (error) {
      setRawEntryMessage({
        type: 'error',
        text: error.message || 'Fix the JSON above before adding new rows'
      })
      return
    }

    try {
      const lines = rawEntryText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      if (lines.length === 0) {
        throw new Error('No data rows detected after trimming empty lines')
      }

      const newEntries = lines.map((line, lineIndex) => {
        const parts = line.split(/\t+/)

        if (parts.length < 5) {
          throw new Error(
            `Line ${lineIndex + 1} must include at least 5 tab-separated values (ID, Name, Nationality, DOB, ID Number)`
          )
        }

        const [
          rawId,
          rawName,
          rawNationality,
          rawDob,
          rawIdNumber,
          rawIdType,
          rawNotes
        ] = parts

        if (!rawName || !rawName.trim()) {
          throw new Error(`Line ${lineIndex + 1} is missing a name value`)
        }

        return {
          id: (rawId && rawId.trim()) || `ENTRY-${Date.now()}-${lineIndex + 1}`,
          name: rawName.trim(),
          nationality: rawNationality?.trim() || '',
          dateOfBirth: normalizeDate(rawDob),
          idType: rawIdType?.trim() || '',
          idNumber: rawIdNumber?.trim() || '',
          notes: rawNotes?.trim() || undefined
        }
      })

      const updated = [...baseWatchlist, ...newEntries]
      setWatchlistText(JSON.stringify(updated, null, 2))
      setRawEntryText('')
      setRawEntryMessage({
        type: 'success',
        text: `Converted ${newEntries.length} row${
          newEntries.length === 1 ? '' : 's'
        }. Review the JSON and click "Save Watchlist" to persist the changes.`
      })
    } catch (error) {
      setRawEntryMessage({
        type: 'error',
        text: error.message || 'Failed to convert the pasted rows'
      })
    }
  }

  // Parse JSON file and extract data
  const handleSanctionsJsonUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setSanctionsMessage({
        type: 'error',
        text: 'Please upload a JSON file'
      })
      return
    }

    setSanctionsJsonFile(file)
    setSanctionsLoading(true)
    setSanctionsMessage(null)
    setExtractedData(null)

    try {
      // Read JSON file as text
      const jsonText = await file.text()
      
      // Parse JSON
      const parsedData = JSON.parse(jsonText)
      
      // Check if it's an array
      if (!Array.isArray(parsedData)) {
        throw new Error('JSON file must contain an array of entries')
      }

      if (parsedData.length === 0) {
        throw new Error('JSON file contains an empty array')
      }

      // Validate and normalize entries
      const extractedRows = parsedData.map((entry) => {
        // Ensure entry has required fields with defaults
        return {
          name: entry.name || entry.fullName || 'N/A',
          nationality: entry.nationality || 'N/A',
          birth: entry.birth || entry.dateOfBirth || entry.dob || 'N/A',
          id: entry.id || entry.idNumber || 'N/A'
        }
      })

      if (extractedRows.length === 0) {
        throw new Error('No valid entries found in JSON file')
      }

      // Set extracted data as array
      setExtractedData(extractedRows)
      setSanctionsMessage({
        type: 'success',
        text: `JSON processed successfully! Loaded ${extractedRows.length} entries from the file.`
      })
    } catch (error) {
      console.error('Error processing JSON:', error)
      setSanctionsMessage({
        type: 'error',
        text: error.message || 'Failed to process JSON file. Please ensure it is valid JSON with an array of entries.'
      })
    } finally {
      setSanctionsLoading(false)
      event.target.value = ''
    }
  }

  // Test Firebase connection
  const testFirebaseConnection = async () => {
    try {
      console.log('Testing Firebase connection...')
      console.log('Storage:', storage)
      console.log('Storage bucket:', storage?.bucket || 'Not available')
      console.log('User authenticated:', isAuthenticated)
      console.log('User:', user)
      console.log('User UID:', user?.uid)
      console.log('User email:', user?.email)
      
      // Test Firestore connection
      const testRef = collection(db, 'test')
      console.log('Firestore collection reference created:', testRef)
      
      setSanctionsMessage({
        type: 'info',
        text: 'Firebase connection test completed. Check browser console (F12) for details.'
      })
    } catch (error) {
      console.error('Firebase connection test failed:', error)
      setSanctionsMessage({
        type: 'error',
        text: `Firebase connection test failed: ${error.message}`
      })
    }
  }

  const handleSaveSanctionsToFirebase = async () => {
    setSanctionsMessage(null)

    // Check if user is authenticated
    if (!isAuthenticated || !user) {
      setSanctionsMessage({
        type: 'error',
        text: 'You must be logged in to upload files. Please log in and try again.'
      })
      return
    }

    if (!sanctionsJsonFile) {
      setSanctionsMessage({
        type: 'error',
        text: 'Please upload a JSON file first'
      })
      return
    }

    if (!extractedData || !Array.isArray(extractedData) || extractedData.length === 0) {
      setSanctionsMessage({
        type: 'error',
        text: 'Please wait for HTML processing to complete'
      })
      return
    }

    setSanctionsSaving(true)
    let totalDocsCount = 0
    try {
      // Delete old files from Firebase Storage and Firestore
      setSanctionsMessage({
        type: 'info',
        text: 'Removing old files...'
      })

      const sanctionsRef = collection(db, 'sanctions')
      const existingDocs = await getDocs(sanctionsRef)
      
      totalDocsCount = existingDocs.size
      
      const deletePromises = []
      const fileDeletionResults = []

      existingDocs.forEach((doc) => {
        const data = doc.data()
        
        // Delete file from Firebase Storage if path exists
        if (data.jsonStoragePath) {
          const oldStorageRef = ref(storage, data.jsonStoragePath)
          fileDeletionResults.push(
            deleteObject(oldStorageRef)
              .then(() => {
                console.log('Deleted old file from Storage:', data.jsonStoragePath)
                return true
              })
              .catch((error) => {
                // If file doesn't exist, that's okay - just log it
                if (error.code === 'storage/object-not-found') {
                  console.log('File not found in Storage (may have been already deleted):', data.jsonStoragePath)
                } else {
                  console.error('Error deleting file from Storage:', error)
                }
                return false
              })
          )
        }
        
        // Delete document from Firestore
        deletePromises.push(
          deleteDoc(doc.ref)
            .then(() => {
              console.log('Deleted old document from Firestore:', doc.id)
            })
            .catch((error) => {
              console.error('Error deleting document from Firestore:', error)
              throw error
            })
        )
      })

      // Wait for all deletions to complete
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises)
        const successfulFileDeletions = (await Promise.all(fileDeletionResults)).filter(Boolean).length
        console.log(`Deleted ${successfulFileDeletions} file(s) from Storage and ${totalDocsCount} document(s) from Firestore`)
        
        if (totalDocsCount > 0) {
          setSanctionsMessage({
            type: 'info',
            text: `Removed ${totalDocsCount} old file(s). Uploading new file...`
          })
        }
      }

      // Upload new JSON file to Firebase Storage
      const timestamp = Date.now()
      const fileName = `sanctions/${timestamp}_${sanctionsJsonFile.name}`
      const storageRef = ref(storage, fileName)
      
      setSanctionsMessage({
        type: 'info',
        text: 'Uploading new JSON file to Firebase Storage...'
      })

      console.log('Starting upload to Storage:', fileName)
      console.log('File size:', sanctionsJsonFile.size, 'bytes')
      console.log('User authenticated:', isAuthenticated)
      console.log('User email:', user?.email)
      console.log('Extracted entries:', extractedData.length)

      await uploadBytes(storageRef, sanctionsJsonFile)
      console.log('Upload to Storage successful')
      
      const jsonDownloadUrl = await getDownloadURL(storageRef)
      console.log('Download URL obtained:', jsonDownloadUrl)

      // Convert extracted data array to JSON
      const jsonData = JSON.stringify(extractedData, null, 2)

      // Save to Firestore with extracted data as JSON array (sanctionsRef already defined above)
      const firestoreData = {
        // Extracted data as array
        entries: extractedData,
        entriesCount: extractedData.length,
        // JSON representation
        jsonData: jsonData,
        // File metadata
        jsonFileName: sanctionsJsonFile.name,
        jsonFileUrl: jsonDownloadUrl,
        jsonStoragePath: fileName,
        fileSize: sanctionsJsonFile.size,
        fileType: sanctionsJsonFile.type,
        uploadedBy: user?.email || 'unknown',
        uploadedByUid: user?.uid || 'unknown',
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }

      console.log('Saving to Firestore:', firestoreData)
      const docRef = await addDoc(sanctionsRef, firestoreData)
      console.log('Firestore save successful, document ID:', docRef.id)

      const oldFilesText = totalDocsCount > 0 ? ` Removed ${totalDocsCount} old file(s) and ` : ' '
      setSanctionsMessage({
        type: 'success',
        text: `Successfully saved!${oldFilesText}Uploaded new JSON file to Storage and ${extractedData.length} entries saved to Firestore. Document ID: ${docRef.id}`
      })
      
      // Clear the form after successful save
      setSanctionsJsonFile(null)
      setExtractedData(null)
    } catch (error) {
      console.error('Error saving to Firebase:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      
      // Provide more detailed error messages
      let errorMessage = 'Failed to save sanctions data to Firebase'
      
      // Check for specific Firebase error codes
      if (error.code) {
        switch (error.code) {
          case 'storage/unauthorized':
            errorMessage = 'Permission denied: You do not have permission to upload files. Please check Firebase Storage rules.'
            break
          case 'storage/canceled':
            errorMessage = 'Upload was canceled. Please try again.'
            break
          case 'storage/unknown':
            errorMessage = 'Unknown error occurred during upload. Please check your internet connection and try again.'
            break
          case 'storage/invalid-argument':
            errorMessage = 'Invalid argument: The file or path is invalid. Please try again.'
            break
          case 'storage/quota-exceeded':
            errorMessage = 'Storage quota exceeded: Your Firebase Storage quota has been exceeded.'
            break
          case 'storage/unauthenticated':
            errorMessage = 'Unauthenticated: You must be logged in to upload files.'
            break
          case 'permission-denied':
            errorMessage = 'Permission denied: You do not have permission to write to Firestore. Please check Firestore rules.'
            break
          case 'unavailable':
            errorMessage = 'Service unavailable: Firebase service is temporarily unavailable. Please try again later.'
            break
          default:
            errorMessage = `Error (${error.code}): ${error.message || 'Unknown error occurred'}`
        }
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`
      }
      
      // Show full error details in console and UI
      const fullErrorMessage = `${errorMessage}\n\nDetails:\nCode: ${error.code || 'N/A'}\nMessage: ${error.message || 'No message'}\n\nCheck browser console (F12) for more details.`
      
      setSanctionsMessage({
        type: 'error',
        text: fullErrorMessage
      })
    } finally {
      setSanctionsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 z-40 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
      }`}>
        <div className="h-full flex flex-col p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img 
              src="/logoshort.png" 
              alt="Logo" 
              className="w-16 h-16 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold gradient-text"> L2P Checker</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Compliance System</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5" />
                <span className="font-semibold">Person Check</span>
              </div>
            </div>
            <button
              onClick={() => setShowSanctions(!showSanctions)}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
                showSanctions 
                  ? 'bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Database className="w-5 h-5" />
              <span className="font-medium">Sanctions Upload</span>
            </button>
          </nav>

          {/* User Info */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user?.email || 'User'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Logged in</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleTheme()
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 font-medium"
                aria-label="Toggle theme"
                type="button"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 glass-card border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-4">
              {/* Logo */}
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-10 w-auto object-contain hidden sm:block"
              />
              {/* Theme Toggle Button */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleTheme()
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 hover:scale-110"
                aria-label="Toggle theme"
                type="button"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Welcome Card */}
            <div className="card-modern bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">L2P System Checker</h2>
                  <p className="text-blue-100">Verify individuals against the watchlist database</p>
                </div>
                <div className="hidden md:block">
                  <img src="/logoshort.png" alt="Logo" className="h-28 w-auto object-contain" />
                </div>
              </div>
            </div>

            {/* Person Input Form */}
            <div className="card-modern">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Person Verification Form
                </h2>
              </div>

              <form onSubmit={handleCheckWatchlist} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="input-modern pl-12"
                        placeholder="Enter full name (optional)"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="nationality" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Nationality
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="nationality"
                        name="nationality"
                        type="text"
                        value={formData.nationality}
                        onChange={handleInputChange}
                        className="input-modern pl-12"
                        placeholder="e.g., US, UK, CA"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="idNumber" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      ID Number
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="idNumber"
                        name="idNumber"
                        type="text"
                        value={formData.idNumber}
                        onChange={handleInputChange}
                        className="input-modern pl-12"
                        placeholder="Enter ID number"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Checking Watchlist...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Search className="w-5 h-5" />
                      Check Watchlist
                    </span>
                  )}
                </button>
              </form>

              {/* Check Result */}
              {checkResult && (
                <div className="mt-6 animate-fade-in">
                  {checkResult.status === 'MATCH_FOUND' ? (
                    <div className="card-modern border-2 border-red-300 dark:border-red-700 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-red-800 dark:text-red-300 mb-2">
                            Match Found in Watchlist
                          </h3>
                          <p className="text-sm text-red-700 dark:text-red-400">
                            Found <span className="font-bold">{checkResult.matches.length}</span> match(es) out of <span className="font-bold">{checkResult.totalEntriesChecked || 0}</span> entries checked
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {checkResult.matches.map((match, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-red-200 dark:border-red-800 shadow-md">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <span className="text-red-600 dark:text-red-400 font-bold text-sm">#{idx + 1}</span>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">Match Details</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="flex items-start gap-2">
                                <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Name</p>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{match.name}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Globe className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Nationality</p>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{match.nationality}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Birth Date</p>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{match.birth}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <CreditCard className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">ID Number</p>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{match.id || match.idNumber || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                            {match.notes && (
                              <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                                <p className="text-xs text-slate-600 dark:text-slate-400">{match.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : checkResult.status === 'NO_MATCH' ? (
                    <div className="card-modern border-2 border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">
                            No Match Found
                          </h3>
                          <p className="text-sm text-green-700 dark:text-green-400">
                            The person is not listed in the watchlist database
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleGenerateCertificate}
                        className="btn-primary bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-green-500/25 hover:shadow-green-500/40"
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        Generate Clearance Certificate
                      </button>
                    </div>
                  ) : (
                    <div className="card-modern border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <p className="text-red-700 dark:text-red-400 font-semibold">
                          {checkResult.error || 'An error occurred'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sanctions Section */}
            <div className="card-modern">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Sanctions Data Upload
                  </h2>
                </div>
                <button
                  onClick={() => setShowSanctions(!showSanctions)}
                  className="btn-secondary text-sm"
                >
                  {showSanctions ? 'Hide' : 'Show'} Upload
                </button>
              </div>
              
              {showSanctions && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl p-8 text-center">
                        <div className="flex justify-center mb-4">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
                            <FileSearch className="h-8 w-8 text-white" />
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                          Upload JSON File
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                          Drop your JSON file here or browse to upload
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <label className="cursor-pointer">
                            <span className="btn-primary bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25 hover:shadow-purple-500/40 inline-flex items-center gap-2">
                              <Upload className="h-4 w-4" /> Browse Files
                            </span>
                            <input 
                              id="sanctions-json-upload"
                              type="file" 
                              accept=".json,application/json" 
                              onChange={handleSanctionsJsonUpload} 
                              className="hidden" 
                            />
                          </label>
                          
                          {sanctionsJsonFile && (
                            <button 
                              onClick={handleSaveSanctionsToFirebase}
                              disabled={sanctionsSaving || sanctionsLoading || !extractedData || !Array.isArray(extractedData)} 
                              className={`btn-primary inline-flex items-center gap-2 ${
                                sanctionsSaving || sanctionsLoading || !extractedData || !Array.isArray(extractedData)
                                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed opacity-50" 
                                  : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/25 hover:shadow-green-500/40"
                              }`}
                            > 
                              {sanctionsSaving ? (
                                <>
                                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Zap className="h-5 w-5" /> Save to Firebase
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        
                        {sanctionsJsonFile && (
                          <div className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-700">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Selected: <span className="font-semibold text-slate-900 dark:text-slate-100">{sanctionsJsonFile.name}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="card-modern bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          Extraction Features
                        </h4>
                        <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>JSON file parsing</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Data validation & normalization</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Firebase Storage & Firestore</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showSanctions && (
                <>
                  {sanctionsLoading && (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                        Processing JSON file and validating data...
                      </p>
                    </div>
                  )}

                  {extractedData && Array.isArray(extractedData) && extractedData.length > 0 && (
                    <div className="card-modern bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          Extracted Data ({extractedData.length} entries)
                        </h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto mb-4 rounded-xl border border-green-200 dark:border-green-800">
                        <table className="min-w-full text-sm">
                          <thead className="bg-green-100 dark:bg-green-900/30 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Name</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Nationality</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Birth</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">ID</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-green-200 dark:divide-green-800">
                            {extractedData.slice(0, 10).map((entry, index) => (
                              <tr key={index} className="hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">{entry.name}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.nationality}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.birth}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.id}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {extractedData.length > 10 && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
                            <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                              Showing first 10 of {extractedData.length} entries. All entries will be saved to Firebase.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-green-300 dark:border-green-700">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">JSON Data (Preview):</p>
                        <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto max-h-40 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                          {JSON.stringify(extractedData.slice(0, 3), null, 2)}
                          {extractedData.length > 3 && '\n...\n' + (extractedData.length - 3) + ' more entries'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {sanctionsMessage && (
                    <div className={`card-modern animate-slide-up ${
                      sanctionsMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                        : sanctionsMessage.type === 'info'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                    }`}>
                      <div className="whitespace-pre-wrap break-words">{sanctionsMessage.text}</div>
                      {sanctionsMessage.type === 'error' && (
                        <div className="mt-3 text-xs opacity-75">
                          Check browser console (F12) for detailed error logs
                        </div>
                      )}
                    </div>
                  )}

                  
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Home


