import './globals.css';

export const metadata = {
  title: 'Hackathon Application Review',
  description: 'Review hackathon applications one at a time.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
