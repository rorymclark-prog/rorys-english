"use client";
import {useEffect,useRef,useState} from 'react';
import {MAX_DOCUMENT_BYTES} from '@/lib/documents';
export default function DocumentScanner({onUse,onClose}:{onUse:(files:File[])=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),dialog=useRef<HTMLDialogElement>(null),photoInput=useRef<HTMLInputElement>(null);
  const [pages,setPages]=useState<{file:File;url:string}[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false),[working,setWorking]=useState(false);
  const pagesRef=useRef(pages);pagesRef.current=pages;
  useEffect(()=>{
    let active=true;dialog.current?.showModal();const prev=document.body.style.overflow;document.body.style.overflow='hidden';
    (async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw new Error();const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2000},height:{ideal:2800}},audio:false});if(!active){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;if(video.current){video.current.srcObject=media;await video.current.play();}if(active)setReady(true);}catch{if(active)setError('Camera unavailable. Use Take a photo to open your device camera, or close this and upload a file.');}})();
    return()=>{active=false;stream.current?.getTracks().forEach(t=>t.stop());pagesRef.current.forEach(p=>URL.revokeObjectURL(p.url));document.body.style.overflow=prev;};
  },[]);
  async function addCanvas(canvas:HTMLCanvasElement){
    const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',.84));if(!blob)throw new Error('Could not capture that page. Try again.');
    if(pagesRef.current.reduce((n,p)=>n+p.file.size,0)+blob.size>MAX_DOCUMENT_BYTES)throw new Error('This scan is full. Save these pages, then start another document.');
    const file=new File([blob],`scan-page-${pagesRef.current.length+1}.jpg`,{type:'image/jpeg'});setPages(p=>[...p,{file,url:URL.createObjectURL(file)}]);setError('');
  }
  async function capture(){if(!video.current?.videoWidth||pages.length>=6)return;setWorking(true);try{const v=video.current,c=document.createElement('canvas'),scale=Math.min(1,2000/Math.max(v.videoWidth,v.videoHeight));c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);c.getContext('2d')!.drawImage(v,0,0,c.width,c.height);await addCanvas(c);}catch(e){setError((e as Error).message);}finally{setWorking(false);}}
  async function devicePhoto(file?:File){if(!file)return;setWorking(true);const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,2000/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);await addCanvas(c);}catch{setError('This photo could not be read. Try a JPEG or the live camera.');}finally{URL.revokeObjectURL(url);setWorking(false);}}
  async function rotate(index:number){setWorking(true);try{const page=pages[index],img=new Image();img.src=page.url;await img.decode();const c=document.createElement('canvas');c.width=img.height;c.height=img.width;const ctx=c.getContext('2d')!;ctx.translate(c.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(img,0,0);const blob=await new Promise<Blob|null>(r=>c.toBlob(r,'image/jpeg',.9));if(!blob)throw new Error();const file=new File([blob],page.file.name,{type:'image/jpeg'});setPages(ps=>ps.map((p,i)=>i===index?{file,url:URL.createObjectURL(file)}:p));URL.revokeObjectURL(page.url);}catch{setError('Could not rotate that page. Please retake it.');}finally{setWorking(false);}}
  return <dialog ref={dialog} className="doc-scanner" aria-labelledby="scan-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><div><p className="doc-eyebrow">A PAGE AT A TIME</p><h2 id="scan-title">Scan your work</h2></div><button className="doc-icon-button" onClick={onClose} aria-label="Close scanner">×</button></header>
    <p className="doc-muted">Place the page flat in good light. Keep all four edges visible and check the words are sharp.</p>
    <div className="doc-viewfinder"><video ref={video} muted playsInline aria-label="Live document camera"/><div className="doc-scan-frame" aria-hidden="true"/><span>{ready?'Hold steady • keep the whole page in view':'Opening camera…'}</span></div>
    <div className="doc-button-row"><button className="doc-primary" disabled={!ready||working||pages.length>=6} onClick={()=>void capture()}>Capture page</button><button className="doc-secondary" disabled={working||pages.length>=6} onClick={()=>photoInput.current?.click()}>Take a photo</button><input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={e=>{void devicePhoto(e.target.files?.[0]);e.target.value='';}}/></div>
    {error&&<p className="doc-error" role="alert">{error}</p>}
    <div className="doc-scan-pages">{pages.map((p,i)=><div key={p.url}><img src={p.url} alt={`Scanned page ${i+1}`}/><span>Page {i+1}</span><button className="doc-link" disabled={working} onClick={()=>void rotate(i)}>Rotate</button><button className="doc-link" disabled={working} onClick={()=>{URL.revokeObjectURL(p.url);setPages(ps=>ps.filter((_,n)=>n!==i));}}>Remove</button></div>)}</div>
    <footer><p className="doc-muted">Up to 6 pages. Scans are saved as clear JPEG photos; review them before uploading.</p><button className="doc-primary" disabled={!pages.length||working} onClick={()=>onUse(pages.map(p=>p.file))}>Use {pages.length||''} {pages.length===1?'page':'pages'}</button></footer>
  </dialog>;
}
