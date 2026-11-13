// Display-only adapter for the saved story_v1 S1 design. No source calculation is rerun.
export const storyId='STORY_S1';
export const storyActive=version=>version==='cplus'&&new URLSearchParams(location.search).get('story')!=='off';
const num=value=>value==null||value===''?null:Number(value);
const eok=value=>num(value)==null?null:num(value)*1e8;
const sum=rows=>rows.reduce((total,row)=>total+(num(row.expected_orders_per_day)??0),0);
export async function loadStory(){
 const response=await fetch('/api/story-s1');
 if(!response.ok)throw Error('Story v1 S1 adapter unavailable');
 const story=await response.json();
 if(story.version!=='story_v1'||story.plan.length!==31||story.assignment.length!==2135||story.finance.length!==21||story.summary.certainty_pass!=='False')throw Error('Story v1 S1 adapter invalid');
 return story;
}
export function storyDashboard(base,story){
 const years=[2027,2031,2036,2041,2046];
 const plan=new Map(story.plan.map(row=>[row.site_id,row]));
 const sites=base.sites.map(site=>({...site,year:num(plan.get(site.id)?.open_year)??site.year,sourceStatus:plan.has(site.id)?'STORY_PLAN':'CANDIDATE'}));
 if(story.plan.some(row=>!sites.some(site=>site.id===row.site_id)))throw Error('S1 site ID mismatch');
 const annual={};
 for(const year of years){
  const rows=story.assignment.filter(row=>Number(row.year)===year);
  if(rows.length!==427||new Set(rows.map(row=>row.adm_cd2)).size!==427)throw Error('S1 427-dong assignment mismatch');
  const active=story.plan.filter(row=>Number(row.open_year)<=year&&(!row.close_year||Number(row.close_year)>=year));
  const dongs=Object.fromEntries(rows.map(row=>[row.adm_cd2,{site:row.site_id==='UNSERVED'?null:row.site_id,blocked:false,
   inputStatus:row.site_id==='UNSERVED'?'UNSERVED':'ASSIGNED',request:num(row.expected_orders_per_day),completed:null,unprocessed:null,
   deliveryMin:num(row.avg_delivery_min),lateRate:null}]));
  const operating=Object.fromEntries(active.map(row=>{
   const assigned=rows.filter(item=>item.site_id===row.site_id);
   return [row.site_id,{hubType:row.hub_type,instance:row.site_id,resource:'S1 설계 배정 · 운영 DES 미검증',picker:null,riders:null,
    assignedDongs:assigned.length,request:sum(assigned),completed:null,ontime:null,unprocessed:null,share:sum(rows)?sum(assigned)/sum(rows):null}];
  }));
  annual[year]={model_requests:sum(rows),model_completed:null,model_ontime_over_completed:null,active:active.length,
   assignedDongs:rows.filter(row=>row.site_id!=='UNSERVED').length,sites:operating,dongs,assignmentConnected:true,operationConnected:false};
 }
 return {...base,years,sites,result:{runId:'story_v1 / S1',scenario:'S1 수익형',annual,validation:{PASS:0,FAIL:0,BLOCKED:1},
  sources:[story.paths.plan,story.paths.assignment,story.paths.t4,story.paths.finance,story.paths.comparison,story.paths.robustness],
  npv:eok(story.summary.npv_eok),fundingPass:true,model:'S1 설계 추정 · T1 계획 31곳 · T2 427동 저장 배정'},
  errors:[],sourceVersion:'story_s1',sourceLabel:story.sourceLabel,sourceFiles:story.paths,
  storySummary:story.summary,storyLow:story.low,storyHashes:story.sha256,officialAnnual:null,officialStatus:'BLOCKED_ANNUAL'};
}
export function storyCase(story){
 const s=story.summary;
 return {id:storyId,version:'story_s1',network:'S1 수익형 · 설계 추정',market:'S1 base',ramp:'T1/T2 계획',weather:'미연결',shock:'NONE',assumption:'story_v1',
  npv_krw:eok(s.npv_eok),peak_funding_krw:eok(s.peak_funding_eok),ebitda_2031_krw:eok(s.ebitda_2031_eok),
  funding:num(s.peak_funding_eok)<=500,ebitdaTarget:num(s.ebitda_2031_eok)>0};
}
export function storyFinance(story){
 const years={};
 for(const row of story.finance){
  if(Number(row.year)===2026)continue;
  const revenue=eok(row.revenue_eok),ebitda=eok(row.ebitda_eok);
  years[row.year]={revenue,operating_expenses:revenue-ebitda,ebitda,cash:eok(row.net_cashflow_eok),
   cumulative_cash:eok(row.cum_cashflow_eok),depreciation:null,tax:null,
   accounts:{},staffing:[],
   storyCosts:{rider:eok(row.rider_cost_eok),picker:eok(row.picker_cost_eok),hub:eok(row.hub_fixed_eok),hq:eok(row.hq_eok)}};
 }
 const yearZero=eok(story.finance[0].net_cashflow_eok);
 return {id:storyId,runId:'story_v1 / S1',years,yearZero,payment:null,events:[],
  paths:[story.paths.finance,story.paths.comparison,story.paths.robustness,story.paths.t4],
  rule:'STORY_S1_2026_T0_12PCT',discount:12,fundingLimit:50e9,peakYear:2027,first:null,
  submissionMode:true,sourceVersion:'story_s1',peakFunding:eok(story.summary.peak_funding_eok)};
}
