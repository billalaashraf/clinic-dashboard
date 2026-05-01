export const metadata = {
  title: 'ClinicPulse — Command Center',
  description: 'AI-powered clinic management dashboard',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', system-ui, sans-serif", background: '#f0f2f7', color: '#111827' }}>
        {children}
      </body>
    </html>
  )
}
