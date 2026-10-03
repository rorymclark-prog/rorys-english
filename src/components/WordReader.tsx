"use client";
import {useEffect,useState,createElement,type ReactNode} from 'react';
// Converted Word content is rendered through a small React element allowlist.
// No document HTML, links, scripts, attributes or images are inserted directly.
const allowed=new Set(['p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','thead','tbody','tr','td','th','strong','em','br']);
function safeNodes(parent:Node):ReactNode[]{return Array.from(parent.childNodes).map((node,i)=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent;
  if(node.nodeType!==Node.ELEMENT_NODE)return null;
  const tag=(node as Element).tagName.toLowerCase();
  if(['script','style','iframe','object','img','svg'].includes(tag))return null;
  const children=safeNodes(node);
  return allowed.has(tag)?createElement(tag,{key:i},tag==='br'?undefined:children):children;
});}
export default function WordReader({file}:{file:File}){
  const [content,setContent]=useState<ReactNode>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;setContent(null);setError('');void(async()=>{try{
    const mammoth=await import('mammoth');const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{includeDefaultStyleMap:true,ignoreEmptyParagraphs:false,convertImage:mammoth.images.imgElement(()=>Promise.resolve({src:''}))});
    if(active)setContent(safeNodes(new DOMParser().parseFromString(result.value,'text/html').body));
  }catch{if(active)setError('This Word file could not be displayed. The original remains saved; try a PDF copy.');}})();return()=>{active=false;};},[file]);
  return <article className="word-reader" aria-label="Word document in-app reader">{error?<p role="alert">{error}</p>:content||<p role="status">Opening the document here…</p>}</article>;
}
