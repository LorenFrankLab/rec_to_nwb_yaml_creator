// Read-only corpus audit. Counts variation, not correctness or confirmed biological change.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');
const roots = ['collected_metadata_yamls','all_rat_metadata_yaml','trodes_to_nwb_test_data'];
function walk(p) { return fs.readdirSync(p,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(p,e.name)) : /\.ya?ml$/i.test(e.name) ? [path.join(p,e.name)] : []); }
function canon(x) { return JSON.stringify(x, (_,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v); }
const results = [];
for (const name of roots) {
  const files = walk(`/Users/edeno/Downloads/${name}`), seen = new Set(), records = [], errors = [], other = [];
  for (const file of files) {
    const raw = fs.readFileSync(file,'utf8');
    try {
      const doc = YAML.parseDocument(raw);
      if (doc.errors.length) throw doc.errors[0];
      const data = doc.toJS();
      if (!data?.subject?.subject_id) {other.push(file);continue;}
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      if (seen.has(hash)) continue;
      seen.add(hash);
      const token = path.basename(file).match(/(20\d{2})([01]\d)([0-3]\d)/);
      if (!token) continue;
      records.push({file, date:`${token[1]}-${token[2]}-${token[3]}`, id:String(data.subject.subject_id), data});
    } catch(e) {errors.push({file,error:e.message.split('\n')[0]});}
  }
  const groups = new Map();
  for (const r of records) { if(!groups.has(r.id)) groups.set(r.id,[]); groups.get(r.id).push(r); }
  const multi = [...groups].filter(([,rs])=>new Set(rs.map(r=>r.date)).size>1);
  const fields = {
    weight:d=>d.subject.weight, dob:d=>d.subject.date_of_birth, genotype:d=>d.subject.genotype,
    experimenters:d=>d.experimenter_name, experiment_description:d=>d.experiment_description,
    task_names:d=>d.tasks?.map?.(t=>t.task_name), task_environment:d=>d.tasks?.map?.(t=>[t.task_name,t.task_environment]),
    cameras:d=>d.cameras, calibration:d=>d.cameras?.map?.(c=>[c.camera_name,c.meters_per_pixel]),
    bad_channels:d=>d.ntrode_electrode_group_channel_map?.map?.(m=>[m.ntrode_id,m.bad_channels]),
    electrode_locations:d=>d.electrode_groups?.map?.(g=>[g.id,g.location,g.targeted_location,g.targeted_x,g.targeted_y,g.targeted_z]),
    behavioral_events:d=>d.behavioral_events, associated_files:d=>d.associated_files
  };
  const variation = Object.fromEntries(Object.entries(fields).map(([f,get])=>{
    const varying = multi.filter(([,rs])=>new Set(rs.map(r=>canon(get(r.data)))).size>1);
    return [f,{animals:varying.length,examples:varying.slice(0,6).map(([id])=>id)}];
  }));
  const calibrationConflicts=[];
  for(const [id,rs] of multi) {
    const cameras=new Map();
    for(const r of rs) for(const c of Array.isArray(r.data.cameras)?r.data.cameras:[]) {
      if(!c?.camera_name)continue;
      if(!cameras.has(c.camera_name)) cameras.set(c.camera_name,[]);
      cameras.get(c.camera_name).push({date:r.date,file:r.file,mpp:c.meters_per_pixel});
    }
    for(const [camera,values] of cameras) if(new Set(values.map(v=>v.mpp)).size>1) calibrationConflicts.push({id,camera,values:values.filter((v,i,a)=>a.findIndex(x=>x.mpp===v.mpp)===i)});
  }
  results.push({name,totalYamlFiles:files.length,parseErrors:errors,nonSessionFiles:other.length,uniqueContentSessionFiles:seen.size,datedUniqueContentSessionFiles:records.length,subjectIds:groups.size,multidaySubjectIds:multi.length,variation,calibrationConflicts});
}
fs.writeFileSync(path.join(__dirname,'corpus.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({parseErrors,calibrationConflicts,...r})=>({...r,parseErrors:parseErrors.length,calibrationConflicts:calibrationConflicts.length})),null,2));
