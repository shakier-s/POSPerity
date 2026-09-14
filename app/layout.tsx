import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'POSPerity — Smarter point of sale',description:'A modern, multi-location point of sale, inventory and customer management platform.',openGraph:{title:'POSPerity — Smarter point of sale',description:'Sell, manage stock, understand customers and purchase with confidence.'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
