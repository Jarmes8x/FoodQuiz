const socket = io();
let currentQuestion = 0;
let answered = false;
let startTime = null;

// ตัวแปรสำหรับเก็บสถานะเกม - รวมจากไฟล์แรก
let currentPlayerScore = 0;
let playerIngredients = [];

// สำหรับวัตถุดิบและอาหาร
let myPoints = 0;
let myIngredients = [];
let myFood = '';

// --- Room deleted event ---
socket.on('room_deleted', function (data) {
  showNotification('ห้องนี้ถูกลบแล้ว', 'info');
  setTimeout(() => {
    window.location.href = '/';
  }, 2000);
});

// เมื่อห้องเต็ม
socket.on('room_full', function (data) {
  showNotification('ห้องเต็มแล้ว', 'info');
  setTimeout(() => {
    window.location.href = '/';
  }, 2000);
});

// จัดการ error จากเกม
socket.on('game_error', function (data) {
  showNotification(data.message || 'เกิดข้อผิดพลาดในเกม', 'error');
});

// ฟังก์ชันแสดงการแจ้งเตือน
function showNotification(message, type = 'info') {
  // สร้าง notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 ${
    type === 'info' ? 'bg-blue-500' : 
    type === 'success' ? 'bg-green-500' : 
    type === 'error' ? 'bg-red-500' : 'bg-gray-500'
  }`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // ลบ notification หลังจาก 3 วินาที
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ===============================
// เพิ่มส่วนการซื้อวัตถุดิบจากไฟล์แรก
// ===============================

// ฟังก์ชันซื้อวัตถุดิบ - จากไฟล์แรก
function buyIngredient(ingredientName) {
  // ค้นหาราคาจาก DOM
  const ingredientBtn = document.querySelector(`[data-ingredient="${ingredientName}"]`);
  if (!ingredientBtn) return;
  
  const buttonText = ingredientBtn.textContent;
  const priceMatch = buttonText.match(/\((\d+) แต้ม\)/);
  const price = priceMatch ? parseInt(priceMatch[1]) : 0;
  
  // ตรวจสอบคะแนนก่อนซื้อ
  if (currentPlayerScore < price) {
    alert(`คะแนนไม่พอ! ต้องการ ${price} คะแนน คุณมี ${currentPlayerScore} คะแนน`);
    return;
  }
  
  // ยืนยันการซื้อ
  if (confirm(`คุณต้องการซื้อ ${ingredientName} ราคา ${price} คะแนน หรือไม่?`)) {
    socket.emit('buy-ingredient', {
      roomId: window.roomId || roomId,
      ingredientName: ingredientName
    });
  }
}

// ฟังก์ชันทำอาหาร - จากไฟล์แรก
function cookMeal(mealName, requiredIngredientsStr) {
  const requiredIngredients = requiredIngredientsStr.split(',').map(ing => ing.trim());
  
  // ตรวจสอบว่ามีวัตถุดิบครบหรือไม่
  const missingIngredients = requiredIngredients.filter(ing => !playerIngredients.includes(ing));
  
  if (missingIngredients.length > 0) {
    alert(`คุณยังขาดวัตถุดิบ: ${missingIngredients.join(', ')}`);
    return;
  }
  
  // ทำอาหารสำเร็จ
  alert(`ทำ ${mealName} สำเร็จ! 🍽️`);
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



// รับผลการซื้อวัตถุดิบ - จากไฟล์แรก
socket.on('ingredient-purchased', ({ ingredientName, price, newScore, ingredients, imageFile }) => {
  console.log(`ซื้อสำเร็จ: ${ingredientName} ราคา ${price} คะแนน`);
  
  // อัปเดตคะแนนและวัตถุดิบของตัวเอง
  updateMyScore(newScore);
  updateMyIngredients(ingredients);

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

// รับการ reset เกม - จากไฟล์แรก
socket.on('game-reset', ({ message }) => {
  alert(message);
  updateMyScore(0);
  updateMyIngredients([]);
});

// ===============================
// UI Update Functions จากไฟล์แรก
// ===============================

function updateMyScore(newScore) {
  currentPlayerScore = newScore;
  myPoints = newScore; // ซิงค์ค่า
  
  const myPointsEl = document.getElementById('my-points');
  if (myPointsEl) {
    myPointsEl.textContent = newScore;
  }
}

function updateMyIngredients(ingredients) {
  playerIngredients = ingredients;
  myIngredients = ingredients; // ซิงค์ค่า
  
  const myIngredientsEl = document.getElementById('my-ingredients');
  if (myIngredientsEl) {
    myIngredientsEl.textContent = ingredients.length > 0 ? ingredients.join(', ') : 'ยังไม่มี';
  }
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
  const el = document.createElement('div');
  el.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 text-3xl font-bold text-green-600 animate-bounce z-50';
  el.textContent = `+${scoreGained} คะแนน!`;
  document.body.appendChild(el);
  
  setTimeout(() => el.remove(), 2000);
}

function showScoreLossAnimation(scoreUsed) {
  const el = document.createElement('div');
  el.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 text-2xl font-bold text-red-600 animate-pulse z-50';
  el.textContent = `-${scoreUsed} คะแนน`;
  document.body.appendChild(el);
  
  setTimeout(() => el.remove(), 2000);
}

function showPurchaseSuccessMessage(ingredientName, price) {
  const el = document.createElement('div');
  el.className = 'fixed top-32 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  el.innerHTML = `<i class="fa-solid fa-check mr-2"></i>ซื้อ ${ingredientName} สำเร็จ! (-${price} คะแนน)`;
  document.body.appendChild(el);
  
  setTimeout(() => el.remove(), 3000);
}

function showCookingSuccessAnimation(mealName) {
  const el = document.createElement('div');
  el.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-white px-8 py-4 rounded-xl shadow-lg z-50 text-xl font-bold';
  el.innerHTML = `<i class="fa-solid fa-utensils mr-2"></i>ทำ ${mealName} สำเร็จ!`;
  document.body.appendChild(el);
  
  setTimeout(() => el.remove(), 3000);
}

// --- ส่วนฟีเจอร์ซื้อวัตถุดิบและสุ่มอาหาร ---
function updateMyShopUI() {
  document.getElementById('my-points').textContent = myPoints;
  document.getElementById('my-ingredients').textContent = myIngredients.join(', ') || '-';
  document.getElementById('my-food').textContent = myFood;
}

socket.on('update_points_ingredients', data => {
  if (data.userId === user.id) {
    myPoints = data.points;
    myIngredients = data.ingredients || [];
    currentPlayerScore = data.points; // ซิงค์ค่า
    playerIngredients = data.ingredients || []; // ซิงค์ค่า
    
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
  const modal = document.getElementById('food-modal');
  const content = document.getElementById('food-modal-content');
  if (modal && content) {
    content.textContent = food;
    modal.classList.remove('hidden');
  }
}

// ===============================
// Event Listeners รวม
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // จัดการปุ่มลบห้อง (เฉพาะเจ้าของห้อง)
  const deleteRoomBtn = document.getElementById('delete-room-btn');
  if (deleteRoomBtn && isOwner) {
    deleteRoomBtn.onclick = function() {
      if (confirm('คุณต้องการลบห้องนี้ใช่หรือไม่?')) {
        socket.emit('delete_room', roomId, user.id);
      }
    };
  }



  // Event Listeners สำหรับปุ่มต่างๆ - รวมจากไฟล์แรก
  document.addEventListener('click', function(e) {
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
      socket.emit('random_food', { roomId, userId: user.id });
    }
    
    // ปุ่มตอบคำถาม (ถ้ามี)
    if (e.target.classList.contains('answer-btn')) {
      const answer = e.target.dataset.answer;
      sendAnswer(answer);
    }
  });

  // ปิดโมดอลอาหาร
  const closeFoodModalBtn = document.getElementById('close-food-modal');
  if (closeFoodModalBtn) {
    closeFoodModalBtn.onclick = function () {
      document.getElementById('food-modal').classList.add('hidden');
    };
  }

  // ดึงรายการวัตถุดิบ - จากไฟล์แรก
  if (window.roomId || roomId) {
    socket.emit('get-ingredients', { roomId: window.roomId || roomId });
  }
  
  updateMyShopUI();
});

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
    alert('คุณยังไม่มีวัตถุดิบ กรุณาซื้อวัตถุดิบก่อน');
    return;
  }
  
  // ใช้ socket.emit แทนการสุ่มใน client
  socket.emit('random_food', { roomId: window.roomId || roomId, userId: user.id });
}

// รับ event อาหารที่สุ่มได้เมื่อเข้าห้อง
socket.on('foods_assigned', data => {
  if (data.userId === user.id) {
    console.log('Received assigned foods:', data.foods);
    updateAssignedFoodsUI(data.foods);
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
      socket.emit('buy_ingredient', { roomId, userId: user.id, ingredient: ing });
    };
  });
  document.getElementById('random-food-btn').onclick = () => {
    socket.emit('random_food', { roomId, userId: user.id });
  };
  updateMyShopUI();
}

// เรียกใช้ enableIngredientShop เมื่อเกมเริ่มเท่านั้น
// --- Game Start: Show ingredient modal, then randomize food, then show food modal ---
let gameStartHandled = false;

// Join room
console.log('Joining room:', { roomId, user });
socket.emit('join_room', roomId, user);

// อัปเดตรายชื่อผู้เล่นเมื่อเข้าห้องครั้งแรกและแบบ realtime
socket.on('player_list_updated', data => {
  console.log('Received player_list_updated:', data);
  if (data && data.roomId == roomId && data.players) {
    console.log('Updating player list with scores:', data.players);
    updatePlayerList(data.players);
  } else {
    console.log('Invalid player_list_updated data:', data);
  }
});



// ฟังก์ชันอัปเดตรายชื่อผู้เล่น
function updatePlayerList(players) {
  console.log('updatePlayerList called with:', players);
  if (!Array.isArray(players)) {
    console.error('Players is not an array:', players);
    return;
  }

  const list = document.getElementById('player-list');
  const scoreList = document.getElementById('score-list');

  if (!list || !scoreList) {
    console.error('Required DOM elements not found');
    return;
  }

  list.innerHTML = '';
  scoreList.innerHTML = '';

  players.forEach(player => {
    if (player && player.id && player.name !== undefined) {
      const score = player.score || 0;
      list.innerHTML += `<li class="mb-1 ${player.is_owner ? 'font-bold text-purple-700' : ''}" id="player-li-${player.id}"><i class="fa-solid fa-user"></i> <span class="player-name">${player.name}</span> <span class="text-xs text-gray-400">${player.is_owner ? '(เจ้าของห้อง)' : ''}</span> <span class="ml-2 text-green-600 font-bold">${score}</span></li>`;
      scoreList.innerHTML += `<li class="mb-1 ${player.is_owner ? 'font-bold text-purple-700' : ''}"><i class="fa-solid fa-user"></i> ${player.name} <span class="ml-2 text-green-600 font-bold"><span id="score-${player.id}">${score}</span></span></li>`;
    } else {
      console.warn('Invalid player data:', player);
    }
  });

  const playerCountElement = document.getElementById('player-count');
  if (playerCountElement) {
    playerCountElement.textContent = players.length;
  }
}

// Update player list real-time เมื่อมีคนเข้าร่วม
socket.on('user_joined', data => {
  console.log('User joined event received:', data);
});

// Update player list real-time เมื่อมีคนออก
socket.on('user_left', data => {
  console.log('User left event received:', data);
});

// ฟัง event update_room_player_count เพื่ออัปเดตจำนวนผู้เล่นแบบ real-time
socket.on('update_room_player_count', data => {
  if (data && data.roomId == roomId) {
    document.getElementById('player-count').textContent = data.count;
  }
});

// จัดการเมื่อผู้ใช้ออกจากหน้าเว็บ
window.addEventListener('beforeunload', () => {
  // ไม่ต้องส่ง leave_room event เพื่อไม่ให้ลบข้อมูลคะแนน
  console.log('User leaving page, preserving score data');
});

// จัดการเมื่อผู้ใช้กดปุ่มย้อนกลับ
window.addEventListener('popstate', () => {
  // ไม่ต้องส่ง leave_room event เพื่อไม่ให้ลบข้อมูลคะแนน
  console.log('User navigating back, preserving score data');
});

// Owner starts game
if (isOwner) {
  const startBtn = document.getElementById('start-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (startBtn) {
    startBtn.onclick = () => {
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
  let html = `<div id="question-select-modal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-8 max-w-2xl w-full">
        <h3 class="text-xl font-bold mb-4">เลือกคำถามสำหรับเกมนี้ (เลือก 14 ข้อ)</h3>
        <div id="question-select-alert" class="mb-2 text-red-600 font-semibold hidden">เลือกครบ 14 ข้อแล้ว</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto mb-4">
          ${questions.map((q, i) => `
            <label class="flex items-start gap-2">
              <input type="checkbox" class="q-checkbox" value="${q.rowid}">
              <span>${i + 1}. ${q.question_text}</span>
            </label>
          `).join('')}
        </div>
        <button id="confirm-questions-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2 rounded-xl">ยืนยัน</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  // Alert when 14 selected
  const checkboxes = document.querySelectorAll('.q-checkbox');
  const alert14 = document.getElementById('question-select-alert');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const checkedCount = document.querySelectorAll('.q-checkbox:checked').length;
      if (checkedCount === 14) {
        alert14.classList.remove('hidden');
      } else {
        alert14.classList.add('hidden');
      }
    });
  });
  document.getElementById('confirm-questions-btn').onclick = () => {
    const checked = Array.from(document.querySelectorAll('.q-checkbox:checked')).map(cb => parseInt(cb.value));
    if (checked.length !== 14) {
      alert('กรุณาเลือก 14 ข้อ');
      return;
    }
    // Send selected question ids to backend
    socket.emit('questions_selected', roomId, checked);
    document.getElementById('question-select-modal').remove();
    
    // Start game immediately without countdown
    socket.emit('start_game', roomId, user.id);
  };
});

// รับชุดคำถามที่ใช้เล่นจริง (ทุกคนในห้อง)
socket.on('game_questions', function (selectedQuestions) {
  // ใช้ลำดับคำถามที่ backend ส่งมา (ไม่ต้อง shuffle อีก)
  questions = selectedQuestions;
  currentQuestion = 0;
  document.getElementById('waiting-area')?.classList.add('hidden');
  if (!isOwner) {
    document.getElementById('start-btn')?.classList.add('hidden');
  }
  // เริ่มเกมด้วยฟังก์ชั่น runGame
  runGame();
  // ฟังก์ชั่นหลักสำหรับรันเกมทีละข้อ
  function runGame() {
    if (currentQuestion >= questions.length) {
      showSummary();
      return;
    }
    showCountdown(20, () => {
      showQuestionWithTimer(15, () => {
        showAnswer();
        setTimeout(() => {
          currentQuestion++;
          runGame();
        }, 3000); // แสดงเฉลย 3 วินาที
      });
    });
  }

  // แสดงคำถามพร้อมจับเวลา (15 วินาที)
  function showQuestionWithTimer(seconds, onFinish) {
    const q = questions[currentQuestion];
    if (!q) return;
    const gameArea = document.getElementById('game-area');
    let timeLeft = seconds;
    gameArea.innerHTML = `
      <div class="mb-4">
        <div class="text-xl font-bold mb-2">ข้อที่ ${currentQuestion + 1}: ${q.question_text}</div>
        <div class="text-gray-500 mb-2">คำใบ้: ${q.hint || '-'} </div>
        <div class="text-lg text-purple-700 font-bold mb-2">เวลาที่เหลือ: <span id='question-timer'>${timeLeft}</span> วินาที</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${[q.choice1, q.choice2, q.choice3, q.choice4].map((c, i) => `<button class='choice-btn bg-purple-100 hover:bg-purple-300 text-purple-800 font-bold py-3 rounded-xl' data-idx='${i}'>${c}</button>`).join('')}
      </div>
      <div class="mt-4 text-gray-400 text-sm">* ตอบไวได้คะแนนเยอะ ตอบช้าคะแนนลดลง</div>
    `;
    answered = false;
    startTime = Date.now();
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.onclick = () => {
        if (answered) return;
        answered = true;
        const answerIdx = btn.getAttribute('data-idx');
        const answerTime = Date.now() - startTime;
        socket.emit('submit_answer', { 
          roomId, 
          userId: user.id, 
          answerIndex: answerIdx, 
          answerTime,
          questionIndex: currentQuestion,
          currentQuestion: questions[currentQuestion]
        });
        btn.classList.add('bg-green-300');
      };
    });
    // จับเวลา
    const timer = setInterval(() => {
      timeLeft--;
      const timerEl = document.getElementById('question-timer');
      if (timerEl) timerEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        if (typeof onFinish === 'function') onFinish();
      }
    }, 1000);
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
  // ฟังก์ชั่นนับถอยหลัง
  function showCountdown(seconds, onFinish) {
    const gameArea = document.getElementById('game-area');
    let timeLeft = seconds;
    gameArea.innerHTML = `<div class="text-3xl font-bold text-purple-700 mb-4">เกมจะเริ่มใน <span id='countdown-timer'>${timeLeft}</span> วินาที</div>`;
    const timer = setInterval(() => {
      timeLeft--;
      document.getElementById('countdown-timer').textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        if (typeof onFinish === 'function') onFinish();
      }
    }, 1000);
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

// Listen for game start (question UI)
let selectedAnswerIdx = null;
socket.on('game_started', () => {
  if (gameStartHandled) return;
  gameStartHandled = true;
  
  // Enable ingredient shop
  enableIngredientShop();
  
  // Trigger food randomization for this user
  socket.emit('random_food', { roomId, userId: user.id });
  
  // Start the actual game immediately
  selectedAnswerIdx = null;
  showQuestion();
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
});

// Listen for next question
socket.on('next_question', () => {
  currentQuestion++;
  selectedAnswerIdx = null;
  answered = false;
  showQuestion();
});

// Show question with timer
function showQuestion() {
  const q = questions[currentQuestion];
  if (!q) {
    // ถ้าไม่มีคำถามแล้ว ให้แสดงสรุป
    showSummary();
    return;
  }
  
  let timeLeft = 20; // 20 วินาทีต่อข้อ
  answered = false;
  selectedAnswerIdx = null; // รีเซ็ตคำตอบที่เลือก
  startTime = Date.now();
  let questionEnded = false;
  
  const gameArea = document.getElementById('game-area');
  
  // สร้างปุ่มตัวเลือก
  let choicesHtml = [q.choice1, q.choice2, q.choice3, q.choice4].map((c, i) => {
    let btnClass = 'choice-btn bg-purple-100 hover:bg-purple-300 text-purple-800 font-bold py-3 rounded-xl';
    if (selectedAnswerIdx !== null && selectedAnswerIdx == i) btnClass += ' ring-4 ring-green-400';
    return `<button class='${btnClass}' data-idx='${i}' ${selectedAnswerIdx !== null ? 'disabled' : ''}>${c}</button>`;
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
      <div class="mt-4 text-gray-400 text-sm">* ตอบไวได้คะแนนเยอะ ตอบช้าคะแนนลดลง</div>
    `;
  
  // ล้าง fallback timeout ก่อนหน้าและเริ่มใหม่
  clearQuestionTimeout();
  startQuestionTimeout();
  
  // จับเวลา
  const timer = setInterval(() => {
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
      clearInterval(timer);
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
    if (!answered) {
      answered = true;
      socket.emit('submit_answer', { 
        roomId, 
        userId: user.id, 
        answerIndex: -1, 
        answerTime: 20000, // 20 วินาที
        questionIndex: currentQuestion,
        currentQuestion: questions[currentQuestion]
      });
    }
    
    // แจ้ง backend ว่าคำถามนี้จบแล้ว
    socket.emit('question_ended', { 
      roomId, 
      questionIndex: currentQuestion,
      currentQuestion: questions[currentQuestion]
    });
    
    // รอ 1 วินาทีแล้วจบคำถาม (fallback)
    setTimeout(() => {
      if (!questionEnded) {
        socket.emit('question_ended', { 
          roomId, 
          questionIndex: currentQuestion,
          currentQuestion: questions[currentQuestion]
        });
      }
    }, 1000);
  }
  
  // Event handlers สำหรับปุ่มตัวเลือก
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.onclick = () => {
      if (answered || selectedAnswerIdx !== null || questionEnded) return;
      
      answered = true;
      clearInterval(timer); // หยุดจับเวลา
      
      selectedAnswerIdx = parseInt(btn.getAttribute('data-idx'));
      const answerTime = Date.now() - startTime;
      
      socket.emit('submit_answer', { 
        roomId, 
        userId: user.id, 
        answerIndex: selectedAnswerIdx, 
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
    
    // แสดงเฉลยหลังจาก 2 วินาที
    setTimeout(() => {
      showAnswer();
      // ไปข้อถัดไปหลังจาก 3 วินาที
      setTimeout(() => {
        currentQuestion++;
        selectedAnswerIdx = null; // รีเซ็ตคำตอบที่เลือก
        answered = false; // รีเซ็ตสถานะการตอบ
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
  }
  
  // ถ้าเป็น user นี้ ให้แสดงปุ่มที่เลือกไว้ (active) ค้างไว้
  if (data.userId === user.id && typeof data.answerIndex !== 'undefined') {
    selectedAnswerIdx = parseInt(data.answerIndex);
    // อัปเดตปุ่มให้ active
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
  const correctIndex = q.answer_index - 1;
  
  // แสดงเฉลยและผลลัพธ์
  gameArea.innerHTML += `
    <div class="mt-4 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
      <div class="text-center mb-4">
        <div class="text-green-800 font-bold text-2xl mb-2">🎯 เฉลย</div>
        <div class="text-green-700 text-xl font-semibold">${correctAnswer}</div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        ${[q.choice1, q.choice2, q.choice3, q.choice4].map((choice, idx) => {
          let choiceClass = 'p-3 rounded-lg border-2 font-semibold';
          if (idx === correctIndex) {
            choiceClass += ' bg-green-200 border-green-500 text-green-800';
          } else if (idx === selectedAnswerIdx) {
            choiceClass += ' bg-red-200 border-red-500 text-red-800';
          } else {
            choiceClass += ' bg-gray-100 border-gray-300 text-gray-600';
          }
          
          let icon = '';
          if (idx === correctIndex) {
            icon = '✅';
          } else if (idx === selectedAnswerIdx && idx !== correctIndex) {
            icon = '❌';
          }
          
          return `
            <div class="${choiceClass}">
              ${icon} ${choice}
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="mt-4 text-center">
        <div class="text-gray-600 text-sm">
          ${selectedAnswerIdx === correctIndex ? 
            '🎉 ยินดีด้วย! คุณตอบถูก!' : 
            selectedAnswerIdx !== null ? 
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
  
  let html = `
    <div class="text-center">
      <div class="text-4xl font-bold mb-8 text-purple-700">🏆 สรุปผลคะแนน 🏆</div>
      <div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl p-8 shadow-xl border-2 border-purple-200">
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
      <div class="mt-8 space-x-4">
        <button onclick="window.location.reload()" class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all duration-200">
          🎮 เล่นใหม่
        </button>
        <button onclick="window.location.href='/dashboard'" class="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all duration-200">
          🏠 กลับหน้าหลัก
        </button>
      </div>
    </div>
  `;
  
  gameArea.innerHTML = html;
}
