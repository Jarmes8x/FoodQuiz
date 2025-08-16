const router = require("express").Router();
const usersDB = require("../database/dbConfig");

// ฟังก์ชันช่วยสำหรับการทำงานกับฐานข้อมูลแบบ Promise
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    usersDB.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function getQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    usersDB.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// ลบห้อง (เฉพาะเจ้าของ)
router.delete('/room/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user?.id; // ตรวจสอบ user จาก middleware

    // ตรวจสอบว่ามี user หรือไม่
    if (!userId) {
      return res.status(401).json({ 
        error: 'ไม่ได้รับอนุญาต',
        message: 'กรุณาเข้าสู่ระบบก่อน' 
      });
    }

    // ตรวจสอบสิทธิ์เจ้าของห้อง
    const room = await getQuery(
      'SELECT * FROM rooms WHERE id = ? AND creator_id = ?', 
      [roomId, userId]
    );

    if (!room) {
      return res.status(404).json({ 
        error: 'ไม่พบห้องหรือไม่มีสิทธิ์ลบ',
        message: 'ห้องนี้ไม่มีอยู่หรือคุณไม่มีสิทธิ์ลบ' 
      });
    }

    // ลบข้อมูลที่เกี่ยวข้องกับห้องตามลำดับ
    const deleteSteps = [
      {
        query: 'DELETE FROM room_players WHERE room_id = ?',
        params: [roomId],
        errorMessage: 'เกิดข้อผิดพลาดในการลบผู้เล่นในห้อง'
      },
      {
        query: 'DELETE FROM room_questions WHERE room_id = ?',
        params: [roomId],
        errorMessage: 'เกิดข้อผิดพลาดในการลบคำถามในห้อง'
      },
      {
        query: 'DELETE FROM player_foods WHERE room_id = ?',
        params: [roomId],
        errorMessage: 'เกิดข้อผิดพลาดในการลบข้อมูลอาหารในห้อง'
      },
      {
        query: 'DELETE FROM rooms WHERE id = ?',
        params: [roomId],
        errorMessage: 'เกิดข้อผิดพลาดในการลบห้อง'
      }
    ];

    // ทำการลบข้อมูลทีละขั้นตอน
    for (const step of deleteSteps) {
      try {
        await runQuery(step.query, step.params);
      } catch (error) {
        console.error(`Delete error in step: ${step.query}`, error);
        return res.status(500).json({ 
          error: step.errorMessage,
          message: 'กรุณาลองใหม่อีกครั้ง' 
        });
      }
    }

    // แจ้งเตือนทุก client ในห้องนี้ผ่าน socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`room_${roomId}`).emit('room_deleted', {
        message: 'ห้องถูกลบโดยเจ้าของ',
        roomId: roomId
      });
    }

    // ส่งผลลัพธ์สำเร็จ
    res.status(200).json({ 
      success: true, 
      message: 'ลบห้องเรียบร้อยแล้ว',
      roomId: roomId
    });

  } catch (error) {
    console.error('Unexpected error in delete room:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
      message: 'กรุณาลองใหม่อีกครั้ง' 
    });
  }
});

module.exports = router;