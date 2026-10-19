export function assetUrl(path){
 return `${process.env.NEXT_PUBLIC_BASE_PATH||''}/${path.replace(/^\/+/, '')}`;
}
