import { db, storage } from "hatchable";
import crypto from "node:crypto";

export const access = "user";
export const methods = ["GET","POST","DELETE"];
const MAX_BYTES = 25 * 1024 * 1024;

export default async function(req,res){
  const user=req.user;
  if(!user)return res.status(401).json({error:"Please sign in to manage PDFs"});
  if(req.method==="GET"){
    const slug=String(req.query?.slug||"").trim();
    if(!slug)return res.status(400).json({error:"Topic slug is required"});
    const {rows}=await db.query("SELECT id,file_name,storage_key,bytes,created_at FROM topic_pdfs WHERE user_id=$1 AND topic_slug=$2 ORDER BY created_at DESC",[user.id,slug]);
    const files=await Promise.all(rows.map(async row=>({id:row.id,file_name:row.file_name,bytes:Number(row.bytes),created_at:row.created_at,url:await storage.url(row.storage_key)})));
    return res.json({files});
  }
  if(req.method==="DELETE"){
    const id=String(req.body?.id||"").trim();
    if(!id)return res.status(400).json({error:"PDF id is required"});
    const {rows}=await db.query("DELETE FROM topic_pdfs WHERE id=$1 AND user_id=$2 RETURNING storage_key",[id,user.id]);
    if(!rows.length)return res.status(404).json({error:"PDF not found"});
    await storage.del(rows[0].storage_key);
    return res.json({deleted:true});
  }
  const slug=String(req.body?.topic_slug||"").trim();
  if(!slug)return res.status(400).json({error:"Topic is required"});
  const topic=await db.query("SELECT slug FROM topics WHERE slug=$1",[slug]);
  if(!topic.rows.length)return res.status(404).json({error:"Topic not found"});
  const file=(req.files||[]).find(f=>f.field==="file");
  if(!file)return res.status(400).json({error:"Choose a PDF file"});
  const raw=file.buffer;
  let fileBuffer;
  if(Buffer.isBuffer(raw)) fileBuffer=raw;
  else if(raw instanceof ArrayBuffer) fileBuffer=Buffer.from(raw);
  else if(ArrayBuffer.isView(raw)) fileBuffer=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength);
  else if(raw && raw.type==="Buffer" && Array.isArray(raw.data)) fileBuffer=Buffer.from(raw.data);
  else if(Array.isArray(raw)) fileBuffer=Buffer.from(raw);
  else if(typeof raw==="string") { const prefix="data:application/pdf;base64,"; fileBuffer=Buffer.from(raw.startsWith(prefix)?raw.slice(prefix.length):raw,"base64"); }
  else fileBuffer=Buffer.alloc(0);
  if(fileBuffer.length>MAX_BYTES)return res.status(413).json({error:"PDF is too large. Maximum size is 25 MB."});
  const headerText=fileBuffer.subarray(0,1024).toString("latin1");
  const headerOffset=headerText.indexOf("%PDF-");
  console.log("PDF_UPLOAD_CHECK",JSON.stringify({filename:file.filename,contentType:file.contentType,rawType:raw?.constructor?.name,rawKeys:raw&&typeof raw==="object"?Object.keys(raw).slice(0,8):[],bytes:fileBuffer.length,headerBytes:fileBuffer.subarray(0,24).toString("hex"),headerOffset}));
  if(headerOffset<0)return res.status(415).json({error:"The uploaded file did not arrive as PDF bytes. Try exporting or downloading it as a PDF and upload it again."});
  const safeName=String(file.filename||"document.pdf").replace(/[\\/\\\\]/g,"_").slice(0,180);
  const key="topic-pdfs/"+user.id+"/"+slug+"/"+crypto.randomUUID()+".pdf";
  await storage.put(key,fileBuffer,"application/pdf");
  const {rows}=await db.query("INSERT INTO topic_pdfs(user_id,topic_slug,file_name,storage_key,bytes) VALUES($1,$2,$3,$4,$5) RETURNING id,file_name,bytes,created_at",[user.id,slug,safeName,key,fileBuffer.length]);
  const row=rows[0];
  return res.status(201).json({file:{id:row.id,file_name:row.file_name,bytes:Number(row.bytes),created_at:row.created_at,url:await storage.url(key)}});
}