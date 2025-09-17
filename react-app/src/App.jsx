import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KPICards } from './components/KPICards'
import { StockCharts } from './components/StockCharts'
import { useData } from './hooks/useData'
import { Loader2 } from 'lucide-react'

function App() {
  const [sheetsUrl, setSheetsUrl] = useState('')
  const { data, config, loading, error, loadData, status, eunlData, fetchEUNLData } = useData()

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

  const handleLoadData = async () => {
    if (!sheetsUrl.trim()) {
      alert('Please enter a Google Sheets URL')
      return
    }
    await loadData(sheetsUrl)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLoadData()
    }
  }

  const handleFetchEUNL = async () => {
    await fetchEUNLData()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 max-w-6xl">

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
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
            <KPICards data={data} config={config} />
            
            {/* Stock Charts */}
            <StockCharts 
              data={data} 
              config={config} 
              eunlData={eunlData} 
              onFetchEUNL={handleFetchEUNL}
              loading={loading}
            />
          </>
        )}

        {/* Empty State */}
        {!loading && !error && (!data || data.length === 0) && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">No Data Loaded</h3>
                <p className="text-muted-foreground mb-4">
                  Enter a Google Sheets URL above to start tracking your KPIs
                </p>
                <div className="text-sm text-muted-foreground">
                  <p>Your sheet should have columns like:</p>
                  <p className="font-mono mt-2">date, event, category, status, duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App