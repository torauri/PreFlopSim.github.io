/* ==========================================================================
   PREFLOP TRAINER - CORE APPLICATION LOGIC
   ========================================================================== */

// Card Constants
const SUITS = [
  { id: 's', symbol: '♠', color: 'black-suit' },
  { id: 'h', symbol: '♥', color: 'red-suit' },
  { id: 'd', symbol: '♦', color: 'red-suit' },
  { id: 'c', symbol: '♣', color: 'black-suit' }
];

const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const POSITIONS_9 = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSITIONS_6 = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSITIONS_3 = ['BTN', 'SB', 'BB'];

// Default Range Grid (13x13)
// Row/Col order: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2
const DEFAULT_RANGE = [
  [ 7, 7, 6, 6, 6, 4, 4, 4, 4, 4, 4, 4, 4 ],
  [ 7, 7, 6, 5, 4, 4, 2, 2, 2, 2, 2, 2, 2 ],
  [ 6, 5, 7, 5, 4, 3, 2, 2, 2, 1, 1, 1, 1 ],
  [ 5, 4, 3, 6, 5, 3, 2, 2, 1, 0, 0, 0, 0 ],
  [ 4, 3, 2, 3, 6, 4, 3, 1, 0, 0, 0, 0, 0 ],
  [ 3, 2, 2, 2, 2, 6, 3, 2, 1, 0, 0, 0, 0 ],
  [ 2, 0, 0, 0, 0, 1, 5, 2, 1, 0, 0, 0, 0 ],
  [ 2, 0, 0, 0, 0, 0, 2, 5, 2, 1, 0, 0, 0 ],
  [ 1, 0, 0, 0, 0, 0, 0, 2, 4, 2, 1, 0, 0 ],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 1, 0, 0 ],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0 ],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 0 ],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3 ]
];

// App State
let appState = {
  playerCount: 6,
  rangeGrid: JSON.parse(JSON.stringify(DEFAULT_RANGE)), // Deep copy
  currentSelectedRank: 7, // Rank to edit grid (0-7)
  isEditingGrid: false,
  
  // Game state
  gameActive: false,
  deck: [],
  playerPositionIndex: 0, // Index in activePositions
  activePositions: [], // Positions in play (e.g. POSITIONS_6)
  seats: [], // Dynamic seat configs
  playerHand: [],
  playerHandName: '',
  openCpuSeat: null, // Seat index of CPU that opened, if any
  cpuActions: [], // Log of CPU actions in this hand
  
  // Session stats
  sessionPlayed: 0,
  sessionCorrect: 0,
  
  // Lifetime stats
  stats: {
    totalPlayed: 0,
    totalCorrect: 0,
    positions: {} // Key: position name, Value: { played: 0, correct: 0 }
  }
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupNav();
  setupRangeEditor();
  setupGameControls();
  renderStats();
  
  // Initialize Stats table in UI
  initStatsTable();
});

// Load ranges and stats from LocalStorage
function loadData() {
  const storedRange = localStorage.getItem('pf_range_grid');
  if (storedRange) {
    try {
      appState.rangeGrid = JSON.parse(storedRange);
    } catch (e) {
      console.error('Failed to parse stored range grid, resetting to default.', e);
      appState.rangeGrid = JSON.parse(JSON.stringify(DEFAULT_RANGE));
    }
  }
  
  const storedStats = localStorage.getItem('pf_stats');
  if (storedStats) {
    try {
      appState.stats = JSON.parse(storedStats);
    } catch (e) {
      console.error('Failed to parse stored stats.', e);
    }
  }
  
  // Normalize stats positions
  const allPos = [...new Set([...POSITIONS_9, ...POSITIONS_6, ...POSITIONS_3])];
  allPos.forEach(pos => {
    if (!appState.stats.positions[pos]) {
      appState.stats.positions[pos] = { played: 0, correct: 0 };
    }
  });
}

// Save ranges and stats to LocalStorage
function saveData() {
  localStorage.setItem('pf_range_grid', JSON.stringify(appState.rangeGrid));
  localStorage.setItem('pf_stats', JSON.stringify(appState.stats));
}

/* ==========================================================================
   NAVIGATION
   ========================================================================== */
function setupNav() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.view-section');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      
      navBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      
      btn.classList.add('active');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
      }
      
      if (targetId === 'stats-view') {
        renderStats();
      } else if (targetId === 'range-view') {
        renderRangeGrid();
      }
    });
  });
}

/* ==========================================================================
   RANGE EDITOR (13x13 GRID)
   ========================================================================== */
function setupRangeEditor() {
  // Rank Selector Toolbar
  const pickers = document.querySelectorAll('.rank-picker');
  pickers.forEach(picker => {
    picker.addEventListener('click', () => {
      pickers.forEach(p => p.classList.remove('active'));
      picker.classList.add('active');
      appState.currentSelectedRank = parseInt(picker.getAttribute('data-rank'));
    });
  });
  
  // Reset Range
  document.getElementById('reset-default-range').addEventListener('click', () => {
    if (confirm('ハンドレンジ表をデフォルト設定に戻しますか？')) {
      appState.rangeGrid = JSON.parse(JSON.stringify(DEFAULT_RANGE));
      saveData();
      renderRangeGrid();
    }
  });
  
  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', () => {
    exportToCSV();
  });
  
  // Import CSV Modal
  const importModal = document.getElementById('import-modal');
  const importTrigger = document.getElementById('import-trigger-btn');
  const closeModalBtns = document.querySelectorAll('.close-modal-btn');
  const applyCsvBtn = document.getElementById('apply-csv-btn');
  const fileInput = document.getElementById('csv-file-input');
  const dropZone = document.getElementById('csv-drop-zone');
  
  importTrigger.addEventListener('click', () => {
    importModal.classList.remove('hidden');
    document.getElementById('csv-text-area').value = '';
  });
  
  const closeModal = () => importModal.classList.add('hidden');
  closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
  
  // Trigger file select on dropzone click
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleCSVFile(file);
    }
  });
  
  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleCSVFile(file);
    }
  });
  
  applyCsvBtn.addEventListener('click', () => {
    const text = document.getElementById('csv-text-area').value.trim();
    if (text) {
      if (parseAndApplyCSV(text)) {
        closeModal();
      }
    } else {
      alert('CSVテキストを入力するか、ファイルをアップロードしてください。');
    }
  });
  
  // Touch/Mouse events for painting grid
  const grid = document.getElementById('range-grid');
  
  grid.addEventListener('mousedown', (e) => {
    // Only paint if clicking a grid cell
    if (e.target.classList.contains('grid-cell') || e.target.closest('.grid-cell')) {
      appState.isEditingGrid = true;
      paintCell(e.target.closest('.grid-cell') || e.target);
    }
  });
  
  window.addEventListener('mouseup', () => {
    appState.isEditingGrid = false;
  });
  
  // Initial grid render
  renderRangeGrid();
}

// Convert Row/Col to Hand Name
function getHandName(r, c) {
  const v1 = CARD_VALUES[12 - r];
  const v2 = CARD_VALUES[12 - c];
  
  if (r === c) {
    return v1 + v2; // Pairs (e.g. AA, KK)
  } else if (r < c) {
    return v1 + v2 + 's'; // Suited (e.g. AKs, AQs)
  } else {
    return v2 + v1 + 'o'; // Offsuited (e.g. AKo, AQo)
  }
}

// Render 13x13 Grid
function renderRangeGrid() {
  const grid = document.getElementById('range-grid');
  grid.innerHTML = '';
  
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = getHandName(r, c);
      const rank = appState.rangeGrid[r][c];
      
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.style.backgroundColor = `var(--color-rank-${rank})`;
      cell.setAttribute('data-row', r);
      cell.setAttribute('data-col', c);
      
      cell.innerHTML = `
        <span class="cell-hand">${hand}</span>
        <span class="cell-rank">${rank}</span>
      `;
      
      // Mouse drag over
      cell.addEventListener('mouseenter', () => {
        if (appState.isEditingGrid) {
          paintCell(cell);
        }
      });
      
      // Mobile support (tap to edit)
      cell.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling while drawing on mobile
        paintCell(cell);
      });
      
      grid.appendChild(cell);
    }
  }
}

function paintCell(cellElement) {
  const r = parseInt(cellElement.getAttribute('data-row'));
  const c = parseInt(cellElement.getAttribute('data-col'));
  const targetRank = appState.currentSelectedRank;
  
  appState.rangeGrid[r][c] = targetRank;
  cellElement.style.backgroundColor = `var(--color-rank-${targetRank})`;
  cellElement.querySelector('.cell-rank').textContent = targetRank;
  
  saveData();
}

/* ==========================================================================
   CSV IMPORT / EXPORT
   ========================================================================== */
function exportToCSV() {
  let csvContent = '';
  // 13x13 Grid Export
  for (let r = 0; r < 13; r++) {
    const rowValues = [];
    for (let c = 0; c < 13; c++) {
      rowValues.push(appState.rangeGrid[r][c]);
    }
    csvContent += rowValues.join(',') + '\n';
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'preflop_range.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleCSVFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    document.getElementById('csv-text-area').value = text;
  };
  reader.readAsText(file);
}

function parseAndApplyCSV(text) {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 13) {
    // 13x13 Matrix Format
    const newGrid = [];
    for (let r = 0; r < 13; r++) {
      const row = lines[r].split(',').map(val => parseInt(val.trim()));
      if (row.length !== 13 || row.some(isNaN)) {
        alert(`インポート失敗: ${r+1}行目のフォーマットが正しくありません。13個の数値をカンマ区切りで入力してください。`);
        return false;
      }
      if (row.some(val => val < 0 || val > 7)) {
        alert('インポート失敗: ランク数値は0から7の範囲でなければなりません。');
        return false;
      }
      newGrid.push(row);
    }
    
    appState.rangeGrid = newGrid;
    saveData();
    renderRangeGrid();
    alert('13x13レンジ表を正常にインポートしました！');
    return true;
  } else {
    // Try Hand,Rank List Format (e.g. 169 lines of "AA,7")
    // Let's parse list
    const parsedPairs = {};
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 2) continue;
      
      const hand = parts[0].trim();
      const rank = parseInt(parts[1].trim());
      
      if (isNaN(rank) || rank < 0 || rank > 7) {
        alert(`インポート失敗: ${lines[i]} のランク値が無効です。`);
        return false;
      }
      parsedPairs[hand] = rank;
    }
    
    // Validate we got enough hands or at least some
    const handKeys = Object.keys(parsedPairs);
    if (handKeys.length === 0) {
      alert('インポート失敗: CSVから有効なデータを検出できませんでした。');
      return false;
    }
    
    // Create new temporary grid from mapping
    const newGrid = JSON.parse(JSON.stringify(DEFAULT_RANGE));
    let mappedCount = 0;
    
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const hand = getHandName(r, c);
        if (parsedPairs[hand] !== undefined) {
          newGrid[r][c] = parsedPairs[hand];
          mappedCount++;
        }
      }
    }
    
    if (mappedCount < 169) {
      if (!confirm(`169種類のハンドのうち ${mappedCount} 個のみがCSVで見つかりました。不足分はデフォルト値になりますが、適用しますか？`)) {
        return false;
      }
    }
    
    appState.rangeGrid = newGrid;
    saveData();
    renderRangeGrid();
    alert(`リスト形式CSVから ${mappedCount} 個のハンドデータをインポートしました！`);
    return true;
  }
}

/* ==========================================================================
   GAME ENGINE & SIMULATOR
   ========================================================================== */
function setupGameControls() {
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('reset-session-btn').addEventListener('click', resetSessionStats);
  
  // Game Actions
  document.getElementById('btn-fold').addEventListener('click', () => handlePlayerAction('FOLD'));
  document.getElementById('btn-call').addEventListener('click', () => handlePlayerAction('CALL'));
  document.getElementById('btn-raise').addEventListener('click', () => handlePlayerAction('RAISE'));
  document.getElementById('btn-open').addEventListener('click', () => handlePlayerAction('OPEN'));
  
  // Next Hand
  document.getElementById('next-hand-btn').addEventListener('click', () => {
    document.getElementById('feedback-panel').classList.add('hidden');
    dealNextHand();
  });
}

function startGame() {
  const select = document.getElementById('player-count');
  appState.playerCount = parseInt(select.value);
  appState.gameActive = true;
  
  // Set up active positions
  if (appState.playerCount === 3) {
    appState.activePositions = [...POSITIONS_3];
  } else if (appState.playerCount === 6) {
    appState.activePositions = [...POSITIONS_6];
  } else {
    appState.activePositions = [...POSITIONS_9];
  }
  
  // Reset session stats
  appState.sessionPlayed = 0;
  appState.sessionCorrect = 0;
  updateSessionStatsUI();
  
  document.getElementById('active-game-panel').classList.remove('hidden');
  document.getElementById('feedback-panel').classList.add('hidden');
  
  // Scroll to active game panel smoothly
  document.getElementById('active-game-panel').scrollIntoView({ behavior: 'smooth' });
  
  dealNextHand();
}

function resetSessionStats() {
  if (confirm('現在のセッションの成績をリセットしますか？')) {
    appState.sessionPlayed = 0;
    appState.sessionCorrect = 0;
    updateSessionStatsUI();
    dealNextHand();
  }
}

function updateSessionStatsUI() {
  document.getElementById('stat-hand-count').textContent = `${appState.sessionCorrect} / ${appState.sessionPlayed}`;
  const pct = appState.sessionPlayed === 0 ? 0 : Math.round((appState.sessionCorrect / appState.sessionPlayed) * 100);
  document.getElementById('stat-accuracy').textContent = `${pct}%`;
}

// Generate standard 52 deck
function buildDeck() {
  const deck = [];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({
        value: rank,
        suit: suit.id,
        symbol: suit.symbol,
        color: suit.color
      });
    }
  }
  return deck;
}

// Fisher-Yates Shuffle
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Get Open Required Rank threshold based on remaining players
function getOpenThreshold(r) {
  if (r >= 8) return 6;      // UTG in 9-Max
  if (r === 6 || r === 7) return 5;
  if (r === 4 || r === 5) return 4;
  if (r === 3) return 3;     // CO
  return 2;                  // BTN, SB, BB (r <= 2)
}

function getHandRangeRank(v1, s1, v2, s2) {
  const idx1 = CARD_VALUES.indexOf(v1);
  const idx2 = CARD_VALUES.indexOf(v2);
  
  let r, c;
  if (idx1 > idx2) {
    // Card 1 is stronger (e.g. A and K)
    r = 12 - idx1; // Row
    c = 12 - idx2; // Col
  } else {
    r = 12 - idx2;
    c = 12 - idx1;
  }
  
  if (idx1 === idx2) {
    // Pair
    return appState.rangeGrid[r][r];
  } else if (s1 === s2) {
    // Suited: Row (stronger) < Col (weaker)
    return appState.rangeGrid[Math.min(r, c)][Math.max(r, c)];
  } else {
    // Offsuited: Row (weaker) > Col (stronger)
    return appState.rangeGrid[Math.max(r, c)][Math.min(r, c)];
  }
}

function getHandText(v1, s1, v2, s2) {
  const idx1 = CARD_VALUES.indexOf(v1);
  const idx2 = CARD_VALUES.indexOf(v2);
  
  if (idx1 === idx2) {
    return v1 + v2;
  }
  
  const highVal = idx1 > idx2 ? v1 : v2;
  const lowVal = idx1 > idx2 ? v2 : v1;
  const suited = s1 === s2 ? 's' : 'o';
  
  return highVal + lowVal + suited;
}

// Deal new Hand
function dealNextHand() {
  appState.deck = buildDeck();
  shuffle(appState.deck);
  
  const N = appState.playerCount;
  
  // 1. Pick a random position for Player
  // playerPositionIndex is the index in activePositions (0 to N-1)
  appState.playerPositionIndex = Math.floor(Math.random() * N);
  const playerPosName = appState.activePositions[appState.playerPositionIndex];
  
  // 2. Map positions to physical seat indexes (Seat 0 is always Player)
  // Let's create seats array where seat s (0 to N-1) has positions
  appState.seats = [];
  for (let s = 0; s < N; s++) {
    // Position of seat s is activePositions[(playerPositionIndex + s) % N]
    const posIdx = (appState.playerPositionIndex + s) % N;
    appState.seats.push({
      seatIndex: s,
      isPlayer: s === 0,
      positionName: appState.activePositions[posIdx],
      positionIndex: posIdx,
      action: null, // FOLD, OPEN, etc.
      isActive: true,
      cards: []
    });
  }
  
  // 3. Draw Hands for all seats from the single shared deck (no duplicates)
  appState.seats.forEach(seat => {
    seat.cards = [appState.deck.pop(), appState.deck.pop()];
  });
  
  appState.playerHand = appState.seats[0].cards;
  appState.playerHandName = getHandText(
    appState.playerHand[0].value, appState.playerHand[0].suit,
    appState.playerHand[1].value, appState.playerHand[1].suit
  );
  
  // Render initial visual table
  renderTable();
  
  // Hide cards for animation, show placeholders
  renderPlayerCards(true);
  
  // Reset Action State
  appState.openCpuSeat = null;
  appState.cpuActions = [];
  
  // Disable all action buttons initially
  setActionButtonsEnabled(false);
  
  // Simulating CPU actions before player
  simulateBeforePlayerActions();
}

// Physical Seat Layout Positions (%) based on Player Count
// Seat 0 is always bottom center
const SEAT_COORDINATES = {
  3: [
    { left: '50%', top: '82%' }, // Seat 0 (Player)
    { left: '80%', top: '30%' }, // Seat 1
    { left: '20%', top: '30%' }  // Seat 2
  ],
  6: [
    { left: '50%', top: '82%' }, // Seat 0 (Player)
    { left: '15%', top: '65%' }, // Seat 1
    { left: '15%', top: '30%' }, // Seat 2
    { left: '50%', top: '15%' }, // Seat 3
    { left: '85%', top: '30%' }, // Seat 4
    { left: '85%', top: '65%' }  // Seat 5
  ],
  9: [
    { left: '50%', top: '82%' }, // Seat 0 (Player)
    { left: '22%', top: '75%' }, // Seat 1
    { left: '12%', top: '48%' }, // Seat 2
    { left: '22%', top: '22%' }, // Seat 3
    { left: '42%', top: '15%' }, // Seat 4
    { left: '58%', top: '15%' }, // Seat 5
    { left: '78%', top: '22%' }, // Seat 6
    { left: '88%', top: '48%' }, // Seat 7
    { left: '78%', top: '75%' }  // Seat 8
  ]
};

// Render seats on visual table
function renderTable() {
  const N = appState.playerCount;
  const container = document.getElementById('seats-container');
  container.innerHTML = '';
  
  const coords = SEAT_COORDINATES[N];
  
  appState.seats.forEach((seat, index) => {
    const seatEl = document.createElement('div');
    seatEl.id = `seat-${index}`;
    seatEl.className = `seat ${seat.isPlayer ? 'player-seat' : ''}`;
    
    const coord = coords[index];
    seatEl.style.left = coord.left;
    seatEl.style.top = coord.top;
    
    // Check if this seat has dealer button
    const isDealer = seat.positionName === 'BTN';
    const dealerBtnMarkup = isDealer ? `<div class="dealer-btn">D</div>` : '';
    
    seatEl.innerHTML = `
      <div class="seat-avatar">
        <span class="seat-pos">${seat.positionName}</span>
        ${dealerBtnMarkup}
      </div>
      <span class="seat-name">${seat.isPlayer ? 'You' : 'CPU ' + index}</span>
      <div class="action-bubble-anchor"></div>
    `;
    
    container.appendChild(seatEl);
  });
}

function showActionBubble(seatIndex, action) {
  const seatEl = document.getElementById(`seat-${seatIndex}`);
  if (!seatEl) return;
  
  // Remove existing bubble if any
  const oldBubble = seatEl.querySelector('.action-bubble');
  if (oldBubble) oldBubble.remove();
  
  if (!action) return;
  
  const bubble = document.createElement('div');
  let cleanAction = action.toUpperCase();
  bubble.className = `action-bubble bubble-${cleanAction.toLowerCase()}`;
  
  // Translate labels for nicer look
  let displayLabel = cleanAction;
  if (cleanAction === 'OPEN') displayLabel = 'OPEN';
  if (cleanAction === 'FOLD') displayLabel = 'FOLD';
  
  bubble.textContent = displayLabel;
  seatEl.appendChild(bubble);
  
  if (cleanAction === 'FOLD') {
    seatEl.classList.add('folded');
    seatEl.style.opacity = '0.35';
  } else {
    seatEl.classList.remove('folded');
    seatEl.style.opacity = '1';
  }
}

function setSeatActiveTurn(seatIndex, isActive) {
  const seatEl = document.getElementById(`seat-${seatIndex}`);
  if (seatEl) {
    if (isActive) {
      seatEl.classList.add('active-turn');
    } else {
      seatEl.classList.remove('active-turn');
    }
  }
}

// Disable/enable action buttons
function setActionButtonsEnabled(enabled, options = { canOpen: false, canCall: false, canRaise: false }) {
  const btnFold = document.getElementById('btn-fold');
  const btnCall = document.getElementById('btn-call');
  const btnRaise = document.getElementById('btn-raise');
  const btnOpen = document.getElementById('btn-open');
  
  if (!enabled) {
    btnFold.disabled = true;
    btnCall.disabled = true;
    btnRaise.disabled = true;
    btnOpen.disabled = true;
    return;
  }
  
  btnFold.disabled = false; // Fold is always allowed if active
  btnOpen.disabled = !options.canOpen;
  btnCall.disabled = !options.canCall;
  btnRaise.disabled = !options.canRaise;
}

// Display Cards
function renderPlayerCards(revealed = true) {
  const handContainer = document.getElementById('player-hand');
  handContainer.innerHTML = '';
  
  if (!revealed) {
    handContainer.innerHTML = `
      <div class="poker-card card-placeholder"><div class="card-inner">?</div></div>
      <div class="poker-card card-placeholder"><div class="card-inner">?</div></div>
    `;
    return;
  }
  
  appState.playerHand.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = `poker-card ${card.color}`;
    
    // Add visual styling for suit symbol
    let suitHtml = `<span class="card-suit-top">${card.value}${card.symbol}</span>`;
    let suitCenterHtml = `<span class="card-suit-center">${card.symbol}</span>`;
    let valHtml = `<span class="card-value">${card.value}</span>`;
    
    cardEl.innerHTML = `
      ${suitHtml}
      ${suitCenterHtml}
      <div style="align-self: flex-end; transform: rotate(180deg); display: flex; flex-direction: column;">
        <span class="card-suit-top" style="font-size: 1rem;">${card.value}${card.symbol}</span>
      </div>
    `;
    
    handContainer.appendChild(cardEl);
  });
}

// Simulate CPU actions before Player (from action index 0 to player position)
function simulateBeforePlayerActions() {
  const N = appState.playerCount;
  const pIdx = appState.playerPositionIndex;
  
  let currentIdx = 0; // Preflop action starts at index 0 (UTG)
  
  // If player is UTG (index 0), skip CPU phase
  if (currentIdx === pIdx) {
    promptPlayerAction();
    return;
  }
  
  // Run loop with delay to create game feel
  function stepCpuAction() {
    if (currentIdx >= pIdx) {
      // It's player's turn now!
      setSeatActiveTurn(0, true);
      promptPlayerAction();
      return;
    }
    
    // Find seat corresponding to currentIdx position
    const seatObj = appState.seats.find(s => s.positionIndex === currentIdx);
    if (!seatObj) return;
    
    setSeatActiveTurn(seatObj.seatIndex, true);
    
    // CPU logic
    setTimeout(() => {
      // 1. Check if someone else already opened
      if (appState.openCpuSeat !== null) {
        // Simple CPU: if someone already opened, they fold (to keep simple focus on Player decisions)
        seatObj.action = 'FOLD';
      } else {
        // CPU first in. Decide whether to Open based on threshold
        const remaining = (N - 1) - currentIdx;
        const threshold = getOpenThreshold(remaining);
        
        // Use cards already dealt to this CPU seat from the shared deck
        const cpuRank = getHandRangeRank(
          seatObj.cards[0].value, seatObj.cards[0].suit,
          seatObj.cards[1].value, seatObj.cards[1].suit
        );
        
        if (cpuRank >= threshold) {
          seatObj.action = 'OPEN';
          appState.openCpuSeat = seatObj.seatIndex;
        } else {
          seatObj.action = 'FOLD';
        }
      }
      
      showActionBubble(seatObj.seatIndex, seatObj.action);
      setSeatActiveTurn(seatObj.seatIndex, false);
      
      appState.cpuActions.push({
        positionName: seatObj.positionName,
        action: seatObj.action
      });
      
      currentIdx++;
      stepCpuAction(); // Loop next
    }, 400); // 400ms delay between actions
  }
  
  stepCpuAction();
}

function promptPlayerAction() {
  // Reveal cards
  renderPlayerCards(true);
  
  // Decide options
  const isCpuOpen = appState.openCpuSeat !== null;
  
  if (isCpuOpen) {
    // Opponent opened: Fold, Call, Raise are valid. Open is invalid.
    setActionButtonsEnabled(true, { canOpen: false, canCall: true, canRaise: true });
    
    const cpuSeatObj = appState.seats[appState.openCpuSeat];
    document.getElementById('action-prompt').innerHTML = `
      <span class="text-warning">${cpuSeatObj.positionName}</span> がオープンしました。あなたのアクションを選択してください。
    `;
  } else {
    // Clean pot: Fold, Open are valid. Call, Raise are invalid.
    setActionButtonsEnabled(true, { canOpen: true, canCall: false, canRaise: false });
    document.getElementById('action-prompt').innerHTML = `
      全員フォールドで回ってきました。あなたのアクションを選択してください。
    `;
  }
}

/* ==========================================================================
   USER ACTION EVALUATION & EXPLANATION
   ========================================================================== */
function handlePlayerAction(playerChoice) {
  // Disable buttons immediately to prevent double clicks
  setActionButtonsEnabled(false);
  setSeatActiveTurn(0, false);
  
  const N = appState.playerCount;
  const pIdx = appState.playerPositionIndex;
  const playerPos = appState.seats[0].positionName;
  
  const v1 = appState.playerHand[0].value;
  const s1 = appState.playerHand[0].suit;
  const v2 = appState.playerHand[1].value;
  const s2 = appState.playerHand[1].suit;
  
  // Hand Rank of player
  const playerHandRank = getHandRangeRank(v1, s1, v2, s2);
  
  const isCpuOpen = appState.openCpuSeat !== null;
  
  // Compute correct action
  let correctAction = 'FOLD';
  let explanation = '';
  
  if (isCpuOpen) {
    // Scenario 1: CPU opened before player
    const cpuSeatObj = appState.seats[appState.openCpuSeat];
    const cpuPos = cpuSeatObj.positionName;
    const cpuPosIdx = cpuSeatObj.positionIndex;
    const cpuRemaining = (N - 1) - cpuPosIdx;
    
    // CPU's open threshold
    const T = getOpenThreshold(cpuRemaining);
    
    // BTN Open vs BB Player special rule
    if (cpuPos === 'BTN' && playerPos === 'BB') {
      if (playerHandRank >= 4) {
        correctAction = 'RAISE';
      } else if (playerHandRank >= 1) {
        correctAction = 'CALL';
      } else {
        correctAction = 'FOLD';
      }
      
      explanation = `
        <div class="feedback-summary-text">
          ポジション: <strong>${playerPos}</strong> (BB)<br>
          状況: <strong>BTN</strong> のオープン（基準: ランク${T}以上）に対し、<br>
          あなたのハンド <strong>${appState.playerHandName}</strong> は <strong>ランク ${playerHandRank}</strong> です。<br>
          <small style="color:var(--text-secondary); margin-top:0.25rem; display:block;">※BB vs BTN 特殊ルール: コール(ランク1〜3) / レイズ(ランク4以上)</small>
        </div>
      `;
    } else {
      // Normal response rule: Call = T+1, Raise >= T+2, Fold = other
      if (playerHandRank >= T + 2) {
        correctAction = 'RAISE';
      } else if (playerHandRank === T + 1) {
        correctAction = 'CALL';
      } else {
        correctAction = 'FOLD';
      }
      
      explanation = `
        <div class="feedback-summary-text">
          ポジション: <strong>${playerPos}</strong><br>
          状況: <strong>${cpuPos}</strong> のオープン（基準: ランク${T}以上）に対し、<br>
          あなたのハンド <strong>${appState.playerHandName}</strong> は <strong>ランク ${playerHandRank}</strong> です。<br>
          <small style="color:var(--text-secondary); margin-top:0.25rem; display:block;">※オープンへの対抗基準: コール(ランク${T+1}) / レイズ(ランク${T+2}以上)</small>
        </div>
      `;
    }
  } else {
    // Scenario 2: Unopened pot (First in)
    const remaining = (N - 1) - pIdx;
    const T = getOpenThreshold(remaining);
    
    if (playerHandRank >= T) {
      correctAction = 'OPEN';
    } else {
      correctAction = 'FOLD';
    }
    
    explanation = `
      <div class="feedback-summary-text">
        ポジション: <strong>${playerPos}</strong> (後ろにアクション待ち ${remaining}人)<br>
        状況: 全員フォールドであなたに回ってきました。<br>
        あなたのハンド <strong>${appState.playerHandName}</strong> は <strong>ランク ${playerHandRank}</strong> です。<br>
        <small style="color:var(--text-secondary); margin-top:0.25rem; display:block;">※このポジションのオープン基準: ランク${T}以上</small>
      </div>
    `;
  }
  
  // Find grid coordinates of the player's hand for highlight
  const idx1 = CARD_VALUES.indexOf(v1);
  const idx2 = CARD_VALUES.indexOf(v2);
  let targetR, targetC;
  
  if (idx1 > idx2) {
    targetR = 12 - idx1;
    targetC = 12 - idx2;
  } else {
    targetR = 12 - idx2;
    targetC = 12 - idx1;
  }
  
  if (idx1 === idx2) {
    targetC = targetR;
  } else if (s1 === s2) {
    // Suited: Row = min(r,c), Col = max(r,c). Already sorted (targetR < targetC)
  } else {
    // Offsuited: Row = max(r,c), Col = min(r,c). Swap them.
    const temp = targetR;
    targetR = targetC;
    targetC = temp;
  }
  
  // Generate mini grid HTML
  let miniGridHtml = '<div class="mini-range-grid-wrapper">';
  miniGridHtml += '<span class="mini-grid-label">レンジ表での位置</span>';
  miniGridHtml += '<div class="mini-range-grid">';
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const rank = appState.rangeGrid[r][c];
      const isCurrent = (r === targetR && c === targetC);
      const cellClass = isCurrent ? 'mini-cell highlight-cell' : 'mini-cell';
      const cellStyle = `background-color: var(--color-rank-${rank});`;
      const handText = getHandName(r, c);
      
      const content = isCurrent ? `<span style="font-size:0.5rem; text-shadow:0 0 2px #fff;">${handText}</span>` : '';
      
      miniGridHtml += `<div class="${cellClass}" style="${cellStyle}">${content}</div>`;
    }
  }
  miniGridHtml += '</div></div>';
  
  // Verify
  const isCorrect = playerChoice === correctAction;
  
  // Show bubble on player seat
  showActionBubble(0, playerChoice);
  
  // Update stats
  appState.sessionPlayed++;
  appState.stats.totalPlayed++;
  
  if (isCorrect) {
    appState.sessionCorrect++;
    appState.stats.totalCorrect++;
    appState.stats.positions[playerPos].correct++;
  }
  appState.stats.positions[playerPos].played++;
  
  saveData();
  updateSessionStatsUI();
  
  // Render feedback UI
  const badge = document.getElementById('feedback-result');
  badge.textContent = isCorrect ? '正解' : '不正解';
  badge.className = `feedback-badge ${isCorrect ? 'correct' : 'incorrect'}`;
  
  document.getElementById('feedback-hand-name').textContent = appState.playerHandName;
  
  let choiceText = playerChoice;
  let correctText = correctAction;
  
  let resultSummary = `
    <div style="font-size: 1.1rem; margin-bottom: 0.75rem;">
      あなたの選択: <strong class="${isCorrect ? 'text-primary' : 'text-danger'}">${choiceText}</strong> 
      ${isCorrect ? '（正解）' : ` ／ 正解: <strong class="text-primary">${correctText}</strong>`}
    </div>
  `;
  
  document.getElementById('feedback-explanation').innerHTML = resultSummary + explanation + miniGridHtml;
  
  // Show modal overlay after short delay for visual satisfaction
  setTimeout(() => {
    document.getElementById('feedback-panel').classList.remove('hidden');
  }, 600);
}

/* ==========================================================================
   STATS VIEW
   ========================================================================== */
function initStatsTable() {
  const tbody = document.getElementById('stats-position-tbody');
  tbody.innerHTML = '';
  
  // Build a static list of positions in order of priority
  const displayPositions = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  
  displayPositions.forEach(pos => {
    // Determine typical remaining players for description
    let remainingDesc = '';
    if (pos === 'UTG') remainingDesc = '8人（9人時）〜5人（6人時）';
    else if (pos === 'UTG+1') remainingDesc = '7人';
    else if (pos === 'UTG+2') remainingDesc = '6人';
    else if (pos === 'LJ') remainingDesc = '5人';
    else if (pos === 'HJ') remainingDesc = '4人';
    else if (pos === 'CO') remainingDesc = '3人';
    else if (pos === 'BTN') remainingDesc = '2人';
    else if (pos === 'SB') remainingDesc = '1人';
    else if (pos === 'BB') remainingDesc = '0人';
    
    const row = document.createElement('tr');
    row.id = `stats-row-${pos}`;
    row.innerHTML = `
      <td><strong>${pos}</strong></td>
      <td>${remainingDesc}</td>
      <td class="stat-cell-played">0</td>
      <td class="stat-cell-correct">0</td>
      <td class="stat-cell-pct">0%</td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById('clear-stats-btn').addEventListener('click', () => {
    if (confirm('すべての成績データを完全にリセットしますか？この操作は戻せません。')) {
      appState.stats.totalPlayed = 0;
      appState.stats.totalCorrect = 0;
      
      const allPos = Object.keys(appState.stats.positions);
      allPos.forEach(pos => {
        appState.stats.positions[pos] = { played: 0, correct: 0 };
      });
      
      saveData();
      renderStats();
    }
  });
}

function renderStats() {
  document.getElementById('stats-total-count').textContent = appState.stats.totalPlayed;
  document.getElementById('stats-correct-count').textContent = appState.stats.totalCorrect;
  
  const totalPct = appState.stats.totalPlayed === 0 ? 0 : Math.round((appState.stats.totalCorrect / appState.stats.totalPlayed) * 100);
  document.getElementById('stats-total-accuracy').textContent = `${totalPct}%`;
  
  // Fill table rows
  const displayPositions = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  
  displayPositions.forEach(pos => {
    const row = document.getElementById(`stats-row-${pos}`);
    if (!row) return;
    
    const data = appState.stats.positions[pos] || { played: 0, correct: 0 };
    const pct = data.played === 0 ? 0 : Math.round((data.correct / data.played) * 100);
    
    row.querySelector('.stat-cell-played').textContent = data.played;
    row.querySelector('.stat-cell-correct').textContent = data.correct;
    row.querySelector('.stat-cell-pct').textContent = `${pct}%`;
  });
}
