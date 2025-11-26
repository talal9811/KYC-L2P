import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/firebase'
import { Upload, FileSearch, CheckCircle2, Zap } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function Home() {
  const { logout, getToken, user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    idType: '',
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
      const searchBirth = formData.dateOfBirth?.trim() || ''

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

        // Birth date matching (if provided)
        let birthMatch = true
        if (searchBirth && entry.birth && entry.birth !== 'N/A') {
          const entryBirth = (entry.birth || '').trim()
          birthMatch = entryBirth === searchBirth || entryBirth.includes(searchBirth) || searchBirth.includes(entryBirth)
        }

        return nameMatch && idMatch && nationalityMatch && birthMatch
      })

      const result = {
        status: matches.length > 0 ? 'MATCH_FOUND' : 'NO_MATCH',
        matches: matches,
        person: {
          fullName: formData.fullName,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          idType: formData.idType,
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
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-800">
              KYC Watchlist Checker 
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Disclaimer Banner */}
    

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Person Input Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Person Input Form
            </h2>

            <form onSubmit={handleCheckWatchlist} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="nationality" className="block text-sm font-medium text-gray-700 mb-1">
                  Nationality
                </label>
                <input
                  id="nationality"
                  name="nationality"
                  type="text"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., US, UK, CA"
                />
              </div>

              <div>
                <label htmlFor="idType" className="block text-sm font-medium text-gray-700 mb-1">
                  ID Type
                </label>
                <select
                  id="idType"
                  name="idType"
                  value={formData.idType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select ID Type</option>
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Driver License">Driver License</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  ID Number
                </label>
                <input
                  id="idNumber"
                  name="idNumber"
                  type="text"
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter ID number"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Checking...' : 'Check Watchlist'}
              </button>
            </form>

            {/* Check Result */}
            {checkResult && (
              <div className="mt-6">
                {checkResult.status === 'MATCH_FOUND' ? (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-red-800">
                        Match Found in Watchlist
                      </h3>
                    </div>
                    <p className="text-sm text-gray-700 mb-4">
                      Found {checkResult.matches.length} match(es) out of {checkResult.totalEntriesChecked || 0} entries checked
                    </p>
                    <div className="space-y-2">
                      {checkResult.matches.map((match, idx) => (
                        <div key={idx} className="bg-white p-4 rounded border border-red-200">
                          <p className="font-medium text-gray-800">Match #{idx + 1}</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p><span className="font-medium">Name:</span> {match.name}</p>
                            <p><span className="font-medium">Nationality:</span> {match.nationality}</p>
                            <p><span className="font-medium">Birth Date:</span> {match.birth}</p>
                            <p><span className="font-medium">ID:</span> {match.id}</p>
                          </div>
                          <p className="text-sm text-gray-600">Name: {match.name}</p>
                          {match.notes && (
                            <p className="text-xs text-gray-500 mt-1">{match.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : checkResult.status === 'NO_MATCH' ? (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-green-800">
                        No match found in internal watchlist.
                      </h3>
                    </div>
                    <button
                      onClick={handleGenerateCertificate}
                      className="mt-4 bg-green-600 text-white py-2 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Generate Clearance Certificate
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {checkResult.error || 'An error occurred'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sanctions Section */}
        <div className="mt-8">
          <section className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-purple-200 mb-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-purple-500 to-purple-500 p-2 rounded-lg">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Upload Sanctions HTML</h2>
              </div>
              <button
                onClick={() => setShowSanctions(!showSanctions)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                {showSanctions ? 'Hide' : 'Show'} Sanctions Upload
              </button>
            </div>
            
            {showSanctions && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="bg-purple-50/50 border-2 border-dashed border-purple-300 rounded-xl p-8 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="bg-gradient-to-r from-purple-200/50 to-purple-300/50 p-4 rounded-full">
                        <FileSearch className="h-8 w-8 text-purple-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Drop your HTML file here or browse</h3>
                    <p className="text-gray-600 text-sm mb-6">Support for HTML files with table data</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <label className="cursor-pointer">
                        <span className="bg-gradient-to-r from-purple-500 to-purple-500 text-white py-2 px-6 rounded-lg font-medium inline-flex items-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
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
                          className={`py-2 px-6 rounded-lg font-medium inline-flex items-center gap-2 transform hover:-translate-y-0.5 transition-all duration-200 ${
                            sanctionsSaving || sanctionsLoading || !extractedData || !Array.isArray(extractedData)
                              ? "bg-gray-400 text-white cursor-not-allowed" 
                              : "bg-gradient-to-r from-green-400 to-green-600 text-white hover:shadow-lg"
                          }`}
                        > 
                          {sanctionsSaving ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4" /> Save to Firebase
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    {sanctionsHtmlFile && (
                      <div className="mt-4 text-sm text-gray-600">
                        Selected: <span className="text-gray-800 font-medium">{sanctionsHtmlFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-purple-50/50 rounded-lg p-4 border border-purple-200">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Extraction Features</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
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
            )}

            {showSanctions && (
              <>
                {sanctionsLoading && (
                  <div className="text-center py-4 mt-6">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <p className="mt-2 text-sm text-gray-600">Processing HTML and extracting table data...</p>
                  </div>
                )}

                {extractedData && Array.isArray(extractedData) && extractedData.length > 0 && (
                  <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      Extracted Data ({extractedData.length} entries)
                    </h3>
                    <div className="max-h-96 overflow-y-auto mb-4">
                      <table className="min-w-full text-sm">
                        <thead className="bg-green-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Nationality</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Birth</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">ID</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-200">
                          {extractedData.slice(0, 10).map((entry, index) => (
                            <tr key={index} className="hover:bg-green-50">
                              <td className="px-3 py-2 text-gray-900">{entry.name}</td>
                              <td className="px-3 py-2 text-gray-700">{entry.nationality}</td>
                              <td className="px-3 py-2 text-gray-700">{entry.birth}</td>
                              <td className="px-3 py-2 text-gray-700">{entry.id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {extractedData.length > 10 && (
                        <p className="text-xs text-gray-600 mt-2">
                          Showing first 10 of {extractedData.length} entries. All entries will be saved to Firebase.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 p-3 bg-white rounded border border-green-300">
                      <p className="text-xs font-medium text-gray-700 mb-1">JSON Data (Preview):</p>
                      <pre className="text-xs text-gray-600 overflow-x-auto max-h-40">
                        {JSON.stringify(extractedData.slice(0, 3), null, 2)}
                        {extractedData.length > 3 && '\n...\n' + (extractedData.length - 3) + ' more entries'}
                      </pre>
                    </div>
                  </div>
                )}

                {sanctionsMessage && (
                  <div className={`mt-6 p-4 rounded-lg ${
                    sanctionsMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : sanctionsMessage.type === 'info'
                      ? 'bg-blue-50 border border-blue-200 text-blue-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{sanctionsMessage.text}</div>
                    {sanctionsMessage.type === 'error' && (
                      <div className="mt-2 text-xs opacity-75">
                        Check browser console (F12) for detailed error logs
                      </div>
                    )}
                  </div>
                )}


                <div className="mt-6 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>How it works:</strong>
                    </p>
                    <ul className="text-sm text-blue-800 mt-2 list-disc list-inside space-y-1">
                      <li>Upload an HTML file containing a table with sanctions list data</li>
                      <li>The system parses the HTML table and extracts name, nationality, birth date, and ID</li>
                      <li>Data is converted to JSON format</li>
                      <li>Click &quot;Save to Firebase&quot; to upload the HTML file and save JSON data</li>
                      <li>The HTML file is uploaded to Firebase Storage</li>
                      <li>All extracted entries are saved to Firestore as JSON array</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 font-semibold mb-2">Troubleshooting</p>
                    <button
                      onClick={testFirebaseConnection}
                      className="text-sm text-yellow-800 underline hover:text-yellow-900"
                    >
                      Test Firebase Connection
                    </button>
                    <p className="text-xs text-yellow-700 mt-2">
                      If uploads fail, click above to test your Firebase connection. Check the browser console (F12) for detailed error messages.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
       
      </div>
    </div>
  )
}

export default Home


