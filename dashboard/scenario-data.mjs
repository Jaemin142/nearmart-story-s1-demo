import { readFile } from 'node:fs/promises';

const snapshot = 'dashboard_v1/';
const metrics = ['active_sites','request','completed','ontime','unprocessed','operating_expenses','late','blocked_dongs'];
const money = ['npv_krw','peak_funding_krw','ebitda_2031_krw','first_breach_year'];
const resources = ['picker_roster','picker_legal_max','rider_roster','peak_active_riders','bike_bays','full_service_picker_floor_fail_cells','shift_overruns'];
export const submissions = ['T1_network_plan.csv','T2_dong_assignment.csv','T3_benchmark_dispatch.csv','T4_kpi_summary.csv'];
const submissionRoot = new URL('../outputs/NearMart_최종검토/조건부_T1-T4/',import.meta.url);
export function readSubmission(name) {
  if (!submissions.includes(name)) return null;
  return readFile(new URL(name,submissionRoot));
}
const projectFields = (row,fields,number) => Object.fromEntries(fields.map(field=>[field,number(row,field)]));
const operatingAccounts = ['cogs','payment','packaging','shrink','ongoing_marketing','customer_it','late_coupon',
  'external_quick','picker','employed_wage','employed_incentive','employed_vehicle','contract_pay',
  'rent','maintenance','hub_staff','utilities','replenish','hq','launch_marketing','restoration'];
const capitalAccounts = ['open_capex','refresh_capex','deposit_paid','deposit_recovered','inventory_increment','inventory_release','inventory_recovery'];
const revenueAccounts = ['goods_revenue','delivery_fee'];
const payFields = ['picker_roster','rider_roster','picker_paid_hours','employed_paid_hours','employed_paid_orders','contract_base_value_krw_2027'];
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<.05;

export function createScenarioReader({read,csv,digest,number,runId}) {
  let catalogPromise;
  async function verified(manifest,name) {
    const bytes = await read(name);
    if (digest(bytes) !== manifest.output_hashes?.[name]) throw new Error('Scenario output hash mismatch: '+name);
    return bytes;
  }
  async function readCatalog() {
    const manifest = JSON.parse(await read('run_manifest.json'));
    if (manifest.run_id !== runId || manifest.official_result !== false ||
        manifest.status !== 'CONDITIONAL_COMPARISON_VERIFIED') throw new Error('Scenario run mismatch');
    const paths = [snapshot+'scenario_summary.csv',snapshot+'annual_network.csv',snapshot+'evidence_direct_des.csv',
      'redesign_transfers.csv','independent_validation.json',snapshot+'snapshot_manifest.json','execution_manifest.json'];
    const [summary,annual,des,transfers,audit,metadata,execution] = await Promise.all(paths.map(path=>verified(manifest,path)));
    const auditRecord = JSON.parse(audit);
    const meta = JSON.parse(metadata);
    const contract = JSON.parse(execution);
    if (auditRecord.counts.FAIL || meta.run_id !== runId || meta.full_seoul !== false) throw new Error('Scenario validation mismatch');
    const cases = csv(summary).filter(row=>row.run_id===runId&&row.status==='CONDITIONAL_ESTIMATE').map(row=>({
      id:row.scenario_id, network:row.network_id, market:row.market, ramp:row.ramp_curve, weather:row.weather_id,
      shock:row.shock, assumption:row.assumption_version, ...projectFields(row,money,number),
      funding:row.funding_limit_pass === 'False' ? false : row.funding_limit_pass === 'True' ? true : null,
      ebitdaTarget:row.ebitda_target_met === 'False' ? false : row.ebitda_target_met === 'True' ? true : null, annual:{}
    }));
    const index = new Map(cases.map(item=>[item.id,item]));
    for (const row of csv(annual)) {
      const item = index.get(row.scenario_id);
      if (row.run_id !== runId || !item || row.assumption_version !== item.assumption ||
          Object.hasOwn(item.annual,row.year)) throw new Error('Scenario annual key mismatch');
      item.annual[row.year] = {...projectFields(row,metrics,number), service:row.service_status};
    }
    const files = await Promise.allSettled(submissions.map(readSubmission));
    const catalog = {
      runId,cases,validation:auditRecord.counts,checks:auditRecord.checks,
      des:csv(des),transfers:csv(transfers),paths,
      submissions:submissions.filter((_,i)=>files[i].status==='fulfilled'),
      official:false,cashRule:meta.calendar_cash_rule,model:contract.operating_model,financeRule:contract.common_cash_rules
    };
    return {manifest,catalog,index};
  }
  const load = () => catalogPromise ??= readCatalog().catch(error=>{ catalogPromise=null; throw error; });
  return {
    async catalog() { return (await load()).catalog; },
    async finance(id) {
      const {manifest,index} = await load();
      const item=index.get(id);
      if (!item) return null;
      const paths=['annual_finance.csv','ledger.csv','annual_site.csv','finance_result.json','site_events.csv'].map(name=>id+'/'+name);
      const [annual,ledger,sites,result,events]=await Promise.all(paths.map(path=>verified(manifest,path)));
      const source=JSON.parse(result);
      const years=Object.fromEntries(csv(annual).map(row=>[row.year,{
        ...projectFields(row,['revenue','operating_expenses','ebitda','depreciation','tax','cash','cumulative_cash','fulfillment_cost_krw'],number),
        accounts:{}, paid:{}, staffing:[]
      }]));
      const accounts=new Set([...operatingAccounts,...capitalAccounts,...revenueAccounts]);
      const payment={};
      for (const row of csv(ledger)) {
        const y=years[row.year], amount=number(row,'amount_krw');
        if (!y||!accounts.has(row.account)||row.unit!=='KRW'||amount==null||amount<0) throw new Error('Invalid finance ledger row');
        y.accounts[row.account]=(y.accounts[row.account]??0)+amount;
        if (capitalAccounts.includes(row.account)) {
          const cashYear=Number(row.year)-Number(['open_capex','deposit_paid'].includes(row.account));
          const values=payment[cashYear]??={};
          values[row.account]=(values[row.account]??0)+amount;
        }
        if (['picker','employed_wage','employed_incentive','employed_vehicle','contract_pay'].includes(row.account)) {
          const pay=y.paid[row.site_instance]??={};
          pay[row.account]=(pay[row.account]??0)+amount;
        }
      }
      for (const row of csv(sites)) {
        if (!years[row.year]) throw new Error('Finance staffing year mismatch');
        years[row.year].staffing.push({id:row.site_id,instance:row.site_instance,...projectFields(row,payFields,number),
          accounts:years[row.year].paid[row.site_instance]??{}});
      }
      const yearZero=number(source,'year_zero_cash');
      let balance=yearZero, low=Math.min(0,yearZero);
      let first=yearZero < -50e9 ? 2026 : null;
      for (let year=2027;year<=2046;year++) {
        const row=years[year];
        if (!row) throw new Error('Finance year missing');
        const sum=keys=>keys.reduce((total,key)=>total+(row.accounts[key]??0),0);
        const pay=payment[year]??{};
        const movement=['deposit_recovered','inventory_release','inventory_recovery'].reduce((v,k)=>v+(pay[k]??0),0)-
          ['open_capex','refresh_capex','deposit_paid','inventory_increment'].reduce((v,k)=>v+(pay[k]??0),0);
        balance+=row.cash;
        low=Math.min(low,balance);
        if(first==null&&balance < -50e9) first=year;
        if (!close(sum(operatingAccounts),row.operating_expenses)||!close(sum(revenueAccounts),row.revenue)||
            !close(row.revenue-row.operating_expenses,row.ebitda)||!close(row.ebitda-row.tax+movement,row.cash)||
            !close(balance,row.cumulative_cash)||!close(row.cash,number(source.years?.[year]??{},'cash'))) throw new Error('Finance reconciliation failed: '+year);
        delete row.paid;
      }
      if (!close(-low,item.peak_funding_krw)||!close(number(source,'conditional_npv_krw'),item.npv_krw)||
          !close(years[2031].ebitda,item.ebitda_2031_krw)||first!==item.first_breach_year||
          (-low<=50e9)!==item.funding||(years[2031].ebitda>0)!==item.ebitdaTarget) throw new Error('Finance summary mismatch');
      return {id,runId,years,yearZero,payment,events:csv(events),paths,rule:'APPENDIX_B_2026_T0_12PCT',
        discount:12,fundingLimit:50e9,peakYear:number(source,'funding_peak_year'),first};
    },
    async map(id,year) {
      const {manifest,index} = await load();
      const item = index.get(id);
      if (!item || !Object.hasOwn(item.annual,year)) return null;
      const paths = [id+'/annual_dong.csv',id+'/annual_site.csv'];
      const [dongs,sites] = await Promise.all(paths.map(path=>verified(manifest,path)));
      const assignments = {};
      const hubs = {};
      for (const row of csv(dongs)) if (row.year===year) {
        if (Object.hasOwn(assignments,row.adm_cd2)) throw new Error('Duplicate scenario district');
        assignments[row.adm_cd2] = {site:row.site_id||null,blocked:row.input_status==='BLOCKED_SOURCE_NULL',
          ...projectFields(row,['mature_potential','request','completed','unprocessed','model_response_factor'],number)};
      }
      for (const row of csv(sites)) if (row.year===year) {
        if (Object.hasOwn(hubs,row.site_id)) throw new Error('Duplicate scenario hub');
        hubs[row.site_id] = projectFields(row,[...resources,'request','completed','unprocessed'],number);
      }
      if (Object.keys(assignments).length!==427 || Object.keys(hubs).length!==item.annual[year].active_sites ||
          Object.values(assignments).filter(row=>row.blocked).length!==item.annual[year].blocked_dongs ||
          Object.values(assignments).some(row=>row.site && !Object.hasOwn(hubs,row.site))) throw new Error('Scenario map does not reconcile');
      return {id,year,assignments,hubs,paths};
    }
  };
}
