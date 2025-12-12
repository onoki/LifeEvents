import React, { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { KPICards } from '@/components/kpi/KPICards'
import { StockCharts } from '@/components/charts/StockCharts'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAppStore } from './store/use-app-store'
import { usePrivacyMode } from './hooks/use-privacy-mode'
import { APP_CONFIG } from './config/app-config'
import './styles/accessibility.css'

function App(): React.JSX.Element {
  const [sheetsUrl, setSheetsUrl] = useState<string>('')
  const { 
    data, 
    config, 
    conditions, 
    loading, 
    error, 
    loadData, 
    eunlData, 
    fetchEUNLData,
    eunlTrendStats,
    eunlError 
  } = useAppStore()
  const { isPrivacyMode, getPrivacyUrl, getPublicUrl } = usePrivacyMode()

  // Load URL from GET parameter on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sheetsParam = urlParams.get('sheets')
    
    if (sheetsParam) {
      const decodedUrl = decodeURIComponent(sheetsParam)
      setSheetsUrl(decodedUrl)
      loadData(decodedUrl)
    }
  }, [])

  const handleLoadData = async (): Promise<void> => {
    if (!sheetsUrl.trim()) {
      alert(APP_CONFIG.ERRORS.INVALID_URL)
      return
    }
    await loadData(sheetsUrl)
  }


  const handleFetchEUNL = async (): Promise<void> => {
    await fetchEUNLData()
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-2 sm:px-4 py-6 max-w-6xl">

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6 px-2 sm:px-6">
              <div className="text-center">
                <div className="text-destructive text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold mb-2">Failed to Load Data</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button 
                  onClick={handleLoadData}
                  disabled={loading}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Dashboard */}
        {data && data.length > 0 && (
          <>
            {/* KPI Cards */}
            <KPICards data={data} config={config} conditions={conditions} />
            
            {/* Stock Charts */}
            <StockCharts 
              data={data} 
              config={config} 
              conditions={conditions}
              eunlData={eunlData} 
              onFetchEUNL={handleFetchEUNL}
              loading={loading}
              eunlTrendStats={eunlTrendStats}
              eunlError={eunlError}
            />
          </>
        )}

        {/* Empty State */}
        {!loading && !error && (!data || data.length === 0) && (
          <Card>
            <CardContent className="pt-6 px-2 sm:px-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">No Data Loaded</h3>
                <p className="text-muted-foreground mb-4">
                  Enter a Google Sheets URL above to start tracking your KPIs
                </p>
                <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
                  <p className="font-medium mb-2">📝 URL Format:</p>
                  <p className="font-mono text-xs break-all">
                    {window.location.origin}?sheets=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold mb-2">Your Google Sheet should have these sections:</p>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">📋 Configuration Section:</p>
                      <p className="font-mono text-xs ml-2">investment_goal, annual_growth_rate</p>
                    </div>
                    
                    <div>
                      <p className="font-medium">🎯 Conditions Section:</p>
                      <p className="font-mono text-xs ml-2">condition, explanation_short, explanation_long</p>
                    </div>
                    
                    <div>
                      <p className="font-medium">📈 Stock Information Section:</p>
                      <p className="font-mono text-xs ml-2">date, stocks_in_eur</p>
                      <p className="text-xs ml-2 text-muted-foreground">Optional: event, category, status, duration</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Privacy Toggle Link - Only show "Hide exact values" when not in privacy mode */}
        {data && data.length > 0 && !isPrivacyMode && (
          <div className="mt-8 text-center">
            <div className="text-sm text-muted-foreground">
              <a 
                href={getPrivacyUrl()} 
                className="text-blue-500 hover:text-blue-400 underline"
              >
                Hide exact values
              </a>
            </div>
          </div>
        )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App