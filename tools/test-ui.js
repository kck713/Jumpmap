// DOM/Canvas doubles check lifecycle and input; this is not browser or visual QA.
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
function run(core, ui, shell) {

const ids = [...shell.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const elements = Object.fromEntries(ids.map(id=>[id,{hidden:false,textContent:'',attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},blur(){},getBoundingClientRect(){return {width:1000,height:650};}}]));
const buttons = [2,0,1].map(lv=>({dataset:{lv:String(lv)},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;}}));
const grad={addColorStop(){}};
const ctx=new Proxy({createLinearGradient:()=>grad,createRadialGradient:()=>grad},{get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
elements.cv.getContext=()=>ctx;
const document={hidden:false,getElementById:id=>{if(!elements[id])throw Error('Missing DOM '+id);return elements[id]},querySelectorAll:()=>buttons,addEventListener(){}};
const storage=new Map(),localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,String(v))};
let clock=0;const performance={now:()=>clock},events={},window={};
const addEventListener=(k,v)=>events[k]=v;
const matchMedia=()=>({matches:false});
class ResizeObserver { constructor(fn){this.fn=fn;} observe(){this.fn();} }
const requestAnimationFrame=()=>{};
const code=core.replace(/^if \(typeof module.*$/m,'')+'\n'+ui.replace(/\}\)\(\);\s*$/, 'window.__test={start,pick,draw,frame,press,release,pause,resume,win,get:()=>({p,L,state,lv,bests,coinBest}),setClock:v=>{last=v;acc=0;}};})();');
new Function('document','window','localStorage','performance','addEventListener','matchMedia','ResizeObserver','requestAnimationFrame','devicePixelRatio',code)(document,window,localStorage,performance,addEventListener,matchMedia,ResizeObserver,requestAnimationFrame,1);
const api=window.__test;
function ok(c,m){if(!c)throw Error(m);}
ok(api.get().lv===2,'Doodle is selected initially');
api.draw(0);
for(let i=0;i<3;i++){api.start(i);api.draw(1);ok(api.get().L.name.length>0,'Level starts');}
api.start(2);api.pause();ok(api.get().state==='paused','Pauses');
ok(elements.levels.hidden,'Paused overlay hides level buttons');
api.resume();ok(api.get().state==='play'&&!elements.levels.hidden,'Resumes');
api.start(2);
const jumps=new Set([100,173,258,339,411,650,731,843,1022]);
for(let f=0;f<120*25&&api.get().state==='play';f++){
 // Feed real input but use the same fixed simulation interval as frame().
 if(jumps.has(Math.floor(f/2)))api.press();else api.release();
 clock+=1000/120;
 api.frame(clock);
}
ok(api.get().state==='won','Full UI loop reaches win');
ok(api.get().p.coins===24,'UI coin counter reaches 24');
ok(elements.ovTitle.textContent==='태극 코인 올 클리어!','Win screen has collection result');
ok(storage.get('ncr-best-2')==='100','Completion saved');
ok(storage.get('jumpmap-doodle-coins')==='24','Coin record saved');
api.start(2);ok(api.get().p.coins===0,'Restart resets coins');
ok(elements.coins.textContent==='0 / 24','HUD resets');
api.pause();api.start(0);ok(!elements.levels.hidden,'Start clears pause');
ok(elements.coinsStat.hidden,'Original levels hide coin HUD');
return {passed:true,completion:storage.get('ncr-best-2'),coins:storage.get('jumpmap-doodle-coins')};

}
console.log('UI smoke checks:', run(read('core.js'), read('ui.js'), read('shell.html')));
