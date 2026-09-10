const zlib=require('zlib');
function crc32(buffer){
  let crc=0xffffffff;
  for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  return (crc^0xffffffff)>>>0;
}
function makeZip(files,{deflate=false}={}){
  const locals=[],centrals=[];let offset=0;
  for(const [name,value] of Object.entries(files)){
    const n=Buffer.from(name,'utf8'),data=Buffer.isBuffer(value)?value:Buffer.from(String(value)),crc=crc32(data),method=deflate?8:0,body=deflate?zlib.deflateRawSync(data):data;
    const local=Buffer.alloc(30+n.length);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);n.copy(local,30);
    locals.push(local,body);
    const central=Buffer.alloc(46+n.length);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);n.copy(central,46);centrals.push(central);
    offset+=local.length+body.length;
  }
  const central=Buffer.concat(centrals),count=Object.keys(files).length,eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(count,8);eocd.writeUInt16LE(count,10);eocd.writeUInt32LE(central.length,12);eocd.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,central,eocd]);
}
function makeStoredZip(files){return makeZip(files)}
function makeDeflatedZip(files){return makeZip(files,{deflate:true})}
module.exports={makeZip,makeStoredZip,makeDeflatedZip};
