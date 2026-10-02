import {createSubscriptions,emailReady,cronAuthorized} from '../server/forum-subscriptions.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method==='GET'){
  if(req.query?.dispatch==='daily'){
   if(!cronAuthorized(req.headers.authorization))return res.status(401).json({error:'Unauthorized'});
   if(!emailReady())return res.status(200).json({enabled:false});
   try{return res.status(200).json(await createSubscriptions().deliver());}catch{return res.status(503).json({error:'Delivery could not finish. Existing delivery state was retained.'});}
  }
  return res.status(200).json({emailReady:emailReady()});
 }
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(req.headers.origin && req.headers.origin!=='https://gov.bittrees.org')return res.status(403).json({error:'Use the Governance forum to manage subscriptions.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Use JSON'});
 if(Buffer.byteLength(JSON.stringify(req.body||{}))>2048)return res.status(413).json({error:'Request too large'});
 const {action,email,token}=req.body||{};
 try{
  const service=createSubscriptions();
  if(action==='subscribe'){
   await service.subscribe(email,String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]);
   return res.status(200).json({status:'requested',message:'If this address can receive a new confirmation, check your email. Existing subscriptions remain active.'});
  }
  if(action==='confirm'||action==='unsubscribe')return res.status(200).json(await service.manage(token,action));
  return res.status(400).json({error:'Invalid action'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Email service unavailable. Please try again later.'});}
}
