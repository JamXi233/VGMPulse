'use client';
import {useRef} from 'react';
import {useLanguage} from '../lib/language-context';
import type {Track} from '../lib/player';
import {useDialog} from '../lib/use-dialog';

export default function TrackInfo({track,filename,chips,demo=false,close}:{track:Track|null;filename?:string;chips:string[];demo?:boolean;close:()=>void}){
 const {t}=useLanguage();
 const panel=useRef<HTMLElement>(null);useDialog(panel,close);
 return <div className="modal-backdrop" onClick={close}><section ref={panel} className="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title" tabIndex={-1} onClick={e=>e.stopPropagation()}>
  <header className="dialog-heading"><h2 id="info-title">{t('trackInfo')}</h2><button className="dialog-close" aria-label={t('info.close')} onClick={close}>×</button></header>
  <dl><dt>{t('info.track')}</dt><dd>{demo?t('demo.title'):track?.title||'—'}</dd><dt>{t('info.game')}</dt><dd>{track?.game||'—'}</dd><dt>{t('info.artist')}</dt><dd>{track?.artist||'—'}</dd><dt>{t('info.system')}</dt><dd>{track?.system||t('unknownSystem')}</dd>{track?.date&&<><dt>{t('info.year')}</dt><dd>{track.date}</dd></>}<dt>{t('info.file')}</dt><dd>{filename||'—'}</dd><dt>{t('info.chips')}</dt><dd>{chips.join(' / ')||'—'}</dd></dl>
  <div className="shortcut-list"><span><kbd>Space</kbd>{t('info.toggle')}</span><span><kbd>←</kbd><kbd>→</kbd>{t('info.seek')}</span><span><kbd>M</kbd>{t('mute')}</span><span><kbd>S</kbd>{t('info.multiSolo')}</span></div>
  <p className="fine-print">{t('info.note')}</p>
  <p className="credits"><a href="https://github.com/ValleyBell/libvgm" target="_blank" rel="noreferrer">LibVGM</a><span> / </span><a href="https://github.com/mmontag/chip-player-js" target="_blank" rel="noreferrer">Chip Player JS</a></p>
 </section></div>;
}
