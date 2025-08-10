const { usersDB, executeWithRetry } = require('../database/dbConfig');

// ฟังก์ชันสำหรับซื้อวัตถุดิบ
const buyIngredient = async (roomId, userId, ingredient) => {
  try {
    // ดึงแต้มปัจจุบัน
    const playerData = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT score FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });

    if (!playerData) {
      throw new Error('Player not found');
    }

    let points = playerData.score;

    // ดึงราคาวัตถุดิบจากฐานข้อมูล
    const ingredientData = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT price FROM ingredient WHERE name = ?', [ingredient], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });

    if (!ingredientData) {
      throw new Error('Ingredient not found');
    }

    const price = ingredientData.price;

    if (points < price) {
      throw new Error('Not enough points');
    }

    // หักแต้ม
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('UPDATE room_players SET score = score - ? WHERE room_id = ? AND user_id = ?', 
          [price, roomId, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    // เพิ่มวัตถุดิบลงในตาราง player_ingredients
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('INSERT INTO player_ingredients (room_id, user_id, ingredient_name) VALUES (?, ?, ?)', 
          [roomId, userId, ingredient], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    // ดึงวัตถุดิบทั้งหมดของผู้เล่น
    const ingredients = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT ingredient_name FROM player_ingredients WHERE room_id = ? AND user_id = ?', 
          [roomId, userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.ingredient_name));
        });
      });
    });

    // ดึงข้อมูลล่าสุด
    const updatedData = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT score, food FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });

    return {
      userId,
      points: updatedData.score,
      ingredients: ingredients,
      food: updatedData.food
    };

  } catch (error) {
    console.error('Error buying ingredient:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับสุ่มอาหาร
const randomFood = async (roomId, userId) => {
  try {
    // ดึงวัตถุดิบของผู้เล่นจากตาราง player_ingredients
    const ingredients = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT ingredient_name FROM player_ingredients WHERE room_id = ? AND user_id = ?', 
          [roomId, userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.ingredient_name));
        });
      });
    });

    // ดึงสูตรอาหารและวัตถุดิบที่สัมพันธ์กัน
    const recipes = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT meal.id as meal_id, meal.name as meal_name, GROUP_CONCAT(meal_ingredient.ingredient) as reqs FROM meal JOIN meal_ingredient ON meal.id = meal_ingredient.meal_id GROUP BY meal.id', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    });

    // ตรวจสอบว่าสามารถทำอาหารได้หรือไม่
    const canMake = recipes.filter(r => {
      const reqs = (r.reqs || '').split(',');
      return reqs.every(req => ingredients.includes(req));
    });

    let food = '';
    if (canMake.length > 0) {
      food = canMake[Math.floor(Math.random() * canMake.length)].name;
    } else {
      food = 'ยังทำอาหารไม่ได้';
    }

    // อัปเดตอาหารในฐานข้อมูล
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('UPDATE room_players SET food = ? WHERE room_id = ? AND user_id = ?', [food, roomId, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    // ดึงข้อมูลปัจจุบันของผู้เล่นรวมถึงคะแนน
    const updatedData = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT score, food FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });

    return {
      userId,
      points: updatedData.score,
      ingredients: ingredients,
      food: updatedData.food
    };

  } catch (error) {
    console.error('Error randomizing food:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงวัตถุดิบของผู้เล่น
const getPlayerIngredients = async (roomId, userId) => {
  try {
    const ingredients = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT ingredient_name FROM player_ingredients WHERE room_id = ? AND user_id = ?', 
          [roomId, userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.ingredient_name));
        });
      });
    });

    return ingredients;
  } catch (error) {
    console.error('Error getting player ingredients:', error);
    return [];
  }
};

// Socket event handlers สำหรับร้านค้า
const setupShopHandlers = (io, socket) => {
  // ซื้อวัตถุดิบ
  socket.on('buy_ingredient', async ({ roomId, userId, ingredient }) => {
    try {
      const result = await buyIngredient(roomId, userId, ingredient);
      socket.emit('update_points_ingredients', result);
      
      // แจ้งทุกคนในห้องว่ามีการซื้อวัตถุดิบ
      socket.to(roomId).emit('player_ingredients_updated', {
        userId,
        ingredients: result.ingredients
      });
    } catch (error) {
      console.error('Error in buy_ingredient:', error);
      socket.emit('error', { 
        message: error.message === 'Not enough points' ? 'แต้มไม่พอ' : 'เกิดข้อผิดพลาดในการซื้อวัตถุดิบ' 
      });
    }
  });

  // สุ่มอาหาร
  socket.on('random_food', async ({ roomId, userId }) => {
    try {
      const result = await randomFood(roomId, userId);
      socket.emit('update_points_ingredients', result);
    } catch (error) {
      console.error('Error in random_food:', error);
      socket.emit('error', { message: 'เกิดข้อผิดพลาดในการสุ่มอาหาร' });
    }
  });

  // ดึงวัตถุดิบของผู้เล่น
  socket.on('get_player_ingredients', async ({ roomId, userId }) => {
    try {
      const ingredients = await getPlayerIngredients(roomId, userId);
      socket.emit('player_ingredients_loaded', {
        userId,
        ingredients
      });
    } catch (error) {
      console.error('Error in get_player_ingredients:', error);
      socket.emit('error', { message: 'เกิดข้อผิดพลาดในการดึงวัตถุดิบ' });
    }
  });
};

module.exports = { setupShopHandlers }; 