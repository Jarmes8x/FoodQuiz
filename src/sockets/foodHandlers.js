const usersDB = require('../database/dbConfig');

// รายการอาหารที่สามารถสุ่มได้
const AVAILABLE_FOODS = [
  'กะเพราหมูสับ',
  'ข้าวผัดรถไฟ',
  'ส้มตำ',
  'ผัดเปรี้ยวหวาน',
  'แกงจืดหมูสับ',
  'หมูสับผัดไข่',
  'ไข่ตุ๋นกุ้ง',
  'น้ำพริกอ่องหมูสับ',
  'ยำกุ้งสุก',
  'ไข่เจียวทรงเครื่อง',
  'ต้มยำกุ้ง',
  'แกงเขียวหวาน',
  'ผัดไทย',
  'ข้าวมันไก่',
  'ลาบหมู',
  'ส้มตำปูปลาร้า',
  'แกงส้มชะอมไข่',
  'ผัดซีอิ๊วไก่',
  'ต้มข่าไก่',
  'แกงเผ็ดเป็ดย่าง'
];

// ฟังก์ชันสุ่มอาหาร 2-3 อย่าง
const generateRandomFoods = () => {
  const numFoods = Math.floor(Math.random() * 2) + 2; // สุ่ม 2-3 อย่าง
  const shuffled = [...AVAILABLE_FOODS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numFoods);
};

// ฟังก์ชันบันทึกอาหารที่สุ่มได้ลงฐานข้อมูล
const savePlayerFoods = async (roomId, userId, foods) => {
  try {
    // ลบอาหารเก่าของผู้เล่นในห้องนี้ (ถ้ามี)
    await new Promise((resolve, reject) => {
      usersDB.run('DELETE FROM player_foods WHERE room_id = ? AND user_id = ?', [roomId, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // บันทึกอาหารใหม่
    for (const food of foods) {
      await new Promise((resolve, reject) => {
        usersDB.run('INSERT INTO player_foods (room_id, user_id, food_name) VALUES (?, ?, ?)', 
          [roomId, userId, food], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    return foods;
  } catch (error) {
    console.error('Error saving player foods:', error);
    throw error;
  }
};

// ฟังก์ชันดึงอาหารที่สุ่มได้ของผู้เล่น
const getPlayerFoods = async (roomId, userId) => {
  try {
    const foods = await new Promise((resolve, reject) => {
      usersDB.all('SELECT food_name FROM player_foods WHERE room_id = ? AND user_id = ? ORDER BY created_at ASC', 
        [roomId, userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return foods.map(row => row.food_name);
  } catch (error) {
    console.error('Error getting player foods:', error);
    return [];
  }
};

// ฟังก์ชันสุ่มและบันทึกอาหารเมื่อเข้าห้อง
const assignRandomFoodsToPlayer = async (roomId, userId) => {
  try {
    // ตรวจสอบว่าผู้เล่นมีอาหารในห้องนี้แล้วหรือไม่
    const existingFoods = await getPlayerFoods(roomId, userId);
    
    if (existingFoods.length > 0) {
      // ถ้ามีแล้ว ให้ส่งกลับอาหารที่มีอยู่
      return existingFoods;
    }

    // สุ่มอาหารใหม่
    const randomFoods = generateRandomFoods();
    
    // บันทึกลงฐานข้อมูล
    await savePlayerFoods(roomId, userId, randomFoods);
    
    return randomFoods;
  } catch (error) {
    console.error('Error assigning random foods:', error);
    throw error;
  }
};

// Socket event handlers สำหรับการจัดการอาหาร
const setupFoodHandlers = (io, socket) => {
  // เมื่อผู้เล่นเข้าห้อง ให้สุ่มอาหาร
  socket.on('join_room', async (roomId, user) => {
    try {
      // สุ่มอาหารให้ผู้เล่น
      const foods = await assignRandomFoodsToPlayer(roomId, user.id);
      
      // ส่งข้อมูลอาหารกลับไปยังผู้เล่น
      socket.emit('foods_assigned', {
        roomId,
        userId: user.id,
        foods: foods
      });

      console.log(`Assigned foods to user ${user.name} in room ${roomId}:`, foods);
    } catch (error) {
      console.error('Error in join_room food assignment:', error);
    }
  });

  // เมื่อผู้เล่นขอข้อมูลอาหารของตัวเอง
  socket.on('get_my_foods', async ({ roomId, userId }) => {
    try {
      const foods = await getPlayerFoods(roomId, userId);
      socket.emit('my_foods', {
        roomId,
        userId,
        foods: foods
      });
    } catch (error) {
      console.error('Error getting my foods:', error);
      socket.emit('error', { message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอาหาร' });
    }
  });

  // เมื่อผู้เล่นขอข้อมูลอาหารของทุกคนในห้อง
  socket.on('get_room_foods', async ({ roomId }) => {
    try {
      const allFoods = await new Promise((resolve, reject) => {
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
      socket.emit('error', { message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอาหารของห้อง' });
    }
  });
};

module.exports = { 
  setupFoodHandlers, 
  assignRandomFoodsToPlayer, 
  getPlayerFoods,
  generateRandomFoods 
}; 