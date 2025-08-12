const { usersDB, executeWithRetry } = require('../database/dbConfig');

const AVAILABLE_FOODS = [
  'กะเพราหมูสับ', 'ข้าวผัดรถไฟ', 'ส้มตำ', 'ผัดเปรี้ยวหวาน', 'แกงจืดหมูสับ',
  'หมูสับผัดไข่', 'ไข่ตุ๋นกุ้ง', 'น้ำพริกอ่องหมูสับ', 'ยำกุ้งสุก', 'ไข่เจียวทรงเครื่อง'
];

const generateRandomFoods = () => {
  const numFoods = Math.floor(Math.random() * 2) + 2;
  const shuffled = [...AVAILABLE_FOODS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numFoods);
};

const savePlayerFoods = async (roomId, userId, foods) => {
  try {
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM player_foods WHERE room_id = ? AND user_id = ?', [roomId, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    for (const food of foods) {
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('INSERT INTO player_foods (room_id, user_id, food_name) VALUES (?, ?, ?)', 
            [roomId, userId, food], (err) => {
              if (err) reject(err);
              else resolve();
            });
        });
      });
    }
    return foods;
  } catch (error) {
    console.error('Error saving player foods:', error);
    throw error;
  }
};

const getPlayerFoods = async (roomId, userId) => {
  try {
    const foods = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT food_name FROM player_foods WHERE room_id = ? AND user_id = ? ORDER BY created_at ASC', 
          [roomId, userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
      });
    });
    return foods.map(row => row.food_name);
  } catch (error) {
    console.error('Error getting player foods:', error);
    return [];
  }
};

const assignRandomFoodsToPlayer = async (roomId, userId) => {
  try {
    const existingFoods = await getPlayerFoods(roomId, userId);
    if (existingFoods.length > 0) {
      console.log(`Existing foods found for user ${userId} in room ${roomId}:`, existingFoods);
      return existingFoods;
    }
    const randomFoods = generateRandomFoods();
    await savePlayerFoods(roomId, userId, randomFoods);
    console.log(`New foods assigned for user ${userId} in room ${roomId}:`, randomFoods);
    return randomFoods;
  } catch (error) {
    console.error('Error assigning random foods:', error);
    throw error;
  }
};



const setupFoodHandlers = (io, socket) => {
  socket.on('join_room', async (roomId, user) => {
    try {
      const foods = await assignRandomFoodsToPlayer(roomId, user.id);
      socket.join(roomId);
      socket.emit('foods_assigned', { roomId, userId: user.id, foods });
      console.log(`Assigned foods to user ${user.name} in room ${roomId}:`, foods);

    } catch (error) {
      console.error('Error in join_room:', error);
      socket.emit('error', { message: 'Error joining room' });
    }
  });

  socket.on('get_my_foods', async ({ roomId, userId }) => {
    try {
      const foods = await getPlayerFoods(roomId, userId);
      socket.emit('my_foods', { roomId, userId, foods });
    } catch (error) {
      console.error('Error getting my foods:', error);
      socket.emit('error', { message: 'Error retrieving your foods' });
    }
  });

  socket.on('get_room_foods', async ({ roomId }) => {
    try {
      const allFoods = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all(`
            SELECT 
              pf.user_id,
              u.name as user_name,
              GROUP_CONCAT(pf.food_name) as foods
            FROM player_foods pf
            JOIN users u ON pf.user_id = u.id
            WHERE pf.room_id = ?
            GROUP BY pf.user_id
          `, [roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });
      socket.emit('room_foods', {
        roomId,
        foods: allFoods.map(row => ({
          userId: row.user_id,
          userName: row.user_name,
          foods: row.foods ? row.foods.split(',') : []
        }))
      });
    } catch (error) {
      console.error('Error getting room foods:', error);
      socket.emit('error', { message: 'Error retrieving room foods' });
    }
  });

  // เพิ่ม event handler สำหรับการทำอาหาร
  socket.on('cook_meal', async ({ roomId, userId, mealName, usedIngredients, remainingIngredients }) => {
    try {
      console.log(`User ${userId} cooked ${mealName} using ingredients:`, usedIngredients);
      
      // บันทึกประวัติการทำอาหาร
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('INSERT INTO cooked_meals (room_id, user_id, meal_name, used_ingredients) VALUES (?, ?, ?, ?)', 
            [roomId, userId, mealName, usedIngredients.join(', ')], (err) => {
              if (err) reject(err);
              else resolve();
            });
        });
      });
      
      // อัปเดตวัตถุดิบของผู้เล่นในฐานข้อมูล
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM player_ingredients WHERE room_id = ? AND user_id = ?', 
            [roomId, userId], (err) => {
              if (err) reject(err);
              else resolve();
            });
        });
      });

      // เพิ่มวัตถุดิบที่เหลือกลับเข้าไป
      for (const ingredient of remainingIngredients) {
        await executeWithRetry(async () => {
          return new Promise((resolve, reject) => {
            usersDB.run('INSERT INTO player_ingredients (room_id, user_id, ingredient_name) VALUES (?, ?, ?)', 
              [roomId, userId, ingredient], (err) => {
                if (err) reject(err);
                else resolve();
              });
          });
        });
      }

      // แจ้งให้ผู้เล่นอื่นทราบว่ามีการทำอาหาร
      socket.to(roomId).emit('player_cooked_meal', {
        userId: userId,
        mealName: mealName,
        usedIngredients: usedIngredients
      });

      // ส่งการยืนยันกลับไปยังผู้เล่น
      socket.emit('meal_cooked_success', {
        mealName: mealName,
        usedIngredients: usedIngredients,
        remainingIngredients: remainingIngredients
      });

      console.log(`Successfully updated ingredients for user ${userId} after cooking ${mealName}`);
    } catch (error) {
      console.error('Error cooking meal:', error);
      socket.emit('error', { message: 'Error cooking meal' });
    }
  });

  // เพิ่ม event handler สำหรับดึงประวัติการทำอาหาร
  socket.on('get_cooked_meals', async ({ roomId, userId }) => {
    try {
      const cookedMeals = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all(`
            SELECT meal_name, used_ingredients, cooked_at 
            FROM cooked_meals 
            WHERE room_id = ? AND user_id = ? 
            ORDER BY cooked_at DESC
          `, [roomId, userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });
      
      socket.emit('cooked_meals_list', {
        roomId: roomId,
        userId: userId,
        cookedMeals: cookedMeals
      });
    } catch (error) {
      console.error('Error getting cooked meals:', error);
      socket.emit('error', { message: 'Error retrieving cooked meals' });
    }
  });

};

module.exports = { 
  setupFoodHandlers, 
  assignRandomFoodsToPlayer, 
  getPlayerFoods,
  generateRandomFoods
};