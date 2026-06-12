import './globals.css';

export const metadata = {
  title: 'Hackathon Application Review',
  description: 'Internal tool for reviewing hackathon applications',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
