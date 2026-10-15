import {createRoot} from 'react-dom/client';
import Register from './register';
import BrandHeader from './brand-header';
import './globals.css';

function ReaderSetup(){return <main id="main-content"><BrandHeader reader/><section className="setup reader-setup"><p className="eyebrow">PRIVATE EMAIL READER</p><h1>Connect the mailbox.</h1><p>The cashier receives Venmo receipts from your Google reader. Your Gmail access stays in Google; payment records stay in this cashier’s private database.</p><h2>Test before switching</h2><p>The migration guide in the TLPT repository explains the separate staging connection and dry-run receipt check. Keep the current reader connected to the working register until those checks pass.</p><p>Connection credentials are managed privately in Cloudflare and Google Script Properties. They are never displayed or stored in the website files.</p><p><a href="https://github.com/bostnmike/TLPT-poker/tree/main/cashier" target="_blank" rel="noreferrer">Cashier setup and migration guide ↗</a></p><p><a href="/">Return to the cash register →</a></p></section></main>;}

createRoot(document.getElementById('root')!).render(location.pathname==='/connect-reader'?<ReaderSetup/>:<Register/>);
