import {useQuery,useQueryClient} from '@tanstack/react-query';
export const contributorSessionKey=['contributor-session'];
export async function contributorRequest(body:any,csrf?:string){
 const r=await fetch('/api/contributors',{method:'POST',headers:{'content-type':'application/json',...(csrf?{'x-contributor-csrf':csrf}:{})},body:JSON.stringify(body)});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed.');return result;
}
export function useContributorSession(){
 const client=useQueryClient();
 const query=useQuery({queryKey:contributorSessionKey,staleTime:30000,retry:false,refetchOnWindowFocus:true,queryFn:async({signal})=>{
  const r=await fetch('/api/contributors',{cache:'no-store',signal}),result=await r.json();if(!r.ok)throw Error(result.error||'Contributor sign-in is unavailable.');return result;
 }});
 return {...query,session:query.data?.session,clear:async()=>{await client.cancelQueries({queryKey:contributorSessionKey});client.setQueryData(contributorSessionKey,{configured:true,session:null});}};
}
