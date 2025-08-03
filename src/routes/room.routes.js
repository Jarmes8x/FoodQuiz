const router = require("express").Router();
const usersDB = require("../database/dbConfig");

// ลบห้อง (เฉพาะเจ้าของ)
router.delete('/room/:id', (req, res) => {
  const roomId = req.params.id;
  const userId = req.user?.id; // ตรวจสอบ user จาก middleware

  if (!userId) {
    return res.status(401).json({ error: 'ไม่ได้รับอนุญาต' });
  }

  const io = req.app.get('io');

  // ตรวจสอบสิทธิ์เจ้าของห้อง
  usersDB.get('SELECT * FROM rooms WHERE id = ? AND creator_id = ?', [roomId, userId], (err, room) => {
    if (err || !room) {
      return res.status(404).json({ error: 'ไม่พบห้องหรือไม่มีสิทธิ์ลบ' });
    }

    // ลบห้องและข้อมูลที่เกี่ยวข้อง
    usersDB.run('DELETE FROM room_players WHERE room_id = ?', [roomId], (err1) => {
      if (err1) {
        console.error('Delete room_players error:', err1);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบผู้เล่นในห้อง' });
      }

      usersDB.run('DELETE FROM questions WHERE room_id = ?', [roomId], (err2) => {
        if (err2) {
          console.error('Delete questions error:', err2);
          return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบคำถามในห้อง' });
        }

        usersDB.run('DELETE FROM rooms WHERE id = ?', [roomId], (err3) => {
          if (err3) {
            console.error('Delete room error:', err3);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบห้อง' });
          }

          // แจ้งเตือนทุก client ในห้องนี้ผ่าน socket.io
          if (io) {
            io.to(`room_${roomId}`).emit('room_deleted');
          }

          res.status(200).json({ success: true, message: 'ลบห้องเรียบร้อยแล้ว' });
        });
      });
    });
  });
});

module.exports = router;