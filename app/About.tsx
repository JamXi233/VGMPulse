'use client';
import {useRef} from 'react';
import {useLanguage} from '../lib/language-context';
import {project} from '../lib/project';
import {useDialog} from '../lib/use-dialog';

export default function About({close}:{close:()=>void}){
 const {t}=useLanguage();
 const panel=useRef<HTMLElement>(null);useDialog(panel,close);
 return <div className="modal-backdrop" onClick={close}><section ref={panel} className="info-modal about-panel" role="dialog" aria-modal="true" aria-labelledby="about-title" tabIndex={-1} onClick={e=>e.stopPropagation()}>
  <header className="dialog-heading"><h2 id="about-title">{t('aboutApp')}</h2><button className="dialog-close" aria-label={t('closeAbout')} onClick={close}>×</button></header>
  <div className="about-identity"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/></span><div><h3>{project.name}<span>v{project.version}</span></h3><p>{t('app.subtitle')}</p></div></div>
  <p className="about-copyright">{project.copyright}</p>
  <dl className="about-facts"><dt>{t('about.maintainer')}</dt><dd>{project.author}</dd><dt>{t('about.license')}</dt><dd><a href="/LICENSE.txt" target="_blank" rel="noreferrer">GNU GPL v3.0</a></dd><dt>{t('about.demo')}</dt><dd>{t('demo.title')}</dd></dl>
  <p className="about-note">{t('about.note')}</p>
  <details className="about-credits"><summary>{t('about.credits')}</summary><ul>
   <li><a href="https://github.com/mmontag/chip-player-js" target="_blank" rel="noreferrer">Chip Player JS</a><span>{t('about.contributors')}</span></li>
   <li><a href="https://github.com/ValleyBell/libvgm" target="_blank" rel="noreferrer">{t('about.cores')}</a><span>{t('about.coreLicenses')}</span></li>
  </ul></details>
  <div className="about-links"><a href="/LICENSE.txt" target="_blank" rel="noreferrer">{t('about.projectLicense')}</a><a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">{t('about.thirdParty')}</a><a href="/engine/NOTICE.txt" target="_blank" rel="noreferrer">{t('about.engineSource')}</a></div>
 </section></div>;
}
