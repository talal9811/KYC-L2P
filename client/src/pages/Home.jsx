import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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
  const [sanctionsHtmlFile, setSanctionsHtmlFile] = useState(null)
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

  const handleCheckWatchlist = async (e) => {
    e.preventDefault()
    setLoading(true)
    setCheckResult(null)

    try {
      if (!formData.fullName || !formData.fullName.trim()) {
        setCheckResult({ 
          error: 'Full name is required',
          status: 'ERROR'
        })
        return
      }

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

      // Search for matches
      const searchName = formData.fullName.toLowerCase().trim()
      const searchId = formData.idNumber?.toLowerCase().trim() || ''
      const searchNationality = formData.nationality?.toLowerCase().trim() || ''

      const matches = allEntries.filter(entry => {
        // Name matching (case-insensitive, partial match)
        const entryName = (entry.name || '').toLowerCase().trim()
        const nameMatch = entryName.includes(searchName) || searchName.includes(entryName)
        
        // ID matching (if provided)
        let idMatch = true
        if (searchId && entry.id && entry.id !== 'N/A') {
          const entryId = (entry.id || '').toLowerCase().trim()
          idMatch = entryId === searchId || entryId.includes(searchId) || searchId.includes(entryId)
        }

        // Nationality matching (if provided)
        let nationalityMatch = true
        if (searchNationality && entry.nationality && entry.nationality !== 'N/A') {
          const entryNationality = (entry.nationality || '').toLowerCase().trim()
          nationalityMatch = entryNationality.includes(searchNationality) || searchNationality.includes(entryNationality)
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

  const handleGenerateCertificate = () => {
    try {
      if (!formData.fullName || !formData.fullName.trim()) {
        alert('Please enter a full name before generating a certificate')
        return
      }

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
      
      logoImg.onload = async () => {
        await generatePDFWithLogo(doc, logoImg, pageWidth, pageHeight, margin)
      }
      
      logoImg.onerror = async () => {
        // Logo not found, continue without it
        await generatePDFContent(doc, y, pageWidth, pageHeight, margin)
      }

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
        
        // Arabic template text with placeholders
        const arabicTemplate = `دولة الكويت  

تحريراً فى ${arabicDate}

الى من يهمه الامر                                                                 

تحية طيبه وبعد،، 

يرجى العلم بأنه تم الكشف على العميل ${formData.fullName} ، ${nationality} الجنسية ،.ب.م/${idNumber} وقد تبين من خلال الكشف عليه أنه غير مدرج ضمن الأسماء المحظور التعامل معهم والمرسلة إلينا من هيئة اسواق المال أن المعلن عنهم كأفراد أو كيانات أو جماعات إرهابية أو المدرجين ضمن قائمة الأشخاص أو الكيانات المدرجين على قائمة الجزاءت الموحده لمجلس الأمن التابع للأمم المتحدة ، أو أنه ضمن الأشخاص أو الكيانات التى أدرجتها دولة الكويت على قائم الإرهاب  

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
      
      // Wait a bit for async operations, then generate
      setTimeout(async () => {
        if (logoImg.complete) {
          await generatePDFWithLogo(doc, logoImg, pageWidth, pageHeight, margin)
        } else {
          await generatePDFContent(doc, y, pageWidth, pageHeight, margin)
        }
      }, 100)

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

  // Parse HTML file and extract table data
  const handleSanctionsHtmlUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/html' && !file.name.endsWith('.html')) {
      setSanctionsMessage({
        type: 'error',
        text: 'Please upload an HTML file'
      })
      return
    }

    setSanctionsHtmlFile(file)
    setSanctionsLoading(true)
    setSanctionsMessage(null)
    setExtractedData(null)

    try {
      // Read HTML file as text
      const htmlText = await file.text()
      
      // Parse HTML using DOMParser
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlText, 'text/html')
      
      // Find the table
      const table = doc.querySelector('table')
      if (!table) {
        throw new Error('No table found in HTML file')
      }

      // Get table rows (skip header row)
      const rows = Array.from(table.querySelectorAll('tbody tr'))
      
      if (rows.length === 0) {
        throw new Error('No data rows found in table')
      }

      // Extract data from each row
      const extractedRows = rows.map((row, index) => {
        const cells = Array.from(row.querySelectorAll('td'))
        
        if (cells.length < 5) {
          console.warn(`Row ${index + 1} has insufficient columns`)
          return null
        }

        // Extract data from cells
        // Column 0: Number (الرقم)
        // Column 1: Name (الاسم)
        // Column 2: Nationality (الجنسية) - may contain "الجنسية" text
        // Column 3: Birth Date (المواليد)
        // Column 4: ID (الرقم المدني)
        
        const name = cells[1]?.textContent?.trim() || ''
        let nationality = cells[2]?.textContent?.trim() || ''
        // Remove "الجنسية" from nationality if present
        nationality = nationality.replace(/\s*الجنسية\s*/g, '').trim()
        const birth = cells[3]?.textContent?.trim() || ''
        const id = cells[4]?.textContent?.trim() || ''

        return {
          name: name || 'N/A',
          nationality: nationality || 'N/A',
          birth: birth || 'N/A',
          id: id || 'N/A'
        }
      }).filter(row => row !== null) // Remove null entries

      if (extractedRows.length === 0) {
        throw new Error('No valid data extracted from table')
      }

      // Set extracted data as array
      setExtractedData(extractedRows)
      setSanctionsMessage({
        type: 'success',
        text: `HTML processed successfully! Extracted ${extractedRows.length} entries from the table.`
      })
    } catch (error) {
      console.error('Error processing HTML:', error)
      setSanctionsMessage({
        type: 'error',
        text: error.message || 'Failed to process HTML file'
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

    if (!sanctionsHtmlFile) {
      setSanctionsMessage({
        type: 'error',
        text: 'Please upload an HTML file first'
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
    try {
      // Upload HTML file to Firebase Storage
      const timestamp = Date.now()
      const fileName = `sanctions/${timestamp}_${sanctionsHtmlFile.name}`
      const storageRef = ref(storage, fileName)
      
      setSanctionsMessage({
        type: 'info',
        text: 'Uploading HTML file to Firebase Storage...'
      })

      console.log('Starting upload to Storage:', fileName)
      console.log('File size:', sanctionsHtmlFile.size, 'bytes')
      console.log('User authenticated:', isAuthenticated)
      console.log('User email:', user?.email)
      console.log('Extracted entries:', extractedData.length)

      await uploadBytes(storageRef, sanctionsHtmlFile)
      console.log('Upload to Storage successful')
      
      const htmlDownloadUrl = await getDownloadURL(storageRef)
      console.log('Download URL obtained:', htmlDownloadUrl)

      // Convert extracted data array to JSON
      const jsonData = JSON.stringify(extractedData, null, 2)

      // Save to Firestore with extracted data as JSON array
      const sanctionsRef = collection(db, 'sanctions')
      
      const firestoreData = {
        // Extracted data as array
        entries: extractedData,
        entriesCount: extractedData.length,
        // JSON representation
        jsonData: jsonData,
        // File metadata
        htmlFileName: sanctionsHtmlFile.name,
        htmlFileUrl: htmlDownloadUrl,
        htmlStoragePath: fileName,
        fileSize: sanctionsHtmlFile.size,
        fileType: sanctionsHtmlFile.type,
        uploadedBy: user?.email || 'unknown',
        uploadedByUid: user?.uid || 'unknown',
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }

      console.log('Saving to Firestore:', firestoreData)
      const docRef = await addDoc(sanctionsRef, firestoreData)
      console.log('Firestore save successful, document ID:', docRef.id)

      setSanctionsMessage({
        type: 'success',
        text: `Successfully saved! HTML file uploaded to Storage and ${extractedData.length} entries saved to Firestore as JSON. Document ID: ${docRef.id}`
      })
      
      // Clear the form after successful save
      setSanctionsHtmlFile(null)
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
              src="/svgviewer-png-output.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold gradient-text">KYC L2P Checker</h1>
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
                src="/svgviewer-png-output.png" 
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
                  <h2 className="text-2xl font-bold mb-2">Welcome back!</h2>
                  <p className="text-blue-100">Verify individuals against the watchlist database</p>
                </div>
                <div className="hidden md:block">
                  <Shield className="w-24 h-24 text-white/20" />
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
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className="input-modern pl-12"
                        placeholder="Enter full name"
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
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{match.id}</p>
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
                          Upload HTML File
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                          Drop your HTML file here or browse to upload
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <label className="cursor-pointer">
                            <span className="btn-primary bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25 hover:shadow-purple-500/40 inline-flex items-center gap-2">
                              <Upload className="h-4 w-4" /> Browse Files
                            </span>
                            <input 
                              id="sanctions-html-upload"
                              type="file" 
                              accept=".html,text/html" 
                              onChange={handleSanctionsHtmlUpload} 
                              className="hidden" 
                            />
                          </label>
                          
                          {sanctionsHtmlFile && (
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
                        
                        {sanctionsHtmlFile && (
                          <div className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-700">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Selected: <span className="font-semibold text-slate-900 dark:text-slate-100">{sanctionsHtmlFile.name}</span>
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
                            <span>HTML table parsing</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>JSON conversion</span>
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
                        Processing HTML and extracting table data...
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


