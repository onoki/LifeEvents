import { useState } from 'react'

export function useData() {
  const [data, setData] = useState([])
  const [config, setConfig] = useState({})
  const [conditions, setConditions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [eunlData, setEunlData] = useState([])

  const parseTSVData = (tsvText) => {
    const lines = tsvText.trim().split('\n')
    
    // Parse configuration parameters (first few lines)
    const configData = {}
    let conditionsStartIndex = 0
    let dataStartIndex = 0
    
    // Look for config lines first
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('\t')) {
        const parts = line.split('\t')
        
        // Check if this looks like a config line (key-value pair)
        if (parts.length === 2 && !line.match(/^\d{4}-\d{2}-\d{2}/) && !line.includes('condition')) {
          const key = parts[0].trim()
          const value = parts[1].trim()
          configData[key] = value
          // Don't set conditionsStartIndex here, let it be found naturally
        } else if (line.includes('condition') && line.includes('explanation_short') && line.includes('explanation_long')) {
          // Found conditions header
          conditionsStartIndex = i
        } else if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
          // Found first date line, this is where data starts
          dataStartIndex = i
          break
        }
      }
    }
    
    // Parse conditions section
    const conditionsData = []
    
    if (conditionsStartIndex > 0 && dataStartIndex > conditionsStartIndex) {
      const conditionsLines = lines.slice(conditionsStartIndex, dataStartIndex - 1)
      
      const conditionsHeaders = conditionsLines[0].split('\t').map(h => h.trim())
      
      for (let i = 1; i < conditionsLines.length; i++) {
        const line = conditionsLines[i].trim()
        if (line) {
          const values = line.split('\t').map(v => v.trim())
          const condition = {}
          
          conditionsHeaders.forEach((header, headerIndex) => {
            condition[header] = values[headerIndex] || ''
          })
          
          conditionsData.push(condition)
        }
      }
    }
    
    // Parse the actual data starting from the date header
    const dataLines = lines.slice(dataStartIndex - 1)
    
    if (dataLines.length === 0) {
      return { config: configData, conditions: conditionsData, data: [] }
    }
    
    const headers = dataLines[0].split('\t').map(h => h.trim())
    
    const parsedData = dataLines.slice(1).map((line, index) => {
      const values = line.split('\t').map(v => v.trim())
      const event = {}
      
      headers.forEach((header, headerIndex) => {
        event[header] = values[headerIndex] || ''
      })

      // Normalize and process the data
      return processEventData(event)
    }).filter(event => event.date) // Filter out invalid entries
    
    return { config: configData, conditions: conditionsData, data: parsedData }
  }

  const processEventData = (event) => {
    // Convert date string to Date object
    if (event.date) {
      event.date = new Date(event.date)
    }

    // For stocks data, create some default values for the dashboard
    if (event.stocks_in_eur) {
      event.event = `Stocks Value: ${event.stocks_in_eur}`
      event.category = 'Finance'
      event.status = 'completed'
      event.duration = '1 day'
      event.durationDays = 1
    }

    // Parse duration if it exists
    if (event.duration) {
      const durationMatch = event.duration.match(/(\d+)/)
      event.durationDays = durationMatch ? parseInt(durationMatch[1]) : 0
    } else {
      event.durationDays = 0
    }

    // Normalize status
    if (event.status) {
      event.status = event.status.toLowerCase()
    }

    // Normalize category
    if (event.category) {
      event.category = event.category.trim()
    }

    return event
  }

  const fetchEUNLData = async () => {
    setLoading(true)
    setError(null)
    setStatus('Fetching EUNL data from Yahoo Finance...')

    try {
      // Use CORS proxy to access Yahoo Finance API
      const proxyUrl = 'https://api.allorigins.win/raw?url='
      const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/EUNL.DE?period1=1253862000&period2=2546985600&interval=1mo'
      
      const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl))
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const yahooData = await response.json()
      
      if (!yahooData.chart || !yahooData.chart.result || !yahooData.chart.result[0]) {
        throw new Error('Invalid data format from Yahoo Finance')
      }

      const result = yahooData.chart.result[0]
      const timestamps = result.timestamp
      const closePrices = result.indicators.quote[0].close

      const eunlData = timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000),
        price: closePrices[index] || null,
        dateFormatted: new Date(timestamp * 1000).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: '2-digit'
        })
      })).filter(item => item.price !== null)


      setEunlData(eunlData)
      setStatus(`Loaded ${eunlData.length} EUNL data points successfully`)
      
    } catch (err) {
      console.error('Error loading EUNL data:', err)
      setError(err.message)
      setStatus('Error loading EUNL data')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async (url) => {
    setLoading(true)
    setError(null)
    setStatus('Fetching data from Google Sheets...')

    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const tsvData = await response.text()
      const { config: parsedConfig, conditions: parsedConditions, data: parsedData } = parseTSVData(tsvData)
      
      if (parsedData.length === 0) {
        throw new Error('No data found in the sheet')
      }

      setConfig(parsedConfig)
      setConditions(parsedConditions)
      setData(parsedData)
      setStatus(`Loaded ${parsedData.length} events and ${parsedConditions.length} conditions successfully`)
      
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
      setStatus('Error loading data')
    } finally {
      setLoading(false)
    }
  }

  return {
    data,
    config,
    conditions,
    loading,
    error,
    status,
    loadData,
    eunlData,
    fetchEUNLData
  }
}
