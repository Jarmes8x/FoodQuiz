const usersDB = require('../database/dbConfig');
const { assignRandomFoodsToPlayer } = require('./foodHandlers');

const roomAnswers = {};

const updatePlayerList = async (io, roomId) => {
  try {
    const players = await new Promise((resolve, reject) => {
      usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ?', [roomId], (err, players) => {
        if (err) reject(err);
        else resolve(players || []);
      });
    });

    io.to(`room_${roomId}`).emit('player_list_updated', { roomId, players });

    const count = players.length;
    io.to(`room_${roomId}`).emit('update_room_player_count', { roomId, count });

    return players;
  } catch (error) {
    console.error('Error updating player list:', error);
    throw error;
  }
};

// ตรวจสอบและเพิ่มผู้เล่นในห้อง
const addPlayerToRoom = async (roomId, user) => {
  try {
    const existingPlayer = await new Promise((resolve, reject) => {
      usersDB.get('SELECT id FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingPlayer) {
      const room = await new Promise((resolve, reject) => {
        usersDB.get('SELECT creator_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!room) {
        throw new Error('Room not found');
      }

      const isOwner = room.creator_id === user.id;

      // เพิ่มผู้เล่นลงในฐานข้อมูล
      await new Promise((resolve, reject) => {
        usersDB.run('INSERT INTO room_players (room_id, user_id, score, is_owner) VALUES (?, ?, 0, ?)', [roomId, user.id, isOwner ? 1 : 0], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error adding player to room:', error);
    throw error;
  }
};

// ลบผู้เล่นออกจากห้อง
const removePlayerFromRoom = async (roomId, user) => {
  try {
    await new Promise((resolve, reject) => {
      usersDB.run('DELETE FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, user.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return true;
  } catch (error) {
    console.error('Error removing player from room:', error);
    throw error;
  }
};

// Socket event handlers
const setupRoomHandlers = (io, socket) => {
  socket.on('join_room', async (roomId, user) => {
    try {
      socket.join(`room_${roomId}`);

      const isNewPlayer = await addPlayerToRoom(roomId, user);

      // สุ่มอาหารให้ผู้เล่นเมื่อเข้าห้อง
      if (isNewPlayer) {
        try {
          const foods = await assignRandomFoodsToPlayer(roomId, user.id);
          console.log(`Assigned foods to new player ${user.name} in room ${roomId}:`, foods);
        } catch (foodError) {
          console.error('Error assigning foods to new player:', foodError);
        }
      }

      io.to(`room_${roomId}`).emit('user_joined', { user, socketId: socket.id });

      // อัปเดตรายชื่อผู้เล่น
      await updatePlayerList(io, roomId);

    } catch (error) {
      console.error('Error in join_room:', error);
      socket.emit('error', { message: 'เกิดข้อผิดพลาดในการเข้าร่วมห้อง' });
    }
  });

  // เมื่อผู้เล่นออกจากห้อง
  socket.on('leave_room', async (roomId, user) => {
    try {
      socket.leave(`room_${roomId}`);

      // ลบผู้เล่นออกจากฐานข้อมูล
      await removePlayerFromRoom(roomId, user);
      io.to(`room_${roomId}`).emit('user_left', { user, socketId: socket.id });
      await updatePlayerList(io, roomId);

    } catch (error) {
      console.error('Error in leave_room:', error);
    }
  });

  // เมื่อผู้เล่น disconnect
  socket.on('disconnect', async () => {
    try {
      const rooms = Array.from(socket.rooms);

      for (const room of rooms) {
        if (room.startsWith('room_')) {
          const roomId = room.replace('room_', '');
          await updatePlayerList(io, roomId);
        }
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });

  // เมื่อเริ่มเกม
  socket.on('start_game', async (roomId, ownerId) => {
    try {
      const questions = await new Promise((resolve, reject) => {
        usersDB.all('SELECT * FROM questions', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      if (questions.length === 0) {
        io.to(`room_${roomId}`).emit('game_error', { message: 'ไม่สามารถดึงคำถามได้' });
        return;
      }

      io.to(socket.id).emit('select_questions', questions);

    } catch (error) {
      console.error('Error in start_game:', error);
      io.to(`room_${roomId}`).emit('game_error', { message: 'เกิดข้อผิดพลาดในการเริ่มเกม' });
    }
  });

  // เมื่อเลือกคำถาม
  socket.on('questions_selected', async (roomId, selectedQuestions) => {
    try {
      const shuffleArray = (array) => {
        let arr = array.slice();
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      const shuffled = shuffleArray(selectedQuestions);
      io.to(`room_${roomId}`).emit('game_questions', shuffled);

    } catch (error) {
      console.error('Error in questions_selected:', error);
      io.to(`room_${roomId}`).emit('game_error', { message: 'เกิดข้อผิดพลาดในการเลือกคำถาม' });
    }
  });

  // เมื่อส่งคำตอบ
  socket.on('submit_answer', async (data) => {
    try {
      if (!roomAnswers[data.roomId]) roomAnswers[data.roomId] = {};
      if (!roomAnswers[data.roomId][data.questionIndex]) roomAnswers[data.roomId][data.questionIndex] = [];

      roomAnswers[data.roomId][data.questionIndex].push({
        userId: data.userId,
        answerIndex: parseInt(data.answerIndex),
        answerTime: data.answerTime
      });

  // Owner requests questions (for modal selection)
  socket.on('request_questions', async (roomId) => {
    try {
      const questions = await new Promise((resolve, reject) => {
        usersDB.all('SELECT * FROM questions', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      io.to(socket.id).emit('select_questions', questions);
    } catch (error) {
      console.error('Error in request_questions:', error);
      io.to(socket.id).emit('game_error', { message: 'เกิดข้อผิดพลาดในการดึงคำถาม' });
    }
  });

      const scoreRow = await new Promise((resolve, reject) => {
        usersDB.get('SELECT score FROM room_players WHERE room_id = ? AND user_id = ?', [data.roomId, data.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const score = scoreRow ? scoreRow.score : 0;
      io.to(`room_${data.roomId}`).emit('user_answered', { ...data, score });

    } catch (error) {
      console.error('Error in submit_answer:', error);
    }
  });

  // เมื่อเปิดเผยเฉลย
  socket.on('reveal_answer', async (roomId, questionIndex, correctIndex) => {
    try {
      const answers = (roomAnswers[roomId] && roomAnswers[roomId][questionIndex]) || [];
      const correct = answers.filter(a => a.answerIndex === correctIndex)
        .sort((a, b) => a.answerTime - b.answerTime);

  // Owner deletes room
  socket.on('delete_room', async (roomId, userId) => {
    try {
      // Check if user is owner
      const room = await new Promise((resolve, reject) => {
        usersDB.get('SELECT * FROM rooms WHERE id = ? AND creator_id = ?', [roomId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!room) {
        socket.emit('game_error', { message: 'ไม่มีสิทธิ์ลบห้องนี้' });
        return;
      }
      // Delete room and related data
      await new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM room_players WHERE room_id = ?', [roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM questions WHERE room_id = ?', [roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM rooms WHERE id = ?', [roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      io.to(`room_${roomId}`).emit('room_deleted', { roomId });
    } catch (error) {
      console.error('Error in delete_room:', error);
      socket.emit('game_error', { message: 'เกิดข้อผิดพลาดในการลบห้อง' });
    }
  });

      for (let i = 0; i < correct.length; i++) {
        const addScore = Math.max(4 - i, 0);
        const answer = correct[i];

        await new Promise((resolve, reject) => {
          usersDB.run('UPDATE room_players SET score = score + ? WHERE user_id = ? AND room_id = ?', [addScore, answer.userId, roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // broadcast เฉลยและอันดับ
      io.to(`room_${roomId}`).emit('answer_revealed', {
        questionIndex,
        correctUserIds: correct.map(a => a.userId),
        correctIndex,
        rank: correct.map(a => a.userId)
      });

    } catch (error) {
      console.error('Error in reveal_answer:', error);
    }
  });

  // เมื่อสรุปเกม
  socket.on('game_summary', async (roomId) => {
    try {
      const players = await new Promise((resolve, reject) => {
        usersDB.all('SELECT users.id, users.name, room_players.score FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ?', [roomId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      players.sort((a, b) => b.score - a.score);
      io.to(`room_${roomId}`).emit('game_summary', players);

    } catch (error) {
      console.error('Error in game_summary:', error);
    }
  });

  // เมื่อไปข้อถัดไป
  socket.on('next_question', (roomId) => {
    try {
      io.to(`room_${roomId}`).emit('next_question');
    } catch (error) {
      console.error('Error in next_question:', error);
    }
  });
};

module.exports = { setupRoomHandlers }; 