import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CountUp } from 'countup.js'

export function KPICards({ data, config }) {
  const hoursToWorkEndRef = useRef(null)
  const daysToFamilyLeaveRef = useRef(null)
  const daysToRetirementRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const hoursToWorkEnd = getHoursToWorkEnd(currentTime)
  const daysToFamilyLeave = getDaysToFamilyLeave()
  const daysToRetirement = getDaysToRetirement()

  useEffect(() => {
    // Animate numbers with CountUp.js
    if (hoursToWorkEndRef.current) {
      new CountUp(hoursToWorkEndRef.current, hoursToWorkEnd, {
        duration: 1,
        decimalPlaces: 1,
        suffix: 'h'
      }).start()
    }

    if (daysToFamilyLeaveRef.current) {
      new CountUp(daysToFamilyLeaveRef.current, daysToFamilyLeave, {
        duration: 1,
        suffix: ' days'
      }).start()
    }

    if (daysToRetirementRef.current) {
      new CountUp(daysToRetirementRef.current, daysToRetirement, {
        duration: 1,
        suffix: ' days'
      }).start()
    }
  }, [hoursToWorkEnd, daysToFamilyLeave, daysToRetirement])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hours Until Work End</CardTitle>
          <div className="text-2xl">⏰</div>
        </CardHeader>
        <CardContent>
          <div ref={hoursToWorkEndRef} className="text-3xl font-bold">0h</div>
          <p className="text-xs text-muted-foreground mt-1">
            Updates every minute
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Days Until Family Leave</CardTitle>
          <div className="text-2xl">👶</div>
        </CardHeader>
        <CardContent>
          <div ref={daysToFamilyLeaveRef} className="text-3xl font-bold">0 days</div>
          <p className="text-xs text-muted-foreground mt-1">
            Countdown to family time
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Days Until Retirement</CardTitle>
          <div className="text-2xl">🏖️</div>
        </CardHeader>
        <CardContent>
          <div ref={daysToRetirementRef} className="text-3xl font-bold">0 days</div>
          <p className="text-xs text-muted-foreground mt-1">
            Long-term countdown
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper functions
function getHoursToWorkEnd(currentTime) {
  const now = currentTime
  const workEnd = new Date(now)
  workEnd.setHours(17, 0, 0, 0) // 5 PM work end time
  
  // If it's already past 5 PM or weekend, show 0
  if (now.getHours() >= 17 || now.getDay() === 0 || now.getDay() === 6) {
    return 0
  }
  
  const diffMs = workEnd - now
  const diffHours = diffMs / (1000 * 60 * 60)
  return Math.max(0, diffHours)
}

function getDaysToFamilyLeave() {
  // You can customize this date
  const familyLeaveDate = new Date('2024-12-25') // Example: Christmas
  const now = new Date()
  const diffMs = familyLeaveDate - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

function getDaysToRetirement() {
  // You can customize this date
  const retirementDate = new Date('2050-01-01') // Example: 2050
  const now = new Date()
  const diffMs = retirementDate - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}