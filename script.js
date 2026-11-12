"use strict";
const $ = id => document.getElementById(id);
const KEY = "trips";
const CATEGORIES = ["交通費", "食費", "宿泊費", "観光費", "買い物", "その他"];
const ICONS = {"交通費":"🚃", "食費":"🍽️", "宿泊費":"🏨", "観光費":"🎡", "買い物":"🛍️", "その他":"📌"};
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
let trips = [];
let activeTripId = null;
let activeDay = null;
let editingTripId = null;
let editingEventId = null;
let currentTab = "itinerary";
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (Array.isArray(saved)) {
    trips = saved.filter(t => t && typeof t === "object").map(t => ({...t, id: t.id || newId(), people: Number.isSafeInteger(Number(t.people)) && Number(t.people)>=1 && Number(t.people)<=100 ? Number(t.people) : 1, budget: t.budgetMode === "perPerson" ? Number(t.budget)||0 : Math.round((Number(t.budget)||0)/(Number.isSafeInteger(Number(t.people)) && Number(t.people)>=1 && Number(t.people)<=100 ? Number(t.people) : 1)), budgetMode: "perPerson", events: Array.isArray(t.events) ? t.events : []}));
  }
} catch (error) { console.error("保存データの読み込みに失敗しました", error); }
function newId() { return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function persist(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); trips = next; return true; }
  catch(error) { console.error(error); alert("保存できませんでした。ブラウザの保存容量や設定を確認してください。"); return false; }
}
function parseDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y,m,d] = s.split("-").map(Number);
  const date = new Date(y, m-1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m-1 || date.getDate() !== d) return null;
  return date;
}
function datesBetween(start, end) {
  const a = parseDate(start), b = parseDate(end);
  if (!a || !b || b < a) return [];
  const count = Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
  if (count > 365) return [];
  return Array.from({length:count+1},(_,i) => {
    const dt = new Date(a.getFullYear(),a.getMonth(),a.getDate()+i);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  });
}
function formatDay(s) { const d=parseDate(s); return d ? `${d.getMonth()+1}/${d.getDate()}（${weekdays[d.getDay()]}）` : "日付未設定"; }
function nightsLabel(t) { const days=datesBetween(t.start,t.end).length; return days ? (days===1 ? "日帰り" : `${days-1}泊${days}日`) : "日程未設定"; }
function peopleCount(t) { const n=Number(t.people); return Number.isSafeInteger(n)&&n>=1&&n<=100?n:1; }
function eventTotal(e,t) { return (Number(e.cost)||0) * (e.costScope === "person" ? peopleCount(t) : 1); }
function perPerson(n,t) { return Math.round(n/peopleCount(t)); }
function tripTotal(t) { return (Number(t.budget)||0) * peopleCount(t); }
function yen(n) { return `${Number(n || 0).toLocaleString("ja-JP")}円`; }
function tripById() { return trips.find(t => t.id === activeTripId); }
function element(tag, className, value) { const e=document.createElement(tag); if(className)e.className=className; if(value!==undefined)e.textContent=value; return e; }
function coloredDate(s) {
  const date = parseDate(s);
  const part=element("span","date-part");
  if (!date) {part.textContent="日付未設定";return part;}
  part.append(element("span","",`${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`));
  const badge=element("span",`weekday-badge ${date.getDay()===0?"sunday":date.getDay()===6?"saturday":"weekday"}`,weekdays[date.getDay()]);
  part.append(badge); return part;
}
function renderDashboard() {
  $("dashboard-count").innerHTML = "";
  $("dashboard-count").append(document.createTextNode(trips.length.toLocaleString("ja-JP")), element("span", "dashboard-unit", " 件"));
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const upcoming = trips.filter(t => parseDate(t.start) && parseDate(t.end) && t.end >= todayString)
    .sort((a,b) => a.start.localeCompare(b.start));
  if (upcoming.length) {
    const next = upcoming[0];
    $("dashboard-next").textContent = next.destination || next.name || "旅行先未設定";
    $("dashboard-next-date").textContent = `${formatDay(next.start)} 出発 ・ ${nightsLabel(next)}`;
  } else {
    $("dashboard-next").textContent = "予定なし";
    $("dashboard-next-date").textContent = trips.length ? "これからの旅行を登録しましょう" : "旅行を登録してみましょう";
  }
  const total = trips.reduce((sum,t) => sum + tripTotal(t), 0);
  $("dashboard-budget").textContent = yen(total);
}
function renderHome() {
  renderDashboard();
  const list=$("trip-list"); list.replaceChildren();
  if(!trips.length) list.append(element("p","empty-state","まだ旅行がありません。「新しい旅行を計画する」から追加しましょう。"));
  trips.forEach(t => {
    const card=element("article","trip-card");
    card.append(element("div","trip-image","✈️"));
    const info=element("div","trip-info");
    info.append(element("h3","",t.name || "旅行名未設定"),element("p","",`📍 ${t.destination || "旅行先未設定"}`));
    const date=element("div","trip-date"); date.append(coloredDate(t.start),element("span","","〜"),coloredDate(t.end));info.append(date);
    info.append(element("p","",`🗓 ${nightsLabel(t)}`),element("p","trip-budget",`👥 ${peopleCount(t)}人 ・ 1人あたり：${yen(t.budget)}`));
    info.append(element("div","card-total",`総予算  ${yen(tripTotal(t))}`));
    const buttons=element("div","card-buttons");
    const detail=element("button","","旅の詳細を見る");detail.type="button";detail.onclick=()=>openDetail(t.id);
    const edit=element("button","secondary-button","編集");edit.type="button";edit.onclick=()=>openTripForm(t.id);
    const del=element("button","delete-button","削除");del.type="button";del.onclick=()=>{
      if(!confirm(`「${t.name}」を削除しますか？\n登録した旅程もすべて削除されます。`))return;
      if(persist(trips.filter(x=>x.id!==t.id)))renderHome();
    };
    buttons.append(detail,edit,del);info.append(buttons);card.append(info);list.append(card);
  });
}
function showHome() { activeTripId=null;$("detail-view").hidden=true;$("home-view").hidden=false;renderHome();window.scrollTo(0,0); }
function openDetail(id) {
  activeTripId=id;const t=tripById();if(!t)return showHome();
  activeDay=datesBetween(t.start,t.end)[0] || null;currentTab="itinerary";
  $("home-view").hidden=true;$("detail-view").hidden=false;renderDetail();window.scrollTo(0,0);
}
function renderDetail() {
  const t=tripById();if(!t)return showHome();
  $("detail-title").textContent=t.name || "旅行名未設定";
  $("detail-subtitle").textContent=`📍 ${t.destination || "旅行先未設定"} ・ ${nightsLabel(t)} ・ ${formatDay(t.start)} 〜 ${formatDay(t.end)}`;
  $("itinerary-panel").hidden=currentTab!=="itinerary";
  $("budget-panel").hidden=currentTab!=="budget";
  $("tab-itinerary").classList.toggle("active",currentTab==="itinerary");
  $("tab-budget").classList.toggle("active",currentTab==="budget");
  if(currentTab==="itinerary")renderItinerary();else renderBudget();
}
function renderItinerary() {
  const t=tripById(), dates=datesBetween(t.start,t.end),tabs=$("day-tabs");tabs.replaceChildren();
  if(!dates.includes(activeDay))activeDay=dates[0] || null;
  dates.forEach((date,i)=>{
    const btn=element("button",`day-button ${date===activeDay?"selected":""}`,`${i+1}日目　${formatDay(date)}`);
    btn.type="button";btn.onclick=()=>{activeDay=date;renderItinerary();};tabs.append(btn);
  });
  $("selected-day-title").textContent=activeDay?`${dates.indexOf(activeDay)+1}日目の旅程` : "旅程";
  $("add-event").disabled=!activeDay;
  const list=$("event-list");list.replaceChildren();
  const events=(t.events||[]).filter(e=>e.date===activeDay).slice().sort((a,b)=>String(a.time).localeCompare(String(b.time)));
  if(!events.length)list.append(element("div","empty-state","この日の旅程はまだありません。旅程を追加してみましょう。"));
  events.forEach(e=>{
    const card=element("article","event-card"),body=element("div","event-body");
    card.append(element("div","event-time",e.time || "--:--"));
    body.append(element("h4","",`${ICONS[e.category]||"📌"} ${e.title || "名称未設定"}`));
    if(e.place)body.append(element("p","",`📍 ${e.place}`));
    body.append(element("p","",`${e.category || "その他"} ・ ${yen(e.cost)}（${e.costScope === "person" ? "1人分" : "全員分"}） / 合計 ${yen(eventTotal(e,t))}`));
    if(e.note)body.append(element("p","",e.note));
    const actions=element("div","event-actions");
    const edit=element("button","secondary-button","編集");edit.type="button";edit.onclick=()=>openEventForm(e.id);
    const del=element("button","delete-button","削除");del.type="button";del.onclick=()=>{
      if(!confirm("この旅程を削除しますか？"))return;
      const next=trips.map(x=>x.id===t.id?{...x,events:(x.events||[]).filter(v=>v.id!==e.id)}:x);
      if(persist(next))renderDetail();
    };
    actions.append(edit,del);body.append(actions);card.append(body);list.append(card);
  });
}
function renderBudget() {
  const t=tripById();const total=tripTotal(t);
  const events=(t.events||[]).filter(e=>datesBetween(t.start,t.end).includes(e.date));
  const spent=events.reduce((sum,e)=>sum+eventTotal(e,t),0), remaining=total-spent;
  $("budget-people").textContent=`${peopleCount(t)}人`;
  $("budget-per-person").textContent=yen(t.budget);
  $("budget-total-formula").textContent=`${yen(t.budget)} × ${peopleCount(t)}人`;
  $("budget-spent-per-person").textContent=`約${yen(perPerson(spent,t))}`;
  $("budget-remaining-per-person").textContent=`約${yen(perPerson(remaining,t))}`;
  $("budget-remaining-per-person").classList.toggle("negative",remaining<0);
  $("budget-total").textContent=yen(total);$("budget-spent").textContent=yen(spent);$("budget-remaining").textContent=yen(remaining);
  $("budget-remaining").classList.toggle("negative",remaining<0);
  const pct=total>0?Math.round(spent/total*100):0;
  $("budget-progress").style.width=`${Math.max(0,Math.min(100,pct))}%`;
  $("budget-progress").style.background=remaining<0?"#dc2626":"#2563eb";
  $("budget-percent").textContent=total>0?`予算の${pct}%を使用予定`:(spent>0?"予算が0円のため、使用率を計算できません":"予算が0円です");
  const list=$("budget-breakdown");list.replaceChildren();
  CATEGORIES.forEach(category=>{
    const amount=events.filter(e=>e.category===category).reduce((s,e)=>s+eventTotal(e,t),0);
    const row=element("div","breakdown-row");row.append(element("span","",`${ICONS[category]} ${category}`),element("strong","",yen(amount)));list.append(row);
  });
}
function openTripForm(id=null) {
  editingTripId=id;const t=trips.find(x=>x.id===id);$("trip-form").reset();$("trip-error").textContent="";
  $("trip-form-title").textContent=t?"旅行プランを編集":"新しい旅行を作成";
  $("save-trip").textContent=t?"変更を保存する":"旅行プランを作成する";
  $("trip-name").value=t?.name||"";$("trip-destination").value=t?.destination||"";
  $("start-date").value=t?.start||"";$("end-date").value=t?.end||"";
  $("end-date").min=$("start-date").value;$("trip-budget").value=t?.budget??"";$("trip-people").value=peopleCount(t||{});updateBudgetPreview();
  $("trip-dialog").showModal();
}
$("trip-form").addEventListener("submit",e=>{
  e.preventDefault();const name=$("trip-name").value.trim(),destination=$("trip-destination").value.trim();
  const start=$("start-date").value,end=$("end-date").value,budget=Number($("trip-budget").value),people=Number($("trip-people").value);
  const old=trips.find(t=>t.id===editingTripId);
  if(!name||!destination||!parseDate(start)||!parseDate(end)||end<start||datesBetween(start,end).length===0){$("trip-error").textContent="旅行名・旅行先・日付を確認してください（旅行は365泊以内）。";return;}
  if($("trip-budget").value===""||!Number.isSafeInteger(budget)||budget<0||budget>999999999){$("trip-error").textContent="予算を正しく入力してください。";return;}
  if(!Number.isSafeInteger(people)||people<1||people>100){$("trip-error").textContent="人数は1〜100人で入力してください。";return;}
  if(old && (old.start!==start||old.end!==end) && (old.events||[]).some(ev=>ev.date<start||ev.date>end)){
    $("trip-error").textContent="変更後の日程から外れる旅程があります。先に該当する旅程の日付を変更・削除してください。";return;
  }
  if (budget * people > Number.MAX_SAFE_INTEGER) {$("trip-error").textContent="総予算が大きすぎます。";return;}
  const updated={...(old||{}),id:old?.id||newId(),name,destination,start,end,budget,people,budgetMode:"perPerson",events:old?.events||[]};
  const next=old?trips.map(t=>t.id===old.id?updated:t):[...trips,updated];
  if(persist(next)){$("trip-dialog").close();renderHome();if(activeTripId===updated.id)renderDetail();}
});
function updateBudgetPreview() {
  const n=Number($("trip-people").value),b=Number($("trip-budget").value);
  const valid=Number.isSafeInteger(n)&&n>=1&&n<=100&&Number.isSafeInteger(b)&&b>=0&&b<=999999999;
  $("trip-budget-preview").textContent=valid?yen(n*b):"—";
  $("trip-budget-formula").textContent=valid?`${yen(b)} × ${n}人`:"予算と人数を入力してください";
}
$("trip-people").addEventListener("input",updateBudgetPreview);
$("trip-budget").addEventListener("input",updateBudgetPreview);
$("start-date").addEventListener("change",()=>{
  $("end-date").min=$("start-date").value;
  if($("end-date").value && $("end-date").value<$("start-date").value)$("end-date").value="";
});
function openEventForm(id=null) {
  const t=tripById();if(!t)return;
  editingEventId=id;const e=(t.events||[]).find(v=>v.id===id);
  $("event-form").reset();$("event-error").textContent="";
  $("event-form-title").textContent=e?"旅程を編集":"旅程を追加";
  $("save-event").textContent=e?"変更を保存する":"旅程を保存する";
  const dates=datesBetween(t.start,t.end),select=$("event-date");select.replaceChildren();
  dates.forEach((date,i)=>{const opt=document.createElement("option");opt.value=date;opt.textContent=`${i+1}日目　${formatDay(date)}`;select.append(opt);});
  select.value=e?.date||activeDay||dates[0];
  $("event-time").value=e?.time||"10:00";$("event-title").value=e?.title||"";
  $("event-place").value=e?.place||"";$("event-category").value=e?.category||"その他";
  $("event-cost").value=e?.cost??0;$("event-cost-scope").value=e?.costScope||"total";$("event-note").value=e?.note||"";
  $("event-dialog").showModal();
}
$("event-form").addEventListener("submit",e=>{
  e.preventDefault();const t=tripById();if(!t)return;
  const date=$("event-date").value,time=$("event-time").value,title=$("event-title").value.trim();
  const place=$("event-place").value.trim(),category=$("event-category").value;
  const cost=Number($("event-cost").value),costScope=$("event-cost-scope").value,note=$("event-note").value.trim();
  if(!datesBetween(t.start,t.end).includes(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!title||!CATEGORIES.includes(category)){$("event-error").textContent="日付・時間・タイトルを確認してください。";return;}
  if($("event-cost").value===""||!Number.isSafeInteger(cost)||cost<0||cost>999999999){$("event-error").textContent="費用を正しく入力してください。";return;}
  if(!["total","person"].includes(costScope)||cost*(costScope==="person"?peopleCount(t):1)>Number.MAX_SAFE_INTEGER){$("event-error").textContent="費用の入力方法を確認してください。";return;}
  const old=(t.events||[]).find(v=>v.id===editingEventId);
  const data={id:old?.id||newId(),date,time,title,place,category,cost,costScope,note};
  const events=old?t.events.map(v=>v.id===old.id?data:v):[...(t.events||[]),data];
  const next=trips.map(v=>v.id===t.id?{...v,events}:v);
  if(persist(next)){$("event-dialog").close();activeDay=date;renderDetail();}
});
$("open-form").onclick=()=>openTripForm();$("close-trip").onclick=()=>$("trip-dialog").close();
$("close-event").onclick=()=>$("event-dialog").close();
$("back-home").onclick=showHome;$("add-event").onclick=()=>openEventForm();
$("tab-itinerary").onclick=()=>{currentTab="itinerary";renderDetail();};
$("tab-budget").onclick=()=>{currentTab="budget";renderDetail();};
$("home-link").onclick=()=>{if(activeTripId)showHome();};
$("trips-link").onclick=()=>{if(activeTripId)showHome();};
renderHome();