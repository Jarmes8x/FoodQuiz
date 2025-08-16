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
  showNotification('ห้องนี้เต็ม', 'info');
  window.location.href = '/quiz';
});

// เมื่อห้องกำลังเล่นอยู่ (process)
socket.on('room_in_process', function (data) {
  showNotification('ไม่สามารถเข้าห้องได้ ขณะนี้เกมกำลังดำเนินการอยู่', 'warning');
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

