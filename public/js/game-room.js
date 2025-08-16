const socket = io();
let currentQuestion = 0;
let answered = false;
let startTime = null;

// ตัวแปรสำหรับเก็บสถานะเกม - รวมจากไฟล์แรก
let currentPlayerScore = window.initialPlayerScore || 0;
let playerIngredients = window.initialPlayerIngredients || [];

// ตรวจสอบว่าเกมจบแล้วหรือไม่
const isGameFinished = window.isGameFinished || false;

// ถ้าเกมจบแล้ว ให้ดึงข้อมูลผู้ชนะทันที
if (isGameFinished) {
  console.log('เกมจบแล้ว - ดึงข้อมูลผู้ชนะ');
  
  // แสดงส่วนผู้ชนะทันที
  const gameOverBanner = document.getElementById('game-over-banner');
  const gameOverBannerHidden = document.getElementById('game-over-banner-hidden');
  
  if (gameOverBanner) {
    gameOverBanner.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะเมื่อโหลดหน้า');
  } else if (gameOverBannerHidden) {
    gameOverBannerHidden.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะที่ซ่อนอยู่เมื่อโหลดหน้า');
  }
  
  // ซ่อนส่วนเกม
  const gameArea = document.getElementById('game-area');
  if (gameArea) {
    gameArea.style.display = 'none';
    console.log('ซ่อนส่วนเกมเมื่อโหลดหน้า');
  }
  
  // ซ่อนปุ่มเกมต่างๆ
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  
  if (startBtn) startBtn.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (resetBtn) resetBtn.classList.add('hidden');
  
  console.log('ซ่อนปุ่มเกมเมื่อโหลดหน้า');
  
  // ดึงข้อมูลผู้ชนะทันที
  socket.emit('get_game_winner', { roomId: window.roomId });
}

// สำหรับวัตถุดิบและอาหาร
let myPoints = window.initialPlayerScore || 0;
let myIngredients = window.initialPlayerIngredients || [];
let myFood = '';

// ตัวแปรสำหรับเก็บสถานะเกม
let gameState = window.initialGameState || {
  currentQuestion: 0,
  answeredQuestions: [],
  gameStarted: false,
  gameFinished: false
};

console.log('Initial game state from window:', window.initialGameState);
console.log('Final game state:', gameState);
console.log('Debug - Initial Player Score from window:', window.initialPlayerScore);
console.log('Debug - Current Player Score variable:', currentPlayerScore);
console.log('Debug - My Points variable:', myPoints);

// อัปเดตคะแนนทันทีเมื่อ JavaScript โหลดเสร็จ
if (window.initialPlayerScore !== undefined && window.initialPlayerScore !== null) {
  currentPlayerScore = window.initialPlayerScore;
  myPoints = window.initialPlayerScore;
  
  // อัปเดต UI ทันที
  const myPointsEl = document.getElementById('my-points');
  if (myPointsEl) {
    myPointsEl.textContent = window.initialPlayerScore;
    console.log('Updated my-points element with score:', window.initialPlayerScore);
  }
}

// --- Room deleted event ---
socket.on('room_deleted', function (data) {
  showNotification('ห้องนี้ถูกลบแล้ว', 'info');
  window.location.href = '/quiz';
});

// เมื่อห้องเต็ม
socket.on('room_full', function (data) {
  window.location.href = '/quiz';
});

// จัดการ error จากเกม
socket.on('game_error', function (data) {
  showNotification(data.message || 'เกิดข้อผิดพลาดในเกม', 'error');
});

// ฟังก์ชันแสดงการแจ้งเตือน
function showNotification(message, type = 'info') {
  const iconMap = {
    'info': 'info',
    'success': 'success',
    'error': 'error',
    'warning': 'warning'
  };

  Swal.fire({
    title: message,
    icon: iconMap[type] || 'info',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#fff',
    customClass: {
      popup: 'rounded-lg shadow-lg'
    }
  });
}

// ===============================
// เพิ่มส่วนการซื้อวัตถุดิบจากไฟล์แรก
// ===============================

// ฟังก์ชันซื้อวัตถุดิบ - จากไฟล์แรก
function buyIngredient(ingredientName) {
  // ค้นหาราคาจาก DOM
  const ingredientBtn = document.querySelector(`[data-ingredient="${ingredientName}"]`);
  if (!ingredientBtn) return;

  // อ่านราคาจาก data-price attribute
  const price = parseInt(ingredientBtn.dataset.price) || 0;

  // ตรวจสอบว่า currentPlayerScore เป็นตัวเลขที่ถูกต้อง
  if (isNaN(currentPlayerScore) || currentPlayerScore === undefined) {
    currentPlayerScore = myPoints || 0;
  }

  // ตรวจสอบว่า price เป็นตัวเลขที่ถูกต้อง
  if (isNaN(price) || price <= 0) {
    console.error('Invalid price:', price, 'from button text:', buttonText);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด!',
      text: 'ไม่สามารถอ่านราคาวัตถุดิบได้',
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
    return;
  }

  // ตรวจสอบคะแนนก่อนซื้อ
  if (currentPlayerScore < price) {
    Swal.fire({
      title: 'คะแนนไม่พอ!',
      text: `ต้องการ ${price} คะแนน คุณมี ${currentPlayerScore} คะแนน`,
      icon: 'warning',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#f59e0b'
    });
    return;
  }

  // ยืนยันการซื้อ
  Swal.fire({
    title: 'ยืนยันการซื้อ',
    text: `คุณต้องการซื้อ ${ingredientName} ราคา ${price} คะแนน หรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ซื้อ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#ef4444'
  }).then((result) => {
    if (result.isConfirmed) {
      // อัปเดตคะแนนทันทีแบบ realtime
      const newScore = currentPlayerScore - price;

      // ตรวจสอบว่าผลลัพธ์เป็นตัวเลขที่ถูกต้อง
      if (isNaN(newScore)) {
        console.error('NaN detected in score calculation:', {
          currentPlayerScore,
          price,
          newScore
        });
        return;
      }

      currentPlayerScore = newScore;
      myPoints = currentPlayerScore;

      // เพิ่มวัตถุดิบในรายการ
      myIngredients.push(ingredientName);
      playerIngredients.push(ingredientName);

      // อัปเดต UI ทันที - แก้ไขให้อัปเดตทุกที่ที่แสดงคะแนนและวัตถุดิบ
      updateMyScore(currentPlayerScore);
      updateMyIngredients(myIngredients);

      // อัปเดตวัตถุดิบใน player list
      updatePlayerIngredientsInList(window.user.id, myIngredients);

      socket.emit('buy_ingredient', {
        roomId: window.roomId,
        userId: window.user.id,
        ingredient: ingredientName
      });
    }
  });
}

// ฟังก์ชันทำอาหาร - จากไฟล์แรก
function cookMeal(mealName, requiredIngredientsStr) {
  const requiredIngredients = requiredIngredientsStr.split(',').map(ing => ing.trim());

  // ตรวจสอบว่ามีวัตถุดิบครบหรือไม่
  const missingIngredients = requiredIngredients.filter(ing => !playerIngredients.includes(ing));

  if (missingIngredients.length > 0) {
    Swal.fire({
      title: 'วัตถุดิบไม่ครบ!',
      text: `คุณยังขาดวัตถุดิบ: ${missingIngredients.join(', ')}`,
      icon: 'warning',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#f59e0b'
    });
    return;
  }

  // ลบวัตถุดิบที่ใช้ไปจากรายการ
  const updatedIngredients = [...playerIngredients];
  requiredIngredients.forEach(ingredient => {
    const index = updatedIngredients.indexOf(ingredient);
    if (index > -1) {
      updatedIngredients.splice(index, 1);
    }
  });

  // อัปเดตวัตถุดิบในตัวแปร
  playerIngredients = updatedIngredients;
  myIngredients = updatedIngredients;

  // อัปเดต UI
  updateMyIngredients(updatedIngredients);
  updatePlayerIngredientsInList(window.user.id, updatedIngredients);

  // ส่งข้อมูลไปยัง server เพื่อบันทึกการทำอาหาร
  socket.emit('cook_meal', {
    roomId: window.roomId,
    userId: window.user.id,
    mealName: mealName,
    usedIngredients: requiredIngredients,
    remainingIngredients: updatedIngredients
  });

  // ทำอาหารสำเร็จ
  Swal.fire({
    title: 'ทำอาหารสำเร็จ!',
    text: `${mealName} 🍽️`,
    icon: 'success',
    confirmButtonText: 'เยี่ยม!',
    confirmButtonColor: '#10b981',
    timer: 2000,
    timerProgressBar: true
  });
  showCookingSuccessAnimation(mealName);
}

// ===============================
// Socket Event Handlers เพิ่มเติมจากไฟล์แรก
// ===============================

// รับการอัปเดตคะแนน - จากไฟล์แรก
socket.on('player-score-updated', ({ playerId, playerName, newScore, scoreGained }) => {
  console.log(`คะแนนอัปเดต: ${playerName} = ${newScore} (${scoreGained >= 0 ? '+' : ''}${scoreGained})`);

  // อัปเดต score ใน player list
  const scoreEl = document.getElementById(`score-${playerId}`);
  if (scoreEl) {
    scoreEl.textContent = newScore;
  }

  // อัปเดต score ใน score list ด้วย
  const scoreListEl = document.querySelector(`#score-list #score-${playerId}`);
  if (scoreListEl) {
    scoreListEl.textContent = newScore;
  }

  // อัปเดตคะแนนใน player list ด้วย
  const playerScoreEl = document.querySelector(`#player-li-${playerId} .text-green-600`);
  if (playerScoreEl) {
    playerScoreEl.textContent = `+${newScore}`;
  }

  // ถ้าเป็นผู้เล่นเอง
  if ((window.user && window.user.id === playerId) || (user && user.id === playerId)) {
    updateMyScore(newScore);

    // แสดง animation
    if (scoreGained > 0) {
      showScoreGainAnimation(scoreGained);
    } else if (scoreGained < 0) {
      showScoreLossAnimation(Math.abs(scoreGained));
    }
  }
});

// รับการอัปเดตวัตถุดิบแบบ realtime
socket.on('player_ingredients_updated', ({ userId, ingredients }) => {
  console.log(`วัตถุดิบอัปเดต: ผู้เล่น ${userId} = ${ingredients.join(', ')}`);

  // อัปเดตวัตถุดิบใน player list
  updatePlayerIngredientsInList(userId, ingredients);

  // ถ้าเป็นผู้เล่นเอง
  if ((window.user && window.user.id === userId) || (user && user.id === userId)) {
    updateMyIngredients(ingredients);
    // อัปเดตวัตถุดิบใน player list ด้วย
    updatePlayerIngredientsInList(userId, ingredients);
  }
});

// รับการโหลดวัตถุดิบของผู้เล่น
socket.on('player_ingredients_loaded', ({ userId, ingredients }) => {
  console.log(`โหลดวัตถุดิบ: ผู้เล่น ${userId} = ${ingredients.join(', ')}`);

  // อัปเดตวัตถุดิบใน player list
  updatePlayerIngredientsInList(userId, ingredients);

  // ถ้าเป็นผู้เล่นเอง
  if ((window.user && window.user.id === userId) || (user && user.id === userId)) {
    updateMyIngredients(ingredients);
    // อัปเดตวัตถุดิบใน player list ด้วย
    updatePlayerIngredientsInList(userId, ingredients);
  }
});

// รับการยืนยันการทำอาหารสำเร็จ
socket.on('meal_cooked_success', ({ mealName, usedIngredients, remainingIngredients, hasCompletedAllMeals }) => {
  console.log(`ทำอาหารสำเร็จ: ${mealName} ใช้วัตถุดิบ: ${usedIngredients.join(', ')}`);

  // อัปเดตวัตถุดิบในตัวแปร
  playerIngredients = remainingIngredients;
  myIngredients = remainingIngredients;

  // อัปเดต UI
  updateMyIngredients(remainingIngredients);
  updatePlayerIngredientsInList(window.user.id, remainingIngredients);

  // โหลดประวัติการทำอาหารใหม่
  loadCookingHistory();

  // แสดง modal ทำอาหารสำเร็จ
  let modalTitle = '<div class="flex items-center gap-3"><i class="fa-solid fa-utensils text-green-600 text-3xl"></i><span class="text-2xl font-bold text-green-800">ทำอาหารสำเร็จ!</span></div>';
  let modalHtml = `
    <div class="text-center">
      <div class="mb-4">
        <div class="text-4xl mb-2">🍽️</div>
        <div class="text-xl font-semibold text-gray-800 mb-2">${mealName}</div>
        <div class="text-sm text-gray-600">ใช้วัตถุดิบ: ${usedIngredients.join(', ')}</div>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-3">
        <div class="text-green-700 font-medium">🎉 ยินดีด้วย! คุณทำอาหารสำเร็จแล้ว</div>
      </div>
    </div>
  `;

  // ถ้าทำอาหารครบแล้ว ให้แสดงข้อความพิเศษ
  if (hasCompletedAllMeals) {
    modalTitle = '<div class="flex items-center gap-3"><i class="fa-solid fa-crown text-green-600 text-3xl"></i><span class="text-2xl font-bold text-green-700">🏆 ทำอาหารครบแล้ว!</span></div>';
    modalHtml = `
      <div class="text-center">
        <div class="mb-4">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full shadow-lg mb-3">
            <i class="fa-solid fa-trophy text-2xl text-green-600"></i>
          </div>
          <div class="text-xl font-semibold text-gray-800 mb-2">${mealName}</div>
          <div class="text-sm text-gray-600">ใช้วัตถุดิบ: ${usedIngredients.join(', ')}</div>
        </div>
        <div class="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
          <div class="text-white font-bold text-lg">🎉 ยินดีด้วย! คุณทำอาหารครบทุกอย่างแล้ว!</div>
          <div class="text-green-100 text-sm mt-2">เกมจะจบในไม่ช้า...</div>
        </div>
      </div>
    `;
  }

  Swal.fire({
    title: modalTitle,
    html: modalHtml,
    icon: hasCompletedAllMeals ? 'success' : 'success',
    confirmButtonText: hasCompletedAllMeals ? 'เยี่ยมมาก!' : 'เยี่ยม!',
    confirmButtonColor: hasCompletedAllMeals ? '#10b981' : '#10b981',
    showCancelButton: false,
    allowOutsideClick: false,
    customClass: {
      popup: 'rounded-2xl shadow-2xl',
      title: 'text-lg sm:text-xl font-bold text-gray-800',
      confirmButton: 'px-6 py-2 text-lg font-semibold'
    }
  });
});

// รับการแจ้งเตือนเมื่อผู้เล่นอื่นทำอาหาร
socket.on('player_cooked_meal', ({ userId, mealName, usedIngredients, hasCompletedAllMeals }) => {
  console.log(`ผู้เล่น ${userId} ทำอาหาร: ${mealName}`);

  // ถ้าผู้เล่นทำอาหารครบแล้ว
  if (hasCompletedAllMeals) {
    showNotification(`🏆 ผู้เล่นคนหนึ่งทำอาหารครบแล้ว! เกมจะจบในไม่ช้า...`, 'success');
  }

  // แสดงข้อความแจ้งเตือน (ถ้าต้องการ)
  // สามารถเพิ่มการแสดง notification ได้ที่นี่
});

// ฟังก์ชันอัปเดตการแสดงผู้ชนะในหน้าเว็บ
function updateWinnerDisplay(winnerName, roomName, winnerFoods = []) {
  console.log(`อัปเดตการแสดงผู้ชนะ: ${winnerName} ในห้อง ${roomName}`);
  console.log(`เมนูที่ผู้ชนะได้รับ:`, winnerFoods);
  
  // อัปเดตข้อความผู้ชนะในหน้าโดยตรงผ่าน ID
  const winnerNameElement = document.getElementById('winner-name');
  const winnerNameHiddenElement = document.getElementById('winner-name-hidden');
  
  if (winnerNameElement) {
    winnerNameElement.textContent = winnerName;
    console.log(`อัปเดตผู้ชนะใน winner-name element: ${winnerName}`);
  }
  
  if (winnerNameHiddenElement) {
    winnerNameHiddenElement.textContent = winnerName;
    console.log(`อัปเดตผู้ชนะใน winner-name-hidden element: ${winnerName}`);
  }
  
  // อัปเดตข้อความผู้ชนะในหน้า (fallback สำหรับ selector อื่นๆ)
  const winnerElements = [
    document.querySelector('.text-yellow-600'),
    document.querySelector('.text-yellow-200'),
    document.querySelector('[data-winner-name]'),
    document.querySelector('.text-yellow-600.font-extrabold')
  ];
  
  winnerElements.forEach(element => {
    if (element && element.textContent === 'รอข้อมูล...') { 
      element.textContent = winnerName;
      console.log(`อัปเดตผู้ชนะใน element: ${winnerName}`);
    }
  });
  
  // ถ้ายังไม่เจอ ให้อัปเดตทุก element ที่มีข้อความ "รอข้อมูล..."
  const allElements = document.querySelectorAll('*');
  allElements.forEach(element => {
    if (element.textContent === 'รอข้อมูล...') {
      element.textContent = winnerName;
      console.log(`อัปเดตผู้ชนะ (fallback): ${winnerName}`);
    }
  });
  
  // แสดงส่วนผู้ชนะทันที
  const gameOverBanner = document.getElementById('game-over-banner');
  const gameOverBannerHidden = document.getElementById('game-over-banner-hidden');
  
  if (gameOverBanner) {
    gameOverBanner.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะแล้ว');
  } else if (gameOverBannerHidden) {
    gameOverBannerHidden.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะที่ซ่อนอยู่แล้ว');
  }
  
  // ซ่อนส่วนเกม
  const gameArea = document.getElementById('game-area');
  if (gameArea) {
    gameArea.style.display = 'none';
    console.log('ซ่อนส่วนเกมแล้ว');
  }
  
  // อัปเดตสถานะห้องในหน้า
  if (gameOverBanner) {
    gameOverBanner.style.display = 'block';
  }
  
  // แสดงเมนูใน Game Over banner
  const winnerFoodsDisplay = document.getElementById('winner-foods-display');
  const winnerFoodsList = document.getElementById('winner-foods-list');
  const winnerFoodsDisplayHidden = document.getElementById('winner-foods-display-hidden');
  const winnerFoodsListHidden = document.getElementById('winner-foods-list-hidden');
  
  if (winnerFoods && winnerFoods.length > 0) {
    // สร้าง HTML สำหรับเมนู
    const foodsHTML = winnerFoods.map(food => `
      <span class="inline-flex items-center bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-sm font-semibold">
        <i class="fa-solid fa-check text-yellow-600 mr-1"></i>
        ${food}
      </span>
    `).join('');
    
    // อัปเดตส่วนที่แสดง
    if (winnerFoodsDisplay && winnerFoodsList) {
      winnerFoodsList.innerHTML = foodsHTML;
      winnerFoodsDisplay.style.display = 'block';
      console.log(`แสดงเมนูใน Game Over banner: ${winnerFoods.join(', ')}`);
    }
    
    // อัปเดตส่วนที่ซ่อนอยู่
    if (winnerFoodsDisplayHidden && winnerFoodsListHidden) {
      winnerFoodsListHidden.innerHTML = foodsHTML;
      winnerFoodsDisplayHidden.style.display = 'block';
      console.log(`แสดงเมนูใน Game Over banner ที่ซ่อนอยู่: ${winnerFoods.join(', ')}`);
    }
  }
  
  // ซ่อนปุ่มเกม
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  
  if (startBtn) startBtn.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (resetBtn) resetBtn.classList.add('hidden');
  
  // ซ่อนคำถามและตัวเลือก
  const questionContainer = document.getElementById('question-container');
  const choicesContainer = document.getElementById('choices-container');
  const questionText = document.getElementById('question-text');
  const hintText = document.getElementById('hint-text');
  
  if (questionContainer) questionContainer.style.display = 'none';
  if (choicesContainer) choicesContainer.style.display = 'none';
  if (questionText) questionText.style.display = 'none';
  if (hintText) hintText.style.display = 'none';
  
  // อัปเดตข้อความใน waiting area
  const waitingArea = document.getElementById('waiting-area');
  if (waitingArea) {
    // สร้าง HTML สำหรับแสดงเมนู
    let foodsHTML = '';
    if (winnerFoods && winnerFoods.length > 0) {
      foodsHTML = `
        <div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 class="text-sm font-bold text-yellow-800 mb-2">
            <i class="fa-solid fa-utensils mr-1"></i>เมนูที่ได้รับ:
          </h4>
          <div class="flex flex-wrap gap-2 justify-center">
            ${winnerFoods.map(food => `
              <span class="inline-flex items-center bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-sm font-semibold">
                <i class="fa-solid fa-check text-yellow-600 mr-1"></i>
                ${food}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    waitingArea.innerHTML = `
      <div class="text-center">
        <div class="mb-4">
          <i class="fa-solid fa-crown text-4xl text-yellow-500 mb-2"></i>
        </div>
        <h3 class="text-xl font-bold text-green-600 mb-2">🏆 ผู้ชนะ</h3>
        <p class="text-lg font-semibold text-gray-800 mb-2">${winnerName}</p>
        <p class="text-sm text-gray-600">ห้อง: ${roomName}</p>
        ${foodsHTML}
        <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-700 font-medium">
            <i class="fa-solid fa-info-circle mr-1"></i>
            ห้องนี้จบเกมแล้ว - ไม่สามารถเล่นต่อได้
          </p>
        </div>
      </div>
    `;
  }
}

// รับการแจ้งเตือนเมื่อเกมจบแล้ว
socket.on('game_ended', ({ winner, roomId, roomName }) => {
  console.log(`เกมจบแล้ว! ผู้ชนะ: ${winner.name}`);
  
  // อัปเดตสถานะเกม
  currentQuestion = 0;
  answeredQuestions = [];
  gameStarted = false;
  gameFinished = true;
  isGameFinished = true;
  
  // แสดงส่วนผู้ชนะทันที
  const gameOverBanner = document.getElementById('game-over-banner');
  const gameOverBannerHidden = document.getElementById('game-over-banner-hidden');
  
  if (gameOverBanner) {
    gameOverBanner.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะเมื่อเกมจบ');
  } else if (gameOverBannerHidden) {
    gameOverBannerHidden.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะที่ซ่อนอยู่เมื่อเกมจบ');
    
    // เพิ่ม event listener สำหรับปุ่มออกจากห้องในส่วนที่ซ่อนอยู่
    const leaveBtnHidden = document.getElementById('leave-room-btn-finished-hidden');
    if (leaveBtnHidden) {
      leaveBtnHidden.addEventListener('click', function() {
        window.location.href = '/quiz';
      });
    }
  }
  
  // ซ่อนส่วนเกม
  const gameArea = document.getElementById('game-area');
  if (gameArea) {
    gameArea.style.display = 'none';
  }
  
  // อัปเดต UI ทันที - แสดงผู้ชนะในหน้าเว็บ
  updateWinnerDisplay(winner.name, roomName, winner.foods);
  
  // ซ่อนปุ่มเกมต่างๆ
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  
  if (startBtn) startBtn.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (resetBtn) resetBtn.classList.add('hidden');
  
  console.log('ซ่อนปุ่มเกมเมื่อเกมจบ');
  
  // หยุดการเรียกข้อมูลซ้ำ
  if (window.checkWinnerInterval) {
    clearInterval(window.checkWinnerInterval);
  }
  
  // สร้าง HTML สำหรับแสดงเมนูใน Modal
  let foodsModalHTML = '';
  if (winner.foods && winner.foods.length > 0) {
    foodsModalHTML = `
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h4 class="text-sm font-bold text-yellow-800 mb-2">
          <i class="fa-solid fa-utensils mr-1"></i>เมนูที่ได้รับ:
        </h4>
        </div>
        <div class="flex flex-wrap gap-2 justify-center">
          ${winner.foods.map(food => `
            <span class="inline-flex items-center bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-sm font-semibold">
              <i class="fa-solid fa-check text-yellow-600 mr-1"></i>
              ${food}
            </span>
          `).join('')}
        </div>
    `;
  }
  
  // แสดง modal ผู้ชนะ (ไม่บังคับออกจากห้อง)
  Swal.fire({
    title: '<div class="flex items-center justify-center gap-3"><i class="fa-solid fa-crown text-green-600 text-3xl"></i><span class="text-3xl font-black text-green-700">🎊 เกมจบแล้ว! 🎊</span></div>',
    html: `
      <div class="text-center">
        <div class="mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full shadow-lg mb-4">
            <i class="fa-solid fa-trophy text-3xl text-green-600"></i>
          </div>
        </div>
        <h3 class="text-2xl font-bold text-green-700 mb-3">🏆 ผู้ชนะ</h3>
        <div class="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-4 mb-4 shadow-lg">
          <p class="text-xl font-bold">${winner.name}</p>
        </div>
        ${foodsModalHTML}
        <p class="text-gray-700 mb-4 font-medium">ทำอาหารครบทุกอย่างแล้ว!</p>
        <div class="bg-green-50 border border-green-200 rounded-lg p-3">
          <p class="text-sm text-green-700 font-semibold">
            <i class="fa-solid fa-home mr-2"></i>ห้อง: ${roomName}
          </p>
        </div>
        <div class="mt-4 text-xs text-gray-500">
          <i class="fa-solid fa-info-circle mr-1"></i>
          ห้องนี้จบเกมแล้ว - คำถามถูกรีเซ็ตแล้ว
        </div>
      </div>
    `,
    icon: 'success',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#10b981',
    allowOutsideClick: true,
    allowEscapeKey: true,
    showCancelButton: false,
    customClass: {
      popup: 'rounded-2xl shadow-2xl border-4 border-green-200',
      title: 'text-lg sm:text-xl font-bold',
      confirmButton: 'px-6 py-3 text-lg font-semibold rounded-xl'
    }
  });
  
  // ปิดปุ่มต่างๆ ในเกม
  disableGameControls();
  
  // แสดง notification ว่าผู้ชนะคือใคร
  showNotification(`🏆 ผู้ชนะ: ${winner.name}`, 'success');
});

// รับข้อมูลผู้ชนะสำหรับห้องที่จบแล้ว
socket.on('game_winner_info', ({ winner, roomName }) => {
  console.log(`ข้อมูลผู้ชนะ: ${winner.name}`);
  
  // อัปเดตการแสดงผู้ชนะในหน้าเว็บทันที
  updateWinnerDisplay(winner.name, roomName, winner.foods);
  
  // แสดงส่วนผู้ชนะทันที
  const gameOverBanner = document.getElementById('game-over-banner');
  const gameOverBannerHidden = document.getElementById('game-over-banner-hidden');
  
  if (gameOverBanner) {
    gameOverBanner.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะเมื่อได้รับข้อมูล');
  } else if (gameOverBannerHidden) {
    gameOverBannerHidden.style.display = 'block';
    console.log('แสดงส่วนผู้ชนะที่ซ่อนอยู่เมื่อได้รับข้อมูล');
  }
  
  // ซ่อนส่วนเกม
  const gameArea = document.getElementById('game-area');
  if (gameArea) {
    gameArea.style.display = 'none';
    console.log('ซ่อนส่วนเกมเมื่อได้รับข้อมูล');
  }
  
  // ซ่อนปุ่มเกมต่างๆ
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  
  if (startBtn) startBtn.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (resetBtn) resetBtn.classList.add('hidden');
  
  console.log('ซ่อนปุ่มเกมเมื่อได้รับข้อมูลผู้ชนะ');
  
  // หยุดการเรียกข้อมูลซ้ำ
  if (window.checkWinnerInterval) {
    clearInterval(window.checkWinnerInterval);
  }
  
  // แสดง notification ว่าผู้ชนะคือใคร
  showNotification(`🏆 ผู้ชนะ: ${winner.name}`, 'success');
});



// รับการแจ้งเตือนห้องจบแล้ว
socket.on('room_finished', ({ roomId, message }) => {
  console.log(`ห้อง ${roomId} จบแล้ว:`, message);
  
  // อัปเดตสถานะห้อง
  isGameFinished = true;
  gameFinished = true;
  gameStarted = false;
  
  // อัปเดต UI ทันที
  const waitingArea = document.getElementById('waiting-area');
  if (waitingArea) {
    waitingArea.innerHTML = `
      <div class="text-center">
        <div class="mb-4">
          <i class="fa-solid fa-crown text-4xl text-yellow-500 mb-2"></i>
        </div>
        <h3 class="text-xl font-bold text-green-600 mb-2">🏆 เกมจบแล้ว!</h3>
        <p class="text-lg font-semibold text-gray-800 mb-2">รอข้อมูลผู้ชนะ...</p>
        <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-700 font-medium">
            <i class="fa-solid fa-info-circle mr-1"></i>
            ห้องนี้จบเกมแล้ว - ไม่สามารถเล่นต่อได้
          </p>
        </div>
      </div>
    `;
  }
  
  // ปิดการควบคุมเกม
  disableGameControls();
  
  // ซ่อนคำถามและตัวเลือก
  const questionContainer = document.getElementById('question-container');
  const choicesContainer = document.getElementById('choices-container');
  const questionText = document.getElementById('question-text');
  const hintText = document.getElementById('hint-text');
  
  if (questionContainer) questionContainer.style.display = 'none';
  if (choicesContainer) choicesContainer.style.display = 'none';
  if (questionText) questionText.style.display = 'none';
  if (hintText) hintText.style.display = 'none';
  
  // หยุดการเรียกข้อมูลซ้ำ
  if (window.checkWinnerInterval) {
    clearInterval(window.checkWinnerInterval);
  }
});

// รับอาหารที่สุ่มได้เมื่อเข้าห้อง
socket.on('foods_assigned', ({ roomId, userId, foods }) => {
  console.log(`ได้รับอาหารที่สุ่ม: ${foods.join(', ')}`);
  
  // อัปเดตอาหารใน player list
  updatePlayerFoodsInList(userId, foods);
  
  // ถ้าเป็นผู้เล่นเอง ให้อัปเดตส่วนแสดงอาหารด้วย
  if ((window.user && window.user.id === userId) || (user && user.id === userId)) {
    updateMyFoodsDisplay(foods);
  }
});

// รับรายการอาหารทั้งหมดในห้อง
socket.on('room_foods', ({ roomId, foods }) => {
  console.log('รายการอาหารทั้งหมดในห้อง:', foods);
  
  // อัปเดตอาหารของทุกผู้เล่นใน player list
  foods.forEach(({ userId, userName, foods: playerFoods }) => {
    updatePlayerFoodsInList(userId, playerFoods);
  });
});

// รับอาหารของตัวเอง
socket.on('my_foods', ({ roomId, userId, foods }) => {
  console.log(`อาหารของตัวเอง: ${foods.join(', ')}`);
  
  // อัปเดตส่วนแสดงอาหารของตัวเอง
  updateMyFoodsDisplay(foods);
  
  // อัปเดตอาหารใน player list
  updatePlayerFoodsInList(userId, foods);
});

// รับการอัปเดตรายชื่อผู้เล่น
socket.on('player_list_updated', ({ roomId, players }) => {
  console.log('อัปเดตรายชื่อผู้เล่น:', players);
  updatePlayerList(players);
  
  // อัปเดตจำนวนผู้เล่นด้วย
  if (players) {
    updatePlayerCount(players.length);
  }
});

// รับการอัปเดตจำนวนผู้เล่นในห้อง
socket.on('update_room_player_count', ({ roomId, count }) => {
  console.log('อัปเดตจำนวนผู้เล่น:', count);
  updatePlayerCount(count);
});

// รับการแจ้งเตือนเมื่อมีผู้เล่นใหม่เข้าร่วม
socket.on('user_joined', ({ user, socketId }) => {
  console.log(`ผู้เล่น ${user.name} เข้าร่วมห้อง`);
  showNotification(`${user.name} เข้าร่วมห้อง`, 'info');
  
  // อัปเดตจำนวนผู้เล่น
  const playerCountEl = document.getElementById('player-count');
  if (playerCountEl) {
    const currentCount = parseInt(playerCountEl.textContent) || 0;
    playerCountEl.textContent = currentCount + 1;
  }
});

// รับการแจ้งเตือนเมื่อมีผู้เล่นออกจากห้อง
socket.on('user_left', ({ user, socketId }) => {
  console.log(`ผู้เล่น ${user.name} ออกจากห้อง`);
  showNotification(`${user.name} ออกจากห้อง`, 'info');
  
  // ลบผู้เล่นออกจากรายชื่อทันที
  const playerLi = document.getElementById(`player-li-${user.id}`);
  if (playerLi) {
    playerLi.remove();
    console.log(`Removed player ${user.name} from player list`);
  }
  
  // อัปเดตจำนวนผู้เล่น
  const playerCountEl = document.getElementById('player-count');
  if (playerCountEl) {
    const currentCount = parseInt(playerCountEl.textContent) || 0;
    playerCountEl.textContent = Math.max(0, currentCount - 1);
  }
});

// รับรายชื่อผู้เล่นในห้อง
socket.on('room_players', ({ roomId, players }) => {
  console.log('ได้รับ event room_players');
  console.log('roomId:', roomId);
  console.log('รายชื่อผู้เล่นในห้อง:', players);
  updatePlayerList(players);
  updatePlayerCount(players.length);
});

// รับรายการประวัติการทำอาหาร
socket.on('cooked_meals_list', ({ roomId, userId, cookedMeals }) => {
  console.log(`ประวัติการทำอาหาร: ${cookedMeals.length} รายการ`);
  updateCookingHistoryUI(cookedMeals);
});

// ฟังก์ชันโหลดอาหารที่สุ่มได้
function loadMyFoods() {
  console.log('โหลดอาหารที่สุ่มได้...');
  
  // ส่งคำขอไปยัง server เพื่อรับอาหารที่สุ่มได้
  socket.emit('get_my_foods', {
    roomId: window.roomId,
    userId: window.user.id
  });
  
  // ส่งคำขอไปยัง server เพื่อรับรายการอาหารทั้งหมดในห้อง
  socket.emit('get_room_foods', {
    roomId: window.roomId
  });
}

// ฟังก์ชันโหลดรายชื่อผู้เล่น
function loadPlayerList() {
  console.log('โหลดรายชื่อผู้เล่น...');
  console.log('roomId:', window.roomId);
  console.log('userId:', window.user.id);
  
  // ส่งคำขอไปยัง server เพื่อรับรายชื่อผู้เล่นในห้อง
  socket.emit('get_room_players', {
    roomId: window.roomId
  });
}

// ฟังก์ชันอัปเดตอาหารใน player list
function updatePlayerFoodsInList(userId, foods) {
  const playerLi = document.getElementById(`player-li-${userId}`);
  if (!playerLi) return;
  
  // หา element ที่แสดงอาหาร
  let foodDiv = playerLi.querySelector('.text-xs.text-blue-600');
  
  if (foods && foods.length > 0) {
    if (!foodDiv) {
      // สร้าง element ใหม่ถ้ายังไม่มี
      foodDiv = document.createElement('div');
      foodDiv.className = 'mt-1 text-xs text-blue-600';
      foodDiv.innerHTML = '<i class="fa-solid fa-utensils mr-1"></i>';
      playerLi.appendChild(foodDiv);
    }
    foodDiv.innerHTML = `<i class="fa-solid fa-utensils mr-1"></i>${foods.join(', ')}`;
  } else if (foodDiv) {
    // ลบ element ถ้าไม่มีอาหาร
    foodDiv.remove();
  }
}

// ฟังก์ชันอัปเดตส่วนแสดงอาหารของตัวเอง
function updateMyFoodsDisplay(foods) {
  console.log('อัปเดตส่วนแสดงอาหาร:', foods);
  
  // อัปเดตข้อมูลใน window.playerFoods
  if (!window.playerFoods) {
    window.playerFoods = {};
  }
  window.playerFoods[window.user.id] = foods;
  
  // อัปเดตส่วนแสดงอาหารในหน้าเว็บ
  const foodSection = document.querySelector('.bg-white.rounded-2xl.shadow.p-6.mt-6');
  if (!foodSection) return;
  
  const foodGrid = foodSection.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
  if (!foodGrid) return;
  
  if (foods && foods.length > 0) {
    // กรองเฉพาะอาหารที่มีใน playerFoods
    const availableMeals = window.mealIngredients ? window.mealIngredients.filter(meal => 
      foods.includes(meal.meal_name)
    ) : [];
    
    if (availableMeals.length > 0) {
      const foodHTML = availableMeals.map(meal => `
        <div class="bg-green-50 rounded-xl p-4 flex flex-col items-center shadow border border-green-100 hover:bg-green-100 transition-colors duration-200">
          <div class="w-24 h-24 bg-white rounded-xl mb-2 flex items-center justify-center overflow-hidden border border-green-200">
            ${meal.image_file ? 
              `<img src="/img/${meal.image_file}" 
                   alt="${meal.meal_name}" 
                   class="object-cover w-full h-full" 
                   loading="lazy"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                
               <!-- Fallback icon if image fails -->
               <div style="display:none;" class="flex items-center justify-center">
                 <i class="fa-solid fa-utensils text-green-400 text-2xl"></i>
               </div>` :
              `<span class="text-4xl text-green-300">
                 <i class="fa-solid fa-utensils"></i>
               </span>`
            }
          </div>
          
          <div class="font-bold text-xl text-green-800 text-center mb-1">${meal.meal_name}</div>
          <div class="text-gray-700 text-center mb-2">วัตถุดิบ: ${meal.ingredients}</div>
          
          <!-- เพิ่มปุ่มสำหรับทำอาหาร -->
          <button class="cook-meal-btn cursor-pointer mt-4 bg-green-500 hover:bg-green-600 text-white rounded-lg px-6 py-4 font-semibold transition-colors duration-200" 
                  data-meal="${meal.meal_name}" 
                  data-ingredients="${meal.ingredients}">
            <i class="fa-solid fa-fire mr-1"></i>ทำอาหาร
          </button>
          <!-- สถานะการทำอาหาร (จะถูกอัปเดตด้วย JavaScript) -->
          <div class="cook-status mt-2 text-center hidden">
            <span class="inline-flex items-center bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
              <i class="fa-solid fa-check mr-1"></i>ทำเสร็จแล้ว
            </span>
          </div>
        </div>
      `).join('');
      
      foodGrid.innerHTML = foodHTML;
    } else {
      // แสดงข้อความว่าไม่มีอาหารที่ได้รับ
      foodGrid.innerHTML = `
        <div class="col-span-full text-center p-8 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center">
          <i class="fa-solid fa-utensils text-gray-400 text-4xl mb-4"></i>
          <p class="text-gray-600 font-semibold">ยังไม่มีอาหารที่ได้รับ</p>
          <p class="text-gray-500 text-sm mt-2">เล่นเกมเพื่อรับอาหารใหม่</p>
        </div>
      `;
    }
  } else {
    // แสดงข้อความว่าไม่มีอาหารที่ได้รับ
    foodGrid.innerHTML = `
      <div class="col-span-full text-center p-8 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center">
        <i class="fa-solid fa-utensils text-gray-400 text-4xl mb-4"></i>
        <p class="text-gray-600 font-semibold">ยังไม่มีอาหารที่ได้รับ</p>
        <p class="text-gray-500 text-sm mt-2">เล่นเกมเพื่อรับอาหารใหม่</p>
      </div>
    `;
  }
}

// ฟังก์ชันอัปเดตรายชื่อผู้เล่น
function updatePlayerList(players) {
  console.log('อัปเดตรายชื่อผู้เล่น:', players);
  
  const playerList = document.getElementById('player-list');
  if (!playerList) {
    console.error('ไม่พบ element player-list');
    return;
  }
  
  console.log('พบ element player-list:', playerList);
  
  if (players && players.length > 0) {
    console.log('สร้าง HTML สำหรับผู้เล่น:', players.length, 'คน');
    
    const playerHTML = players.map(player => {
      const isOwner = player.is_owner === 1;
      const playerFoods = window.playerFoods && window.playerFoods[player.id] ? window.playerFoods[player.id] : [];
      
      const html = `
        <li class="mb-1 ${isOwner ? 'font-bold text-purple-700' : ''}" id="player-li-${player.id}">
          <i class="fa-solid fa-user"></i> <span class="player-name">${player.name}</span> 
          <span class="text-xs text-gray-400">${isOwner ? '(เจ้าของห้อง)' : ''}</span> 
          <span class="ml-2 text-green-600 font-bold">+${player.score}</span>
          ${playerFoods.length > 0 ? `
            <div class="mt-1 text-xs text-blue-600">
              <i class="fa-solid fa-utensils mr-1"></i>
              ${playerFoods.join(', ')}
            </div>
          ` : ''}
        </li>
      `;
      
      console.log(`สร้าง HTML สำหรับผู้เล่น ${player.name}:`, html);
      return html;
    }).join('');
    
    console.log('HTML ทั้งหมด:', playerHTML);
    playerList.innerHTML = playerHTML;
    console.log('อัปเดต playerList.innerHTML เรียบร้อย');
  } else {
    console.log('ไม่มีผู้เล่นในห้อง');
    playerList.innerHTML = '<li class="text-gray-500 italic">ไม่มีผู้เล่นในห้อง</li>';
  }
}

// ฟังก์ชันอัปเดตจำนวนผู้เล่น
function updatePlayerCount(count) {
  console.log('อัปเดตจำนวนผู้เล่น:', count);
  
  const playerCountEl = document.getElementById('player-count');
  if (playerCountEl) {
    playerCountEl.textContent = count;
  }
}

// ฟังก์ชันอัปเดต UI ประวัติการทำอาหาร
function updateCookingHistoryUI(cookedMeals) {
  const container = document.getElementById('cooked-meals-list');
  if (!container) return;

  if (cookedMeals && cookedMeals.length > 0) {
    const mealsHTML = cookedMeals.map(meal => {
      const cookedDate = new Date(meal.cooked_at).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="bg-white rounded-lg p-4 mb-3 shadow-sm border border-orange-200 hover:shadow-md transition-shadow duration-200">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600">
                <i class="fa-solid fa-utensils text-sm"></i>
              </span>
              <span class="font-bold text-orange-800 text-lg">${meal.meal_name}</span>
            </div>
            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              ${cookedDate}
            </span>
          </div>
          <div class="text-sm text-gray-600">
            <span class="font-semibold">ใช้วัตถุดิบ:</span> ${meal.used_ingredients}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = mealsHTML;

    // อัปเดตสถานะการทำอาหารในส่วนแสดงอาหารที่ได้รับ
    updateMealCookStatus(cookedMeals);
  } else {
    container.innerHTML = `
      <div class="text-center text-gray-500 italic">
        <i class="fa-solid fa-utensils text-2xl mb-2"></i>
        <p>ยังไม่มีประวัติการทำอาหาร</p>
      </div>
    `;
  }
}

// ฟังก์ชันสำหรับบันทึกสถานะเกม
function saveGameState() {
  const gameStateToSave = {
    currentQuestion: currentQuestion,
    answeredQuestions: gameState.answeredQuestions,
    gameStarted: gameState.gameStarted,
    gameFinished: gameState.gameFinished
  };

  socket.emit('save_game_state', {
    roomId: window.roomId,
    userId: window.user.id,
    gameState: gameStateToSave
  });
}

// ฟังก์ชันอัปเดตสถานะการทำอาหารในส่วนแสดงอาหารที่ได้รับ
function updateMealCookStatus(cookedMeals) {
  const cookedMealNames = cookedMeals.map(meal => meal.meal_name);

  // หาปุ่มทำอาหารทั้งหมด
  document.querySelectorAll('.cook-meal-btn').forEach(btn => {
    const mealName = btn.dataset.meal;
    const statusDiv = btn.parentElement.querySelector('.cook-status');

    if (cookedMealNames.includes(mealName)) {
      // ถ้าทำเสร็จแล้ว
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>ทำเสร็จแล้ว';
      btn.classList.remove('bg-green-500', 'hover:bg-green-600');
      btn.classList.add('bg-gray-400', 'hover:bg-gray-400');

      if (statusDiv) {
        statusDiv.classList.remove('hidden');
      }
    } else {
      // ถ้ายังไม่ได้ทำ
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-fire mr-1"></i>ทำอาหาร';
      btn.classList.add('bg-green-500', 'hover:bg-green-600');
      btn.classList.remove('bg-gray-400', 'hover:bg-gray-400');

      if (statusDiv) {
        statusDiv.classList.add('hidden');
      }
    }
  });

  // อัปเดตสถิติการทำอาหาร
  updateCookingStats(cookedMeals);
}

// ฟังก์ชันอัปเดตสถิติการทำอาหาร
function updateCookingStats(cookedMeals) {
  const totalCooked = cookedMeals.length;
  const totalAvailable = document.querySelectorAll('.cook-meal-btn').length;
  const completionRate = totalAvailable > 0 ? Math.round((totalCooked / totalAvailable) * 100) : 0;

  // หาอาหารที่ทำล่าสุด
  let lastCooked = '-';
  if (cookedMeals.length > 0) {
    const latestMeal = cookedMeals[0]; // เรียงตาม cooked_at DESC แล้ว
    const cookedDate = new Date(latestMeal.cooked_at);
    const now = new Date();
    const diffInMinutes = Math.floor((now - cookedDate) / (1000 * 60));

    if (diffInMinutes < 1) {
      lastCooked = 'เพิ่งทำ';
    } else if (diffInMinutes < 60) {
      lastCooked = `${diffInMinutes} นาที`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      lastCooked = `${hours} ชั่วโมง`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      lastCooked = `${days} วัน`;
    }
  }

  // อัปเดต UI
  const totalCookedEl = document.getElementById('total-cooked');
  const totalAvailableEl = document.getElementById('total-available');
  const completionRateEl = document.getElementById('completion-rate');
  const lastCookedEl = document.getElementById('last-cooked');

  if (totalCookedEl) totalCookedEl.textContent = totalCooked;
  if (totalAvailableEl) totalAvailableEl.textContent = totalAvailable;
  if (completionRateEl) completionRateEl.textContent = `${completionRate}%`;
  if (lastCookedEl) lastCookedEl.textContent = lastCooked;
}

// ฟังก์ชันดึงประวัติการทำอาหาร
function loadCookingHistory() {
  socket.emit('get_cooked_meals', {
    roomId: window.roomId,
    userId: window.user.id
  });
}



// รับผลการซื้อวัตถุดิบ - จากไฟล์แรก
socket.on('ingredient-purchased', ({ ingredientName, price, newScore, ingredients, imageFile }) => {
  console.log(`ซื้อสำเร็จ: ${ingredientName} ราคา ${price} คะแนน`);

  // อัปเดตคะแนนและวัตถุดิบของตัวเอง
  updateMyScore(newScore);
  updateMyIngredients(ingredients);

  // อัปเดตวัตถุดิบใน player list
  updatePlayerIngredientsInList(window.user.id, ingredients);

  // แสดงข้อความซื้อสำเร็จ
  showPurchaseSuccessMessage(ingredientName, price);

  // ตรวจสอบอาหารที่ทำได้ใหม่
  socket.emit('check-cookable-meals', { roomId: window.roomId || roomId });
});

// รับรายการวัตถุดิบทั้งหมด - จากไฟล์แรก
socket.on('ingredients-list', ({ ingredients }) => {
  console.log('ได้รับรายการวัตถุดิบ:', ingredients.length, 'รายการ');
  // อัปเดต UI ถ้าจำเป็น
});

// รับอาหารที่สามารถทำได้ - จากไฟล์แรก
socket.on('cookable-meals-updated', ({ playerIngredients, cookableMeals }) => {
  console.log('อาหารที่ทำได้:', cookableMeals.length, 'รายการ');
  updateCookableMealsUI(cookableMeals);
});

// รับการ reset เกม
socket.on('game_reset', ({ message, resetBy }) => {
  console.log('Game reset received:', message);
  
  // รีเซ็ตสถานะเกม
  gameState = {
    currentQuestion: 0,
    answeredQuestions: [],
    gameStarted: false,
    gameFinished: false
  };
  
  // รีเซ็ตตัวแปรเกม
  currentQuestion = 0;
  answered = false;
  selectedAnswerIdx = null;
  questions = [];
  
  // รีเซ็ตคะแนนและวัตถุดิบ
  currentPlayerScore = 0;
  myPoints = 0;
  playerIngredients = [];
  myIngredients = [];
  
  // อัปเดต UI
  updateMyScore(0);
  updateMyIngredients([]);
  updatePlayerIngredientsInList(window.user.id, []);
  
  // แสดงปุ่มเริ่มเกมสำหรับเจ้าของห้อง
  if (isOwner) {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.classList.remove('hidden');
    }
    const resetBtn = document.getElementById('reset-game-btn');
    if (resetBtn) {
      resetBtn.classList.add('hidden');
    }
  }
  
  // แสดงข้อความแจ้งเตือน
  Swal.fire({
    title: 'เกมจบแล้ว',
    text: message,
    icon: 'info',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#3b82f6'
  });
});

// รับการรีเซ็ตเกมอัตโนมัติ
socket.on('game_auto_reset', ({ message }) => {
  console.log('Game auto reset received:', message);
  
  // รีเซ็ตเฉพาะสถานะเกมและคำถาม (ไม่รีเซ็ตคะแนน วัตถุดิบ และอาหาร)
  gameState = {
    currentQuestion: 0,
    answeredQuestions: [],
    gameStarted: false,
    gameFinished: false
  };
  
  // รีเซ็ตตัวแปรเกม
  currentQuestion = 0;
  answered = false;
  selectedAnswerIdx = null;
  questions = [];
  
  // ไม่รีเซ็ตวัตถุดิบและอาหาร (เก็บไว้)
  console.log('Keeping ingredients and cooked meals unchanged in auto reset');
  
  // ไม่อัปเดต UI (เก็บวัตถุดิบและอาหารไว้)
  // updateMyIngredients([]);
  // updatePlayerIngredientsInList(user.id, []);
  
  // แสดงปุ่มเริ่มเกมสำหรับเจ้าของห้อง
  if (isOwner) {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.classList.remove('hidden');
    }
    const resetBtn = document.getElementById('reset-game-btn');
    if (resetBtn) {
      resetBtn.classList.add('hidden');
    }
  }
  
  // แสดงข้อความแจ้งเตือน
  Swal.fire({
    title: 'เกมจบแล้ว',
    text: message,
    icon: 'success',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#10b981'
  });
});

// ===============================
// UI Update Functions จากไฟล์แรก
// ===============================

function updateMyScore(newScore) {
  currentPlayerScore = newScore;
  myPoints = newScore; // ซิงค์ค่า

  // อัปเดตคะแนนในส่วน "แต้มของคุณ"
  const myPointsEl = document.getElementById('my-points');
  if (myPointsEl) {
    myPointsEl.textContent = newScore;
  }

  // อัปเดตคะแนนในรายชื่อผู้เล่น
  const scoreEl = document.getElementById(`score-${window.user.id}`);
  if (scoreEl) {
    scoreEl.textContent = newScore;
  }

  // อัปเดตคะแนนใน player list ด้วย
  const playerScoreEl = document.querySelector(`#player-li-${window.user.id} .text-green-600`);
  if (playerScoreEl) {
    playerScoreEl.textContent = `+${newScore}`;
  }
  
  // อัปเดตคะแนนใน score list ด้วย
  const scoreListEl = document.querySelector(`#score-list #score-${window.user.id}`);
  if (scoreListEl) {
    scoreListEl.textContent = newScore;
  }
}

function updateMyIngredients(ingredients) {
  playerIngredients = ingredients;
  myIngredients = ingredients; // ซิงค์ค่า

  const myIngredientsEl = document.getElementById('my-ingredients');
  if (myIngredientsEl) {
    if (ingredients.length > 0) {
      // สร้าง mapping ระหว่างชื่อวัตถุดิบกับชื่อไฟล์รูปภาพ
      const ingredientImageMap = {};
      if (window.ingredients && Array.isArray(window.ingredients)) {
        window.ingredients.forEach(ing => {
          ingredientImageMap[ing.name] = ing.image_file;
        });
      }



      // สร้าง HTML สำหรับแสดงวัตถุดิบเป็นรูปภาพ
      const ingredientsHTML = ingredients.map(ingredient => {
        // หารูปภาพจาก mapping หรือใช้ชื่อวัตถุดิบ + .png
        let imageFile = ingredientImageMap[ingredient];
        if (!imageFile) {
          // ถ้าไม่มีใน mapping ให้ใช้ชื่อวัตถุดิบ + .png
          imageFile = `${ingredient}.png`;
        }

        return `
          <div class="inline-flex items-center bg-green-100 rounded-lg px-2 py-1 mr-2 mb-2 shadow-sm border border-green-200">
            <div class="w-10 h-10 bg-white rounded-md mr-2 flex items-center justify-center overflow-hidden border border-green-300">
              <img src="/img/${imageFile}" 
                   alt="${ingredient}" 
                   class="object-cover w-full h-full" 
                   loading="lazy"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; this.onerror=null;">
              <div style="display:none;" class="flex items-center justify-center">
                <i class="fa-solid fa-carrot text-green-400 text-xs"></i>
              </div>
            </div>
            <span class="text-green-800 text-sm font-semibold">${ingredient}</span>
          </div>
        `;
      }).join('');
      myIngredientsEl.innerHTML = ingredientsHTML;
    } else {
      myIngredientsEl.innerHTML = '<span class="text-gray-500 italic">ยังไม่มี</span>';
    }
  }
}

function updatePlayerIngredientsInList(userId, ingredients) {
  // ไม่ต้องแสดงวัตถุดิบในรายชื่อผู้เล่นแล้ว
  return;
}

function updateCookableMealsUI(cookableMeals) {
  // เพิ่มคลาส highlight ให้อาหารที่ทำได้
  document.querySelectorAll('.cook-meal-btn').forEach(btn => {
    const mealName = btn.dataset.meal;
    const canCook = cookableMeals.some(meal => meal.meal_name === mealName);

    if (canCook) {
      btn.classList.remove('bg-green-500', 'hover:bg-green-600');
      btn.classList.add('bg-orange-500', 'hover:bg-orange-600', 'animate-pulse');
      btn.innerHTML = '<i class="fa-solid fa-fire mr-1"></i>พร้อมทำ!';
    } else {
      btn.classList.remove('bg-orange-500', 'hover:bg-orange-600', 'animate-pulse');
      btn.classList.add('bg-green-500', 'hover:bg-green-600');
      btn.innerHTML = '<i class="fa-solid fa-fire mr-1"></i>ทำอาหาร';
    }
  });
}

// ===============================
// Animation Functions จากไฟล์แรก
// ===============================

function showScoreGainAnimation(scoreGained) {
  Swal.fire({
    title: `+${scoreGained} คะแนน!`,
    icon: 'success',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    background: '#fff',
    customClass: {
      popup: 'rounded-lg shadow-lg text-green-600'
    }
  });
}

function showScoreLossAnimation(scoreUsed) {
  Swal.fire({
    title: `-${scoreUsed} คะแนน`,
    icon: 'warning',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    background: '#fff',
    customClass: {
      popup: 'rounded-lg shadow-lg text-red-600'
    }
  });
}

function showPurchaseSuccessMessage(ingredientName, price) {
  Swal.fire({
    title: 'ซื้อสำเร็จ!',
    text: `ซื้อ ${ingredientName} สำเร็จ! (-${price} คะแนน)`,
    icon: 'success',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#fff',
    customClass: {
      popup: 'rounded-lg shadow-lg'
    }
  });
}

function showCookingSuccessAnimation(mealName) {
  Swal.fire({
    title: '<div class="flex items-center gap-3"><i class="fa-solid fa-utensils text-green-600 text-3xl"></i><span class="text-2xl font-bold text-green-800">ทำอาหารสำเร็จ!</span></div>',
    html: `
      <div class="text-center">
        <div class="mb-4">
          <div class="text-4xl mb-2">🍽️</div>
          <div class="text-xl font-semibold text-gray-800 mb-2">${mealName}</div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-3">
          <div class="text-green-700 font-medium">🎉 ยินดีด้วย! คุณทำอาหารสำเร็จแล้ว</div>
        </div>
      </div>
    `,
    icon: 'success',
    confirmButtonText: 'เยี่ยม!',
    confirmButtonColor: '#10b981',
    showCancelButton: false,
    allowOutsideClick: false,
    customClass: {
      popup: 'rounded-2xl shadow-2xl',
      title: 'text-lg sm:text-xl font-bold text-gray-800',
      confirmButton: 'px-6 py-2 text-lg font-semibold'
    }
  });
}


function showQuestion() {
  const q = questions[currentQuestion];
  if (!q) {
    showSummary();
    return;
  }

  // ล้าง timer เก่าก่อน (ถ้ามี)
  if (currentQuestionTimer) {
    clearInterval(currentQuestionTimer);
    currentQuestionTimer = null;
  }

  let timeLeft = 20; // 20 วินาทีต่อข้อ
  answered = false;
  selectedAnswerIdx = null;
  startTime = Date.now();
  let questionEnded = false;

  const gameArea = document.getElementById('game-area');

  // สร้างปุ่มตัวเลือกแบบสุ่มตำแหน่ง
  const choices = [q.choice1, q.choice2, q.choice3, q.choice4];
  const correctAnswer = choices[q.answer_index - 1]; // คำตอบที่ถูกต้อง
  
  // สร้าง array ของตัวเลือกพร้อม index เดิม
  const choicesWithIndex = choices.map((choice, index) => ({
    text: choice,
    originalIndex: index,
    isCorrect: index === q.answer_index - 1
  }));
  
  // สุ่มตำแหน่งตัวเลือก
  const shuffledChoices = choicesWithIndex.sort(() => Math.random() - 0.5);
  
  // สร้าง mapping ระหว่างตำแหน่งใหม่กับตำแหน่งเดิม
  const choiceMapping = {};
  shuffledChoices.forEach((choice, newIndex) => {
    choiceMapping[newIndex] = choice.originalIndex;
  });
  
  // เก็บ mapping ไว้ในตัวแปร global เพื่อใช้ตอนส่งคำตอบ
  window.currentChoiceMapping = choiceMapping;
  
  let choicesHtml = shuffledChoices.map((choice, i) => {
    let btnClass = 'choice-btn w-full text-left font-semibold py-4 px-6 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 hover:shadow-lg';
    
    if (selectedAnswerIdx !== null && selectedAnswerIdx == i) {
      btnClass += ' bg-gradient-to-r from-green-100 to-emerald-100 border-green-400 text-green-800 ring-4 ring-green-300 shadow-lg';
    } else {
      btnClass += ' bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 text-purple-800 hover:from-purple-100 hover:to-indigo-100 hover:border-purple-300';
    }
    
    const optionLetter = String.fromCharCode(65 + i); // A, B, C, D
    return `
      <button class='${btnClass}' data-idx='${i}' ${selectedAnswerIdx !== null ? 'disabled' : ''}>
        <div class="flex items-center gap-3">
          <div class="bg-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm border-2 border-current">
            ${optionLetter}
          </div>
          <span class="text-lg">${choice.text}</span>
        </div>
      </button>
    `;
  }).join('');

  // เพิ่มปุ่มสำหรับเจ้าของห้องไปข้อถัดไป
  let ownerControlsHtml = '';
  if (isOwner) {
    ownerControlsHtml = `
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 shadow-lg border-2 border-amber-200">
        <div class="text-center">
          <div class="flex items-center justify-center gap-2 mb-4">
            <span class="text-amber-600 text-xl">🔧</span>
            <span class="text-amber-800 font-bold text-lg">ควบคุมเกม (เจ้าของห้อง)</span>
          </div>
          <button id="force-next-question" class="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105">
            <i class="fa-solid fa-forward mr-2"></i>ไปข้อถัดไป
          </button>
          <div class="text-sm text-amber-700 mt-3 font-medium">กดเพื่อข้ามไปข้อถัดไปทันที</div>
        </div>
      </div>
    `;
  }

  gameArea.innerHTML = `
      <!-- หัวข้อคำถาม -->
      <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200 mb-6">
        <div class="flex items-center gap-3 mb-3">
          <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-4 py-2 rounded-full text-lg">
            ข้อที่ ${currentQuestion + 1}
          </div>
          <div class="text-sm text-gray-600">จาก ${questions ? questions.length : 14} ข้อ</div>
        </div>
        <div class="text-xl font-bold text-gray-800 mb-3 leading-relaxed">${q.question_text}</div>
        
        <!-- คำใบ้ -->
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-yellow-600">💡</span>
            <span class="text-yellow-800 font-medium">คำใบ้:</span>
            <span class="text-yellow-700">${q.hint || 'ไม่มีคำใบ้'}</span>
          </div>
        </div>
        
        <!-- ตัวจับเวลา -->
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-red-600">⏰</span>
              <span class="text-red-800 font-bold">เวลาที่เหลือ:</span>
            </div>
            <div class="text-2xl font-bold text-red-600" id='question-timer'>${timeLeft}</div>
          </div>
        </div>
        
        <!-- ข้อความรอผู้เล่นอื่น -->
        <div id="waiting-answers" class="bg-blue-50 border border-blue-200 rounded-lg p-3 hidden">
          <div class="flex items-center gap-2">
            <span class="text-blue-600">👥</span>
            <span class="text-blue-800 font-medium">รอผู้เล่นอื่นตอบ...</span>
          </div>
        </div>
      </div>

      <!-- ตัวเลือกคำตอบ -->
      <div class="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 mb-6">
        <div class="text-lg font-bold text-gray-800 mb-4 text-center">เลือกคำตอบที่ถูกต้อง</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${choicesHtml}
        </div>
      </div>

      <!-- ข้อความแนะนำ -->
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200 mb-4">
        <div class="flex items-center gap-2 text-green-800">
          <span>💡</span>
          <span class="font-medium">เคล็ดลับ:</span>
          <span class="text-sm">ตอบไวได้คะแนนเต็ม ตอบช้าคะแนนลดลง</span>
        </div>
      </div>

      ${ownerControlsHtml}
    `;

  // เพิ่ม Event listener สำหรับปุ่มไปข้อถัดไป (เจ้าของห้อง)
  if (isOwner) {
    const forceNextBtn = document.getElementById('force-next-question');
    if (forceNextBtn) {
      forceNextBtn.onclick = () => {
        // ยืนยันก่อนไปข้อถัดไป
        Swal.fire({
          title: 'ยืนยันการไปข้อถัดไป',
          text: 'คุณต้องการไปยังข้อถัดไปทันทีหรือไม่?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'ไปข้อถัดไป',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#6b7280'
        }).then((result) => {
          if (result.isConfirmed) {
            // ส่งคำสั่งไปยัง server เพื่อไปข้อถัดไป
            socket.emit('owner_force_next_question', {
              roomId: window.roomId || roomId,
              questionIndex: currentQuestion
            });

            // หยุด timer ปัจจุบัน
            clearQuestionTimeout();
            if (currentQuestionTimer) {
              clearInterval(currentQuestionTimer);
              currentQuestionTimer = null;
            }

            // แสดงข้อความแจ้งเตือน
            showNotification('เจ้าของห้องข้ามไปข้อถัดไป', 'info');
          }
        });
      };
    }
  }

  // ส่วนที่เหลือของฟังก์ชั่น showQuestion() ยังคงเดิม...
  // (ส่วน timer, endQuestion, event handlers ฯลฯ)
}


// --- ส่วนฟีเจอร์ซื้อวัตถุดิบและสุ่มอาหาร ---
function updateMyShopUI() {
  // อัปเดตคะแนนในทุกที่ที่แสดง
  updateMyScore(myPoints);

  // อัปเดตวัตถุดิบ - ใช้ฟังก์ชัน updateMyIngredients แทน textContent
  updateMyIngredients(myIngredients);

  // อัปเดตวัตถุดิบใน player list
  updatePlayerIngredientsInList(window.user.id, myIngredients);
  
  // อัปเดตคะแนนใน my-points element โดยตรง (แก้ปัญหาแสดง 0)
  const myPointsEl = document.getElementById('my-points');
  if (myPointsEl && myPoints !== undefined && myPoints !== null) {
    myPointsEl.textContent = myPoints;
  }
}

socket.on('update_points_ingredients', data => {
  if (data.userId === window.user.id) {
    // ป้องกัน undefined และ NaN
    const newPoints = typeof data.points === 'number' && !isNaN(data.points) ? data.points : currentPlayerScore;

    myPoints = newPoints;
    myIngredients = data.ingredients || [];
    currentPlayerScore = newPoints; // ซิงค์ค่า
    playerIngredients = data.ingredients || []; // ซิงค์ค่า

    console.log('Update points/ingredients:', {
      points: newPoints,
      ingredients: data.ingredients,
      food: data.food
    });

    // อัปเดตคะแนนในทุกที่ที่แสดง
    updateMyScore(newPoints);

    // อัปเดตวัตถุดิบใน player list
    updatePlayerIngredientsInList(window.user.id, data.ingredients);

    // ถ้ามีอาหารใหม่ ให้แสดงป๊อบอัพ
    if (data.food && data.food !== '' && data.food !== myFood && data.food !== 'ยังทำอาหารไม่ได้') {
      myFood = data.food;
      updateMyShopUI();
      showFoodModal(myFood);
    } else {
      myFood = data.food || '';
      updateMyShopUI();
    }
  }
});

// ฟังก์ชั่นแสดงป๊อบอัพอาหาร
function showFoodModal(food) {
  Swal.fire({
    title: 'อาหารที่คุณได้รับ',
    text: food,
    icon: 'success',
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#8b5cf6',
    background: '#fff',
    customClass: {
      title: 'text-purple-700 text-xl font-bold',
      content: 'text-green-700 text-2xl font-bold'
    }
  });
}

// ===============================
// Event Listeners รวม
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // โหลดรายชื่อผู้เล่นเมื่อหน้าเว็บโหลดเสร็จ
  loadPlayerList();
  
  // อัปเดตคะแนนอีกครั้งหลังจากโหลดเสร็จ (แก้ปัญหาแสดง 0)
  setTimeout(() => {
    const myPointsEl = document.getElementById('my-points');
    if (myPointsEl && currentPlayerScore !== undefined && currentPlayerScore !== null) {
      myPointsEl.textContent = currentPlayerScore;
    }
  }, 100);
  
  // ตรวจสอบว่าเกมจบแล้วหรือไม่
  if (isGameFinished) {
    console.log('เกมจบแล้ว - ปิดการควบคุมเกม');
    disableGameControls();
    
    // ซ่อนคำถามและตัวเลือกทันที
    const questionContainer = document.getElementById('question-container');
    const choicesContainer = document.getElementById('choices-container');
    const questionText = document.getElementById('question-text');
    const hintText = document.getElementById('hint-text');
    
    if (questionContainer) questionContainer.style.display = 'none';
    if (choicesContainer) choicesContainer.style.display = 'none';
    if (questionText) questionText.style.display = 'none';
    if (hintText) hintText.style.display = 'none';
    
    // ดึงข้อมูลผู้ชนะจาก server
    socket.emit('get_game_winner', { roomId: window.roomId || roomId });
    
    // เพิ่มการตรวจสอบข้อมูลผู้ชนะทุก 2 วินาที
    const checkWinnerInterval = setInterval(() => {
      // ตรวจสอบว่าห้องจบแล้วหรือไม่
      if (isGameFinished) {
        console.log('ห้องจบแล้ว - หยุดการเรียกข้อมูลผู้ชนะ');
        clearInterval(checkWinnerInterval);
        return;
      }
      
      const winnerElement = document.querySelector('.text-yellow-600');
      if (winnerElement && winnerElement.textContent === 'รอข้อมูล...') {
        console.log('ยังไม่ได้ข้อมูลผู้ชนะ - เรียกใหม่');
        socket.emit('get_game_winner', { roomId: window.roomId || roomId });
      } else {
        clearInterval(checkWinnerInterval);
      }
    }, 2000);
    
    // เก็บ interval ไว้ใน window object เพื่อหยุดภายหลัง
    window.checkWinnerInterval = checkWinnerInterval;
  }

  // จัดการปุ่มลบห้อง (เฉพาะเจ้าของห้อง)
  const deleteRoomBtn = document.getElementById('delete-room-btn');
  if (deleteRoomBtn && isOwner) {
    deleteRoomBtn.onclick = function () {
      Swal.fire({
        title: 'ยืนยันการลบห้อง',
        text: 'คุณต้องการลบห้องนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถยกเลิกได้',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ลบห้อง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280'
      }).then((result) => {
        if (result.isConfirmed) {
          socket.emit('delete_room', window.roomId, window.user.id);
        }
      });
    };
  }

  // จัดการปุ่มรีเซ็ตเกม (เฉพาะเจ้าของห้อง)
  const resetGameBtn = document.getElementById('reset-game-btn');
  if (resetGameBtn && isOwner) {
    resetGameBtn.onclick = function () {
      Swal.fire({
        title: 'ยืนยันการรีเซ็ตเกม',
        text: 'คุณต้องการรีเซ็ตเกมใช่หรือไม่? คะแนนและวัตถุดิบทั้งหมดจะถูกลบ',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'รีเซ็ตเกม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#6b7280'
      }).then((result) => {
        if (result.isConfirmed) {
          socket.emit('reset_game', window.roomId, window.user.id);
        }
      });
    };
  }



  // Event Listeners สำหรับปุ่มต่างๆ - รวมจากไฟล์แรก
  document.addEventListener('click', function (e) {
    // ปุ่มซื้อวัตถุดิบ
    if (e.target.classList.contains('ingredient-btn')) {
      const ingredientName = e.target.dataset.ingredient;
      buyIngredient(ingredientName);
    }

    // ปุ่มทำอาหาร
    if (e.target.classList.contains('cook-meal-btn')) {
      const mealName = e.target.dataset.meal;
      const requiredIngredients = e.target.dataset.ingredients;
      cookMeal(mealName, requiredIngredients);
    }

    // ปุ่มสุ่มอาหาร
    if (e.target.id === 'random-food-btn') {
      socket.emit('random_food', { roomId: window.roomId, userId: window.user.id });
    }

    // ปุ่มตอบคำถาม (ถ้ามี)
    if (e.target.classList.contains('answer-btn')) {
      const answer = e.target.dataset.answer;
      sendAnswer(answer);
    }
  });



  // ดึงรายการวัตถุดิบ - จากไฟล์แรก
  if (window.roomId || roomId) {
    socket.emit('get-ingredients', { roomId: window.roomId || roomId });
  }

  // ดึงวัตถุดิบของผู้เล่น
  if (window.roomId || roomId) {
    socket.emit('get_player_ingredients', {
      roomId: window.roomId,
      userId: window.user.id
    });
  }

  // โหลดประวัติการทำอาหาร
  loadCookingHistory();

  // เพิ่ม event listener สำหรับปุ่มรีเฟรชประวัติ
  const refreshHistoryBtn = document.getElementById('refresh-history-btn');
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', () => {
      loadCookingHistory();
      // แสดง animation ที่ปุ่ม
      refreshHistoryBtn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>เสร็จแล้ว!';
      refreshHistoryBtn.classList.add('bg-green-500', 'hover:bg-green-600');
      refreshHistoryBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');

      setTimeout(() => {
        refreshHistoryBtn.innerHTML = '<i class="fa-solid fa-refresh mr-1"></i>รีเฟรช';
        refreshHistoryBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
        refreshHistoryBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
      }, 1000);
    });
  }

  updateMyShopUI();
  
  // อัปเดตคะแนนครั้งสุดท้ายเพื่อให้แน่ใจ (แก้ปัญหาแสดง 0)
  setTimeout(() => {
    const myPointsEl = document.getElementById('my-points');
    if (myPointsEl && currentPlayerScore !== undefined && currentPlayerScore !== null) {
      myPointsEl.textContent = currentPlayerScore;
    }
  }, 200);
});

// รับคำสั่งจากเจ้าของห้องให้ไปข้อถัดไป
socket.on('owner_forced_next_question', (data) => {
  if (data.questionIndex === currentQuestion) {
    // หยุด timer ปัจจุบัน
    clearQuestionTimeout();
    if (currentQuestionTimer) {
      clearInterval(currentQuestionTimer);
      currentQuestionTimer = null;
    }

    // แสดงเฉลยทันที
    showAnswer();

    // แสดงข้อความแจ้งเตือน
    showNotification('เจ้าของห้องข้ามไปข้อถัดไป', 'warning');

    // ไปข้อถัดไปหลังจาก 2 วินาที
    setTimeout(() => {
      currentQuestion++;
      selectedAnswerIdx = null;
      answered = false;

      // บันทึกสถานะเกม
      gameState.currentQuestion = currentQuestion;
      saveGameState();

      if (currentQuestion < questions.length) {
        showQuestion();
      } else {
        showSummary();
      }
    }, 2000);
  }
});

// เพิ่มในส่วน Owner starts game (ประมาณบรรทัดที่ 350-400)
// เพิ่มการจัดการปุ่มไปข้อถัดไปใน event handler เดิม

if (isOwner) {
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');

  if (startBtn) {
    startBtn.onclick = () => {
      socket.emit('request_questions', roomId);
      startBtn.classList.add('hidden');
    };
  }

  // ปรับปรุงปุ่ม next-btn ให้ทำงานเหมือนปุ่มใหม่
  if (nextBtn) {
    nextBtn.onclick = () => {
      // ใช้ฟังก์ชั่นเดียวกับปุ่มในเกม
      Swal.fire({
        title: 'ยืนยันการไปข้อถัดไป',
        text: 'คุณต้องการไปยังข้อถัดไปทันทีหรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ไปข้อถัดไป',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#6b7280'
      }).then((result) => {
        if (result.isConfirmed) {
          socket.emit('owner_force_next_question', {
            roomId: window.roomId || roomId,
            questionIndex: currentQuestion
          });
        }
      });
    };
  }
}

// ===============================
// ฟังก์ชันตอบคำถาม - จากไฟล์แรก
// ===============================
function sendAnswer(selectedAnswer) {
  console.log(`Sending answer: ${selectedAnswer} to room: ${window.roomId || roomId}`);

  socket.emit('answer-question', {
    roomId: window.roomId || roomId,
    answer: selectedAnswer
  });

  // ปิดการใช้งานปุ่มหลังจากตอบ
  const answerButtons = document.querySelectorAll('.answer-btn');
  answerButtons.forEach(btn => {
    btn.disabled = true;
    btn.classList.add('opacity-50');
  });
}

// ===============================
// สุ่มอาหาร - ปรับปรุงจากไฟล์แรก
// ===============================
function randomFood() {
  if (playerIngredients.length === 0) {
    Swal.fire({
      title: 'ไม่มีวัตถุดิบ!',
      text: 'คุณยังไม่มีวัตถุดิบ กรุณาซื้อวัตถุดิบก่อน',
      icon: 'info',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#3b82f6'
    });
    return;
  }

  // ใช้ socket.emit แทนการสุ่มใน client
  socket.emit('random_food', { roomId: window.roomId, userId: window.user.id });
}

// รับสถานะเกมที่โหลดมา
socket.on('game_state_loaded', ({ gameState: loadedGameState }) => {
  console.log('Loaded game state from socket:', loadedGameState);
  gameState = loadedGameState;

  // อัปเดต currentQuestion จากสถานะเกม
  currentQuestion = gameState.currentQuestion || 0;

  // ถ้าเกมเริ่มแล้ว ให้แสดงคำถามปัจจุบัน
  if (gameState.gameStarted && !gameState.gameFinished) {
    console.log('Game is in progress, current question:', currentQuestion);

    // ถ้ามีคำถามใน questions array และยังไม่จบเกม
    if (questions && questions.length > 0 && currentQuestion < questions.length) {
      // ซ่อน waiting area
      const waitingArea = document.getElementById('waiting-area');
      if (waitingArea) {
        waitingArea.classList.add('hidden');
      }

      // ซ่อนปุ่มเริ่มเกม (ถ้าไม่ใช่เจ้าของห้อง)
      if (!isOwner) {
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
          startBtn.classList.add('hidden');
        }
      }

      // แสดงคำถามปัจจุบัน
      showQuestion();

      // ตรวจสอบว่าตอบคำถามนี้แล้วหรือยัง
      if (gameState.answeredQuestions[currentQuestion]) {
        answered = true;
        selectedAnswerIdx = gameState.answeredQuestions[currentQuestion].answerIndex;

        // แสดงปุ่มที่เลือกไว้
        document.querySelectorAll('.choice-btn').forEach((btn, idx) => {
          if (idx === selectedAnswerIdx) {
            btn.classList.add('ring-4', 'ring-green-400');
          }
          btn.disabled = true;
        });

        // แสดงข้อความรอผู้เล่นอื่น
        const waitingEl = document.getElementById('waiting-answers');
        if (waitingEl) {
          waitingEl.classList.remove('hidden');
        }
      }
    } else if (currentQuestion >= questions.length) {
      // ถ้าเกมจบแล้ว ให้แสดงสรุป
      showSummary();
    }
  }
});



// ฟังก์ชันอัปเดต UI แสดงอาหารที่สุ่มได้
function updateAssignedFoodsUI(foods) {
  const container = document.getElementById('my-assigned-foods');
  if (!container) return;

  if (foods && foods.length > 0) {
    container.innerHTML = foods.map(food => `
        <div class="bg-purple-100 rounded-xl p-3 text-center border border-purple-200">
          <i class="fa-solid fa-utensils text-purple-600 text-xl mb-2"></i>
          <div class="font-semibold text-purple-800">${food}</div>
        </div>
      `).join('');
  } else {
    container.innerHTML = `
        <div class="col-span-full text-center text-gray-500 py-4">
          <i class="fa-solid fa-exclamation-triangle text-2xl mb-2"></i>
          <div>ไม่ได้รับอาหาร</div>
        </div>
      `;
  }
}

// ฟังก์ชันเปิดใช้งาน shop หลังเริ่มเกมเท่านั้น
function enableIngredientShop() {
  document.querySelectorAll('.ingredient-btn').forEach(btn => {
    btn.onclick = () => {
      const ing = btn.getAttribute('data-ingredient');
      buyIngredient(ing); // ใช้ฟังก์ชัน buyIngredient แทนเพื่อให้มี realtime update
    };
  });
  document.getElementById('random-food-btn').onclick = () => {
    socket.emit('random_food', { roomId: window.roomId, userId: window.user.id });
  };
  updateMyShopUI();
}

// เรียกใช้ enableIngredientShop เมื่อเกมเริ่มเท่านั้น
// --- Game Start: Show ingredient modal, then randomize food, then show food modal ---
let gameStartHandled = false;

// Join room
console.log('Joining room:', { roomId: window.roomId, user: window.user });
socket.emit('join_room', window.roomId, window.user);







// จัดการเมื่อผู้ใช้ออกจากหน้าเว็บ
window.addEventListener('beforeunload', () => {
  // บันทึกสถานะเกมก่อนออกจากหน้า
  if (gameState.gameStarted) {
    const isGameReallyFinished = gameState.currentQuestion >= 14;
    if (!isGameReallyFinished) {
      saveGameState();
    }
  }
  console.log('User leaving page, preserving game state');
});

// จัดการเมื่อผู้ใช้กดปุ่มย้อนกลับ
window.addEventListener('popstate', () => {
  // บันทึกสถานะเกมก่อนออกจากหน้า
  if (gameState.gameStarted) {
    const isGameReallyFinished = gameState.currentQuestion >= 14;
    if (!isGameReallyFinished) {
      saveGameState();
    }
  }
  console.log('User navigating back, preserving game state');
});

// Owner starts game
if (isOwner) {
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (startBtn) {
    startBtn.onclick = () => {
      // ซ่อนสรุปผลคะแนนเมื่อเริ่มเกมใหม่
      const gameArea = document.getElementById('game-area');
      if (gameArea) {
        gameArea.innerHTML = `
          <div id="waiting-area" class="text-center text-lg text-gray-500">
            <span id="waiting-message">กำลังโหลดคำถาม...</span>
          </div>
        `;
      }
      
      // Show question select modal
      socket.emit('request_questions', roomId);
      startBtn.classList.add('hidden');
    };
  }
  
  if (nextBtn) {
    nextBtn.onclick = () => {
      socket.emit('next_question', roomId);
    };
  }
}

// Owner receives questions to select
socket.on('select_questions', function (questions) {
  // สร้าง HTML สำหรับ SweetAlert content
  let questionsHtml = `
    <div class="text-left mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium self-start sm:self-auto">
          เลือก <span id="selected-count">0</span>/14 ข้อ
        </div>
        <button id="random-select-btn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center gap-2">
          <i class="fa-solid fa-dice"></i>
          สุ่มเลือก 14 ข้อ
        </button>
      </div>
      
      <div id="question-select-alert" class="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium text-sm hidden">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-check-circle text-green-600"></i>
          <span>เลือกครบ 14 ข้อแล้ว! พร้อมเริ่มเกม</span>
        </div>
      </div>
      
      <div class="question-grid grid grid-cols-2 gap-3 max-h-[512px] overflow-y-auto mb-4 p-4 bg-gray-50 rounded-xl">
  `;

  questions.forEach((q, i) => {
    questionsHtml += `
      <label class="question-card flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md">
        <div class="flex-shrink-0 mt-1">
          <input type="checkbox" class="q-checkbox w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2" value="${q.id}">
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded-full">${i + 1}</span>
            <span class="text-xs text-gray-500 font-medium">คำถาม</span>
          </div>
          <span class="question-text text-sm text-gray-800 leading-relaxed">${q.question_text}</span>
        </div>
      </label>
    `;
  });

  questionsHtml += `
      </div>
      
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-600">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-info-circle text-blue-500"></i>
          <span>คลิกที่คำถามเพื่อเลือก/ยกเลิก</span>
        </div>
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-clock text-orange-500"></i>
          <span>เกมจะเริ่มทันทีหลังเลือกครบ</span>
        </div>
      </div>
    </div>
  `;

  Swal.fire({
    title: '<div class="flex items-center gap-3"><i class="fa-solid fa-gamepad text-purple-600"></i><span>เลือกคำถามสำหรับเกมนี้</span></div>',
    showClass: {
      popup: `
        animate__animated
        animate__fadeIn
        animate__faster
      `
    },
    hideClass: {
      popup: `
        animate__animated
        animate__fadeOut
        animate__faster
      `
    },
    html: `
      <style>
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        .question-card:hover {
          transform: translateY(-2px);
        }
        @media (max-width: 768px) {
          .question-grid {
            grid-template-columns: 1fr !important;
          }
          .question-card {
            padding: 0.75rem !important;
          }
          .question-text {
            font-size: 0.875rem !important;
          }
        }
        @media (max-width: 480px) {
          .question-card {
            padding: 0.5rem !important;
          }
          .question-text {
            font-size: 0.8rem !important;
          }
        }
      </style>
      ${questionsHtml}
    `,
    width: window.innerWidth < 768 ? '95%' : window.innerWidth < 1024 ? '800px' : '900px',
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-play mr-2"></i>เริ่มเกม',
    cancelButtonText: '<i class="fa-solid fa-times mr-2"></i>ยกเลิก',
    confirmButtonColor: '#8b5cf6',
    cancelButtonColor: '#6b7280',
    allowOutsideClick: false,
    customClass: {
      popup: 'rounded-2xl shadow-2xl border-0',
      title: 'text-lg sm:text-xl font-bold text-gray-800',
      confirmButton: 'rounded-xl font-semibold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base',
      cancelButton: 'rounded-xl font-semibold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base',
      htmlContainer: 'text-left'
    },
    didOpen: () => {
      // Alert when 14 selected
      const checkboxes = document.querySelectorAll('.q-checkbox');
      const alert14 = document.getElementById('question-select-alert');
      const selectedCount = document.getElementById('selected-count');

      // ฟังก์ชันอัปเดต UI
      const updateUI = () => {
        const checkedCount = document.querySelectorAll('.q-checkbox:checked').length;
        selectedCount.textContent = checkedCount;

        // อัปเดตสีของ counter
        const counterElement = document.querySelector('.bg-purple-100, .bg-orange-100, .bg-green-100');
        if (checkedCount === 14) {
          counterElement.className = 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium';
          alert14.classList.remove('hidden');
          // เพิ่ม animation
          alert14.style.animation = 'bounceIn 0.6s ease-out';
        } else if (checkedCount >= 10) {
          counterElement.className = 'bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium';
          alert14.classList.add('hidden');
        } else {
          counterElement.className = 'bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium';
          alert14.classList.add('hidden');
        }
      };

      checkboxes.forEach(cb => {
        cb.addEventListener('change', updateUI);
      });

      // ปุ่มสุ่มเลือกคำถาม
      const randomSelectBtn = document.getElementById('random-select-btn');
      if (randomSelectBtn) {
        randomSelectBtn.addEventListener('click', () => {
          // ยกเลิกการเลือกทั้งหมดก่อน
          checkboxes.forEach(cb => cb.checked = false);

          // สุ่มเลือก 14 ข้อ
          const allCheckboxes = Array.from(checkboxes);
          const shuffled = allCheckboxes.sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, 14);

          // เลือกคำถามที่สุ่มได้
          selected.forEach(cb => cb.checked = true);

          // อัปเดต UI
          updateUI();

          // แสดง animation ที่ปุ่มสุ่ม
          randomSelectBtn.innerHTML = '<i class="fa-solid fa-check"></i> สุ่มเสร็จแล้ว!';
          randomSelectBtn.classList.add('bg-green-500', 'hover:bg-green-600');
          randomSelectBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');

          setTimeout(() => {
            randomSelectBtn.innerHTML = '<i class="fa-solid fa-dice"></i> สุ่มเลือก 14 ข้อ';
            randomSelectBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
            randomSelectBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
          }, 2000);
        });
      }
    },
    preConfirm: () => {
      const checked = Array.from(document.querySelectorAll('.q-checkbox:checked')).map(cb => parseInt(cb.value));
      if (checked.length !== 14) {
        Swal.showValidationMessage('กรุณาเลือก 14 ข้อ');
        return false;
      }
      return checked;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      const selectedQuestions = result.value;
      // Send selected question ids to backend
      socket.emit('questions_selected', roomId, selectedQuestions);

      // Start game immediately without countdown
      socket.emit('start_game', window.roomId, window.user.id);

      // แสดง SweetAlert แจ้งว่ากำลังเริ่มเกม
      Swal.fire({
        title: '<div class="flex items-center gap-3"><i class="fa-solid fa-rocket text-purple-600"></i><span>กำลังเริ่มเกม...</span></div>',
        text: 'เกมจะเริ่มในไม่กี่วินาที พร้อมแล้ว! 🎮',
        icon: 'success',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
        customClass: {
          popup: 'rounded-2xl shadow-2xl',
          title: 'text-lg sm:text-xl font-bold text-gray-800',
          timerProgressBar: 'bg-purple-600'
        }
      });
    }
  });
});

// รับชุดคำถามที่ใช้เล่นจริง (ทุกคนในห้อง)
socket.on('game_questions', function (selectedQuestions) {
  console.log('Received game questions:', selectedQuestions);
  
  // ใช้ลำดับคำถามที่ backend ส่งมา (ไม่ต้อง shuffle อีก)
  questions = selectedQuestions;
  
  // อัปเดต currentQuestion จากสถานะเกม (ถ้ามี)
  if (gameState && gameState.currentQuestion !== undefined) {
    currentQuestion = gameState.currentQuestion;
    console.log('Updated currentQuestion from game state:', currentQuestion);
  } else {
    currentQuestion = 0;
  }
  
  // ซ่อน waiting area และแสดงคำถาม
  const waitingArea = document.getElementById('waiting-area');
  if (waitingArea) {
    waitingArea.classList.add('hidden');
  }
  
  if (!isOwner) {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.classList.add('hidden');
    }
  }

  // ตรวจสอบว่าต้องเริ่มเกมใหม่หรือไม่
  if (!gameState.gameStarted) {
    // เริ่มเกมใหม่
    runGame();
  } else {
    // เกมเริ่มแล้ว ให้ตรวจสอบว่าเกมจบจริงหรือไม่
    const isGameReallyFinished = gameState.currentQuestion >= 14;
    if (!isGameReallyFinished) {
      // เกมยังไม่จบ ให้แสดงคำถามปัจจุบัน
      console.log('Game already started, showing current question:', currentQuestion);
      if (currentQuestion < questions.length) {
        showQuestion();

        // ตรวจสอบว่าตอบคำถามนี้แล้วหรือยัง
        if (gameState.answeredQuestions && gameState.answeredQuestions[currentQuestion]) {
          answered = true;
          selectedAnswerIdx = gameState.answeredQuestions[currentQuestion].answerIndex;

          // แสดงปุ่มที่เลือกไว้
          document.querySelectorAll('.choice-btn').forEach((btn, idx) => {
            if (idx === selectedAnswerIdx) {
              btn.classList.add('ring-4', 'ring-green-400');
            }
            btn.disabled = true;
          });

          // แสดงข้อความรอผู้เล่นอื่น
          const waitingEl = document.getElementById('waiting-answers');
          if (waitingEl) {
            waitingEl.classList.remove('hidden');
          }
        }
      } else {
        showSummary();
      }
    } else {
      // เกมจบแล้ว ให้แสดงสรุป
      console.log('Game is finished, showing summary');
      showSummary();
    }
  }

  // ฟังก์ชั่นหลักสำหรับรันเกมทีละข้อ
  function runGame() {
    // บันทึกสถานะเกมเริ่ม
    gameState.gameStarted = true;
    gameState.currentQuestion = currentQuestion;
    saveGameState();

    if (currentQuestion >= questions.length) {
      showSummary();
      return;
    }
    // เริ่มคำถามทันทีโดยไม่มี countdown
    showQuestion();
  }



  // แสดงเฉลยคำตอบ
  function showAnswer() {
    const q = questions[currentQuestion];
    const gameArea = document.getElementById('game-area');
    let answerText = [q.choice1, q.choice2, q.choice3, q.choice4][q.answer_index - 1];
    gameArea.innerHTML += `<div class="mt-4 text-green-700 font-bold text-lg">เฉลย: ${answerText}</div>`;
  }

  // สรุปคะแนนและจัดอันดับ
  function showSummary() {
    // สมมติว่ามี scoreList ใน DOM และคะแนนอัปเดตแล้ว
    // ดึงคะแนนจาก DOM
    let playerEls = document.querySelectorAll('#score-list li');
    let players = [];
    playerEls.forEach(li => {
      const name = li.textContent.match(/👤\s*(.*?)\s*\+/)[1];
      const score = parseInt(li.querySelector('span[id^="score-"]').textContent) || 0;
      players.push({ name, score, el: li });
    });
    // จัดอันดับ
    players.sort((a, b) => b.score - a.score);
    // ให้คะแนนอันดับ 1 ได้ 4 คะแนน, 2 ได้ 3, 3 ได้ 2, 4 ได้ 1, 5 ได้ 0
    players.forEach((p, idx) => {
      let rankScore = Math.max(4 - idx, 0);
      p.rankScore = rankScore;
    });
    // แสดงผล
    let html = `<div class="text-2xl font-bold mb-4 text-center text-purple-700">สรุปผลคะแนน</div><ol class="list-decimal pl-8">`;
    players.forEach((p, idx) => {
      html += `<li class="mb-2 text-lg">${idx + 1}. ${p.name} <span class="text-green-700 font-bold">${p.score} คะแนน</span> <span class="text-blue-700 font-bold">(+${p.rankScore} อันดับ)</span></li>`;
    });
    html += '</ol>';
    document.getElementById('game-area').innerHTML = html;
  }


  // ฟังก์ชั่นสุ่ม array (Fisher-Yates)
  function shuffleArray(array) {
    let arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
});



// Listen for next question
socket.on('next_question', () => {
  console.log('Next question event received');
  currentQuestion++;
  selectedAnswerIdx = null;
  answered = false;

  // บันทึกสถานะเกม
  gameState.currentQuestion = currentQuestion;
  saveGameState();

  showQuestion();
});

// ตัวแปรเก็บ timer เพื่อ clear ได้
let currentQuestionTimer = null;

// Show question with timer
function showQuestion() {
  const q = questions[currentQuestion];
  if (!q) {
    // ถ้าไม่มีคำถามแล้ว ให้แสดงสรุป
    showSummary();
    return;
  }

  // ล้าง timer เก่าก่อน (ถ้ามี)
  if (currentQuestionTimer) {
    clearInterval(currentQuestionTimer);
    currentQuestionTimer = null;
  }

  let timeLeft = 20; // 20 วินาทีต่อข้อ
  answered = false;
  selectedAnswerIdx = null; // รีเซ็ตคำตอบที่เลือก
  startTime = Date.now();
  let questionEnded = false;

  const gameArea = document.getElementById('game-area');

  // สร้างปุ่มตัวเลือกแบบสุ่มตำแหน่ง
  const choices = [q.choice1, q.choice2, q.choice3, q.choice4];
  const correctAnswer = choices[q.answer_index - 1]; // คำตอบที่ถูกต้อง
  
  // สร้าง array ของตัวเลือกพร้อม index เดิม
  const choicesWithIndex = choices.map((choice, index) => ({
    text: choice,
    originalIndex: index,
    isCorrect: index === q.answer_index - 1
  }));
  
  // สุ่มตำแหน่งตัวเลือก
  const shuffledChoices = choicesWithIndex.sort(() => Math.random() - 0.5);
  
  // สร้าง mapping ระหว่างตำแหน่งใหม่กับตำแหน่งเดิม
  const choiceMapping = {};
  shuffledChoices.forEach((choice, newIndex) => {
    choiceMapping[newIndex] = choice.originalIndex;
  });
  
  // เก็บ mapping ไว้ในตัวแปร global เพื่อใช้ตอนส่งคำตอบ
  window.currentChoiceMapping = choiceMapping;
  
  let choicesHtml = shuffledChoices.map((choice, i) => {
    let btnClass = 'choice-btn bg-purple-100 hover:bg-purple-300 text-purple-800 font-bold py-3 rounded-xl';
    if (selectedAnswerIdx !== null && selectedAnswerIdx == i) btnClass += ' ring-4 ring-green-400';
    return `<button class='${btnClass}' data-idx='${i}' ${selectedAnswerIdx !== null ? 'disabled' : ''}>${choice.text}</button>`;
  }).join('');

  gameArea.innerHTML = `
      <div class="mb-4">
        <div class="text-xl font-bold mb-2">ข้อที่ ${currentQuestion + 1}: ${q.question_text}</div>
        <div class="text-gray-500 mb-2">คำใบ้: ${q.hint || '-'} </div>
        <div class="text-lg text-red-600 font-bold mb-2">เวลาที่เหลือ: <span id='question-timer'>${timeLeft}</span> วินาที</div>
        <div id="waiting-answers" class="text-blue-600 font-semibold mb-2 hidden">รอผู้เล่นอื่นตอบ...</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${choicesHtml}
      </div>
      <div class="mt-4 text-gray-400 text-sm">* ตอบไวได้คะแนนเต็ม ตอบช้าคะแนนลดลง</div>
    `;

  // ล้าง fallback timeout ก่อนหน้าและเริ่มใหม่
  clearQuestionTimeout();
  startQuestionTimeout();

  // จับเวลา
  currentQuestionTimer = setInterval(() => {
    timeLeft--;
    const timerEl = document.getElementById('question-timer');
    if (timerEl) {
      timerEl.textContent = timeLeft;

      // เปลี่ยนสีตามเวลาที่เหลือ
      if (timeLeft <= 5) {
        timerEl.className = 'text-red-600 font-bold';
      } else if (timeLeft <= 10) {
        timerEl.className = 'text-orange-600 font-bold';
      }
    }

    if (timeLeft <= 0) {
      clearInterval(currentQuestionTimer);
      currentQuestionTimer = null;
      endQuestion();
    }
  }, 1000);

  // ฟังก์ชันจบคำถาม
  function endQuestion() {
    if (questionEnded) return;
    questionEnded = true;

    // เวลาหมด - ปิดการตอบ
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.disabled = true;
      btn.classList.add('opacity-50');
    });

    // ซ่อนตัวจับเวลา
    const timerEl = document.getElementById('question-timer');
    if (timerEl && timerEl.parentElement) {
      timerEl.parentElement.style.display = 'none';
    }

    // แสดงข้อความรอผู้เล่นอื่น
    const waitingEl = document.getElementById('waiting-answers');
    if (waitingEl) {
      waitingEl.classList.remove('hidden');
    }

    // ส่งคำตอบว่าไม่ได้ตอบ (answerIndex = -1)
    if (!answered && !isGameFinished) {
      answered = true;
      socket.emit('submit_answer', {
        roomId: window.roomId,
        userId: window.user.id,
        answerIndex: -1,
        answerTime: 20000, // 20 วินาที
        questionIndex: currentQuestion,
        currentQuestion: questions[currentQuestion]
      });
    }

    // แจ้ง backend ว่าคำถามนี้จบแล้ว
    socket.emit('question_ended', {
      roomId: window.roomId,
      questionIndex: currentQuestion,
      currentQuestion: questions[currentQuestion]
    });

    // รอ 1 วินาทีแล้วจบคำถาม (fallback)
    setTimeout(() => {
      if (!questionEnded) {
        socket.emit('question_ended', {
          roomId: window.roomId,
          questionIndex: currentQuestion,
          currentQuestion: questions[currentQuestion]
        });
      }
    }, 1000);
  }

  // Event handlers สำหรับปุ่มตัวเลือก
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.onclick = () => {
      // ป้องกันการเรียกซ้ำ
      if (answered || selectedAnswerIdx !== null || questionEnded) {
        console.log('Answer already submitted or question ended, ignoring click');
        return;
      }
      
      // ตรวจสอบว่าเกมจบแล้วหรือไม่
      if (isGameFinished) {
        console.log('เกมจบแล้ว - ไม่สามารถส่งคำตอบได้');
        return;
      }

      // ตั้งค่าสถานะทันทีเพื่อป้องกันการเรียกซ้ำ
      answered = true;
      selectedAnswerIdx = parseInt(btn.getAttribute('data-idx'));
      
      console.log('User selected answer:', {
        selectedAnswerIdx: selectedAnswerIdx,
        buttonText: btn.textContent,
        currentQuestion: currentQuestion
      });

      clearInterval(currentQuestionTimer); // หยุดจับเวลา
      currentQuestionTimer = null;

      const answerTime = Date.now() - startTime;

      // แปลง index ใหม่เป็น index เดิมโดยใช้ mapping
      const originalAnswerIndex = window.currentChoiceMapping ? window.currentChoiceMapping[selectedAnswerIdx] : selectedAnswerIdx;

      console.log('Answer mapping:', {
        selectedAnswerIdx: selectedAnswerIdx,
        originalAnswerIndex: originalAnswerIndex,
        choiceMapping: window.currentChoiceMapping
      });

      // บันทึกคำตอบในสถานะเกม
      gameState.answeredQuestions[currentQuestion] = {
        answerIndex: originalAnswerIndex,
        selectedAnswerIdx: selectedAnswerIdx, // เก็บตำแหน่งที่สุ่มไว้
        answerTime: answerTime,
        isCorrect: false, // จะถูกอัปเดตจาก backend
        scoreGained: 0 // จะถูกอัปเดตจาก backend
      };

      socket.emit('submit_answer', {
        roomId: window.roomId,
        userId: window.user.id,
        answerIndex: originalAnswerIndex,
        answerTime,
        questionIndex: currentQuestion,
        currentQuestion: questions[currentQuestion]
      });

      // แสดงปุ่มที่เลือกค้างไว้
      document.querySelectorAll('.choice-btn').forEach((b, idx) => {
        if (idx === selectedAnswerIdx) {
          b.classList.add('ring-4', 'ring-green-400');
        }
        b.disabled = true;
      });

      // แสดงข้อความรอผู้เล่นอื่น
      const waitingEl = document.getElementById('waiting-answers');
      if (waitingEl) {
        waitingEl.classList.remove('hidden');
      }

      // ซ่อนตัวจับเวลา
      const timerEl = document.getElementById('question-timer');
      if (timerEl && timerEl.parentElement) {
        timerEl.parentElement.style.display = 'none';
      }

      // แจ้ง backend ว่าตอบแล้ว (เพื่อให้ระบบรู้ว่าควรจบคำถามหรือยัง)
      socket.emit('answer_submitted', { roomId, questionIndex: currentQuestion });
    };
  });
}

// รับ event เมื่อคำถามจบแล้ว (จาก backend)
socket.on('question_ended', (data) => {
  if (data.questionIndex === currentQuestion) {
    // ล้าง fallback timeout
    clearQuestionTimeout();

    // อัปเดตสถานะเกมจาก backend
    gameState.currentQuestion = data.questionIndex + 1;

    // แสดงเฉลยหลังจาก 2 วินาที
    setTimeout(() => {
      showAnswer();
      // ไปข้อถัดไปหลังจาก 3 วินาที
      setTimeout(() => {
        currentQuestion = gameState.currentQuestion;
        selectedAnswerIdx = null; // รีเซ็ตคำตอบที่เลือก
        answered = false; // รีเซ็ตสถานะการตอบ

        // บันทึกสถานะเกม
        saveGameState();

        if (currentQuestion < questions.length) {
          showQuestion();
        } else {
          showSummary();
        }
      }, 3000);
    }, 2000);
  }
});

// Fallback: ถ้าไม่ได้รับ event question_ended ภายใน 25 วินาที ให้ไปข้อถัดไป
let questionTimeout;
function startQuestionTimeout() {
  if (questionTimeout) clearTimeout(questionTimeout);
  questionTimeout = setTimeout(() => {
    console.log('Question timeout - moving to next question');
    showAnswer();
    setTimeout(() => {
      currentQuestion++;
      selectedAnswerIdx = null; // รีเซ็ตคำตอบที่เลือก
      answered = false; // รีเซ็ตสถานะการตอบ

      // บันทึกสถานะเกม
      gameState.currentQuestion = currentQuestion;
      saveGameState();

      if (currentQuestion < questions.length) {
        showQuestion();
      } else {
        showSummary();
      }
    }, 3000);
  }, 25000); // 25 วินาที (มากกว่าเวลา 20 วินาที)
}

function clearQuestionTimeout() {
  if (questionTimeout) {
    clearTimeout(questionTimeout);
    questionTimeout = null;
  }
  // Clear timer หลักด้วย
  if (currentQuestionTimer) {
    clearInterval(currentQuestionTimer);
    currentQuestionTimer = null;
  }
}

// Listen for user answered (update score)
// --- ให้ทุก client แสดงปุ่มที่เลือกของตัวเองตรงกัน ---
socket.on('user_answered', data => {
  // อัปเดตคะแนน
  if (data.userId && data.score !== undefined) {
    const scoreEl = document.getElementById('score-' + data.userId);
    if (scoreEl) {
      scoreEl.textContent = data.score;
    }

    // อัปเดตคะแนนใน player list ด้วย
    const playerScoreEl = document.querySelector(`#player-li-${data.userId} .text-green-600`);
    if (playerScoreEl) {
      playerScoreEl.textContent = `+${data.score}`;
    }

    // ถ้าเป็นผู้เล่นเอง ให้อัปเดตคะแนนในส่วน "แต้มของคุณ" ด้วย
    if (data.userId === window.user.id) {
      updateMyScore(data.score);
    }
  }

  // ถ้าเป็น user นี้ ให้แสดงปุ่มที่เลือกไว้ (active) ค้างไว้
  if (data.userId === window.user.id && typeof data.answerIndex !== 'undefined') {
    // อย่าเปลี่ยน selectedAnswerIdx เพราะ data.answerIndex เป็น originalAnswerIndex
    // ใช้ selectedAnswerIdx ที่มีอยู่แล้วจากสถานะเกม
    
    console.log('User answered event received:', {
      originalAnswerIndex: data.answerIndex,
      currentSelectedAnswerIdx: selectedAnswerIdx,
      questionIndex: data.questionIndex
    });

    // อัปเดตสถานะเกมด้วยข้อมูลจาก backend
    if (gameState.answeredQuestions[data.questionIndex]) {
      gameState.answeredQuestions[data.questionIndex].isCorrect = data.isCorrect;
      gameState.answeredQuestions[data.questionIndex].scoreGained = data.scoreGained;
    }

    // อัปเดตปุ่มให้ active (ใช้ selectedAnswerIdx ที่มีอยู่แล้ว)
    document.querySelectorAll('.choice-btn').forEach((b, idx) => {
      if (idx === selectedAnswerIdx) {
        b.classList.add('ring-4', 'ring-green-400');
      }
      b.disabled = true;
    });

    // แสดง animation คะแนนที่ได้
    if (data.isCorrect && data.scoreGained > 0) {
      showScoreGainAnimation(data.scoreGained);
    }
  }
});

// Socket event handlers สำหรับเกมคำถาม
socket.on('answer-question', ({ roomId, answer }) => {
  // จัดการคำตอบจาก client อื่น ๆ
  console.log('Answer received:', { roomId, answer });
});


// แสดงเฉลยคำตอบ (ปรับปรุงจากไฟล์เดิม)
function showAnswer() {
  const q = questions[currentQuestion];
  if (!q) return;

  const gameArea = document.getElementById('game-area');
  const correctAnswer = [q.choice1, q.choice2, q.choice3, q.choice4][q.answer_index - 1];
  
  // หาตำแหน่งที่ถูกต้องในหน้าจอปัจจุบัน (หลังจากสุ่มแล้ว)
  let displayedCorrectIndex = 0;
  if (window.currentChoiceMapping) {
    for (let newIndex in window.currentChoiceMapping) {
      if (window.currentChoiceMapping[newIndex] === q.answer_index - 1) {
        displayedCorrectIndex = parseInt(newIndex);
        break;
      }
    }
  }

  // ดึงข้อมูลคำตอบที่เลือกจากสถานะเกม
  const answeredQuestion = gameState.answeredQuestions[currentQuestion];
  const userSelectedAnswerIdx = answeredQuestion ? answeredQuestion.selectedAnswerIdx : selectedAnswerIdx;

  // สร้างตัวเลือกในตำแหน่งที่สุ่มเหมือนตอนแสดงคำถาม
  const choices = [q.choice1, q.choice2, q.choice3, q.choice4];
  const choicesWithIndex = choices.map((choice, index) => ({
    text: choice,
    originalIndex: index,
    isCorrect: index === q.answer_index - 1
  }));
  
  // ใช้ mapping เดียวกับตอนแสดงคำถาม
  let shuffledChoices = choicesWithIndex;
  if (window.currentChoiceMapping) {
    // สร้าง array ใหม่ตาม mapping
    shuffledChoices = new Array(4);
    for (let newIndex in window.currentChoiceMapping) {
      const originalIndex = window.currentChoiceMapping[newIndex];
      shuffledChoices[parseInt(newIndex)] = choicesWithIndex[originalIndex];
    }
  }

  // ตรวจสอบว่าผู้เล่นตอบถูกหรือไม่
  const isCorrect = userSelectedAnswerIdx === displayedCorrectIndex;

  // แสดงเฉลยและผลลัพธ์
  gameArea.innerHTML += `
    <div class="mt-4 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
      <div class="text-center mb-4">
        <div class="text-green-800 font-bold text-2xl mb-2">🎯 เฉลย</div>
        <div class="text-green-700 text-xl font-semibold">${correctAnswer}</div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        ${shuffledChoices.map((choice, idx) => {
    let choiceClass = 'p-3 rounded-lg border-2 font-semibold';
    if (idx === displayedCorrectIndex) {
      choiceClass += ' bg-green-200 border-green-500 text-green-800';
    } else if (idx === userSelectedAnswerIdx && idx !== displayedCorrectIndex) {
      choiceClass += ' bg-red-200 border-red-500 text-red-800';
    } else {
      choiceClass += ' bg-gray-100 border-gray-300 text-gray-600';
    }

    let icon = '';
    if (idx === displayedCorrectIndex) {
      icon = '✅';
    } else if (idx === userSelectedAnswerIdx && idx !== displayedCorrectIndex) {
      icon = '❌';
    }

    return `
            <div class="${choiceClass}">
              ${icon} ${choice.text}
            </div>
          `;
  }).join('')}
      </div>
      
      <div class="mt-4 text-center">
        <div class="text-gray-600 text-sm">
          ${isCorrect ?
      '🎉 ยินดีด้วย! คุณตอบถูก!' :
      userSelectedAnswerIdx !== null ?
        '😔 ไม่เป็นไร ลองข้อถัดไปดู!' :
        '⏰ เวลาหมดแล้ว!'
    }
        </div>
      </div>
    </div>
  `;
}

// สรุปคะแนนและจัดอันดับ (ปรับปรุงจากไฟล์เดิม)
function showSummary() {
  const gameArea = document.getElementById('game-area');
  
  // บันทึกสถานะเกมจบ
  gameState.gameFinished = true;
  gameState.currentQuestion = questions ? questions.length : 14; // ตั้งค่าเป็นจำนวนคำถามทั้งหมด
  saveGameState();
  
  // รีเซ็ตเฉพาะคำถามและสถานะเกม (ไม่รีเซ็ตคะแนน วัตถุดิบ และอาหาร)
  setTimeout(() => {
    // รีเซ็ตสถานะเกม
    gameState = {
      currentQuestion: 0,
      answeredQuestions: [],
      gameStarted: false,
      gameFinished: false
    };
    
    // รีเซ็ตตัวแปรเกม
    currentQuestion = 0;
    answered = false;
    selectedAnswerIdx = null;
    questions = [];
    
    // ไม่รีเซ็ตคะแนน วัตถุดิบ และอาหาร (เก็บไว้ทุกอย่าง)
    console.log('Keeping player score, ingredients, and cooked meals unchanged');
    
    // ไม่อัปเดต UI (เก็บวัตถุดิบและอาหารไว้)
    // updateMyIngredients([]);
    // updatePlayerIngredientsInList(user.id, []);
    
    // แสดงปุ่มเริ่มเกมสำหรับเจ้าของห้อง
    if (isOwner) {
      const startBtn = document.getElementById('start-btn');
      if (startBtn) {
        startBtn.classList.remove('hidden');
      }
      const resetBtn = document.getElementById('reset-game-btn');
      if (resetBtn) {
        resetBtn.classList.add('hidden');
      }
    }
    
    // เรียกใช้ฟังก์ชันรีเซ็ตอัตโนมัติใน backend
    socket.emit('auto_reset_game', roomId);    
  }, 1000);

  // ดึงคะแนนจาก DOM
  let playerEls = document.querySelectorAll('#score-list li');
  let players = [];

  playerEls.forEach(li => {
    const nameMatch = li.textContent.match(/👤\s*(.*?)\s*\+/);
    const scoreMatch = li.querySelector('span[id^="score-"]');

    if (nameMatch && scoreMatch) {
      const name = nameMatch[1];
      const score = parseInt(scoreMatch.textContent) || 0;
      players.push({ name, score });
    }
  });

  // จัดอันดับ
  players.sort((a, b) => b.score - a.score);

  // คำนวณสถิติเกม
  const totalQuestions = questions ? questions.length : 14;
  const totalPlayers = players.length;
  const highestScore = players.length > 0 ? players[0].score : 0;
  const averageScore = players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.score, 0) / players.length) : 0;

  let html = `
    <div class="text-center">
      <div class="text-4xl font-bold mb-8 text-purple-700">🏆 สรุปผลการเล่น 🏆</div>
      
      <!-- สถิติเกม -->
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 shadow-xl border-2 border-green-200 mb-6">
        <div class="text-2xl font-bold text-green-800 mb-4">📊 สถิติการเล่น</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl p-4 shadow-md">
            <div class="text-3xl font-bold text-blue-600">${totalQuestions}</div>
            <div class="text-gray-600 text-sm">คำถามทั้งหมด</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-md">
            <div class="text-3xl font-bold text-purple-600">${totalPlayers}</div>
            <div class="text-gray-600 text-sm">ผู้เล่น</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-md">
            <div class="text-3xl font-bold text-green-600">${highestScore}</div>
            <div class="text-gray-600 text-sm">คะแนนสูงสุด</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-md">
            <div class="text-3xl font-bold text-orange-600">${averageScore}</div>
            <div class="text-gray-600 text-sm">คะแนนเฉลี่ย</div>
          </div>
        </div>
      </div>

      <!-- อันดับคะแนน -->
      <div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl p-8 shadow-xl border-2 border-purple-200">
        <div class="text-2xl font-bold text-purple-800 mb-6">🏅 อันดับคะแนน</div>
        <div class="grid gap-4">
  `;

  players.forEach((p, idx) => {
    const rank = idx + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
    const bgClass = rank === 1 ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300' :
      rank === 2 ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300' :
        rank === 3 ? 'bg-gradient-to-r from-orange-100 to-orange-200 border-orange-300' :
          'bg-white border-gray-200';

    html += `
      <div class="${bgClass} rounded-xl p-4 border-2 shadow-md">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${medal}</span>
            <span class="text-xl font-bold text-gray-800">${p.name}</span>
          </div>
          <div class="text-right">
            <div class="text-green-700 font-bold text-2xl">${p.score}</div>
            <div class="text-gray-500 text-sm">คะแนน</div>
          </div>
        </div>
      </div>
    `;
  });

  html += `
        </div>
      </div>

      <!-- ข้อความยินดี -->
      <div class="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-3xl p-6 shadow-xl border-2 border-yellow-200 mt-6">
        <div class="text-2xl font-bold text-yellow-800 mb-2">🎉 ขอบคุณที่เล่น!</div>
        <div class="text-gray-700">
          ${players.length > 1 ? 
            `ยินดีด้วยกับ <span class="font-bold text-yellow-700">${players[0].name}</span> ที่ได้คะแนนสูงสุด!` : 
            'ขอบคุณที่เล่นเกมนี้!'
          }
        </div>
        <div class="text-sm text-gray-600 mt-2">
          เกมจะรีเซ็ตเฉพาะคำถาม คะแนนและวัตถุดิบของคุณยังคงอยู่
        </div>
      </div>

      <!-- ปุ่มควบคุม -->
      <div class="mt-8 space-x-4">
        <button onclick="window.location.reload()" class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all duration-200">
          🎮 เล่นต่อ
        </button>
        <button onclick="window.location.href='/dashboard'" class="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all duration-200">
          🏠 กลับหน้าหลัก
        </button>
      </div>
    </div>
  `;

  gameArea.innerHTML = html;
}

// Initialize scores when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM loaded, initial game state:', gameState);
  console.log('Questions loaded:', questions ? questions.length : 0);

  // โหลดอาหารที่สุ่มได้ทันทีเมื่อเข้าห้อง
  loadMyFoods();

  // โหลดรายชื่อผู้เล่นทันทีเมื่อเข้าห้อง
  loadPlayerList();

  // อัปเดต currentQuestion จากสถานะเกมเริ่มต้น
  if (gameState && gameState.currentQuestion !== undefined) {
    currentQuestion = gameState.currentQuestion;
    console.log('Updated currentQuestion from initial state:', currentQuestion);
  }

  // ถ้าเกมเริ่มแล้ว ให้ตรวจสอบว่าเกมจบจริงหรือไม่
  if (gameState && gameState.gameStarted) {
    // ตรวจสอบว่าเกมจบจริงหรือไม่ (14 คำถาม)
    const isGameReallyFinished = gameState.currentQuestion >= 14;
    if (!isGameReallyFinished) {
      console.log('Game is in progress from initial state, current question:', currentQuestion);

      // รอให้คำถามโหลดเสร็จก่อนแสดง
      if (questions && questions.length > 0) {
        console.log('Questions are loaded, showing current question');

        // ถ้ายังไม่จบเกม
        if (currentQuestion < questions.length) {
          // ซ่อน waiting area
          const waitingArea = document.getElementById('waiting-area');
          if (waitingArea) {
            waitingArea.classList.add('hidden');
          }

          // ซ่อนปุ่มเริ่มเกม (ถ้าไม่ใช่เจ้าของห้อง)
          if (!isOwner) {
            const startBtn = document.getElementById('start-btn');
            if (startBtn) {
              startBtn.classList.add('hidden');
            }
          }

          // แสดงคำถามปัจจุบัน
          showQuestion();

          // ตรวจสอบว่าตอบคำถามนี้แล้วหรือยัง
          if (gameState.answeredQuestions && gameState.answeredQuestions[currentQuestion]) {
            answered = true;
            selectedAnswerIdx = gameState.answeredQuestions[currentQuestion].answerIndex;

            // แสดงปุ่มที่เลือกไว้
            document.querySelectorAll('.choice-btn').forEach((btn, idx) => {
              if (idx === selectedAnswerIdx) {
                btn.classList.add('ring-4', 'ring-green-400');
              }
              btn.disabled = true;
            });

            // แสดงข้อความรอผู้เล่นอื่น
            const waitingEl = document.getElementById('waiting-answers');
            if (waitingEl) {
              waitingEl.classList.remove('hidden');
            }
          }
        } else {
          // ถ้าเกมจบแล้ว ให้แสดงสรุป
          showSummary();
        }
      } 
    } 
  }

  // อัปเดตคะแนนเริ่มต้นใน UI ในทุกที่ที่แสดง
  updateMyScore(currentPlayerScore);

  // อัปเดตวัตถุดิบเริ่มต้น
  updateMyIngredients(myIngredients);

  // อัปเดตวัตถุดิบใน player list
  updatePlayerIngredientsInList(window.user.id, myIngredients);
  
  // อัปเดตคะแนนใน my-points element ทันที (แก้ปัญหาแสดง 0)
  const myPointsEl = document.getElementById('my-points');
  if (myPointsEl && currentPlayerScore !== undefined && currentPlayerScore !== null) {
    myPointsEl.textContent = currentPlayerScore;
  }

  console.log('Initial player score:', currentPlayerScore);
  console.log('Initial myPoints:', myPoints);
  console.log('Initial myIngredients:', myIngredients);
  console.log('Initial game state:', gameState);

  // บันทึกสถานะเกมเป็นระยะทุก 30 วินาที (ถ้าเกมกำลังดำเนินอยู่)
  setInterval(() => {
    if (gameState.gameStarted) {
      const isGameReallyFinished = gameState.currentQuestion >= 14;
      if (!isGameReallyFinished) {
        saveGameState();
      }
    }
  }, 30000);
});



document.addEventListener('DOMContentLoaded', () => {
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  
  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', () => {
      // ตรวจสอบว่ามีข้อมูลที่จำเป็นครบหรือไม่
      if (!window.roomId || !window.user || !window.user.id) {
        console.error('Missing required data for leave_room:', { 
          roomId: window.roomId, 
          userId: window.user?.id 
        });
        // แม้ไม่มีข้อมูลก็ให้เปลี่ยนหน้าได้
        window.location.href = '/quiz';
        return;
      }

      Swal.fire({
        title: 'ยืนยันการออกจากห้อง?',
        text: 'คุณต้องการออกจากห้องนี้และกลับไปยังหน้าหลักหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ออกจากห้อง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280'
      }).then((result) => {
        if (result.isConfirmed) {
          // แจ้ง server ว่าออกจากห้อง
          socket.emit('leave_room', {
            roomId: window.roomId,
            userId: window.user.id
          });
          
          // รอสักครู่ให้ server ประมวลผลก่อนเปลี่ยนหน้า
          setTimeout(() => {
            // เปลี่ยนหน้าไปยังหน้าหลัก
            window.location.href = '/quiz';
          }, 500);
        }
      });
    });
  }

  // จัดการเมื่อผู้เล่นปิดแท็บหรือรีเฟรชหน้า
  window.addEventListener('beforeunload', () => {
    // ตรวจสอบว่ามีข้อมูลที่จำเป็นครบหรือไม่
    if (window.roomId && window.user && window.user.id) {
      // แจ้ง server ว่าออกจากห้อง
      socket.emit('leave_room', {
        roomId: window.roomId,
        userId: window.user.id
      });
      
      // ใช้ sendBeacon เป็น backup เพื่อให้แน่ใจว่า event จะถูกส่ง
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          roomId: window.roomId,
          userId: window.user.id,
          action: 'leave_room'
        });
        
        // Create a Blob with proper content type
        const blob = new Blob([data], { type: 'application/json' });
        const success = navigator.sendBeacon('/api/player-leave', blob);
        
        if (!success) {
          // Fallback to fetch if sendBeacon fails
          fetch('/api/player-leave', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: data
          }).catch(err => console.error('Fallback fetch failed:', err));
        }
      } else {
        // Fallback for browsers that don't support sendBeacon
        const data = JSON.stringify({
          roomId: window.roomId,
          userId: window.user.id,
          action: 'leave_room'
        });
        
        fetch('/api/player-leave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data
        }).catch(err => console.error('Fetch fallback failed:', err));
      }
    } else {
      console.warn('Missing required data for leave_room:', { 
        roomId: window.roomId, 
        userId: window.user?.id 
      });
    }
  });

  // จัดการเมื่อผู้เล่นเปลี่ยนแท็บหรือหน้าต่าง
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // ผู้เล่นเปลี่ยนแท็บหรือหน้าต่าง - อาจจะออกจากห้อง
      console.log('User switched tab or window');
    } else if (document.visibilityState === 'visible') {
      // ผู้เล่นกลับมาที่แท็บ - ตรวจสอบว่ายังอยู่ในห้องหรือไม่
      console.log('User returned to tab');
      // โหลดรายชื่อผู้เล่นใหม่เพื่อให้แน่ใจว่าข้อมูลถูกต้อง
      loadPlayerList();
    }
  });
});

// ฟังก์ชันปิดการควบคุมเกมเมื่อเกมจบแล้ว
function disableGameControls() {
  // รีเซ็ตตัวแปรเกม
  currentQuestion = 0;
  answeredQuestions = [];
  gameStarted = false;
  gameFinished = true;
  
  // ซ่อนคำถามและตัวเลือก
  const questionContainer = document.getElementById('question-container');
  const choicesContainer = document.getElementById('choices-container');
  const questionText = document.getElementById('question-text');
  const hintText = document.getElementById('hint-text');
  
  if (questionContainer) questionContainer.style.display = 'none';
  if (choicesContainer) choicesContainer.style.display = 'none';
  if (questionText) questionText.style.display = 'none';
  if (hintText) hintText.style.display = 'none';
  
  // ปิดปุ่มทำอาหาร
  document.querySelectorAll('.cook-meal-btn').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.classList.remove('hover:bg-green-600');
  });
  
  // ปิดปุ่มซื้อวัตถุดิบ
  document.querySelectorAll('.ingredient-btn').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.classList.remove('hover:bg-yellow-200');
  });
  
  // ปิดปุ่มเริ่มเกม (ถ้าเป็นเจ้าของห้อง)
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
  
  // ปิดปุ่มข้อถัดไป (ถ้าเป็นเจ้าของห้อง)
  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
  
  // ปิดปุ่มรีเซ็ตเกม (ถ้าเป็นเจ้าของห้อง)
  const resetBtn = document.getElementById('reset-game-btn');
  if (resetBtn) {
    resetBtn.disabled = true;
    resetBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
  
      // แสดงข้อความว่าเกมจบแล้ว (เฉพาะในส่วน game-area เมื่อไม่ได้โหลดหน้าใหม่)
    const gameArea = document.getElementById('game-area');
    if (gameArea && !isGameFinished) {
      // เปลี่ยนเฉพาะข้อความในส่วน waiting-area
      const waitingArea = document.getElementById('waiting-area');
      if (waitingArea) {
        waitingArea.innerHTML = `
          <div class="text-center">
            <div class="bg-gradient-to-br from-green-400 to-green-600 rounded-2xl p-6 shadow-lg border-2 border-green-300">
              <div class="mb-4">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-3">
                <i class="fa-solid fa-crown text-2xl text-green-600"></i>
                </div>
              </div>
              <h3 class="text-2xl font-bold text-white mb-2">🎊 เกมจบแล้ว! 🎊</h3>
              <p class="text-green-100 font-medium">มีผู้เล่นทำอาหารครบทุกอย่างแล้ว</p>
              <div class="mt-4 text-green-200 text-sm">
                <i class="fa-solid fa-info-circle mr-1"></i>
                ไม่สามารถเล่นเกมต่อได้ - คำถามถูกรีเซ็ตแล้ว
              </div>
            </div>
          </div>
        `;
      }
    }
}


