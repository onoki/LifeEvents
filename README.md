# Life Events KPI Tracker

A mobile-friendly web application for tracking key performance indicators and progress metrics by fetching data from Google Sheets in TSV format.

## Features

- 📊 **KPI Dashboard**: Track total events, monthly progress, completion rates, and average duration
- 📈 **Interactive Charts**: Visualize events over time and category distribution using Chart.js
- 🎯 **Animated Numbers**: Smooth number animations using CountUp.js
- 📱 **Mobile Optimized**: Responsive design that works perfectly on mobile browsers
- 🎨 **Modern UI**: Built with shadcn/ui design system and Tailwind CSS
- 📋 **Google Sheets Integration**: Fetch real-time data from Google Sheets in TSV format
- 🔄 **Real-time Updates**: Refresh data anytime by clicking "Load Data"

## Technologies Used

- **HTML5/CSS3/JavaScript**: Core web technologies
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern component design system
- **Chart.js**: Interactive charts and graphs
- **CountUp.js**: Smooth number animations
- **Google Sheets API**: TSV data fetching

## Setup Instructions

1. **Clone or Download**: Get the project files (`index.html` and `app.js`)

2. **Prepare Your Google Sheet**:
   - Create a Google Sheet with your data
   - Include headers in the first row (e.g., `date`, `event`, `category`, `status`, `duration`)
   - Make sure the sheet is publicly accessible or shared with appropriate permissions

3. **Get the TSV Export URL**:
   - Open your Google Sheet
   - Go to File → Share → Publish to web
   - Choose "Tab-separated values (.tsv)" as the format
   - Copy the export URL

4. **Run the Application**:
   - Open `index.html` in any modern web browser
   - Paste your Google Sheets TSV URL in the input field
   - Click "Load Data" to fetch and display your data

## Data Format

Your Google Sheet should have the following columns (headers can be named differently):

| Column | Description | Example |
|--------|-------------|---------|
| `date` | Event date | 2024-01-15 |
| `event` | Event name/title | Project Alpha |
| `category` | Event category | Work, Personal, Health |
| `status` | Current status | completed, in-progress, pending |
| `duration` | Event duration | 30 days, 2 weeks |

## Sample Data

The application includes a sample dataset for testing. You can use this format as a reference:

```
date	event	category	status	duration
2024-01-15	Project Alpha	Work	completed	30 days
2024-01-20	Vacation Planning	Personal	pending	7 days
2024-02-01	Team Meeting	Work	in-progress	2 days
```

## Mobile Usage

This application is optimized for mobile browsers:
- Responsive grid layouts that adapt to screen size
- Touch-friendly buttons and controls
- Optimized typography and spacing for mobile viewing
- No server-side dependencies - runs entirely in the browser

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Common Issues

1. **"Failed to load data" error**:
   - Ensure your Google Sheet is publicly accessible
   - Check that the TSV export URL is correct
   - Verify the sheet has data in the expected format

2. **Charts not displaying**:
   - Check browser console for JavaScript errors
   - Ensure you have a stable internet connection
   - Try refreshing the page

3. **Mobile display issues**:
   - Ensure you're using a modern mobile browser
   - Check that JavaScript is enabled
   - Try rotating your device to landscape mode

### Getting Help

If you encounter issues:
1. Check the browser's developer console for error messages
2. Verify your Google Sheets URL is accessible in a new tab
3. Ensure your data format matches the expected structure

## Customization

You can customize the application by modifying:

- **Colors and Theme**: Edit the CSS variables in `index.html`
- **Chart Types**: Modify the Chart.js configurations in `app.js`
- **Metrics**: Add new KPI calculations in the helper methods
- **Layout**: Adjust the Tailwind CSS classes for different layouts

## License

This project is open source and available under the MIT License.
