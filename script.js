/* ===========================
   WWE FANTASY LEAGUE — JS
=========================== */

// ======= DATA =======
const WRESTLERS_MALE_INIT = [
  "Cody Rhodes","Roman Reigns","CM Punk","Seth Rollins","Randy Orton",
  "Gunther","Jey Uso","Jimmy Uso","Solo Sikoa","Jacob Fatu",
  "LA Knight","Drew McIntyre","Damian Priest","Finn Bálor","Dominik Mysterio",
  "Rey Mysterio","Danhausen","Kevin Owens","Sami Zayn","Bron Breakker",
  "Penta","Chad Gable","Sheamus","The Miz","R-Truth",
  "Karrion Kross","Shinsuke Nakamura","Andrade","Logan Paul","Oba Femi",
  "Joe Hendry","Trick Williams","Ethan Page","Je'Von Evans","Ilja Dragunov",
  "Austin Theory","Grayson Waller","Dragon Lee","Carmelo Hayes","Rey Fenix"
];
const WRESTLERS_FEMALE_INIT = [
  "Rhea Ripley","Bianca Belair","IYO SKY","Charlotte Flair","Becky Lynch",
  "Asuka","Bayley","Liv Morgan","Raquel Rodriguez","Tiffany Stratton",
  "Jade Cargill","Nia Jax","Naomi","Alexa Bliss","Chelsea Green",
  "Lyra Valkyria","Roxanne Perez","Giulia","Stephanie Vaquer","Zoey Stark"
];

const TITLES = {
  serieAM: "World Heavyweight Champion",
  serieAF: "World IC Woman Champion",
  champions: "Undisputed WWE Champion",
  coppaNM: "United States Champion",
  coppaNF: "Divas Champion"
};

// ======= STATE =======
let state = null;

function freshState() {
  return {
    season: 1,
    phase: "draft", // draft | league | postseason | season_end
    draftPhase: "male", // male | female | done
    draftIdx: 0,
    wrestlers: {
      male: WRESTLERS_MALE_INIT.map(n => ({ name: n, gender: "male" })),
      female: WRESTLERS_FEMALE_INIT.map(n => ({ name: n, gender: "female" }))
    },
    leagues: {
      sam: { wrestlers: [], table: {}, calendar: [], currentDay: 0, done: false },
      sbm: { wrestlers: [], table: {}, calendar: [], currentDay: 0, done: false },
      saf: { wrestlers: [], table: {}, calendar: [], currentDay: 0, done: false }
    },
    cups: {
      male: null, // { rounds: [[{a,b,winner},...]], currentRound: 0, phase: "ottavi"|... }
      female: null
    },
    champions: null, // { groups: [{name, members:[{name,gender,pts,w,l}]}], phase: "groups"|"ko", koRounds: [], currentGroupDay: 0, groupsDone: false }
    history: [], // [{season, serieAM, serieAF, champions, coppaNM, coppaNF, promotions, relegations}]
    megaStats: {}, // name -> {pts, wins, losses, titles: []}
    draftOrder: { male: [], female: [] }
  };
}

// ======= SAVE/LOAD =======
function saveState() { localStorage.setItem("wfl_state", JSON.stringify(state)); }
function loadState() {
  const s = localStorage.getItem("wfl_state");
  if (s) { try { state = JSON.parse(s); return true; } catch(e) {} }
  return false;
}

// ======= INIT =======
document.addEventListener("DOMContentLoaded", () => {
  if (!loadState()) state = freshState();
  setupListeners();
  renderAll();
});

// ======= LISTENERS =======
function setupListeners() {
  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });

  // Comp subtabs
  document.querySelectorAll(".comp-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const comp = btn.dataset.comp;
      document.querySelectorAll(`.comp-tab[data-comp="${comp}"]`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderCompView(comp, btn.dataset.view);
    });
  });

  // Header buttons
  document.getElementById("btn-backup").addEventListener("click", doBackup);
  document.getElementById("btn-restore").addEventListener("click", () => document.getElementById("file-restore").click());
  document.getElementById("file-restore").addEventListener("change", doRestore);
  document.getElementById("btn-reset").addEventListener("click", confirmReset);

  // Modal overlay close
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
}

// ======= RENDER DISPATCHER =======
function renderAll() {
  document.getElementById("season-label").textContent = "STAGIONE " + state.season;
  renderTab("draft");
}

function renderTab(tab) {
  switch(tab) {
    case "draft": renderDraft(); break;
    case "serie-a-m": renderCompView("sam", getActiveCompView("sam")); break;
    case "serie-b-m": renderCompView("sbm", getActiveCompView("sbm")); break;
    case "serie-a-f": renderCompView("saf", getActiveCompView("saf")); break;
    case "coppa-m": renderCoppa("male"); break;
    case "coppa-f": renderCoppa("female"); break;
    case "champions": renderChampions(); break;
    case "roster": renderRoster(); break;
    case "storico": renderStorico(); break;
  }
}

function getActiveCompView(comp) {
  const active = document.querySelector(`.comp-tab[data-comp="${comp}"].active`);
  return active ? active.dataset.view : "classifica";
}

// ======= DRAFT =======
function renderDraft() {
  const area = document.getElementById("draft-area");
  if (state.phase !== "draft") {
    // Season ongoing or ended
    if (state.phase === "season_end") {
      renderSeasonEnd(area);
    } else {
      area.innerHTML = `<div class="info-box"><strong>✅ Draft completato!</strong> Le competizioni sono in corso. Usa le tab per navigare tra le leghe.</div>
      ${getSeasonStatusHTML()}`;
    }
    return;
  }

  const maleDone = state.draftPhase !== "male";
  const femaleDone = state.draftPhase === "done";

  // Pools display
  let poolsHTML = `<div class="draft-pools">
    <div class="draft-pool gold-pool">
      <h3>🏆 SERIE A MASCHILE (${state.leagues.sam.wrestlers.length}/20)</h3>
      <div class="draft-wrestler-list">${state.leagues.sam.wrestlers.map(w=>`<div class="draft-wrestler-item">⚡ ${w}</div>`).join("")}</div>
    </div>
    <div class="draft-pool silver-pool">
      <h3>🥈 SERIE B MASCHILE (${state.leagues.sbm.wrestlers.length}/20)</h3>
      <div class="draft-wrestler-list">${state.leagues.sbm.wrestlers.map(w=>`<div class="draft-wrestler-item">⚡ ${w}</div>`).join("")}</div>
    </div>
  </div>
  <div class="draft-pools">
    <div class="draft-pool purple-pool">
      <h3>👑 SERIE A FEMMINILE (${state.leagues.saf.wrestlers.length}/20)</h3>
      <div class="draft-wrestler-list">${state.leagues.saf.wrestlers.map(w=>`<div class="draft-wrestler-item">⚡ ${w}</div>`).join("")}</div>
    </div>
    <div class="draft-pool" style="border-color:transparent"></div>
  </div>`;

  if (state.draftPhase === "done") {
    area.innerHTML = `<div class="draft-complete-box">
      <h3>🎉 DRAFT COMPLETATO!</h3>
      <p style="color:var(--text-muted);margin-bottom:20px">Tutti i wrestler sono stati smistati. Inizia la stagione!</p>
      <button class="btn btn-gold btn-lg" onclick="startSeason()">⚡ INIZIA LA STAGIONE 1</button>
    </div>${poolsHTML}`;
    return;
  }

  // Current wrestler to draft
  let currentWrestler = null;
  let queueLeft = 0;
  if (state.draftPhase === "male") {
    const order = state.draftOrder.male;
    if (state.draftIdx < order.length) {
      currentWrestler = order[state.draftIdx];
      queueLeft = order.length - state.draftIdx - 1;
    }
  } else {
    const order = state.draftOrder.female;
    if (state.draftIdx < order.length) {
      currentWrestler = order[state.draftIdx];
      queueLeft = order.length - state.draftIdx - 1;
    }
  }

  // Init draft order if empty
  if (state.draftPhase === "male" && state.draftOrder.male.length === 0) {
    state.draftOrder.male = shuffle([...state.wrestlers.male.map(w=>w.name)]);
    state.draftOrder.female = shuffle([...state.wrestlers.female.map(w=>w.name)]);
    saveState();
  }

  if (state.draftPhase === "female" && state.draftOrder.female.length === 0) {
    state.draftOrder.female = shuffle([...state.wrestlers.female.map(w=>w.name)]);
    saveState();
  }

  // Re-read after init
  if (state.draftPhase === "male") {
    currentWrestler = state.draftOrder.male[state.draftIdx];
    queueLeft = state.draftOrder.male.length - state.draftIdx - 1;
  } else {
    currentWrestler = state.draftOrder.female[state.draftIdx];
    queueLeft = state.draftOrder.female.length - state.draftIdx - 1;
  }

  const genderLabel = state.draftPhase === "male" ? "MASCHILE" : "FEMMINILE";
  const genderColor = state.draftPhase === "male" ? "badge-gold" : "badge-purple";

  let draftResult = state._lastDraftResult || "";
  let draftResultHTML = draftResult ? `<div class="draft-result" style="background:rgba(201,162,39,0.1);border:1px solid var(--gold-dark);color:var(--gold);">→ Assegnato a: ${draftResult}</div>` : "";

  area.innerHTML = `
    <div class="draft-current-card">
      <div class="draft-queue-label">🎲 PROSSIMO AL DRAFT — ${queueLeft} in coda</div>
      <div class="draft-wrestler-name">${currentWrestler || "..."}</div>
      <span class="draft-gender-badge ${genderColor}" style="background:rgba(201,162,39,0.1);border:1px solid var(--gold-dark)">${genderLabel}</span>
      ${draftResultHTML}
      <br>
      <button class="btn btn-gold" onclick="draftNext()">🎲 ESTRAI DESTINAZIONE</button>
    </div>
    <div class="draft-progress text-muted">
      ${state.draftPhase === "male" ? `Maschi: ${state.draftIdx}/${state.draftOrder.male.length}` : `Femmine: ${state.draftIdx}/${state.draftOrder.female.length}`}
      ${maleDone ? " | ✅ Draft maschile completato" : ""}
    </div>
    ${poolsHTML}`;
}

function draftNext() {
  if (state.draftPhase === "male") {
    const name = state.draftOrder.male[state.draftIdx];
    const serieA = state.leagues.sam.wrestlers;
    const serieB = state.leagues.sbm.wrestlers;
    let dest;
    if (serieA.length >= 20) dest = "sbm";
    else if (serieB.length >= 20) dest = "sam";
    else dest = Math.random() < 0.5 ? "sam" : "sbm";
    state.leagues[dest].wrestlers.push(name);
    state._lastDraftResult = dest === "sam" ? "SERIE A MASCHILE" : "SERIE B MASCHILE";
    state.draftIdx++;
    if (state.draftIdx >= state.draftOrder.male.length) {
      state.draftPhase = "female";
      state.draftIdx = 0;
      state._lastDraftResult = "";
      // Init female order
      state.draftOrder.female = shuffle([...state.wrestlers.female.map(w=>w.name)]);
    }
  } else if (state.draftPhase === "female") {
    const name = state.draftOrder.female[state.draftIdx];
    state.leagues.saf.wrestlers.push(name);
    state._lastDraftResult = "SERIE A FEMMINILE";
    state.draftIdx++;
    if (state.draftIdx >= state.draftOrder.female.length) {
      state.draftPhase = "done";
      state._lastDraftResult = "";
    }
  }
  saveState();
  renderDraft();
}

function startSeason() {
  // Generate calendars
  state.leagues.sam.table = buildTable(state.leagues.sam.wrestlers);
  state.leagues.sbm.table = buildTable(state.leagues.sbm.wrestlers);
  state.leagues.saf.table = buildTable(state.leagues.saf.wrestlers);
  state.leagues.sam.calendar = buildCalendar(state.leagues.sam.wrestlers);
  state.leagues.sbm.calendar = buildCalendar(state.leagues.sbm.wrestlers);
  state.leagues.saf.calendar = buildCalendar(state.leagues.saf.wrestlers);
  state.leagues.sam.currentDay = 0;
  state.leagues.sbm.currentDay = 0;
  state.leagues.saf.currentDay = 0;
  state.leagues.sam.done = false;
  state.leagues.sbm.done = false;
  state.leagues.saf.done = false;
  state.phase = "league";
  // Init cups as null (start from season 2)
  state.cups = { male: null, female: null };
  state.champions = null;
  if (state.season >= 2) {
    initCups();
    initChampions();
  }
  saveState();
  renderAll();
  showTab("serie-a-m");
  toast("🚀 Stagione " + state.season + " iniziata!");
}

// ======= TABLE BUILDING =======
function buildTable(wrestlers) {
  const t = {};
  wrestlers.forEach(w => {
    t[w] = { pts: 0, wins: 0, losses: 0, played: 0 };
  });
  return t;
}

function buildCalendar(wrestlers) {
  // Round robin single round (each pair plays once)
  // 20 wrestlers = 19 rounds, each round 10 matches
  const n = wrestlers.length;
  const ws = [...wrestlers];
  if (n % 2 === 1) ws.push("BYE");
  const rounds = [];
  const half = ws.length / 2;
  let list = ws.slice(1);
  for (let r = 0; r < ws.length - 1; r++) {
    const round = [];
    const combo = [ws[0], ...list];
    for (let i = 0; i < half; i++) {
      const a = combo[i];
      const b = combo[combo.length - 1 - i];
      if (a !== "BYE" && b !== "BYE") round.push({ a, b, winner: null });
    }
    rounds.push(round);
    // Rotate list
    list = [list[list.length - 1], ...list.slice(0, list.length - 1)];
  }
  return rounds;
}

// ======= COMPETITION RENDER =======
function renderCompView(comp, view) {
  const container = document.getElementById(`comp-${comp}`);
  if (!container) return;
  if (state.phase === "draft" || (state.phase === "league" && !state.leagues[comp])) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">🔒</span>Draft non completato</div>`;
    return;
  }
  switch(view) {
    case "classifica": container.innerHTML = renderStandings(comp); break;
    case "calendario": container.innerHTML = renderCalendar(comp); break;
    case "giornata": container.innerHTML = renderGiornata(comp); break;
  }
}

function renderStandings(comp) {
  const league = state.leagues[comp];
  if (!league || !league.table) return `<div class="empty-state">Nessun dato</div>`;

  const sorted = sortTable(league.table, league.wrestlers);
  const isSAM = comp === "sam";
  const isSBM = comp === "sbm";
  const isSAF = comp === "saf";

  let html = `<div class="mega-table-wrapper"><table class="standings-table">
    <thead><tr>
      <th style="width:36px">#</th>
      <th>WRESTLER</th>
      <th class="right">G</th>
      <th class="right">V</th>
      <th class="right">S</th>
      <th class="right">PTS</th>
      <th></th>
    </tr></thead><tbody>`;

  sorted.forEach((w, i) => {
    const rank = i + 1;
    const st = league.table[w];
    let zoneClass = "";
    let zoneLabel = "";

    if (isSAM) {
      if (rank <= 1) { zoneClass = "zone-champ"; zoneLabel = `<span class="zone-label champ">CAMPIONE</span>`; }
      else if (rank <= 8) { zoneClass = "zone-cup"; zoneLabel = `<span class="zone-label cup">CHAMPIONS</span>`; }
      else if (rank >= 18) { zoneClass = "zone-retro"; zoneLabel = `<span class="zone-label retro">RETROCEDE</span>`; }
    }
    if (isSBM) {
      if (rank <= 3) { zoneClass = "zone-promo"; zoneLabel = `<span class="zone-label promo">PROMOSSO</span>`; }
    }
    if (isSAF) {
      if (rank <= 1) { zoneClass = "zone-champ"; zoneLabel = `<span class="zone-label champ">CAMPIONESSA</span>`; }
      else if (rank <= 8) { zoneClass = "zone-cup"; zoneLabel = `<span class="zone-label cup">CHAMPIONS</span>`; }
    }

    html += `<tr class="${zoneClass}">
      <td class="pos-num">${rank}</td>
      <td class="wrestler-name">${w}</td>
      <td class="num">${st.played}</td>
      <td class="num">${st.wins}</td>
      <td class="num">${st.losses}</td>
      <td class="pts">${st.pts}</td>
      <td>${zoneLabel}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;

  // Legend
  if (isSAM) html += `<div class="info-box" style="margin-top:12px">
    <strong>🏆</strong> 1° posto = World Heavyweight Champion | 
    <strong style="color:#64b5f6">Champions</strong> = Top 8 → Champions League | 
    <strong style="color:#ff6666">Retrocede</strong> = Ultimi 3 → Serie B</div>`;
  if (isSBM) html += `<div class="info-box" style="margin-top:12px">
    <strong style="color:#7dce9f">Promosso</strong> = Top 3 → Serie A Maschile</div>`;
  if (isSAF) html += `<div class="info-box" style="margin-top:12px">
    <strong>👑</strong> 1° posto = World IC Woman Champion | 
    <strong style="color:#64b5f6">Champions</strong> = Top 8 → Champions League</div>`;

  // Season done banner
  if (league.done) {
    html += renderLeagueDoneBanner(comp);
  }

  return html;
}

function renderLeagueDoneBanner(comp) {
  const allDone = state.leagues.sam.done && state.leagues.sbm.done && state.leagues.saf.done;
  return `<div class="info-box" style="border-color:var(--green);background:rgba(39,174,96,0.06)">
    ✅ <strong>Stagione regolare completata!</strong>
    ${allDone ? `<br><button class="btn btn-gold" style="margin-top:10px" onclick="checkAllDone()">🏁 CONCLUDI STAGIONE</button>` : ""}
  </div>`;
}

function renderCalendar(comp) {
  const league = state.leagues[comp];
  if (!league || !league.calendar || league.calendar.length === 0)
    return `<div class="empty-state"><span class="big-icon">📅</span>Nessun calendario generato</div>`;

  let html = "";
  league.calendar.forEach((round, ri) => {
    const isDone = ri < league.currentDay;
    html += `<div class="match-day-header">GIORNATA ${ri + 1} ${isDone ? "✓" : ""}</div>`;
    round.forEach(m => {
      if (m.winner) {
        const aWon = m.winner === m.a;
        html += `<div class="match-card result">
          <span class="wrestler-a ${aWon ? "winner" : "loser"}">${m.a}</span>
          <span class="result-badge">${aWon ? "V — S" : "S — V"}</span>
          <span class="wrestler-b ${!aWon ? "winner" : "loser"}">${m.b}</span>
        </div>`;
      } else {
        html += `<div class="match-card">
          <span class="wrestler-a">${m.a}</span>
          <span class="vs-badge">VS</span>
          <span class="wrestler-b">${m.b}</span>
        </div>`;
      }
    });
  });
  return html;
}

function renderGiornata(comp) {
  const league = state.leagues[comp];
  if (!league || !league.calendar) return "";

  if (league.done) {
    return `<div class="empty-state"><span class="big-icon">🏁</span>Stagione regolare conclusa!</div>`;
  }

  const dayIdx = league.currentDay;
  if (dayIdx >= league.calendar.length) {
    league.done = true;
    saveState();
    return renderGiornata(comp);
  }

  const round = league.calendar[dayIdx];
  const allSimulated = round.every(m => m.winner !== null);

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:var(--gold-light)">GIORNATA ${dayIdx + 1}</span>
      <span class="text-muted" style="font-size:0.85rem;margin-left:10px">di ${league.calendar.length}</span>
    </div>`;

  if (!allSimulated) {
    html += `<button class="btn btn-gold" onclick="simulateNextMatch('${comp}')">🎲 SIMULA PROSSIMO MATCH</button>`;
  } else {
    html += `<button class="btn btn-gold" onclick="advanceDay('${comp}')">➡️ PROSSIMA GIORNATA</button>`;
  }
  html += `</div>`;

  // Find which match is next
  const nextMatchIdx = round.findIndex(m => m.winner === null);

  round.forEach((m, mi) => {
    if (m.winner) {
      const aWon = m.winner === m.a;
      html += `<div class="match-card result">
        <span class="wrestler-a ${aWon ? "winner" : "loser"}">${m.a}</span>
        <span class="result-badge">${aWon ? "V — S" : "S — V"}</span>
        <span class="wrestler-b ${!aWon ? "winner" : "loser"}">${m.b}</span>
      </div>`;
    } else if (mi === nextMatchIdx) {
      html += `<div class="match-card" style="border-color:var(--gold);animation:pulse 1s ease infinite alternate">
        <span class="wrestler-a">${m.a}</span>
        <span class="vs-badge" style="animation:none">VS</span>
        <span class="wrestler-b">${m.b}</span>
      </div>`;
    } else {
      html += `<div class="match-card" style="opacity:0.5">
        <span class="wrestler-a">${m.a}</span>
        <span class="vs-badge">VS</span>
        <span class="wrestler-b">${m.b}</span>
      </div>`;
    }
  });

  return html;
}

function simulateNextMatch(comp) {
  const league = state.leagues[comp];
  const round = league.calendar[league.currentDay];
  const nextMatch = round.find(m => m.winner === null);
  if (!nextMatch) return;
  nextMatch.winner = Math.random() < 0.5 ? nextMatch.a : nextMatch.b;
  const loser = nextMatch.winner === nextMatch.a ? nextMatch.b : nextMatch.a;
  // Update table immediately for live view, but only once
  if (!nextMatch._counted) {
    league.table[nextMatch.winner].pts += 2;
    league.table[nextMatch.winner].wins += 1;
    league.table[nextMatch.winner].played += 1;
    league.table[loser].losses += 1;
    league.table[loser].played += 1;
    nextMatch._counted = true;
    // Mega stats
    updateMegaStats(nextMatch.winner, loser);
  }
  saveState();
  renderCompView(comp, "giornata");
}

function advanceDay(comp) {
  const league = state.leagues[comp];
  league.currentDay++;
  if (league.currentDay >= league.calendar.length) {
    league.done = true;
    saveState();
    renderCompView(comp, "classifica");
    // Switch to classifica view
    document.querySelectorAll(`.comp-tab[data-comp="${comp}"]`).forEach(b => b.classList.remove("active"));
    const clasTab = document.querySelector(`.comp-tab[data-comp="${comp}"][data-view="classifica"]`);
    if (clasTab) clasTab.classList.add("active");
    checkAllDone();
  } else {
    saveState();
    renderCompView(comp, "giornata");
  }
}

function updateMegaStats(winner, loser) {
  if (!state.megaStats[winner]) state.megaStats[winner] = { pts: 0, wins: 0, losses: 0, titles: [] };
  if (!state.megaStats[loser]) state.megaStats[loser] = { pts: 0, wins: 0, losses: 0, titles: [] };
  state.megaStats[winner].pts += 2;
  state.megaStats[winner].wins += 1;
  state.megaStats[loser].losses += 1;
}

// ======= CUPS =======
function initCups() {
  if (state.season < 2) return;

  // Male cup: top 8 SAM + top 8 SBM
  const samTop8 = sortTable(state.history[state.history.length-1]?.samFinalTable || state.leagues.sam.table, state.leagues.sam.wrestlers).slice(0, 8);
  const sbmTop8 = sortTable(state.history[state.history.length-1]?.sbmFinalTable || state.leagues.sbm.table, state.leagues.sbm.wrestlers).slice(0, 8);
  const maleCupWrestlers = shuffle([...samTop8, ...sbmTop8]);

  // Build ottavi (8 matches)
  const malePairs = buildKOPairs(maleCupWrestlers);
  state.cups.male = { bracket: [malePairs], currentRound: 0, done: false, rounds: ["Ottavi","Quarti","Semifinali","Finale"] };

  // Female cup: top 16 SAF
  const safTop16 = sortTable(state.leagues.saf.table, state.leagues.saf.wrestlers).slice(0, 16);
  const femalePairs = buildKOPairs(shuffle(safTop16));
  state.cups.female = { bracket: [femalePairs], currentRound: 0, done: false, rounds: ["Ottavi","Quarti","Semifinali","Finale"] };
}

function buildKOPairs(wrestlers) {
  const pairs = [];
  for (let i = 0; i < wrestlers.length; i += 2) {
    pairs.push({ a: wrestlers[i], b: wrestlers[i+1] || "BYE", winner: null });
  }
  return pairs;
}

function renderCoppa(gender) {
  const container = document.getElementById(`comp-coppa-${gender === "male" ? "m" : "f"}`);
  if (!container) return;

  if (state.season < 2 || !state.cups[gender]) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">🔒</span>La Coppa inizia dalla stagione 2</div>`;
    return;
  }

  const cup = state.cups[gender];
  let html = "";

  // Bracket display
  html += `<div class="cup-bracket"><div class="bracket-rounds">`;
  cup.bracket.forEach((round, ri) => {
    const roundName = cup.rounds[ri] || `Round ${ri+1}`;
    html += `<div class="bracket-round">
      <div class="bracket-round-title">${roundName}</div>`;
    round.forEach((m, mi) => {
      const aWon = m.winner === m.a;
      const bWon = m.winner === m.b;
      html += `<div class="bracket-match">
        <div class="bm-wrestler ${aWon ? "winner" : (m.winner ? "loser" : "")}">${m.a || "TBD"}</div>
        <div class="bm-wrestler ${bWon ? "winner" : (m.winner ? "loser" : "")}">${m.b || "TBD"}</div>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div></div>`;

  // Action buttons
  const lastRound = cup.bracket[cup.currentRound];
  const nextMatch = lastRound ? lastRound.find(m => m.winner === null && m.b !== "BYE") : null;
  const byeMatches = lastRound ? lastRound.filter(m => m.b === "BYE") : [];
  byeMatches.forEach(m => { if (!m.winner) { m.winner = m.a; } });

  if (!cup.done) {
    const allRoundDone = lastRound && lastRound.every(m => m.winner !== null);
    if (allRoundDone && cup.currentRound < cup.bracket.length) {
      // Advance to next round
      const winners = lastRound.map(m => m.winner);
      if (winners.length === 1) {
        cup.done = true;
        cup.winner = winners[0];
        // Record title
        const titleKey = gender === "male" ? "coppaNM" : "coppaNF";
        if (state.megaStats[winners[0]]) state.megaStats[winners[0]].titles.push(`${titleKey} S${state.season}`);
        saveState();
        html += `<div class="season-end-banner" style="margin-top:16px">
          <h2>🏆 VINCITORE: ${winners[0]}</h2>
          <p>${gender === "male" ? "United States Champion!" : "Divas Champion!"}</p>
        </div>`;
      } else {
        html += `<div class="btn-row"><button class="btn btn-gold" onclick="advanceCupRound('${gender}')">➡️ PROSSIMO TURNO</button></div>`;
      }
    } else if (nextMatch) {
      html += `<div class="btn-row"><button class="btn btn-gold" onclick="simulateCupMatch('${gender}')">🎲 SIMULA PROSSIMO MATCH</button></div>`;
    }
  } else {
    html += `<div class="info-box"><strong>🏆 Campione:</strong> ${cup.winner}</div>`;
  }

  container.innerHTML = html;
  saveState();
}

function simulateCupMatch(gender) {
  const cup = state.cups[gender];
  const round = cup.bracket[cup.currentRound];
  const m = round.find(m => m.winner === null && m.b !== "BYE");
  if (!m) return;
  m.winner = Math.random() < 0.5 ? m.a : m.b;
  const loser = m.winner === m.a ? m.b : m.a;
  updateMegaStats(m.winner, loser);
  saveState();
  renderCoppa(gender);
}

function advanceCupRound(gender) {
  const cup = state.cups[gender];
  const round = cup.bracket[cup.currentRound];
  const winners = round.map(m => m.winner);
  const nextRound = buildKOPairs(winners);
  cup.bracket.push(nextRound);
  cup.currentRound++;
  saveState();
  renderCoppa(gender);
}

// ======= CHAMPIONS LEAGUE =======
function initChampions() {
  if (state.season < 2) return;
  // Use previous season's top 8 SAM and top 8 SAF
  const prev = state.history[state.history.length - 1];
  if (!prev) return;
  const malePool = (prev.samTop8 || []).slice(0, 8);
  const femalePool = (prev.safTop8 || []).slice(0, 8);
  const allParticipants = shuffle([
    ...malePool.map(n => ({ name: n, gender: "male" })),
    ...femalePool.map(n => ({ name: n, gender: "female" }))
  ]);

  // 4 groups of 4 (mixed)
  const groups = [];
  for (let g = 0; g < 4; g++) {
    const members = allParticipants.slice(g * 4, g * 4 + 4);
    groups.push({
      name: "GRUPPO " + String.fromCharCode(65 + g),
      members: members.map(m => ({ name: m.name, gender: m.gender, pts: 0, wins: 0, losses: 0, played: 0 })),
      calendar: buildCalendar(members.map(m => m.name)),
      currentDay: 0,
      done: false
    });
  }
  state.champions = {
    groups,
    phase: "groups",
    koRounds: [],
    currentKORound: 0,
    done: false,
    winner: null
  };
}

function renderChampions() {
  const container = document.getElementById("comp-champions");
  if (!container) return;

  if (state.season < 2 || !state.champions) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">⭐</span>La Champions League inizia dalla stagione 2</div>`;
    return;
  }

  const ch = state.champions;
  let html = "";

  if (ch.done) {
    html += `<div class="season-end-banner"><h2>🏆 ${ch.winner}</h2><p>Undisputed WWE Champion!</p></div>`;
  }

  if (ch.phase === "groups" || (ch.phase === "ko" && ch.koRounds.length > 0)) {
    // Groups
    html += `<h3 style="font-family:'Bebas Neue',sans-serif;color:var(--gold-light);font-size:1.4rem;margin-bottom:12px">FASE A GIRONI</h3>`;
    html += `<div class="groups-grid">`;
    ch.groups.forEach((g, gi) => {
      const sorted = [...g.members].sort((a, b) => b.pts - a.pts || b.wins - a.wins);
      html += `<div class="group-card">
        <div class="group-card-header">${g.name}</div>`;
      sorted.forEach((m, mi) => {
        html += `<div class="group-member ${mi < 2 ? "qualified" : ""}">
          <span class="gm-pos">${mi+1}</span>
          <span class="gm-name">${m.name}</span>
          <span class="gm-gender">${m.gender === "male" ? "♂" : "♀"}</span>
          <span class="gm-pts">${m.pts}</span>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;

    // Group stage controls
    if (ch.phase === "groups") {
      const someGroupNotDone = ch.groups.some(g => !g.done);
      if (someGroupNotDone) {
        // Find active group
        const activeGroup = ch.groups.find(g => !g.done);
        if (activeGroup) {
          const gIdx = ch.groups.indexOf(activeGroup);
          const dayIdx = activeGroup.currentDay;
          const round = activeGroup.calendar[dayIdx];
          const nextMatch = round ? round.find(m => m.winner === null) : null;
          const allDone = round ? round.every(m => m.winner !== null) : true;
          html += `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:16px;margin-top:16px">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:1rem;color:#64b5f6;margin-bottom:10px">
              ${activeGroup.name} — GIORNATA ${dayIdx + 1}/${activeGroup.calendar.length}
            </div>`;
          if (nextMatch && !allDone) {
            round.forEach(m => {
              if (m.winner) {
                html += `<div class="match-card result" style="border-color:rgba(0,102,204,0.3)">
                  <span class="wrestler-a ${m.winner===m.a?"winner":"loser"}">${m.a}</span>
                  <span class="result-badge" style="background:rgba(0,102,204,0.1);border-color:rgba(0,102,204,0.3);color:#64b5f6">${m.winner===m.a?"V — S":"S — V"}</span>
                  <span class="wrestler-b ${m.winner===m.b?"winner":"loser"}">${m.b}</span>
                </div>`;
              } else {
                html += `<div class="match-card" style="border-color:rgba(0,102,204,0.2)">
                  <span class="wrestler-a">${m.a}</span>
                  <span class="vs-badge" style="border-color:#64b5f6;color:#64b5f6">VS</span>
                  <span class="wrestler-b">${m.b}</span>
                </div>`;
              }
            });
            html += `<div class="btn-row"><button class="btn btn-gold" onclick="simChampGroupMatch(${gIdx})">🎲 SIMULA MATCH</button></div>`;
          } else if (allDone) {
            html += `<div class="btn-row"><button class="btn btn-gold" onclick="advChampGroupDay(${gIdx})">➡️ PROSSIMA GIORNATA GRUPPO</button></div>`;
          }
          html += `</div>`;
        }
      } else {
        // All groups done, advance to KO
        html += `<div class="btn-row"><button class="btn btn-gold btn-lg" onclick="startChampKO()">⚡ INIZIA FASE A ELIMINAZIONE</button></div>`;
      }
    }
  }

  // KO phase
  if (ch.phase === "ko" && ch.koRounds.length > 0) {
    html += `<h3 style="font-family:'Bebas Neue',sans-serif;color:var(--gold-light);font-size:1.4rem;margin:20px 0 12px">FASE AD ELIMINAZIONE</h3>`;
    html += `<div class="cup-bracket"><div class="bracket-rounds">`;
    const koNames = ["Quarti","Semifinali","Finale"];
    ch.koRounds.forEach((round, ri) => {
      html += `<div class="bracket-round"><div class="bracket-round-title">${koNames[ri] || "Round"}</div>`;
      round.forEach(m => {
        html += `<div class="bracket-match">
          <div class="bm-wrestler ${m.winner===m.a?"winner":(m.winner?"loser":"")}">${m.a||"TBD"}</div>
          <div class="bm-wrestler ${m.winner===m.b?"winner":(m.winner?"loser":"")}">${m.b||"TBD"}</div>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div></div>`;

    if (!ch.done) {
      const lastRound = ch.koRounds[ch.currentKORound];
      const nextM = lastRound ? lastRound.find(m => m.winner === null) : null;
      const allDone = lastRound ? lastRound.every(m => m.winner !== null) : true;
      if (nextM) {
        html += `<div class="btn-row"><button class="btn btn-gold" onclick="simChampKOMatch()">🎲 SIMULA MATCH KO</button></div>`;
      } else if (allDone) {
        const winners = lastRound.map(m => m.winner);
        if (winners.length === 1) {
          ch.done = true; ch.winner = winners[0];
          if (state.megaStats[winners[0]]) state.megaStats[winners[0]].titles.push(`Champions S${state.season}`);
          saveState();
        } else {
          html += `<div class="btn-row"><button class="btn btn-gold" onclick="advChampKORound()">➡️ PROSSIMO TURNO KO</button></div>`;
        }
      }
    }
  }

  container.innerHTML = html;
}

function simChampGroupMatch(gIdx) {
  const g = state.champions.groups[gIdx];
  const round = g.calendar[g.currentDay];
  const m = round.find(m => m.winner === null);
  if (!m) return;
  m.winner = Math.random() < 0.5 ? m.a : m.b;
  const loser = m.winner === m.a ? m.b : m.a;
  const wm = g.members.find(x => x.name === m.winner);
  const lm = g.members.find(x => x.name === loser);
  if (wm) { wm.pts += 2; wm.wins++; wm.played++; }
  if (lm) { lm.losses++; lm.played++; }
  updateMegaStats(m.winner, loser);
  if (!m._counted) m._counted = true;
  saveState();
  renderChampions();
}

function advChampGroupDay(gIdx) {
  const g = state.champions.groups[gIdx];
  g.currentDay++;
  if (g.currentDay >= g.calendar.length) g.done = true;
  saveState();
  renderChampions();
}

function startChampKO() {
  // Take top 2 from each group
  const qualifiers = [];
  state.champions.groups.forEach(g => {
    const sorted = [...g.members].sort((a, b) => b.pts - a.pts);
    qualifiers.push(sorted[0], sorted[1]);
  });
  const shuffled = shuffle(qualifiers.map(q => q.name));
  const pairs = buildKOPairs(shuffled);
  state.champions.koRounds = [pairs];
  state.champions.currentKORound = 0;
  state.champions.phase = "ko";
  saveState();
  renderChampions();
}

function simChampKOMatch() {
  const ch = state.champions;
  const round = ch.koRounds[ch.currentKORound];
  const m = round.find(m => m.winner === null);
  if (!m) return;
  m.winner = Math.random() < 0.5 ? m.a : m.b;
  const loser = m.winner === m.a ? m.b : m.a;
  updateMegaStats(m.winner, loser);
  saveState();
  renderChampions();
}

function advChampKORound() {
  const ch = state.champions;
  const round = ch.koRounds[ch.currentKORound];
  const winners = round.map(m => m.winner);
  if (winners.length === 1) {
    ch.done = true; ch.winner = winners[0];
    saveState(); renderChampions(); return;
  }
  const nextRound = buildKOPairs(winners);
  ch.koRounds.push(nextRound);
  ch.currentKORound++;
  saveState();
  renderChampions();
}

// ======= SEASON END =======
function checkAllDone() {
  const leaguesDone = state.leagues.sam.done && state.leagues.sbm.done && state.leagues.saf.done;
  if (!leaguesDone) { toast("Non tutte le leghe sono completate!"); return; }
  state.phase = "season_end";
  saveState();
  renderDraft();
  showTab("draft");
}

function renderSeasonEnd(area) {
  const sam = sortTable(state.leagues.sam.table, state.leagues.sam.wrestlers);
  const sbm = sortTable(state.leagues.sbm.table, state.leagues.sbm.wrestlers);
  const saf = sortTable(state.leagues.saf.table, state.leagues.saf.wrestlers);

  const champSAM = resolveChamp("sam");
  const champSAF = resolveChamp("saf");

  area.innerHTML = `<div class="season-end-banner">
    <h2>🏁 FINE STAGIONE ${state.season}</h2>
    <div class="champions-list">
      <div class="champion-tag">
        <div class="title-name">WORLD HEAVYWEIGHT CHAMPION</div>
        <div class="title-holder">🏆 ${champSAM}</div>
      </div>
      <div class="champion-tag">
        <div class="title-name">WORLD IC WOMAN CHAMPION</div>
        <div class="title-holder">👑 ${champSAF}</div>
      </div>
      ${state.cups.male?.winner ? `<div class="champion-tag"><div class="title-name">UNITED STATES CHAMPION</div><div class="title-holder">🇺🇸 ${state.cups.male.winner}</div></div>` : ""}
      ${state.cups.female?.winner ? `<div class="champion-tag"><div class="title-name">DIVAS CHAMPION</div><div class="title-holder">💎 ${state.cups.female.winner}</div></div>` : ""}
      ${state.champions?.winner ? `<div class="champion-tag"><div class="title-name">UNDISPUTED WWE CHAMPION</div><div class="title-holder">⭐ ${state.champions.winner}</div></div>` : ""}
    </div>
    <div class="info-box" style="text-align:left;margin:16px 0">
      <strong>PROMOZIONI:</strong> ${sbm.slice(0,3).join(", ")} → Serie A Maschile<br>
      <strong>RETROCESSIONI:</strong> ${sam.slice(-3).join(", ")} → Serie B Maschile
    </div>
    <button class="btn btn-gold btn-lg" onclick="startNextSeason()">🚀 INIZIA STAGIONE ${state.season + 1}</button>
  </div>`;

  // Record titles in mega stats
  recordSeasonTitles(champSAM, champSAF);
}

function resolveChamp(comp) {
  const sorted = sortTable(state.leagues[comp].table, state.leagues[comp].wrestlers);
  if (sorted.length < 2) return sorted[0] || "N/D";
  const first = state.leagues[comp].table[sorted[0]];
  const second = state.leagues[comp].table[sorted[1]];
  if (first.pts > second.pts) return sorted[0];
  // Tie — spin wheel
  return spinWheelTie([sorted[0], sorted[1]]);
}

function spinWheelTie(candidates) {
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function recordSeasonTitles(champM, champF) {
  if (!state.megaStats[champM]) state.megaStats[champM] = { pts: 0, wins: 0, losses: 0, titles: [] };
  if (!state.megaStats[champF]) state.megaStats[champF] = { pts: 0, wins: 0, losses: 0, titles: [] };
  state.megaStats[champM].titles.push(`World Heavyweight S${state.season}`);
  state.megaStats[champF].titles.push(`World IC Woman S${state.season}`);
}

function startNextSeason() {
  const samSorted = sortTable(state.leagues.sam.table, state.leagues.sam.wrestlers);
  const sbmSorted = sortTable(state.leagues.sbm.table, state.leagues.sbm.wrestlers);
  const safSorted = sortTable(state.leagues.saf.table, state.leagues.saf.wrestlers);
  const champSAM = resolveChamp("sam");
  const champSAF = resolveChamp("saf");

  // Save to history
  state.history.push({
    season: state.season,
    serieAM: champSAM,
    serieAF: champSAF,
    champions: state.champions?.winner || null,
    coppaNM: state.cups.male?.winner || null,
    coppaNF: state.cups.female?.winner || null,
    promotions: sbmSorted.slice(0, 3),
    relegations: samSorted.slice(-3),
    samTop8: samSorted.slice(0, 8),
    safTop8: safSorted.slice(0, 8),
    samFinalTable: { ...state.leagues.sam.table },
    sbmFinalTable: { ...state.leagues.sbm.table }
  });

  // Promotions / Relegations for SAM
  const promoted = sbmSorted.slice(0, 3);
  const relegated = samSorted.slice(-3);
  let newSAM = samSorted.slice(0, -3).concat(promoted);
  let newSBM = sbmSorted.slice(3).concat(relegated);

  state.season++;
  state.phase = "league";
  state.leagues.sam.wrestlers = newSAM;
  state.leagues.sbm.wrestlers = newSBM;
  // SAF stays the same
  state.leagues.sam.table = buildTable(newSAM);
  state.leagues.sbm.table = buildTable(newSBM);
  state.leagues.saf.table = buildTable(state.leagues.saf.wrestlers);
  state.leagues.sam.calendar = buildCalendar(newSAM);
  state.leagues.sbm.calendar = buildCalendar(newSBM);
  state.leagues.saf.calendar = buildCalendar(state.leagues.saf.wrestlers);
  state.leagues.sam.currentDay = 0;
  state.leagues.sbm.currentDay = 0;
  state.leagues.saf.currentDay = 0;
  state.leagues.sam.done = false;
  state.leagues.sbm.done = false;
  state.leagues.saf.done = false;

  initCups();
  initChampions();
  saveState();
  document.getElementById("season-label").textContent = "STAGIONE " + state.season;
  renderAll();
  showTab("serie-a-m");
  toast("🚀 Stagione " + state.season + " iniziata!");
}

function getSeasonStatusHTML() {
  const s = state;
  const samPct = s.leagues.sam.calendar.length > 0 ? Math.round((s.leagues.sam.currentDay / s.leagues.sam.calendar.length) * 100) : 0;
  const sbmPct = s.leagues.sbm.calendar.length > 0 ? Math.round((s.leagues.sbm.currentDay / s.leagues.sbm.calendar.length) * 100) : 0;
  const safPct = s.leagues.saf.calendar.length > 0 ? Math.round((s.leagues.saf.currentDay / s.leagues.saf.calendar.length) * 100) : 0;
  return `<div class="info-box">
    <strong>📊 STATO STAGIONE ${s.season}</strong><br>
    Serie A ♂: ${s.leagues.sam.currentDay}/${s.leagues.sam.calendar.length} giornate ${s.leagues.sam.done ? "✅" : ""}<br>
    Serie B ♂: ${s.leagues.sbm.currentDay}/${s.leagues.sbm.calendar.length} giornate ${s.leagues.sbm.done ? "✅" : ""}<br>
    Serie A ♀: ${s.leagues.saf.currentDay}/${s.leagues.saf.calendar.length} giornate ${s.leagues.saf.done ? "✅" : ""}
    ${s.season >= 2 ? "<br>Coppa ♂: " + (s.cups.male?.done ? "✅ " + s.cups.male.winner : "In corso") : ""}
    ${s.season >= 2 ? "<br>Coppa ♀: " + (s.cups.female?.done ? "✅ " + s.cups.female.winner : "In corso") : ""}
    ${s.season >= 2 && s.champions ? "<br>Champions: " + (s.champions.done ? "✅ " + s.champions.winner : "In corso") : ""}
  </div>`;
}

// ======= ROSTER =======
function renderRoster() {
  const container = document.getElementById("roster-content");
  if (!container) return;

  let html = `<div class="roster-filters">
    <button class="roster-filter-btn active" onclick="filterRoster('all', this)">TUTTI</button>
    <button class="roster-filter-btn" onclick="filterRoster('sam', this)">SERIE A ♂</button>
    <button class="roster-filter-btn" onclick="filterRoster('sbm', this)">SERIE B ♂</button>
    <button class="roster-filter-btn" onclick="filterRoster('saf', this)">SERIE A ♀</button>
  </div>
  <div class="roster-grid" id="roster-grid">`;

  const allWrestlers = [
    ...state.leagues.sam.wrestlers.map(n => ({ name: n, league: "sam" })),
    ...state.leagues.sbm.wrestlers.map(n => ({ name: n, league: "sbm" })),
    ...state.leagues.saf.wrestlers.map(n => ({ name: n, league: "saf" })),
    ...state.wrestlers.male.filter(w => !isWrestlerInLeague(w.name)).map(w => ({ name: w.name, league: "pool" })),
    ...state.wrestlers.female.filter(w => !isWrestlerInLeague(w.name)).map(w => ({ name: w.name, league: "pool" }))
  ];

  allWrestlers.forEach(w => {
    const gender = isFemale(w.name) ? "female" : "male";
    const leagueLabel = { sam: "Serie A ♂", sbm: "Serie B ♂", saf: "Serie A ♀", pool: "Non assegnato" }[w.league];
    const initials = w.name.split(" ").map(s=>s[0]).join("").toUpperCase().slice(0,2);
    html += `<div class="roster-card" data-league="${w.league}" onclick="editWrestler('${escapeStr(w.name)}')">
      <div class="roster-card-avatar ${gender}">${initials}</div>
      <div class="roster-card-info">
        <div class="roster-card-name">${w.name}</div>
        <div class="roster-card-league">${leagueLabel}</div>
      </div>
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function filterRoster(league, btn) {
  document.querySelectorAll(".roster-filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".roster-card").forEach(card => {
    card.style.display = (league === "all" || card.dataset.league === league) ? "" : "none";
  });
}

function isWrestlerInLeague(name) {
  return state.leagues.sam.wrestlers.includes(name) ||
    state.leagues.sbm.wrestlers.includes(name) ||
    state.leagues.saf.wrestlers.includes(name);
}

function isFemale(name) {
  return state.wrestlers.female.some(w => w.name === name) ||
    state.leagues.saf.wrestlers.includes(name);
}

function editWrestler(name) {
  const stats = state.megaStats[name] || { pts: 0, wins: 0, losses: 0, titles: [] };
  const league = state.leagues.sam.wrestlers.includes(name) ? "sam" :
    state.leagues.sbm.wrestlers.includes(name) ? "sbm" :
    state.leagues.saf.wrestlers.includes(name) ? "saf" : "none";
  const leagueLabel = { sam: "Serie A ♂", sbm: "Serie B ♂", saf: "Serie A ♀", none: "Non assegnato" }[league];

  showModal(`
    <h3>✏️ ${name}</h3>
    <div class="info-box">
      <div class="stat-row"><span class="stat-label">Lega</span><span class="stat-val">${leagueLabel}</span></div>
      <div class="stat-row"><span class="stat-label">Punti totali</span><span class="stat-val text-gold">${stats.pts}</span></div>
      <div class="stat-row"><span class="stat-label">Vittorie</span><span class="stat-val text-green">${stats.wins}</span></div>
      <div class="stat-row"><span class="stat-label">Sconfitte</span><span class="stat-val text-muted">${stats.losses}</span></div>
      <div class="stat-row"><span class="stat-label">Titoli</span><span class="stat-val">${stats.titles.length > 0 ? stats.titles.join(", ") : "Nessuno"}</span></div>
    </div>
    <div class="edit-form">
      <div>
        <label>MODIFICA NOME</label>
        <input type="text" id="edit-name-input" value="${name}" placeholder="Nome wrestler">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn btn-gold" onclick="saveWrestlerEdit('${escapeStr(name)}')">💾 Salva</button>
    </div>
  `);
}

function saveWrestlerEdit(oldName) {
  const newName = document.getElementById("edit-name-input").value.trim();
  if (!newName || newName === oldName) { closeModal(); return; }

  // Rename in all places
  const rename = arr => arr.map(n => n === oldName ? newName : n);
  state.leagues.sam.wrestlers = rename(state.leagues.sam.wrestlers);
  state.leagues.sbm.wrestlers = rename(state.leagues.sbm.wrestlers);
  state.leagues.saf.wrestlers = rename(state.leagues.saf.wrestlers);
  state.wrestlers.male = state.wrestlers.male.map(w => w.name === oldName ? { ...w, name: newName } : w);
  state.wrestlers.female = state.wrestlers.female.map(w => w.name === oldName ? { ...w, name: newName } : w);

  // Rename in tables
  ['sam','sbm','saf'].forEach(comp => {
    const t = state.leagues[comp].table;
    if (t[oldName]) { t[newName] = t[oldName]; delete t[oldName]; }
    state.leagues[comp].calendar.forEach(round => {
      round.forEach(m => {
        if (m.a === oldName) m.a = newName;
        if (m.b === oldName) m.b = newName;
        if (m.winner === oldName) m.winner = newName;
      });
    });
  });

  // Rename in mega stats
  if (state.megaStats[oldName]) {
    state.megaStats[newName] = state.megaStats[oldName];
    delete state.megaStats[oldName];
  }

  saveState();
  closeModal();
  renderRoster();
  toast(`✅ Rinominato: ${oldName} → ${newName}`);
}

// ======= STORICO =======
function renderStorico() {
  const container = document.getElementById("storico-content");
  if (!container) return;

  if (state.history.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">📜</span>Nessuna stagione completata ancora</div>`;
    return;
  }

  let html = "";

  // Albo d'oro per competizione
  const albos = [
    { key: "serieAM", title: "🏆 World Heavyweight Champions" },
    { key: "serieAF", title: "👑 World IC Woman Champions" },
    { key: "champions", title: "⭐ Undisputed WWE Champions" },
    { key: "coppaNM", title: "🇺🇸 United States Champions" },
    { key: "coppaNF", title: "💎 Divas Champions" }
  ];

  albos.forEach(a => {
    html += `<div class="albo-oro-card">
      <h3>${a.title}</h3>`;
    state.history.forEach(h => {
      if (h[a.key]) {
        html += `<div class="champion-entry">
          <span class="season-num">Stagione ${h.season}</span>
          <span class="champ-name">${h[a.key]}</span>
        </div>`;
      }
    });
    html += `</div>`;
  });

  // Mega classifica
  html += `<div class="albo-oro-card">
    <h3>📊 MEGA CLASSIFICA ALL-TIME</h3>
    <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px">Ogni 10 stagioni, il primo vince il titolo decennale</p>
    <div class="mega-table-wrapper"><table class="mega-table">
      <thead><tr>
        <th>#</th>
        <th>WRESTLER</th>
        <th>PTS</th>
        <th>V</th>
        <th>S</th>
        <th>TITOLI</th>
      </tr></thead><tbody>`;

  const allStats = Object.entries(state.megaStats)
    .sort((a, b) => b[1].pts - a[1].pts);

  allStats.forEach(([name, st], i) => {
    const isDecennale = (state.season - 1) % 10 === 0 && i === 0;
    html += `<tr>
      <td class="rank">${i+1}</td>
      <td>${name} ${isDecennale ? '<span class="badge badge-gold">CAMPIONE DECADE</span>' : ""}</td>
      <td class="pts-mega">${st.pts}</td>
      <td style="color:var(--green)">${st.wins}</td>
      <td style="color:var(--text-muted)">${st.losses}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${st.titles.length}</td>
    </tr>`;
  });

  html += `</tbody></table></div></div>`;

  // Promozioni/Retrocessioni storia
  if (state.history.some(h => h.promotions)) {
    html += `<div class="albo-oro-card">
      <h3>⬆️⬇️ STORICO MOVIMENTI</h3>`;
    state.history.forEach(h => {
      if (h.promotions) {
        html += `<div class="champion-entry">
          <span class="season-num">S${h.season}</span>
          <span class="champ-name" style="font-size:0.85rem">
            <span style="color:var(--green)">▲ ${h.promotions.join(", ")}</span>
            &nbsp;|&nbsp;
            <span style="color:var(--red)">▼ ${h.relegations.join(", ")}</span>
          </span>
        </div>`;
      }
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

// ======= BACKUP / RESTORE =======
function doBackup() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wfl_backup_s${state.season}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("💾 Backup scaricato!");
}

function doRestore(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      state = JSON.parse(ev.target.result);
      saveState();
      renderAll();
      toast("✅ Backup ripristinato!");
    } catch(err) {
      toast("❌ Errore nel file di backup");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function confirmReset() {
  showModal(`
    <h3>🗑️ RESET TOTALE</h3>
    <p>Sei sicuro di voler cancellare <strong style="color:var(--red)">TUTTI i dati</strong>?<br>
    Stagioni, classifiche, storico, tutto verrà eliminato definitivamente.</p>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn btn-red" onclick="doReset()">🗑️ SÌ, RESETTA TUTTO</button>
    </div>
  `);
}

function doReset() {
  localStorage.removeItem("wfl_state");
  state = freshState();
  saveState();
  closeModal();
  renderAll();
  showTab("draft");
  toast("🗑️ Reset completato");
}

// ======= HELPERS =======
function sortTable(table, wrestlers) {
  return [...wrestlers].sort((a, b) => {
    const ta = table[a] || { pts: 0, wins: 0 };
    const tb = table[b] || { pts: 0, wins: 0 };
    if (tb.pts !== ta.pts) return tb.pts - ta.pts;
    return tb.wins - ta.wins;
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeStr(s) {
  return s.replace(/'/g, "\\'");
}

function showTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.classList.toggle("active", p.id === "tab-" + tab);
  });
  renderTab(tab);
}

function showModal(html) {
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
