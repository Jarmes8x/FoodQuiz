const { usersDB, executeWithRetry } = require('../database/dbConfig');

const AVAILABLE_FOODS = [
  'กะเพราหมูสับ', 'ข้าวผัดรถไฟ', 'ส้มตำ', 'ผัดเปรี้ยวหวาน', 'แกงจืดหมูสับ',
  'หมูสับผัดไข่', 'ไข่ตุ๋นกุ้ง', 'น้ำพริกอ่องหมูสับ', 'ยำกุ้งสุก', 'ไข่เจียวทรงเครื่อง'
];

const generateRandomFoods = () => {
  // const numFoods = Math.floor(Math.random() * 2) + 2;
  const numFoods = 3;
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

      // ตรวจสอบว่าผู้เล่นทำอาหารครบแล้วหรือไม่
      const hasCompletedAllMeals = await checkPlayerMealCompletion(roomId, userId);
      
      if (hasCompletedAllMeals) {
        // ผู้เล่นทำอาหารครบแล้ว - จบเกม
        await endGameWithWinner(roomId, userId, io);
      }

      // แจ้งให้ผู้เล่นอื่นทราบว่ามีการทำอาหาร
      socket.to(roomId).emit('player_cooked_meal', {
        userId: userId,
        mealName: mealName,
        usedIngredients: usedIngredients,
        hasCompletedAllMeals: hasCompletedAllMeals
      });

      // ส่งการยืนยันกลับไปยังผู้เล่น
      socket.emit('meal_cooked_success', {
        mealName: mealName,
        usedIngredients: usedIngredients,
        remainingIngredients: remainingIngredients,
        hasCompletedAllMeals: hasCompletedAllMeals
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

  // เพิ่ม event handler สำหรับดึงข้อมูลผู้ชนะ
  socket.on('get_game_winner', async ({ roomId }) => {
    try {
      
      // ตรวจสอบสถานะห้องก่อน
      const roomStatus = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT status FROM rooms WHERE id = ?', [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });
      
      // ถ้าห้องไม่ได้จบแล้ว ไม่ส่งข้อมูลผู้ชนะ
      if (!roomStatus || roomStatus.status !== 'finished') {
        console.log(`Room ${roomId} is not finished - not sending winner info`);
        return;
      }
      
      // ดึงข้อมูลผู้ชนะจากตาราง cooked_meals (ผู้เล่นที่ทำอาหารครบแล้ว)
      const winnerData = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get(`
            SELECT DISTINCT cm.user_id, u.name as user_name
            FROM cooked_meals cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.room_id = ?
            ORDER BY cm.cooked_at DESC
            LIMIT 1
          `, [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });

      // ดึงข้อมูลห้อง
      const roomData = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT name FROM rooms WHERE id = ?', [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });

      if (winnerData && roomData) {
        // ดึงเมนูที่ผู้ชนะได้รับ
        const winnerFoods = await executeWithRetry(async () => {
          return new Promise((resolve, reject) => {
            usersDB.all('SELECT food_name FROM player_foods WHERE room_id = ? AND user_id = ?', 
              [roomId, winnerData.user_id], (err, rows) => {
              if (err) reject(err);
              else resolve(rows ? rows.map(row => row.food_name) : []);
            });
          });
        });
        
        const winnerInfo = {
          winner: {
            id: winnerData.user_id,
            name: winnerData.user_name,
            foods: winnerFoods
          },
          roomName: roomData.name
        };
        
        socket.emit('game_winner_info', winnerInfo);
      } else {
        // ส่งข้อมูลเริ่มต้นถ้าไม่พบ
        socket.emit('game_winner_info', {
          winner: {
            id: 0,
            name: 'ไม่พบข้อมูล'
          },
          roomName: 'ไม่พบข้อมูล'
        });
      }
    } catch (error) {
      socket.emit('error', { message: 'Error retrieving winner info' });
    }
  });

};

// ฟังก์ชันตรวจสอบว่าผู้เล่นทำอาหารครบแล้วหรือไม่
const checkPlayerMealCompletion = async (roomId, userId) => {
  try {
    // ดึงอาหารที่ผู้เล่นได้รับ
    const playerFoods = await getPlayerFoods(roomId, userId);
    
    // ดึงอาหารที่ผู้เล่นทำแล้ว
    const cookedMeals = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT DISTINCT meal_name FROM cooked_meals WHERE room_id = ? AND user_id = ?', 
          [roomId, userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
      });
    });
    
    const cookedMealNames = cookedMeals.map(row => row.meal_name);
    
    // ตรวจสอบว่าทำอาหารครบทุกอย่างที่ได้รับหรือไม่
    const hasCompletedAllMeals = playerFoods.every(food => cookedMealNames.includes(food));
    
    console.log(`Player ${userId} completion check:`, {
      playerFoods,
      cookedMealNames,
      hasCompletedAllMeals
    });
    
    return hasCompletedAllMeals;
  } catch (error) {
    console.error('Error checking player meal completion:', error);
    return false;
  }
};

// ฟังก์ชันจบเกมและแสดงผู้ชนะ
const endGameWithWinner = async (roomId, winnerUserId, io) => {
  try {
    // ดึงข้อมูลผู้ชนะ
    const winner = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT id, name FROM users WHERE id = ?', [winnerUserId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });
    
    // ดึงข้อมูลห้อง
    const room = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT id, name, creator_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });
    
    // อัปเดตสถานะห้องเป็นจบเกม
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('UPDATE rooms SET status = ? WHERE id = ?', ['finished', roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    // อัปเดตสถานะห้องเป็น 'finished' ทันที
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('UPDATE rooms SET status = ? WHERE id = ?', ['finished', roomId], (err) => {
          if (err) {
            console.error('Error updating room status:', err);
            reject(err);
          } else {
            console.log(`Room ${roomId} status updated to 'finished'`);
            resolve();
          }
        });
      });
    });
    
    // รีเซ็ตเกมสเตทของทุกคนในห้อง
    const roomPlayers = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT user_id FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    });

    // ลบเกมสเตทของทุกคนในห้อง
    for (const player of roomPlayers) {
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM game_state WHERE user_id = ? AND room_id = ?', 
            [player.user_id, roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }
    
    // ตรวจสอบจำนวนคำถามก่อนลบ
    const questionsBeforeDelete = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT COUNT(*) as count FROM room_questions WHERE room_id = ?', [roomId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      });
    });
    console.log(`📊 จำนวนคำถามในห้อง ${roomId} ก่อนลบ: ${questionsBeforeDelete} ข้อ`);
    
    // ลบคำถามออกจากตาราง room_questions
    console.log(`🗑️ กำลังลบคำถามจาก room_questions สำหรับห้อง ${roomId}...`);
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM room_questions WHERE room_id = ?', [roomId], (err) => {
          if (err) {
            console.error('❌ Error deleting room questions:', err);
            reject(err);
          } else {
            console.log(`✅ ลบคำถามจาก room_questions สำเร็จสำหรับห้อง ${roomId}`);
            resolve();
          }
        });
      });
    });
    
    // ตรวจสอบจำนวนคำถามหลังลบ
    const questionsAfterDelete = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT COUNT(*) as count FROM room_questions WHERE room_id = ?', [roomId], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      });
    });
    console.log(`📊 จำนวนคำถามในห้อง ${roomId} หลังลบ: ${questionsAfterDelete} ข้อ`);
    
    if (questionsAfterDelete > 0) {
      console.warn(`⚠️ คำถามยังไม่หายไปทั้งหมด! ยังเหลือ ${questionsAfterDelete} ข้อ`);
    } else {
      console.log(`🎉 ลบคำถามสำเร็จ! ไม่เหลือคำถามในห้อง ${roomId}`);
    }

    // ดึงเมนูที่ผู้ชนะได้รับ
    const winnerFoods = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT food_name FROM player_foods WHERE room_id = ? AND user_id = ?', 
          [roomId, winnerUserId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows ? rows.map(row => row.food_name) : []);
        });
      });
    });
    
    console.log(`เมนูที่ผู้ชนะ ${winner.name} ได้รับ:`, winnerFoods);
    
    // แจ้งทุกคนในห้องว่าจบเกมแล้ว
    io.to(roomId).emit('game_ended', {
      winner: {
        id: winner.id,
        name: winner.name,
        foods: winnerFoods
      },
      roomId: roomId,
      roomName: room.name
    });
    
    // ส่งข้อมูลผู้ชนะให้ทุกคนในห้องทันที
    io.to(roomId).emit('game_winner_info', {
      winner: {
        id: winner.id,
        name: winner.name,
        foods: winnerFoods
      },
      roomName: room.name
    });
    
    // แจ้งให้รีเซ็ตเกม
    io.to(roomId).emit('game_reset', {
      message: 'เกมจบแล้ว - คำถามถูกรีเซ็ตแล้ว'
    });
    
    // แจ้งให้ทุกคนในห้องทราบว่าห้องจบแล้ว
    io.to(roomId).emit('room_finished', {
      roomId: roomId,
      message: 'ห้องนี้จบเกมแล้ว'
    });
    
    console.log(`Game ended in room ${roomId}. Winner: ${winner.name}`);
    
  } catch (error) {
    console.error('Error ending game:', error);
  }
};

module.exports = { 
  setupFoodHandlers, 
  assignRandomFoodsToPlayer, 
  getPlayerFoods,
  generateRandomFoods,
  checkPlayerMealCompletion,
  endGameWithWinner
};