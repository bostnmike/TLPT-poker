export const GALLERY_MANIFEST='https://tlpt.org/images/fw/gallery-manifest.json';
export const validPosterFile=file=>typeof file==='string'&&/^fw\d{2}-\d{2}-\d{2}\.(jpg|png)$/.test(file);
export const posterDescriptor=file=>validPosterFile(file)?{file,date:`20${file.slice(2,10)}`,url:`https://tlpt.org/images/fw/${file}`,thumbnailUrl:`https://tlpt.org/images/fw/thumbs/${file}`}:null;
export function eventPoster(metadata,catalog=[]){
 const choice=metadata.poster||'auto';if(choice==='none')return null;
 const file=choice==='auto'?(/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)?catalog.map(p=>p.file).filter(validPosterFile).sort().find(f=>f.slice(2,10)===metadata.date.slice(2)):null):choice;
 const descriptor=posterDescriptor(file);if(!descriptor)return null;
 const {date,...poster}=descriptor;return poster;
}
export function parseGallery(gallery){
 if(gallery?.folder!=='images/fw'||!Array.isArray(gallery.files))throw Error('Gallery unavailable.');
 return [...new Set(gallery.files.filter(validPosterFile))].slice(0,500).map(posterDescriptor);
}
// One bounded public-catalog read per five minutes, coalesced across requests.
// Gallery failures never block RSVPs. Retain the last valid catalog if available;
// otherwise automatic posters stay absent instead of guessing an extension.
export function createCatalogLoader(fetcher=fetch,now=Date.now){
 let posters=[],expires=0,pending,result={posters};
 return async()=>{
  if(now()<expires)return result;
  if(pending)return pending;
  pending=(async()=>{try{
   const response=await fetcher(GALLERY_MANIFEST,{signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('Gallery unavailable.');
   const text=await response.text();if(text.length>100000)throw Error('Gallery too large.');
   posters=parseGallery(JSON.parse(text));result={posters};expires=now()+300000;
  }catch{result={posters,unavailable:true};expires=now()+30000;}
  return result;})().finally(()=>{pending=null;});
  return pending;
 };
}
const loaders=new WeakMap();
export function galleryCatalog(fetcher=fetch){
 if(!loaders.has(fetcher))loaders.set(fetcher,createCatalogLoader(fetcher));
 return loaders.get(fetcher)();
}
