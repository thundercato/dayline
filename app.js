
'use strict';
const KEY='dayline-v2',OLD_KEY='dayline-v1';
const CATS={
 work:{label:'🎯 Focus / work',art:'focus'},break:{label:'☕ Break',art:'break'},
 meditation:{label:'🧘 Meditation',art:'meditation'},lunch:{label:'🥗 Lunch',art:'break'},
 gym:{label:'🏋️ Gym / exercise',art:'evening'},personal:{label:'🏡 Personal / evening',art:'evening'},
 free:{label:'🌿 Free time',art:'break'},out:{label:'🌴 Out of office',art:'break'},other:{label:'📌 Other',art:'focus'}
};
const SOUNDS={none:'Silent',chime:'Gentle chime',double:'Double bell',soft:'Soft ping',glass:'Glass notes',marimba:'Marimba',digital:'Digital beep',retro:'Retro 8-bit',birds:'Birdsong',wood:'Woodblock'};
const rawWork=[
 ['08:00','08:35','🗂️ Morning planning','Review priorities, emails and outstanding tasks','work'],
 ['08:35','08:45','🧘 Morning meditation','10-minute focus meditation','meditation'],
 ['08:45','10:15','🎯 Focus block 1','Most demanding task of the day','work'],
 ['10:15','10:30','☕ Morning break','15 minutes to relax or check your phone','break'],
 ['10:30','12:30','💻 Focus block 2','Project work and analysis','work'],
 ['12:30','13:00','🥪 Lunch','30 minutes away from your desk','lunch'],
 ['13:00','14:45','📋 Focus block 3','Emails, meetings and follow-ups','work'],
 ['14:45','14:55','🧘 Afternoon meditation','10-minute breath meditation','meditation'],
 ['14:55','15:10','☕ Afternoon break','15-minute reset','break'],
 ['15:10','16:15','🎯 Focus block 4','Finish priority work and outstanding actions','work'],
 ['16:15','16:30','✅ Shutdown routine','Update task list and prepare for tomorrow','work']
];
const extras=[
 ['16:45','17:30','🏋️ Gym','45-minute session','gym'],
 ['17:45','18:30','🍜 Chicken chow mein','Cook, eat and tidy','personal'],
 ['18:30','19:00','🚿 Free time','Relax and get ready for Colin','free'],
 ['19:00','21:00','👥 Colin visiting','Evening with Colin','personal']
];
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const rand=()=>Math.random().toString(36).slice(2,10);
const localDate=(dt=new Date())=>dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
const fromDate=d=>new Date(d+'T12:00:00');
const addDays=(d,n)=>{const x=fromDate(d);x.setDate(x.getDate()+n);return localDate(x)};
const weekStart=d=>{let x=fromDate(d);x.setDate(x.getDate()-(x.getDay()+6)%7);return localDate(x)};
const dow=d=>fromDate(d).getDay();
const mins=t=>{const a=t.split(':').map(Number);return a[0]*60+a[1]};
const sortList=l=>l.slice().sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
const copy=l=>l.map(x=>({...x}));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typedList=a=>a.map((x,i)=>({id:rand(),start:x[0],end:x[1],name:x[2],desc:x[3],category:x[4],sound:'inherit'}));
function inferCategory(name){
 let v=(name||'').toLowerCase();
 if(v.includes('meditat'))return 'meditation';
 if(v.includes('lunch')||v.includes('🥪'))return 'lunch';
 if(v.includes('break')||v.includes('☕'))return 'break';
 if(v.includes('gym')||v.includes('exercise'))return 'gym';
 if(v.includes('out of office')||v.includes('friday off'))return 'out';
 if(v.includes('free time'))return 'free';
 if(v.includes('colin')||v.includes('chow mein')||v.includes('dinner')||v.includes('evening'))return 'personal';
 return 'work';
}
function normaliseItem(x){
 return {id:String(x.id||rand()),start:String(x.start||'09:00'),end:String(x.end||'09:30'),name:String(x.name||'Untitled activity'),
 desc:String(x.desc||''),category:CATS[x.category]?x.category:inferCategory(x.name),sound:SOUNDS[x.sound]||x.sound==='inherit'?x.sound:'inherit'};
}
function validTime(t){return /^([01]\d|2[0-3]):[0-5]\d$/.test(t)}
function cleanList(l){return Array.isArray(l)?l.filter(x=>x&&validTime(x.start)&&validTime(x.end)&&mins(x.end)>mins(x.start)).map(normaliseItem):[]}
function defaultModel(){
 let old=null;try{old=JSON.parse(localStorage.getItem(OLD_KEY)||'null')}catch{}
 let overrides={};
 if(old&&typeof old==='object'&&!Array.isArray(old)){
  for(let [day,items] of Object.entries(old))if(/^\d{4}-\d\d-\d\d$/.test(day)&&Array.isArray(items))overrides[day]=cleanList(items);
 }else overrides['2026-11-09']=typedList(rawWork.concat(extras));
 return {version:2,offFridayAnchor:'2026-11-13',templates:{
 workday:typedList(rawWork),off:typedList([['08:00','16:30','🌴 Out of office','Alternating Friday off','out']])},
 overrides,settings:{soundEnabled:false,visualWarning:true,minuteSound:false,desktop:false,artOpacity:42,
 soundDefault:'chime',typeSounds:{work:'soft',break:'double',meditation:'glass',lunch:'marimba',gym:'retro',personal:'chime',free:'soft',out:'none',other:'chime'}}};
}
function load(){
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'null');
  if(v&&v.version===2&&v.templates&&Array.isArray(v.templates.workday)&&Array.isArray(v.templates.off)&&v.overrides&&v.settings){
   v.templates.workday=cleanList(v.templates.workday);v.templates.off=cleanList(v.templates.off);
   for(let k of Object.keys(v.overrides))v.overrides[k]=cleanList(v.overrides[k]);
   return v;
  }
 }catch(e){console.warn('Dayline backup could not be read',e)}
 return defaultModel();
}
let model=load(),selected=localDate(),activeTab='day',editScope='day',editing=null,audioCtx=null,lastRealtimeId=undefined,lastRealtimeDate='',warnedKey='';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(model))}catch(e){toast('Storage unavailable: export your rota as a backup')}}
persist();
function isOffFriday(day){
 if(dow(day)!==5)return false;
 let a=model.offFridayAnchor||'2026-11-13',p=day.split('-').map(Number),q=a.split('-').map(Number);
 let delta=Math.round((Date.UTC(p[0],p[1]-1,p[2])-Date.UTC(q[0],q[1]-1,q[2]))/86400000);
 return ((delta%14)+14)%14===0;
}
function templateKey(day){const d=dow(day);return d===0||d===6?null:(d===5&&isOffFriday(day)?'off':'workday')}
function schedule(day){if(Object.prototype.hasOwnProperty.call(model.overrides,day))return sortList(cleanList(model.overrides[day]));let key=templateKey(day);return key?sortList(cleanList(model.templates[key])):[]}
function currentScopeList(){return editScope==='day'?schedule(selected):sortList(cleanList(model.templates[editScope]||[]))}
function writeList(list){
 if(editScope==='day')model.overrides[selected]=copy(list);
 else model.templates[editScope]=copy(list);
 persist();render();drawPanel();
}
function timeDisplay(seconds){
 let n=Math.max(0,Math.floor(seconds));
 if(n>=3600)return Math.floor(n/3600)+':'+pad(Math.floor(n%3600/60))+':'+pad(n%60);
 return pad(Math.floor(n/60))+':'+pad(n%60);
}
function toast(msg){
 let old=$('toast');if(old)old.remove();
 let x=document.createElement('div');x.id='toast';x.className='toast';x.textContent=msg;document.body.appendChild(x);
 setTimeout(()=>{if(x.isConnected)x.remove()},3300);
}
function setVisualSettings(){
 document.documentElement.style.setProperty('--art-opacity',Math.max(0,Math.min(1,(Number(model.settings.artOpacity)||0)/100)));
}
function dateText(day){return fromDate(day).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function renderDays(){
 let monday=weekStart(selected),s='';
 for(let i=0;i<7;i++){let d=addDays(monday,i),off=isOffFriday(d),isToday=d===localDate();
 s+='<button class="day'+(d===selected?' selected':'')+(isToday?' today':'')+'" data-day="'+d+'" title="'+dateText(d)+(off?' (out of office)':'')+'">'+fromDate(d).toLocaleDateString('en-GB',{weekday:'short'})+'<span class="num">'+fromDate(d).getDate()+'</span></button>'}
 $('days').innerHTML=s;
 $('days').querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.day;render()}));
}
function stateAt(day,now){
 const arr=schedule(day),t=now.getHours()*3600+now.getMinutes()*60+now.getSeconds(),n=t/60,isToday=day===localDate(now);
 let active=isToday?arr.find(x=>mins(x.start)*60<=t&&t<mins(x.end)*60):null;
 let next=isToday?arr.find(x=>mins(x.start)*60>t):arr[0];
 let previous=isToday?arr.filter(x=>mins(x.end)*60<=t):[];
 return {arr,t,n,isToday,active,next,previous};
}
function drawHero(s){
 let {arr,t,isToday,active,next,previous}=s,hero=$('hero'),remaining=0,title='',desc='',status='',label='',range='',pct=0;
 if(active){
  remaining=mins(active.end)*60-t;
  title=active.name;desc=active.desc;status=active.category==='out'?'OUT OF OFFICE':'RIGHT NOW';
  range=active.start+' – '+active.end;label='remaining in this activity';
  pct=Math.max(0,Math.min(100,(t-mins(active.start)*60)/((mins(active.end)-mins(active.start))*60)*100));
 }else if(!arr.length){
  title=isToday?'Your day is clear':'Nothing scheduled';status='A BREATHING SPACE';
  desc=dow(selected)===0||dow(selected)===6?'Enjoy your weekend':'No activities planned for this date';
  label='';range='';remaining=-1;
 }else if(isToday){
  if(next){
   remaining=mins(next.start)*60-t;
   title=previous.length?'Free until next activity':'Your day is about to begin';
   status='BETWEEN ACTIVITIES';label='until next activity';desc='Take a breath. Your next block is coming up.';
  }else{
   title='All done for today';status='DAY COMPLETE';desc='Your scheduled activities have finished';remaining=-1;
  }
 }else{
  title=isOffFriday(selected)?'Out-of-office Friday':'Your scheduled day';
  status='DAY PREVIEW';desc='Select today for the live countdown';remaining=-1;range=arr.length+' activities';
 }
 const category=active?active.category:next?next.category:(isOffFriday(selected)?'out':'free');
 const art=CATS[category]?.art||'focus';
 $('heroArt').style.backgroundImage='url("assets/'+art+'.svg")';
 $('statusText').textContent=status;
 $('currentTitle').textContent=title;
 $('currentDesc').textContent=desc;
 $('range').textContent=range;
 $('range').hidden=!range;
 $('countdown').textContent=remaining>=0?timeDisplay(remaining):'';
 $('countdown').style.display=remaining<0?'none':'block';
 $('countLabel').textContent=label;
 $('progress').style.width=pct+'%';
 $('nextName').textContent=next?next.name:'No more activities';
 $('nextTime').textContent=next?next.start:'';
 hero.classList.toggle('closing',Boolean(isToday&&active&&remaining<=60&&remaining>0&&model.settings.visualWarning));
 if(isToday&&active&&remaining<=60&&remaining>0){
  $('statusText').textContent='CHANGING IN '+timeDisplay(remaining);
 }
 $('topDate').textContent=dateText(selected)+(isOffFriday(selected)?' · Friday off':'');
 let done=isToday?previous.length:0;
 $('dayStats').textContent=arr.length?(isToday?done+' of '+arr.length+' blocks completed':arr.length+' scheduled blocks'):'No scheduled blocks';
 $('liveFlag').textContent=isToday?'● LIVE':'DAY PREVIEW';
 const upcoming=arr.filter(x=>isToday?mins(x.start)*60>t:true).slice(0,3);
 $('ahead').innerHTML=upcoming.length?upcoming.map(x=>'<div class="up-item"><div class="up-time">'+esc(x.start)+'–'+esc(x.end)+'</div><div class="up-name">'+esc(x.name)+'</div></div>').join(''):'<div class="up-item" style="grid-column:1/-1"><div class="up-name">'+(arr.length?'Nothing else scheduled':'Add activities using the settings cog')+'</div></div>';
 setVisualSettings();
}
function render(){renderDays();drawHero(stateAt(selected,new Date()))}
function defaultSoundFor(item){
 if(!item)return model.settings.soundDefault||'chime';
 if(item.sound&&item.sound!=='inherit'&&SOUNDS[item.sound])return item.sound;
 const choice=model.settings.typeSounds?.[item.category];
 return choice&&choice!=='inherit'&&SOUNDS[choice]?choice:(model.settings.soundDefault||'chime');
}
async function armAudio(){
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){toast('This browser cannot play the built-in sounds');return false}
  if(!audioCtx)audioCtx=new Audio();
  await audioCtx.resume();
  return audioCtx.state==='running';
 }catch(e){toast('Audio could not start. Check browser sound settings.');return false}
}
function note(freq,start,duration,kind='sine',amp=.11){
 if(!audioCtx||audioCtx.state!=='running')return;
 const oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain(),at=audioCtx.currentTime+start;
 oscillator.type=kind;oscillator.frequency.setValueAtTime(freq,at);
 gain.gain.setValueAtTime(.0001,at);
 gain.gain.exponentialRampToValueAtTime(Math.max(.001,amp),at+.015);
 gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 oscillator.connect(gain).connect(audioCtx.destination);
 oscillator.start(at);oscillator.stop(at+duration+.03);
}
function soundPattern(name){
 if(name==='none')return;
 let seq={
  chime:[[740,0,.55,'sine'],[1108,.18,.64,'sine']],
  double:[[880,0,.34,'sine'],[880,.31,.4,'sine']],
  soft:[[620,0,.4,'sine']],
  glass:[[920,0,.7,'sine'],[1240,.3,.67,'sine'],[1480,.6,.7,'sine']],
  marimba:[[392,0,.18,'triangle'],[523,.19,.23,'triangle'],[659,.38,.36,'triangle']],
  digital:[[650,0,.11,'square'],[950,.14,.13,'square']],
  retro:[[392,0,.13,'square'],[494,.16,.13,'square'],[587,.32,.13,'square'],[784,.48,.31,'square']],
  birds:[[1700,0,.11,'sine'],[2230,.1,.13,'sine'],[1920,.29,.13,'sine'],[2500,.41,.16,'sine']],
  wood:[[200,0,.12,'triangle'],[260,.27,.12,'triangle']]
 }[name]||[[700,0,.35,'sine']];
 seq.forEach(a=>note(a[0],a[1],a[2],a[3],a[3]==='square'?.045:.11));
}
async function previewSound(name){if(!await armAudio())return;soundPattern(name);toast('Playing '+(SOUNDS[name]||name))}
function fireTransition(item){
 if(!item)return;
 const name=defaultSoundFor(item);
 if(model.settings.soundEnabled&&audioCtx?.state==='running')soundPattern(name);
 if(model.settings.desktop&&'Notification'in window&&Notification.permission==='granted'){
  try{new Notification('Dayline · '+item.name,{body:item.desc||'Your next activity is starting',tag:'dayline-activity'})}catch(e){}
 }
}
function monitor(){
 const now=new Date(),day=localDate(now),s=stateAt(day,now),id=s.active?.id||'none';
 if(lastRealtimeDate&&day!==lastRealtimeDate&&selected===lastRealtimeDate){selected=day;render()}
 if(lastRealtimeId!==undefined&&lastRealtimeDate===day&&id!==lastRealtimeId&&s.active){
  const elapsed=s.t-mins(s.active.start)*60;
  if(elapsed>=0&&elapsed<15)fireTransition(s.active);
 }
 lastRealtimeId=id;lastRealtimeDate=day;
 if(s.active){
  const seconds=mins(s.active.end)*60-s.t;
  const k=day+'-'+s.active.id;
  if(seconds<=60&&seconds>0&&warnedKey!==k){
   warnedKey=k;
   if(model.settings.minuteSound&&model.settings.soundEnabled&&audioCtx?.state==='running')soundPattern('soft');
  }
 }
 renderClockOnly();
}
function renderClockOnly(){
 const s=stateAt(selected,new Date());
 drawHero(s);
}
function options(object,value){return Object.entries(object).map(([k,label])=>'<option value="'+esc(k)+'"'+(value===k?' selected':'')+'>'+esc(typeof label==='string'?label:label.label)+'</option>').join('')}
function openPanel(tab='day'){
 activeTab=tab;
 if(!$('settingsDialog').open)$('settingsDialog').showModal();
 drawPanel();
}
function drawPanel(){
 let labels={day:'Edit rota',routine:'Repeating pattern',alerts:'Alerts & sounds',backup:'Backup & export'};
 $('panelTitle').textContent=labels[activeTab];
 $('panelTabs').querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
 if(activeTab==='day')drawDayPanel();
 if(activeTab==='routine')drawRoutinePanel();
 if(activeTab==='alerts')drawAlertsPanel();
 if(activeTab==='backup')drawBackupPanel();
}
function drawDayPanel(){
 const list=currentScopeList(),scopeNames={day:'This date only',workday:'Repeating working-day template',off:'Alternating Friday-off template'};
 $('panelContent').innerHTML=
 '<p class="section-desc"><strong>'+esc(dateText(selected))+'</strong>. Select whether edits affect just this day or the recurring template.</p>'+
 '<label class="field">Editing<select id="scope">'+options(scopeNames,editScope)+'</select></label>'+
 (editScope==='day'?'<p class="section-desc">Changes to this date are saved as an exception. Other days keep their recurring timetable.</p>':'<p class="section-desc">⚠ Editing this template updates all dates using it, except days with their own overrides.</p>')+
 '<div class="row wrap" style="margin:12px 0"><button class="btn primary" id="addEntry">+ Add activity</button>'+
 (editScope==='day'?'<button class="btn" id="resetDate">Reset date to routine</button><button class="btn" id="copyDate">Copy day</button>':'')+'</div>'+
 '<div class="editor-list">'+(list.length?list.map(x=>'<div class="editor-item"><div class="editor-time">'+esc(x.start)+'<br>'+esc(x.end)+'</div><div class="editor-text"><strong>'+esc(x.name)+'</strong><span>'+esc(CATS[x.category]?.label||'Other')+'</span></div><button class="small-btn" data-edit="'+esc(x.id)+'" aria-label="Edit activity">✎</button><button class="small-btn" data-delete="'+esc(x.id)+'" aria-label="Delete activity">×</button></div>').join(''):'<div class="empty">No activities for this selection.</div>')+'</div>';
 $('scope').onchange=e=>{editScope=e.target.value;drawDayPanel()};
 $('addEntry').onclick=()=>showEditor(null);
 if($('resetDate'))$('resetDate').onclick=()=>{
  if(Object.prototype.hasOwnProperty.call(model.overrides,selected)&&confirm('Remove all exceptions for '+selected+' and use its repeating schedule?')){
   delete model.overrides[selected];persist();render();drawPanel();
  }else if(!Object.prototype.hasOwnProperty.call(model.overrides,selected))toast('This day already uses the repeating schedule');
 };
 if($('copyDate'))$('copyDate').onclick=()=>{
  const target=prompt('Copy activities to this date (YYYY-MM-DD):',addDays(selected,1));
  if(!target)return;
  if(!/^\d{4}-\d\d-\d\d$/.test(target)||!Number.isFinite(fromDate(target).getTime())){toast('Enter a valid YYYY-MM-DD date');return}
  if(schedule(target).length&&!confirm('Replace the schedule for '+target+' with a one-day copy?'))return;
  model.overrides[target]=copy(schedule(selected)).map(x=>({...x,id:rand()}));
  selected=target;persist();render();drawPanel();toast('Copied to '+target);
 };
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>showEditor(b.dataset.edit));
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{
  const x=list.find(x=>x.id===b.dataset.delete);if(!x||!confirm('Delete '+x.name+' from '+scopeNames[editScope]+'?'))return;
  writeList(list.filter(y=>y.id!==x.id));toast('Activity deleted');
 });
}
function showEditor(id){
 editing=id;const x=currentScopeList().find(x=>x.id===id)||{name:'',desc:'',start:'09:00',end:'09:30',category:'work',sound:'inherit'};
 $('entryTitle').textContent=id?'Edit activity':'New activity';
 for(let k of ['name','desc','start','end'])$('entryForm').elements[k].value=x[k];
 $('entryForm').elements['category'].innerHTML=options(CATS,x.category);
 $('entryForm').elements['sound'].innerHTML='<option value="inherit">Use category sound</option>'+options(SOUNDS,x.sound);
 $('entryDialog').showModal();
}
$('entryForm').addEventListener('submit',e=>{
 if(e.submitter?.value!=='save')return;
 e.preventDefault();
 const f=$('entryForm').elements;
 let x={id:editing||rand(),start:f['start'].value,end:f['end'].value,name:f['name'].value.trim(),desc:f['desc'].value.trim(),category:f['category'].value,sound:f['sound'].value};
 if(!x.name||!validTime(x.start)||!validTime(x.end)||mins(x.end)<=mins(x.start)){toast('Check the title and start/end times');return}
 let list=currentScopeList().filter(y=>y.id!==editing);
 list.push(x);writeList(sortList(list));$('entryDialog').close();toast('Activity saved');
});
function drawRoutinePanel(){
 const future=[];
 for(let n=0;n<84;n++){const d=addDays(localDate(),n);if(dow(d)===5&&isOffFriday(d))future.push(d);if(future.length===4)break}
 $('panelContent').innerHTML=
 '<p class="section-desc">Every Monday to Thursday uses the workday template. Fridays alternate between a normal workday and an out-of-office Friday. Saturday and Sunday are left clear.</p>'+
 '<label class="field">Known Friday off (cycle anchor)<input type="date" id="anchor" value="'+esc(model.offFridayAnchor)+'"></label>'+
 '<p class="section-desc">Current anchor: Friday 13 November 2026. Each Friday 14 days apart is automatically marked out of office.</p>'+
 '<div class="row wrap"><button class="btn" id="editWork">Edit workday template</button><button class="btn" id="editOff">Edit Friday-off template</button></div>'+
 '<h3>Upcoming Fridays off</h3><div class="section-desc">'+future.map(d=>dateText(d)).join('<br>')+'</div>'+
 '<h3>Schedule behaviour</h3><p class="section-desc">Today and future dates are generated automatically. The gym, cooking and Colin’s visit from Monday 9 November remain one-off plans, not part of your repeating workday.</p>';
 $('anchor').onchange=e=>{
  const d=e.target.value;
  if(d&&dow(d)!==5){toast('Select a Friday as the anchor');e.target.value=model.offFridayAnchor;return}
  if(d){model.offFridayAnchor=d;persist();render();drawRoutinePanel();toast('Friday pattern updated')}
 };
 $('editWork').onclick=()=>{editScope='workday';activeTab='day';drawPanel()};
 $('editOff').onclick=()=>{editScope='off';activeTab='day';drawPanel()};
}
function drawAlertsPanel(){
 let s=model.settings,catRows=Object.entries(CATS).map(([key,cat])=>{
  const value=s.typeSounds?.[key]??s.soundDefault;
  return '<div class="sound-row"><span>'+esc(cat.label)+'</span><select data-category-sound="'+key+'"><option value="inherit"'+(value==='inherit'?' selected':'')+'>Use general sound</option>'+options(SOUNDS,value)+'</select><button class="small-btn" data-preview-category="'+key+'" title="Test sound">▶</button></div>';
 }).join('');
 $('panelContent').innerHTML=
 '<p class="section-desc">Dayline gently pulses during the final 60 seconds of a block. Optional sounds play when the next activity starts. On Windows, click the speaker in the main window once to unlock audio for this session.</p>'+
 '<label class="inline-label"><span>🔊 Enable transition sounds</span><input id="audioEnabled" type="checkbox" '+(s.soundEnabled?'checked':'')+'></label>'+
 '<label class="inline-label"><span>✨ Pulse during the last 60 seconds</span><input id="visualWarning" type="checkbox" '+(s.visualWarning?'checked':'')+'></label>'+
 '<label class="inline-label"><span>🔔 Play a quiet 60-second warning sound</span><input id="minuteSound" type="checkbox" '+(s.minuteSound?'checked':'')+'></label>'+
 '<label class="inline-label"><span>🖥️ Windows desktop notifications</span><input id="desktopAlerts" type="checkbox" '+(s.desktop?'checked':'')+'></label>'+
 '<h3>General sound</h3><div class="row"><select class="select" id="generalSound">'+options(SOUNDS,s.soundDefault)+'</select><button class="btn" id="testGeneral">▶ Test</button></div>'+
 '<h3>Sounds by activity type</h3><p class="section-desc">Each activity uses its category sound unless you give it an individual override when editing it.</p>'+catRows+
 '<h3>Illustrated backgrounds</h3><label class="field">Image blend / visibility <span id="alphaValue">'+Number(s.artOpacity)+'%</span><input type="range" id="artOpacity" min="0" max="85" step="5" value="'+Number(s.artOpacity)+'"></label>'+
 '<p class="section-desc">Sounds and desktop notifications can be delayed if Edge is suspended or the PC goes to sleep. Dayline is a helpful visual reminder, not a guaranteed alarm clock.</p>';
 $('audioEnabled').onchange=async e=>{
  s.soundEnabled=e.target.checked;
  if(s.soundEnabled){if(await armAudio()){soundPattern('soft');toast('Sounds enabled for this session')}else{s.soundEnabled=false;e.target.checked=false}}
  persist();renderSoundButton();
 };
 for(let id of ['visualWarning','minuteSound'])$(id).onchange=e=>{s[id]=e.target.checked;persist();renderClockOnly()};
 $('desktopAlerts').onchange=async e=>{
  if(e.target.checked){
   if(!('Notification'in window)){toast('Desktop notifications are unavailable here');e.target.checked=false;return}
   try{const permission=await Notification.requestPermission();s.desktop=permission==='granted';e.target.checked=s.desktop;if(!s.desktop)toast('Notification permission was not granted')}catch{e.target.checked=false;s.desktop=false}
  }else s.desktop=false;
  persist();
 };
 $('generalSound').onchange=e=>{s.soundDefault=e.target.value;persist()};
 $('testGeneral').onclick=()=>previewSound($('generalSound').value);
 $('panelContent').querySelectorAll('[data-category-sound]').forEach(el=>el.onchange=e=>{if(!s.typeSounds)s.typeSounds={};s.typeSounds[e.target.dataset.categorySound]=e.target.value;persist()});
 $('panelContent').querySelectorAll('[data-preview-category]').forEach(el=>el.onclick=()=>{const sound=s.typeSounds?.[el.dataset.previewCategory];previewSound(sound==='inherit'||!sound?s.soundDefault:sound)});
 $('artOpacity').oninput=e=>{s.artOpacity=Number(e.target.value);$('alphaValue').textContent=s.artOpacity+'%';persist();setVisualSettings()};
}
function exportRange(){
 let val=Number($('rangeDays')?.value||90);
 return Math.max(1,Math.min(366,val));
}
function exportOccurrences(days){
 let out=[],day=localDate();for(let i=0;i<days;i++){let d=addDays(day,i);for(let x of schedule(d))out.push({date:d,...x})}return out;
}
function dl(name,data,type){
 const blob=new Blob([data],{type}),u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),3000);
}
function exportJSON(){dl('dayline-backup.json',JSON.stringify(model,null,2),'application/json')}
function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function exportCSV(days){
 let rows=[['Date','Start','End','Activity','Category','Description']];
 exportOccurrences(days).forEach(x=>rows.push([x.date,x.start,x.end,x.name,x.category,x.desc]));
 dl('dayline-next-'+days+'-days.csv',rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv');
}
function icalEscape(v){return String(v??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function exportICS(days){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Dayline//Rota 2.0//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Dayline rota'];
 for(let x of exportOccurrences(days)){
  const fmt=t=>x.date.replace(/-/g,'')+'T'+t.replace(':','')+'00';
  lines.push('BEGIN:VEVENT','UID:'+x.date+'-'+x.id+'@dayline','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),
   'DTSTART:'+fmt(x.start),'DTEND:'+fmt(x.end),'SUMMARY:'+icalEscape(x.name),'DESCRIPTION:'+icalEscape(x.desc),'END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 dl('dayline-next-'+days+'-days.ics',lines.join('\r\n')+'\r\n','text/calendar');
}
function drawBackupPanel(){
 $('panelContent').innerHTML='<p class="section-desc">Your rota is kept in this browser on this device. Export a JSON backup before clearing your browser data or moving to another computer.</p>'+
 '<div class="row wrap"><button class="btn primary" id="downloadJSON">↓ Download JSON backup</button><button class="btn" id="uploadJSON">↑ Import JSON backup</button></div>'+
 '<h3>Export to a calendar or spreadsheet</h3><label class="field">Include the next<select id="rangeDays"><option value="30">30 days</option><option value="90" selected>90 days</option><option value="180">180 days</option><option value="365">365 days</option></select></label>'+
 '<div class="row wrap"><button class="btn" id="exportICS">↓ Calendar .ics</button><button class="btn" id="exportCSV">↓ Spreadsheet .csv</button></div>'+
 '<p class="section-desc">Calendar exports are one-off events for the selected period, with floating local times. Importing the same file twice into a calendar may create duplicates. Importing JSON replaces the Dayline rota on this device.</p>';
 $('downloadJSON').onclick=exportJSON;
 $('uploadJSON').onclick=()=>$('importFile').click();
 $('exportICS').onclick=()=>exportICS(exportRange());
 $('exportCSV').onclick=()=>exportCSV(exportRange());
}
$('importFile').addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{
  let parsed=JSON.parse(await f.text());
  if(parsed.days&&typeof parsed.days==='object'&&!parsed.version){parsed={...defaultModel(),overrides:parsed.days}}
  else if(parsed.version!==2&&typeof parsed==='object'&&!Array.isArray(parsed)&&!parsed.templates){parsed={...defaultModel(),overrides:parsed}}
  if(parsed.version!==2||!parsed.templates||!Array.isArray(parsed.templates.workday)||!Array.isArray(parsed.templates.off)||!parsed.overrides||typeof parsed.overrides!=='object')throw new Error('Not a recognised Dayline backup');
  if(!confirm('Replace all current Dayline routines, settings and one-off changes with this backup?'))return;
  parsed.templates.workday=cleanList(parsed.templates.workday);parsed.templates.off=cleanList(parsed.templates.off);
  for(let d in parsed.overrides)parsed.overrides[d]=cleanList(parsed.overrides[d]);
  parsed.settings={...defaultModel().settings,...parsed.settings};
  model=parsed;persist();render();drawPanel();toast('Rota imported');
 }catch(e){toast('Import failed: '+e.message)}finally{e.target.value=''}
});
$('settingsButton').onclick=()=>{editScope='day';openPanel('day')};
$('soundButton').onclick=async()=>{
 if(model.settings.soundEnabled&&audioCtx?.state!=='running'){
  if(await armAudio()){soundPattern('soft');toast('Sound armed for this session')}
 }else{
  model.settings.soundEnabled=!model.settings.soundEnabled;
  if(model.settings.soundEnabled){
   if(await armAudio()){soundPattern('soft');toast('Sound is on. Customise it using the cog.')}
   else model.settings.soundEnabled=false;
  }else toast('Sound muted');
 }
 persist();renderSoundButton();
};
function renderSoundButton(){
 const b=$('soundButton');
 const armed=Boolean(model.settings.soundEnabled&&audioCtx?.state==='running');
 b.textContent=armed?'🔊':model.settings.soundEnabled?'🔔':'🔇';
 b.classList.toggle('on',armed);
 b.title=armed?'Mute sounds':model.settings.soundEnabled?'Tap once to activate sounds for this session':'Enable alert sounds';
 b.setAttribute('aria-label',b.title);
}
$('prevWeek').onclick=()=>{selected=addDays(selected,-7);render()};
$('nextWeek').onclick=()=>{selected=addDays(selected,7);render()};
$('todayButton').onclick=()=>{selected=localDate();render()};
$('panelClose').onclick=()=>$('settingsDialog').close();
$('entryClose').onclick=()=>$('entryDialog').close();
$('panelTabs').querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;drawPanel()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();monitor()}});
setVisualSettings();renderSoundButton();render();monitor();setInterval(monitor,1000);
