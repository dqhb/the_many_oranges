const ORANGE_DB = {
    happy:  { name: "Happy Orange", img: "happyorange.png", desc: "Heal 10 Juice", action: "HEAL", val: 10 },
    sad:    { name: "Sad Orange", img: "sadorange.png", desc: "Weaken Opponent (50% Dmg)", action: "WEAKEN", val: 0.5 },
    angry:  { name: "Angry Orange", img: "angryorange.png", desc: "Deal 12 Damage", action: "ATTACK", val: 12 },
    meh:    { name: "Meh Orange", img: "mehorange.png", desc: "Skip 2 Turns -> ONE-TAP", action: "MEH", val: 0 },
    sleepy: { name: "Sleepy Orange", img: "sleepyorange.png", desc: "Heal 20 (Skip 1 Turn)", action: "REST", val: 20 },
    rich:   { name: "Rich Orange", img: "richorange.png", desc: "Steal 5 Juice", action: "STEAL", val: 5 },
    ghost:  { name: "Ghost Orange", img: "ghostorange.png", desc: "Shield (1 Turn)", action: "SHIELD", val: 0 },
    smart:  { name: "Smart Orange", img: "smartorange.png", desc: "Reflect 5 Damage", action: "REFLECT", val: 5 },
    chef:   { name: "Chef Orange", img: "cheforange.png", desc: "Draw New Card", action: "DRAW", val: 0 },
    chaos:  { name: "Chaos Orange", img: "chaosorange.png", desc: "Random 1-20 Dmg", action: "CHAOS", val: 20 }
};

let peer, conn;
let myHP = 100, oppHP = 100;
let myHand = [], oppHand = [], isMyTurn = false, myPower = 1, mehCounter = 0;

function createGame() {
    peer = new Peer();
    peer.on('open', id => {
        document.getElementById('my-id-display').innerText = "YOUR ID: " + id;
        document.getElementById('status-msg').innerText = "Waiting for opponent...";
    });
    peer.on('connection', c => {
        conn = c;
        isMyTurn = true; 
        setupSocket();
    });
}

function joinGame() {
    const id = document.getElementById('join-id').value.trim();
    if (!id) return alert("Paste ID first!");
    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(id);
        setupSocket();
    });
}

function setupSocket() {
    conn.on('open', () => {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game-area').style.display = 'block';
        initDeck();
        syncHand(); // Send initial hand to opponent
    });

    conn.on('data', data => {
        if (data.type === 'SYNC_HAND') {
            oppHand = data.hand;
            render();
        }
        handleIncoming(data);
    });
}

function initDeck() {
    const keys = Object.keys(ORANGE_DB);
    myHand = [];
    for(let i=0; i<5; i++) myHand.push(keys[Math.floor(Math.random() * keys.length)]);
}

function syncHand() {
    if (conn && conn.open) {
        conn.send({ type: 'SYNC_HAND', hand: myHand });
    }
    render();
}

function render() {
    // 1. Render Opponent's Hand (Top)
    const oppHandDiv = document.getElementById('opp-hand');
    if (!oppHandDiv) {
        // Create the element if it doesn't exist in HTML yet
        const area = document.getElementById('game-area');
        const newDiv = document.createElement('div');
        newDiv.id = 'opp-hand';
        newDiv.className = 'hand';
        area.prepend(newDiv);
    }
    document.getElementById('opp-hand').innerHTML = oppHand.map(key => `
        <div class="card opponent-card" style="opacity: 0.8; transform: scale(0.9);">
            <img src="${ORANGE_DB[key].img}" style="filter: grayscale(50%);">
            <div class="card-name">${ORANGE_DB[key].name}</div>
        </div>
    `).join('');

    // 2. Render My Hand (Bottom)
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = myHand.map((key, index) => {
        const o = ORANGE_DB[key];
        return `
            <div class="card">
                <img src="${o.img}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1728/1728765.png'">
                <div class="card-name">${o.name}</div>
                <div class="card-desc">${o.desc}</div>
                <button ${!isMyTurn ? 'disabled' : ''} onclick="useCard('${key}', ${index})">PLAY</button>
            </div>`;
    }).join('');

    document.getElementById('my-hp-fill').style.width = myHP + "%";
    document.getElementById('opp-hp-fill').style.width = oppHP + "%";
    
    let msg = isMyTurn ? "YOUR TURN 🍊" : "OPPONENT'S TURN...";
    if (mehCounter === -1) msg = "ONE-TAP READY!";
    document.getElementById('status-msg').innerText = msg;
}

function useCard(key, index) {
    if(!isMyTurn) return;
    const card = ORANGE_DB[key];
    let isOneTapMove = false;

    if (mehCounter === -1) {
        oppHP = 0; 
        mehCounter = 0;
        isOneTapMove = true;
    } else if (card.action === "MEH") {
        mehCounter = 2;
    } else {
        if(card.action === "ATTACK") oppHP -= (card.val * myPower);
        if(card.action === "HEAL") myHP = Math.min(100, myHP + card.val);
        if(card.action === "STEAL") { oppHP -= 5; myHP += 5; }
        myPower = 1;
    }

    myHand.splice(index, 1);
    myHand.push(Object.keys(ORANGE_DB)[Math.floor(Math.random() * 10)]);
    
    conn.send({ 
        type: 'MOVE', 
        cardKey: key, 
        hpUpdate: myHP, 
        mehActive: (mehCounter === 2), 
        oneTap: isOneTapMove,
        newHand: myHand 
    });

    isMyTurn = false;
    syncHand();
    checkWin();
}

function handleIncoming(data) {
    if(data.type === 'MOVE') {
        const card = ORANGE_DB[data.cardKey];
        if(data.oneTap) myHP = 0;
        if(card.action === "ATTACK") myHP -= card.val;
        if(card.action === "WEAKEN") myPower = 0.5;
        oppHP = data.hpUpdate;
        oppHand = data.newHand || oppHand;

        if (mehCounter > 0) {
            mehCounter--;
            conn.send({ type: 'SKIP', hand: myHand });
        } else if (mehCounter === 0 && data.mehActive) {
            mehCounter = -1;
            isMyTurn = true;
        } else {
            isMyTurn = true;
        }
        render();
        checkWin();
    }
    if(data.type === 'SKIP') { 
        isMyTurn = true; 
        oppHand = data.hand || oppHand;
        render(); 
    }
}

function swapHand() {
    if(!isMyTurn) return;
    initDeck();
    conn.send({ type: 'SKIP', hand: myHand });
    isMyTurn = false; 
    render();
}

function checkWin() {
    if(myHP <= 0) alert("YOU GOT JUICED!");
    if(oppHP <= 0) alert("VICTORY!");
}
