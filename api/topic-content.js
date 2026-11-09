import { db } from "hatchable";
export const access = "public";
export const methods = ["GET","POST"];
export default async function(req,res){
  const slug=String(req.query.slug||req.body?.slug||"").trim();
  if(!slug)return res.status(400).json({error:"Topic slug is required"});
  if(req.method==="GET"){
    const {rows}=await db.query("SELECT slug,title,description,content FROM topics WHERE slug=$1",[slug]);
    if(!rows.length)return res.status(404).json({error:"Topic not found"});
    return res.json({topic:rows[0]});
  }
  const user=req.user;
  if(!user)return res.status(401).json({error:"Please sign in to edit topic resources"});
  const body=req.body||{};
  const payload={
    theory:String(body.theory||"").slice(0,30000),
    reference_url:String(body.reference_url||"").slice(0,2000),
    reference_label:String(body.reference_label||"Reference guide").slice(0,120),
    youtube_url:String(body.youtube_url||"").slice(0,2000),
    youtube_label:String(body.youtube_label||"Video lesson").slice(0,120)
  };
  const {rows}=await db.query("UPDATE topics SET content=COALESCE(content,'{}'::jsonb) || $2::jsonb WHERE slug=$1 RETURNING slug,title,description,content",[slug,JSON.stringify(payload)]);
  if(!rows.length)return res.status(404).json({error:"Topic not found"});
  return res.json({topic:rows[0]});
}