// ===== CASINO WHEEL LOGIC =====

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
  // Import db and related Firestore functions from main module scope
  // (assumes forum.html has already initialized Firebase and exposed necessary items)
  if (typeof db === 'undefined') {
    console.error('Firestore db not initialized');
    return;
  }

  const bet = parseInt(document.getElementById('betAmount').value, 10);
  if (!bet || bet <= 0) { alert('Enter bet'); return; }

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

  // Set CSS variable for win angle
  const winDeg = chance * 3.6; // percent -> degrees
  wheel.style.setProperty('--win-deg', winDeg + 'deg');

  // Disable controls while spinning and add spinning visuals
  spinBtn.disabled = true;
  document.getElementById('betAmount').disabled = true;
  resultEl.textContent = 'Spinning...';
  wheel.classList.add('spinning');
  if (pointer) pointer.classList.add('spin-pointer');

  // Compute rotation: several full spins plus random angle
  const fullSpins = 6;
  const randAngle = Math.floor(Math.random() * 360);
  const totalDeg = fullSpins * 360 + randAngle;

  // Start animation
  wheel.style.transition = 'transform 4s cubic-bezier(.18,.9,.2,1)';
  wheel.style.transform = `rotate(${totalDeg}deg)`;

  // After animation ends determine result and apply transaction
  const onEnd = async () => {
    wheel.removeEventListener('transitionend', onEnd);

    // Compute pointer-facing angle
    const normalized = totalDeg % 360;
    const pointerAngle = (360 - normalized) % 360; // angle at top
    const win = pointerAngle <= winDeg;
    let net = 0;
    if (win) net = Math.floor(bet * mult);
    else net = -bet;

    try {
      // Import Firestore functions from global scope (expected to be injected from forum.html module)
      const { doc, increment, serverTimestamp, runTransaction, getDoc, updateDoc, collection, addDoc } = window.firebaseImports;

      const userRef = doc(db, 'users', currentUser.uid);
      await runTransaction(db, async (tx) => {
        const udoc = await tx.get(userRef);
        if (!udoc.exists()) throw new Error('User doc missing');
        const coins = udoc.data().avidcoin || 0;
        if (coins < bet) throw new Error('Insufficient coins');
        // Apply net change
        tx.update(userRef, { avidcoin: increment(net) });
        // Record game result inside transaction
        const histRef = doc(collection(db, 'casinoHistory'));
        tx.set(histRef, { uid: currentUser.uid, bet, win, net, chance, createdAt: serverTimestamp() });
      });
      resultEl.textContent = win ? `You won ${net} ⧫ (chance ${chance}%)` : `You lost ${-net} ⧫ (chance ${chance}%)`;
    } catch (e) {
      console.error('Casino transaction error', e);
      resultEl.textContent = 'Spin failed: ' + (e.message || e);
    }

    // Re-enable controls
    spinBtn.disabled = false;
    document.getElementById('betAmount').disabled = false;
    wheel.classList.remove('spinning');
    if (pointer) pointer.classList.remove('spin-pointer');

    // Refresh coin display (call global function from forum.html)
    if (typeof refreshCoinDisplay === 'function') {
      refreshCoinDisplay();
    }

    // Reset wheel slowly to avoid jump next spin
    setTimeout(() => {
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(' + (randAngle % 360) + 'deg)';
    }, 300);
  };

  wheel.addEventListener('transitionend', onEnd);
};
