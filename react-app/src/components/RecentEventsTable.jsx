import { Badge } from "@/components/ui/badge"

export function RecentEventsTable({ data }) {
  const recentEvents = data
    .sort((a, b) => b.date - a.date)
    .slice(0, 10)

  const getStatusColor = (status) => {
    const statusColors = {
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'done': 'bg-green-100 text-green-800 border-green-200',
      'finished': 'bg-green-100 text-green-800 border-green-200',
      'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'cancelled': 'bg-red-100 text-red-800 border-red-200',
      'failed': 'bg-red-100 text-red-800 border-red-200'
    }
    
    return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (recentEvents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No events found in the data
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Date</th>
            <th className="text-left py-2 font-medium">Event</th>
            <th className="text-left py-2 font-medium">Category</th>
            <th className="text-left py-2 font-medium">Status</th>
            <th className="text-left py-2 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {recentEvents.map((event, index) => (
            <tr key={index} className="border-b hover:bg-muted/50">
              <td className="py-2">{formatDate(event.date)}</td>
              <td className="py-2 font-medium">
                {event.event || event.name || event.title || 'Unknown'}
              </td>
              <td className="py-2">
                <Badge variant="secondary">
                  {event.category || 'Uncategorized'}
                </Badge>
              </td>
              <td className="py-2">
                <Badge className={getStatusColor(event.status)}>
                  {event.status || 'Unknown'}
                </Badge>
              </td>
              <td className="py-2">{event.duration || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
