// Casino wheel functions - will be loaded after forum.html initializes Firebase
// These use globals from forum.html module: db, currentUser, and Firestore functions

window.updateCasinoDisplay = function() {
  const bet = parseInt(document.getElementById('betAmount').value, 10) || 0;
  let chance = 70, mult = 1.2;
  
  if (bet <= 50) {
    chance = 70; mult = 1.2;
  } else if (bet <= 200) {
    chance = 60; mult = 1.5;
  } else {
    chance = 50; mult = 2.0;
  }
  
  document.getElementById('chanceDisplay').textContent = chance.toFixed(2) + '%';
  document.getElementById('multDisplay').textContent = 'x' + mult.toFixed(2);
};

window.spinCasino = async function() {
  const bet = parseInt(document.getElementById('betAmount').value, 10);
  if (!bet || bet <= 0) { 
    alert('Enter bet'); 
    return; 
  }

  let chance = 70, mult = 1.2;
  if (bet <= 50) {
    chance = 70; mult = 1.2;
  } else if (bet <= 200) {
    chance = 60; mult = 1.5;
  } else {
    chance = 50; mult = 2.0;
  }

  const wheel = document.getElementById('wheel');
  const spinBtn = document.getElementById('spinBtn');
  const resultEl = document.getElementById('casinoResult');
  const pointer = document.getElementById('pointer');

  const winDeg = chance * 3.6;
  wheel.style.setProperty('--win-deg', winDeg + 'deg');

  spinBtn.disabled = true;
  document.getElementById('betAmount').disabled = true;
  resultEl.textContent = 'Spinning...';
  wheel.classList.add('spinning');
  if (pointer) pointer.classList.add('spin-pointer');

  const fullSpins = 6;
  const randAngle = Math.floor(Math.random() * 360);
  const totalDeg = fullSpins * 360 + randAngle;

  wheel.style.transition = 'transform 4s cubic-bezier(.18,.9,.2,1)';
  wheel.style.transform = `rotate(${totalDeg}deg)`;

  const onEnd = async () => {
    wheel.removeEventListener('transitionend', onEnd);

    const normalized = totalDeg % 360;
    const pointerAngle = (360 - normalized) % 360;
    const win = pointerAngle <= winDeg;
    let net = 0;
    if (win) net = Math.floor(bet * mult);
    else net = -bet;

    try {
      const userRef = window.casinoFirebase.doc(window.casinoFirebase.db, 'users', window.currentUser.uid);
      await window.casinoFirebase.runTransaction(window.casinoFirebase.db, async (tx) => {
        const udoc = await tx.get(userRef);
        if (!udoc.exists()) throw new Error('User doc missing');
        const coins = udoc.data().avidcoin || 0;
        if (coins < bet) throw new Error('Insufficient coins');
        
        tx.update(userRef, { avidcoin: window.casinoFirebase.increment(net) });
        
        const histRef = window.casinoFirebase.doc(window.casinoFirebase.collection(window.casinoFirebase.db, 'casinoHistory'));
        tx.set(histRef, { 
          uid: window.currentUser.uid, 
          bet, 
          win, 
          net, 
          chance, 
          createdAt: window.casinoFirebase.serverTimestamp() 
        });
      });
      
      resultEl.textContent = win ? `You won ${net} ⧫ (chance ${chance}%)` : `You lost ${-net} ⧫ (chance ${chance}%)`;
    } catch (e) {
      console.error('Casino transaction error', e);
      resultEl.textContent = 'Spin failed: ' + (e.message || e);
    }

    spinBtn.disabled = false;
    document.getElementById('betAmount').disabled = false;
    wheel.classList.remove('spinning');
    if (pointer) pointer.classList.remove('spin-pointer');
    
    if (typeof window.refreshCoinDisplay === 'function') {
      window.refreshCoinDisplay();
    }

    setTimeout(() => {
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(' + (randAngle % 360) + 'deg)';
    }, 300);
  };

  wheel.addEventListener('transitionend', onEnd);
};
