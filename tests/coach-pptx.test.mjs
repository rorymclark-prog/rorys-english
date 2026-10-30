import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
// Existing locked dependency supplies a standards-checking test adapter for browser DOMParser.
// Production uses the browser's DOMParser and has no XML/archive package dependency.
import {XMLParser,XMLValidator} from 'fast-xml-parser';

function parseXml(xml){
  if(XMLValidator.validate(xml)!==true)return {documentElement:null,getElementsByTagName:()=>[{}]};
  const parsed=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'',trimValues:false,parseTagValue:false,htmlEntities:true}).parse(xml);
  function descendants(nodes,name){return nodes.flatMap(node=>typeof node==='string'?[]:[...(node.localName===name?[node]:[]),...descendants(node.children,name)]);}
  function build(items,inheritedNamespaces={}){return items.flatMap(item=>Object.entries(item).filter(([key])=>key!==':@'&&!key.startsWith('?')).map(([key,value])=>{
    if(key==='#text')return String(value);
    const attrs=item[':@']||{},namespaces={...inheritedNamespaces,...Object.fromEntries(Object.entries(attrs).filter(([name])=>name.startsWith('xmlns:')).map(([name,value])=>[name.slice(6),value]))},children=build(value,namespaces),node={localName:key.split(':').at(-1),children,
      getAttribute(name){return attrs[name]??null;},getAttributeNS(namespace,name){return Object.entries(attrs).find(([key])=>key.includes(':')&&key.split(':')[1]===name&&namespaces[key.split(':')[0]]===namespace)?.[1]??null;},getElementsByTagNameNS(_namespace,name){return descendants(children,name);}};
    Object.defineProperty(node,'textContent',{get:()=>children.map(child=>typeof child==='string'?child:child.textContent).join('')});return node;
  }));}
  const roots=build(parsed);return {documentElement:roots.find(node=>typeof node!=='string'),getElementsByTagName:()=>[],getElementsByTagNameNS(_namespace,name){return descendants(roots,name);}};
}
const module={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/coach-pptx.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module,TextDecoder,Uint8Array,DataView,ReadableStream,DecompressionStream,DOMParser:class{parseFromString(xml){return parseXml(xml);}}});
const {readCoachPptxLocally}=module;
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
function zip(entries,{descriptor=false}={}){
  const records=[],directories=[];let offset=0;
  for(const [name,value] of Object.entries(entries)){
    const spec=typeof value==='object'&&!Buffer.isBuffer(value)?value:{text:value};
    const nameBytes=Buffer.from(name),raw=Buffer.from(spec.text),method=spec.method??8,compressed=method===0?raw:deflateRawSync(raw),crc=crc32(raw),expanded=spec.expanded??raw.length;
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(descriptor?8:0,6);local.writeUInt16LE(method,8);local.writeUInt32LE(descriptor?0:crc,14);local.writeUInt32LE(descriptor?0:compressed.length,18);local.writeUInt32LE(descriptor?0:expanded,22);local.writeUInt16LE(nameBytes.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(descriptor?8:0,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(expanded,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
    const tail=Buffer.alloc(descriptor?16:0);if(descriptor){tail.writeUInt32LE(0x08074b50);tail.writeUInt32LE(crc,4);tail.writeUInt32LE(compressed.length,8);tail.writeUInt32LE(expanded,12);}
    const record=Buffer.concat([local,nameBytes,compressed,tail]);records.push(record);directories.push(Buffer.concat([central,nameBytes]));offset+=record.length;
  }
  const directory=Buffer.concat(directories),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(records.length,8);end.writeUInt16LE(records.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...records,directory,end]);
}
const file=bytes=>({size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
const pns='http://schemas.openxmlformats.org/presentationml/2006/main',ans='http://schemas.openxmlformats.org/drawingml/2006/main',rns='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const slide=text=>`<p:sld xmlns:p="${pns}" xmlns:a="${ans}"><a:t>${text}</a:t></p:sld>`;
function deck(texts=['First'],order=texts.map((_,i)=>i+1)){
  return Object.fromEntries([
    ['ppt/presentation.xml',`<p:presentation xmlns:p="${pns}" xmlns:r="${rns}"><p:sldIdLst>${order.map((n,i)=>`<p:sldId id="${i+1}" r:id="rId${n}"/>`).join('')}</p:sldIdLst></p:presentation>`],
    ['ppt/_rels/presentation.xml.rels',`<Relationships>${texts.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rns}/slide" Target="slides/slide${i+1}.xml"/>`).join('')}</Relationships>`],
    ...texts.map((text,i)=>[`ppt/slides/slide${i+1}.xml`,slide(text)])]);
}
const values=slides=>Array.from(slides,item=>({...item}));

test('local importer follows actual presentation order and preserves numbers, Unicode and XML entities',async()=>{
  const result=await readCoachPptxLocally(file(zip(deck(['Second &amp; final','First &#x2014; café &lt;hello&gt;'],[2,1]))));
  assert.deepEqual(values(result),[{number:1,text:'First — café <hello>'},{number:2,text:'Second & final'}]);
});

test('large saved PowerPoints are read locally without inflating embedded media or applying the former 3 MB upload limit',async()=>{
  const entries=deck();entries['ppt/media/movie.mp4']={text:Buffer.alloc(3_100_000,93),method:0};let calls=0;
  const bytes=zip(entries);assert.ok(bytes.length>3_000_000);
  const result=await readCoachPptxLocally(file(bytes),{inflateRaw:async(compressed,max)=>{calls++;return inflateRawSync(compressed,{maxOutputLength:max});}});
  assert.equal(result[0].text,'First');assert.equal(calls,3,'only presentation, relationships and selected slide XML should inflate');
});

test('stored entries and signed data descriptors are supported',async()=>{
  const entries=Object.fromEntries(Object.entries(deck()).map(([name,text])=>[name,{text,method:0}]));
  assert.equal((await readCoachPptxLocally(file(zip(entries))))[0].text,'First');
  assert.equal((await readCoachPptxLocally(file(zip(deck(),{descriptor:true}))))[0].text,'First');
});

test('teacher notes stay separate from slide text and slide-number placeholders are removed',async()=>{
  const entries=deck(['Student exercise']);
  entries['ppt/slides/_rels/slide1.xml.rels']=`<Relationships><Relationship Id="notes1" Type="${rns}/notesSlide" Target="../notesSlides/notesSlide7.xml"/></Relationships>`;
  entries['ppt/notesSlides/notesSlide7.xml']=`<p:notes xmlns:p="${pns}" xmlns:a="${ans}"><p:sp><p:ph type="body"/><a:t>Wait for an answer.</a:t></p:sp><p:sp><p:ph type="sldNum"/><a:t>1</a:t></p:sp></p:notes>`;
  assert.deepEqual(values(await readCoachPptxLocally(file(zip(entries)))),[{number:1,text:'Student exercise',notes:'Wait for an answer.'}]);
});

test('unknown source ordering is rejected rather than silently using archive filenames',async()=>{
  const entries=deck(['One','Two']);delete entries['ppt/_rels/presentation.xml.rels'];
  await assert.rejects(readCoachPptxLocally(file(zip(entries))),/damaged|unsupported/);
  const duplicate=deck(['One','Two'],[1,1]);await assert.rejects(readCoachPptxLocally(file(zip(duplicate))),/damaged|unsupported/);
  const external=deck();external['ppt/_rels/presentation.xml.rels']=external['ppt/_rels/presentation.xml.rels'].replace('Target="slides','TargetMode="External" Target="slides');
  await assert.rejects(readCoachPptxLocally(file(zip(external))),/damaged|unsupported/);
});

test('input, archive-entry and slide-count limits are checked before reading unneeded content',async()=>{
  await assert.rejects(readCoachPptxLocally({size:64_000_001,arrayBuffer(){assert.fail('must reject before reading');}}),/64 MB/);
  await assert.rejects(readCoachPptxLocally(file(zip(deck(Array(301).fill('Hello'))))),/300 slides/);
  const bytes=zip(deck());bytes.writeUInt16LE(10001,bytes.length-14);bytes.writeUInt16LE(10001,bytes.length-12);
  await assert.rejects(readCoachPptxLocally(file(bytes)),/64 MB/);
});

test('streamed decompression bounds defeat forged-size bombs and cumulative XML expansion',async()=>{
  const bomb=deck();bomb['ppt/slides/slide1.xml']={text:slide('a'.repeat(500_001)),expanded:100};
  await assert.rejects(readCoachPptxLocally(file(zip(bomb))),/64 MB/);
  await assert.rejects(readCoachPptxLocally(file(zip(deck(Array(13).fill('a'.repeat(479_000)))))),/64 MB/);
  const exact=await readCoachPptxLocally(file(zip(deck(['a'.repeat(30_000)]))));assert.equal(exact[0].text.length,12_000);
});

test('malformed XML, DTDs and entities are rejected without recursive expansion',async()=>{
  for(const text of ['<p:sld><broken></p:sld>','<!DOCTYPE sld [<!ENTITY x "value">]>'+slide('&x;')]){
    const entries=deck();entries['ppt/slides/slide1.xml']=text;
    await assert.rejects(readCoachPptxLocally(file(zip(entries))),/damaged|unsupported/);
  }
});

test('corrupt ZIP data, path tricks, encryption, unsupported methods, ZIP64 and local header mismatches are rejected',async()=>{
  const regular=zip(deck()),central=regular.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  const modified=[];
  let bytes=Buffer.from(regular);bytes.writeUInt16LE(1,central+8);modified.push(bytes);
  bytes=Buffer.from(regular);bytes.writeUInt16LE(99,central+10);modified.push(bytes);
  bytes=Buffer.from(regular);bytes.writeUInt32LE(0xffffffff,central+24);modified.push(bytes);
  bytes=Buffer.from(regular);bytes.writeUInt32LE(0,central+16);modified.push(bytes);
  bytes=Buffer.from(regular);bytes.writeUInt16LE(0,8);modified.push(bytes);
  modified.push(regular.subarray(0,regular.length-1));
  modified.push(zip({...deck(),'../evil.xml':'bad'}));
  modified.push(zip({...deck(),'ppt\\evil.xml':'bad'}));
  for(const data of modified)await assert.rejects(readCoachPptxLocally(file(data)),/damaged|unsupported/);
});


test('relationship namespace aliases preserve source order in revised real-world decks',async()=>{
  const entries=deck(['One','Two'],[2,1]);
  entries['ppt/presentation.xml']=entries['ppt/presentation.xml'].replaceAll('xmlns:r=','xmlns:ns0=').replaceAll('r:id=','ns0:id=');
  assert.deepEqual(values(await readCoachPptxLocally(file(zip(entries)))),[{number:1,text:'Two'},{number:2,text:'One'}]);
});
