/* Verified public office addresses. No fabricated coordinates or entrance points.
 * Additional offices may be added to data/verified-offices.json after source review.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviVerifiedOffices=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=s=>String(s||'').normalize('NFKC').toLowerCase()
  .replace(/株式会社|有限会社|合同会社|㈱|（株）/g,'')
  .replace(/[\s\u3000・･、，,.．()（）\-‐‑‒–—―ー－]/g,'');
 function rank(rows,query){
  const q=clean(query);
  if(q.length<2)return [];
  const tokens=String(query||'').normalize('NFKC').trim().split(/[\s\u3000,、]+/).map(clean).filter(Boolean);
  const matches=[];
  for(const row of Array.isArray(rows)?rows:[]){
   if(!row||!row.name||!row.address||!/^https:\/\//.test(row.sourceUrl||''))continue;
   const name=clean(row.name),company=clean(row.company),branch=clean(row.branch),address=clean(row.address);
   const full=company+branch+address;
   const matchesAll=tokens.every(t=>name.includes(t)||company.includes(t)||branch.includes(t)||address.includes(t)||full.includes(t));
   if(!matchesAll)continue;
   let score=0;
   if(q===name||q===company||q===company+branch)score=150;
   else if(name.includes(q))score=120;
   else if(tokens.every(t=>name.includes(t)||address.includes(t)))score=90;
   else score=65;
   matches.push({...row,score,precision:'address-unresolved'});
  }
  return matches.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ja')).slice(0,12);
 }
 return Object.freeze({clean,rank});
});
