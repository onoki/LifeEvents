import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CountUp } from 'countup.js'

export function KPICards({ data, config }) {
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
  const workProgress = getWorkProgress(currentTime)
  const workTimeFormatted = getWorkTimeFormatted(currentTime)
  const familyLeaveTimeFormatted = getFamilyLeaveTimeFormatted(currentTime)
  const familyLeaveProgress = getFamilyLeaveProgress(currentTime)
  const familyLeaveWorkdays = getFamilyLeaveWorkdays(currentTime)
  const retirementTimeFormatted = getRetirementTimeFormatted(currentTime)
  const retirementProgress = getRetirementProgress(currentTime)
  const retirementWorkdays = getRetirementWorkdays(currentTime)
  const daysToFamilyLeave = getDaysToFamilyLeave()
  const daysToRetirement = getDaysToRetirement()

  useEffect(() => {
    // Animate numbers with CountUp.js
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
  }, [daysToFamilyLeave, daysToRetirement])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card className="border-gray-600">
        <CardContent className="pt-6 pb-6 flex flex-col h-full">
          <div className="flex justify-between items-center flex-grow">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-gray-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </div>
              <div className="text-3xl font-bold">{workTimeFormatted}</div>
            </div>
            <div className="text-lg font-semibold text-gray-600">
              {workProgress.toFixed(3)} %
            </div>
          </div>
          <div className="mt-auto pt-2">
             <div className="w-full bg-gray-600 rounded-lg h-8">
               <div 
                 className="bg-white h-8 rounded-lg transition-all duration-300" 
                 style={{ width: `${workProgress}%` }}
               ></div>
             </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
              <span>8:30</span>
              <span>16:30</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-600">
        <CardContent className="pt-6 pb-6 flex flex-col h-full">
          <div className="flex justify-between items-center flex-grow">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-gray-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9"/>
                  <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold">{familyLeaveTimeFormatted}</div>
                <div className="text-lg font-medium text-gray-500">
                  {familyLeaveWorkdays.toLocaleString('en-US').replace(/,/g, ' ')} workdays
                </div>
              </div>
            </div>
            <div className="text-lg font-semibold text-gray-600">
              {familyLeaveProgress.toFixed(3)} %
            </div>
          </div>
          <div className="mt-auto pt-2">
            <div className="w-full bg-gray-600 rounded-lg h-8">
              <div 
                className="bg-white h-8 rounded-lg transition-all duration-300" 
                style={{ width: `${familyLeaveProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
              <span>2024-06-24</span>
              <span>2025-12-05</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-600">
        <CardContent className="pt-6 pb-6 flex flex-col h-full">
          <div className="flex justify-between items-center flex-grow">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-gray-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold">{retirementTimeFormatted}</div>
                <div className="text-lg font-medium text-gray-500">
                  {retirementWorkdays.toLocaleString('en-US').replace(/,/g, ' ')} workdays
                </div>
              </div>
            </div>
            <div className="text-lg font-semibold text-gray-600">
              {retirementProgress.toFixed(3)} %
            </div>
          </div>
          <div className="mt-auto pt-2">
            <div className="w-full bg-gray-600 rounded-lg h-8">
              <div 
                className="bg-white h-8 rounded-lg transition-all duration-300" 
                style={{ width: `${retirementProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
              <span>2013-11-18</span>
              <span>2043-02-19</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper functions
function getHoursToWorkEnd(currentTime) {
  const now = currentTime
  const workEnd = new Date(now)
  workEnd.setHours(16, 30, 0, 0) // 4:30 PM work end time
  
  // If it's already past 4:30 PM or weekend, show 0
  if (now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30) || now.getDay() === 0 || now.getDay() === 6) {
    return 0
  }
  
  const diffMs = workEnd - now
  const diffHours = diffMs / (1000 * 60 * 60)
  return Math.max(0, diffHours)
}

function getWorkProgress(currentTime) {
  const now = currentTime
  
  // If it's weekend, show 0% progress
  if (now.getDay() === 0 || now.getDay() === 6) {
    return 0
  }
  
  const workStart = new Date(now)
  workStart.setHours(8, 30, 0, 0) // 8:30 AM
  
  const workEnd = new Date(now)
  workEnd.setHours(16, 30, 0, 0) // 4:30 PM
  
  // If before work start, show 0%
  if (now < workStart) {
    return 0
  }
  
  // If after work end, show 100%
  if (now > workEnd) {
    return 100
  }
  
  // Calculate progress percentage
  const totalWorkTime = workEnd - workStart
  const elapsedTime = now - workStart
  const progress = (elapsedTime / totalWorkTime) * 100
  
  return Math.min(100, Math.max(0, progress))
}

function getWorkTimeFormatted(currentTime) {
  const now = currentTime
  
  // If it's weekend, show 0
  if (now.getDay() === 0 || now.getDay() === 6) {
    return "0 h 0 min"
  }
  
  const workEnd = new Date(now)
  workEnd.setHours(16, 30, 0, 0) // 4:30 PM work end time
  
  // If it's already past 4:30 PM, show 0
  if (now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30)) {
    return "0 h 0 min"
  }
  
  const diffMs = workEnd - now
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (diffHours > 0) {
    return `${diffHours} h ${diffMinutes} min`
  } else {
    return `${diffMinutes} min`
  }
}

function getFamilyLeaveTimeFormatted(currentTime) {
  const now = currentTime
  const familyLeaveStart = new Date('2024-06-24T08:30:00')
  const familyLeaveEnd = new Date('2025-12-05T17:30:00')
  
  // If before start date, show time until start
  if (now < familyLeaveStart) {
    const diffMs = familyLeaveStart - now
    const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
    const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24))
    
    let result = ''
    if (diffMonths > 0) result += `${diffMonths} m `
    if (diffDays > 0) result += `${diffDays} d`
    return result.trim() || "0 d"
  }
  
  // If after end date, show 0
  if (now > familyLeaveEnd) {
    return "0 d"
  }
  
  // During family leave period, show time until end
  const diffMs = familyLeaveEnd - now
  const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
  const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24))
  
  let result = ''
  if (diffMonths > 0) result += `${diffMonths} m `
  if (diffDays > 0) result += `${diffDays} d`
  return result.trim() || "0 d"
}

function getFamilyLeaveWorkdays(currentTime) {
  const now = currentTime
  const familyLeaveStart = new Date('2024-06-24T08:30:00')
  const familyLeaveEnd = new Date('2025-12-05T17:30:00')
  
  // If before start date, calculate workdays until start
  if (now < familyLeaveStart) {
    return countWorkdays(now, familyLeaveStart)
  }
  
  // If after end date, show 0
  if (now > familyLeaveEnd) {
    return 0
  }
  
  // During family leave period, calculate workdays until end
  return countWorkdays(now, familyLeaveEnd)
}

function countWorkdays(startDate, endDate) {
  let count = 0
  const current = new Date(startDate)
  
  while (current < endDate) {
    const dayOfWeek = current.getDay()
    // Monday = 1, Tuesday = 2, ..., Friday = 5
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  
  return count
}

function getFamilyLeaveProgress(currentTime) {
  const now = currentTime
  const familyLeaveStart = new Date('2024-06-24T08:30:00')
  const familyLeaveEnd = new Date('2025-12-05T17:30:00')
  
  // If before start date, show 0%
  if (now < familyLeaveStart) {
    return 0
  }
  
  // If after end date, show 100%
  if (now > familyLeaveEnd) {
    return 100
  }
  
  // Calculate progress percentage
  const totalTime = familyLeaveEnd - familyLeaveStart
  const elapsedTime = now - familyLeaveStart
  const progress = (elapsedTime / totalTime) * 100
  
  return Math.min(100, Math.max(0, progress))
}

function getDaysToFamilyLeave() {
  // You can customize this date
  const familyLeaveDate = new Date('2024-12-25') // Example: Christmas
  const now = new Date()
  const diffMs = familyLeaveDate - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

function getRetirementTimeFormatted(currentTime) {
  const now = currentTime
  const retirementStart = new Date('2013-11-18T08:00:00')
  const retirementEnd = new Date('2043-02-19T17:00:00')
  
  // If before start date, show time until start
  if (now < retirementStart) {
    const diffMs = retirementStart - now
    const diffYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
    const diffMonths = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24))
    
    let result = ''
    if (diffYears > 0) result += `${diffYears} y `
    if (diffMonths > 0) result += `${diffMonths} m `
    if (diffDays > 0) result += `${diffDays} d`
    return result.trim() || "0 d"
  }
  
  // If after end date, show 0
  if (now > retirementEnd) {
    return "0 d"
  }
  
  // During retirement period, show time until end
  const diffMs = retirementEnd - now
  const diffYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
  const diffMonths = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24))
  
  let result = ''
  if (diffYears > 0) result += `${diffYears} y `
  if (diffMonths > 0) result += `${diffMonths} m `
  if (diffDays > 0) result += `${diffDays} d`
  return result.trim() || "0 d"
}

function getRetirementProgress(currentTime) {
  const now = currentTime
  const retirementStart = new Date('2013-11-18T08:00:00')
  const retirementEnd = new Date('2043-02-19T17:00:00')
  
  // If before start date, show 0%
  if (now < retirementStart) {
    return 0
  }
  
  // If after end date, show 100%
  if (now > retirementEnd) {
    return 100
  }
  
  // Calculate progress percentage
  const totalTime = retirementEnd - retirementStart
  const elapsedTime = now - retirementStart
  const progress = (elapsedTime / totalTime) * 100
  
  return Math.min(100, Math.max(0, progress))
}

function getRetirementWorkdays(currentTime) {
  const now = currentTime
  const retirementStart = new Date('2013-11-18T08:00:00')
  const retirementEnd = new Date('2043-02-19T17:00:00')
  
  // If before start date, calculate workdays until start
  if (now < retirementStart) {
    return countWorkdaysWithVacation(now, retirementStart)
  }
  
  // If after end date, show 0
  if (now > retirementEnd) {
    return 0
  }
  
  // During retirement period, calculate workdays until end
  return countWorkdaysWithVacation(now, retirementEnd)
}

function countWorkdaysWithVacation(startDate, endDate) {
  let count = 0
  const current = new Date(startDate)
  
  while (current < endDate) {
    const dayOfWeek = current.getDay()
    const month = current.getMonth() // 0-11, July = 6
    const year = current.getFullYear()
    
    // Check if it's a workday (Monday-Friday)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Check if it's vacation time (first 5 weeks of July)
      const isVacation = month === 6 && isInFirstFiveWeeksOfJuly(current)
      
      if (!isVacation) {
        count++
      }
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  return count
}

function isInFirstFiveWeeksOfJuly(date) {
  const july1 = new Date(date.getFullYear(), 6, 1) // July 1st
  const dayOfYear = Math.floor((date - july1) / (1000 * 60 * 60 * 24))
  return dayOfYear >= 0 && dayOfYear < 35 // First 5 weeks = 35 days
}

function getDaysToRetirement() {
  // You can customize this date
  const retirementDate = new Date('2050-01-01') // Example: 2050
  const now = new Date()
  const diffMs = retirementDate - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}