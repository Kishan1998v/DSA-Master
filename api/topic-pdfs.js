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
  if(file.buffer.length>MAX_BYTES)return res.status(413).json({error:"PDF is too large. Maximum size is 25 MB."});
  const fileBuffer=Buffer.isBuffer(file.buffer)?file.buffer:Buffer.from(file.buffer||[]);
  // Some valid PDFs include a small preamble before the %PDF- header.
  // The PDF header is permitted within the first 1024 bytes.
  const headerOffset=fileBuffer.subarray(0,1024).indexOf(Buffer.from("%PDF-","ascii"));
  if(headerOffset<0)return res.status(415).json({error:"This file does not appear to be a valid PDF. Please choose an actual .pdf file."});
  const safeName=String(file.filename||"document.pdf").replace(/[\\/\\\\]/g,"_").slice(0,180);
  const key="topic-pdfs/"+user.id+"/"+slug+"/"+crypto.randomUUID()+".pdf";
  await storage.put(key,file.buffer,"application/pdf");
  const {rows}=await db.query("INSERT INTO topic_pdfs(user_id,topic_slug,file_name,storage_key,bytes) VALUES($1,$2,$3,$4,$5) RETURNING id,file_name,bytes,created_at",[user.id,slug,safeName,key,file.buffer.length]);
  const row=rows[0];
  return res.status(201).json({file:{id:row.id,file_name:row.file_name,bytes:Number(row.bytes),created_at:row.created_at,url:await storage.url(key)}});
}