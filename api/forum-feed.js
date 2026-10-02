import {forumFeed} from '../server/forum-feed.mjs';
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{return res.status(200).json({items:await forumFeed(),generatedAt:Date.now()});}
 catch{return res.status(503).json({error:'Forum updates are temporarily unavailable.'});}
}
