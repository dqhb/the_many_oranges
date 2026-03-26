const ORANGE_DB = {
    happy:  { name: "Happy Orange", img: "orange_happy.png", desc: "Heal 10 Juice", action: "HEAL", val: 10 },
    sad:    { name: "Sad Orange", img: "orange_sad.png", desc: "Weaken Opponent (50% Dmg)", action: "WEAKEN", val: 0.5 },
    angry:  { name: "Angry Orange", img: "orange_angry.png", desc: "Deal 12 Damage", action: "ATTACK", val: 12 },
    meh:    { name: "Meh Orange", img: "orange_meh.png", desc: "Skip 2 Turns -> ONE-TAP", action: "MEH", val: 0 },
    sleepy: { name: "Sleepy Orange", img: "orange_sleepy.png", desc: "Heal 20 (Skip 1 Turn)", action: "REST", val: 20 },
    rich:   { name: "Rich Orange", img: "orange_rich.png", desc: "Steal 5 Juice", action: "STEAL", val: 5 },
    ghost:  { name: "Ghost Orange", img: "orange_ghost.png", desc: "Shield (1 Turn)", action: "SHIELD", val: 0 },
    smart:  { name: "Smart Orange", img: "orange_smart.png", desc: "Reflect 5 Damage", action: "REFLECT", val: 5 },
    chef:   { name: "Chef Orange", img: "orange_chef.png", desc: "Draw New Card", action: "DRAW", val: 0 },
    chaos:  { name: "Chaos Orange", img: "orange_chaos.png", desc: "Random 1-20 Dmg", action: "CHAOS", val: 20 }
};

let peer, conn;
let myHP = 100, oppHP = 100;
let myHand = [], isMyTurn = false, myPower = 1, mehCounter = 0;

// Force secure Peer connection for GitHub
function initPeer() {
    return new Peer({
        debug: 2,
        config: { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] }
    });
}

function createGame() {
    peer = initPeer();
    peer.on('open', id => {
        document.getElementById('my-id-display').innerText = "Copy this ID: " + id;
    });
    peer.on('connection', c => {
        conn = c;
        isMyTurn = true;
        setupSocket();
    });
}

function joinGame() {
    const id = document.getElementById('join-id').value.trim();
    if (!id) return alert("Please paste an ID!");
    
    peer = initPeer();
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
        render();
    });
    conn.on('data', data => handleIncoming(data));
}

function initDeck() {
    const keys = Object.keys(ORANGE_DB);
    myHand = [];
    for(let i=0; i<5; i++) myHand.push(keys[Math.floor(Math.random() * keys.length)]);
}

function render() {
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = '';
    myHand.forEach((key, index) => {
        const o = ORANGE_DB[key];
        handDiv.innerHTML += `
            <div class="card">
                <img src="images/${o.img}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1728/1728765.png'">
                <div class="card-name">${o.name}</div>
                <div class="card-desc">${o.desc}</div>
                <button ${!isMyTurn ? 'disabled' : ''} onclick="useCard('${key}', ${index})">PLAY</button>
            </div>`;
    });
    document.getElementById('my-hp-fill').style.width = myHP + "%";
    document.getElementById('opp-hp-fill').style.width = oppHP + "%";
    
    let msg = isMyTurn ? "YOUR TURN 🍊" : "OPPONENT'S TURN...";
    if (mehCounter === -1) msg = "ONE-TAP READY! CLICK ANY CARD!";
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

    conn.send({ type: 'MOVE', cardKey: key, hpUpdate: myHP, mehActive: (mehCounter === 2), oneTap: isOneTapMove });
    myHand.splice(index, 1);
    myHand.push(Object.keys(ORANGE_DB)[Math.floor(Math.random() * 10)]);
    isMyTurn = false;
    render();
    checkWin();
}

function handleIncoming(data) {
    if(data.type === 'MOVE') {
        const card = ORANGE_DB[data.cardKey];
        if(data.oneTap) myHP = 0;
        if(card.action === "ATTACK") myHP -= card.val;
        if(card.action === "WEAKEN") myPower = 0.5;
        oppHP = data.hpUpdate;

        if (mehCounter > 0) {
            mehCounter--;
            conn.send({ type: 'SKIP' });
        } else if (mehCounter === 0 && data.mehActive) {
            mehCounter = -1;
            isMyTurn = true;
        } else {
            isMyTurn = true;
        }
        render();
        checkWin();
    }
    if(data.type === 'SKIP') { isMyTurn = true; render(); }
}

function swapHand() {
    if(!isMyTurn) return;
    myHand = []; initDeck();
    conn.send({ type: 'SKIP' });
    isMyTurn = false; render();
}

function checkWin() {
    if(myHP <= 0) alert("JUICED");
    if(oppHP <= 0) alert("VICTORY");
}
