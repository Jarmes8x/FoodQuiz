const { usersDB, executeWithRetry } = require('../database/dbConfig');
const { assignRandomFoodsToPlayer } = require('./foodHandlers');

const roomAnswers = {};

// ฟังก์ชันสำหรับบันทึกสถานะเกม
const saveGameState = async (roomId, userId, gameState) => {
  try {
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run(`
          INSERT OR REPLACE INTO game_state 
          (room_id, user_id, current_question, answered_questions, game_started, game_finished, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          roomId, 
          userId, 
          gameState.currentQuestion || 0,
          JSON.stringify(gameState.answeredQuestions || []),
          gameState.gameStarted ? 1 : 0,
          gameState.gameFinished ? 1 : 0
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  } catch (error) {
    console.error('Error saving game state:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงสถานะเกม
const getGameState = async (roomId, userId) => {
  try {
    const gameState = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT * FROM game_state WHERE room_id = ? AND user_id = ?', 
          [roomId, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });

    if (gameState) {
      return {
        currentQuestion: gameState.current_question,
        answeredQuestions: JSON.parse(gameState.answered_questions || '[]'),
        gameStarted: Boolean(gameState.game_started),
        gameFinished: Boolean(gameState.game_finished)
      };
    }

    return {
      currentQuestion: 0,
      answeredQuestions: [],
      gameStarted: false,
      gameFinished: false
    };
  } catch (error) {
    console.error('Error getting game state:', error);
    return {
      currentQuestion: 0,
      answeredQuestions: [],
      gameStarted: false,
      gameFinished: false
    };
  }
};

const updatePlayerList = async (io, roomId) => {
  try {
    // ดึงเฉพาะผู้เล่นที่ออนไลน์
    const players = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ? AND room_players.is_online = 1', [roomId], (err, players) => {
          if (err) reject(err);
          else resolve(players || []);
        });
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
    const existingPlayer = await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.get('SELECT id FROM room_players WHERE room_id = ? AND user_id = ?', [roomId, user.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });

    if (!existingPlayer) {
      const room = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT creator_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });

      if (!room) {
        throw new Error('Room not found');
      }

      const isOwner = room.creator_id === user.id;

      // เพิ่มผู้เล่นลงในฐานข้อมูล
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('INSERT INTO room_players (room_id, user_id, score, is_owner, is_online) VALUES (?, ?, 0, ?, 1)', [roomId, user.id, isOwner ? 1 : 0], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      return true;
    } else {
      // ถ้าผู้เล่นมีอยู่แล้ว ให้อัปเดตสถานะเป็นออนไลน์
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('UPDATE room_players SET is_online = 1 WHERE room_id = ? AND user_id = ?', [roomId, user.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      return false;
    }
  } catch (error) {
    console.error('Error adding player to room:', error);
    throw error;
  }
};

// ลบผู้เล่นออกจากห้อง (ไม่ลบข้อมูลคะแนน)
const removePlayerFromRoom = async (roomId, user) => {
  try {
    // อัปเดตสถานะเป็นออฟไลน์แทนการลบข้อมูล
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('UPDATE room_players SET is_online = 0 WHERE room_id = ? AND user_id = ?', [roomId, user.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    console.log(`Player ${user.name} left room ${roomId} - marked as offline`);
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
      
      // เก็บ userId ไว้ใน socket เพื่อใช้ตอน disconnect
      socket.userId = user.id;

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

      // ดึงสถานะเกมของผู้เล่น
      const gameState = await getGameState(roomId, user.id);
      console.log(`Game state for user ${user.id} in room ${roomId}:`, gameState);
      socket.emit('game_state_loaded', { gameState });

      // ตรวจสอบสถานะห้องก่อนส่งคำถาม
      const roomStatus = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT status FROM rooms WHERE id = ?', [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });
      
      // ถ้าห้องจบแล้ว ไม่ส่งคำถาม
      if (roomStatus && roomStatus.status === 'finished') {
        console.log(`Room ${roomId} is finished - not sending questions`);
      } else {
        // ถ้าเกมกำลังดำเนินอยู่ ให้ส่งคำถามไปด้วย
        if (gameState && gameState.gameStarted) {
          // ตรวจสอบว่าเกมจบจริงหรือไม่
          const isGameReallyFinished = gameState.currentQuestion >= 14; // 14 คำถาม
          if (!isGameReallyFinished) {
            console.log(`Game is ongoing, current question: ${gameState.currentQuestion}/14`);
            try {
              const questions = await executeWithRetry(async () => {
                return new Promise((resolve, reject) => {
                  usersDB.all(`
                    SELECT q.* FROM questions q 
                    JOIN room_questions rq ON q.id = rq.question_id 
                    WHERE rq.room_id = ?
                    ORDER BY rq.id ASC
                  `, [roomId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                  });
                });
              });
              
              if (questions.length > 0) {
                console.log(`Sending ${questions.length} questions to user ${user.id} for ongoing game`);
                socket.emit('game_questions', questions);
              }
            } catch (error) {
              console.error('Error loading questions for ongoing game:', error);
            }
          } else {
            console.log(`Game is finished, current question: ${gameState.currentQuestion}/14`);
          }
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
  socket.on('leave_room', async (data) => {
    try {
      console.log('Leave room event received:', data);
      
      let roomId, userId, user;
      
      // รองรับทั้งรูปแบบเก่าและใหม่
      if (typeof data === 'object' && data.roomId && data.userId) {
        // รูปแบบใหม่: { roomId, userId }
        roomId = data.roomId;
        userId = data.userId;
        user = { id: userId, name: 'Unknown' }; // ต้องหาชื่อผู้เล่นจากฐานข้อมูล
      } else if (arguments.length === 2) {
        // รูปแบบเก่า: (roomId, user)
        roomId = arguments[0];
        user = arguments[1];
        userId = user.id;
      } else {
        console.error('Invalid leave_room data format:', data);
        return;
      }

      console.log(`User ${userId} is leaving room ${roomId}`);

      // ออกจาก socket room
      socket.leave(`room_${roomId}`);

      // อัปเดตสถานะเป็นออฟไลน์
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('UPDATE room_players SET is_online = 0 WHERE room_id = ? AND user_id = ?', [roomId, userId], function(err) {
            if (err) {
              console.error('Error updating player status in DB:', err);
              reject(err);
            } else {
              console.log(`Updated player with user_id ${userId} to offline in room ${roomId}. Rows affected: ${this.changes}`);
              resolve({ changes: this.changes });
            }
          });
        });
      });

      // แจ้งผู้เล่นอื่นๆ ว่าผู้เล่นนี้ออกจากห้อง
      io.to(`room_${roomId}`).emit('user_left', { user: { id: userId, name: user.name || 'Unknown' }, socketId: socket.id });
      
      // อัปเดตรายชื่อผู้เล่น
      await updatePlayerList(io, roomId);
      
      console.log(`Player ${userId} successfully left room ${roomId}`);

    } catch (error) {
      console.error('Error in leave_room:', error);
    }
  });

  // เมื่อต้องการดึงรายชื่อผู้เล่นในห้อง
  socket.on('get_room_players', async ({ roomId }) => {
    try {
      console.log(`Getting room players for room ${roomId}...`);
      
      // ดึงเฉพาะผู้เล่นที่ออนไลน์
      const players = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ? AND room_players.is_online = 1', [roomId], (err, players) => {
            if (err) reject(err);
            else resolve(players || []);
          });
        });
      });

      console.log(`Found ${players.length} online players in room ${roomId}:`, players);
      socket.emit('room_players', { roomId, players });
      console.log(`Sent room_players event to client for room ${roomId}`);
    } catch (error) {
      console.error('Error getting room players:', error);
      socket.emit('error', { message: 'เกิดข้อผิดพลาดในการดึงรายชื่อผู้เล่น' });
    }
  });

  // เมื่อผู้เล่น disconnect
  socket.on('disconnect', async () => {
    try {
      const rooms = [];
      for (const [room, socketsSet] of io.sockets.adapter.rooms) {
        if (room.startsWith('room_') && socketsSet.has(socket.id)) {
          rooms.push(room);
        }
      }
      
      // หา user_id ของผู้เล่นที่ disconnect
      const userId = socket.userId; // ต้องเก็บ userId ไว้ใน socket เมื่อ join room
      
      for (const room of rooms) {
        const roomId = room.replace('room_', '');
        
        // อัปเดตสถานะเป็นออฟไลน์
        if (userId) {
          await executeWithRetry(async () => {
            return new Promise((resolve, reject) => {
              usersDB.run('UPDATE room_players SET is_online = 0 WHERE room_id = ? AND user_id = ?', [roomId, userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });
        }
        
        await updatePlayerList(io, roomId);
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });

  // เมื่อเริ่มเกม (หลังจากเลือกคำถามแล้ว)
  socket.on('start_game', async (roomId, ownerId) => {
    try {
      // ตรวจสอบว่าเป็นเจ้าของห้องหรือไม่
      const room = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT creator_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });

      if (!room || room.creator_id !== ownerId) {
        socket.emit('game_error', { message: 'ไม่มีสิทธิ์เริ่มเกม' });
        return;
      }

      // บันทึกสถานะเกมเริ่มต้นสำหรับทุกคนในห้อง
      const players = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all('SELECT user_id FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });

      for (const player of players) {
        await saveGameState(roomId, player.user_id, {
          currentQuestion: 0,
          answeredQuestions: [],
          gameStarted: true,
          gameFinished: false
        });
      }

      // แจ้งทุกคนในห้องว่าเกมเริ่มแล้ว
      io.to(`room_${roomId}`).emit('game_started');

    } catch (error) {
      console.error('Error in start_game:', error);
      io.to(`room_${roomId}`).emit('game_error', { message: 'เกิดข้อผิดพลาดในการเริ่มเกม' });
    }
  });

  // เมื่อเลือกคำถาม
  socket.on('questions_selected', async (roomId, selectedQuestionIds) => {
    try {
      // ลบคำถามเก่าของห้องนี้ก่อน
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM room_questions WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // เพิ่มคำถามใหม่ลงในตาราง room_questions
      for (const questionId of selectedQuestionIds) {
        await executeWithRetry(async () => {
          return new Promise((resolve, reject) => {
            usersDB.run('INSERT INTO room_questions (room_id, question_id) VALUES (?, ?)', 
                       [roomId, questionId], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      }

      // ดึงคำถามจากฐานข้อมูลตาม ID ที่เลือก
      const placeholders = selectedQuestionIds.map(() => '?').join(',');
      const questions = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all(`SELECT * FROM questions WHERE id IN (${placeholders})`, selectedQuestionIds, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });

      if (questions.length === 0) {
        io.to(`room_${roomId}`).emit('game_error', { message: 'ไม่สามารถดึงคำถามได้' });
        return;
      }

      // ส่งคำถามที่เลือกไปให้ทุกคนในห้อง
      io.to(`room_${roomId}`).emit('game_questions', questions);

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

        // ดึงข้อมูลคำถามปัจจุบันจาก client (ส่งมาจาก frontend)
        const currentQuestionData = data.currentQuestion;
        let isCorrect = false;
        let scoreGained = 0;

        console.log('submit_answer - data:', {
          roomId: data.roomId,
          userId: data.userId,
          answerIndex: data.answerIndex,
          currentQuestion: currentQuestionData
        });

        if (currentQuestionData && data.answerIndex !== -1) {
            // ตรวจสอบคำตอบที่ถูกต้อง (answer_index เริ่มจาก 1 แต่ answerIndex เริ่มจาก 0)
            const correctAnswerIndex = currentQuestionData.answer_index - 1;
            isCorrect = parseInt(data.answerIndex) === correctAnswerIndex;

            console.log('Answer check:', {
              userAnswer: data.answerIndex,
              correctAnswer: correctAnswerIndex,
              isCorrect: isCorrect
            });

            if (isCorrect) {
                // ใช้คะแนนจากคำถามแต่ละข้อ
                const questionPoints = currentQuestionData.points || 10; // ถ้าไม่มีคะแนนให้ใช้ 10 เป็นค่าเริ่มต้น
                
                // คำนวณคะแนนที่ลดลงตามเวลา (ตอบไวได้คะแนนเต็ม ตอบช้าคะแนนลดลง)
                const maxTime = 20000; // 20 วินาที
                const timeUsed = Math.min(data.answerTime, maxTime);
                
                // คะแนนลดลงตามสัดส่วนเวลาที่ใช้ (ตอบทันทีได้คะแนนเต็ม ตอบช้าคะแนนลดลง)
                const timeRatio = timeUsed / maxTime; // 0 = ตอบทันที, 1 = ตอบช้า
                scoreGained = Math.floor(questionPoints * (1 - timeRatio * 0.5)); // ลดลงสูงสุด 50%

                console.log('Score calculation:', {
                  questionPoints: questionPoints,
                  timeUsed: timeUsed,
                  timeRatio: timeRatio,
                  scoreGained: scoreGained
                });
            }
        }

        // ดึงคะแนนปัจจุบัน
        const scoreRow = await executeWithRetry(async () => {
          return new Promise((resolve, reject) => {
            usersDB.get('SELECT score FROM room_players WHERE room_id = ? AND user_id = ?', [data.roomId, data.userId], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });
        });

        const currentScore = scoreRow ? scoreRow.score : 0;
        const newScore = currentScore + scoreGained;

        console.log('Score update:', {
          currentScore: currentScore,
          scoreGained: scoreGained,
          newScore: newScore
        });

        // อัปเดตคะแนนในฐานข้อมูล
        await executeWithRetry(async () => {
          return new Promise((resolve, reject) => {
            usersDB.run('UPDATE room_players SET score = ? WHERE room_id = ? AND user_id = ?', [newScore, data.roomId, data.userId], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });

        // บันทึกสถานะเกม (คำตอบที่เลือก)
        const currentGameState = await getGameState(data.roomId, data.userId);
        const answeredQuestions = [...currentGameState.answeredQuestions];
        answeredQuestions[data.questionIndex] = {
          answerIndex: data.answerIndex,
          answerTime: data.answerTime,
          isCorrect: isCorrect,
          scoreGained: scoreGained
        };

        await saveGameState(data.roomId, data.userId, {
          ...currentGameState,
          answeredQuestions: answeredQuestions
        });

        // ส่งข้อมูลกลับไปยัง client พร้อมข้อมูลคะแนน
        io.to(`room_${data.roomId}`).emit('user_answered', { 
            ...data, 
            score: newScore,
            isCorrect: isCorrect,
            scoreGained: scoreGained
        });

        // อัปเดตรายชื่อผู้เล่นเพื่อแสดงคะแนนใหม่
        await updatePlayerList(io, data.roomId);

    } catch (error) {
      console.error('Error in submit_answer:', error);
      
      // แม้จะมี error ก็ยังส่งข้อมูลกลับไปยัง client
      if (data.currentQuestion && data.answerIndex !== -1) {
        const correctAnswerIndex = data.currentQuestion.answer_index - 1;
        const isCorrect = parseInt(data.answerIndex) === correctAnswerIndex;
        
        io.to(`room_${data.roomId}`).emit('user_answered', { 
            ...data, 
            isCorrect: isCorrect,
            scoreGained: isCorrect ? 10 : 0
        });
      }
    }
  });

  // เมื่อคำถามจบแล้ว (หมดเวลาหรือทุกคนตอบแล้ว)
  socket.on('question_ended', async (data) => {
    try {
      // ตรวจสอบว่าทุกคนในห้องตอบแล้วหรือยัง
      const players = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all('SELECT user_id FROM room_players WHERE room_id = ?', [data.roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });

      const answers = roomAnswers[data.roomId] && roomAnswers[data.roomId][data.questionIndex] ? roomAnswers[data.roomId][data.questionIndex] : [];
      const answeredUserIds = answers.map(a => a.userId);

      // ถ้าทุกคนตอบแล้ว หรือมีคนส่ง event นี้มา ให้จบคำถาม
      if (answeredUserIds.length >= players.length || answers.length > 0) {
        // อัปเดตคำถามปัจจุบันสำหรับทุกคนในห้อง
        const nextQuestionIndex = data.questionIndex + 1;
        for (const player of players) {
          const currentGameState = await getGameState(data.roomId, player.user_id);
          await saveGameState(data.roomId, player.user_id, {
            ...currentGameState,
            currentQuestion: nextQuestionIndex
          });
        }

        // แจ้งทุกคนในห้องว่าคำถามจบแล้ว
        io.to(`room_${data.roomId}`).emit('question_ended', { questionIndex: data.questionIndex });
      }

    } catch (error) {
      console.error('Error in question_ended:', error);
    }
  });



  // เมื่อผู้เล่นตอบคำถามแล้ว
  socket.on('answer_submitted', async (data) => {
    try {
      // ตรวจสอบว่าทุกคนในห้องตอบแล้วหรือยัง
      const players = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all('SELECT user_id FROM room_players WHERE room_id = ?', [data.roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });

      const answers = roomAnswers[data.roomId] && roomAnswers[data.roomId][data.questionIndex] ? roomAnswers[data.roomId][data.questionIndex] : [];
      const answeredUserIds = answers.map(a => a.userId);

      // ถ้าทุกคนตอบแล้ว ให้จบคำถาม
      if (answeredUserIds.length >= players.length) {
        // รอ 1 วินาทีแล้วจบคำถาม
        setTimeout(() => {
          io.to(`room_${data.roomId}`).emit('question_ended', { questionIndex: data.questionIndex });
        }, 1000);
      }

    } catch (error) {
      console.error('Error in answer_submitted:', error);
    }
  });

  // Owner requests questions (for modal selection)
  socket.on('request_questions', async (roomId) => {
    try {
      const questions = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all('SELECT id, * FROM questions', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });
      io.to(socket.id).emit('select_questions', questions);
    } catch (error) {
      console.error('Error in request_questions:', error);
      io.to(socket.id).emit('game_error', { message: 'เกิดข้อผิดพลาดในการดึงคำถาม' });
    }
  });

  // เมื่อเปิดเผยเฉลย
  socket.on('reveal_answer', async (roomId, questionIndex, correctIndex) => {
    try {
      const answers = (roomAnswers[roomId] && roomAnswers[roomId][questionIndex]) || [];
      const correct = answers.filter(a => a.answerIndex === correctIndex)
        .sort((a, b) => a.answerTime - b.answerTime);

      io.to(`room_${roomId}`).emit('answer_revealed', { questionIndex, correct });
    } catch (error) {
      console.error('Error in reveal_answer:', error);
      socket.emit('game_error', { message: 'เกิดข้อผิดพลาดในการเปิดเผยคำตอบ' });
    }
  });

  // บันทึกสถานะเกมจาก client
  socket.on('save_game_state', async ({ roomId, userId, gameState }) => {
    try {
      await saveGameState(roomId, userId, gameState);
      socket.emit('game_state_saved', { success: true });
    } catch (error) {
      console.error('Error saving game state:', error);
      socket.emit('game_error', { message: 'เกิดข้อผิดพลาดในการบันทึกสถานะเกม' });
    }
  });

  // รีเซ็ตเกม
  socket.on('reset_game', async (roomId, ownerId) => {
    try {
      // ตรวจสอบว่าเป็นเจ้าของห้องหรือไม่
      const room = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT creator_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });

      if (!room || room.creator_id !== ownerId) {
        socket.emit('game_error', { message: 'ไม่มีสิทธิ์รีเซ็ตเกม' });
        return;
      }

      // ลบสถานะเกมของทุกคนในห้อง
      const players = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.all('SELECT user_id FROM room_players WHERE room_id = ?', [roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });

      for (const player of players) {
        await executeWithRetry(async () => {
          return new Promise((resolve, reject) => {
            usersDB.run('DELETE FROM game_state WHERE room_id = ? AND user_id = ?', 
              [roomId, player.user_id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      }

      // ลบคำถามเก่าของห้องนี้
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM room_questions WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      console.log(`Questions reset for room ${roomId}`);
      
      // ลบ game_state ของทุกคนในห้อง
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM game_state WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // รีเซ็ตคะแนนของทุกคนในห้อง
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('UPDATE room_players SET score = 0 WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // ลบประวัติการทำอาหารของห้องนี้
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM cooked_meals WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // ลบวัตถุดิบของทุกคนในห้อง
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM player_ingredients WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // ลบอาหารของทุกคนในห้อง
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM player_foods WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      console.log(`Game reset for room ${roomId} by owner ${ownerId}`);

      // แจ้งทุกคนในห้องว่าเกมจบแล้ว
      io.to(`room_${roomId}`).emit('game_reset', { 
        message: 'เกมจบแล้ว พร้อมเริ่มเกมใหม่',
        resetBy: ownerId
      });

      // อัปเดตรายชื่อผู้เล่น
      await updatePlayerList(io, roomId);

    } catch (error) {
      console.error('Error in reset_game:', error);
      socket.emit('game_error', { message: 'เกิดข้อผิดพลาดในการรีเซ็ตเกม' });
    }
  });

  // รีเซ็ตเกมอัตโนมัติหลังจบเกม
  socket.on('auto_reset_game', async (roomId) => {
    try {
      console.log(`Auto reset requested for room ${roomId}`);
      await autoResetGame(io, roomId);
    } catch (error) {
      console.error('Error in auto_reset_game:', error);
    }
  });

  // Owner deletes room
  socket.on('delete_room', async (roomId, userId) => {
    try {
      // Check if user is owner
      const room = await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.get('SELECT * FROM rooms WHERE id = ? AND creator_id = ?', [roomId, userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });
      if (!room) {
        socket.emit('game_error', { message: 'ไม่มีสิทธิ์ลบห้องนี้' });
        return;
      }
      // Delete room and related data
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM room_players WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM room_questions WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM game_state WHERE room_id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      await executeWithRetry(async () => {
        return new Promise((resolve, reject) => {
          usersDB.run('DELETE FROM rooms WHERE id = ?', [roomId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      io.to(`room_${roomId}`).emit('room_deleted');
      io.socketsLeave(`room_${roomId}`);

    } catch (error) {
      console.error('Error in delete_room:', error);
      socket.emit('game_error', { message: 'เกิดข้อผิดพลาดในการลบห้อง' });
    }
  });
};

// ฟังก์ชันรีเซ็ตเกมอัตโนมัติหลังจบเกม
const autoResetGame = async (io, roomId) => {
  try {
    console.log(`Auto resetting game for room ${roomId}`);
    
    // ลบคำถามเก่าของห้องนี้
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM room_questions WHERE room_id = ?', [roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    // ลบ game_state ของทุกคนในห้อง (รีเซ็ตเฉพาะสถานะเกม ไม่รีเซ็ตคะแนน)
    await executeWithRetry(async () => {
      return new Promise((resolve, reject) => {
        usersDB.run('DELETE FROM game_state WHERE room_id = ?', [roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    // ไม่รีเซ็ตคะแนนของผู้เล่น (เก็บคะแนนไว้)
    console.log('Keeping player scores unchanged');
    
    // ไม่ลบข้อมูลอาหารที่ทำแล้วและวัตถุดิบของผู้เล่น (เก็บไว้)
    console.log('Keeping cooked meals and player ingredients/foods unchanged');
    
    console.log(`Auto reset completed for room ${roomId} (questions and game state only)`);
    
    // แจ้งทุกคนในห้องว่าเกมจบแล้ว
    io.to(`room_${roomId}`).emit('game_auto_reset', {
      message: 'เกมจบแล้ว (เฉพาะคำถาม) คะแนน วัตถุดิบ และอาหารยังคงอยู่ พร้อมเริ่มเกมใหม่'
    });
    
    await updatePlayerList(io, roomId);
    
  } catch (error) {
    console.error('Error in auto reset game:', error);
  }
};

module.exports = {
  updatePlayerList,
  addPlayerToRoom,
  removePlayerFromRoom,
  setupRoomHandlers,
  saveGameState,
  getGameState,
  autoResetGame
};