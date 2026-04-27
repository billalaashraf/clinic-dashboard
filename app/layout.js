export const metadata = {
  title: 'Clinic Reminder Dashboard',
  description: 'Live monitoring dashboard for aesthetic clinic reminders',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', color: '#f0f0f0' }}>
        {children}
      </body>
    </html>
  )
}
