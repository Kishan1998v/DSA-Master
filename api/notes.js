import { db } from "hatchable";
export const access = "user";
export const methods = ["GET","POST"];
export default async function(req,res){
  const u=req.user;
  if(req.method==="GET"){
    const {rows}=await db.query("SELECT n.*,t.title AS topic_title FROM notes n LEFT JOIN topics t ON t.slug=n.topic_slug WHERE n.user_id=$1 ORDER BY n.updated_at DESC",[u.id]);
    return res.json({notes:rows});
  }
  const b=req.body||{};
  const title=String(b.title||"").trim();
  if(!title)return res.status(400).json({error:"Note title required"});
  const body=String(b.body||"");
  if(b.note_id){
    const {rows}=await db.query("UPDATE notes SET title=$2,body=$3,topic_slug=$4,updated_at=NOW() WHERE id=$5 AND user_id=$1 RETURNING *",[u.id,title,body,b.topic_slug||null,b.note_id]);
    if(!rows.length)return res.status(404).json({error:"Note not found"});
    return res.json({note:rows[0]});
  }
  const {rows}=await db.query("INSERT INTO notes(user_id,title,body,topic_slug) VALUES($1,$2,$3,$4) RETURNING *",[u.id,title,body,b.topic_slug||null]);
  res.status(201).json({note:rows[0]});
}