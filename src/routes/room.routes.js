const router = require("express").Router();
const usersDB = require("../database/dbConfig");

// ลบห้อง (เฉพาะเจ้าของ)
router.post('/room/:id', (req, res) => {
  const roomId = req.params.id;
  // ตรวจสอบสิทธิ์เจ้าของห้อง (ควรเพิ่ม logic ตรวจสอบ user)
  // แจ้งเตือนทุก client ในห้องนี้ผ่าน socket.io ก่อนลบห้อง
  const io = req.app.get('io');
  if (io) {
    io.to(`room_${roomId}`).emit('room_deleted');
  }
  usersDB.run('DELETE FROM rooms WHERE id = ?', [roomId], function(err) {
    if (err) return res.status(500).send("เกิดข้อผิดพลาด");
    res.redirect('/dashboard');
  });
});

module.exports = router;