const { usersDB, executeWithRetry } = require('../database/dbConfig');

const AVAILABLE_FOODS = [
  'กะเพราหมูสับ', 'ข้าวผัดรถไฟ', 'ส้มตำ', 'ผัดเปรี้ยวหวาน', 'แกงจืดหมูสับ',
  'หมูสับผัดไข่', 'ไข่ตุ๋นกุ้ง', 'น้ำพริกอ่องหมูสับ', 'ยำกุ้งสุก', 'ไข่เจียวทรงเครื่อง',
  'ต้มยำกุ้ง', 'แกงเขียวหวาน', 'ผัดไทย', 'ข้าวมันไก่', 'ลาบหมู',
  'ส้มตำปูปลาร้า', 'แกงส้มชะอมไข่', 'ผัดซีอิ๊วไก่', 'ต้มข่าไก่', 'แกงเผ็ดเป็ดย่าง'
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


};

module.exports = { 
  setupFoodHandlers, 
  assignRandomFoodsToPlayer, 
  getPlayerFoods,
  generateRandomFoods
};