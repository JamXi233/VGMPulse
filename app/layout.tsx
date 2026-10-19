import type { Metadata,Viewport } from 'next';
import {headers} from 'next/headers';
import {Geist,Geist_Mono} from 'next/font/google';
import {project} from '../lib/project';
import {requestLanguage,translator} from '../lib/i18n';
import LanguageProvider from './LanguageProvider';
import {assetUrl} from '../lib/assets.js';
import './globals.css';
const geistSans=Geist({variable:'--font-geist-sans',subsets:['latin']});
const geistMono=Geist_Mono({variable:'--font-geist-mono',subsets:['latin']});
// vinext omits viewportFit when serializing Viewport; include the valid directive
// in its supported string field to emit one complete viewport meta tag.
export const viewport:Viewport={width:'device-width, viewport-fit=cover',initialScale:1,themeColor:'#111315'};
const pageHeaders=async()=>process.env.VGM_PAGES_BUILD==='1'?new Headers():headers();
export async function generateMetadata():Promise<Metadata>{
 const h=await pageHeaders();const host=h.get('x-forwarded-host')||h.get('host')||'localhost:3000';
 const origin=process.env.NEXT_PUBLIC_SITE_ORIGIN||`${host.includes('localhost')?'http':'https'}://${host}`;
 const title=project.name,description=translator(requestLanguage(h.get('accept-language'),h.get('cookie')))('app.description');
 return {title,description,metadataBase:new URL(origin),icons:{icon:{url:assetUrl('favicon.svg'),type:'image/svg+xml'}},openGraph:{title,description,type:'website'},twitter:{card:'summary',title,description}};
}
export default async function RootLayout({children}:{children:React.ReactNode}){const h=await pageHeaders(),language=requestLanguage(h.get('accept-language'),h.get('cookie'));return <html lang={language}><body className={`${geistSans.variable} ${geistMono.variable}`}><LanguageProvider initialLanguage={language}>{children}</LanguageProvider></body></html>;}
