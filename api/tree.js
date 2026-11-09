import { db, auth } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){const user=await auth.getUser(req);const {rows}=await db.query("SELECT slug,title,parent_slug,kind,description,sort_order,content FROM topics ORDER BY sort_order");res.json({nodes:rows,user:user?{email:user.email}:null});}