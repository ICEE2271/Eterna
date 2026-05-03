import '../styles/globals.css'

export const metadata = { title: 'Eterna', description: 'Your second brain' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ height: '100vh', overflow: 'hidden' }}>{children}</body>
    </html>
  )
}
