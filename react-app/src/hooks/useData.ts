import { useState } from 'react'
import { parseTSVData } from '../utils/dataProcessingUtils'
import { APP_CONFIG } from '../config/appConfig'
import type { UseDataReturn, Event, Config, Condition, EUNLDataPoint, YahooFinanceResponse } from '../types'

export function useData(): UseDataReturn {
  const [data, setData] = useState<Event[]>([])
  const [config, setConfig] = useState<Config>({})
  const [conditions, setConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [eunlData, setEunlData] = useState<EUNLDataPoint[]>([])



  const fetchEUNLData = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setStatus('Fetching EUNL data from Yahoo Finance...')

    try {
      // Use CORS proxy to access Yahoo Finance API
      const proxyUrl = APP_CONFIG.API.CORS_PROXY
      const yahooUrl = `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${APP_CONFIG.API.EUNL_SYMBOL}?period1=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.START}&period2=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.END}&interval=1mo`
      
      const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl))
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const yahooData: YahooFinanceResponse = await response.json()
      
      if (!yahooData.chart || !yahooData.chart.result || !yahooData.chart.result[0]) {
        throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT)
      }

      const result = yahooData.chart.result[0]
      const timestamps = result.timestamp
      const closePrices = result.indicators.quote[0].close

      const eunlData: EUNLDataPoint[] = timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000),
        price: closePrices[index] || null,
        dateFormatted: new Date(timestamp * 1000).toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY)
      })).filter(item => item.price !== null)

      setEunlData(eunlData)
      setStatus(`Loaded ${eunlData.length} EUNL data points successfully`)
      
    } catch (err) {
      console.error('Error loading EUNL data:', err)
      setError(err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED)
      setStatus('Error loading EUNL data')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async (url: string): Promise<void> => {
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
        throw new Error(APP_CONFIG.ERRORS.NO_DATA)
      }

      setConfig(parsedConfig)
      setConditions(parsedConditions)
      setData(parsedData)
      setStatus(`Loaded ${parsedData.length} events and ${parsedConditions.length} conditions successfully`)
      
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED)
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
