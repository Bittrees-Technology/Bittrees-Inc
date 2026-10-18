import {useQuery} from '@tanstack/react-query';

type AuthorityAccess = {configured:boolean;permissions:string[];roles?:{label:string}[];expiresAt?:number};

/** Navigation is only a hint. Protected controls keep their existing fresh reads.
 * Both observers share a wallet-scoped query, including mutation invalidation. */
export function useAuthorityAccess(address?:string, purpose:'access'|'navigation'='access') {
  const navigation = purpose === 'navigation';
  return useQuery({
    queryKey:['controller-authority',address?.toLowerCase()],
    enabled:!!address,
    staleTime:navigation ? 60000 : 0,
    refetchInterval:navigation ? 60000 : 5000,
    refetchIntervalInBackground:false,
    refetchOnWindowFocus:'always',
    retry:false,
    queryFn:async({signal})=>{
      const r=await fetch('/api/authority-access?address='+address,{signal});
      if(!r.ok)throw Error('Controller authority unavailable');
      const data = await r.json() as AuthorityAccess;
      // Expired evidence is unavailable, not a new denial. Retain the last
      // navigation hint; protected readers reject the query error. Preserve
      // Gov's explicit pre-enrollment response, which has no expiry field.
      if (data.expiresAt !== undefined && (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now())) {
        throw Error('Controller authority expired. Refresh to check access.');
      }
      return data;
    },
  });
}
