(() => {
 const params=new URLSearchParams(location.hash.slice(1));const token=params.get('forum-email');
 history.replaceState(null,'',location.pathname);
 const confirm=document.getElementById('confirm'),unsubscribe=document.getElementById('unsubscribe'),status=document.getElementById('status');
 if(!token||! /^[a-f0-9]{64}$/.test(token)||[...params.keys()].length!==1){status.textContent='This link is invalid. Request a new subscription from the forum.';return;}
 confirm.disabled=false;unsubscribe.disabled=false;status.textContent='Choose an action above. Opening this page does not change your subscription.';
 async function update(action){
  confirm.disabled=true;unsubscribe.disabled=true;status.textContent='Updating subscription…';
  try{
   const response=await fetch('/api/forum-subscriptions',{method:'POST',referrerPolicy:'no-referrer',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify({action,token})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to update your subscription.');
   status.textContent=data.status==='subscribed'?'Subscribed. You’ll receive a daily digest when there are new discussions.':'Unsubscribed. Future digests are stopped; an email already being sent may still arrive.';
   if(data.status==='subscribed')unsubscribe.disabled=false;
  }catch(e){status.textContent=e.message||'Unable to update your subscription. Try again.';confirm.disabled=false;unsubscribe.disabled=false;}
 }
 confirm.addEventListener('click',()=>void update('confirm'));unsubscribe.addEventListener('click',()=>void update('unsubscribe'));
})();
